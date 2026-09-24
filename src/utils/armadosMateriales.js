// Armados con ferretería creada a mano (lo que quedó para el final del rediseño de
// equipos; CONTEXTO.md). Un armado nombra sus materiales por el id del catálogo de
// ferretería de UNA persona: el del dueño de la obra si vive en un proyecto, el propio si
// está en la colección. Al llevarlo de un catálogo a otro (FIJAR o IMPORTAR a una obra,
// CONSERVAR en la colección), lo que el destino no tiene se copia desde el origen con el
// MISMO id, como en el traspaso (regla del usuario, 23/09). La copia la hace el servidor
// (`copiarMateriales`), porque el destino puede ser el catálogo de otra persona.
// Lógica pura: lo de afuera entra como funciones, para probarla con Node.

// Los ids que usan los armados y el catálogo de destino no tiene, sin repetir y ordenados.
export const idsQueFaltan = (armados, catalogoDestino) => {
  const tiene = new Set((catalogoDestino || []).map(f => String(f.id)));
  const faltan = new Set();
  for (const a of armados || []) {
    for (const it of (a && a.items) || []) {
      if (it && it.idRef != null && !tiene.has(String(it.idRef))) faltan.add(String(it.idRef));
    }
  }
  return [...faltan].sort();
};

// Los armados que se pueden llevar y los que no: no se lleva uno que usa un material que
// no está en ningún catálogo (`sinOrigen`).
export const separarPorOrigen = (armados, sinOrigen) => {
  const sin = new Set((sinOrigen || []).map(String));
  const noSePueden = (armados || []).filter(a => ((a && a.items) || []).some(it => it && sin.has(String(it.idRef))));
  return { sePueden: (armados || []).filter(a => !noSePueden.includes(a)), noSePueden };
};

const nombres = (armados) => armados.map(a => `"${a.nombre}"`).join(', ');
const textoNoSeLlevan = (lista) => (lista.length
  ? `${nombres(lista)} no se ${lista.length === 1 ? 'lleva: usa' : 'llevan: usan'} materiales que ya no están en ningún catálogo.`
  : '');

// El flujo completo. Devuelve los armados listos para guardar: vacío si no queda ninguno,
// si se canceló o si el servidor no copió lo necesario.
//   desde / hacia: 'mi' o { proyectoId }, como en `copiarMateriales`.
//   catalogoDestino: el catálogo al que van (para ver qué le falta).
//   mismoCatalogo: origen y destino son el catálogo de la misma persona. Ahí lo que falta
//     ya no existe en ninguna parte, y esos armados no se llevan (como antes).
//   destinoTexto: "Tu catálogo" / "El catálogo de Ana", para el mensaje.
//   copiar({ ids, desde, hacia, simular }) → { agregados, sinOrigen }
//   confirmar({ titulo, mensaje, accion }) → promesa de true / false
//   avisar({ titulo, mensaje })
export const llevarArmados = async ({
  armados, desde, hacia, catalogoDestino, mismoCatalogo, destinoTexto, copiar, confirmar, avisar,
}) => {
  const faltan = idsQueFaltan(armados, catalogoDestino);
  if (!faltan.length) return armados;
  const avisarNo = (lista) => {
    if (lista.length) avisar({ titulo: lista.length === 1 ? 'Un armado no se llevó' : 'Algunos armados no se llevaron', mensaje: textoNoSeLlevan(lista) });
  };
  if (mismoCatalogo) {
    const { sePueden, noSePueden } = separarPorOrigen(armados, faltan);
    avisarNo(noSePueden);
    return sePueden;
  }

  // Primero se pregunta al servidor qué copiaría, para mostrarlo antes de escribir nada
  const sim = await copiar({ ids: faltan, desde, hacia, simular: true });
  const { sePueden, noSePueden } = separarPorOrigen(armados, sim.sinOrigen);
  // Solo los materiales de los armados que sí se llevan
  const usados = new Set(idsQueFaltan(sePueden, catalogoDestino));
  const nuevos = (sim.agregados || []).filter(m => usados.has(String(m.id)));
  if (!sePueden.length || !nuevos.length) { avisarNo(noSePueden); return sePueden; }

  const n = nuevos.length;
  const ok = await confirmar({
    titulo: 'Ferretería nueva',
    mensaje: `${destinoTexto} no tiene ${n === 1 ? 'este material' : `estos ${n} materiales`}: `
      + `${nuevos.map(m => m.nombre || m.id).join(', ')}.\n\n`
      + `${n === 1 ? 'Se agrega' : 'Se agregan'} con el mismo nombre para que `
      + `${sePueden.length === 1 ? 'el armado funcione' : 'los armados funcionen'} ahí.`
      + (noSePueden.length ? `\n\n${textoNoSeLlevan(noSePueden)}` : ''),
    accion: 'AGREGAR',
  });
  if (!ok) return [];

  const r = await copiar({ ids: nuevos.map(m => String(m.id)), desde, hacia, simular: false });
  // Si entre la consulta y la copia el origen perdió algún material, esos armados no van
  const final = separarPorOrigen(sePueden, r.sinOrigen);
  avisarNo(final.noSePueden);
  return final.sePueden;
};
