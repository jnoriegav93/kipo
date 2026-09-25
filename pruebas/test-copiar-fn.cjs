// Prueba de la función `copiarMateriales` (functions/index.js) SIN tocar producción:
// se carga index.js de verdad, pero `firebase-admin` se reemplaza por una Firestore falsa
// en memoria, y se llama al manejador con `.run(request)`.
// Hay mutantes del CÓDIGO (index.js con un cambio) y de la BASE FALSA (que finge mal una
// operación): todos TIENEN que hacer fallar algún escenario.
const Module = require('module');
const path = require('path');
const fs = require('fs');

process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'kipo-d29af', storageBucket: 'kipo-d29af.appspot.com' });
process.env.GCLOUD_PROJECT = 'kipo-d29af';

const FUNCS = path.join(__dirname, '..', 'functions');
const INDEX = path.join(FUNCS, 'index.js');

// ── Firestore falsa ─────────────────────────────────────────────────────────
const clonar = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
class Sentinela { constructor(op, vals) { this.op = op; this.vals = vals; } }
const FieldValue = {
  delete: () => new Sentinela('delete'),
  arrayUnion: (...vals) => new Sentinela('arrayUnion', vals),
  arrayRemove: (...vals) => new Sentinela('arrayRemove', vals),
  increment: (n) => new Sentinela('increment', [n]),
  serverTimestamp: () => new Sentinela('serverTimestamp'),
};

// Como Firestore: `undefined` y sentinelas anidadas se rechazan.
const validarValor = (v, ruta) => {
  if (v === undefined) throw new Error(`Cannot use "undefined" as a Firestore value (${ruta})`);
  if (v instanceof Sentinela) throw new Error(`Sentinela anidada en ${ruta}`);
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) validarValor(x, `${ruta}.${k}`);
};

