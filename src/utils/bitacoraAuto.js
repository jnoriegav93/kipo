import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const NOMBRE_SECCION = {
  poste: 'Poste',
  napFatNueva: 'NAP/FAT Nueva',
  napFatExistente: 'NAP/FAT Existente'
};

const NOMBRE_SLOT = {
  principal: 'Principal',
  extra1: 'Extra 1',
  extra2: 'Extra 2',
  extra3: 'Extra 3',
  extra4: 'Extra 4'
};

export const formatId = (datos) => {
  const fat = datos?.codFat || '-';
  const pt = datos?.numero || '-';
  return `COD FAT: ${fat} | NRO PT: ${pt}`;
};

export const enviarMensajeSistema = async (proyectoId, mensaje, userUid) => {
  try {
    await addDoc(collection(db, "bitacora"), {
      proyectoId,
      mensaje,
      autorUid: userUid,
      autorNombre: 'Sistema',
      autorEmpresa: '',
      autorEmail: '',
      timestamp: new Date().toISOString(),
      tipo: 'sistema'
    });
  } catch (error) {
    console.error("Error enviando mensaje de sistema:", error);
  }
};

export const detectarCambiosFotos = (fotosAntiguas, fotosNuevas) => {
  const cambios = [];
  const antiguas = (fotosAntiguas && typeof fotosAntiguas === 'object' && !Array.isArray(fotosAntiguas)) ? fotosAntiguas : {};
  const nuevas = (fotosNuevas && typeof fotosNuevas === 'object' && !Array.isArray(fotosNuevas)) ? fotosNuevas : {};

  const todasSecciones = new Set([...Object.keys(nuevas), ...Object.keys(antiguas)]);

  for (const seccion of todasSecciones) {
    const secNueva = nuevas[seccion] || {};
    const secAntigua = antiguas[seccion] || {};
    const detalles = [];

    const todosSlots = new Set([...Object.keys(secNueva), ...Object.keys(secAntigua)]);

    for (const slot of todosSlots) {
      const teniaAntes = !!secAntigua[slot];
      const tieneAhora = !!secNueva[slot];

      if (tieneAhora && !teniaAntes) {
        detalles.push(`${NOMBRE_SLOT[slot] || slot} [nueva]`);
      } else if (tieneAhora && teniaAntes && secNueva[slot] !== secAntigua[slot]) {
        detalles.push(`${NOMBRE_SLOT[slot] || slot} [retomada]`);
      } else if (!tieneAhora && teniaAntes) {
        detalles.push(`${NOMBRE_SLOT[slot] || slot} [eliminada]`);
      }
    }

    if (detalles.length > 0) {
      const nombreSec = NOMBRE_SECCION[seccion] || seccion;
      cambios.push(`Fotos ${nombreSec}:\n${detalles.join(', ')}`);
    }
  }

  return cambios;
};

export const detectarCambiosCaracteristicas = (datosAntiguos, datosNuevos) => {
  if (!datosAntiguos || !datosNuevos) return false;

  const campos = ['altura', 'fuerza', 'material', 'tipo', 'cables'];
  for (const campo of campos) {
    if (String(datosAntiguos[campo] || '') !== String(datosNuevos[campo] || '')) {
      return true;
    }
  }

  const camposArray = ['extrasSeleccionados', 'armadosSeleccionados', 'ferreteriaExtraSeleccionada'];
  for (const campo of camposArray) {
    if (JSON.stringify(datosAntiguos[campo] || []) !== JSON.stringify(datosNuevos[campo] || [])) {
      return true;
    }
  }

  return false;
};
