// CUANTIFICADO DE MATERIALES — llena la plantilla Excel con los datos del proyecto.
// Ordena los puntos por ITEM (prefijo de texto sin espacios + número ascendente),
// y para cada punto reparte su consolidado de ferretería en las columnas de la
// plantilla por similitud (con prioridad a números). Lo que no matchea va al final.
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { cargarPuntosProyecto } from './cargarPuntosExport';

const TEMPLATE_URL = '/templates/CUANTIFICADO_MATERIALES.xlsx';
const SHEET = 'cuantificado';
const PRIMER_COL_MATERIAL = 13; // M
const ULTIMA_COL_MATERIAL = 40; // AN
const PRIMER_FILA_DATOS = 5;
const ULTIMA_FILA_DATOS = 58;   // la plantilla trae 54 filas (5..58)
const UMBRAL = 0.6;

// ── Normalización / similitud ───────────────────────────────────────────────
const norm = (s) => (s || '').toString().toUpperCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')   // tildes
  .replace(/[^A-Z0-9]/g, '');                          // solo letras+números (saca espacios/puntuación)
const nums = (s) => (s.match(/\d+/g) || []);
const lev = (a, b) => {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
};
const simRatio = (a, b) => { if (!a && !b) return 1; const L = Math.max(a.length, b.length); return L ? 1 - lev(a, b) / L : 1; };

// score app↔columna con compuerta de números (evita cruzar PRECO 300 con 100, FAT9 con FAT11)
const score = (app, col) => {
  const na = norm(app), nc = norm(col);
  const nA = nums(na), nC = nums(nc);
  if (nA.length || nC.length) {
    const setC = new Set(nC), setA = new Set(nA);
    if (!nA.every(x => setC.has(x)) || !nC.every(x => setA.has(x))) return 0;
  }
  if (na === nc) return 1;
  const ta = na.replace(/\d+/g, ''), tc = nc.replace(/\d+/g, '');
  if (ta && tc && (tc.includes(ta) || ta.includes(tc))) return 0.9;
  return simRatio(na, nc);
};

// ── Orden por ITEM: prefijo (texto sin espacios) y luego número ascendente ──
const parseItem = (it) => {
  const s = (it || '').toString().trim();
  const m = s.match(/^(.*?)(\d+)\s*$/);
  return { prefix: norm(m ? m[1] : s).replace(/\d+/g, ''), num: m ? parseInt(m[2], 10) : 0 };
};

// ── Dirección → nombre de vía + lote (número final, admite letra) ───────────
const splitDireccion = (dir) => {
  const s = (dir || '').toString().trim();
  if (!s) return { calle: 'SN', lote: 'SN' };
  const m = s.match(/^(.*?)[\s,]+(\d+[A-Za-z]?)\s*$/);
  if (m) return { calle: (m[1].trim() || 'SN'), lote: m[2] };
  return { calle: s, lote: 'SN' };
};

// ── Consolidado de ferretería de un punto (modelo nuevo y legacy) ───────────
const getConsolidado = (datos) => {
  const totals = {};
  if (datos.ferreteriaFinal && Object.keys(datos.ferreteriaFinal).length > 0) {
    Object.entries(datos.ferreteriaFinal).forEach(([id, c]) => { if (c) totals[id] = (totals[id] || 0) + c; });
    return totals;
  }
  (datos.armadosSeleccionados || []).forEach(armado => {
    (armado.items || []).forEach(item => { totals[item.idRef] = (totals[item.idRef] || 0) + item.cant; });
  });
  Object.entries(datos.ferreteriaExtra || {}).forEach(([id, c]) => { if (c) totals[id] = (totals[id] || 0) + c; });
  return totals;
};

// ── Distancia entre dos coordenadas (Haversine, metros) ─────────────────────
// Línea recta sobre la superficie terrestre: no incluye flecha/catenaria del cable.
const distanciaMetros = (a, b) => {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371000; // radio terrestre medio (m)
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))) * 100) / 100;
};

const headerText = (ws, r, c) => { let v = ws.getRow(r).getCell(c).value; if (v && typeof v === 'object') v = v.richText ? v.richText.map(t => t.text).join('') : (v.text || ''); return String(v || '').replace(/\s+/g, ' ').trim(); };