let db; // la única instancia; cada escenario la reinicia
class DocRef {
  constructor(col, id) { this.col = col; this.id = id; this.path = `${col}/${id}`; }
  async get() { return db._snap(this); }
  async update(d) { db._escribir([() => db._update(this, d)]); }
  async set(d, o) { db._escribir([() => db._set(this, d, o)]); }
}
class Query {
  constructor(col, filtros = []) { this.col = col; this.filtros = filtros; }
  where(campo, op, val) { return new Query(this.col, [...this.filtros, { campo, op, val }]); }
  doc(id) { return new DocRef(this.col, id || `auto${++db.autoId}`); }
  async get() {
    const docs = [];
    for (const [ruta, datos] of db.store) {
      const [col, id] = ruta.split('/');
      if (col !== this.col) continue;
      const pasa = this.filtros.every(({ campo, op, val }) => {
        const x = campo.split('.').reduce((o, k) => (o == null ? undefined : o[k]), datos);
        if (op === '==') return x === val;
        if (op === 'in') return val.includes(x);
        if (op === 'array-contains') return Array.isArray(x) && x.includes(val);
        throw new Error(`op no soportada: ${op}`);
      });
      if (pasa) docs.push(db._snap(new DocRef(col, id)));
    }
    return { docs, size: docs.length, empty: !docs.length };
  }
}
class DbFalsa {
  constructor() { this.reiniciar({}, {}); }
  reiniciar(datos, opciones) {
    this.store = new Map(Object.entries(clonar(datos)));
    this.op = opciones || {};
    this.autoId = 0;
    this.transacciones = 0;
  }
  collection(nombre) { return new Query(nombre); }
  _snap(ref) {
    const d = this.store.get(ref.path);
    return { id: ref.id, ref, exists: d !== undefined, data: () => clonar(d) };
  }
  _update(ref, cambios) {
    const actual = this.store.get(ref.path);
    if (actual === undefined) throw new Error(`NOT_FOUND: ${ref.path}`);
    const claves = Object.keys(cambios);
    for (const a of claves) for (const b of claves) {
      if (a !== b && b.startsWith(`${a}.`)) throw new Error(`Rutas en conflicto: ${a} y ${b}`);
    }
    for (const [ruta, valor] of Object.entries(cambios)) this._campo(actual, ruta, valor);
  }
  _set(ref, datos, o) {
    for (const [k, v] of Object.entries(datos)) if (!(v instanceof Sentinela)) validarValor(v, k);
    if (o && o.merge) {
      const actual = this.store.get(ref.path) || {};
      for (const [k, v] of Object.entries(datos)) this._campo(actual, k, v);
      this.store.set(ref.path, actual);
    } else {
      this.store.set(ref.path, clonar(datos));
    }
  }
  _campo(obj, ruta, valor) {
    const partes = ruta.split('.');
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) {
      if (o[partes[i]] == null || typeof o[partes[i]] !== 'object' || Array.isArray(o[partes[i]])) o[partes[i]] = {};
      o = o[partes[i]];
    }
    const k = partes[partes.length - 1];
    if (valor instanceof Sentinela) {
      const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      if (valor.op === 'delete') { if (!this.op.ignorarDelete) delete o[k]; return; }
      if (valor.op === 'arrayUnion') {
        const res = this.op.unionReemplaza ? [] : [...(Array.isArray(o[k]) ? o[k] : [])];
        for (const v of valor.vals) { validarValor(v, ruta); if (!res.some(x => iguales(x, v))) res.push(clonar(v)); }
        o[k] = res; return;
      }
      if (valor.op === 'arrayRemove') { o[k] = (Array.isArray(o[k]) ? o[k] : []).filter(x => !valor.vals.some(v => iguales(x, v))); return; }
      if (valor.op === 'increment') { o[k] = (typeof o[k] === 'number' ? o[k] : 0) + valor.vals[0]; return; }
      if (valor.op === 'serverTimestamp') { o[k] = 'TS'; return; }
    }
    validarValor(valor, ruta);
    o[k] = clonar(valor);
  }
  // Todas o ninguna: se aplican sobre una copia y se confirma al final.
  _escribir(escrituras) {
    const copia = new Map([...this.store].map(([k, v]) => [k, clonar(v)]));
    try { escrituras.forEach(w => w()); } catch (e) { this.store = copia; throw e; }
  }
  async runTransaction(fn) {
    this.transacciones++;
    if (this.op.antesDeTx) this.op.antesDeTx(this);
    const escrituras = [];
    let escribio = false;
    const leer = (ref) => { if (escribio) throw new Error('Firestore: en una transacción, las lecturas van antes que las escrituras'); return this._snap(ref); };
    const tx = {
      get: async (ref) => leer(ref),
      getAll: async (...refs) => refs.map(leer),
      update: (ref, d) => { escribio = true; escrituras.push(() => this._update(ref, d)); return tx; },
      set: (ref, d, o) => { escribio = true; escrituras.push(() => this._set(ref, d, o)); return tx; },
      delete: (ref) => { escribio = true; escrituras.push(() => this.store.delete(ref.path)); return tx; },
    };
    const r = await fn(tx);
    if (!this.op.txMuda) this._escribir(escrituras);
    return r;
  }
  batch() {
    const escrituras = [];
    const b = {
      update: (ref, d) => { escrituras.push(() => this._update(ref, d)); return b; },
      set: (ref, d, o) => { escrituras.push(() => this._set(ref, d, o)); return b; },
      delete: (ref) => { escrituras.push(() => this.store.delete(ref.path)); return b; },
      commit: async () => {
        if (this.op.loteFalla) throw new Error('UNAVAILABLE (falla simulada)');
        if (this.op.loteMudo) return;
        this._escribir(escrituras);
      },
    };
    return b;
  }
}
db = new DbFalsa();

const proxyMudo = () => new Proxy(function () {}, { get: () => proxyMudo(), apply: () => proxyMudo() });
const firestore = () => db;
firestore.FieldValue = FieldValue;
firestore.Timestamp = { now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }) };
const adminFalso = { initializeApp: () => ({}), firestore, storage: () => proxyMudo(), auth: () => proxyMudo() };

const cargaOriginal = Module._load;
Module._load = function (request, ...resto) {
  if (request === 'firebase-admin') return adminFalso;
  return cargaOriginal.call(this, request, ...resto);
};
const { rolEnProyecto } = require(path.join(FUNCS, 'invitaciones.js'));

const cargar = (fuente) => {
  const m = new Module(INDEX, null);
  m.filename = INDEX;
  m.paths = Module._nodeModulePaths(FUNCS);
  m._compile(fuente, INDEX);
  return m.exports;
};

