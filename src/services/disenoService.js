import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/* Capas del diseño: proyectos/{id}/diseno/{capa}
   Se reparten en documentos distintos porque crecen a ritmos muy diferentes —
   los lotes de un barrio son miles y el resto son decenas — y así un documento
   grande no arrastra a los demás ni se acerca al tope de 1 MB por documento. */

const CATASTRO_VACIO = { manzanas: [], calles: [], areas: [], etiquetas: [] };

const refCapa = (proyectoId, capa) => doc(db, 'proyectos', String(proyectoId), 'diseno', capa);

export const suscribirCapa = (proyectoId, capa, onDatos) => {
  return onSnapshot(
    refCapa(proyectoId, capa),
    (snap) => onDatos(snap.exists() ? snap.data() : null),
    (e) => { console.error('Error leyendo la capa', capa, e); onDatos(null); },
  );
};

export const suscribirCatastro = (proyectoId, onDatos) =>
  suscribirCapa(proyectoId, 'catastro', (d) => onDatos({ ...CATASTRO_VACIO, ...(d || {}) }));

export const guardarCapa = (proyectoId, capa, datos) =>
  setDoc(refCapa(proyectoId, capa), { ...datos, actualizadoEn: Date.now() });

/* Guardado con retardo: dibujar mueve el estado muchas veces seguidas y no tiene
   sentido escribir en cada vértice. La escritura real ocurre 600 ms después del
   último cambio; `forzar` la ejecuta ya (al cerrar la vista, por ejemplo). */
export const crearGuardadoDiferido = (ms = 600) => {
  let temporizador = null;
  let pendiente = null;

  const escribir = () => {
    if (!pendiente) return Promise.resolve();
    const { proyectoId, capa, datos } = pendiente;
    pendiente = null;
    return guardarCapa(proyectoId, capa, datos).catch(e => {
      console.error('No se pudo guardar la capa', capa, e);
      throw e;
    });
  };

  return {
    encolar(proyectoId, capa, datos) {
      pendiente = { proyectoId, capa, datos };
      clearTimeout(temporizador);
      temporizador = setTimeout(escribir, ms);
    },
    forzar() {
      clearTimeout(temporizador);
      return escribir();
    },
  };
};

export const CAPAS = { CATASTRO: 'catastro', RED: 'red', LOTES: 'lotes', META: 'meta' };
