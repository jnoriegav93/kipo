// LIQUIDACIÓN DE MATERIALES — agrega, DEBAJO de la lista fija de la plantilla,
// una fila por cada ferretería del proyecto (sin tocar/borrar lo existente).
//  D DESCRIPCION = nombre de la ferretería · E UNIDAD MEDIDA = unidad del ítem
//  F PAQUETES = cant · G UNIDADES = RECIBIDO (cant×factor) · H INSTALADO = CONSOLIDADO
//  K PROYECTO · N FECHA LIQUIDACION
// IMPORTANTE: la plantilla trae una TABLA de Excel (Tabla1) + imagen + comentarios.
// ExcelJS los corrompe al re-escribir, así que inyectamos las filas DIRECTAMENTE en
// el XML con fflate, dejando todo lo demás intacto byte a byte.
import { saveAs } from 'file-saver';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { cargarPuntosProyecto, cargarCablesAceroProyecto } from './cargarPuntosExport';
import { metrosPorItem, esCableAcero, quitarCableAcero } from './cablesAcero';

const TEMPLATE_URL = '/templates/LIQUIDACION_DE_MATERIALES.xlsx';
const HOJA = 'FORMATO LIQ';

const normV = (v) => typeof v === 'number'
  ? { factor: 1, cant: v }
  : (v && typeof v === 'object' ? { factor: v.factor || 1, cant: v.cant || 0 } : { factor: 1, cant: 0 });

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

const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colLetter = (c) => { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
const cellXml = (col, row, v, style) => {
  if (v == null || v === '') return '';
  const ref = colLetter(col) + row;
  const sa = style ? ` s="${style}"` : '';
  return typeof v === 'number'
    ? `<c r="${ref}"${sa}><v>${v}</v></c>`
    : `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
};

export async function descargarLiquidacion(proyecto, puntos, config) {
  const catalogo = config?.catalogoFerreteria || [];
  const porId = new Map(catalogo.map(f => [f.id, f]));

  // Lista de control vinculada (RECIBIDO) — puede no existir
  let recibido = {};
  try {
    const snap = await getDocs(query(collection(db, 'controlFerreteria'), where('proyectoId', '==', proyecto.id)));
    if (!snap.empty) recibido = snap.docs[0].data()?.recibido || {};
  } catch (e) { console.warn('Liquidación: sin lista de control vinculada', e); }
  const hayLista = Object.keys(recibido).length > 0;

  // Consolidado (instalado) por ferretería. El cable de acero no se cuenta por poste:
  // sale solo de los cables trazados, justo debajo
  const consolidado = {};
  const ptsProy = await cargarPuntosProyecto(proyecto, puntos);
  ptsProy.forEach(p => {
    Object.entries(quitarCableAcero(getConsolidado(p.datos || {}))).forEach(([id, c]) => { if (c) consolidado[id] = (consolidado[id] || 0) + c; });
  });
  // Cables de acero: se liquidan por metro, medidos con los postes donde están hoy
  const cablesAcero = await cargarCablesAceroProyecto(proyecto);
  const metrosAcero = metrosPorItem(cablesAcero, [...ptsProy, ...(puntos || [])]);
  Object.entries(metrosAcero).forEach(([id, m]) => { consolidado[id] = (consolidado[id] || 0) + m; });

  // Filas: unión recibido + consolidado, solo ferreterías del catálogo
  const ids = [...new Set([...Object.keys(recibido), ...Object.keys(consolidado)])].filter(id => {
    if (!porId.has(id)) return false;
    const rv = normV(recibido[id]);
    return (rv.cant * rv.factor) > 0 || (consolidado[id] || 0) > 0;
  });
  const filas = ids.map(id => {
    const f = porId.get(id);
    const rv = normV(recibido[id]);
    return {
      nombre: f.nombre || id,
      // El cable de acero va siempre en metros, diga lo que diga el catálogo
      unidad: esCableAcero(id) ? 'mts' : (f.unidad || ''),
      paquetes: rv.cant,
      unidades: rv.cant * (rv.factor || 1),
      instalado: consolidado[id] || 0,
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre));

  // 1. Cargar plantilla (zip)
  const resp = await fetch(TEMPLATE_URL);
  if (!resp.ok) throw new Error('No se pudo cargar la plantilla');
  const files = unzipSync(new Uint8Array(await resp.arrayBuffer()));

  // 2. Ubicar la hoja FORMATO LIQ y la fila donde termina la lista (ref de la tabla)
  let sheetPath = 'xl/worksheets/sheet1.xml';
  try {
    const wbXml = strFromU8(files['xl/workbook.xml']);
    const relsXml = strFromU8(files['xl/_rels/workbook.xml.rels']);
    const rid = wbXml.match(new RegExp(`<sheet[^>]*name="${HOJA}"[^>]*r:id="([^"]+)"`))?.[1];
    const target = rid && relsXml.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1];
    if (target) sheetPath = 'xl/' + target.replace(/^\//, '');
  } catch (e) { /* fallback sheet1 */ }

  let listEnd = 45;
  try {
    const srelsPath = sheetPath.replace('worksheets/', 'worksheets/_rels/') + '.rels';
    const tgt = strFromU8(files[srelsPath]).match(/Target="([^"]*tables\/[^"]+)"/)?.[1];
    if (tgt) {
      const tpath = 'xl/' + tgt.replace('../', '');
      const end = strFromU8(files[tpath]).match(/ref="[A-Z]+\d+:[A-Z]+(\d+)"/)?.[1];
      if (end) listEnd = parseInt(end, 10);
    }
  } catch (e) { /* usa 45 */ }

  // 3. Inyectar filas reemplazando las filas vacías existentes (o agregando)
  let xml = strFromU8(files[sheetPath]);
  const fecha = new Date().toLocaleDateString('es-PE');
  const proyNombre = proyecto?.nombre || '';
  filas.forEach((f, i) => {
    const r = listEnd + 1 + i;
    let c = '';
    c += cellXml(4, r, f.nombre);            // D DESCRIPCION
    c += cellXml(5, r, f.unidad);            // E UNIDAD MEDIDA
    if (hayLista) {
      c += cellXml(6, r, f.paquetes, 1);     // F PAQUETES
      c += cellXml(7, r, f.unidades, 1);     // G UNIDADES (RECIBIDO)
    }
    c += cellXml(8, r, f.instalado, 1);      // H INSTALADO (CONSOLIDADO)
    c += cellXml(11, r, proyNombre);         // K PROYECTO
    c += cellXml(14, r, fecha);              // N FECHA LIQUIDACION
    const nr = `<row r="${r}" spans="1:14" ht="12.75" customHeight="1" x14ac:dyDescent="0.25">${c}</row>`;
    const re = new RegExp(`<row r="${r}"[^>]*(?:/>|>[\\s\\S]*?</row>)`);
    xml = re.test(xml) ? xml.replace(re, nr) : xml.replace('</sheetData>', nr + '</sheetData>');
  });
  files[sheetPath] = strToU8(xml);

  // 4. Descargar
  const out = zipSync(files);
  const nombre = `LIQUIDACION DE MATERIALES - ${(proyecto?.nombre || 'PROYECTO')}.xlsx`;
  return { blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre, ok: true, filas: filas.length, conLista: hayLista };
}
