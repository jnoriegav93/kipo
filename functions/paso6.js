/* global module */
// (ESLint está configurado para el navegador; esto corre en Node, dentro de las
// Cloud Functions. Se declara solo `module` en vez de apagar el lint del archivo.)
//
// Paso 6 del rediseño de equipos (CONTEXTO.md): dejar cada proyecto solo con el modelo
// nuevo (`miembros` + `miembrosUids`) y sacar los campos del sistema viejo. Lógica pura,
// sin Firebase, para probarla con Node. La usa la función `paso6` de index.js.
//
// Dos tiempos, para que nadie pierda el proyecto:
//  1. COMPLETAR (solo agrega): quien esté en `compartidoCon` y no en `miembros` pasa a ser
//     miembro con el rol que hoy tiene ('edicion'/'ambos' → editor; lo demás, supervisor);
//     los nombres de `supervisoresInfo` pasan a `miembros` si ahí faltan; el dueño y
//     `miembrosUids` quedan completos.
//  2. LIMPIAR: los campos viejos se guardan aparte (respaldo) y se borran. Solo en los
//     proyectos que ya no tengan nada por completar.

const CAMPOS_VIEJOS = ['compartidoCon', 'permisos', 'supervisoresInfo', 'enListaDe', 'grupoId', 'solicitudesPendientes', 'codigoAcceso'];

const planPaso6 = (proyecto, ahora) => {
  const p = proyecto || {};
  const miembros = p.miembros || {};
  const uidsMiembros = (p.miembrosUids || []).map(String);
  const permisos = p.permisos || {};
  const info = p.supervisoresInfo || {};
  const dueno = p.ownerId != null ? String(p.ownerId) : null;

  // El dueño, como miembro
  const agregarDueno = !!dueno && !miembros[dueno];

  // Quien solo está en el reflejo viejo, con el rol que hoy tiene
  const agregar = {};
  for (const u of (p.compartidoCon || []).map(String)) {
    if (u === dueno || miembros[u] || agregar[u]) continue;
    const perm = permisos[u];
    agregar[u] = {
      rol: (perm === 'edicion' || perm === 'ambos') ? 'editor' : 'supervisor',
      desde: ahora,
      deCamposViejos: true,
      nombre: (info[u] && info[u].nombre) || '',
      empresa: (info[u] && info[u].empresa) || '',
    };
  }

  // Nombres que todavía viven solo en supervisoresInfo
  const nombres = {};
  for (const [u, m] of Object.entries(miembros)) {
    if (u === dueno || !m || m.nombre) continue;
    if (info[u] && info[u].nombre) nombres[u] = { nombre: info[u].nombre, empresa: info[u].empresa || '' };
  }

  // miembrosUids tiene que tener a todos los de miembros (y a los que se agregan)
  const todos = new Set([...Object.keys(miembros), ...Object.keys(agregar), ...(agregarDueno ? [dueno] : [])]);
  const faltanEnUids = [...todos].filter(u => !uidsMiembros.includes(u));

  const viejos = CAMPOS_VIEJOS.filter(k => Object.prototype.hasOwnProperty.call(p, k));
  const porCompletar = agregarDueno || Object.keys(agregar).length > 0 || Object.keys(nombres).length > 0 || faltanEnUids.length > 0;
  return {
    agregarDueno,
    agregar,
    nombres,
    faltanEnUids,
    viejos,
    porCompletar,
    listoParaLimpiar: !porCompletar,
  };
};

// Lo que COMPLETAR escribe en el proyecto: campos punteados para no pisar lo que haya.
// Devuelve null si no hay nada que escribir. `union` arma el arrayUnion (lo pone index.js).
const cambiosDeCompletar = (proyecto, plan, ahora, union) => {
  if (!plan.porCompletar) return null;
  const cambios = {};
  const dueno = String(proyecto.ownerId);
  if (plan.agregarDueno) cambios[`miembros.${dueno}`] = { rol: 'dueno', desde: ahora, deCamposViejos: true };
  for (const [u, m] of Object.entries(plan.agregar)) cambios[`miembros.${u}`] = m;
  for (const [u, n] of Object.entries(plan.nombres)) {
    cambios[`miembros.${u}.nombre`] = n.nombre;
    cambios[`miembros.${u}.empresa`] = n.empresa;
  }
  const uids = [...new Set([...plan.faltanEnUids, ...Object.keys(plan.agregar), ...(plan.agregarDueno ? [dueno] : [])])];
  if (uids.length) cambios.miembrosUids = union(uids);
  return cambios;
};

module.exports = { CAMPOS_VIEJOS, planPaso6, cambiosDeCompletar };
