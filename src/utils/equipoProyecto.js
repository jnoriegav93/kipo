// Equipo de un proyecto (CONTEXTO.md, "Rediseño de equipos"): quién es miembro, con qué
// rol, y en qué estado está una invitación. Lógica pura, sin Firebase, para probarla con
// Node. functions/invitaciones.js tiene una copia para el servidor: las dos se prueban
// juntas y tienen que dar lo mismo.

export const ROLES = ['dueno', 'editor', 'supervisor'];
export const ROL_TEXTO = { dueno: 'Dueño', editor: 'Editor', supervisor: 'Supervisor' };

// El permiso del sistema viejo que le corresponde a cada rol. Mientras convivan los dos
// sistemas, cada miembro se anota también en `compartidoCon` + `permisos`: así lo siguen
// viendo las reglas de hoy, la exportación y los teléfonos sin actualizar. Y 'lectura'
// no puede escribir el proyecto, que es justo lo que se quiere del supervisor.
export const permisoViejo = (rol) => (rol === 'editor' ? 'edicion' : 'lectura');

// El rol de `uid` en el proyecto. Primero `miembros`; si no figura ahí (un proyecto sin
// migrar, o alguien que solo está en el sistema viejo), se deduce de los campos viejos.
export const rolEnProyecto = (proyecto, uid) => {
  if (!proyecto || uid == null) return null;
  const u = String(uid);
  const propio = proyecto.miembros?.[u]?.rol;
  if (ROLES.includes(propio)) return propio;
  if (proyecto.ownerId != null && String(proyecto.ownerId) === u) return 'dueno';
  if ((proyecto.compartidoCon || []).map(String).includes(u)) {
    const p = proyecto.permisos?.[u];
    return (p === 'edicion' || p === 'ambos') ? 'editor' : 'supervisor';
  }
  return null;
};

const ORDEN_ROL = { dueno: 0, editor: 1, supervisor: 2 };

// Todos los miembros: los de `miembros` y los que solo figuran en el sistema viejo.
// Primero el dueño, después los editores y al final los supervisores.
export const miembrosDelProyecto = (proyecto) => {
  if (!proyecto) return [];
  const uids = new Set([
    ...Object.keys(proyecto.miembros || {}),
    ...(proyecto.ownerId != null ? [String(proyecto.ownerId)] : []),
    ...(proyecto.compartidoCon || []).map(String),
  ]);
  return [...uids]
    .map(uid => ({ uid, rol: rolEnProyecto(proyecto, uid) }))
    .filter(m => m.rol)
    .sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || a.uid.localeCompare(b.uid));
};

// El link sirve UNA vez. El QR sirve mientras el dueño lo tenga abierto en pantalla; y
// como red de seguridad vence a las QR_VIGENCIA_MS de creado, por si el teléfono del
// dueño se apaga con el QR a la vista y nadie lo cierra.
export const QR_VIGENCIA_MS = 2 * 60 * 60 * 1000;

// Estado de una invitación. Solo 'abierta' se puede aceptar.
export const estadoInvitacion = (inv, ahoraMs) => {
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

// El link de una invitación, y el código de vuelta desde lo que se escaneó o se pegó.
// El link lleva SOLO el código: el rol y el proyecto viven en la invitación guardada,
// así nadie puede cambiarlos a mano (CONTEXTO.md, "Invitar").
export const linkInvitacion = (codigo, origen) => `${origen}/?inv=${encodeURIComponent(codigo)}`;

export const codigoDesdeTexto = (texto) => {
  const t = String(texto || '').trim();
  try {
    const c = new URL(t).searchParams.get('inv');
    if (c) return c;
  } catch { /* no es una URL */ }
  return /^[A-Za-z0-9]{15,40}$/.test(t) ? t : null;
};
