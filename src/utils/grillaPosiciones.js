// GRILLA DE POSICIONES: de qué color va cada casilla. Sin interfaz, para probarlo con
// Node. Lo usan las DOS grillas (modal FERRETERÍA → Revisión y modal REVISIÓN), que
// tienen el mismo código y deben verse igual.
//
// El fondo dice DOS cosas a la vez, por capas:
//   · sin revisar   → BLANCO (decidido con el usuario: "cuando no está con el check")
//   · desaprobado   → ROJO, que es una marca puesta a propósito y no debe perderse
//   · aprobado      → el color de SU TIPO: medio tramo amarillo, cámara azul,
//                     poste con equipo pasivo naranja, poste normal verde
//
// Las clases van literales: Tailwind no ve las que se arman con plantillas.
import { EQUIPOS_CON_SERIE } from './equiposPasivos.js';

const tiposDe = (d) => {
  const raw = d?.tipoElemento;
  return Array.isArray(raw) ? raw : (raw ? [raw] : []);
};

// Misma prioridad que en el resto del sistema (itemsAuto, renumerarItems): MEDIO TRAMO
// manda sobre todo, CÁMARA sobre el equipo pasivo, y lo que queda es poste.
export const tipoDeCasilla = (datos) => {
  const tipos = tiposDe(datos);
  if (tipos.includes('medioTramo')) return 'medioTramo';
  if (tipos.includes('camara')) return 'camara';
  if (tipos.some(t => EQUIPOS_CON_SERIE.includes(t))) return 'pasivo';
  return 'poste';
};

export const COLOR_POR_TIPO = {
  medioTramo: 'bg-yellow-400 text-black border-yellow-500',
  camara: 'bg-blue-500 text-white border-blue-600',
  pasivo: 'bg-orange-500 text-white border-orange-600',
  poste: 'bg-green-500 text-white border-green-600',
};
export const CASILLA_DESAPROBADA = 'bg-red-500 text-white border-red-600';
export const CASILLA_PENDIENTE = 'bg-white text-slate-900 border-slate-300';

export const claseCasilla = (datos, estado) => {
  if (estado === 'aprobado') return COLOR_POR_TIPO[tipoDeCasilla(datos)];
  if (estado === 'desaprobado') return CASILLA_DESAPROBADA;
  return CASILLA_PENDIENTE;
};

// El aviso "sin tipo de poste" solo tiene sentido donde ESE dato corresponde: en un
// poste. Un medio tramo o una cámara nunca llevan tipo de poste, así que el puntito
// estaría siempre encendido y no avisaría de nada.
export const faltaTipoPoste = (datos) => {
  const t = tipoDeCasilla(datos);
  return (t === 'poste' || t === 'pasivo') && !datos?.tipoPoste;
};
