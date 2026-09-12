// FASE 4 — Verificación de fotos por proyecto (orquestador del cliente).
// El SERVIDOR verifica nube/caída/respaldo (verificarFotosProyecto, por lotes → progreso
// real); el CLIENTE cruza "equipo" (blobs en IndexedDB de ESTE dispositivo). El resultado
// se guarda PERMANENTE en verificacionesFotos/{proyectoId} para que cualquier dispositivo
// lo vea (con el nombre del dueño del equipo analizado).
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getAllUploadsPending, getUploadPending } from './photoDB';
import { uploadImage } from './storage';

export const cargarVerificacion = async (proyectoId) => {
  try {
    const s = await getDoc(doc(db, 'verificacionesFotos', String(proyectoId)));
    return s.exists() ? s.data() : null;
  } catch { return null; }
};

// ¿La foto está "bien en la nube"? (tiene url y su archivo existe)
const enNube = (it) => !!(it.n && it.u && !it.c);

export const ejecutarVerificacion = async ({ proyectoId, puntoIds, uid, nombreUsuario, onProgreso }) => {
  const { verificarFotosProyecto } = await import('../services/exportacionService');
  // Blobs presentes en ESTE equipo (pendientes + respaldo local 30 días)
  const locales = await getAllUploadsPending();
  const equipoSet = new Set(locales.filter(e => e.blob && e.path).map(e => e.path));

  const CHUNK = 15;
  const puntos = {};
  const items = [];
  onProgreso?.(0, puntoIds.length);
  for (let i = 0; i < puntoIds.length; i += CHUNK) {
    const lote = puntoIds.slice(i, i + CHUNK);
    const r = await verificarFotosProyecto(proyectoId, lote);
    for (const p of (r.puntos || [])) {
      let nube = 0, eq = 0, eqNoNube = 0, resp = 0, respNoNube = 0, caidas = 0, total = 0;
      const secEq = {};
      for (const it of (p.items || [])) {
        total++;
        const ok = enNube(it);
        const enEquipo = it.p && equipoSet.has(it.p);
        if (ok) nube++;
        if (enEquipo) { eq++; if (!ok) eqNoNube++; }
        if (it.r) { resp++; if (!ok) respNoNube++; }
        if (it.c) caidas++;
        const se = secEq[it.s] || (secEq[it.s] = { eq: 0, eqNoNube: 0, respNoNube: 0 });
        if (enEquipo) { se.eq++; if (!ok) se.eqNoNube++; }
        if (it.r && !ok) se.respNoNube++;
        items.push({ ...it, puntoId: p.id });
      }
      const secciones = {};
      for (const [sid, st] of Object.entries(p.secciones || {})) {
        secciones[sid] = { ...st, eq: secEq[sid]?.eq || 0, eqNoNube: secEq[sid]?.eqNoNube || 0, respNoNube: secEq[sid]?.respNoNube || 0 };
      }
      puntos[p.id] = { numero: p.numero || '', total, nube, eq, eqNoNube, resp, respNoNube, caidas, secciones };
    }
    onProgreso?.(Math.min(i + CHUNK, puntoIds.length), puntoIds.length);
  }

  const resultado = {
    proyectoId: String(proyectoId), uid: uid || null,
    equipoDe: nombreUsuario || '', fecha: Date.now(),
    puntos, items,
  };
  try { await setDoc(doc(db, 'verificacionesFotos', String(proyectoId)), resultado); } catch (e) { console.error('No se pudo guardar verificación:', e); }
  try { window.dispatchEvent(new CustomEvent('kipo-verificacion-actualizada', { detail: { proyectoId: String(proyectoId) } })); } catch {}
  return resultado;
};

// REPARAR (2 fases):
//   FASE 1 (cliente, requiere app abierta): sube las fotos que SOLO están en este
//     equipo (el servidor no puede acceder a los blobs locales).
//   FASE 2 (servidor, sobrevive a cerrar la app): backfill de respaldo + restaurar
//     caídas desde respaldo + re-vincular URLs — todo en repararFotosServidor.
export const repararFotosProyecto = async ({ proyectoId, resultado, onProgreso }) => {
  // FASE 1 — subir desde ESTE equipo lo que falte en la nube
  const problemas = (resultado?.items || []).filter(it => it.p && !enNube(it));
  let subidasEquipo = 0, done = 0;
  onProgreso?.(0, problemas.length, 'equipo');
  for (const it of problemas) {
    try {
      const local = await getUploadPending(it.p);
      if (local?.blob) {
        const urlNueva = await uploadImage(local.blob, it.p);
        await updateDoc(doc(db, 'puntos', String(it.puntoId)), { [`datos.fotos.${it.s}.${it.i}.url`]: urlNueva });
        subidasEquipo++;
      }
    } catch (e) { console.error('subir desde equipo', it.p, e); }
    done++;
    onProgreso?.(done, problemas.length, 'equipo');
  }

  // FASE 2 — el SERVIDOR hace el resto (continúa aunque se cierre la app)
  onProgreso?.(0, 0, 'servidor');
  const { repararFotosServidor } = await import('../services/exportacionService');
  const r = await repararFotosServidor(proyectoId);
  return {
    reparadas: subidasEquipo + (r?.restauradas || 0),
    subidasEquipo,
    restauradasServidor: r?.restauradas || 0,
    respaldadas: r?.respaldadas || 0,
    sinFuente: r?.sinFuente || 0,
    total: problemas.length,
  };
};
