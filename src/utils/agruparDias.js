// PANEL DE DÍAS DEL MAPA: cuántas casillas se pintan cuando hay muchos días.
// Sin interfaz, para poder probarlo con Node.
//
// La regla, decidida con el usuario, es INCREMENTAL: los días sueltos nunca pasan de 7;
// en cuanto aparece el octavo, los 7 anteriores se pliegan en una SEMANA (S1, S2…). Un
// nivel más arriba pasa lo mismo: en cuanto aparece la quinta semana, las 4 anteriores se
// pliegan en un MES (M1, M2…).
//
//   7 días  → 7 sueltos
//   8 días  → S1 + 1 suelto
//  14 días  → S1 + 7 sueltos      (al llegar el 15 nace S2)
//  29 días  → S1…S4 + 1 suelto    (cuatro semanas a la vista; el mes todavía no)
//  36 días  → M1 + S5 + 1 suelto  (al aparecer la 5.ª semana se plegaron las 4)
//
// Los días llegan ORDENADOS del más viejo al más nuevo, así que lo que se pliega es
// siempre lo más viejo y lo reciente —que es con lo que se trabaja— queda a la vista.

export const DIAS_POR_SEMANA = 7;
export const SEMANAS_POR_MES = 4;

// Cuántos bloques se pliegan: solo los que quedaron ATRÁS cuando llegó el siguiente.
// Por eso el -1: con exactamente `tam` elementos todavía no se pliega nada.
const bloquesPlegados = (total, tam) => (total <= tam ? 0 : Math.floor((total - 1) / tam));

// Devuelve las casillas a pintar, del más viejo al más nuevo:
//   { tipo: 'dia',    dia }
//   { tipo: 'semana', id, etiqueta: 'S1', dias: [...], hijos: [casillas de día] }
//   { tipo: 'mes',    id, etiqueta: 'M1', dias: [...], hijos: [casillas de semana] }
// `dias` lleva SIEMPRE todos los días que cuelgan del grupo (también en un mes), para
// poder encenderlos o apagarlos de una sin tener que recorrer los hijos.
export const agruparDias = (dias = []) => {
  const lista = [...(dias || [])];
  const nSemanas = bloquesPlegados(lista.length, DIAS_POR_SEMANA);
  if (nSemanas === 0) return lista.map(d => ({ tipo: 'dia', dia: d }));

  // Las semanas se arman desde el principio (lo más viejo); el resto queda suelto
  const semanas = [];
  for (let i = 0; i < nSemanas; i++) {
    const trozo = lista.slice(i * DIAS_POR_SEMANA, (i + 1) * DIAS_POR_SEMANA);
    semanas.push({
      tipo: 'semana',
      id: `s${i + 1}`,
      etiqueta: `S${i + 1}`,
      dias: trozo,
      hijos: trozo.map(d => ({ tipo: 'dia', dia: d })),
    });
  }
  const sueltos = lista.slice(nSemanas * DIAS_POR_SEMANA).map(d => ({ tipo: 'dia', dia: d }));

  // Y el mismo criterio un nivel arriba: las semanas que quedaron atrás se pliegan
  const nMeses = bloquesPlegados(semanas.length, SEMANAS_POR_MES);
  if (nMeses === 0) return [...semanas, ...sueltos];

  const meses = [];
  for (let i = 0; i < nMeses; i++) {
    const trozo = semanas.slice(i * SEMANAS_POR_MES, (i + 1) * SEMANAS_POR_MES);
    meses.push({
      tipo: 'mes',
      id: `m${i + 1}`,
      etiqueta: `M${i + 1}`,
      dias: trozo.flatMap(s => s.dias),
      hijos: trozo,   // un mes abierto muestra sus SEMANAS, no sus 28 días
    });
  }
  const semanasSueltas = semanas.slice(nMeses * SEMANAS_POR_MES);
  return [...meses, ...semanasSueltas, ...sueltos];
};

// Los días que cuelgan de una casilla, sea del tipo que sea. Sirve para el ojo de
// visibilidad y para contar puntos sin repetir la lógica en la interfaz.
export const diasDeCasilla = (casilla) => {
  if (!casilla) return [];
  return casilla.tipo === 'dia' ? [casilla.dia] : (casilla.dias || []);
};

// Total de puntos de una casilla: la suma de los de sus días
export const puntosDeCasilla = (casilla) =>
  diasDeCasilla(casilla).reduce((t, d) => t + (d?.count || 0), 0);