export async function descargarCuantificado(proyecto, puntos, config) {
  // 1. Cargar la plantilla
  const resp = await fetch(TEMPLATE_URL);
  if (!resp.ok) throw new Error('No se pudo cargar la plantilla');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await resp.arrayBuffer());
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error('La plantilla no tiene la hoja "' + SHEET + '"');

  // 2. Columnas de materiales de la plantilla
  const matCols = [];
  for (let c = PRIMER_COL_MATERIAL; c <= ULTIMA_COL_MATERIAL; c++) {
    const name = headerText(ws, 4, c);
    if (name) matCols.push({ col: c, name });
  }
  let nextExtraCol = (matCols.length ? Math.max(...matCols.map(m => m.col)) : ULTIMA_COL_MATERIAL) + 1;

  // 3. Armar datos por punto (item + consolidado con nombres del catálogo)
  const catalogo = config?.catalogoFerreteria || [];
  const porId = new Map(catalogo.map(f => [f.id, f]));
  const ptsProy = await cargarPuntosProyecto(proyecto, puntos);
  const data = ptsProy.map(p => {
    const d = p.datos || {};
    // Solo ferreterías que existen en el catálogo (igual que la vista por punto;
    // se descartan IDs huérfanos de ferreterías borradas/renombradas).
    const consolidado = Object.entries(getConsolidado(d))
      .filter(([id, c]) => c > 0 && porId.has(id))
      .map(([id, cant]) => ({ nombre: porId.get(id).nombre, cant }));
    const { calle, lote } = splitDireccion(d.direccion);
    const tipo = [d.altura, d.fuerza].map(v => (v == null ? '' : String(v).trim())).filter(Boolean).join('/');
    return {
      orden: d.ordenTendido, id: p.id,
      coords: p.coords || null,
      item: (d.numero || '').toString(),
      codigo: (d.codigo && String(d.codigo).trim()) ? String(d.codigo).trim() : 'SC',
      direccion: calle,
      lote,
      propietario: d.tipoPoste || '',
      tipo,
      consolidado,
    };
  }).filter(p => p.item || p.consolidado.length);

  // Orden por POSICIÓN (ordenTendido); fallback al orden de creación (id)
  data.sort((a, b) => {
    const oa = a.orden, ob = b.orden;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1;
    if (ob != null) return 1;
    return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
  });

  // 4. Si hay más puntos que filas, insertar filas (duplicando el formato de la última)
  const sobran = data.length - (ULTIMA_FILA_DATOS - PRIMER_FILA_DATOS + 1);
  if (sobran > 0) ws.duplicateRow(ULTIMA_FILA_DATOS, sobran, true);
  const ultimaFilaDatos = PRIMER_FILA_DATOS + data.length - 1;

  // 5. Llenar
  const extraCols = {};   // normName -> {col, name}
  const traza = {};       // col -> {names:Set, exact:bool}
  data.forEach((p, i) => {
    const row = PRIMER_FILA_DATOS + i;
    const R = ws.getRow(row);
    R.getCell(1).value = p.item;         // A ITEM
    R.getCell(2).value = p.codigo;       // B CÓDIGO
    R.getCell(3).value = p.direccion;    // C DIRECCION
    R.getCell(4).value = p.lote;         // D LOTE
    R.getCell(5).value = p.propietario;  // E PROPIET.
    R.getCell(6).value = p.tipo;         // F TIPO
    const usadas = new Set();
    for (const mat of p.consolidado) {
      let best = null;
      for (const mc of matCols) { const sc = score(mat.nombre, mc.name); if (sc >= UMBRAL && (!best || sc > best.sc)) best = { ...mc, sc }; }
      let destCol;
      if (best && !usadas.has(best.col)) {
        destCol = best.col;
        const t = traza[destCol] || (traza[destCol] = { names: new Set(), exact: true });
        t.names.add(mat.nombre); if (best.sc < 1) t.exact = false;
      } else {
        const key = norm(mat.nombre);
        if (!extraCols[key]) { extraCols[key] = { col: nextExtraCol++, name: mat.nombre }; ws.getRow(4).getCell(extraCols[key].col).value = mat.nombre; }
        destCol = extraCols[key].col;
      }
      ws.getRow(row).getCell(destCol).value = mat.cant;
      usadas.add(destCol);
    }
  });

  // 5b. Columna NUEVA al final: distancia al poste anterior (en el orden de posición).
  // El primer punto no tiene anterior → queda vacío. Sin coordenadas → vacío.
  const colDist = nextExtraCol++;
  const celdaEnc = ws.getRow(4).getCell(colDist);
  celdaEnc.value = 'DIST. POSTE ANTERIOR (m)';
  celdaEnc.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getColumn(colDist).width = 14;
  const celdaUnid = ws.getRow(2).getCell(colDist);
  if (!celdaUnid.value) { celdaUnid.value = 'M'; celdaUnid.alignment = { horizontal: 'center' }; }
  data.forEach((p, i) => {
    if (i === 0) return;
    const dist = distanciaMetros(data[i - 1].coords, p.coords);
    if (dist != null) ws.getRow(PRIMER_FILA_DATOS + i).getCell(colDist).value = dist;
  });

  // 6. Traza (fila 3): nombre de la app que llenó cada columna + color (sin cursiva)
  for (const [col, t] of Object.entries(traza)) {
    const cell = ws.getRow(3).getCell(Number(col));
    cell.value = [...t.names].join(' / ');
    cell.font = { size: 7 };
    cell.alignment = { horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: t.exact ? 'FFB6F2B6' : 'FFFFE08A' } };
  }
  for (const e of Object.values(extraCols)) {
    const cell = ws.getRow(3).getCell(e.col);
    cell.value = '(NUEVO) ' + e.name; cell.font = { size: 7 };
    cell.alignment = { horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC58A' } };
  }

  // 7. Totales: re-escribir SUM cubriendo el rango real (incluye columnas nuevas).
  // La fila de totales de la plantilla usa fórmulas COMPARTIDAS (G master, resto
  // clones). Al insertar filas (duplicateRow) esas fórmulas se rompen al escribir,
  // así que reescribimos TODAS las columnas con fórmula (G=7 en adelante) como
  // fórmulas explícitas para eliminar las compartidas.
  let filaTotal = 60 + (sobran > 0 ? sobran : 0);
  const colsTotales = [];
  for (let c = 7; c <= ULTIMA_COL_MATERIAL; c++) colsTotales.push(c); // G..AN
  Object.values(extraCols).forEach(e => colsTotales.push(e.col));
  colsTotales.push(colDist); // suma total de distancias
  for (const c of colsTotales) {
    const L = ws.getColumn(c).letter;
    ws.getRow(filaTotal).getCell(c).value = { formula: `SUM(${L}${PRIMER_FILA_DATOS}:${L}${ultimaFilaDatos})` };
  }

  // 8. Descargar
  const out = await wb.xlsx.writeBuffer();
  const nombre = `CUANTIFICADO MATERIALES - ${(proyecto?.nombre || 'PROYECTO')}.xlsx`;
  return { blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre, ok: true, puntos: data.length, extras: Object.keys(extraCols).length };
}
