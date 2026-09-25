// Prueba de functions/traspaso.js, con un mutante por regla que TIENE que fallar.
import { createRequire } from 'module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const real = require('./traspaso.js');

const casos = (m) => {
  const fallas = [];
  const igual = (nombre, obtenido, esperado) => {
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
      fallas.push(`${nombre}\n      esperaba ${JSON.stringify(esperado)}\n      salió    ${JSON.stringify(obtenido)}`);
    }
  };
  const ordenado = (s) => [...s].sort();

  // ── idsFerreteriaDeObra ─────────────────────────────────────────────────
  const obra = {
    puntos: [
      { datos: { ferreteriaFinal: { b1: 2, f_9: 1 } } },
      { datos: { armadosSeleccionados: [{ items: [{ idRef: 'b7', cant: 1 }] }], ferreteriaExtra: { f_4: 3 } } },
      { datos: {} }, {},
    ],
    armados: [{ items: [{ idRef: 'b2' }, { idRef: 'f_9' }] }],
    cables: [{ ferrId: 'b13' }, {}],
    controles: [{ recibido: { f_5: { cant: 2 } } }],
  };
  igual('ids: puntos (hoy y viejo), armados, cables y control',
    ordenado(m.idsFerreteriaDeObra(obra)), ['b1', 'b13', 'b2', 'b7', 'f_4', 'f_5', 'f_9']);
  igual('ids: obra vacía', ordenado(m.idsFerreteriaDeObra({})), []);

  // ── itemsQueFaltan ──────────────────────────────────────────────────────
  const usados = new Set(['b1', 'b2', 'f_9', 'f_x']);
  const viejo = [{ id: 'b1', nombre: 'AISLADOR' }, { id: 'b2', nombre: 'CLEVIS' }, { id: 'f_9', nombre: 'CINTA' }, { id: 'f_otro', nombre: 'NO USADO' }];
  const nuevo = [{ id: 'b1', nombre: 'AISLADOR' }];
  const r = m.itemsQueFaltan(usados, viejo, nuevo);
  igual('faltan: solo lo usado que el nuevo no tiene', r.agregar.map(it => it.id).sort(), ['b2', 'f_9']);
  igual('faltan: con el MISMO id y sus datos', r.agregar.find(it => it.id === 'f_9'), { id: 'f_9', nombre: 'CINTA' });
  igual('faltan: lo no usado no se pasa', r.agregar.some(it => it.id === 'f_otro'), false);
  igual('faltan: lo que nadie tiene se cuenta aparte', r.sinOrigen, 1);
  igual('faltan: el nuevo dueño que borró un ítem de la base lo recupera',
    m.itemsQueFaltan(new Set(['b1']), viejo, []).agregar.map(it => it.id), ['b1']);
  return fallas;
};

const mutantes = {
  'olvida el modelo viejo': { ...real, idsFerreteriaDeObra: (o) => real.idsFerreteriaDeObra({ ...o, puntos: (o.puntos || []).map(p => ({ datos: { ferreteriaFinal: p?.datos?.ferreteriaFinal } })) }) },
  'pasa todo el catálogo': { ...real, itemsQueFaltan: (u, v, n) => ({ agregar: (v || []).filter(it => !(n || []).some(x => x.id === it.id)), sinOrigen: 0 }) },
  'pisa lo que el nuevo ya tiene': { ...real, itemsQueFaltan: (u, v) => ({ agregar: (v || []).filter(it => u.has(String(it.id))), sinOrigen: 0 }) },
};

const fallasReal = casos(real);
console.log(`real: ${fallasReal.length} falla(s)`);
fallasReal.forEach(f => console.log('  ✗ ' + f));
let todos = true;
for (const [nombre, impl] of Object.entries(mutantes)) {
  const n = casos(impl).length;
  console.log(`mutante «${nombre}» (TIENE que fallar): ${n} falla(s)`);
  if (n === 0) todos = false;
}
const ok = !fallasReal.length && todos;
console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: MAL');
process.exit(ok ? 0 : 1);
