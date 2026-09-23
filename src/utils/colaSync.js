// Lo que la cola de sincronización (src/context/SyncContext.jsx) va a escribir, como
// lógica pura. Sirve para dos cosas que tienen que coincidir al pie de la letra:
//  - la CAPA DE PENDIENTES: lo que se ve = lo que dice el servidor + las tareas que
//    esperan en la cola, aplicadas encima. Sin ella, cualquier snapshot (por ejemplo,
//    un cambio de otro miembro de la obra) pisaba lo que todavía no había subido.
//  - el propio motor de la cola, que usa estas mismas funciones.
// Sin Firebase, para poder probarlo con Node.

const esMapa = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Cómo mezcla Firestore un `setDoc(..., { merge: true })`: los mapas con claves se
// mezclan campo por campo; un mapa VACÍO, un arreglo o un valor simple reemplazan. Un
// `{}` reemplaza porque el SDK lo toma como una hoja: no hay ningún campo más adentro.
export const mezclarComoFirestore = (destino, fuente) => {
  const salida = esMapa(destino) ? { ...destino } : {};
  for (const [clave, valor] of Object.entries(fuente || {})) {
    if (valor === undefined) continue;
    salida[clave] = (esMapa(valor) && Object.keys(valor).length > 0)
      ? mezclarComoFirestore(salida[clave], valor)
      : valor;
  }
  return salida;
};

// Lo que escribe `mover_punto`: la ubicación y la dirección, NADA más. Antes escribía
// `datos` entero, con la copia que tenía el teléfono al mover, y así borraba lo que otro
// miembro hubiera cambiado mientras tanto (la ferretería, una foto…). La tarea sigue
// trayendo `datos` completo, también las que ya esperaban en la cola: de ahí solo se
// toman estos dos campos.
export const camposMover = (payload) => ({
  coords: payload?.coords,
  direccion: payload?.datos?.direccion ?? '',
  ubicacion: payload?.datos?.ubicacion ?? '',
});

const mismoPunto = (t, idDoc) => t.tipo === 'guardar_punto' && t.datos?.idDoc === idDoc;

// Agrega una tarea a la cola. Un `guardar_punto` reemplaza al que ya esperaba para el
// mismo punto (la última versión gana), salvo en un caso: si lo que espera es la
// CREACIÓN y llega una EDICIÓN, la edición se funde en la creación. Antes la
// reemplazaba, y como editar escribe solo `datos`, un poste creado y corregido sin señal
// subía sin ubicación, sin proyecto y sin día: desaparecía del mapa.
// La fundida conserva el LUGAR de la creación (así va antes que un mover del mismo
// punto), pero toma el id de la tarea nueva: si la creación ya estaba subiendo, el motor
// quita la tarea vieja al terminar y la fundida sigue esperando su turno.
export const agregarConDedup = (cola, nueva) => {
  if (nueva.tipo !== 'guardar_punto' || !nueva.datos?.idDoc) return [...cola, nueva];
  const idDoc = nueva.datos.idDoc;
  const creacion = cola.find(t => mismoPunto(t, idDoc) && t.datos.modo === 'crear' && !t.fallido);
  if (creacion && nueva.datos.modo === 'editar') {
    const documento = creacion.datos.datos || {};
    const fundida = {
      ...creacion,
      id: nueva.id,
      timestamp: nueva.timestamp,
      datos: {
        ...creacion.datos,
        datos: {
          ...documento,
          datos: nueva.datos.datos?.datos,
          timestamp: nueva.datos.datos?.timestamp ?? documento.timestamp,
        },
      },
    };
    return cola
      .filter(t => !mismoPunto(t, idDoc) || t === creacion)
      .map(t => (t === creacion ? fundida : t));
  }
  return [...cola.filter(t => !mismoPunto(t, idDoc)), nueva];
};

const TIPOS_QUE_SE_VEN = ['guardar_punto', 'mover_punto', 'borrar_punto'];

// La CAPA DE PENDIENTES: los documentos del servidor con las tareas de la cola aplicadas
// encima, en orden, igual que las va a escribir el motor. No se aplican:
//  - las `fallido`: ya se sabe que no van a llegar;
//  - `subir_foto`: su pendiente lo muestra el propio formulario.
// Sin tareas para esta colección, devuelve el MISMO arreglo, para no rehacer el mapa.
export const aplicarPendientes = (docs, cola, coleccion) => {
  const tareas = (cola || []).filter(t => !t.fallido
    && TIPOS_QUE_SE_VEN.includes(t.tipo) && t.datos?.coleccion === coleccion);
  if (!tareas.length) return docs;
  const porId = new Map((docs || []).map(d => [String(d.id), d]));
  for (const t of tareas) {
    const clave = String(t.datos.idDoc);
    const actual = porId.get(clave);
    if (t.tipo === 'guardar_punto') {
      // Crear escribe el documento entero; editar, SOLO `datos`. El paquete de edición
      // trae `coords` en cero y el motor las descarta: aplicarlas mandaría el poste a 0,0.
      const escrito = t.datos.modo === 'crear' ? t.datos.datos : { datos: t.datos.datos?.datos };
      const id = actual?.id ?? t.datos.datos?.id ?? t.datos.idDoc;
      porId.set(clave, { ...mezclarComoFirestore(actual, escrito), id });
    } else if (t.tipo === 'mover_punto') {
      const m = camposMover(t.datos);
      // En el servidor `updateDoc` exige que el documento exista: sin él, fallaría.
      if (!actual || !m.coords) continue;
      porId.set(clave, {
        ...actual,
        coords: m.coords,
        datos: { ...(actual.datos || {}), direccion: m.direccion, ubicacion: m.ubicacion },
      });
    } else {
      porId.delete(clave);
    }
  }
  return [...porId.values()];
};
