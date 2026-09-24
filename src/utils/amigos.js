// Amigos (paso 3b del rediseño de equipos; CONTEXTO.md, "Amigos"). Lógica pura, sin
// Firebase, para probarla con Node.
//
// La amistad es MUTUA y con consentimiento: uno manda la solicitud y el otro la acepta.
// Borrarla también es mutuo, y no saca a nadie de ningún proyecto.
// Con `.js`, como los otros utils que se prueban con Node: Node no completa la extensión.
import { miembrosDelProyecto } from './equipoProyecto.js';

// Un documento por pareja, con id fijo: los dos uids ordenados. Así no puede haber dos
// amistades (ni dos solicitudes) entre las mismas personas, las mande quien las mande.
export const idAmistad = (a, b) => [String(a), String(b)].sort().join('_');

// Las amistades del usuario, repartidas: sus amigos (aceptadas), las solicitudes que le
// mandaron (recibidas) y las que mandó él (enviadas). `uid` es el de la otra persona.
export const clasificarAmistades = (docs, uid) => {
  const u = String(uid);
  const amigos = [], recibidas = [], enviadas = [];
  for (const d of docs || []) {
    const uids = (d.uids || []).map(String);
    if (!uids.includes(u)) continue;
    const otro = uids.find(x => x !== u);
    if (!otro) continue;
    const item = { id: d.id, uid: otro, nombre: d.nombres?.[otro] || '' };
    if (d.estado === 'aceptada') amigos.push(item);
    else if (d.estado === 'pendiente') (String(d.para) === u ? recibidas : enviadas).push(item);
  }
  const porNombre = (a, b) => (a.nombre || a.uid).localeCompare(b.nombre || b.uid);
  return { amigos: amigos.sort(porNombre), recibidas: recibidas.sort(porNombre), enviadas: enviadas.sort(porNombre) };
};

// Las personas con las que el usuario coincide en algún proyecto: los miembros de sus
// proyectos, menos él mismo. Cada una con los proyectos en común y su relación de hoy:
// 'amigo', 'recibida' (le mandó solicitud), 'enviada' (se la mandó el usuario) o
// 'libre'. El nombre sale de lo que ya trae el proyecto (dueño y `supervisoresInfo`).
export const coincidencias = (proyectos, uid, { amigos = [], recibidas = [], enviadas = [] } = {}) => {
  const u = String(uid);
  const relacion = new Map([
    ...amigos.map(a => [a.uid, 'amigo']),
    ...recibidas.map(a => [a.uid, 'recibida']),
    ...enviadas.map(a => [a.uid, 'enviada']),
  ]);
  const personas = new Map();
  for (const p of proyectos || []) {
    for (const { uid: otro } of miembrosDelProyecto(p)) {
      if (otro === u) continue;
      const nombre = otro === String(p.ownerId) ? (p.ownerNombre || '') : (p.miembros?.[otro]?.nombre || p.supervisoresInfo?.[otro]?.nombre || '');
      const persona = personas.get(otro) || { uid: otro, nombre: '', proyectos: [] };
      if (!persona.nombre && nombre) persona.nombre = nombre;
      if (p.nombre && !persona.proyectos.includes(p.nombre)) persona.proyectos.push(p.nombre);
      personas.set(otro, persona);
    }
  }
  return [...personas.values()]
    .map(x => ({ ...x, relacion: relacion.get(x.uid) || 'libre' }))
    .sort((a, b) => (a.nombre || a.uid).localeCompare(b.nombre || b.uid));
};