// ── Datos de partida ────────────────────────────────────────────────────────
// P: obra de O (Olga), con E (Eva) editora y S (Sara) supervisora. P2: obra de Z (Zoe),
// donde Eva es supervisora. Cada uno tiene su catálogo; Eva creó a mano f_e1 y f_e2.
const BASE = {
  'proyectos/P': { nombre: 'Obra P', ownerId: 'O', miembros: { O: { rol: 'dueno' }, E: { rol: 'editor' }, S: { rol: 'supervisor' } }, miembrosUids: ['O', 'E', 'S'] },
  'proyectos/P2': { nombre: 'Obra Z', ownerId: 'Z', miembros: { Z: { rol: 'dueno' }, E: { rol: 'supervisor' } }, miembrosUids: ['Z', 'E'] },
  'configuraciones/O': { nombrePersonal: 'Olga', catalogoFerreteria: [{ id: 'b1', nombre: 'AISLADOR' }, { id: 'b2', nombre: 'CLEVIS' }] },
  'configuraciones/E': { nombrePersonal: 'Eva', catalogoFerreteria: [{ id: 'b1', nombre: 'AISLADOR' }, { id: 'f_e1', nombre: 'CINTA EVA', unidad: 'm' }, { id: 'f_e2', nombre: 'GRAPA EVA' }] },
  'configuraciones/Z': { nombrePersonal: 'Zoe', catalogoFerreteria: [{ id: 'f_z1', nombre: 'HEBILLA ZOE' }] },
  'configuraciones/S': { nombrePersonal: 'Sara', catalogoFerreteria: [] },
};
const quien = (uid) => ({ uid, token: { email: `${uid.toLowerCase()}@x.com` } });
const estable = (x) => (Array.isArray(x) ? x.map(estable)
  : (x && typeof x === 'object') ? Object.fromEntries(Object.keys(x).sort().map(k => [k, estable(x[k])])) : x);

