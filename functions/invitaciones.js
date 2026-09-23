/* global module */
// (ESLint está configurado para el navegador; esto corre en Node, dentro de las
// Cloud Functions. Se declara solo `module` en vez de apagar el lint del archivo.)
//
// COPIA para el servidor de src/utils/equipoProyecto.js: roles de un proyecto y estado
// de una invitación. Duplicada a propósito, igual que otras de functions/, porque las
// funciones no pueden importar de src/. La prueba compara las dos copias caso por caso:
// si se cambia una, hay que cambiar la otra.

const ROLES = ['dueno', 'editor', 'supervisor'];

const permisoViejo = (rol) => (rol === 'editor' ? 'edicion' : 'lectura');

const rolEnProyecto = (proyecto, uid) => {
  if (!proyecto || uid == null) return null;
  const u = String(uid);
  const propio = proyecto.miembros && proyecto.miembros[u] && proyecto.miembros[u].rol;
  if (ROLES.includes(propio)) return propio;
  if (proyecto.ownerId != null && String(proyecto.ownerId) === u) return 'dueno';
  if ((proyecto.compartidoCon || []).map(String).includes(u)) {
    const p = proyecto.permisos ? proyecto.permisos[u] : undefined;
    return (p === 'edicion' || p === 'ambos') ? 'editor' : 'supervisor';
  }
  return null;
};

const QR_VIGENCIA_MS = 2 * 60 * 60 * 1000;

const estadoInvitacion = (inv, ahoraMs) => {
  if (!inv) return 'inexistente';
  if (inv.estado === 'usada') return 'usada';
  if (inv.estado === 'anulada' || inv.estado === 'cerrada') return 'anulada';
  if (inv.estado !== 'abierta') return 'inexistente';
  if (inv.tipo === 'qr') {
    const creada = Date.parse(inv.creada);
    if (!Number.isFinite(creada) || ahoraMs - creada > QR_VIGENCIA_MS) return 'vencida';
  }
  return 'abierta';
};

module.exports = { ROLES, permisoViejo, rolEnProyecto, QR_VIGENCIA_MS, estadoInvitacion };
