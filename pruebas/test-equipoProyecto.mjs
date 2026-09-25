// Prueba de src/utils/equipoProyecto.js y de su copia del servidor,
// functions/invitaciones.js. Tres cosas:
//  1. la copia de la app pasa todos los casos;
//  2. la copia del servidor da EXACTAMENTE lo mismo en las funciones que comparten;
//  3. cada mutante (una regla rota a propósito) hace fallar al menos un caso.
import { createRequire } from 'module';
import * as app from '../src/utils/equipoProyecto.js';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const servidor = require('./invitaciones.js');

const HORA = 60 * 60 * 1000;
const AHORA = Date.parse('2026-09-23T12:00:00.000Z');
const hace = (ms) => new Date(AHORA - ms).toISOString();

const casos = (m) => {
  const fallas = [];
  const igual = (nombre, obtenido, esperado) => {
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
      fallas.push(`${nombre}\n      esperaba ${JSON.stringify(esperado)}\n      salió    ${JSON.stringify(obtenido)}`);
    }
  };

  // ── rolEnProyecto ───────────────────────────────────────────────────────
  // Paso 6: el sistema viejo (compartidoCon + permisos) ya NO da rol.
  const viejo = { ownerId: 'O', compartidoCon: ['E', 'A', 'S', 'X'], permisos: { E: 'edicion', A: 'ambos', S: 'lectura' } };
  igual('dueño por ownerId', m.rolEnProyecto(viejo, 'O'), 'dueno');
  igual('solo en el viejo con edicion: ya no es miembro', m.rolEnProyecto(viejo, 'E'), null);
  igual('solo en el viejo con ambos: ya no es miembro', m.rolEnProyecto(viejo, 'A'), null);
  igual('solo en el viejo con lectura: ya no es miembro', m.rolEnProyecto(viejo, 'S'), null);
  igual('ajeno: sin rol', m.rolEnProyecto(viejo, 'Z'), null);
  igual('editor en miembros', m.rolEnProyecto({ ownerId: 'O', miembros: { E: { rol: 'editor' } } }, 'E'), 'editor');
  igual('miembros manda aunque el viejo diga otra cosa',
    m.rolEnProyecto({ ...viejo, miembros: { E: { rol: 'supervisor' } } }, 'E'), 'supervisor');
  igual('un rol raro en miembros no vale (y el viejo no cuenta)',
    m.rolEnProyecto({ ...viejo, miembros: { E: { rol: 'jefe' } } }, 'E'), null);
  igual('uid numérico se compara como texto', m.rolEnProyecto({ ownerId: 7 }, '7'), 'dueno');
  igual('sin proyecto', m.rolEnProyecto(null, 'O'), null);

  // ── permisoViejo ────────────────────────────────────────────────────────
  igual('editor refleja edicion', m.permisoViejo('editor'), 'edicion');
  igual('supervisor refleja lectura (no puede escribir el proyecto)', m.permisoViejo('supervisor'), 'lectura');

  // ── estadoInvitacion ────────────────────────────────────────────────────
  igual('link abierto', m.estadoInvitacion({ estado: 'abierta', tipo: 'link', creada: hace(999 * HORA) }, AHORA), 'abierta');
  igual('link usado no vuelve a servir', m.estadoInvitacion({ estado: 'usada', tipo: 'link' }, AHORA), 'usada');
  igual('anulada', m.estadoInvitacion({ estado: 'anulada', tipo: 'link' }, AHORA), 'anulada');
  igual('QR cerrado cuenta como anulado', m.estadoInvitacion({ estado: 'cerrada', tipo: 'qr', creada: hace(1) }, AHORA), 'anulada');
  igual('QR recién abierto', m.estadoInvitacion({ estado: 'abierta', tipo: 'qr', creada: hace(HORA) }, AHORA), 'abierta');
  igual('QR vence a las 2 h', m.estadoInvitacion({ estado: 'abierta', tipo: 'qr', creada: hace(3 * HORA) }, AHORA), 'vencida');
  igual('QR sin fecha: vencido', m.estadoInvitacion({ estado: 'abierta', tipo: 'qr' }, AHORA), 'vencida');
  igual('inexistente', m.estadoInvitacion(null, AHORA), 'inexistente');
  igual('estado desconocido: no sirve', m.estadoInvitacion({ estado: 'rara' }, AHORA), 'inexistente');
  return fallas;
};

