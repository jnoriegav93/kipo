// Prueba del paso 4 (lógica pura): quién puede cambiar cosas en un proyecto
// (`puedeEditarProyecto`) y el color de los días con el personal encima
// (`obtenerColorDia`, `conColoresPersonales`). Cada mutante TIENE que fallar.
import * as eq from '../src/utils/equipoProyecto.js';
import { filtrosVisibilidad as fv } from '../src/utils/filtrosVisibilidad.js';

const casos = (m) => {
  const fallas = [];
  const igual = (nombre, obtenido, esperado) => {
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
      fallas.push(`${nombre}\n      esperaba ${JSON.stringify(esperado)}\n      salió    ${JSON.stringify(obtenido)}`);
    }
  };

  // ── puedeEditarProyecto ────────────────────────────────────────────────
  const nuevo = {
    ownerId: 'O',
    miembros: { O: { rol: 'dueno' }, E: { rol: 'editor' }, S: { rol: 'supervisor' } },
    compartidoCon: ['E', 'S'], permisos: { E: 'edicion', S: 'lectura' },
  };
  igual('dueño edita', m.puedeEditarProyecto(nuevo, 'O'), true);
  igual('editor edita', m.puedeEditarProyecto(nuevo, 'E'), true);
  igual('supervisor NO edita', m.puedeEditarProyecto(nuevo, 'S'), false);
  igual('ajeno NO edita', m.puedeEditarProyecto(nuevo, 'Z'), false);
  // Manda `miembros` aunque el reflejo viejo diga otra cosa (p. ej. tras un cambio de rol
  // que todavía no llegó a los campos viejos)
  igual('miembros manda sobre el reflejo', m.puedeEditarProyecto({ ...nuevo, permisos: { E: 'edicion', S: 'edicion' } }, 'S'), false);
  const viejo = { ownerId: 'O', compartidoCon: ['E', 'A', 'L', 'X'], permisos: { E: 'edicion', A: 'ambos', L: 'lectura', X: 'solo_lectura' } };
  igual('viejo: edicion ya NO edita (paso 6)', m.puedeEditarProyecto(viejo, 'E'), false);
  igual('viejo: ambos ya NO edita (paso 6)', m.puedeEditarProyecto(viejo, 'A'), false);
  igual('viejo: lectura NO edita', m.puedeEditarProyecto(viejo, 'L'), false);
  igual('viejo: solo_lectura NO edita', m.puedeEditarProyecto(viejo, 'X'), false);
  igual('viejo: dueño por ownerId edita', m.puedeEditarProyecto(viejo, 'O'), true);
  igual('sin proyecto NO edita', m.puedeEditarProyecto(null, 'O'), false);
  igual('sin usuario NO edita', m.puedeEditarProyecto(nuevo, null), false);
  igual('uid numérico se compara como texto', m.puedeEditarProyecto({ ownerId: 7 }, '7'), true);

  // ── colores de día ─────────────────────────────────────────────────────
  const proyectos = [
    { id: 'P1', dias: [{ id: 'd1', color: '#111111' }, { id: 'd2', color: '#222222' }] },
    { id: 'P2', dias: [{ id: 'd3', color: '#333333' }] },
    { id: 'P3' }, // sin días: no tiene que romper
  ];
  igual('color guardado del proyecto', m.obtenerColorDia('d2', proyectos), '#222222');
  igual('color de un proyecto compartido (segundo de la lista)', m.obtenerColorDia('d3', proyectos), '#333333');
  igual('el personal manda', m.obtenerColorDia('d1', proyectos, { d1: '#abcdef' }), '#abcdef');
  igual('personal de otro día no afecta', m.obtenerColorDia('d2', proyectos, { d1: '#abcdef' }), '#222222');
  igual('día desconocido: rojo de respaldo', m.obtenerColorDia('dX', proyectos), '#ef4444');
  igual('personal de un día que no está en la lista', m.obtenerColorDia('dX', proyectos, { dX: '#00ff00' }), '#00ff00');
  igual('lista de días con el personal encima',
    m.conColoresPersonales(proyectos[0].dias, { d2: '#abcdef' }),
    [{ id: 'd1', color: '#111111' }, { id: 'd2', color: '#abcdef' }]);
  igual('sin personales, los días tal cual', m.conColoresPersonales(proyectos[0].dias, undefined), proyectos[0].dias);
  igual('sin personales, igual es una lista NUEVA (quien la recibe la ordena)',
    m.conColoresPersonales(proyectos[0].dias, undefined) === proyectos[0].dias, false);
  igual('no cambia el original', proyectos[0].dias[1].color, '#222222');
  igual('sin días, lista vacía', m.conColoresPersonales(undefined, { d1: '#fff' }), []);
  return fallas;
};

const real = {
  puedeEditarProyecto: eq.puedeEditarProyecto,
  obtenerColorDia: fv.obtenerColorDia,
  conColoresPersonales: fv.conColoresPersonales,
};
const mutantes = {
  'el supervisor también edita': { ...real, puedeEditarProyecto: (p, u) => !!eq.rolEnProyecto(p, u) },
  'solo mira ownerId': { ...real, puedeEditarProyecto: (p, u) => !!p && u != null && String(p.ownerId) === String(u) },
  'ignora el color personal': { ...real, obtenerColorDia: (d, ps) => fv.obtenerColorDia(d, ps) },
  'el personal no gana': { ...real, obtenerColorDia: (d, ps, per) => { for (const p of ps) { const x = (p.dias || []).find(y => y.id === d); if (x) return x.color; } return (per && per[d]) || '#ef4444'; } },
  'pisa el original': { ...real, conColoresPersonales: (dias, per) => { (dias || []).forEach(d => { if (per && per[d.id]) d.color = per[d.id]; }); return dias || []; } },
  'sin personales devuelve la misma lista': { ...real, conColoresPersonales: (dias, per) => (per ? fv.conColoresPersonales(dias, per) : (dias || [])) },
};

const fallasReal = casos(real);
console.log(`real: ${fallasReal.length} falla(s)`);
fallasReal.forEach(f => console.log('  ✗ ' + f));
let todos = true;
for (const [nombre, impl] of Object.entries(mutantes)) {
  // Cada mutante corre sobre datos nuevos: 'pisa el original' ensucia los que toca
  const n = casos(impl).length;
  console.log(`mutante «${nombre}» (TIENE que fallar): ${n} falla(s)`);
  if (n === 0) todos = false;
}
const ok = !fallasReal.length && todos;
console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: MAL');
process.exit(ok ? 0 : 1);
