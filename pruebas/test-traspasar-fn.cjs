// Prueba de la función `traspasarProyecto` (functions/index.js) SIN tocar producción:
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
    this._escribir(escrituras);
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
const BASE = {
  'proyectos/P1': {
    nombre: 'Obra Prueba', ownerId: 'A', ownerNombre: 'Ana', ownerEmpresa: 'EmpA',
    miembros: {
      A: { rol: 'dueno', desde: 't0' },
      B: { rol: 'editor', desde: 't1', por: 'A', invitacion: 'inv1', nombre: 'Beto', empresa: 'EmpB' },
      C: { rol: 'supervisor', desde: 't2', por: 'A', nombre: 'Caro', empresa: 'EmpC' },
    },
    miembrosUids: ['A', 'B', 'C'],
    armados: [{ nombre: 'ARM1', items: [{ idRef: 'b2', cant: 1 }] }],
  },
  'proyectos/P2': { nombre: 'Otra', ownerId: 'A', miembros: { A: { rol: 'dueno' } }, miembrosUids: ['A'] },
  'puntos/p1': { proyectoId: 'P1', ownerId: 'A', datos: { ferreteriaFinal: { b1: 2, f_9: 1 } } },
  'puntos/p2': { proyectoId: 'P1', ownerId: 'B', datos: { armadosSeleccionados: [{ items: [{ idRef: 'b7' }] }] } },
  'puntos/p3': { proyectoId: 'P2', ownerId: 'A', datos: { ferreteriaFinal: { f_otro: 1 } } },
  'cablesAcero/c1': { proyectoId: 'P1', ferrId: 'b13' },
  'controlFerreteria/k1': { proyectoId: 'P1', ownerId: 'A', recibido: { f_5: { cant: 2 } } },
  'controlFerreteria/k2': { proyectoId: 'P1', ownerId: 'C', recibido: { f_c: { cant: 1 } } },
  'configuraciones/A': {
    nombrePersonal: 'Ana', empresaPersonal: 'EmpA', email: 'ana@x.com', catalogoFerreteria: [
      { id: 'b1', nombre: 'AISLADOR' }, { id: 'b2', nombre: 'CLEVIS' }, { id: 'b7', nombre: 'GRAPA' },
      { id: 'b13', nombre: 'CABLE ACERO' }, { id: 'f_5', nombre: 'CINTA' }, { id: 'f_9', nombre: 'HEBILLA' },
      { id: 'f_otro', nombre: 'OTRO' }],
  },
  'configuraciones/B': {
    nombrePersonal: 'Beto', empresaPersonal: 'EmpB', email: 'beto@x.com',
    catalogoFerreteria: [{ id: 'b1', nombre: 'AISLADOR DE BETO' }, { id: 'b2', nombre: 'CLEVIS' }],
  },
  'configuraciones/C': { nombrePersonal: 'Caro', email: 'caro@x.com', catalogoFerreteria: [] },
  'invitaciones/i1': { proyectoId: 'P1', estado: 'abierta', tipo: 'link', deUid: 'A', rol: 'editor' },
  'invitaciones/i2': { proyectoId: 'P1', estado: 'abierta', tipo: 'qr', deUid: 'A', rol: 'supervisor' },
  'invitaciones/i3': { proyectoId: 'P1', estado: 'usada', tipo: 'link', deUid: 'A', rol: 'editor' },
  'invitaciones/i4': { proyectoId: 'P2', estado: 'abierta', tipo: 'link', deUid: 'A', rol: 'editor' },
};

const VIEJOS = ['compartidoCon', 'permisos', 'supervisoresInfo', 'enListaDe', 'grupoId', 'solicitudesPendientes', 'codigoAcceso'];
const quien = (uid) => ({ uid, token: { email: `${uid.toLowerCase()}@x.com` } });