// Solo en la app: miembros, link y lectura del código
const casosApp = (m) => {
  const fallas = [];
  const igual = (nombre, obtenido, esperado) => {
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
      fallas.push(`${nombre}\n      esperaba ${JSON.stringify(esperado)}\n      salió    ${JSON.stringify(obtenido)}`);
    }
  };
  const p = {
    ownerId: 'O', compartidoCon: ['S', 'E'], permisos: { E: 'edicion', S: 'lectura' },
    miembros: { N: { rol: 'editor' }, V: { rol: 'supervisor' }, B: { rol: 'editor' } },
  };
  igual('miembros: dueño, editores y supervisores, en ese orden; el viejo no cuenta',
    m.miembrosDelProyecto(p).map(x => `${x.uid}:${x.rol}`), ['O:dueno', 'B:editor', 'N:editor', 'V:supervisor']);
  igual('miembros: sin duplicados',
    m.miembrosDelProyecto({ ownerId: 'O', miembros: { O: { rol: 'dueno' } }, compartidoCon: ['O'] }).length, 1);
  igual('link lleva solo el código', m.linkInvitacion('ABC123', 'https://x.app'), 'https://x.app/?inv=ABC123');
  igual('código desde el link', m.codigoDesdeTexto('https://kipo-d29af.web.app/?inv=AbCdEfGhIjKlMnOpQrSt'), 'AbCdEfGhIjKlMnOpQrSt');
  igual('código pelado', m.codigoDesdeTexto('  AbCdEfGhIjKlMnOpQrSt '), 'AbCdEfGhIjKlMnOpQrSt');
  igual('basura no es código', m.codigoDesdeTexto('hola mundo'), null);
  igual('link de EQUIPO no es invitación a proyecto', m.codigoDesdeTexto('https://kipo-d29af.web.app/?equipo=AbCdEfGhIjKlMnOpQrSt'), null);
  return fallas;
};

// La versión de antes del paso 6, que todavía leía el sistema viejo: TIENE que fallar.
const rolConViejo = (proyecto, uid) => {
  const r = app.rolEnProyecto(proyecto, uid);
  if (r || !proyecto) return r;
  const u = String(uid);
  if ((proyecto.compartidoCon || []).map(String).includes(u)) {
    const q = proyecto.permisos?.[u];
    return (q === 'edicion' || q === 'ambos') ? 'editor' : 'supervisor';
  }
  return null;
};
const mutantes = {
  'todavía lee el sistema viejo': { ...app, rolEnProyecto: rolConViejo },
  'ignora miembros': { ...app, rolEnProyecto: (p, u) => app.rolEnProyecto(p ? { ...p, miembros: {} } : p, u) },
  'el QR no vence': { ...app, estadoInvitacion: (inv, a) => { const e = app.estadoInvitacion(inv, a); return e === 'vencida' ? 'abierta' : e; } },
  'el link se reutiliza': { ...app, estadoInvitacion: (inv, a) => { const e = app.estadoInvitacion(inv, a); return e === 'usada' ? 'abierta' : e; } },
  'supervisor refleja edicion': { ...app, permisoViejo: () => 'edicion' },
};

const fallasApp = [...casos(app), ...casosApp(app)];
const fallasServidor = casos(servidor);

// Las dos copias, caso por caso, sobre una grilla de entradas
const proyectos = [
  null, { ownerId: 'O' }, { ownerId: 7 },
  { ownerId: 'O', compartidoCon: ['E', 'S'], permisos: { E: 'ambos' } },
  { ownerId: 'O', miembros: { E: { rol: 'supervisor' }, Q: { rol: 'x' } }, compartidoCon: ['E'], permisos: { E: 'edicion' } },
];
const invitaciones = [
  null, { estado: 'abierta', tipo: 'link' }, { estado: 'usada' }, { estado: 'cerrada', tipo: 'qr' },
  { estado: 'abierta', tipo: 'qr', creada: hace(HORA) }, { estado: 'abierta', tipo: 'qr', creada: hace(5 * HORA) },
];
const difieren = [];
for (const p of proyectos) for (const u of ['O', '7', 'E', 'S', 'Q', 'Z']) {
  if (app.rolEnProyecto(p, u) !== servidor.rolEnProyecto(p, u)) difieren.push(`rolEnProyecto(${JSON.stringify(p)}, ${u})`);
}
for (const inv of invitaciones) {
  if (app.estadoInvitacion(inv, AHORA) !== servidor.estadoInvitacion(inv, AHORA)) difieren.push(`estadoInvitacion(${JSON.stringify(inv)})`);
}
for (const r of ['editor', 'supervisor']) if (app.permisoViejo(r) !== servidor.permisoViejo(r)) difieren.push(`permisoViejo(${r})`);
if (app.QR_VIGENCIA_MS !== servidor.QR_VIGENCIA_MS) difieren.push('QR_VIGENCIA_MS');

console.log(`app: ${fallasApp.length} falla(s)`); fallasApp.forEach(f => console.log('  ✗ ' + f));
console.log(`servidor: ${fallasServidor.length} falla(s)`); fallasServidor.forEach(f => console.log('  ✗ ' + f));
console.log(`copias que difieren: ${difieren.length}`); difieren.forEach(d => console.log('  ✗ ' + d));
let todos = true;
for (const [nombre, impl] of Object.entries(mutantes)) {
  const n = casos(impl).length;
  console.log(`mutante «${nombre}» (TIENE que fallar): ${n} falla(s)`);
  if (n === 0) todos = false;
}
const ok = !fallasApp.length && !fallasServidor.length && !difieren.length && todos;
console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: MAL');
process.exit(ok ? 0 : 1);
