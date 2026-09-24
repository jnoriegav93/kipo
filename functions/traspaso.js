/* global module */
// (ESLint está configurado para el navegador; esto corre en Node, dentro de las
// Cloud Functions. Se declara solo `module` en vez de apagar el lint del archivo.)
//
// Traspaso de un proyecto (paso 3c del rediseño de equipos; CONTEXTO.md, "Traspasar la
// obra"). Lógica pura, sin Firebase, para probarla con Node. La usa `traspasarProyecto`
// en index.js.
//
// Los puntos nombran su ferretería por el id del catálogo del DUEÑO, y todos leen ese
// catálogo. Si la obra cambia de dueño sin más, los ids que el nuevo no tiene quedarían
// sin nombre para todos. Por eso, al traspasar, se le agregan al nuevo dueño los ítems
// que la obra usa y él no tiene, con el MISMO id (decidido con el usuario el 23/09).

// Los ids de ferretería que usa una obra: los de sus puntos (el modelo de hoy,
// `ferreteriaFinal`, y el viejo, `armadosSeleccionados` + `ferreteriaExtra`), los de los
// armados del proyecto, el de cada cable de acero y los de los controles de ferretería
// del dueño.
const idsFerreteriaDeObra = ({ puntos = [], armados = [], cables = [], controles = [] }) => {
  const ids = new Set();
  const sumarItems = (lista) => (lista || []).forEach(it => { if (it && it.idRef != null) ids.add(String(it.idRef)); });
  for (const p of puntos) {
    const d = (p && p.datos) || {};
    Object.keys(d.ferreteriaFinal || {}).forEach(k => ids.add(String(k)));
    Object.keys(d.ferreteriaExtra || {}).forEach(k => ids.add(String(k)));
    (d.armadosSeleccionados || []).forEach(a => sumarItems(a && a.items));
  }
  (armados || []).forEach(a => sumarItems(a && a.items));
  (cables || []).forEach(c => { if (c && c.ferrId != null) ids.add(String(c.ferrId)); });
  (controles || []).forEach(c => Object.keys((c && c.recibido) || {}).forEach(k => ids.add(String(k))));
  return ids;
};

// Del catálogo del dueño anterior, los ítems que la obra usa y el nuevo dueño no tiene.
// Van tal cual, con el mismo id. Los ids que la obra usa pero el dueño anterior tampoco
// tiene no se pueden reponer: se cuentan en `sinOrigen`, para avisar.
const itemsQueFaltan = (usados, catalogoViejo, catalogoNuevo) => {
  const tieneNuevo = new Set((catalogoNuevo || []).map(it => String(it.id)));
  const delViejo = new Map((catalogoViejo || []).map(it => [String(it.id), it]));
  const agregar = [];
  let sinOrigen = 0;
  for (const id of usados) {
    if (tieneNuevo.has(id)) continue;
    const item = delViejo.get(id);
    if (item) agregar.push(item);
    else sinOrigen++;
  }
  return { agregar, sinOrigen };
};

module.exports = { idsFerreteriaDeObra, itemsQueFaltan };
