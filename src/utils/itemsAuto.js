// ── ÍTEM AUTOMÁTICO ───────────────────────────────────────────────────────────
// Al crear un punto, el ITEM se propone solo: P1, P2… en los postes, MT1… en los
// medios tramos y C1… en las cámaras. El número es la CANTIDAD de puntos de esa
// clase que ya tiene el proyecto, más uno. Los prefijos se eligen al crear el
// proyecto (`prefijosItem`), con P / MT / C por defecto y sin relleno de ceros.
//
// Manda el técnico: si escribe otra cosa en el ITEM, no se le vuelve a tocar.
// Esto SOLO llena el ítem mientras se crea el punto; no toca el orden de
// posiciones ni la renumeración posterior, que siguen siendo trabajo aparte.

export const PREFIJOS_ITEM = { poste: 'P', medioTramo: 'MT', camara: 'C' };
export const CLASES_ITEM = ['poste', 'medioTramo', 'camara'];

export const prefijosDeProyecto = (proyecto) => ({
  poste: proyecto?.prefijosItem?.poste ?? PREFIJOS_ITEM.poste,
  medioTramo: proyecto?.prefijosItem?.medioTramo ?? PREFIJOS_ITEM.medioTramo,
  camara: proyecto?.prefijosItem?.camara ?? PREFIJOS_ITEM.camara,
});

// Misma clasificación que usa Renumerar: MEDIO TRAMO manda sobre todo; CÁMARA
// manda sobre el equipo pasivo; cualquier otra cosa es POSTE (con FAT/MUFA/XBOX/
// HBOX o pelado). Sin propietario ni elemento todavía no hay clase: el punto
// recién abierto no se numera hasta saber qué es.
export const claseDePunto = (datos) => {
  const raw = datos?.tipoElemento;
  const tipos = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  if (tipos.includes('medioTramo')) return 'medioTramo';
  if (tipos.includes('camara')) return 'camara';
  if (datos?.tipoPoste || tipos.length > 0) return 'poste';
  return null;
};

// Cuántos postes, medios tramos y cámaras tiene ya el proyecto.
export const contarPorClase = (puntos = []) => {
  const conteo = { poste: 0, medioTramo: 0, camara: 0 };
  puntos.forEach(p => { const clase = claseDePunto(p?.datos); if (clase) conteo[clase] += 1; });
  return conteo;
};

export const siguienteItem = (conteo, clase, prefijos = PREFIJOS_ITEM) => {
  if (!clase) return '';
  return `${prefijos?.[clase] ?? ''}${(conteo?.[clase] || 0) + 1}`;
};

// ¿Lo que hay escrito en el ITEM lo puso la app? Vacío cuenta como automático.
// Si el técnico escribió otra cosa (corrigió el número), se respeta y ya no se
// recalcula aunque cambie de tipo.
export const esItemAutomatico = (valor, conteo, prefijos = PREFIJOS_ITEM) => {
  const v = String(valor || '').trim().toUpperCase();
  if (!v) return true;
  return CLASES_ITEM.some(clase => siguienteItem(conteo, clase, prefijos).toUpperCase() === v);
};

// Devuelve los datos con el ITEM propuesto, si corresponde proponerlo.
export const conItemAuto = (datos, conteo, prefijos = PREFIJOS_ITEM) => {
  const clase = claseDePunto(datos);
  if (!clase) return datos;
  if (!esItemAutomatico(datos?.numero, conteo, prefijos)) return datos;
  const propuesto = siguienteItem(conteo, clase, prefijos);
  if ((datos?.numero || '') === propuesto) return datos;
  return { ...datos, numero: propuesto };
};
