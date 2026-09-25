// Prueba de src/utils/amigos.js, con un mutante por regla que TIENE que fallar.
import * as real from '../src/utils/amigos.js';

const casos = (m) => {
  const fallas = [];
  const igual = (nombre, obtenido, esperado) => {
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) {
      fallas.push(`${nombre}\n      esperaba ${JSON.stringify(esperado)}\n      salió    ${JSON.stringify(obtenido)}`);
    }
  };

  // ── idAmistad: el mismo id venga de quien venga ─────────────────────────
  igual('id: mismo en los dos sentidos', m.idAmistad('zeta', 'alfa'), m.idAmistad('alfa', 'zeta'));
  igual('id: los uids ordenados', m.idAmistad('zeta', 'alfa'), 'alfa_zeta');

  // ── clasificarAmistades ─────────────────────────────────────────────────
  const docs = [
    { id: 'a_yo', uids: ['a', 'yo'], estado: 'aceptada', de: 'a', para: 'yo', nombres: { a: 'Ana' } },
    { id: 'b_yo', uids: ['b', 'yo'], estado: 'pendiente', de: 'b', para: 'yo', nombres: { b: 'Beto' } },
    { id: 'c_yo', uids: ['c', 'yo'], estado: 'pendiente', de: 'yo', para: 'c', nombres: { c: 'Carla' } },
    { id: 'x_z', uids: ['x', 'z'], estado: 'aceptada', de: 'x', para: 'z' },
  ];
  const cl = m.clasificarAmistades(docs, 'yo');
  igual('amigos: las aceptadas', cl.amigos.map(x => x.nombre), ['Ana']);
  igual('recibidas: las que me mandaron', cl.recibidas.map(x => x.nombre), ['Beto']);
  igual('enviadas: las que mandé yo', cl.enviadas.map(x => x.nombre), ['Carla']);
  igual('ajenas: no entran', [...cl.amigos, ...cl.recibidas, ...cl.enviadas].some(x => x.uid === 'x' || x.uid === 'z'), false);
  igual('el uid es el de la OTRA persona', cl.amigos[0].uid, 'a');

  // ── coincidencias ───────────────────────────────────────────────────────
  // Paso 6: los miembros viven solo en `miembros`, con su nombre; lo viejo que haya quedado
  // en un proyecto (compartidoCon, supervisoresInfo) ya no cuenta.
  const proyectos = [
    { nombre: 'Ayacucho', ownerId: 'eli', ownerNombre: 'Elizabeth',
      miembros: { yo: { rol: 'editor' }, a: { rol: 'editor', nombre: 'Ana' }, b: { rol: 'editor', nombre: 'Beto' } },
      compartidoCon: ['viejo'], permisos: { viejo: 'edicion' }, supervisoresInfo: { viejo: { nombre: 'Viejo' } } },
    { nombre: 'LMC014', ownerId: 'eli', ownerNombre: 'Elizabeth', miembros: { yo: { rol: 'editor' }, n: { rol: 'supervisor', nombre: 'Nora' } } },
  ];
  const personas = m.coincidencias(proyectos, 'yo', cl);
  igual('coincidencias: sin mí', personas.some(p => p.uid === 'yo'), false);
  igual('coincidencias: todos los demás, por nombre', personas.map(p => p.nombre), ['Ana', 'Beto', 'Elizabeth', 'Nora']);
  igual('coincidencias: proyectos en común juntos', personas.find(p => p.uid === 'eli').proyectos, ['Ayacucho', 'LMC014']);
  igual('coincidencias: la relación de cada uno', Object.fromEntries(personas.map(p => [p.uid, p.relacion])),
    { a: 'amigo', b: 'recibida', eli: 'libre', n: 'libre' });

  // El nombre sale solo de `miembros`: `supervisoresInfo` ya no es respaldo (paso 6)
  const conNombreNuevo = m.coincidencias([
    { nombre: 'Obra Z', ownerId: 'eli', ownerNombre: 'Elizabeth',
      miembros: { yo: { rol: 'editor' }, z: { rol: 'editor', nombre: 'Zoe' }, v: { rol: 'supervisor' } },
      supervisoresInfo: { z: { nombre: 'Zoe vieja' }, v: { nombre: 'Vico' } } },
  ], 'yo', cl);
  igual('coincidencias: el nombre sale de miembros; supervisoresInfo ya no cuenta',
    Object.fromEntries(conNombreNuevo.map(p => [p.uid, p.nombre])), { eli: 'Elizabeth', v: '', z: 'Zoe' });
  return fallas;
};

const mutantes = {
  'id sin ordenar': { ...real, idAmistad: (a, b) => `${a}_${b}` },
  'recibidas y enviadas al revés': { ...real, clasificarAmistades: (d, u) => {
    const r = real.clasificarAmistades(d, u); return { ...r, recibidas: r.enviadas, enviadas: r.recibidas };
  } },
  'me incluye a mí': { ...real, coincidencias: (p, u, c) => [...real.coincidencias(p, u, c), { uid: u, nombre: 'Yo', proyectos: [], relacion: 'libre' }] },
  'relaciones ignoradas': { ...real, coincidencias: (p, u) => real.coincidencias(p, u, {}) },
  'solo el nombre viejo': { ...real, coincidencias: (p, u, c) => real.coincidencias(p.map(x => ({
    ...x, miembros: x.miembros && Object.fromEntries(Object.entries(x.miembros).map(([k, v]) => [k, { rol: v.rol }])),
  })), u, c) },
  // Como antes del paso 6: el nombre caía a supervisoresInfo, y compartidoCon sumaba gente
  'todavía lee supervisoresInfo': { ...real, coincidencias: (p, u, c) => real.coincidencias(p.map(x => ({
    ...x, miembros: x.miembros && Object.fromEntries(Object.entries(x.miembros).map(([k, v]) => [k, { ...v, nombre: v.nombre || x.supervisoresInfo?.[k]?.nombre }])),
  })), u, c) },
  'todavía cuenta compartidoCon': { ...real, coincidencias: (p, u, c) => real.coincidencias(p.map(x => ({
    ...x, miembros: { ...(x.miembros || {}), ...Object.fromEntries((x.compartidoCon || []).map(k => [k, { rol: 'editor', nombre: x.supervisoresInfo?.[k]?.nombre }])) },
  })), u, c) },
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