const escenarios = async (fn) => {
  const fallas = [];
  const igual = (nombre, obtenido, esperado) => {
    if (JSON.stringify(estable(obtenido)) !== JSON.stringify(estable(esperado))) {
      fallas.push(`${nombre}\n      esperaba ${JSON.stringify(esperado)}\n      salió    ${JSON.stringify(obtenido)}`);
    }
  };
  const doc = (ruta) => clonar(db.store.get(ruta));
  const cat = (uid) => (doc(`configuraciones/${uid}`)?.catalogoFerreteria || []).map(it => it.id);
  const avisos = () => [...db.store].filter(([k]) => k.startsWith('avisos/')).map(([, v]) => v);
  const correr = async (datos, request, opciones) => {
    if (datos) db.reiniciar(datos, opciones);
    try { return { r: await fn.run(request) }; } catch (e) { return { e }; }
  };
  const llamar = (uid, data) => ({ auth: quien(uid), data });

  // 1) Eva lleva armados de SU colección a la obra de Olga: se copia lo suyo que falta
  {
    const ids = ['b1', 'f_e1', 'f_e2', 'f_x'];
    const sim = await correr(BASE, llamar('E', { ids, desde: 'mi', hacia: { proyectoId: 'P' }, simular: true }));
    igual('1 simular: sin error', sim.e ? String(sim.e.message) : null, null);
    igual('1 simular: qué se agregaría y qué no tiene origen', sim.r, { agregados: [{ id: 'f_e1', nombre: 'CINTA EVA' }, { id: 'f_e2', nombre: 'GRAPA EVA' }], sinOrigen: ['f_x'] });
    igual('1 simular: no escribe nada', Object.fromEntries(db.store), BASE);
    const { r, e } = await correr(BASE, llamar('E', { ids, desde: 'mi', hacia: { proyectoId: 'P' } }));
    igual('1 copiar: sin error', e ? String(e.message) : null, null);
    igual('1 copiar: respuesta', r, { agregados: [{ id: 'f_e1', nombre: 'CINTA EVA' }, { id: 'f_e2', nombre: 'GRAPA EVA' }], sinOrigen: ['f_x'] });
    igual('1 el catálogo de Olga suma lo de Eva, detrás de lo suyo', cat('O'), ['b1', 'b2', 'f_e1', 'f_e2']);
    igual('1 el material va tal cual (mismo id y datos)', doc('configuraciones/O').catalogoFerreteria[2], { id: 'f_e1', nombre: 'CINTA EVA', unidad: 'm' });
    igual('1 el catálogo de Eva no cambia', doc('configuraciones/E'), BASE['configuraciones/E']);
    igual('1 aviso a Olga', avisos().map(a => [a.para, a.tipo, a.proyectoId, a.proyectoNombre, a.deUid, a.deNombre, a.materiales, a.visto]),
      [['O', 'materiales', 'P', 'Obra P', 'E', 'Eva', ['CINTA EVA', 'GRAPA EVA'], false]]);
    // 2) Otra vez: ya no falta nada, no se duplica ni se vuelve a avisar
    const otra = await correr(null, llamar('E', { ids, desde: 'mi', hacia: { proyectoId: 'P' } }));
    igual('2 repetir: nada nuevo', otra.r, { agregados: [], sinOrigen: ['f_x'] });
    igual('2 repetir: sin duplicados', cat('O'), ['b1', 'b2', 'f_e1', 'f_e2']);
    igual('2 repetir: un solo aviso', avisos().length, 1);
  }

  // 3) Ids repetidos en el pedido: se copia una vez
  {
    await correr(BASE, llamar('E', { ids: ['f_e1', 'f_e1', 'f_e1'], desde: 'mi', hacia: { proyectoId: 'P' } }));
    igual('3 repetidos: una sola copia', cat('O'), ['b1', 'b2', 'f_e1']);
  }

  // 4) Rechazos: nada cambia
  const rechazos = [
    ['sin sesión', { data: { ids: ['f_e1'], desde: 'mi', hacia: { proyectoId: 'P' } } }, 'unauthenticated'],
    ['la supervisora no escribe en la obra', llamar('S', { ids: ['f_e1'], desde: 'mi', hacia: { proyectoId: 'P' } }), 'permission-denied'],
    ['la supervisora tampoco simula', llamar('S', { ids: ['f_e1'], desde: 'mi', hacia: { proyectoId: 'P' }, simular: true }), 'permission-denied'],
    ['un ajeno no lee de una obra', llamar('X', { ids: ['b2'], desde: { proyectoId: 'P' }, hacia: 'mi' }), 'permission-denied'],
    ['obra inexistente', llamar('E', { ids: ['f_e1'], desde: 'mi', hacia: { proyectoId: 'NOPE' } }), 'not-found'],
    ['sin proyecto', llamar('E', { ids: ['f_e1'], desde: 'mi', hacia: {} }), 'invalid-argument'],
    ['sin materiales', llamar('E', { ids: [], desde: 'mi', hacia: { proyectoId: 'P' } }), 'invalid-argument'],
    ['demasiados materiales', llamar('E', { ids: Array.from({ length: 501 }, (_, i) => `f${i}`), desde: 'mi', hacia: { proyectoId: 'P' } }), 'invalid-argument'],
  ];
  for (const [nombre, req, codigo] of rechazos) {
    const { e } = await correr(BASE, req);
    igual(`4 ${nombre}: código`, e && e.code, codigo);
    igual(`4 ${nombre}: nada cambia`, Object.fromEntries(db.store), BASE);
  }

  // 5) CONSERVAR: Eva guarda en SU colección un armado de la obra de Olga
  {
    const { r, e } = await correr(BASE, llamar('E', { ids: ['b2'], desde: { proyectoId: 'P' }, hacia: 'mi' }));
    igual('5 conservar: sin error', e ? String(e.message) : null, null);
    igual('5 conservar: agrega CLEVIS', r, { agregados: [{ id: 'b2', nombre: 'CLEVIS' }], sinOrigen: [] });
    igual('5 conservar: el catálogo de Eva lo suma', cat('E'), ['b1', 'f_e1', 'f_e2', 'b2']);
    igual('5 conservar: el de Olga no cambia', doc('configuraciones/O'), BASE['configuraciones/O']);
    igual('5 conservar: sin aviso (es su propio catálogo)', avisos().length, 0);
  }

  // 6) Entre obras: de la de Zoe (Eva supervisora ahí) a la de Olga (Eva editora)
  {
    const { r, e } = await correr(BASE, llamar('E', { ids: ['f_z1'], desde: { proyectoId: 'P2' }, hacia: { proyectoId: 'P' } }));
    igual('6 entre obras: sin error', e ? String(e.message) : null, null);
    igual('6 entre obras: agrega la hebilla de Zoe', r && r.agregados, [{ id: 'f_z1', nombre: 'HEBILLA ZOE' }]);
    igual('6 entre obras: al catálogo de Olga', cat('O'), ['b1', 'b2', 'f_z1']);
    igual('6 entre obras: aviso a Olga, de Eva', avisos().map(a => [a.para, a.deNombre, a.materiales]), [['O', 'Eva', ['HEBILLA ZOE']]]);
  }

  // 7) La dueña, de su colección a su obra: mismo catálogo, no hay de dónde copiar
  {
    const { r, e } = await correr(BASE, llamar('O', { ids: ['f_x', 'b1'], desde: 'mi', hacia: { proyectoId: 'P' } }));
    igual('7 mismo catálogo: sin error', e ? String(e.message) : null, null);
    igual('7 mismo catálogo: lo que falta no tiene origen', r, { agregados: [], sinOrigen: ['f_x'] });
    igual('7 mismo catálogo: nada cambia', Object.fromEntries(db.store), BASE);
  }

  // 8) El dueño sin configuración: no se inventa una
  {
    const datos = clonar(BASE); delete datos['configuraciones/O'];
    const { e } = await correr(datos, llamar('E', { ids: ['f_e1'], desde: 'mi', hacia: { proyectoId: 'P' } }));
    igual('8 sin configuración: código', e && e.code, 'failed-precondition');
    igual('8 sin configuración: nada cambia', Object.fromEntries(db.store), datos);
  }
  return fallas;
};