// ── Escenarios ──────────────────────────────────────────────────────────────
// Comparación sin importar el orden de las claves de los objetos (los arrays, sí).
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
  const ids = (cfg) => (cfg?.catalogoFerreteria || []).map(it => it.id);
  const ord = (a) => [...(a || [])].sort();
  const avisos = () => [...db.store].filter(([k]) => k.startsWith('avisos/')).map(([, v]) => v);
  const correr = async (datos, request, opciones) => {
    db.reiniciar(datos, opciones);
    try { return { r: await fn.run(request) }; } catch (e) { return { e }; }
  };

  // 1) A le pasa P1 a B (editor)
  {
    const { r, e } = await correr(BASE, { data: { proyectoId: 'P1', nuevoDuenoUid: 'B' }, auth: quien('A') });
    igual('1 sin error', e ? String(e.message) : null, null);
    igual('1 respuesta', r && { ...r }, { ok: true, completo: true, proyectoNombre: 'Obra Prueba', agregados: 4, sinOrigen: 0 });
    const p = doc('proyectos/P1');
    igual('1 dueño', [p.ownerId, p.ownerNombre, p.ownerEmpresa], ['B', 'Beto', 'EmpB']);
    igual('1 roles (lectura nueva)', ['A', 'B', 'C'].map(u => rolEnProyecto(p, u)), ['editor', 'dueno', 'supervisor']);
    igual('1 no crea ningún campo viejo', VIEJOS.filter(k => k in p), []);
    igual('1 B conserva desde, invitación y nombre', [p.miembros.B.desde, p.miembros.B.invitacion, typeof p.miembros.B.duenoDesde, p.miembros.B.nombre], ['t1', 'inv1', 'string', 'Beto']);
    igual('1 A queda editor, con su desde y su nombre', p.miembros.A, { desde: 't0', rol: 'editor', nombre: 'Ana', empresa: 'EmpA' });
    igual('1 C intacto', p.miembros.C, BASE['proyectos/P1'].miembros.C);
    igual('1 miembrosUids', ord(p.miembrosUids), ['A', 'B', 'C']);
    igual('1 catálogo de B', ord(ids(doc('configuraciones/B'))), ord(['b1', 'b2', 'b7', 'b13', 'f_5', 'f_9']));
    igual('1 lo de B queda primero', ids(doc('configuraciones/B')).slice(0, 2), ['b1', 'b2']);
    igual('1 lo agregado viene tal cual', doc('configuraciones/B').catalogoFerreteria.find(it => it.id === 'f_5'), { id: 'f_5', nombre: 'CINTA' });
    igual('1 B no pierde su nombre de b1', doc('configuraciones/B').catalogoFerreteria[0].nombre, 'AISLADOR DE BETO');
    igual('1 catálogo de A intacto', doc('configuraciones/A'), BASE['configuraciones/A']);
    igual('1 controles', [doc('controlFerreteria/k1').ownerId, doc('controlFerreteria/k2').ownerId], ['B', 'C']);
    igual('1 invitaciones', ['i1', 'i2', 'i3', 'i4'].map(i => doc(`invitaciones/${i}`).estado), ['anulada', 'anulada', 'usada', 'abierta']);
    const av = avisos();
    igual('1 aviso', av.map(a => [a.para, a.tipo, a.proyectoId, a.proyectoNombre, a.deUid, a.deNombre, a.visto]),
      [['B', 'traspaso', 'P1', 'Obra Prueba', 'A', 'Ana', false]]);
    igual('1 otra obra intacta', doc('proyectos/P2'), BASE['proyectos/P2']);
  }

  // 2) Rechazos: nada cambia
  const rechazos = [
    ['sin sesión', { data: { proyectoId: 'P1', nuevoDuenoUid: 'B' } }, 'unauthenticated'],
    ['no es el dueño', { data: { proyectoId: 'P1', nuevoDuenoUid: 'B' }, auth: quien('C') }, 'permission-denied'],
    ['el destino no es miembro', { data: { proyectoId: 'P1', nuevoDuenoUid: 'D' }, auth: quien('A') }, 'failed-precondition'],
    ['a sí mismo', { data: { proyectoId: 'P1', nuevoDuenoUid: 'A' }, auth: quien('A') }, 'invalid-argument'],
    ['proyecto inexistente', { data: { proyectoId: 'PX', nuevoDuenoUid: 'B' }, auth: quien('A') }, 'not-found'],
    ['faltan datos', { data: { proyectoId: 'P1' }, auth: quien('A') }, 'invalid-argument'],
  ];
  for (const [nombre, req, codigo] of rechazos) {
    const { e } = await correr(BASE, req);
    igual(`2 ${nombre}: código`, e && e.code, codigo);
    igual(`2 ${nombre}: nada cambia`, Object.fromEntries(db.store), BASE);
  }

  // 3) A se la pasa a C, que es supervisor
  {
    const { r, e } = await correr(BASE, { data: { proyectoId: 'P1', nuevoDuenoUid: 'C' }, auth: quien('A') });
    igual('3 sin error', e ? String(e.message) : null, null);
    const p = doc('proyectos/P1');
    igual('3 roles', ['A', 'B', 'C'].map(u => rolEnProyecto(p, u)), ['editor', 'editor', 'dueno']);
    igual('3 no crea ningún campo viejo', VIEJOS.filter(k => k in p), []);
    igual('3 catálogo de C', ord(ids(doc('configuraciones/C'))), ord(['b1', 'b2', 'b7', 'b13', 'f_5', 'f_9']));
    igual('3 respuesta', r && [r.agregados, r.sinOrigen], [6, 0]);
    igual('3 empresa de C: de miembros (sin empresa en su config)', p.ownerEmpresa, 'EmpC');
  }

  // 4) Fallan los pasos finales: el traspaso queda hecho y se avisa
  {
    const { r, e } = await correr(BASE, { data: { proyectoId: 'P1', nuevoDuenoUid: 'B' }, auth: quien('A') }, { loteFalla: true });
    igual('4 sin error', e ? String(e.message) : null, null);
    igual('4 incompleto', r && [r.ok, r.completo], [true, false]);
    igual('4 dueño nuevo igual', doc('proyectos/P1').ownerId, 'B');
    igual('4 invitaciones sin tocar', doc('invitaciones/i1').estado, 'abierta');
  }

  // 5) El nuevo dueño no tiene configuración: no se inventa una
  {
    const datos = clonar(BASE); delete datos['configuraciones/B'];
    const { r, e } = await correr(datos, { data: { proyectoId: 'P1', nuevoDuenoUid: 'B' }, auth: quien('A') });
    igual('5 sin error', e ? String(e.message) : null, null);
    igual('5 respuesta', r && [r.agregados, r.sinOrigen], [0, 6]);
    igual('5 sin configuración creada', db.store.has('configuraciones/B'), false);
    igual('5 nombre del dueño, de miembros', [doc('proyectos/P1').ownerNombre, doc('proyectos/P1').ownerEmpresa], ['Beto', 'EmpB']);
  }

  // 6) Mientras tanto, el dueño quitó a B desde otro teléfono: no se sigue
  {
    const quitarB = (d) => {
      const p = d.store.get('proyectos/P1');
      delete p.miembros.B; p.miembrosUids = ['A', 'C'];
    };
    const { e } = await correr(BASE, { data: { proyectoId: 'P1', nuevoDuenoUid: 'B' }, auth: quien('A') }, { antesDeTx: quitarB });
    igual('6 código', e && e.code, 'failed-precondition');
    igual('6 sigue de A', doc('proyectos/P1').ownerId, 'A');
    igual('6 sin aviso', avisos().length, 0);
    igual('6 catálogo de B intacto', doc('configuraciones/B'), BASE['configuraciones/B']);
  }
  return fallas;
};

