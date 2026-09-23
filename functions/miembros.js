/* global module */
// (ESLint está configurado para el navegador; esto corre en Node, dentro de las
// Cloud Functions. Se declara solo `module` en vez de apagar el lint del archivo,
// como hace index.js.)
//
// Migración al modelo de equipos por proyecto (CONTEXTO.md, "Rediseño de equipos").
// Lógica pura, sin Firebase, para poder probarla con Node. La usa `migrarMiembros`,
// en index.js.
//
// A cada proyecto le corresponden, como miembros:
//  - su dueño (`ownerId`), siempre, como 'dueno';
//  - como 'editor', quienes hoy lo tienen en su lista por el sistema viejo: están en
//    `compartidoCon` con permiso 'edicion' o 'ambos';
//  - los supervisores NO: se los vuelve a invitar (decidido con el usuario el 23/09).
// Lo que ya esté en `miembros` se respeta y no se pisa: la migración se puede correr
// más de una vez, y más adelante habrá miembros que entraron por invitación.

const PERMISOS_DE_EDITOR = ['edicion', 'ambos'];

const calcularMiembros = (proyecto, ahora) => {
  const p = proyecto || {};
  const existentes = (p.miembros && typeof p.miembros === 'object') ? p.miembros : {};
  const agregar = {};
  const omitidos = [];
  const avisos = [];

  const dueno = (p.ownerId != null && p.ownerId !== '') ? String(p.ownerId) : null;
  if (!dueno) avisos.push('sin dueño (ownerId)');
  else if (!existentes[dueno]) agregar[dueno] = { rol: 'dueno', desde: ahora, migrado: true };

  for (const uid of p.compartidoCon || []) {
    const u = String(uid);
    if (u === dueno || existentes[u] || agregar[u]) continue;
    const permiso = p.permisos ? p.permisos[u] : undefined;
    if (PERMISOS_DE_EDITOR.includes(permiso)) agregar[u] = { rol: 'editor', desde: ahora, migrado: true };
    else omitidos.push({ uid: u, permiso: permiso || null });
  }

  return { agregar, omitidos, avisos };
};

module.exports = { calcularMiembros, PERMISOS_DE_EDITOR };