// ── Corrida ─────────────────────────────────────────────────────────────────
const MUTANTES_CODIGO = {
  'no copia': ['tx.set(destinoRef, { catalogoFerreteria: [...catDestino, ...agregar] }, { merge: true });', ''],
  'copia aunque simule': ['if (simular || agregar.length === 0) return', 'if (agregar.length === 0) return'],
  'deja escribir a la supervisora': ["escribir ? !['dueno', 'editor'].includes(rol) : !rol", "escribir ? !['dueno', 'editor', 'supervisor'].includes(rol) : !rol"],
  'no pide ser miembro para leer': ["escribir ? !['dueno', 'editor'].includes(rol) : !rol", "escribir ? !['dueno', 'editor'].includes(rol) : false"],
  'avisa también al que llama': ["    if (destino.uid !== yo) {\n      tx.set(db.collection('avisos')", "    if (true) {\n      tx.set(db.collection('avisos')"],
  'pisa el catálogo del dueño': ['[...catDestino, ...agregar]', '[...agregar]'],
  'crea configuración si no hay': ["if (!dSnap.exists) throw new HttpsError('failed-precondition'", "if (false) throw new HttpsError('failed-precondition'"],
};
const MUTANTES_BASE = {
  'la transacción no escribe': { txMuda: true },
};

(async () => {
  const fuente = fs.readFileSync(INDEX, 'utf8');
  const real = cargar(fuente).copiarMateriales;
  const fallasReal = await escenarios(real);
  console.log(`real: ${fallasReal.length} falla(s)`);
  fallasReal.forEach(f => console.log('  ✗ ' + f));
  let todos = true;
  for (const [nombre, opciones] of Object.entries(MUTANTES_BASE)) {
    const reiniciar = db.reiniciar.bind(db);
    db.reiniciar = (datos, op) => reiniciar(datos, { ...(op || {}), ...opciones });
    const n = (await escenarios(real)).length;
    db.reiniciar = reiniciar;
    console.log(`mutante de base «${nombre}» (TIENE que fallar): ${n} falla(s)`);
    if (n === 0) todos = false;
  }
  for (const [nombre, [antes, despues]] of Object.entries(MUTANTES_CODIGO)) {
    const veces = fuente.split(antes).length - 1;
    if (veces !== 1) { console.log(`mutante «${nombre}»: MAL ARMADO (el texto aparece ${veces} veces)`); todos = false; continue; }
    const fn = cargar(fuente.replace(antes, despues)).copiarMateriales;
    const n = (await escenarios(fn)).length;
    console.log(`mutante «${nombre}» (TIENE que fallar): ${n} falla(s)`);
    if (n === 0) todos = false;
  }
  const ok = fallasReal.length === 0 && todos;
  console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: MAL');
  process.exit(ok ? 0 : 1);
})();
