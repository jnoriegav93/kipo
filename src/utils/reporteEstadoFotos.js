// REPORTE: ESTADO DE FOTOS — una fila por poste (ITEM) y, por cada sección de
// fotos, dos columnas: cuántas fotos BUENAS (full-res) y cuántas MINIATURAS.
// La clasificación la hace el servidor mirando el PESO real de cada archivo
// (no si "tiene link"), así una foto cuyo link apunta a la miniatura se cuenta
// correctamente como miniatura. Solo datos, sin fotos.
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { TABS_CONFIG } from '../components/PhotoManager';
import { clasificarFotosProyecto } from '../services/exportacionService';

// Orden de secciones en el reporte (id de TABS_CONFIG)
const SECTION_IDS = [
  'poste', 'instalacion', 'fatPrecoNueva', 'napMec',
  'mufaTroncal', 'xbox', 'hbox', 'medioTramo',
  'site1', 'site2', 'nodo', 'adicionales',
];

export async function descargarReporteEstadoFotos(proyecto) {
  if (!proyecto?.id) throw new Error('Proyecto inválido');

  // El servidor clasifica por peso real y devuelve conteos por punto/sección
  const data = await clasificarFotosProyecto(proyecto.id);
  const postes = (data?.postes || []).slice();

  // Ordenar por posición y luego por ITEM numérico
  postes.sort((a, b) => {
    const oa = a.ordenTendido, ob = b.ordenTendido;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1; if (ob != null) return 1;
    return (parseInt(a.numero) || 0) - (parseInt(b.numero) || 0);
  });

  // Secciones a mostrar: las conocidas + cualquier extra presente en los datos
  const idsPresentes = new Set();
  postes.forEach(p => Object.keys(p.secciones || {}).forEach(id => idsPresentes.add(id)));
  const ids = [...SECTION_IDS.filter(id => TABS_CONFIG[id]), ...[...idsPresentes].filter(id => !SECTION_IDS.includes(id))];
  const secciones = ids.map(id => ({ id, title: (TABS_CONFIG[id] && TABS_CONFIG[id].title) || id.toUpperCase() }));

  const conteo = (p, secId) => {
    const s = (p.secciones || {})[secId];
    return { buenas: s?.buenas || 0, mini: s?.mini || 0 };
  };

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ESTADO FOTOS');

  // ---- Encabezado en dos filas ----
  ws.mergeCells(1, 1, 2, 1);
  ws.getCell(1, 1).value = 'ITEM';

  let col = 2;
  const colInicioSeccion = {};
  secciones.forEach(sec => {
    colInicioSeccion[sec.id] = col;
    ws.mergeCells(1, col, 1, col + 1);
    ws.getCell(1, col).value = sec.title;
    ws.getCell(2, col).value = 'Buenas';
    ws.getCell(2, col + 1).value = 'Mini';
    col += 2;
  });
  const colTotal = col;
  ws.mergeCells(1, colTotal, 1, colTotal + 1);
  ws.getCell(1, colTotal).value = 'TOTAL';
  ws.getCell(2, colTotal).value = 'Buenas';
  ws.getCell(2, colTotal + 1).value = 'Mini';
  const ultimaCol = colTotal + 1;

  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= ultimaCol; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r === 1 ? 'FF1E293B' : 'FF475569' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
  }

  // ---- Filas de datos ----
  let fila = 3;
  let totGlobBuenas = 0, totGlobMini = 0;
  postes.forEach(p => {
    ws.getCell(fila, 1).value = p.numero || '';
    let pbuenas = 0, pmini = 0;
    secciones.forEach(sec => {
      const { buenas, mini } = conteo(p, sec.id);
      const c0 = colInicioSeccion[sec.id];
      ws.getCell(fila, c0).value = buenas || '';
      ws.getCell(fila, c0 + 1).value = mini || '';
      pbuenas += buenas; pmini += mini;
    });
    ws.getCell(fila, colTotal).value = pbuenas || '';
    ws.getCell(fila, colTotal + 1).value = pmini || '';
    totGlobBuenas += pbuenas; totGlobMini += pmini;

    for (let c = 1; c <= ultimaCol; c++) {
      const cell = ws.getCell(fila, c);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.font = { size: 9, bold: c === 1 };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      const esMiniCol = ((c - 2) % 2 === 1) || c === colTotal + 1;
      if (esMiniCol && cell.value) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0E0' } };
    }
    fila++;
  });

  // Fila de totales general
  ws.getCell(fila, 1).value = 'TOTAL';
  secciones.forEach(sec => {
    let b = 0, m = 0;
    postes.forEach(p => { const r = conteo(p, sec.id); b += r.buenas; m += r.mini; });
    const c0 = colInicioSeccion[sec.id];
    ws.getCell(fila, c0).value = b || '';
    ws.getCell(fila, c0 + 1).value = m || '';
  });
  ws.getCell(fila, colTotal).value = totGlobBuenas || '';
  ws.getCell(fila, colTotal + 1).value = totGlobMini || '';
  for (let c = 1; c <= ultimaCol; c++) {
    const cell = ws.getCell(fila, c);
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3C4' } };
    cell.border = { top: { style: 'medium' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  }

  ws.getColumn(1).width = 10;
  for (let c = 2; c <= ultimaCol; c++) ws.getColumn(c).width = 8;
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 2 }];

  const out = await wb.xlsx.writeBuffer();
  const nombre = `ESTADO DE FOTOS - ${proyecto?.nombre || 'PROYECTO'}.xlsx`;
  return { blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre, ok: true, postes: postes.length, buenas: totGlobBuenas, mini: totGlobMini };
}
