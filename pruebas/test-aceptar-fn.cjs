// Prueba de la función `aceptarInvitacion` (functions/index.js) SIN tocar producción:
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

// ── Datos de partida (aceptarInvitacion) ───────────────────────────────────
const ahoraIso = () => new Date().toISOString();
const hace = (ms) => new Date(Date.now() - ms).toISOString();
const LINK = 'INVLINK000000000001', QR = 'INVQR00000000000001', USADA = 'INVUSADA00000000001', VIEJO = 'INVQRVIEJO000000001';
const base = () => ({
  'proyectos/P1': { nombre: 'Obra', ownerId: 'O', ownerNombre: 'Olga', miembros: { O: { rol: 'dueno', desde: 't0' } }, miembrosUids: ['O'] },
  'configuraciones/X': { nombrePersonal: 'Xavi', empresaPersonal: 'EmpX', email: 'x@x.com' },
  [`invitaciones/${LINK}`]: { proyectoId: 'P1', rol: 'editor', tipo: 'link', estado: 'abierta', deUid: 'O', creada: ahoraIso() },
  [`invitaciones/${QR}`]: { proyectoId: 'P1', rol: 'supervisor', tipo: 'qr', estado: 'abierta', deUid: 'O', creada: ahoraIso(), usos: 0 },
  [`invitaciones/${USADA}`]: { proyectoId: 'P1', rol: 'editor', tipo: 'link', estado: 'usada', deUid: 'O', creada: ahoraIso() },
  [`invitaciones/${VIEJO}`]: { proyectoId: 'P1', rol: 'editor', tipo: 'qr', estado: 'abierta', deUid: 'O', creada: hace(3 * 60 * 60 * 1000) },
});
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
  const correr = async (datos, request) => {
    db.reiniciar(datos, {});
    try { return { r: await fn.run(request) }; } catch (e) { return { e }; }
  };

  // 1) X acepta un link de editor
  {
    const { r, e } = await correr(base(), { data: { codigo: LINK }, auth: quien('X') });
    igual('1 sin error', e ? String(e.message) : null, null);
    igual('1 respuesta', r && { ...r }, { proyectoId: 'P1', proyectoNombre: 'Obra', rol: 'editor', yaEra: false });
    const p = doc('proyectos/P1');
    const mx = p.miembros.X || {};
    igual('1 miembro con rol, quién lo invitó, el código y su nombre',
      [mx.rol, mx.por, mx.invitacion, mx.nombre, mx.empresa, typeof mx.desde], ['editor', 'O', LINK, 'Xavi', 'EmpX', 'string']);
    igual('1 en miembrosUids', [...p.miembrosUids].sort(), ['O', 'X']);
    igual('1 el reflejo viejo NO se escribe',
      ['compartidoCon', 'permisos', 'supervisoresInfo'].filter(k => k in p), []);
    igual('1 el link queda usado', [doc(`invitaciones/${LINK}`).estado, doc(`invitaciones/${LINK}`).usadaPor], ['usada', 'X']);
  }
  // 2) Y (sin configuración) acepta el QR de supervisor: el QR sigue abierto
  {
    const { r, e } = await correr(base(), { data: { codigo: QR }, auth: quien('Y') });
    igual('2 sin error', e ? String(e.message) : null, null);
    igual('2 rol', r && r.rol, 'supervisor');
    const p = doc('proyectos/P1');
    igual('2 nombre sacado del correo', [p.miembros.Y && p.miembros.Y.rol, p.miembros.Y && p.miembros.Y.nombre], ['supervisor', 'y']);
    igual('2 el QR sigue abierto y suma un uso', [doc(`invitaciones/${QR}`).estado, doc(`invitaciones/${QR}`).usos], ['abierta', 1]);
  }
  // 3) Quien ya era miembro no cambia de rol ni gasta el link
  {
    const datos = base();
    datos['proyectos/P1'].miembros.X = { rol: 'supervisor', desde: 't1' };
    datos['proyectos/P1'].miembrosUids.push('X');
    const { r, e } = await correr(datos, { data: { codigo: LINK }, auth: quien('X') });
    igual('3 sin error', e ? String(e.message) : null, null);
    igual('3 ya era, con su rol de antes', r && [r.yaEra, r.rol], [true, 'supervisor']);
    igual('3 el proyecto no cambia', doc('proyectos/P1'), datos['proyectos/P1']);
    igual('3 el link no se gasta', doc(`invitaciones/${LINK}`).estado, 'abierta');
  }
  // 4) Rechazos: nada cambia
  const rechazos = [
    ['sin sesión', { data: { codigo: LINK } }, 'unauthenticated', null],
    ['código mal formado', { data: { codigo: 'x/y' }, auth: quien('X') }, 'invalid-argument', 'inexistente'],
    ['link ya usado', { data: { codigo: USADA }, auth: quien('X') }, 'failed-precondition', 'usada'],
    ['QR vencido', { data: { codigo: VIEJO }, auth: quien('X') }, 'failed-precondition', 'vencida'],
    ['no existe', { data: { codigo: 'NOEXISTE00000000001' }, auth: quien('X') }, 'failed-precondition', 'inexistente'],
  ];
  for (const [nombre, req, codigo, mensaje] of rechazos) {
    const datos = base();
    const { e } = await correr(datos, req);
    igual(`4 ${nombre}: código`, e && e.code, codigo);
    if (mensaje) igual(`4 ${nombre}: motivo`, e && e.message, mensaje);
    igual(`4 ${nombre}: el proyecto no cambia`, doc('proyectos/P1'), datos['proyectos/P1']);
  }
  return fallas;
};

const MUTANTES_CODIGO = {
  'vuelve a escribir el reflejo viejo': ["invitacion: codigo, nombre, empresa: c.empresaPersonal || '' },", "invitacion: codigo, nombre, empresa: c.empresaPersonal || '' }, compartidoCon: FV.arrayUnion(uid),"],
  'no anota el nombre': ["invitacion: codigo, nombre, empresa: c.empresaPersonal || '' }", 'invitacion: codigo }'],
  'gasta el QR': ["if (inv.tipo === 'qr') tx.update(invRef, { usos: FV.increment(1), ultimoUso: ahora });", 'if (false) tx.update(invRef, {});'],
  'vuelve a sumar a quien ya era': ['if (rolActual) return { ...base, rol: rolActual, yaEra: true };', 'if (false) return null;'],
};

(async () => {
  const fuente = fs.readFileSync(INDEX, 'utf8');
  const real = cargar(fuente).aceptarInvitacion;
  const fallasReal = await escenarios(real);
  console.log(`real: ${fallasReal.length} falla(s)`);
  fallasReal.forEach(f => console.log('  ✗ ' + f));
  let todos = true;
  for (const [nombre, [antes, despues]] of Object.entries(MUTANTES_CODIGO)) {
    const veces = fuente.split(antes).length - 1;
    if (veces !== 1) { console.log(`mutante «${nombre}»: MAL ARMADO (el texto aparece ${veces} veces)`); todos = false; continue; }
    const n = (await escenarios(cargar(fuente.replace(antes, despues)).aceptarInvitacion)).length;
    console.log(`mutante «${nombre}» (TIENE que fallar): ${n} falla(s)`);
    if (n === 0) todos = false;
  }
  const ok = !fallasReal.length && todos;
  console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: MAL');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('La prueba se cayó:', e); process.exit(2); });
