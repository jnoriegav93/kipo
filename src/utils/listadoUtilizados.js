// LISTADO FINAL DE POSTES UTILIZADOS — una fila por punto del proyecto,
// ordenado por posición (ordenTendido). Incluye TODOS los postes.
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { cargarPuntosProyecto, cargarCablesAceroProyecto } from './cargarPuntosExport';
import { equiposDePunto } from './equiposPasivos';
import { esCableAcero, metrosAceroPorPoste } from './cablesAcero';

const TEMPLATE_URL = '/templates/LISTADO_DE_POSTES_UTILIZADOS.xlsx';
const PRIMER_FILA = 10;

const valOr = (v, def = 'SN') => (v && String(v).trim() && String(v).trim() !== '-') ? String(v).trim() : def;

const splitDireccion = (dir) => {
  const s = (dir || '').toString().trim();
  if (!s) return { calle: 'SN', lote: 'SN' };
  const m = s.match(/^(.*?)[\s,]+(\d+[A-Za-z]?)\s*$/);
  if (m) return { calle: (m[1].trim() || 'SN'), lote: m[2] };
  return { calle: s, lote: 'SN' };
};

// ¿el punto tiene al menos una foto en la pestaña indicada?
const tieneFotos = (datos, tabId) => {
  const sec = datos?.fotos?.[tabId];
  if (!sec || typeof sec !== 'object') return false;
  const hay = (v) => {
    if (!v) return false;
    if (typeof v === 'string') return true;
    if (Array.isArray(v)) return v.some(hay);
    return !!(v.url || v.urlHD || v.thumb);
  };
  return Object.values(sec).some(hay);
};

const getConsolidado = (datos) => {
  const t = {};
  if (datos.ferreteriaFinal && Object.keys(datos.ferreteriaFinal).length > 0) {
    Object.entries(datos.ferreteriaFinal).forEach(([id, c]) => { if (c) t[id] = (t[id] || 0) + c; });
    return t;
  }
  (datos.armadosSeleccionados || []).forEach(a => (a.items || []).forEach(it => { t[it.idRef] = (t[it.idRef] || 0) + it.cant; }));
  Object.entries(datos.ferreteriaExtra || {}).forEach(([id, c]) => { if (c) t[id] = (t[id] || 0) + c; });
  return t;
};

// "1 CABLE PRECO 150, 31 m CABLE MENSAJERO 3/16…" — consolidado como texto, en orden del
// catálogo. Lo que se tiende por metro (cable de acero) llega aparte y va con sus metros.
const elementosTexto = (datos, catalogo, acero = {}) => {
  const cons = getConsolidado(datos);
  Object.entries(acero).forEach(([id, m]) => { cons[id] = (cons[id] || 0) + m; });
  return catalogo.filter(f => (cons[f.id] || 0) > 0).map(f => `${cons[f.id]}${esCableAcero(f.id) ? ' m' : ''} ${f.nombre}`).join(', ');
};

export async function descargarListadoUtilizados(proyecto, puntos, config) {
  const resp = await fetch(TEMPLATE_URL);
  if (!resp.ok) throw new Error('No se pudo cargar la plantilla');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await resp.arrayBuffer());
  const ws = wb.worksheets[0]; // hoja "POSTES " (con espacio)

  const catalogo = config?.catalogoFerreteria || [];

  // Todos los postes del proyecto, ordenados por posición
  const [postes, cablesAcero] = await Promise.all([
    cargarPuntosProyecto(proyecto, puntos),
    cargarCablesAceroProyecto(proyecto),
  ]);
  postes.sort((a, b) => {
    const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1; if (ob != null) return 1;
    return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
  });
  // Cada cable de acero se anota en el poste que va después de sus dos
  const aceroPorPoste = metrosAceroPorPoste(cablesAcero, postes);

  // Cabecera
  const primer = postes[0]?.datos || {};
  const ub0 = String(primer.ubicacion || '').split(',').map(s => s.trim()).filter(Boolean);
  ws.getCell('D4').value = proyecto?.ownerEmpresa || '';           // CONTRATISTA
  ws.getCell('D5').value = proyecto?.nombre || '';                 // PLANO
  ws.getCell('D6').value = valOr(primer.distrito || ub0[0], '');   // DISTRITO

  // Fila modelo (10) con bordes → replicar a las siguientes
  const modelRow = ws.getRow(PRIMER_FILA);
  const modelH = modelRow.height;
  const modelStyles = {};
  for (let c = 2; c <= 14; c++) modelStyles[c] = modelRow.getCell(c).style;

  postes.forEach((p, i) => {
    const d = p.datos || {};
    const R = ws.getRow(PRIMER_FILA + i);
    if (i > 0) {
      if (modelH != null) R.height = modelH;
      for (let c = 2; c <= 14; c++) R.getCell(c).style = JSON.parse(JSON.stringify(modelStyles[c] || {}));
    }
    const { calle, lote } = splitDireccion(d.direccion);
    const alturaCarga = [d.altura, d.fuerza].map(v => (v == null ? '' : String(v).trim())).filter(Boolean).join('/');
    const fat = tieneFotos(d, 'fatPrecoNueva');
    R.getCell(2).value = d.numero || '';                                                     // B Nº DE POSTE (ITEM)
    R.getCell(3).value = (d.codigo && String(d.codigo).trim()) ? String(d.codigo).trim() : 'SC'; // C CODIGO ASIGNADO
    R.getCell(4).value = calle;                                                               // D DIRECCION
    R.getCell(5).value = lote;                                                                // E LOTE
    R.getCell(6).value = d.tipoPoste || '';                                                   // F PROPIET.
    R.getCell(7).value = alturaCarga;                                                         // G TIPO
    R.getCell(8).value = tieneFotos(d, 'xbox') ? 'x' : '';                                    // H FDT
    R.getCell(9).value = tieneFotos(d, 'hbox') ? 'x' : '';                                    // I CLOSUR
    R.getCell(10).value = fat ? 'x' : '';                                                     // J FAT
    // K N° SERIE: cada equipo pasivo con su pasivo-serie, varios separados por ' / '
    R.getCell(11).value = equiposDePunto(d)
      .map(e => [e.pasivo, e.codigoSerie].map(v => String(v || '').trim()).filter(Boolean).join('-'))
      .filter(Boolean).join(' / ');
    // L N° DE APOYOS A INSTALAR — en blanco
    R.getCell(13).value = elementosTexto(d, catalogo, aceroPorPoste[String(p.id)]);           // M ELEMENTOS A COLOCAR
    R.getCell(14).value = d.observaciones || '';                                              // N OBSERV.
  });

  const out = await wb.xlsx.writeBuffer();
  const nombre = `LISTADO DE POSTES UTILIZADOS - ${proyecto?.nombre || 'PROYECTO'}.xlsx`;
  return { blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre, ok: true, postes: postes.length };
}
