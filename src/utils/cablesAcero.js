// CABLE DE ACERO (mensajero): va de poste a poste, sostiene la fibra en los cambios
// de dirección y se liquida como ferretería, por metro. No es fibra: vive en su
// propia colección (cablesAcero) para que nada de lo que lee fibras lo cuente.
//
// Un cable guarda solo sus dos postes y el ítem del catálogo. El largo se calcula
// siempre con la posición actual de los postes: si uno se corrige, los metros también.
import { distanciaMetros } from './fibraUtils.js';

// Se liquida la distancia entre postes más un metro, redondeado al metro superior
export const METRO_EXTRA_ACERO = 1;

export const metrosCableAcero = (a, b) => {
  const d = distanciaMetros(a, b) + METRO_EXTRA_ACERO;
  // Al centímetro antes de subir: el ruido de la coma flotante no debe sumar un metro
  return Math.ceil(Math.round(d * 100) / 100);
};

// Ítems del catálogo que se tienden como cable: se cuentan por metro, nunca por poste
export const esPorMetro = (item) => item?.porMetro === true;
export const tiposCableAcero = (catalogo = []) => catalogo.filter(esPorMetro);

// Los dos postes de un cable, o null si alguno no está (borrado u oculto)
export const postesDeCable = (cable, porId) => {
  const [a, b] = (cable?.puntos || []).map(id => porId.get(String(id)));
  return a?.coords?.lat != null && b?.coords?.lat != null ? [a, b] : null;
};

// Metros a liquidar por ítem del catálogo: { ferrId: metros }
export const metrosPorItem = (cables = [], puntos = []) => {
  const porId = new Map(puntos.map(p => [String(p.id), p]));
  const total = {};
  cables.forEach(c => {
    const postes = postesDeCable(c, porId);
    if (!postes || !c.ferrId) return;
    total[c.ferrId] = (total[c.ferrId] || 0) + metrosCableAcero(postes[0].coords, postes[1].coords);
  });
  return total;
};
