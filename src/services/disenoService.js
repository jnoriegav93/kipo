import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { aFirestore, desdeFirestore } from '../utils/disenoGeo';

/* Capas del diseño: proyectos/{id}/diseno/{capa}
   Se reparten en documentos distintos porque crecen a ritmos muy diferentes —
   los lotes de un barrio son miles y el resto son decenas — y así un documento
   grande no arrastra a los demás ni se acerca al tope de 1 MB por documento. */

const CATASTRO_VACIO = { manzanas: [], calles: [], areas: [], etiquetas: [] };

const refCapa = (proyectoId, capa) => doc(db, 'proyectos', String(proyectoId), 'diseno', capa);

export const suscribirCapa = (proyectoId, capa, onDatos) => {
  return onSnapshot(
    refCapa(proyectoId, capa),
    (snap) => onDatos(snap.exists() ? desdeFirestore(snap.data()) : null),
    (e) => { console.error('Error leyendo la capa', capa, e); onDatos(null); },
  );
};

export const suscribirCatastro = (proyectoId, onDatos) =>
  suscribirCapa(proyectoId, 'catastro', (d) => onDatos({ ...CATASTRO_VACIO, ...(d || {}) }));

/* Asíncrona a propósito: con datos inválidos setDoc lanza en el acto en vez de
   rechazar la promesa, y ese error se escapaba sin que nadie lo viera. La escritura
   sale igual en el acto: el cuerpo corre sin esperar hasta el setDoc. */
export const guardarCapa = async (proyectoId, capa, datos) =>
  setDoc(refCapa(proyectoId, capa), aFirestore({ ...datos, actualizadoEn: Date.now() }));

/* Catastro vacío de un proyecto recién creado (24/09). Un documento que el equipo no
   tiene obliga a la escucha a esperar al servidor, aunque se sepa que está vacío; y esa
   respuesta puede quedar en cola detrás de otras descargas. Escrito aquí, Firestore lo
   guarda primero en el equipo y la escucha lo entrega en el acto.
   Tiene que escribirse DESPUÉS del proyecto: el servidor aplica las escrituras de un
   equipo en el orden en que salieron, y la regla del diseño lee el proyecto. */
export const iniciarCatastro = (proyectoId) => guardarCapa(proyectoId, 'catastro', CATASTRO_VACIO);

/* Guardado con retardo: dibujar mueve el estado muchas veces seguidas y no tiene
   sentido escribir en cada vértice. La escritura real ocurre 600 ms después del
   último cambio; `forzar` la ejecuta ya (al cerrar la vista, por ejemplo).

   Lo pendiente se lleva por proyecto y capa, así que cambiar de proyecto antes de
   que venza el retardo no pisa lo del anterior. `onEstado` avisa en qué va:
   'pendiente', 'guardando', 'guardado' o 'error'. Cada escritura manda la capa
   entera, de modo que tras un error el siguiente cambio reintenta con todo. */
export const crearGuardadoDiferido = (ms = 600, onEstado = () => {}) => {
  let temporizador = null;
  const pendientes = new Map();

  const escribir = () => {
    if (pendientes.size === 0) return Promise.resolve();
    const lote = [...pendientes.values()];
    pendientes.clear();
    onEstado({ estado: 'guardando' });
    return Promise.all(lote.map(({ proyectoId, capa, datos }) => guardarCapa(proyectoId, capa, datos))).then(
      () => { if (pendientes.size === 0) onEstado({ estado: 'guardado' }); },
      (e) => {
        console.error('No se pudo guardar el diseño', e);
        onEstado({ estado: 'error', error: e });
        throw e;
      },
    );
  };

  return {
    encolar(proyectoId, capa, datos) {
      pendientes.set(`${proyectoId}/${capa}`, { proyectoId, capa, datos });
      onEstado({ estado: 'pendiente' });
      clearTimeout(temporizador);
      // El error ya llegó por onEstado; aquí solo se evita el rechazo sin atender
      temporizador = setTimeout(() => { escribir().catch(() => {}); }, ms);
    },
    forzar() {
      clearTimeout(temporizador);
      return escribir();
    },
  };
};

export const CAPAS = { CATASTRO: 'catastro', RED: 'red', LOTES: 'lotes', META: 'meta' };
