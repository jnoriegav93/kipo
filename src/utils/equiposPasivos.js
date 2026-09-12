// ── EQUIPOS PASIVOS POR PUNTO ─────────────────────────────────────────────────
// Un poste puede tener VARIOS equipos pasivos (ej. FAT + HBOX), y cada uno lleva
// su propio código de pasivo y su propio código de serie.
//
// Modelo:  datos.equipos = [{ tipo, pasivo, codigoSerie }, ...]
//
// Compatibilidad: `datos.pasivo` y `datos.codigoSerie` (campos sueltos de siempre)
// SE SIGUEN ESCRIBIENDO con los valores concatenados " / ", para que todo lo que
// ya los lee (mapa, sello, Excel, KMZ, bitácora, buscador…) siga funcionando y los
// puntos antiguos no se rompan.

export const EQUIPOS_CON_SERIE = ['mufa', 'xbox', 'hbox', 'fat', 'nap'];

export const LABEL_EQUIPO = {
  mufa: 'MUFA',
  xbox: 'XBOX',
  hbox: 'HBOX',
  fat: 'FAT',
  nap: 'NAP',
};

const tiposDe = (d) => {
  const raw = d?.tipoElemento;
  return Array.isArray(raw) ? raw : (raw ? [raw] : []);
};

// Equipos del punto, en el orden de EQUIPOS_CON_SERIE, con sus códigos.
// Punto ANTIGUO (sin datos.equipos): su pasivo/codigoSerie sueltos se cargan en el
// PRIMER equipo marcado; los demás quedan vacíos para completar.
export const equiposDePunto = (d) => {
  const marcados = tiposDe(d).filter(t => EQUIPOS_CON_SERIE.includes(t));
  const orden = EQUIPOS_CON_SERIE.filter(t => marcados.includes(t));
  const guardados = Array.isArray(d?.equipos) ? d.equipos : [];
  const esLegacy = guardados.length === 0;
  return orden.map((tipo, i) => {
    const g = guardados.find(e => e && e.tipo === tipo);
    if (g) return { tipo, pasivo: g.pasivo || '', codigoSerie: g.codigoSerie || '' };
    if (esLegacy && i === 0) return { tipo, pasivo: d?.pasivo || '', codigoSerie: d?.codigoSerie || '' };
    return { tipo, pasivo: '', codigoSerie: '' };
  });
};

const unir = (valores) => valores.map(v => String(v || '').trim()).filter(Boolean).join(' / ');

export const concatPasivos = (equipos) => unir((equipos || []).map(e => e.pasivo));
export const concatSeries = (equipos) => unir((equipos || []).map(e => e.codigoSerie));

// Recalcula `equipos` desde tipoElemento y sincroniza los campos sueltos.
// Se llama al editar un código y al marcar/desmarcar un equipo.
export const sincronizarEquipos = (d) => {
  const equipos = equiposDePunto(d);
  return { ...d, equipos, pasivo: concatPasivos(equipos), codigoSerie: concatSeries(equipos) };
};
