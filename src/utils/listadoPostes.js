// LISTADO DE POSTES ELÉCTRICOS — llena la plantilla con una fila por poste
// eléctrico (tipoPoste === 'Eléctrico'), ordenado por posición (ordenTendido).
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { cargarPuntosProyecto } from './cargarPuntosExport';

const TEMPLATE_URL = '/templates/LISTADO_DE_POSTES_ELECTRICOS.xlsx';
const SHEET = 'POSTES';
const PRIMER_FILA = 5;

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const valOr = (v, def = 'SN') => (v && String(v).trim() && String(v).trim() !== '-') ? String(v).trim() : def;

// Dirección → nombre de vía (sin el número final) + lote (número final, admite letra)
const splitDireccion = (dir) => {
  const s = (dir || '').toString().trim();
  if (!s) return { calle: 'SN', lote: 'SN' };
  const m = s.match(/^(.*?)[\s,]+(\d+[A-Za-z]?)\s*$/);
  if (m) return { calle: (m[1].trim() || 'SN'), lote: m[2] };
  return { calle: s, lote: 'SN' };
};
// Prefijo de la vía (JR/CA/AV…): texto antes del primer punto
const tipoVia = (calle) => { const m = String(calle || '').match(/^\s*([A-Za-zñÑ]+)\s*\./); return m ? m[1].toUpperCase() : ''; };

export async function descargarListadoPostes(proyecto, puntos, config) {
  const resp = await fetch(TEMPLATE_URL);
  if (!resp.ok) throw new Error('No se pudo cargar la plantilla');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await resp.arrayBuffer());
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error('La plantilla no tiene la hoja "' + SHEET + '"');

  // Postes eléctricos, ordenados por posición (ordenTendido)
  const ptsProy = await cargarPuntosProyecto(proyecto, puntos);
  const postes = ptsProy.filter(p => norm(p.datos?.tipoPoste) === 'electrico');
  postes.sort((a, b) => {
    const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1; if (ob != null) return 1;
    return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
  });

  // Última fila de ejemplo (col B) para limpiar sobrantes si el proyecto trae menos postes
  let lastEx = PRIMER_FILA - 1;
  for (let r = PRIMER_FILA; r <= ws.rowCount; r++) { const v = ws.getRow(r).getCell(2).value; if (v != null && v !== '') lastEx = r; }

  // La plantilla trae solo la 1ra fila (5) con bordes; replicamos ese formato a las siguientes.
  const modelRow = ws.getRow(PRIMER_FILA);
  const modelH = modelRow.height;
  const modelStyles = {};
  for (let c = 2; c <= 16; c++) modelStyles[c] = modelRow.getCell(c).style;

  const plano = proyecto?.nombre || '';
  postes.forEach((p, i) => {
    const d = p.datos || {};
    const R = ws.getRow(PRIMER_FILA + i);
    if (i > 0) {
      if (modelH != null) R.height = modelH;
      for (let c = 2; c <= 16; c++) R.getCell(c).style = JSON.parse(JSON.stringify(modelStyles[c] || {}));
    }
    const ub = String(d.ubicacion || '').split(',').map(s => s.trim()).filter(Boolean);
    const departamento = valOr(ub[ub.length - 1] || d.provincia, '');
    const provincia = valOr(d.provincia || ub[1] || ub[0], '');
    const distrito = valOr(d.distrito || ub[0], '');
    const { calle, lote } = splitDireccion(d.direccion);
    const alturaCarga = [d.altura, d.fuerza].map(v => (v == null ? '' : String(v).trim())).filter(Boolean).join('/');
    R.getCell(2).value = d.numero || '';                                                    // B N° DE POSTE (ITEM)
    R.getCell(3).value = plano;                                                              // C PLANO
    R.getCell(4).value = departamento;                                                       // D DEPARTAMENTO
    R.getCell(5).value = provincia;                                                          // E PROVINCIA
    R.getCell(6).value = distrito;                                                           // F DISTRITO
    R.getCell(7).value = (d.codigo && String(d.codigo).trim()) ? String(d.codigo).trim() : 'SC'; // G CODIGO
    R.getCell(8).value = d.tipo || '';                                                       // H TENSION (tipo de red BT/MT)
    R.getCell(9).value = tipoVia(calle);                                                     // I TIPO DE VIA (prefijo)
    R.getCell(10).value = calle;                                                             // J NOMBRE DE LA VIA
    R.getCell(11).value = lote;                                                              // K N° LOTE
    // L EMPRESA ELECTRICA — vacío
    R.getCell(13).value = d.material || '';                                                  // M TIPO (material)
    R.getCell(14).value = alturaCarga;                                                       // N ALTURA Y CARGA
    // O Cantidad de Apoyo — vacío
    R.getCell(16).value = (d.cables != null && d.cables !== '') ? d.cables : '';             // P Cantidad de Cables
  });

  // Limpiar filas de ejemplo sobrantes (más allá de los postes del proyecto)
  for (let r = PRIMER_FILA + postes.length; r <= lastEx; r++) {
    const R = ws.getRow(r);
    for (let c = 2; c <= 16; c++) R.getCell(c).value = null;
  }

  const out = await wb.xlsx.writeBuffer();
  const nombre = `LISTADO DE POSTES ELECTRICOS - ${proyecto?.nombre || 'PROYECTO'}.xlsx`;
  return { blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre, ok: true, postes: postes.length };
}