// ── Corrida ─────────────────────────────────────────────────────────────────
const MUTANTES_CODIGO = {
  'vuelve a escribir el reflejo viejo': ['miembrosUids: FV.arrayUnion(nuevo, yo),', 'miembrosUids: FV.arrayUnion(nuevo, yo), compartidoCon: FV.arrayRemove(nuevo),'],
  'toma el nombre de supervisoresInfo': ['const infoNuevo = antes[nuevo] || {};', 'const infoNuevo = (p.supervisoresInfo || {})[nuevo] || {};'],
  'mueve los controles de todos': ['misControles.forEach(d => lote.update(', 'ctrlSnap.docs.forEach(d => lote.update('],
  'cuenta los controles ajenos': ['controles: misControles.map(d => d.data()),', 'controles: ctrlSnap.docs.map(d => d.data()),'],
  'el anterior pierde su nombre': ["rol: 'editor', nombre: miNombre, empresa: yoCfg.empresaPersonal || '' }", "rol: 'editor' }"],
  'pierde el desde del nuevo': ["{ ...(antes[nuevo] || { desde: ahora }), rol: 'dueno', duenoDesde: ahora }", "{ rol: 'dueno', desde: ahora }"],
  'anula invitaciones de otras obras': [".where('proyectoId', '==', id).where('estado', '==', 'abierta')", ".where('estado', '==', 'abierta')"],
  'no vuelve a mirar dentro de la transacción': ['if (String(p.ownerId) !== yo || !esMiembro(p)) {', 'if (false) {'],
};
const MUTANTES_BASE = {
  // (Sin 'la base ignora los borrados': desde el paso 6 el traspaso no borra ningún campo.)
  'arrayUnion reemplaza en vez de sumar': { unionReemplaza: true },
  'el lote no escribe': { loteMudo: true },
};

(async () => {
  const fuente = fs.readFileSync(INDEX, 'utf8');
  const t0 = Date.now();
  const real = cargar(fuente).traspasarProyecto;
  const fallasReal = await escenarios(real);
  console.log(`real: ${fallasReal.length} falla(s)  (carga en ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  fallasReal.forEach(f => console.log('  ✗ ' + f));
  let todos = true;

  for (const [nombre, opciones] of Object.entries(MUTANTES_BASE)) {
    // Cada escenario reinicia la base: el mutante se mete en ese reinicio.
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
    const fn = cargar(fuente.replace(antes, despues)).traspasarProyecto;
    const n = (await escenarios(fn)).length;
    console.log(`mutante «${nombre}» (TIENE que fallar): ${n} falla(s)`);
    if (n === 0) todos = false;
  }
  const ok = !fallasReal.length && todos;
  console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: MAL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('La prueba se cayó:', e); process.exit(2); });
