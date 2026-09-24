/* eslint-disable */
/* v2 - adicionales fix */
'use strict';

const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const admin = require('firebase-admin');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const { Zip, ZipPassThrough } = require('fflate');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const path = require('path');

// ─── FUENTE DE LOS SELLOS Y DE LOS CROQUIS ───────────────────────────────────
// Todo el dibujo pide "…px Arial", pero el contenedor donde corren las funciones NO
// tiene Arial: el canvas caía a su tipografía por defecto, que es serif, y por eso
// los sellos y los croquis salían con letra tipo Times en vez de la de la app.
// El problema nunca estuvo en el nombre de la fuente, sino en que no había ninguna.
//
// Se incrusta Arimo: es libre y comparte las MÉTRICAS EXACTAS de Arial (la misma
// familia Croscore que Liberation Sans), así que el texto ocupa lo mismo y no se
// descuadra nada. Se registra con el alias "Arial" para que todo lo ya escrito la
// encuentre sin tocar una línea de dibujo.
//
// Van las DOS variantes: sin la negrita, "bold …px Arial" volvería a caer al
// respaldo y los títulos saldrían con otra letra que el resto.
const FUENTES_SELLO = ['arimo-latin-400-normal.woff2', 'arimo-latin-700-normal.woff2'];
for (const archivo of FUENTES_SELLO) {
  try {
    const ruta = path.join(__dirname, 'node_modules', '@fontsource', 'arimo', 'files', archivo);
    // Devuelve null si no la pudo cargar; conviene enterarse por el log y no por un
    // reporte con la letra cambiada.
    if (GlobalFonts.registerFromPath(ruta, 'Arial') === null) {
      console.error('[FUENTE] no se pudo registrar:', archivo);
    }
  } catch (e) {
    // Sin fuente el reporte sale con otra letra, pero SALE: esto no puede tumbar nada.
    console.error('[FUENTE] error registrando', archivo, e.message);
  }
}

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// ============================================================
// PHOTO CONFIG (espejo de src/components/PhotoManager.jsx)
// ============================================================
const TABS_CONFIG = {
  napMec: {
    id: 'napMec', title: 'NAP',
    items: [
      { id: 'frontalRotulado', label: 'FRONTAL (ROTULADO)' },
      { id: 'frontalPotencia', label: 'FRONTAL CON POTENCIA' },
      { id: 'perfil', label: 'PERFIL' },
      { id: 'splitter', label: 'SPLITTER' },
      { id: 'bandejaFusiones', label: 'BANDEJA CON FUSIONES' },
      { id: 'etiquetaEntrada', label: 'ETIQUETA ENTRADA' },
      { id: 'etiquetaSalida', label: 'ETIQUETA SALIDA' },
      { id: 'sub_etiquetasExtremos', title: 'ETIQUETAS DE FO DE SALIDA', items: [
        { id: 'salida1', label: 'SALIDA 1' },
        { id: 'salida2', label: 'SALIDA 2' },
        { id: 'salida3', label: 'SALIDA 3' },
      ]},
    ],
  },
  mufaTroncal: {
    id: 'mufaTroncal', title: 'MUFA',
    items: [
      { id: 'frontal', label: 'FRONTAL' },
      { id: 'panoramica', label: 'PANORAMICA' },
      { id: 'vistaFrontalBandejas', label: 'VISTA FRONTAL BANDEJAS' },
      { id: 'vistaPosteriorBandejas', label: 'VISTA PERFIL BANDEJAS' },
      { id: 'bandejasAseguradas', label: 'BANDEJAS ASEG. FRONTAL' },
      { id: 'bandejasAseguradaPerfil', label: 'BANDEJAS ASEG. PERFIL' },
      { id: 'cierreCarcasa', label: 'CIERRE DE CARCASA' },
      { id: 'cajaPiso', label: 'CAJA EN PISO' },
      { id: 'fusiones', label: 'FUSIONES' },
      { id: 'cablesAsegurados', label: 'CABLES OPTICOS ASEGURADOS' },
      { id: 'etiquetasGenerales', label: 'ETIQUETAS GENERALES' },
      { id: 'herreria', label: 'HERRAJES' },
      { id: 'etiquetaIngreso', label: 'ETIQUETA FIBRA INGRESO' },
      { id: 'sub_etiquetaSalida', title: 'ETIQUETAS DE FO DE SALIDA', items: [
        { id: 'salida1', label: 'SALIDA 1' },
        { id: 'salida2', label: 'SALIDA 2' },
        { id: 'salida3', label: 'SALIDA 3' },
      ]},
    ],
  },
  fatPrecoNueva: {
    id: 'fatPrecoNueva', title: 'FAT',
    items: [
      { id: 'frontalRotulado', label: 'FRONTAL (ROTULADO)' },
      { id: 'frontalPotencia', label: 'FRONTAL CON POTENCIA' },
      { id: 'perfil', label: 'PERFIL' },
      { id: 'etiqueta', label: 'ETIQUETA' },
      { id: 'panoramica', label: 'PANORAMICA' },
      { id: 'codigoSerie', label: 'CODIGO SERIE' },
    ],
  },
  xbox: {
    id: 'xbox', title: 'XBOX',
    items: [
      { id: 'cierreCarcasa', label: 'CIERRE DE LA CARCASA' },
      { id: 'frontalBandeja', label: 'FRONTAL BANDEJA' },
      { id: 'posteriorBandeja', label: 'POSTERIOR BANDEJA' },
      { id: 'bandejasAseguradas', label: 'BANDEJAS ASEGURADAS' },
      { id: 'fibraAsegurada', label: 'FIBRA ASEGURADA' },
      { id: 'codigoSerie', label: 'CODIGO SERIE' },
      { id: 'panoramica', label: 'PANORAMICA' },
      { id: 'etiquetaEntrada', label: 'ETIQUETA ENTRADA' },
      { id: 'etiquetaSalida', label: 'ETIQUETA SALIDA' },
      { id: 'sub_etiquetaSalida', title: 'ETIQUETAS DE FO DE SALIDA', items: [
        { id: 'salida1', label: 'SALIDA 1' },
        { id: 'salida2', label: 'SALIDA 2' },
        { id: 'salida3', label: 'SALIDA 3' },
      ]},
    ],
  },
  hbox: {
    id: 'hbox', title: 'HUB BOX',
    items: [
      { id: 'cierreCarcasa', label: 'CIERRE DE LA CARCASA' },
      { id: 'panoramica', label: 'PANORAMICA' },
      { id: 'codigoSerie', label: 'CODIGO SERIE' },
      { id: 'etiquetaIngreso', label: 'ETIQUETA FO INGRESO' },
      { id: 'sub_etiquetaFat', title: 'ETIQUETAS DE FO DE SALIDA', items: [
        { id: 'salida1', label: 'SALIDA 1' },
        { id: 'salida2', label: 'SALIDA 2' },
        { id: 'salida3', label: 'SALIDA 3' },
      ]},
    ],
  },
  camara: {
    id: 'camara', title: 'CAMARA',
    items: [
      { id: 'vistaPanoramica', label: 'VISTA PANORAMICA' },
      { id: 'codigoCamara', label: 'CODIGO DE CAMARA' },
      { id: 'entradaCamara', label: 'ENTRADA A CAMARA' },
      { id: 'salidaCamara', label: 'SALIDA DE CAMARA' },
    ],
  },
  poste: {
    id: 'poste', title: 'POSTE',
    items: [
      { id: 'frontal', label: 'Frontal' },
      { id: 'perfil', label: 'Perfil' },
      { id: 'codigo', label: 'Código' },
      { id: 'alturaFuerza', label: 'Altura/Fuerza' },
      { id: 'base', label: 'Base' },
      { id: 'ferreteria', label: 'Parte Superior (Ferretería)' },
      { id: 'abscisaInicial', label: 'ABSCISA INICIAL' },
      { id: 'abscisaFinal', label: 'ABSCISA FINAL' },
    ],
  },
  instalacion: {
    id: 'instalacion', title: 'INSTALACIÓN DE POSTES',
    items: [
      { id: 'centradoPoste',      label: 'CENTRADO DE POSTE' },
      { id: 'cimentacionPiedras', label: 'CIMENTACION PIEDRAS' },
      { id: 'cimentacionCemento', label: 'CIMENTACION CEMENTO' },
      { id: 'basamento',          label: 'BASAMENTO' },
      { id: 'frontal',            label: 'FRONTAL' },
      { id: 'perfil',             label: 'PERFIL' },
      { id: 'rotulado',           label: 'ROTULADO' },
      { id: 'profundidad',        label: 'PROFUNDIDAD' },
    ],
  },
  site1: {
    id: 'site1', title: 'SITE 1',
    items: [
      { id: 'acceso', label: 'FOTOS DE ACCESO', type: 'subgallery' },
      { id: 'finalRuta',          label: 'FINAL DE RUTA' },
      { id: 'gabinete',           label: 'GABINETE' },
      { id: 'panoramica',         label: 'PANORAMICA' },
      { id: 'interiorPanduit',    label: 'INTERIOR PANDUIT' },
      { id: 'instalacionPanduit', label: 'INSTALACION PANDUIT' },
      { id: 'rotuladoPanduit',    label: 'ROTULADO PANDUIT' },
      { id: 'jumper01',           label: 'JUMPER 01 A EQUIPO rCSR' },
      { id: 'jumper02',           label: 'JUMPER 02 A EQUIPO rCSR' },
    ],
  },
  site2: {
    id: 'site2', title: 'SITE 2',
    items: [
      { id: 'acceso', label: 'FOTOS DE ACCESO', type: 'subgallery' },
      { id: 'finalRuta',          label: 'FINAL DE RUTA' },
      { id: 'gabinete',           label: 'GABINETE' },
      { id: 'panoramica',         label: 'PANORAMICA' },
      { id: 'interiorPanduit',    label: 'INTERIOR PANDUIT' },
      { id: 'instalacionPanduit', label: 'INSTALACION PANDUIT' },
      { id: 'rotuladoPanduit',    label: 'ROTULADO PANDUIT' },
      { id: 'jumper01',           label: 'JUMPER 01 A EQUIPO rCSR' },
      { id: 'jumper02',           label: 'JUMPER 02 A EQUIPO rCSR' },
    ],
  },
  site3: {
    id: 'site3', title: 'SITE 3',
    items: [
      { id: 'acceso', label: 'FOTOS DE ACCESO', type: 'subgallery' },
      { id: 'finalRuta', label: 'FINAL DE RUTA' },
      { id: 'gabinete', label: 'GABINETE' },
      { id: 'panoramica', label: 'PANORAMICA' },
      { id: 'interiorPanduit', label: 'INTERIOR PANDUIT' },
      { id: 'instalacionPanduit', label: 'INSTALACION PANDUIT' },
      { id: 'rotuladoPanduit', label: 'ROTULADO PANDUIT' },
      { id: 'jumper01', label: 'JUMPER 01 A EQUIPO rCSR' },
      { id: 'jumper02', label: 'JUMPER 02 A EQUIPO rCSR' },
    ],
  },
  nodo: {
    id: 'nodo', title: 'NODO',
    items: [
      { id: 'ingreso',            label: 'INGRESO' },
      { id: 'panoramicaGabinete', label: 'PANORAMICA GABINETE' },
      { id: 'switch',             label: 'SWITCH' },
      { id: 'router',             label: 'ROUTER' },
      { id: 'olt',                label: 'OLT' },
      { id: 'odf01',              label: 'ODF 01' },
      { id: 'odf02',              label: 'ODF 02' },
    ],
  },
  adicionales: {
    id: 'adicionales', title: 'ADICIONALES',
    items: [], dynamic: true,
  },
  medioTramo: {
    id: 'medioTramo', title: 'MEDIO TRAMO',
    items: [
      { id: 'vistaAbajo',    label: 'VISTA DESDE ABAJO' },
      { id: 'vistaCostado',  label: 'VISTA DE COSTADO' },
      { id: 'zoomFerreteria', label: 'ZOOM A LA FERRETERIA' },
    ],
  },
};

const EXTRAS_ITEMS = ['Extra 1', 'Extra 2', 'Extra 3'];

// ============================================================
// HELPERS
// ============================================================

const getFormattedPhotos = (punto) => {
  const fotos = punto.datos && punto.datos.fotos;
  if (!fotos) return [];
  const processed = [];
  Object.values(TABS_CONFIG).forEach(tab => {
    const sectionPhotos = fotos[tab.id];
    if (!sectionPhotos) return;
    tab.items.forEach(item => {
      if (item.items) {
        item.items.forEach(sub => {
          const val = sectionPhotos[sub.id];
          if (val) {
            const url = typeof val === 'string' ? val : val.url;
            if (url) processed.push({ url, label: `${item.title} - ${sub.label}`, section: tab.title });
          }
        });
      } else if (item.type === 'subgallery') {
        Object.entries(sectionPhotos)
          .filter(([k]) => k.startsWith(item.id + '_'))
          .sort(([a], [b]) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
          .forEach(([, val], i) => {
            if (!val) return;
            const url = typeof val === 'string' ? val : val.url;
            if (url) processed.push({ url, label: `${item.label} ${i + 1}`, section: tab.title });
          });
      } else {
        const val = sectionPhotos[item.id];
        if (val) {
          const url = typeof val === 'string' ? val : val.url;
          if (url) processed.push({ url, label: item.label.replace('\n', ' '), section: tab.title });
        }
      }
    });
    EXTRAS_ITEMS.forEach(extraLabel => {
      const val = sectionPhotos[extraLabel];
      if (val) {
        const url = typeof val === 'string' ? val : val.url;
        if (url) processed.push({ url, label: extraLabel, section: tab.title });
      }
    });
    if (tab.dynamic) {
      const processedIds = new Set([
        ...tab.items.flatMap(i => i.items ? i.items.map(s => s.id) : [i.id]),
        ...EXTRAS_ITEMS,
      ]);
      Object.entries(sectionPhotos).forEach(([key, val]) => {
        if (processedIds.has(key) || !val) return;
        const url = typeof val === 'string' ? val : val.url;
        if (url) processed.push({ url, label: key, section: tab.title });
      });
    }
  });
  if (Array.isArray(fotos)) {
    fotos.forEach((f, i) => {
      const url = typeof f === 'string' ? f : (f && f.url);
      if (url) processed.push({ url, label: `Foto ${i + 1}`, section: 'FOTOS' });
    });
  }
  return processed;
};

const runParallel = async (items, processFn, concurrency = 6) => {
  if (items.length === 0) return [];
  const results = new Array(items.length).fill(null);
  let nextIdx = 0;
  const runWorker = async () => {
    while (nextIdx < items.length) {
      const i = nextIdx++;
      try {
        results[i] = await processFn(items[i], i);
      } catch (e) {
        console.error(`Error procesando item ${i}:`, e.message);
        results[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
};

const fetchPhotoBuffer = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching photo`);
  return Buffer.from(await response.arrayBuffer());
};

// ============================================================
// STAMP (Canvas — espejo de helpers.js estamparMetadatos)
// ============================================================

const fitFont = (ctx, texto, anchoMax, fsMax, isBold = false, fsMin = 10) => {
  const weight = isBold ? 'bold ' : '';
  let size = fsMax;
  ctx.font = `${weight}${size}px Arial`;
  if (!texto) return size;
  while (size > fsMin && ctx.measureText(texto).width > anchoMax) {
    size--;
    ctx.font = `${weight}${size}px Arial`;
  }
  return size;
};

const estamparMetadatos = async (imageBuffer, datos, logoBuffer, stampConfig = {}) => {
  const {
    logoPosition = 'right',
    mostrarNroPoste = true,
    mostrarCodFat = false,
    fondoSello = 'white',
  } = stampConfig;

  const img = await loadImage(imageBuffer);
  const w = img.width;
  const h = img.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);

  if (datos) {
    const cajaAlto = h * 0.08;
    const yBase = h - cajaAlto;
    const hPad = Math.max(w * 0.02, 4);
    const vPad = Math.max(cajaAlto * 0.06, 2);

    let clrBold, clrNormal, clrFaint, divClr, usarSombra;
    if (fondoSello === 'black') {
      clrBold = '#FCBF26'; clrNormal = '#FFFFFF'; clrFaint = '#FFFFFF';
      divClr = 'rgba(255,255,255,0.30)'; usarSombra = false;
    } else if (fondoSello === 'glass') {
      clrBold = '#FFFFFF'; clrNormal = '#FFFFFF'; clrFaint = 'rgba(255,255,255,0.85)';
      divClr = 'rgba(255,255,255,0.50)'; usarSombra = true;
    } else {
      clrBold = '#000000'; clrNormal = '#000000'; clrFaint = '#000000';
      divClr = 'rgba(150,150,150,0.60)'; usarSombra = false;
    }

    // Fondo de la barra inferior
    if (fondoSello === 'glass') {
      ctx.fillStyle = 'rgba(0,0,0,0.50)'; // node-canvas no soporta blur filter
      ctx.fillRect(0, yBase, w, cajaAlto);
    } else if (fondoSello === 'black') {
      ctx.fillStyle = 'rgba(0,0,0,0.80)';
      ctx.fillRect(0, yBase, w, cajaAlto);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.90)';
      ctx.fillRect(0, yBase, w, cajaAlto);
    }

    // Divisores verticales
    const xDiv1 = w * 0.25;
    const xDiv2 = w * 0.65;
    ctx.save();
    ctx.strokeStyle = divClr;
    ctx.lineWidth = Math.max(1, w * 0.001);
    ctx.beginPath();
    ctx.moveTo(xDiv1, yBase + vPad); ctx.lineTo(xDiv1, h - vPad);
    ctx.moveTo(xDiv2, yBase + vPad); ctx.lineTo(xDiv2, h - vPad);
    ctx.stroke();
    ctx.restore();

    const fs = Math.round(cajaAlto * 0.25);
    const lineH = fs * 1.1;
    const blockH = fs + lineH;
    const blockStart = yBase + Math.max(vPad, (cajaAlto - blockH) / 2);
    const r1Y = blockStart + fs * 0.5;
    const r2Y = r1Y + lineH;
    ctx.textBaseline = 'middle';

    if (usarSombra) {
      ctx.shadowColor = 'rgba(0,0,0,0.75)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 1;
    }

    // Columna 1 (25% izq): Proyecto / Item+Pasivo
    ctx.textAlign = 'left';
    const c1MaxW = xDiv1 - hPad * 2;
    ctx.fillStyle = clrBold;
    const proyTxt = (datos.proyecto || '').toUpperCase();
    fitFont(ctx, proyTxt, c1MaxW, fs, true);
    ctx.fillText(proyTxt, hPad, r1Y);

    // Sin guion cuando no hay dato; el separador "|" solo si AMBOS existen.
    const nro = String(datos.numero || '').trim();
    const pasivo = String(datos.pasivo || datos.codFat || '').trim();
    let idTxt = '';
    if (mostrarNroPoste && mostrarCodFat) { idTxt = [nro, pasivo].filter(Boolean).join('  |  '); }
    else if (mostrarNroPoste) { idTxt = nro; }
    else if (mostrarCodFat) { idTxt = pasivo; }
    else { idTxt = nro; }
    fitFont(ctx, idTxt, c1MaxW, fs, true);
    ctx.fillText(idTxt, hPad, r2Y);

    // Columna 2 (40% centro): Fecha+Hora / GPS
    ctx.textAlign = 'center';
    ctx.fillStyle = clrNormal;
    const c2x = xDiv1 + (xDiv2 - xDiv1) / 2;
    const c2MaxW = xDiv2 - xDiv1 - hPad * 2;

    let fechaTxt = '';
    try {
      const f = datos.fecha;
      const fechaStr = f
        ? (typeof f === 'string' && f.includes('T') ? new Date(f).toLocaleDateString('es-PE') : String(f))
        : new Date().toLocaleDateString('es-PE');
      fechaTxt = datos.hora ? `${fechaStr}  ${datos.hora}` : fechaStr;
    } catch { fechaTxt = datos.fecha || new Date().toLocaleDateString(); }
    fitFont(ctx, fechaTxt, c2MaxW, fs, false);
    ctx.fillText(fechaTxt, c2x, r1Y);
    fitFont(ctx, datos.gps || '', c2MaxW, fs, false);
    ctx.fillText(datos.gps || '', c2x, r2Y);

    // Columna 3 (35% der): Dirección / Ubicación
    ctx.textAlign = 'right';
    const c3x = w - hPad;
    const c3MaxW = w - xDiv2 - hPad * 2;
    fitFont(ctx, datos.direccion || '', c3MaxW, fs, false);
    ctx.fillText(datos.direccion || '', c3x, r1Y);
    ctx.fillStyle = clrFaint;
    fitFont(ctx, datos.ubicacion || '', c3MaxW, fs, false);
    ctx.fillText(datos.ubicacion || '', c3x, r2Y);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Logo en esquina superior
    if (logoBuffer) {
      try {
        const imgLogo = await loadImage(logoBuffer);
        const logoMaxH = h * 0.156;
        const logoMaxW = w * 0.264;
        const scale = Math.min(logoMaxW / imgLogo.width, logoMaxH / imgLogo.height, 1);
        const anchoL = imgLogo.width * scale;
        const altoL = imgLogo.height * scale;
        const logoPad = Math.max(w * 0.012, 4);
        const xLogo = logoPosition === 'left' ? logoPad : w - anchoL - logoPad;
        ctx.drawImage(imgLogo, xLogo, logoPad, anchoL, altoL);
      } catch (e) { console.error('Error cargando logo:', e.message); }
    }
  }

  return canvas.toBuffer('image/jpeg', 85); // @napi-rs/canvas: quality 1-100
};

// ============================================================
// ZIP BUILDER (fflate STORE mode — sin compresión)
// ============================================================

const buildFflateZip = (files) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const zip = new Zip((err, chunk, final) => {
      if (err) { reject(err); return; }
      chunks.push(Buffer.from(chunk));
      if (final) resolve(Buffer.concat(chunks));
    });
    for (const [name, data] of files) {
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      entry.push(data instanceof Uint8Array ? data : new Uint8Array(data), true);
    }
    zip.end();
  });

// ============================================================
// COLLECT SECTION PHOTOS (helper compartido ZIP/KMZ/Excel)
// ============================================================

const collectSectionPhotos = (p, tabId, useHD = false) => {
  const tab = TABS_CONFIG[tabId];
  const secFotos = (p.datos && p.datos.fotos && !Array.isArray(p.datos.fotos))
    ? (p.datos.fotos[tab.id] || {}) : {};
  const resolveUrl = (val) => {
    if (typeof val === 'string') return val;
    return (useHD && val.urlHD) ? val.urlHD : val.url;
  };
  // Datos de captura por foto (hora real de la foto), si existen
  const cap = (val) => (val && typeof val === 'object')
    ? { fechaCaptura: val.fechaCaptura || null, horaCaptura: val.horaCaptura || null, thumb: (typeof val.thumb === 'string' ? val.thumb : null) }
    : { fechaCaptura: null, horaCaptura: null, thumb: null };
  const items = [];
  tab.items.forEach(tabItem => {
    if (tabItem.items) {
      tabItem.items.forEach(sub => {
        const val = secFotos[sub.id];
        if (val) {
          const url = resolveUrl(val);
          if (url && !url.startsWith('blob:')) items.push({ url, label: sub.label.replace('\n', ' '), ...cap(val) });
        }
      });
    } else if (tabItem.type === 'subgallery') {
      Object.entries(secFotos)
        .filter(([k]) => k.startsWith(tabItem.id + '_'))
        .sort(([a], [b]) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
        .forEach(([, val], i) => {
          if (!val) return;
          const url = resolveUrl(val);
          if (url && !url.startsWith('blob:')) items.push({ url, label: `${tabItem.label} ${i + 1}`, ...cap(val) });
        });
    } else {
      const val = secFotos[tabItem.id];
      if (val) {
        const url = resolveUrl(val);
        if (url && !url.startsWith('blob:')) items.push({ url, label: tabItem.label.replace('\n', ' '), ...cap(val) });
      }
    }
  });
  EXTRAS_ITEMS.forEach(extraLabel => {
    const val = secFotos[extraLabel];
    if (val) {
      const url = resolveUrl(val);
      if (url && !url.startsWith('blob:')) items.push({ url, label: extraLabel, ...cap(val) });
    }
  });
  // Catch-all: tabs dinámicos (adicionales) — keys no cubiertos arriba
  if (tab.dynamic) {
    const processedIds = new Set([
      ...tab.items.flatMap(i => i.items ? i.items.map(s => s.id) : [i.id]),
      ...EXTRAS_ITEMS,
    ]);
    Object.entries(secFotos).forEach(([key, val]) => {
      if (processedIds.has(key) || !val) return;
      const url = resolveUrl(val);
      if (url && !url.startsWith('blob:')) items.push({ url, label: key, ...cap(val) });
    });
  }
  return items;
};

// Construye los datos de estampado de UNA foto: usa la hora de captura de la foto
// si existe, si no cae a la fecha/hora del punto.
const datosFotoEstampado = (datosBase, foto) => ({
  ...datosBase,
  fecha: (foto && foto.fechaCaptura) || datosBase.fecha,
  hora: (foto && foto.horaCaptura) || datosBase.hora,
});

// Recolecta fotos que SOLO tienen miniatura (sin url completo válido en Storage).
// Son fotos de una falla pasada donde la subida no se completó. Se usan para el ZIP sin datos.
// La miniatura puede estar guardada como base64 (data:) o como URL (http).
const collectThumbOnlyPhotos = (p) => {
  const out = [];
  const debug = [];
  const consider = (val, tabTitle, label) => {
    if (!val || typeof val !== 'object') return;
    const url = val.urlHD || val.url;
    const tieneUrlValida = typeof url === 'string' && url && !url.startsWith('blob:');
    if (tieneUrlValida) return; // ya tiene foto completa
    const thumb = val.thumb;
    if (typeof thumb !== 'string' || !thumb) {
      debug.push(`${label}:sin-thumb(keys=${Object.keys(val).join('|')})`);
      return;
    }
    if (thumb.startsWith('data:')) out.push({ tipo: 'base64', thumb, tabTitle, label });
    else if (thumb.startsWith('http')) out.push({ tipo: 'url', thumb, tabTitle, label });
    else debug.push(`${label}:thumb-raro(${thumb.slice(0, 12)})`);
  };
  const fotos = (p.datos && p.datos.fotos && !Array.isArray(p.datos.fotos)) ? p.datos.fotos : {};
  for (const [secId, secObj] of Object.entries(fotos)) {
    if (!secObj || typeof secObj !== 'object') continue;
    const tab = Object.values(TABS_CONFIG).find(t => t.id === secId);
    const tabTitle = tab ? tab.title : secId;
    for (const [itemKey, val] of Object.entries(secObj)) consider(val, tabTitle, itemKey);
  }
  const generales = p.datos && p.datos.fotosGenerales;
  if (Array.isArray(generales)) generales.forEach((f, i) => consider(f, 'GENERALES', `General_${i + 1}`));
  if (out.length > 0 || debug.length > 0) {
    console.log(`[THUMB] punto ${p.id}: encontradas=${out.length} (${out.map(o => o.tipo).join(',')}) descartadas=[${debug.join(' ')}]`);
  }
  return out;
};

// Decodifica una miniatura (base64 data: o URL http) a Buffer. Devuelve null si falla.
const thumbToBuffer = async (thumb) => {
  try {
    if (typeof thumb !== 'string' || !thumb) return null;
    if (thumb.startsWith('data:')) {
      const b64 = thumb.split(',')[1] || '';
      return b64 ? Buffer.from(b64, 'base64') : null;
    }
    if (thumb.startsWith('http')) return await fetchPhotoBuffer(thumb);
    return null;
  } catch (e) {
    console.error('[THUMB] error decodificando miniatura:', e.message);
    return null;
  }
};

// Si la imagen es muy chica (miniatura ~256px), la agranda a ~1080px para que
// el sello salga nítido al imprimirla en un reporte. No recupera detalle, solo escala.
const UPSCALE_THRESHOLD = 300;
const UPSCALE_TARGET = 1080;
const upscaleIfSmall = async (buffer) => {
  try {
    // Atajo: una foto grande pesa mucho más que una miniatura; si pesa >80KB no la
    // decodificamos (evita costo extra en exports grandes). Las miniaturas son chicas.
    if (!buffer || buffer.length > 80000) return buffer;
    const img = await loadImage(buffer);
    const maxSide = Math.max(img.width, img.height);
    if (maxSide >= UPSCALE_THRESHOLD) return buffer; // ya es suficientemente grande
    const scale = UPSCALE_TARGET / maxSide;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toBuffer('image/jpeg', 85);
  } catch (e) {
    console.error('[UPSCALE] error:', e.message);
    return buffer;
  }
};

// Ajusta una imagen a una caja (maxW x maxH) MANTENIENDO su proporción real,
// y centra dentro de la caja. Devuelve { ext, colOffExtra, rowOffExtra } (offsets en EMU).
const EMU_PX = 9525;
const fitImagen = async (buffer, maxW, maxH) => {
  try {
    const img = await loadImage(buffer);
    const s = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * s, h = img.height * s;
    return {
      ext: { width: w, height: h },
      colOffExtra: Math.round(((maxW - w) / 2) * EMU_PX),
      rowOffExtra: Math.round(((maxH - h) / 2) * EMU_PX),
    };
  } catch (e) {
    return { ext: { width: maxW, height: maxH }, colOffExtra: 0, rowOffExtra: 0 };
  }
};

// Procesa UNA foto para exportación: baja la url; si falla, rescata la miniatura;
// si la imagen quedó chica la agranda; estampa (salvo modo "sin datos").
// El objeto `foto` debe traer { url, thumb?, fechaCaptura?, horaCaptura? }.
const procesarFotoExport = async (foto, datosBase, logoBuffer, stampConfig) => {
  let buf = null;
  // fetchPhotoBuffer lanza error si la url está muerta (404). Lo atrapamos para
  // poder caer al rescate de la miniatura.
  if (foto.url) { try { buf = await fetchPhotoBuffer(foto.url); } catch { buf = null; } }
  if (!buf && foto.thumb) { try { buf = await thumbToBuffer(foto.thumb); } catch { buf = null; } }
  if (!buf) return null;
  buf = await upscaleIfSmall(buf);
  if (stampConfig.sinDatos) return buf;
  try {
    return await estamparMetadatos(buf, datosFotoEstampado(datosBase, foto), logoBuffer, stampConfig);
  } catch (e) {
    console.error('[EXPORT] fallo estampado, devuelvo la foto sin sello:', e.message);
    return buf; // que al menos aparezca la imagen
  }
};

const makeDatosEstampado = (p, proy) => {
  const lat = ((p.coords && p.coords.lat) || 0).toFixed(6);
  const lng = ((p.coords && p.coords.lng) || 0).toFixed(6);
  return {
    numero: p.datos && p.datos.numero,
    proyecto: proy.nombre,
    gps: `${lat}, ${lng}`,
    fecha: (p.datos && p.datos.fecha) || new Date().toISOString(),
    hora: (p.datos && p.datos.hora) || '',
    codFat: (p.datos && p.datos.codFat) || '',
    pasivo: (p.datos && p.datos.pasivo) || '',
    direccion: (p.datos && p.datos.direccion) || '',
    ubicacion: (p.datos && p.datos.ubicacion) || '',
  };
};

// ============================================================
// GENERAR ZIP
// ============================================================

const generarZIP = async (proy, puntosProyecto, logoBuffer, limiteFotos, stampConfig) => {
  const VOLUMENES = [];
  let volumenActual = 1;
  let puntosBuffer = [];
  let fotosCountBuffer = 0;

  const cerrarVolumen = async (listaPuntos, numVol) => {
    const nombreCarpetaRaiz = (proy.nombre || 'PROYECTO').replace(/[/\\?*[\]:]/g, '_').trim();
    const allFiles = new Map();
    if (logoBuffer) {
      allFiles.set(`${nombreCarpetaRaiz}/LOGO_EMPRESA.png`, new Uint8Array(logoBuffer));
    }

    const contadoresPuntos = {};

    for (const p of listaPuntos) {
      const numItem = String((p.datos && p.datos.numero) || 'SN');
      const partes = [numItem];
      if (p.datos && p.datos.pasivo) partes.push(p.datos.pasivo);
      if (p.datos && p.datos.tipo) partes.push(p.datos.tipo);
      const nombrePuntoBase = partes.join('-').replace(/[/\\?*[\]:]/g, '_');
      let nombrePunto = nombrePuntoBase;
      if (contadoresPuntos[nombrePuntoBase] !== undefined) {
        contadoresPuntos[nombrePuntoBase]++;
        nombrePunto = `${nombrePuntoBase} (${contadoresPuntos[nombrePuntoBase]})`;
      } else {
        contadoresPuntos[nombrePuntoBase] = 1;
      }

      const carpetaPuntoPath = `${nombreCarpetaRaiz}/${nombrePunto}`;
      const datosEstampado = makeDatosEstampado(p, proy);
      const allZipJobs = [];

      for (const tabId of Object.keys(TABS_CONFIG)) {
        const tab = TABS_CONFIG[tabId];
        const secItems = collectSectionPhotos(p, tabId, true); // useHD=true para ZIP
        for (const item of secItems) {
          const cleanLabel = item.label.replace(/[/\\?*[\]:]/g, '_').substring(0, 50);
          allZipJobs.push({ url: item.url, thumb: item.thumb || null, path: `${carpetaPuntoPath}/${tab.title}/${cleanLabel}.jpg`, miniPath: `${carpetaPuntoPath}/${tab.title}/MINIATURA_${cleanLabel}.jpg`, fechaCaptura: item.fechaCaptura, horaCaptura: item.horaCaptura });
        }
      }

      const fotosGen = p.datos && p.datos.fotosGenerales;
      if (Array.isArray(fotosGen)) {
        fotosGen.forEach((f, i) => {
          const url = typeof f === 'string' ? f : (f && (f.urlHD || f.url));
          if (url && !url.startsWith('blob:')) {
            const thumb = (f && typeof f === 'object' && typeof f.thumb === 'string') ? f.thumb : null;
            allZipJobs.push({ url, thumb, path: `${carpetaPuntoPath}/GENERALES/General_${i + 1}.jpg`, miniPath: `${carpetaPuntoPath}/GENERALES/MINIATURA_General_${i + 1}.jpg`, fechaCaptura: f && f.fechaCaptura, horaCaptura: f && f.horaCaptura });
          }
        });
      }

      const zipBuffers = await runParallel(allZipJobs, async (job) =>
        procesarFotoExport(job, datosEstampado, logoBuffer, stampConfig));

      for (let k = 0; k < allZipJobs.length; k++) {
        if (!zipBuffers[k]) continue;
        allFiles.set(allZipJobs[k].path, new Uint8Array(zipBuffers[k]));
      }

      // Solo en modo SIN DATOS: incluir las miniaturas de fotos que quedaron sin subir (solo thumb)
      if (stampConfig.sinDatos) {
        const thumbs = collectThumbOnlyPhotos(p);
        const contThumb = {};
        for (const t of thumbs) {
          const cleanLabel = t.label.replace(/[/\\?*[\]:]/g, '_').substring(0, 50);
          let buf = null;
          try {
            if (t.tipo === 'base64') {
              const base64 = (t.thumb.split(',')[1] || '');
              if (base64) buf = Buffer.from(base64, 'base64');
            } else if (t.tipo === 'url') {
              buf = await fetchPhotoBuffer(t.thumb);
            }
          } catch (e) { console.error('[THUMB] error decodificando miniatura:', e.message); }
          if (!buf) continue;
          let nombre = `MINIATURA_${cleanLabel}.jpg`;
          const key = `${t.tabTitle}/${nombre}`;
          if (contThumb[key] !== undefined) { contThumb[key]++; nombre = `MINIATURA_${cleanLabel} (${contThumb[key]}).jpg`; }
          else contThumb[key] = 1;
          allFiles.set(`${carpetaPuntoPath}/${t.tabTitle}/${nombre}`, new Uint8Array(buf));
        }
      }
    }

    const zipBuffer = await buildFflateZip(allFiles);
    const nombreBase = (proy.nombre || 'PROYECTO').replace(/\s+/g, '_').toUpperCase();
    const nombre = (VOLUMENES.length === 0 && listaPuntos.length === puntosProyecto.length)
      ? `${nombreBase}.zip` : `${nombreBase}_VOL${numVol}.zip`;
    return { nombre, buffer: zipBuffer, numPuntos: listaPuntos.length, contentType: 'application/zip' };
  };

  const puntosOrdenados = ordenarPorPosicion(puntosProyecto);
  for (const p of puntosOrdenados) {
    const fotosPunto = getFormattedPhotos(p).length;
    const pesoLogico = Math.max(fotosPunto, 1);
    if (fotosCountBuffer + pesoLogico > limiteFotos && puntosBuffer.length > 0) {
      VOLUMENES.push(await cerrarVolumen(puntosBuffer, volumenActual));
      volumenActual++; puntosBuffer = []; fotosCountBuffer = 0;
    }
    puntosBuffer.push(p);
    fotosCountBuffer += pesoLogico;
  }
  if (puntosBuffer.length > 0) VOLUMENES.push(await cerrarVolumen(puntosBuffer, volumenActual));
  return VOLUMENES;
};

// ============================================================
// GENERAR KMZ
// ============================================================

const generarKMZ = async (proy, puntosProyecto, conexiones, todosPuntos, logoBuffer, limiteFotos, stampConfig, cablesAcero = [], catalogo = []) => {
  const VOLUMENES = [];
  let volumenActual = 1;
  let puntosBuffer = [];
  let fotosCountBuffer = 0;

  // Colores por capacidad de fibra (hex → KML AABBGGRR)
  // Escapa texto que va dentro de una etiqueta XML/KML. El nombre del ramal lo
// escribe el usuario y un solo & dejaría el KMZ ilegible para Google Earth.
const escXml = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const KML_COLORES = { 6:'fff65c8b', 12:'fff6823b', 24:'ff9948ec', 48:'ff1673f9', 96:'ff4444ef', 144:'ff16cc84' };
  const capsUnicas = [...new Set(conexiones.map(c => c.capacidad).filter(Boolean))];
  const estilosLineas = [
    ...capsUnicas.map(cap => `  <Style id="linea_${cap}"><LineStyle><color>${KML_COLORES[cap] || 'fff6823b'}</color><width>3</width></LineStyle></Style>`),
    `  <Style id="linea_default"><LineStyle><color>fff6823b</color><width>3</width></LineStyle></Style>`
  ].join('\n');
  console.log(`KMZ: ${conexiones.length} conexiones, capacidades: [${capsUnicas.join(',')}], puntos proyecto: ${puntosProyecto.length}`);

  const cerrarVolumen = async (listaPuntos, numVol) => {
    const kmzFiles = new Map();

    let kmlHead = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>${(proy.nombre || '').replace(/[<>&"]/g, '_')} (VOL ${numVol})</name>
  <Style id="posteStyle"><IconStyle><color>ffff0000</color><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><color>ffffff00</color><scale>0.8</scale></LabelStyle><BalloonStyle><text>$[description]</text></BalloonStyle></Style>
${estilosLineas}
  <Folder><name>Puntos</name>`;
    let kmlBody = '';

    const EVA_URL = 'https://www.evadigitalgroup.com/index.html';
    const evaPageHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EVA Digital</title><style>body{font-family:Arial,sans-serif;padding:30px;background:#f5f5f5;color:#333;margin:0;font-size:14px;line-height:1.7}</style></head><body><p>Copia el siguiente link y conoce a EVA DIGITAL, empresa especialista en el diseño, implementacion y documentacion de redes de fibra optica: <a href="${EVA_URL}">${EVA_URL}</a></p></body></html>`;
    kmzFiles.set('files/eva.html', Buffer.from(evaPageHtml));

    for (let ptIdx = 0; ptIdx < listaPuntos.length; ptIdx++) {
      const p = listaPuntos[ptIdx];
      const uid = ptIdx;
      const fotos = (p.datos && p.datos.fotos) || {};

      const sections = [];
      let photoIdx = 0;
      const capOf = (v) => (v && typeof v === 'object') ? { fechaCaptura: v.fechaCaptura || null, horaCaptura: v.horaCaptura || null, thumb: (typeof v.thumb === 'string' ? v.thumb : null) } : { fechaCaptura: null, horaCaptura: null, thumb: null };

      for (const tab of Object.values(TABS_CONFIG)) {
        const sectionPhotos = fotos[tab.id] || {};
        const secItems = [];
        for (const item of tab.items) {
          if (item.items) {
            for (const sub of item.items) {
              const val = sectionPhotos[sub.id];
              const rawUrl = val ? (typeof val === 'string' ? val : val.url) : null;
              const url = (rawUrl && !rawUrl.startsWith('blob:')) ? rawUrl : null;
              secItems.push({ url, label: `${item.title} - ${sub.label}`, fileIdx: url ? photoIdx++ : null, ...capOf(val) });
            }
          } else {
            const val = sectionPhotos[item.id];
            const rawUrl = val ? (typeof val === 'string' ? val : val.url) : null;
            const url = (rawUrl && !rawUrl.startsWith('blob:')) ? rawUrl : null;
            secItems.push({ url, label: item.label.replace('\n', ' '), fileIdx: url ? photoIdx++ : null, ...capOf(val) });
          }
        }
        EXTRAS_ITEMS.forEach(extraLabel => {
          const val = sectionPhotos[extraLabel];
          const rawUrl = val ? (typeof val === 'string' ? val : val.url) : null;
          const url = (rawUrl && !rawUrl.startsWith('blob:')) ? rawUrl : null;
          secItems.push({ url, label: extraLabel, fileIdx: url ? photoIdx++ : null, ...capOf(val) });
        });
        // Catch-all: fotos dinámicas (adicionales) o con keys no cubiertos arriba
        const processedIds = new Set([
          ...tab.items.flatMap(item => item.items ? item.items.map(s => s.id) : [item.id]),
          ...EXTRAS_ITEMS
        ]);
        Object.entries(sectionPhotos).forEach(([key, val]) => {
          if (processedIds.has(key) || !val) return;
          const url = typeof val === 'string' ? val : val.url;
          if (url && !url.startsWith('blob:')) secItems.push({ url, label: key, fileIdx: photoIdx++, ...capOf(val) });
        });
        if (secItems.length > 0) sections.push({ title: tab.title, photos: secItems });
      }

      if (Array.isArray(fotos)) {
        const legItems = [];
        fotos.forEach((f, i) => {
          const url = typeof f === 'string' ? f : (f && f.url);
          if (url && !url.startsWith('blob:')) legItems.push({ url, label: `Foto ${i + 1}`, fileIdx: photoIdx++, ...capOf(f) });
        });
        if (legItems.length > 0) sections.push({ title: 'FOTOS', photos: legItems });
      }

      const allKmzPhotos = sections.flatMap(sec => sec.photos.filter(ph => ph.url));
      const kmzDatosEstampado = makeDatosEstampado(p, proy);

      const kmzBuffers = await runParallel(allKmzPhotos, async (photo) =>
        procesarFotoExport(photo, kmzDatosEstampado, logoBuffer, stampConfig));

      for (let k = 0; k < allKmzPhotos.length; k++) {
        if (!kmzBuffers[k]) { allKmzPhotos[k].fileName = null; continue; }
        const fileName = `pt${uid}_${allKmzPhotos[k].fileIdx}.jpg`;
        kmzFiles.set(`files/${fileName}`, new Uint8Array(kmzBuffers[k]));
        allKmzPhotos[k].fileName = fileName;
      }

      const firstPhoto = sections.flatMap(s => s.photos).find(ph => ph.fileName);

      // Solo secciones que tienen al menos una foto real
      const sectionsConFotos = sections.filter(sec => sec.photos.some(ph => ph.fileName));
      const hasAnyPhoto = sectionsConFotos.length > 0;

      let selectorHtml = '';
      if (sectionsConFotos.length > 0) {
        sectionsConFotos.forEach((sec, sIdx) => {
          const openAttr = '';
          const secId = `kp${uid}_sec${sIdx}`;
          const photosCount = sec.photos.filter(ph => ph.fileName).length;
          // OPTIMIZACIÓN: solo se listan las fotos QUE EXISTEN. Los casilleros vacíos ya
          // no generan HTML (antes iban como filas grises: ~50% del peso del globo). El
          // contador del encabezado (ej. 2/11) sigue avisando cuántas faltan.
          const itemsHtml = sec.photos.filter(ph => ph.fileName).map(photo => {
            const labelUp = photo.label.toUpperCase();
            const escHtml = labelUp.replace(/"/g, '&quot;');
            const escJs = labelUp.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `<div onclick="var e=document.getElementById('kp${uid}_ph');var l=document.getElementById('kp${uid}_lbl');if(e)e.src='files/${photo.fileName}';if(l)l.innerText='${escJs}';" style="padding:4px 8px;cursor:pointer;border-bottom:1px solid #eee;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml}" onmouseover="this.style.background='#fff3e0'" onmouseout="this.style.background=''">${labelUp}</div>`;
          }).join('');
          const accordionJs = `var all=document.getElementById('kp${uid}_sel').querySelectorAll('details');for(var i=0;i<all.length;i++){if(all[i].id!=='${secId}')all[i].removeAttribute('open');}`;
          const hasPhotos = photosCount > 0;
          const summBg = hasPhotos ? '#e0e0e0' : '#f5f5f5';
          const summBgHover = hasPhotos ? '#d0d0d0' : '#ebebeb';
          const summColor = hasPhotos ? '#333' : '#bbb';
          selectorHtml += `<details id="${secId}"${openAttr} style="font-size:11px;"><summary onclick="${accordionJs}" style="padding:5px 8px;background:${summBg};color:${summColor};cursor:pointer;font-weight:bold;user-select:none;list-style:none;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block;" onmouseover="this.style.background='${summBgHover}'" onmouseout="this.style.background='${summBg}'">${sec.title} <span style="color:${photosCount > 0 ? '#4caf50' : '#f44336'};font-weight:normal;">(${photosCount}/${sec.photos.length})</span></summary>${itemsHtml}</details>`;
        });
      } else {
        selectorHtml = `<div style="padding:12px;color:#aaa;font-size:11px;text-align:center;">Sin fotos</div>`;
      }

      const firstLabelUp = firstPhoto ? firstPhoto.label.toUpperCase() : '';

      const d = p.datos || {};
      const htmlPopup = !hasAnyPhoto
        ? `<div style="font-family:Arial,sans-serif;width:360px;background:#fff;color:#333;">
  <div style="background:#100F1D;padding:8px 12px;">
    <div style="color:#FCBF26;font-weight:900;font-size:14px;">${(proy.nombre || '').toUpperCase()}</div>
    <div style="font-size:11px;color:#ccc;">ITEM <b style="color:#fff;">${d.numero || 'S/N'}</b>&nbsp;&nbsp;PASIVO <b style="color:#fff;">${d.pasivo || '-'}</b></div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:11px;">
    <tr><td style="padding:4px 8px;color:#888;border-bottom:1px solid #eee;width:40%;">Dirección</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${d.direccion || '-'}</td></tr>
    <tr><td style="padding:4px 8px;color:#888;border-bottom:1px solid #eee;">GPS</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${lat}, ${lng}</td></tr>
    <tr><td style="padding:4px 8px;color:#888;border-bottom:1px solid #eee;">Armado</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${d.armado || '-'}</td></tr>
    <tr><td style="padding:4px 8px;color:#888;border-bottom:1px solid #eee;">Material</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${d.material || '-'}</td></tr>
    <tr><td style="padding:4px 8px;color:#888;border-bottom:1px solid #eee;">Red</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${d.red || '-'}</td></tr>
    <tr><td style="padding:4px 8px;color:#888;border-bottom:1px solid #eee;">Altura</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${d.altura || '-'}</td></tr>
    <tr><td style="padding:4px 8px;color:#888;border-bottom:1px solid #eee;">Fuerza</td><td style="padding:4px 8px;border-bottom:1px solid #eee;">${d.fuerza || '-'}</td></tr>
    <tr><td style="padding:4px 8px;color:#888;">Cables</td><td style="padding:4px 8px;">${d.cables || '-'}</td></tr>
  </table>
  <div style="padding:5px 8px;font-size:8px;color:#aaa;border-top:1px solid #eee;">KMZ generado por KIPO - App de <a href="https://kipo-d29af.web.app/eva.html" style="color:#aaa;text-decoration:underline;">EVA DIGITAL</a></div>
</div>`
        : `<div style="font-family:Segoe UI,Arial,sans-serif;width:570px;background:#fff;color:#333;border-radius:0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.2);">
  <div style="background:#100F1D;padding:8px 12px;">
    <table style="width:100%;border-collapse:collapse;table-layout:auto;">
      <tr>
        <td style="vertical-align:middle;padding:0;">
          <div style="color:#FCBF26;font-weight:900;font-size:14px;margin-bottom:3px;">${(proy.nombre || '').toUpperCase()}</div>
          <div style="font-size:11px;color:#ccc;"><span style="margin-right:16px;"><span style="color:#888;">ITEM</span>&nbsp;<b style="color:#fff;">${(p.datos && p.datos.numero) || 'S/N'}</b></span><span><span style="color:#888;">PASIVO</span>&nbsp;<b style="color:#fff;">${(p.datos && p.datos.pasivo) || '-'}</b></span></div>
        </td>
        <td style="vertical-align:middle;text-align:right;font-size:9px;color:#fff;padding:0 0 0 12px;white-space:nowrap;width:1%;">${(p.datos && p.datos.direccion) ? '<div>' + p.datos.direccion + '</div>' : ''}${(p.datos && p.datos.ubicacion) ? '<div>' + p.datos.ubicacion + '</div>' : ''}<div>${lat}, ${lng}</div></td>
      </tr>
    </table>
  </div>
  <div style="padding:6px 10px;border-bottom:2px solid #eee;font-size:11px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Armado</span><b>${(p.datos && p.datos.armado) || '-'}</b></td>
      <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Material</span><b>${(p.datos && p.datos.material) || '-'}</b></td>
      <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Red</span><b>${(p.datos && p.datos.red) || '-'}</b></td>
      <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Altura</span><b>${(p.datos && p.datos.altura) || '-'}</b></td>
      <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Fuerza</span><b>${(p.datos && p.datos.fuerza) || '-'}</b></td>
      <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Cables</span><b>${(p.datos && p.datos.cables) || '-'}</b></td>
    </tr></table>
  </div>
  <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
    <tr>
      <td style="width:200px;height:570px;vertical-align:top;border-right:1px solid #ddd;background:#fafafa;overflow:hidden;">
        <div style="position:relative;height:100%;">
          <div id="kp${uid}_sel" style="padding-bottom:32px;">${selectorHtml}</div>
          <div style="position:absolute;bottom:0;left:0;right:0;padding:5px 8px;border-top:1px solid #eee;font-size:8px;color:#aaa;line-height:1.4;background:#fafafa;">KMZ generado por KIPO - App de <a href="https://kipo-d29af.web.app/eva.html" style="color:#aaa;text-decoration:underline;">EVA DIGITAL</a></div>
        </div>
      </td>
      <td style="width:370px;height:570px;vertical-align:top;text-align:center;padding:0;background:#f5f5f5;overflow:hidden;">
        <table style="width:100%;height:100%;border-collapse:collapse;"><tr style="height:100%;"><td style="text-align:center;vertical-align:middle;padding:8px;"><img id="kp${uid}_ph" src="files/${firstPhoto.fileName}" style="max-width:354px;max-height:600px;width:auto;height:auto;display:block;margin:0 auto;border-radius:4px;"/></td></tr><tr><td style="padding:0;"><div id="kp${uid}_lbl" style="display:block;width:100%;font-size:12px;color:#fff;font-weight:bold;background:#100F1D;padding:7px 8px;text-align:center;">${firstLabelUp}</div></td></tr></table>
      </td>
    </tr>
  </table>
</div>`;

      kmlBody += `
          <Placemark>
            <name>${(p.datos && p.datos.numero) || 'S/N'}${(p.datos && p.datos.pasivo) ? '-' + p.datos.pasivo : ''}</name>
            <Snippet maxLines="0"/>
            <styleUrl>#posteStyle</styleUrl>
            <description><![CDATA[${htmlPopup}]]></description>
            <Point><coordinates>${lng},${lat},0</coordinates></Point>
          </Placemark>`;
    }

    let kmlLines = '';
    if (numVol === 1) {
      kmlLines += `</Folder><Folder><name>Líneas</name>`;
      conexiones.forEach(c => {
        // La fibra nueva trae su propia geometría. Las viejas solo guardan ids de
        // poste y su forma se sigue deduciendo de dónde estén esos postes.
        const coords = (Array.isArray(c.vertices) && c.vertices.length >= 2)
          ? c.vertices
              .filter(v => v && v.lat != null && v.lng != null)
              .map(v => `${(v.lng || 0).toFixed(6)},${(v.lat || 0).toFixed(6)},0`)
          : ((Array.isArray(c.puntos) && c.puntos.length >= 2) ? c.puntos : [c.from, c.to].filter(Boolean))
              .map(id => todosPuntos.find(p => String(p.id) === String(id)))
              .filter(p => p && p.coords)
              .map(p => `${(p.coords.lng || 0).toFixed(6)},${(p.coords.lat || 0).toFixed(6)},0`);
        if (coords.length < 2) return;
        const cap = c.capacidad;
        const styleId = (cap && KML_COLORES[cap]) ? `linea_${cap}` : 'linea_default';
        // El nombre lo escribe el usuario: hay que escaparlo o un & rompe el KML entero.
        const nombre = c.nombre
          ? `${escXml(c.nombre)}${cap ? ` · ${cap} hilos` : ''}`
          : (cap ? `${cap} hilos` : 'Línea de fibra');
        kmlLines += `<Placemark><name>${nombre}</name><styleUrl>#${styleId}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${coords.join(' ')}</coordinates></LineString></Placemark>`;
      });
      // Cables de acero en su carpeta: gris acero, con el tipo y los metros a liquidar
      const lineasAcero = cablesAcero.map(c => {
        const [a, b] = (c.puntos || []).map(id => todosPuntos.find(p => String(p.id) === String(id)));
        if (a?.coords?.lat == null || b?.coords?.lat == null) return '';
        const tipo = escXml((catalogo.find(f => f.id === c.ferrId) || {}).nombre || 'Cable de acero');
        const coords = [a, b].map(p => `${p.coords.lng.toFixed(6)},${p.coords.lat.toFixed(6)},0`).join(' ');
        return `<Placemark><name>${tipo} · ${metrosCableAcero(a.coords, b.coords)} m</name><Style><LineStyle><color>ffb8a394</color><width>2</width></LineStyle></Style><LineString><tessellate>1</tessellate><coordinates>${coords}</coordinates></LineString></Placemark>`;
      }).join('');
      if (lineasAcero) kmlLines += `</Folder><Folder><name>Cables de acero</name>${lineasAcero}`;
    }

    const kmlFinal = `${kmlHead}${kmlBody}${kmlLines}</Folder></Document></kml>`;
    kmzFiles.set('doc.kml', Buffer.from(kmlFinal, 'utf8'));

    const kmzBuffer = await buildFflateZip(kmzFiles);
    const nombreBase = (proy.nombre || 'PROYECTO').replace(/\s+/g, '_').toUpperCase();
    const nombre = (VOLUMENES.length === 0 && listaPuntos.length === puntosProyecto.length)
      ? `${nombreBase}.kmz` : `${nombreBase}_VOL${numVol}.kmz`;
    return { nombre, buffer: kmzBuffer, numPuntos: listaPuntos.length, contentType: 'application/vnd.google-earth.kmz' };
  };

  const puntosOrdenados = ordenarPorPosicion(puntosProyecto);
  for (const p of puntosOrdenados) {
    const fotosPunto = getFormattedPhotos(p).length;
    const pesoLogico = Math.max(fotosPunto, 1);
    if (fotosCountBuffer + pesoLogico > limiteFotos && puntosBuffer.length > 0) {
      VOLUMENES.push(await cerrarVolumen(puntosBuffer, volumenActual));
      volumenActual++; puntosBuffer = []; fotosCountBuffer = 0;
    }
    puntosBuffer.push(p);
    fotosCountBuffer += pesoLogico;
  }
  if (puntosBuffer.length > 0) VOLUMENES.push(await cerrarVolumen(puntosBuffer, volumenActual));
  return VOLUMENES;
};

// ============================================================
// GENERAR EXCEL
// ============================================================

// ─── ASIGNACIÓN DE RAMAL A CADA POSTE ────────────────────────────────────────
// Espejo de la matemática de src/utils/fibraUtils.js. Está duplicada a propósito:
// cliente y servidor son paquetes separados y no comparten módulos. Si se cambia
// una, hay que cambiar la otra.

const distMetros = (a, b) => {
  const R = 111320;
  const dLat = (b.lat - a.lat) * R;
  const dLng = (b.lng - a.lng) * R * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

// Perpendicular de un punto sobre un tramo. null si el pie cae fuera del tramo:
// ahí el punto más cercano es un vértice, que se mide aparte.
const proyEnSegmento = (p, a, b) => {
  const mLat = 111320;
  const mLng = 111320 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180);
  const bx = (b.lng - a.lng) * mLng, by = (b.lat - a.lat) * mLat;
  const px = (p.lng - a.lng) * mLng, py = (p.lat - a.lat) * mLat;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return null;
  const t = (px * bx + py * by) / len2;
  if (t < 0 || t > 1) return null;
  const qx = bx * t, qy = by * t;
  return Math.sqrt((px - qx) * (px - qx) + (py - qy) * (py - qy));
};

const distAPolilinea = (p, vs) => {
  let min = Infinity;
  for (const v of vs) min = Math.min(min, distMetros(p, v));
  for (let i = 0; i < vs.length - 1; i++) {
    const d = proyEnSegmento(p, vs[i], vs[i + 1]);
    if (d != null) min = Math.min(min, d);
  }
  return min;
};

const largoDeFibra = (vs) => {
  let t = 0;
  for (let i = 0; i < vs.length - 1; i++) t += distMetros(vs[i], vs[i + 1]);
  return t;
};

// ─── CABLE DE ACERO ──────────────────────────────────────────────────────────
// Espejo de src/utils/cablesAcero.js, duplicado a propósito por lo mismo que lo de
// arriba. Se liquida la distancia entre sus dos postes + 1 m, al metro superior (al
// centímetro antes de subir, para que la coma flotante no sume un metro).
const metrosCableAcero = (a, b) => Math.ceil(Math.round((distMetros(a, b) + 1) * 100) / 100);

// Los metros de cada cable van en el poste que va DESPUÉS de sus dos en el orden
// dado, así cuenta una sola vez aunque sus postes caigan en volúmenes distintos.
// Un cable con un poste fuera de la lista no entra. { puntoId: { ferrId: metros } }
const metrosAceroPorPoste = (cables, puntosEnOrden) => {
  const posicion = new Map(puntosEnOrden.map((p, i) => [String(p.id), i]));
  const porId = new Map(puntosEnOrden.map(p => [String(p.id), p]));
  const resultado = {};
  (cables || []).forEach(c => {
    const [a, b] = (c.puntos || []).map(id => porId.get(String(id)));
    if (!c.ferrId || a?.coords?.lat == null || b?.coords?.lat == null) return;
    const destino = String(posicion.get(String(a.id)) > posicion.get(String(b.id)) ? a.id : b.id);
    const t = resultado[destino] || (resultado[destino] = {});
    t[c.ferrId] = (t[c.ferrId] || 0) + metrosCableAcero(a.coords, b.coords);
  });
  return resultado;
};

// Ítems del catálogo que son cable de acero (espejo de TIPOS_CABLE_ACERO). No son
// ferretería del poste: lo que se haya contado por poste no suma, solo valen los metros
// de los cables trazados.
const IDS_CABLE_ACERO = new Set(['b13', 'b38']);
const sinCableAcero = (totales) => Object.fromEntries(Object.entries(totales).filter(([id]) => !IDS_CABLE_ACERO.has(String(id))));

// Del nombre del catálogo, para el croquis, solo la MEDIDA: "MENSAJERO 3/16" → "3/16".
// Si el nombre no trae fracción se le quitan las palabras del tipo y queda lo que
// distinga a ese cable, para que uno nuevo no salga rotulado "CABLE DE ACERO".
const medidaAcero = (nombre) => {
  const n = String(nombre || "").trim();
  const frac = n.match(/\d+\s*\/\s*\d+/);
  if (frac) return frac[0].replace(/\s+/g, "");
  const limpio = n.replace(/cable\s+de\s+acero/ig, "").replace(/mensajero/ig, "").replace(/\s+/g, " ").trim();
  return limpio || n;
};

// Croquis esquemático de un ramal: su recorrido y sus postes en negro, el resto
// de la red del proyecto al fondo en gris, y una cuadrícula UTM de referencia.
// Se dibuja al tamaño exacto del recuadro de Excel (por dos, para que no se vea
// pixelado) y así la imagen no se deforma al insertarla.
//
// El encuadre lo manda SOLO el ramal de la hoja: la red de fondo se recorta
// contra el marco. Si el encuadre abarcara todo el proyecto, el ramal quedaría
// reducido a una rayita en una esquina.
const croquisRamal = (vertices, postes, anchoPx, altoPx, otrasFibras = [], otrosPostes = [], tramosAcero = []) => {
  const ESC = 2;
  const W = Math.max(240, Math.round(Number(anchoPx)) || 0) * ESC;
  const H = Math.max(140, Math.round(Number(altoPx)) || 0) * ESC;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  // El marco va dentro de la imagen: las líneas de celda del borde superior e
  // izquierdo las tapa la propia imagen al quedar pegada a la esquina.
  const marco = () => {
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 1 * ESC;
    ctx.strokeRect(ESC / 2, ESC / 2, W - ESC, H - ESC);
  };
  marco();

  const vs = (vertices || []).filter(v => v && v.lat != null);
  const ps = (postes || []).filter(p => p.coords && p.coords.lat != null);
  const geo = [...vs, ...ps.map(p => p.coords)];
  if (geo.length === 0) return canvas.toBuffer('image/png');

  // Proyección plana local: a escala de cientos de metros el error es inapreciable.
  // El eje Y va invertido (norte arriba) porque la latitud crece hacia el norte.
  const latRef = geo.reduce((s, v) => s + v.lat, 0) / geo.length;
  const kx = Math.cos(latRef * Math.PI / 180);
  const px = (v) => ({ x: v.lng * kx, y: -v.lat });
  const pts = geo.map(px);
  const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const MARGEN = 22 * ESC;
  const anchoGeo = maxX - minX, altoGeo = maxY - minY;
  // Si todo cae en el mismo sitio no hay nada que escalar: se centra y ya
  let k = 1;
  if (anchoGeo > 1e-9 || altoGeo > 1e-9) {
    k = Math.min(
      anchoGeo > 1e-9 ? (W - 2 * MARGEN) / anchoGeo : Infinity,
      altoGeo > 1e-9 ? (H - 2 * MARGEN) / altoGeo : Infinity,
    );
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const aLienzo = (v) => {
    const p = px(v);
    return { x: W / 2 + (p.x - cx) * k, y: H / 2 + (p.y - cy) * k };
  };

  // ── Cuadrícula UTM ───────────────────────────────────────────────────────
  // Referencia para ubicar el ramal en campo. Las líneas se trazan rectas: a
  // esta escala la convergencia de meridianos es de décimas de grado y no se
  // aprecia. El paso se elige para que quepan pocas líneas y no ensucien.
  const mPorPx = 111320 / k;
  if (isFinite(mPorPx) && mPorPx > 0) {
    const centro = { lat: -(cy), lng: cx / kx };
    const utm0 = wgs84ToUtm(centro.lat, centro.lng);
    const anchoM = W * mPorPx;
    const paso = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000]
      .find(p => anchoM / p <= 6) || 10000;
    const aE = (x) => utm0.x + (x - W / 2) * mPorPx;
    const aN = (y) => utm0.y - (y - H / 2) * mPorPx;
    const xDeE = (E) => W / 2 + (E - utm0.x) / mPorPx;
    const yDeN = (N) => H / 2 - (N - utm0.y) / mPorPx;

    ctx.save();
    ctx.strokeStyle = '#E4E4E4';
    ctx.lineWidth = 1 * ESC;
    ctx.setLineDash([4 * ESC, 4 * ESC]);
    ctx.fillStyle = '#9A9A9A';
    ctx.font = `${6.5 * ESC}px Arial`;

    for (let E = Math.ceil(aE(0) / paso) * paso; E <= aE(W); E += paso) {
      const x = xDeE(E);
      ctx.beginPath(); ctx.moveTo(x, ESC); ctx.lineTo(x, H - ESC); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(Math.round(E)), x, 3 * ESC);
    }
    for (let N = Math.ceil(aN(H) / paso) * paso; N <= aN(0); N += paso) {
      const y = yDeN(N);
      ctx.beginPath(); ctx.moveTo(ESC, y); ctx.lineTo(W - ESC, y); ctx.stroke();
      ctx.save();
      ctx.translate(4 * ESC, y);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(String(Math.round(N)), 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Zona UTM: sin ella los números de la cuadrícula no ubican nada
    ctx.fillStyle = '#9A9A9A';
    ctx.font = `${6.5 * ESC}px Arial`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`UTM ${utm0.zona}${utm0.hemisferio} · WGS84`, W - 5 * ESC, H - 4 * ESC);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Resto de la red, al fondo ────────────────────────────────────────────
  ctx.strokeStyle = '#D2D2D2';
  ctx.lineWidth = 2 * ESC;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const otra of otrasFibras || []) {
    const ov = (otra || []).filter(v => v && v.lat != null);
    if (ov.length < 2) continue;
    ctx.beginPath();
    ov.forEach((v, i) => { const q = aLienzo(v); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    ctx.stroke();
  }
  ctx.fillStyle = '#C8C8C8';
  for (const c of otrosPostes || []) {
    if (!c || c.lat == null) continue;
    const q = aLienzo(c);
    ctx.beginPath();
    ctx.arc(q.x, q.y, 2 * ESC, 0, Math.PI * 2);
    ctx.fill();
  }

  // Recorrido de la fibra
  if (vs.length >= 2) {
    ctx.strokeStyle = '#1F4E78';
    ctx.lineWidth = 3 * ESC;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    vs.forEach((v, i) => { const q = aLienzo(v); if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
    ctx.stroke();
  }

  // Cable de acero (mensajero): rojo y la MITAD de grueso que la fibra, para que se
  // distinga sin competir con ella. Va encima de la fibra justamente por ser más fino.
  const acero = (tramosAcero || []).filter(t => t && t.a && t.b && t.a.lat != null && t.b.lat != null);
  if (acero.length) {
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.5 * ESC;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const t of acero) {
      const qa = aLienzo(t.a), qb = aLienzo(t.b);
      ctx.beginPath();
      ctx.moveTo(qa.x, qa.y);
      ctx.lineTo(qb.x, qb.y);
      ctx.stroke();
    }
  }

  // Postes: puntos pequeños con reborde blanco para que no se peguen entre sí.
  // Se guarda su sitio como obstáculo para que las etiquetas los esquiven.
  const ocupados = [];
  const libre = (r) => !ocupados.some(o => r.x1 < o.x2 && r.x2 > o.x1 && r.y1 < o.y2 && r.y2 > o.y1);
  const RADIO = 3.2 * ESC;
  const enLienzo = ps.map(p => ({ ...p, q: aLienzo(p.coords) }));
  for (const p of enLienzo) {
    ctx.beginPath();
    ctx.arc(p.q.x, p.q.y, RADIO, 0, Math.PI * 2);
    // Rojo si sostiene cable de acero: sus dos postes y el medio tramo donde se apoyan
    // las fibras. Naranja el resto de medios tramos, negro los demás.
    ctx.fillStyle = p.acero ? '#DC2626' : (p.medio ? '#FF6600' : '#1A1A1A');
    ctx.fill();
    ctx.lineWidth = 1.2 * ESC;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ocupados.push({ x1: p.q.x - RADIO, y1: p.q.y - RADIO, x2: p.q.x + RADIO, y2: p.q.y + RADIO });
  }

  // Etiquetas de poste. Se prueban cuatro posiciones alrededor del punto y se
  // toma la primera que no pise nada; si ninguna cabe, ese poste va sin rótulo.
  // Así en tramos apretados se pierden rótulos pero nunca quedan ilegibles.
  const ALTO_TXT = 8 * ESC;
  const SEP = 5 * ESC;
  ctx.font = `bold ${7 * ESC}px Arial`;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const p of enLienzo) {
    const txt = String(p.etiqueta || '').trim();
    if (!txt) continue;
    const w = ctx.measureText(txt).width;
    const sitios = [
      { x: p.q.x + SEP, y: p.q.y - SEP, al: 'left' },
      { x: p.q.x - SEP - w, y: p.q.y - SEP, al: 'left' },
      { x: p.q.x + SEP, y: p.q.y + SEP, al: 'left' },
      { x: p.q.x - SEP - w, y: p.q.y + SEP, al: 'left' },
    ];
    const sitio = sitios.find(s => {
      const r = { x1: s.x - 1 * ESC, y1: s.y - ALTO_TXT / 2, x2: s.x + w + 1 * ESC, y2: s.y + ALTO_TXT / 2 };
      return r.x1 > 0 && r.x2 < W && r.y1 > 0 && r.y2 < H && libre(r);
    });
    if (!sitio) continue;
    ocupados.push({ x1: sitio.x - 1 * ESC, y1: sitio.y - ALTO_TXT / 2, x2: sitio.x + w + 1 * ESC, y2: sitio.y + ALTO_TXT / 2 });
    ctx.textAlign = sitio.al;
    // Contorno blanco: el rótulo se lee aunque caiga encima de la línea de fibra
    ctx.lineWidth = 2.5 * ESC;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(txt, sitio.x, sitio.y);
    ctx.fillStyle = '#1A1A1A';
    ctx.fillText(txt, sitio.x, sitio.y);
  }
  // Rótulo de cada cable de acero, a mitad del vano: solo la medida y los metros
  // ("3/16 - 34m"). Usa el mismo control de choques que los rótulos de poste, así que
  // en un tramo apretado alguno queda sin rótulo antes que salir superpuesto.
  ctx.font = `bold ${6.5 * ESC}px Arial`;
  ctx.textBaseline = 'middle';
  for (const t of acero) {
    const txt = String(t.texto || '').trim();
    if (!txt) continue;
    const qa = aLienzo(t.a), qb = aLienzo(t.b);
    const mx = (qa.x + qb.x) / 2, my = (qa.y + qb.y) / 2;
    const w = ctx.measureText(txt).width;
    const r = { x1: mx - w / 2 - 1 * ESC, y1: my - ALTO_TXT / 2, x2: mx + w / 2 + 1 * ESC, y2: my + ALTO_TXT / 2 };
    if (r.x1 < 0 || r.x2 > W || r.y1 < 0 || r.y2 > H || !libre(r)) continue;
    ocupados.push(r);
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5 * ESC;
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeText(txt, mx, my);
    ctx.fillStyle = '#DC2626';
    ctx.fillText(txt, mx, my);
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  // Inicio y fin del recorrido
  if (vs.length >= 2) {
    [[vs[0], '#16A34A'], [vs[vs.length - 1], '#DC2626']].forEach(([v, color]) => {
      const q = aLienzo(v);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 5.5 * ESC, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.6 * ESC;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    });
  }

  // Escala: se elige un número redondo que ocupe cerca de un quinto del ancho
  const pxPorMetro = k / 111320;
  if (pxPorMetro > 0 && isFinite(pxPorMetro)) {
    const objetivo = (W * 0.2) / pxPorMetro;
    const mag = Math.pow(10, Math.floor(Math.log10(objetivo)));
    const metros = [1, 2, 5, 10].map(m => m * mag).find(m => m >= objetivo * 0.6) || mag * 10;
    const largo = metros * pxPorMetro;
    const x0 = MARGEN, y0 = H - MARGEN * 0.6;
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 1.5 * ESC;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + largo, y0);
    ctx.moveTo(x0, y0 - 4 * ESC); ctx.lineTo(x0, y0 + 4 * ESC);
    ctx.moveTo(x0 + largo, y0 - 4 * ESC); ctx.lineTo(x0 + largo, y0 + 4 * ESC);
    ctx.stroke();
    ctx.fillStyle = '#404040';
    ctx.font = `${9 * ESC}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`${metros} m`, x0 + largo / 2, y0 - 6 * ESC);
  }

  // Norte
  const nx = W - MARGEN, ny = MARGEN;
  ctx.strokeStyle = '#404040';
  ctx.fillStyle = '#404040';
  ctx.lineWidth = 1.5 * ESC;
  ctx.beginPath();
  ctx.moveTo(nx, ny + 14 * ESC); ctx.lineTo(nx, ny);
  ctx.moveTo(nx - 4 * ESC, ny + 5 * ESC); ctx.lineTo(nx, ny); ctx.lineTo(nx + 4 * ESC, ny + 5 * ESC);
  ctx.stroke();
  ctx.font = `bold ${9 * ESC}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('N', nx, ny + 24 * ESC);

  marco();
  return canvas.toBuffer('image/png');
};

// Nombre de hoja válido para Excel: sin caracteres prohibidos y máximo 31.
// En MAYÚSCULA: el cliente ya los guarda así, pero los ramales dibujados ANTES de
// ese cambio siguen en minúscula en la base, y se veían "r55" junto a "R67" en las
// pestañas. Pasarlo aquí los empareja sin tener que reescribir los datos viejos.
const nombreHojaSeguro = (txt, alterno) => {
  const limpio = String(txt || "").replace(/[:\\/?*[\]]/g, "").trim().toUpperCase();
  return (limpio || alterno).slice(0, 31);
};

// Reparte los puntos entre los ramales. Cada punto va a UNO solo: el de mayor
// capacidad y, a igualdad, el más largo. El umbral se va ensanchando por pasadas
// (8, 20, 40 y 60 m) para que no queden postes sueltos en tramos mal dibujados;
// los que ya tienen ramal no se vuelven a mirar.
const asignarRamales = (puntos, conexiones) => {
  const fibras = (conexiones || []).map(c => {
    const vs = Array.isArray(c.vertices) ? c.vertices.filter(v => v && v.lat != null) : [];
    if (vs.length < 2) return null;
    return { id: String(c.id), nombre: c.nombre || "", capacidad: c.capacidad || 12, vertices: vs, largo: largoDeFibra(vs) };
  }).filter(Boolean);

  const deQuien = {};
  if (fibras.length === 0) return { deQuien, fibras };

  for (const umbral of [8, 20, 40, 60]) {
    for (const p of puntos) {
      if (deQuien[p.id] || p.coords?.lat == null) continue;
      const pos = { lat: p.coords.lat, lng: p.coords.lng };
      let gana = null;
      for (const f of fibras) {
        if (distAPolilinea(pos, f.vertices) > umbral) continue;
        const mejor = !gana
          || f.capacidad > gana.capacidad
          || (f.capacidad === gana.capacidad && f.largo > gana.largo);
        if (mejor) gana = f;
      }
      if (gana) deQuien[p.id] = gana.id;
    }
  }
  return { deQuien, fibras };
};

const generarExcel = async (proy, puntosProyecto, logoBuffer, limiteFotos, stampConfig, ferreteriasVisibles, armadosConfig = [], conexiones = [], porRamal = false, cablesAcero = []) => {
  // Ramal de cada poste, calculado al vuelo: refleja el trazado tal como está hoy.
  const { deQuien: ramalDe, fibras: fibrasProy } = asignarRamales(puntosProyecto, conexiones);
  const nombreRamal = (p) => (fibrasProy.find(f => f.id === ramalDe[p.id]) || {}).nombre || '';
  // Metros de cable de acero por poste, en el mismo orden con que se arman los volúmenes
  const aceroPorPoste = metrosAceroPorPoste(cablesAcero, ordenarPorPosicion(puntosProyecto));
  const VOLUMENES = [];
  let volumenActual = 1;
  let puntosBuffer = [];
  let fotosCountBuffer = 0;

  const normFat = (val) => (val || '').replace(/^fat[\s-]*/i, '').trim();
  const getConsolidado = (datos) => {
    const totals = {};
    // Modelo nuevo: ferreteriaFinal es un mapa plano {idRef: cantidad}
    if (datos.ferreteriaFinal && Object.keys(datos.ferreteriaFinal).length > 0) {
      Object.entries(datos.ferreteriaFinal).forEach(([id, cantidad]) => {
        if (cantidad !== 0) totals[id] = (totals[id] || 0) + cantidad;
      });
      return sinCableAcero(totals);
    }
    // Modelo legacy: armadosSeleccionados + ferreteriaExtra
    (datos.armadosSeleccionados || []).forEach(armado => {
      (armado.items || []).forEach(item => { totals[item.idRef] = (totals[item.idRef] || 0) + item.cant; });
    });
    Object.entries(datos.ferreteriaExtra || {}).forEach(([id, cantidad]) => {
      if (cantidad !== 0) totals[id] = (totals[id] || 0) + cantidad;
    });
    return sinCableAcero(totals);
  };

  const PHOTO_COL_WIDTH = 55;
  const PHOTO_ROW_HEIGHT = 400;
  const LABEL_ROW_HEIGHT = 20;
  const SEC_COL_WIDTH = 10;

  const cerrarVolumen = async (listaPuntos, numVol) => {
    const workbook = new ExcelJS.Workbook();
    // Solo columnas de ferretería con al menos un valor > 0 en este volumen
    const idsConDatos = new Set();
    listaPuntos.forEach(p => {
      Object.entries(getConsolidado(p.datos || {})).forEach(([id, cant]) => { if (cant > 0) idsConDatos.add(id); });
    });
    const ferreteriasActivas = ferreteriasVisibles.filter(f => idsConDatos.has(f.id));
    const colsDef = [
      { header: 'CORRELATIVO', key: 'correlativo', width: 12 },
      { header: 'ITEM', key: 'numero', width: 12 },
      { header: 'PASIVO', key: 'pasivo', width: 14 },
      { header: 'COD POSTE', key: 'codPoste', width: 15 },
      { header: 'SUMINISTRO', key: 'sum', width: 15 },
      { header: 'ALTURA', key: 'alt', width: 10 },
      { header: 'MATERIAL', key: 'mat', width: 12 },
      { header: 'FUERZA (kg)', key: 'fuerza', width: 12 },
      { header: 'TIPO DE RED', key: 'tipo', width: 14 },
      { header: 'EXTRAS', key: 'extras', width: 25 },
      { header: 'CANT. CABLES', key: 'cables', width: 12 },
      { header: 'ARMADO', key: 'arm', width: 20 },
      { header: 'RAMAL', key: 'ramal', width: 18 },
      ...ferreteriasActivas.map(f => ({
        header: f.nombre.toUpperCase(),
        key: `ferr_${f.id}`,
        width: Math.max(12, Math.min(f.nombre.length + 4, 22))
      })),
      { header: 'ABSCISA INICIAL', key: 'abscisaInicial', width: 15 },
      { header: 'ABSCISA FINAL', key: 'abscisaFinal', width: 15 },
      { header: 'FECHA', key: 'fecha', width: 12 },
      { header: 'HORA', key: 'hora', width: 10 },
      { header: 'DIRECCIÓN', key: 'dir', width: 30 },
      { header: 'UBICACIÓN', key: 'ubic', width: 22 },
      { header: 'LATITUD', key: 'lat', width: 15 },
      { header: 'LONGITUD', key: 'lng', width: 15 },
      // OJO: nombres SIN punto ni espacio — ArcGIS/ArcMap los usa como nombre de campo
      // y un "COORD. X" rompe su consulta SQL (los puntos no se dibujan).
      { header: 'COORD_X', key: 'utmX', width: 15 },
      { header: 'COORD_Y', key: 'utmY', width: 15 },
      { header: 'ZONA_UTM', key: 'utmZona', width: 12 },
      { header: 'HEMISFERIO', key: 'utmHemisferio', width: 12 },
      { header: 'GPS', key: 'gps', width: 25 },
      { header: 'OBSERVACIONES', key: 'obs', width: 35 },
    ];

    // Los ramales se agrupan y se les asigna nombre de hoja ANTES de crear nada:
    // la hoja RESUMEN va primera en el libro y necesita referenciar esas hojas.
    const usedSheetNames = new Set(porRamal ? ['DATOS', 'RESUMEN'] : ['DATOS']);
    const gruposRamal = [];
    const hojaDeRamal = {};
    const esMedioTramoP = (p) => {
      const te = p.datos && p.datos.tipoElemento;
      const arr = Array.isArray(te) ? te : (te ? [te] : []);
      return arr.includes('medioTramo');
    };
    if (porRamal) {
      fibrasProy.forEach(f => gruposRamal.push({ fibra: f, puntos: [] }));
      const sinRamal = { fibra: null, puntos: [] };
      for (const p of listaPuntos) {
        const g = gruposRamal.find(x => x.fibra.id === ramalDe[p.id]);
        (g || sinRamal).puntos.push(p);
      }
      if (sinRamal.puntos.length) gruposRamal.push(sinRamal);
      for (const grupo of gruposRamal) {
        if (grupo.puntos.length === 0) continue;
        const titulo = grupo.fibra ? (grupo.fibra.nombre || 'RAMAL') : 'SIN RAMAL';
        let hoja = nombreHojaSeguro(titulo, 'RAMAL');
        if (usedSheetNames.has(hoja)) { let c = 2; while (usedSheetNames.has(`${hoja}_${c}`)) c++; hoja = `${hoja}_${c}`; }
        usedSheetNames.add(hoja);
        hojaDeRamal[grupo.fibra ? grupo.fibra.id : '__sin__'] = hoja;
      }
    }

    // ── HOJA RESUMEN ───────────────────────────────────────────────────────
    // Portada del reporte: arriba, tres tablas en fila (postes, ferretería y
    // armados); abajo, la sección de fibras con un renglón por ramal y el total
    // por capacidad. Se crea antes que DATOS para que Excel la deje primera.
    if (porRamal) {
      const B = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      const wsRes = workbook.addWorksheet("RESUMEN", { views: [{ showGridLines: false }] });
      // Rejilla de 13 de ancho: las tres tablas de arriba juntan dos columnas para
      // su etiqueta y así calzan con las siete columnas de la tabla de fibras.
      [2, 26, 13, 13, 13, 13, 13, 16, 13].forEach((w, n) => { wsRes.getColumn(n + 1).width = w; });

      wsRes.mergeCells(2, 2, 2, 9);
      const cT = wsRes.getCell(2, 2);
      cT.value = "REPORTE FOTOGRÁFICO Y LIQUIDACIÓN DEL PROYECTO";
      cT.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
      cT.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
      cT.alignment = { horizontal: "center", vertical: "middle" };
      wsRes.getRow(2).height = 26;

      wsRes.mergeCells(3, 2, 3, 9);
      const cN = wsRes.getCell(3, 2);
      cN.value = (proy.nombre || "PROYECTO").toUpperCase();
      cN.font = { size: 22, bold: true, color: { argb: "FF1F4E78" } };
      cN.alignment = { horizontal: "center", vertical: "middle" };
      wsRes.getRow(3).height = 38;

      wsRes.mergeCells(4, 2, 4, 9);
      const ahora = new Date();
      const cF = wsRes.getCell(4, 2);
      cF.value = `Elaborado el ${ahora.toLocaleDateString("es-PE", { timeZone: "America/Lima", day: "2-digit", month: "2-digit", year: "numeric" })}`;
      cF.font = { size: 9, italic: true, color: { argb: "FF7F7F7F" } };
      cF.alignment = { horizontal: "center" };

      wsRes.mergeCells(5, 2, 5, 9);
      wsRes.getCell(5, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCBF26" } };
      wsRes.getRow(5).height = 5;

      // Totales de todo el proyecto
      const totFerrP = {};
      const totAceroP = {};
      const totArmP = {};
      let nMediosP = 0, nBT = 0, nMT = 0, nOtros = 0;
      for (const p of listaPuntos) {
        if (esMedioTramoP(p)) { nMediosP++; }
        else {
          const t = String((p.datos && p.datos.tipo) || "").toUpperCase();
          if (t === "BT") nBT++; else if (t === "MT") nMT++; else nOtros++;
        }
        const cons = getConsolidado(p.datos || {});
        Object.entries(cons).forEach(([id, c]) => { if (c) totFerrP[id] = (totFerrP[id] || 0) + c; });
        Object.entries(aceroPorPoste[String(p.id)] || {}).forEach(([id, m]) => { totAceroP[id] = (totAceroP[id] || 0) + m; });
        const aId = p.datos && p.datos.armadoSeleccionadoId;
        if (aId) {
          const nom = (armadosConfig.find(a => a.id === aId) || {}).nombre || aId;
          totArmP[nom] = (totArmP[nom] || 0) + 1;
        }
      }
      const nomF = (id) => (ferreteriasVisibles.find(x => x.id === id) || {}).nombre || id;

      // Tabla concepto/cantidad. "ancho" es cuántas columnas ocupa la etiqueta,
      // para que tablas de distinto sitio queden alineadas en la misma rejilla.
      const tabla = (fila, col, ancho, titulo, color, pares, etiquetaTotal) => {
        const colVal = col + ancho;
        wsRes.mergeCells(fila, col, fila, colVal);
        const cT = wsRes.getCell(fila, col);
        cT.value = titulo;
        cT.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
        cT.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        cT.alignment = { horizontal: "center", vertical: "middle" };
        cT.border = B;
        wsRes.getRow(fila).height = 22;
        let r = fila + 1;
        const pinta = (k, v, fondo, negrita) => {
          if (ancho > 1) wsRes.mergeCells(r, col, r, colVal - 1);
          const c1 = wsRes.getCell(r, col); c1.value = k;
          c1.font = { size: 9, bold: !!negrita }; c1.border = B; if (fondo) c1.fill = fondo;
          const c2 = wsRes.getCell(r, colVal); c2.value = v;
          c2.font = { bold: true, size: negrita ? 10 : 9 };
          c2.alignment = { horizontal: "center" }; c2.border = B; if (fondo) c2.fill = fondo;
          r++;
        };
        // Un par puede traer un tercer valor para salir en negrita: los metros de cable
        // de acero, que se listan con la ferretería pero no son piezas.
        pares.forEach(([k, v, negrita], n) => {
          pinta(k, v, n % 2 === 1 ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } } : null, !!negrita);
        });
        if (etiquetaTotal) {
          const total = pares.reduce((t, x) => t + (Number(x[1]) || 0), 0);
          pinta(etiquetaTotal, total, { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } }, true);
        }
        return r;
      };

      // Título de sección, a todo lo ancho del bloque
      const banda = (fila, texto) => {
        wsRes.mergeCells(fila, 2, fila, 9);
        const c = wsRes.getCell(fila, 2);
        c.value = texto;
        c.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
        c.alignment = { horizontal: "center", vertical: "middle" };
        wsRes.getRow(fila).height = 22;
        return fila + 1;
      };

      // ── Sección 1: postes, ferretería y armados, una tabla al lado de otra ──
      const filaTablas = banda(7, "POSTES Y FERRETERÍA");
      const paresPostes = [["BAJA TENSIÓN (BT)", nBT], ["MEDIA TENSIÓN (MT)", nMT]];
      if (nOtros) paresPostes.push(["SIN TIPO DE RED", nOtros]);
      const paresF = Object.entries(totFerrP).map(([id, c]) => [nomF(id), c]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const paresA = Object.entries(totArmP).sort((a, b) => String(a[0]).localeCompare(String(b[0])));

      const finPostes = tabla(filaTablas, 2, 1, "POSTES", "FF404040", paresPostes, "TOTAL DE POSTES");
      // Los medios tramos van aparte: no son postes y sumarlos falsearía el total
      const cMT1 = wsRes.getCell(finPostes, 2); cMT1.value = "MEDIOS TRAMOS";
      cMT1.font = { bold: true, size: 9 }; cMT1.border = B;
      const cMT2 = wsRes.getCell(finPostes, 3); cMT2.value = nMediosP;
      cMT2.font = { bold: true, size: 10 }; cMT2.alignment = { horizontal: "center" }; cMT2.border = B;

      // El cable de acero va DENTRO de la ferretería (decidido con el usuario), al final
      // y en negrita, en vez de en una tabla aparte. Por eso esa tabla ya no lleva fila
      // de total: habría sumado piezas con metros.
      Object.entries(totAceroP)
        .sort((a, b) => String(nomF(a[0])).localeCompare(String(nomF(b[0]))))
        .forEach(([id, m]) => paresF.push([`${nomF(id)} (m)`, m, true]));

      // Sin fila de total: la de ferretería sumaba piezas con los metros de cable, y la
      // de armados no aportaba nada. Los totales que sí valen (postes y metros de fibra)
      // se quedan donde están.
      const finFerr = tabla(filaTablas, 4, 2, "FERRETERÍA UTILIZADA", "FF1F4E78", paresF);
      const finArm = tabla(filaTablas, 7, 2, "ARMADOS UTILIZADOS", "FFB45309", paresA);

      // ── Sección 2: fibra óptica ────────────────────────────────────────────
      // Primero el consolidado por capacidad y debajo el detalle ramal por ramal.
      let fr = Math.max(finPostes + 1, finFerr, finArm) + 2;
      fr = banda(fr, "FIBRA ÓPTICA");

      const porCap = {};
      fibrasProy.forEach(f => { porCap[f.capacidad] = (porCap[f.capacidad] || 0) + f.largo; });
      const paresCap = Object.entries(porCap)
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .map(([cap, m]) => [`${cap} FO`, Math.round(m)]);
      fr = tabla(fr, 2, 1, "METROS POR CAPACIDAD", "FF1F4E78", paresCap, "TOTAL DE METROS") + 2;

      ["RAMAL", "CAPACIDAD", "LONGITUD (m)", "ABSCISA INICIAL", "ABSCISA FINAL", "LONGITUD REAL", "LONGITUD CALCULADA"].forEach((h, n) => {
        const c = wsRes.getCell(fr, n + 2);
        c.value = h;
        c.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        c.border = B;
      });
      wsRes.getRow(fr).height = 28;
      fr++;

      // Un renglón por ramal. Abscisas y longitud real quedan vacías para llenarlas
      // a mano; longitud calculada apunta a la celda B4 de la hoja del ramal, así que
      // se actualiza sola cuando allá se anote el dato.
      //
      // Se listan TODOS los ramales, pero los que NO tienen hoja van al final y
      // resaltados en ámbar, con el motivo escrito en la última columna.
      //
      // Un ramal se queda sin hoja cuando no juntó ningún poste: el reparto es por
      // cercanía y cada poste va a UNA sola fibra —la de mayor capacidad y, a
      // igualdad, la más larga—, así que otro pudo llevárselos, o está dibujado lejos.
      //
      // Se listan igual, y no se esconden, justamente para que un ramal mal dibujado
      // se delate: si desapareciera de la tabla, nadie se enteraría de que está mal.
      const conHoja = fibrasProy.filter(f => hojaDeRamal[f.id]);
      const sinHoja = fibrasProy.filter(f => !hojaDeRamal[f.id]);
      const filasRamal = [...conHoja, ...sinHoja];
      const AMBAR = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };

      const filaIniFibras = fr;
      filasRamal.forEach((f, n) => {
        const hoja = hojaDeRamal[f.id];
        // El rayado alterno solo en las que tienen hoja: abajo manda el ámbar.
        const fondo = hoja
          ? (n % 2 === 1 ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } } : null)
          : AMBAR;
        for (let k = 0; k < 7; k++) {
          const c = wsRes.getCell(fr, k + 2);
          if (k === 0) c.value = f.nombre || "-";
          else if (k === 1) c.value = `${f.capacidad} FO`;
          else if (k === 2) c.value = Math.round(f.largo);
          c.font = { size: 9, bold: k === 0, color: hoja ? undefined : { argb: "FF9A3412" } };
          c.alignment = { horizontal: k === 0 ? "left" : "center" };
          c.border = B;
          if (fondo) c.fill = fondo;
        }
        // Con hoja, la longitud calculada se trae sola de allá. Sin hoja va el motivo:
        // la celda estaría vacía y no se entendería por qué.
        if (hoja) {
          wsRes.getCell(fr, 8).value = { formula: `'${hoja.replace(/'/g, "''")}'!B4` };
        } else {
          const c = wsRes.getCell(fr, 8);
          c.value = "SIN POSTES ASIGNADOS";
          c.font = { size: 8, bold: true, color: { argb: "FF9A3412" } };
          c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          c.border = B;
          c.fill = AMBAR;
        }
        fr++;
      });

      // Fila de totales. Va con fórmulas para que las columnas que se llenan a
      // mano (longitud real) sumen solas conforme se vayan completando.
      // El TOTAL suma TODAS las filas, también las de abajo sin hoja: son metros de
      // fibra igualmente tendidos y descontarlos falsearía el total del proyecto.
      if (filasRamal.length) {
        wsRes.mergeCells(fr, 2, fr, 3);
        for (let k = 0; k < 7; k++) {
          const c = wsRes.getCell(fr, k + 2);
          c.font = { bold: true, size: 10 };
          c.alignment = { horizontal: k === 0 ? "left" : "center" };
          c.border = B;
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
        }
        wsRes.getCell(fr, 2).value = "TOTAL";
        [["D", 4], ["G", 7], ["H", 8]].forEach(([letra, col]) => {
          wsRes.getCell(fr, col).value = { formula: `SUM(${letra}${filaIniFibras}:${letra}${fr - 1})` };
        });
      }
    }

    // Valores de una fila de la hoja DATOS. Se usa dos veces: en una pasada previa
    // para saber qué columnas quedan vacías, y al escribir cada fila.
    const valoresDeFila = (p, correlativo) => {
      const valNum = (p.datos && p.datos.numero) || "-";
      const lat = ((p.coords && p.coords.lat) || 0).toFixed(6);
      const lng = ((p.coords && p.coords.lng) || 0).toFixed(6);
      const utm = (p.coords && p.coords.lat && p.coords.lng) ? wgs84ToUtm(p.coords.lat, p.coords.lng) : null;
      const totals = getConsolidado(p.datos || {});
      const ferrValues = {};
      ferreteriasActivas.forEach(f => { ferrValues[`ferr_${f.id}`] = totals[f.id] || 0; });
      const armNombre = (p.datos && p.datos.armadosSeleccionados && p.datos.armadosSeleccionados.length > 0)
        ? p.datos.armadosSeleccionados.map(a => a.nombre).join(", ")
        : (p.datos && p.datos.armadoSeleccionadoId
          ? (armadosConfig.find(a => a.id === p.datos.armadoSeleccionadoId) || {}).nombre || "-"
          : "-");
      const fechaFormateada = (p.datos && p.datos.fecha)
        ? new Date(p.datos.fecha).toLocaleDateString("es-PE") : "-";
      return {
        correlativo, numero: valNum,
        pasivo: (p.datos && p.datos.pasivo) || "-",
        codPoste: (p.datos && p.datos.codigo) || "-",
        sum: (p.datos && p.datos.suministro) || "-",
        alt: (p.datos && p.datos.altura) || "-",
        mat: (p.datos && p.datos.material) || "-",
        fuerza: (p.datos && p.datos.fuerza) || "-",
        tipo: (p.datos && p.datos.tipo) || "-",
        extras: Array.isArray(p.datos && p.datos.extrasSeleccionados) ? (p.datos.extrasSeleccionados.join(", ") || "-") : "-",
        cables: (p.datos && p.datos.cables) || "-",
        arm: armNombre,
        ramal: nombreRamal(p),
        ...ferrValues,
        abscisaInicial: (p.datos && p.datos.absIn) || "-",
        abscisaFinal: (p.datos && p.datos.absOut) || "-",
        fecha: fechaFormateada,
        hora: (p.datos && p.datos.hora) || "-",
        dir: (p.datos && p.datos.direccion) || "-",
        ubic: (p.datos && p.datos.ubicacion) || "-",
        lat: Number(lat), lng: Number(lng),
        utmX: utm ? utm.x : "-", utmY: utm ? utm.y : "-",
        utmZona: utm ? utm.zona : "-", utmHemisferio: utm ? utm.hemisferio : "-",
        gps: `${lat}, ${lng}`,
        obs: (p.datos && p.datos.observaciones) || "-"
      };
    };

    // Pasada previa: con los valores de todas las filas ya se sabe qué columnas
    // no aportan nada. Las que identifican el punto no se quitan nunca.
    const filasDatos = listaPuntos.map((p, i) => valoresDeFila(p, String(i + 1).padStart(3, "0")));

    // Columnas sin ningún dato en todo el volumen: fuera. Nunca se quitan las que
    // identifican el punto, aunque vayan vacías, porque son la referencia del reporte.
    const SIEMPRE = new Set(['correlativo', 'numero']);
    const tieneDato = (v) => v !== undefined && v !== null && v !== '' && v !== '-' && v !== 0;
    const colsUsadas = colsDef.filter(c => SIEMPRE.has(c.key) || filasDatos.some(f => tieneDato(f[c.key])));

    const wsDatos = workbook.addWorksheet('DATOS', { views: [{ state: 'frozen', ySplit: 2 }] });
    wsDatos.columns = colsUsadas;
    wsDatos.insertRow(1, []);
    wsDatos.mergeCells(1, 1, 1, 8);
    const cellTitulo = wsDatos.getCell('A1');
    cellTitulo.value = `REPORTE: ${(proy.nombre || '').toUpperCase()} (VOL ${numVol})`;
    cellTitulo.font = { size: 14, bold: true, color: { argb: 'FF1F4E78' } };
    cellTitulo.alignment = { vertical: 'middle' };
    wsDatos.getRow(1).height = 26;

    const headerRow = wsDatos.getRow(2);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    const armColPos = colsUsadas.findIndex(c => c.key === 'arm');
    const ferrColStart = colsUsadas.findIndex(c => c.key.startsWith('ferr_'));
    if (armColPos >= 0) {
      headerRow.getCell(armColPos + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCBF26' } };
      headerRow.getCell(armColPos + 1).font = { bold: true, color: { argb: 'FF000000' } };
    }
    if (ferrColStart >= 0) {
      for (let c = ferrColStart + 1; c <= ferrColStart + ferreteriasActivas.length; c++) {
        headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCBF26' } };
        headerRow.getCell(c).font = { bold: true, color: { argb: 'FF000000' } };
      }
    }


    // ── HOJAS POR RAMAL ────────────────────────────────────────────────────
    // Solo en el reporte de tendido. Las tablas del ramal ocupan A y B; los bloques
    // de fotos empiezan en C (elemento), D (ferretería) y de E en adelante, así que
    // no se pisan con las tablas.
    if (porRamal) {
      const SECCIONES_TENDIDO = ["poste", "medioTramo"];
      const nombreFerr = (id) => (ferreteriasVisibles.find(f => f.id === id) || {}).nombre || id;
      const BORDE = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };

      // Tabla de dos columnas (etiqueta A–C, cantidad en D). Devuelve la fila libre
      // siguiente para poder apilar tablas sin llevar la cuenta a mano.
      const tablaAB = (ws, fila, titulo, pares, colorTitulo, resaltar) => {
        if (titulo) {
          ws.mergeCells(fila, 1, fila, 2);
          const c = ws.getCell(fila, 1);
          c.value = titulo;
          c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorTitulo || "FF1F4E78" } };
          c.alignment = { horizontal: "center", vertical: "middle" };
          c.border = BORDE;
          fila++;
        }
        // Un par puede traer un tercer valor para salir en negrita: así los metros de
        // cable de acero se distinguen del resto de la ferretería, que va en piezas.
        pares.forEach(([k, v, negrita]) => {
          const c1 = ws.getCell(fila, 1); c1.value = k;
          c1.font = { size: 9, bold: !!negrita }; c1.alignment = { vertical: "middle" }; c1.border = BORDE;
          if (resaltar) {
            c1.font = { size: 9, bold: true, color: { argb: "FFFFFFFF" } };
            c1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };
          }
          const c2 = ws.getCell(fila, 2); c2.value = v;
          c2.font = { bold: true, size: 9 }; c2.alignment = { horizontal: "center", vertical: "middle" }; c2.border = BORDE;
          fila++;
        });
        return fila;
      };

      for (const grupo of gruposRamal) {
        if (grupo.puntos.length === 0) continue;
        const titulo = grupo.fibra ? (grupo.fibra.nombre || "RAMAL") : "SIN RAMAL";
        const ws = workbook.addWorksheet(hojaDeRamal[grupo.fibra ? grupo.fibra.id : "__sin__"], { views: [{ showGridLines: false }] });
        [30, 14, 14, 26, PHOTO_COL_WIDTH, PHOTO_COL_WIDTH].forEach((w, n) => { ws.getColumn(n + 1).width = w; });

        // Franja de título a todo el ancho útil de la hoja
        ws.mergeCells(1, 1, 1, 6);
        const cTit = ws.getCell("A1");
        cTit.value = titulo.toUpperCase();
        cTit.font = { size: 22, bold: true, color: { argb: "FFFFFFFF" } };
        cTit.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
        cTit.alignment = { horizontal: "center", vertical: "middle" };
        ws.getRow(1).height = 40;

        const nMedios = grupo.puntos.filter(esMedioTramoP).length;
        const totFerr = {};
        const totArm = {};
        for (const p of grupo.puntos) {
          const t = getConsolidado(p.datos || {});
          Object.entries(t).forEach(([id, c]) => { if (c) totFerr[id] = (totFerr[id] || 0) + c; });
          const aId = p.datos && p.datos.armadoSeleccionadoId;
          if (aId) {
            const nom = (armadosConfig.find(a => a.id === aId) || {}).nombre || aId;
            totArm[nom] = (totArm[nom] || 0) + 1;
          }
        }

        // Las tablas ocupan solo A y B. B4 (LONGITUD CALCULADA) se deja en blanco
        // a propósito: se anota a mano y el RESUMEN la trae con una fórmula.
        let f = tablaAB(ws, 3, null, [
          ["LONGITUD LINEAL (M)", grupo.fibra ? Math.round(grupo.fibra.largo) : "-"],
          ["LONGITUD CALCULADA", null],
          ["CAPACIDAD (HILOS)", grupo.fibra ? grupo.fibra.capacidad : "-"],
          ["POSTES", grupo.puntos.length - nMedios],
          ["MEDIOS TRAMOS", nMedios],
        ], null, true);
        f++;
        const paresFerr = Object.entries(totFerr).map(([id, c]) => [nombreFerr(id), c]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        // Los metros de cable de acero de este ramal, al final de la lista y en negrita:
        // no son piezas del poste, se liquidan por metro con lo trazado en el mapa.
        const aceroGrupo = {};
        for (const p of grupo.puntos) {
          Object.entries(aceroPorPoste[String(p.id)] || {}).forEach(([id, m]) => { aceroGrupo[id] = (aceroGrupo[id] || 0) + m; });
        }
        Object.entries(aceroGrupo)
          .sort((a, b) => String(nombreFerr(a[0])).localeCompare(String(nombreFerr(b[0]))))
          .forEach(([id, m]) => paresFerr.push([`${nombreFerr(id)} (m)`, m, true]));

        const paresArm = Object.entries(totArm).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        f = tablaAB(ws, f, "FERRETERÍA DEL RAMAL", paresFerr);
        f++;
        f = tablaAB(ws, f, "ARMADOS DEL RAMAL", paresArm, "FFB45309");

        const idsDelGrupo = new Set(grupo.puntos.map(p => p.id));

        // ── Croquis del ramal ────────────────────────────────────────────────
        // Ocupa E–F desde la fila 3 hasta donde termine la tercera tabla. Con
        // tablas cortas se le da un alto mínimo para que no quede una franja.
        const filaFinCroquis = Math.max(f - 1, 16);
        ws.mergeCells(3, 4, filaFinCroquis, 6);
        // El lienzo se pide del tamaño exacto del recuadro (ancho de las columnas
        // que abarca y alto de sus filas) para que la imagen no se estire.
        // Cables de acero con sus DOS postes en este ramal: se dibujan y se resaltan
        // sus postes y el medio tramo donde se apoyan las fibras.
        const puntoDelGrupo = new Map(grupo.puntos.map(p => [String(p.id), p]));
        const idsApoyo = new Set();
        const tramosAcero = [];
        for (const c of cablesAcero || []) {
          const [ia, ib] = (c.puntos || []).map(String);
          const pa = puntoDelGrupo.get(ia), pb = puntoDelGrupo.get(ib);
          // RESALTADO: se marca lo que esté en ESTA hoja, aunque el cable quede
          // repartido entre dos ramales. Los postes de un mismo cable pueden caer en
          // ramales distintos (el reparto es por cercanía a cada fibra), y antes eso
          // descartaba el cable entero: ni sus postes ni su medio tramo salían rojos en
          // ninguna de las dos hojas. Los ids que no sean de este grupo sobran sin
          // molestar: solo se consultan contra los puntos de la hoja.
          idsApoyo.add(ia);
          idsApoyo.add(ib);
          if (c.medioTramo != null) idsApoyo.add(String(c.medioTramo));
          // LÍNEA: solo con los dos extremos en esta hoja. Con uno afuera, el trazo
          // apuntaría a un poste que la hoja no dibuja y se leería como un cable que
          // sale hacia la nada.
          if (!pa || !pb || pa.coords?.lat == null || pb.coords?.lat == null) continue;
          tramosAcero.push({
            a: pa.coords,
            b: pb.coords,
            texto: `${medidaAcero(nombreFerr(c.ferrId))} - ${metrosCableAcero(pa.coords, pb.coords)}m`,
          });
        }

        const pngCroquis = croquisRamal(
          grupo.fibra ? grupo.fibra.vertices : [],
          grupo.puntos.map(p => ({
            coords: p.coords,
            medio: esMedioTramoP(p),
            acero: idsApoyo.has(String(p.id)),
            etiqueta: (p.datos && p.datos.numero) || "",
          })),
          [4, 5, 6].reduce((s, c) => s + ((ws.getColumn(c).width || 8.43) * 7 + 5), 0),
          (filaFinCroquis - 2) * 20,
          // Resto de la red, para situar el ramal dentro del proyecto
          fibrasProy.filter(f => !grupo.fibra || f.id !== grupo.fibra.id).map(f => f.vertices),
          listaPuntos.filter(p => !idsDelGrupo.has(p.id)).map(p => p.coords),
          tramosAcero,
        );
        ws.addImage(workbook.addImage({ buffer: pngCroquis, extension: "png" }), {
          tl: { col: 3, row: 2 }, br: { col: 6, row: filaFinCroquis },
        });

        let curRow = Math.max(f, filaFinCroquis + 1) + 2;
        const trabajos = [];

        for (const p of grupo.puntos) {
          const items = [];
          for (const tabId of SECCIONES_TENDIDO) {
            if (!TABS_CONFIG[tabId]) continue;
            items.push(...collectSectionPhotos(p, tabId));
          }
          if (items.length === 0) continue;

          const imgRowIdx = curRow;
          const lblRowIdx = curRow + 1;
          ws.getRow(imgRowIdx).height = PHOTO_ROW_HEIGHT;
          ws.getRow(lblRowIdx).height = LABEL_ROW_HEIGHT;

          ws.mergeCells(imgRowIdx, 3, lblRowIdx, 3);
          const cId = ws.getCell(imgRowIdx, 3);
          cId.value = `${(p.datos && p.datos.numero) || "-"}\n${esMedioTramoP(p) ? "MEDIO TRAMO" : "POSTE"}`;
          cId.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
          cId.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A1A1A" } };
          cId.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cId.border = BORDE;

          ws.mergeCells(imgRowIdx, 4, lblRowIdx, 4);
          const cFerr = ws.getCell(imgRowIdx, 4);
          const tp = getConsolidado(p.datos || {});
          const lineas = Object.entries(tp).filter(([, c]) => c).map(([id, c]) => `${c} × ${nombreFerr(id)}`);
          cFerr.value = lineas.join("\n") || "-";
          cFerr.font = { size: 8 };
          cFerr.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
          cFerr.border = BORDE;

          const datosEst = makeDatosEstampado(p, proy);
          for (let j = 0; j < items.length; j++) {
            const colIdx = j + 5;
            const col = ws.getColumn(colIdx);
            if (!col.width || col.width < PHOTO_COL_WIDTH) col.width = PHOTO_COL_WIDTH;
            const cellLbl = ws.getCell(lblRowIdx, colIdx);
            cellLbl.value = items[j].label;
            cellLbl.alignment = { horizontal: "center", vertical: "middle" };
            cellLbl.font = { bold: true, size: 9 };
            cellLbl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCBF26" } };
            cellLbl.border = BORDE;
            trabajos.push({ url: items[j].url, thumb: items[j].thumb, colIdx, imgRowIdx, datosEst, fechaCaptura: items[j].fechaCaptura, horaCaptura: items[j].horaCaptura });
          }
          curRow += 3;
        }

        const bufs = await runParallel(trabajos, async (job) => procesarFotoExport(job, job.datosEst, logoBuffer, stampConfig));
        for (let k = 0; k < trabajos.length; k++) {
          if (!bufs[k]) continue;
          const { colIdx, imgRowIdx } = trabajos[k];
          const imgId = workbook.addImage({ buffer: bufs[k], extension: "jpeg" });
          ws.addImage(imgId, { tl: { col: colIdx - 1, row: imgRowIdx - 1 }, br: { col: colIdx, row: imgRowIdx } });
        }
      }
    }

    for (let i = 0; i < listaPuntos.length; i++) {
      const p = listaPuntos[i];
      const correlativo = String(i + 1).padStart(3, '0');
      const valFat = normFat((p.datos && p.datos.codFat) || '');

      let sheetName = correlativo;
      if (usedSheetNames.has(sheetName)) {
        let cnt = 2;
        while (usedSheetNames.has(`${correlativo}_${cnt}`)) cnt++;
        sheetName = `${correlativo}_${cnt}`;
      }
      usedSheetNames.add(sheetName);

      const row = wsDatos.getRow(i + 3);
      row.values = filasDatos[i];
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // En el reporte por ramal no hay hoja por poste: la fila de DATOS ya quedó
      // escrita arriba y las fotos van en la hoja de su ramal.
      if (porRamal) continue;

      const cellCorr = row.getCell('correlativo');
      cellCorr.value = { text: correlativo, hyperlink: `#'${sheetName}'!A1` };
      cellCorr.font = { color: { argb: 'FF0000FF' }, underline: true, bold: true };
      const wsPoint = workbook.addWorksheet(sheetName);
      wsPoint.getColumn(1).width = SEC_COL_WIDTH;
      let curRow = 1;
      let esPrimeraSeccion = true;
      const allPhotoJobs = [];

      const datosEstampado = makeDatosEstampado(p, proy);
      datosEstampado.codFat = valFat;

      for (const tabId of Object.keys(TABS_CONFIG)) {
        const tab = TABS_CONFIG[tabId];
        const secItems = collectSectionPhotos(p, tabId);
        if (secItems.length === 0) continue;

        if (!esPrimeraSeccion) { wsPoint.getRow(curRow).height = 12; curRow++; }
        esPrimeraSeccion = false;

        for (let c = 2; c <= secItems.length + 1; c++) {
          const col = wsPoint.getColumn(c);
          if (!col.width || col.width < PHOTO_COL_WIDTH) col.width = PHOTO_COL_WIDTH;
        }
        const imgRowIdx = curRow;
        const lblRowIdx = curRow + 1;
        wsPoint.getRow(imgRowIdx).height = PHOTO_ROW_HEIGHT;
        wsPoint.getRow(lblRowIdx).height = LABEL_ROW_HEIGHT;
        wsPoint.mergeCells(imgRowIdx, 1, lblRowIdx, 1);
        const cellSec = wsPoint.getCell(imgRowIdx, 1);
        cellSec.value = tab.title;
        cellSec.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
        cellSec.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } };
        cellSec.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };

        for (let j = 0; j < secItems.length; j++) {
          const colIdx = j + 2;
          const cellLbl = wsPoint.getCell(lblRowIdx, colIdx);
          cellLbl.value = secItems[j].label;
          cellLbl.alignment = { horizontal: 'center', vertical: 'middle' };
          cellLbl.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
          cellLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCBF26' } };
          cellLbl.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          allPhotoJobs.push({ url: secItems[j].url, thumb: secItems[j].thumb, colIdx, imgRowIdx, fechaCaptura: secItems[j].fechaCaptura, horaCaptura: secItems[j].horaCaptura });
        }
        curRow += 2;
      }

      const photoBuffers = await runParallel(allPhotoJobs, async (job) =>
        procesarFotoExport(job, datosEstampado, logoBuffer, stampConfig));

      for (let k = 0; k < allPhotoJobs.length; k++) {
        if (!photoBuffers[k]) continue;
        const { colIdx, imgRowIdx } = allPhotoJobs[k];
        const imgId = workbook.addImage({ buffer: photoBuffers[k], extension: 'jpeg' });
        wsPoint.addImage(imgId, { tl: { col: colIdx - 1, row: imgRowIdx - 1 }, br: { col: colIdx, row: imgRowIdx } });
      }
    }

    const content = await workbook.xlsx.writeBuffer();
    const nombreBase = (proy.nombre || 'PROYECTO').replace(/\s+/g, '_').toUpperCase();
    const nombre = (VOLUMENES.length === 0 && listaPuntos.length === puntosProyecto.length)
      ? `${nombreBase}.xlsx` : `${nombreBase}_VOL${numVol}.xlsx`;
    return {
      nombre,
      buffer: Buffer.from(content),
      numPuntos: listaPuntos.length,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  };

  const puntosOrdenados = ordenarPorPosicion(puntosProyecto);
  for (const p of puntosOrdenados) {
    const fotosPunto = getFormattedPhotos(p).length;
    const pesoLogico = Math.max(fotosPunto, 1);
    if (fotosCountBuffer + pesoLogico > limiteFotos && puntosBuffer.length > 0) {
      VOLUMENES.push(await cerrarVolumen(puntosBuffer, volumenActual));
      volumenActual++; puntosBuffer = []; fotosCountBuffer = 0;
    }
    puntosBuffer.push(p);
    fotosCountBuffer += pesoLogico;
  }
  if (puntosBuffer.length > 0) VOLUMENES.push(await cerrarVolumen(puntosBuffer, volumenActual));
  return VOLUMENES;
};

// ============================================================
// REPORTE FOTOGRÁFICO — POSTES PROPIOS
// Una página por poste: encabezado + grilla 2×2 de fotos de la sección POSTE.
// ============================================================

const generarReportePostesPropios = async (proy, puntosProyecto, logoBuffer, stampConfig) => {
  const TPL_PATH = path.join(__dirname, 'templates', 'RF_POSTES_PROPIOS.xlsx');
  const BLOCK = 74, START = 3;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

  const postes = puntosProyecto.filter(p => norm(p.datos && p.datos.tipoPoste) === 'propio');
  postes.sort((a, b) => {
    const na = parseInt(a.datos && a.datos.numero), nb = parseInt(b.datos && b.datos.numero);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String((a.datos && a.datos.numero) || '').localeCompare(String((b.datos && b.datos.numero) || ''));
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TPL_PATH);
  // Quitar la hoja DATOS de ejemplo si existe
  const dataSheet = wb.getWorksheet('DATOS');
  if (dataSheet) wb.removeWorksheet(dataSheet.id);
  // Tras quitar DATOS (índice 0), la vista del libro queda con activeTab/firstSheet=1
  // apuntando a una hoja que ya no existe → Excel arroja error al abrir. Reseteamos.
  if (Array.isArray(wb.views) && wb.views.length) wb.views.forEach(v => { v.activeTab = 0; v.firstSheet = 0; });
  else wb.views = [{ activeTab: 0 }];
  // Defensa: si la plantilla trajera imágenes embebidas, ExcelJS enreda las
  // referencias de las fotos que agregamos (drawing corrupto). Limpiamos media.
  wb.media = [];
  const ws = wb.getWorksheet('REPORTE FOTOGRAFICO') || wb.worksheets[0];

  // Capturar bloque modelo (filas START..START+BLOCK-1): altos, estilos, valores
  const model = { heights: [], cells: [] };
  for (let r = 0; r < BLOCK; r++) {
    const row = ws.getRow(START + r);
    model.heights[r] = row.height;
    const cs = [];
    for (let c = 1; c <= 12; c++) { const cell = row.getCell(c); cs.push({ c, style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : null, value: cell.value }); }
    model.cells.push(cs);
  }
  const rowOf = (a) => parseInt(a.match(/\d+/)[0], 10);
  const shiftAddr = (a, d) => a.replace(/([A-Z]+)(\d+)/g, (m, col, n) => col + (parseInt(n, 10) + d));
  const modelMerges = (ws.model.merges || []).filter(m => { const t = rowOf(m.split(':')[0]); return t >= START && t < START + BLOCK; });

  // Anclas de las 4 fotos. Caja REAL medida: B..F / H..L = 410px ancho (5 col x 82px)
  // y 560px alto (28 filas x 20px). Centramos la foto en la caja (margen 4px) con
  // fitImagen; off/roff = margen izq/sup base (4px = 38100 EMU).
  const ANCHOR = {
    f1: { col: 1, off: 38100, row: 12, roff: 38100 }, // frontal
    f2: { col: 7, off: 38100, row: 12, roff: 38100 }, // perfil
    f3: { col: 1, off: 38100, row: 44, roff: 38100 }, // base
    f4: { col: 7, off: 38100, row: 44, roff: 38100 }, // codigo
  };
  const BOX = { width: 402, height: 552 };
  const FOTOS = [['f1', 'frontal'], ['f2', 'perfil'], ['f3', 'base'], ['f4', 'codigo']];

  const getFotoPoste = (p, itemId) => {
    const sec = p.datos && p.datos.fotos && p.datos.fotos.poste;
    if (!sec || typeof sec !== 'object') return null;
    const val = sec[itemId];
    if (!val) return null;
    let url = typeof val === 'string' ? val : (val.url || val.urlHD);
    if (url && url.startsWith('blob:')) url = null;
    const thumb = (typeof val === 'object' && typeof val.thumb === 'string') ? val.thumb : null;
    if (!url && !thumb) return null;
    return { url, thumb, fechaCaptura: (typeof val === 'object' ? val.fechaCaptura : null), horaCaptura: (typeof val === 'object' ? val.horaCaptura : null) };
  };

  const N = postes.length;

  // 1. Replicar el bloque modelo (fila 1+). En esta plantilla solo el PRIMER bloque
  //    trae bordes completos, por eso replicamos tambien el 2o bloque.
  for (let i = 1; i < N; i++) {
    const off = i * BLOCK;
    for (let r = 0; r < BLOCK; r++) {
      const trow = ws.getRow(START + off + r);
      if (model.heights[r] != null) trow.height = model.heights[r];
      for (const mc of model.cells[r]) { const tc = trow.getCell(mc.c); if (mc.style) tc.style = mc.style; if (mc.value !== null && mc.value !== undefined) tc.value = mc.value; }
    }
    for (const m of modelMerges) { const [a, b] = m.split(':'); try { ws.mergeCells(shiftAddr(a, off) + ':' + shiftAddr(b, off)); } catch (e) {} }
  }

  // 2. Llenar cada bloque
  const fecha = new Date().toLocaleDateString('es-PE');
  const contratista = proy.ownerEmpresa || '';
  const plano = proy.nombre || '';
  const valOr = (v) => (v && String(v).trim() && String(v).trim() !== '-') ? String(v).trim() : 'SN';

  // El copiado de estilos de ExcelJS degrada/ensucia los bordes de las cajas de foto
  // (grilla interna inconsistente al replicar). Como la foto tapa el interior, limpiamos
  // los bordes internos de cada caja y dibujamos un recuadro exterior limpio y uniforme
  // en TODOS los bloques (ademas alinea el marco con la foto).
  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  // Clonar el estilo de la celda antes de tocar bordes: evita que ExcelJS filtre el
  // borde a celdas vecinas por estilos compartidos (lineas fantasma).
  const addBordes = (r, c, edges) => { const cell = ws.getCell(r, c); cell.style = JSON.parse(JSON.stringify(cell.style || {})); const b = { ...(cell.border || {}) }; for (const e of edges) b[e] = thin; cell.border = b; };
  const clearBox = (t, bt, l, r, off) => { for (let rr = t + off; rr <= bt + off; rr++) for (let c = l; c <= r; c++) { const cell = ws.getCell(rr, c); cell.style = JSON.parse(JSON.stringify(cell.style || {})); cell.border = {}; } };
  const drawBox = (t, bt, l, r, off) => {
    const T = t + off, B = bt + off;
    for (let c = l; c <= r; c++) { addBordes(T, c, ['top']); addBordes(B, c, ['bottom']); }
    for (let rr = T; rr <= B; rr++) { addBordes(rr, l, ['left']); addBordes(rr, r, ['right']); }
    // La fila superior (l..r) esta combinada; su celda MAESTRA (T,l) define el recuadro
    // de toda la combinacion. Forzar top/left/right evita bordes faltantes.
    addBordes(T, l, ['top', 'left', 'right']);
  };
  const CAJAS = [[13, 40, 2, 6], [13, 40, 8, 12], [45, 72, 2, 6], [45, 72, 8, 12]];

  for (let i = 0; i < N; i++) {
    const p = postes[i]; const off = i * BLOCK; const d = p.datos || {};
    const num = (d.numero || '');
    const codigo = (d.codigo && String(d.codigo).trim()) ? String(d.codigo).trim() : 'SC';
    const setV = (addr, v) => { ws.getCell(shiftAddr(addr, off)).value = v; };
    // Provincia/Distrito: campos separados; si faltan, se sacan de "ubicacion" = "ciudad, region"
    const ub = String(d.ubicacion || '').split(',').map(s => s.trim()).filter(Boolean);
    const distrito = valOr(d.distrito || ub[0]);
    const provincia = valOr(d.provincia || ub[1] || ub[0]);
    setV('D6', contratista); setV('D7', plano); setV('D8', provincia);
    setV('I6', distrito); setV('I7', valOr(d.direccion)); setV('I8', fecha);
    // N° de poste en los 4 rotulos (sobrescribe formulas) tamano 12
    ['F12', 'L12', 'F44', 'L44'].forEach(a => { const c = ws.getCell(shiftAddr(a, off)); c.value = num; c.font = { ...(c.font || {}), size: 12 }; });
    // Codigo del poste (4ta foto) — SC si no hay
    setV('K74', codigo);
    // Limpiar helper oculto de columna G
    setV('G13', null);
    // Recuadros de las 4 fotos en TODOS los bloques: limpiar interior + borde exterior
    // limpio (con clonado de estilo para no filtrar bordes a celdas vecinas).
    for (const [t, bt, l, r] of CAJAS) { clearBox(t, bt, l, r, off); drawBox(t, bt, l, r, off); }
    // Borde derecho de la zona OBSERVACIÓN bajo cada foto (F y L): se pierde al replicar.
    for (const rr of [41, 42, 73, 74]) { addBordes(rr + off, 6, ['right']); addBordes(rr + off, 12, ['right']); }
    for (const [key, item] of FOTOS) {
      const foto = getFotoPoste(p, item);
      if (!foto) continue;
      let buf = null;
      try { buf = await procesarFotoExport(foto, makeDatosEstampado(p, proy), logoBuffer, stampConfig); } catch (e) {}
      if (!buf) continue;
      const a = ANCHOR[key];
      const fit = await fitImagen(buf, BOX.width, BOX.height);
      const id = wb.addImage({ buffer: buf, extension: 'jpeg' });
      ws.addImage(id, { tl: { nativeCol: a.col, nativeColOff: a.off + fit.colOffExtra, nativeRow: a.row + off, nativeRowOff: a.roff + fit.rowOffExtra }, ext: fit.ext, editAs: 'oneCell' });
    }
    if (i < N - 1) ws.getRow(START + off + BLOCK - 1).addPageBreak();
  }

  // 3. Sin postes propios: conservar encabezado, reemplazar la grilla por un mensaje
  if (N === 0) {
    insertarMensajeSinDatos(ws, 12, 'NO SE USARON POSTES PROPIOS EN ESTE PLANO');
  } else if (N < 2) {
    // Quitar bloques de ejemplo sobrantes si hay menos de 2 postes
    const desde = START + Math.max(N, 0) * BLOCK;
    (ws.model.merges || []).slice().forEach(m => { const [a, b] = m.split(':'); if (rowOf(a) >= desde || rowOf(b) >= desde) { try { ws.unMergeCells(m); } catch (e) {} } });
    // spliceRows con count grande es no-op en ExcelJS; borrar fila por fila desde abajo
    for (let r = ws.rowCount; r >= desde; r--) { try { ws.spliceRows(r, 1); } catch (e) {} }
  }

  const content = await wb.xlsx.writeBuffer();
  return [{
    nombre: `REPORTE FOTOGRAFICO DE POSTES PROPIOS - ${proy.nombre || 'PROYECTO'}.xlsx`,
    buffer: Buffer.from(content),
    numPuntos: N,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }];
};

// ============================================================
// REPORTE FOTOGRÁFICO — POSTES ELÉCTRICOS (usa plantilla con formato)
// Replica el bloque de la plantilla por cada poste (Tipo = Eléctrico),
// llena encabezado + N° + 4 fotos (frontal/perfil/base/código) con sello.
// ============================================================
const generarReportePostesElectricos = async (proy, puntosProyecto, logoBuffer, stampConfig) => {
  const TPL_PATH = path.join(__dirname, 'templates', 'RF_POSTES_ELECTRICOS.xlsx');
  const BLOCK = 75, START = 3;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

  const postes = puntosProyecto.filter(p => norm(p.datos && p.datos.tipoPoste) === 'electrico');
  postes.sort((a, b) => {
    const na = parseInt(a.datos && a.datos.numero), nb = parseInt(b.datos && b.datos.numero);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return String((a.datos && a.datos.numero) || '').localeCompare(String((b.datos && b.datos.numero) || ''));
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TPL_PATH);
  const ws = wb.worksheets[0];

  // Capturar bloque modelo (filas START..START+BLOCK-1): altos, estilos, valores, merges
  const model = { heights: [], cells: [] };
  for (let r = 0; r < BLOCK; r++) {
    const row = ws.getRow(START + r);
    model.heights[r] = row.height;
    const cs = [];
    for (let c = 1; c <= 12; c++) { const cell = row.getCell(c); cs.push({ c, style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : null, value: cell.value }); }
    model.cells.push(cs);
  }
  const rowOf = (a) => parseInt(a.match(/\d+/)[0], 10);
  const shiftAddr = (a, d) => a.replace(/([A-Z]+)(\d+)/g, (m, col, n) => col + (parseInt(n, 10) + d));
  const modelMerges = (ws.model.merges || []).filter(m => { const t = rowOf(m.split(':')[0]); return t >= START && t < START + BLOCK; });

  // Anclas exactas de las 4 fotos (tomadas de la plantilla original)
  const ANCHOR = {
    B14: { col: 1, off: 171450, row: 14, roff: 104775 }, // frontal
    H14: { col: 7, off: 167821, row: 14, roff: 104775 }, // perfil
    B46: { col: 1, off: 171450, row: 46, roff: 105000 }, // base
    H46: { col: 7, off: 167821, row: 46, roff: 105000 }, // codigo
  };
  const EXT = { width: 388.49984251968505, height: 517.9997900262467 };
  const FOTOS = [['B14', 'frontal'], ['H14', 'perfil'], ['B46', 'base'], ['H46', 'codigo']];

  const getFotoPoste = (p, itemId) => {
    const sec = p.datos && p.datos.fotos && p.datos.fotos.poste;
    if (!sec || typeof sec !== 'object') return null;
    const val = sec[itemId];
    if (!val) return null;
    let url = typeof val === 'string' ? val : (val.url || val.urlHD);
    if (url && url.startsWith('blob:')) url = null;
    const thumb = (typeof val === 'object' && typeof val.thumb === 'string') ? val.thumb : null;
    if (!url && !thumb) return null;
    return { url, thumb, fechaCaptura: (typeof val === 'object' ? val.fechaCaptura : null), horaCaptura: (typeof val === 'object' ? val.horaCaptura : null) };
  };

  const N = postes.length;

  // 1. Replicar el bloque modelo para los postes 3+ (los 2 primeros ya están en la plantilla)
  for (let i = 2; i < N; i++) {
    const off = i * BLOCK;
    for (let r = 0; r < BLOCK; r++) {
      const trow = ws.getRow(START + off + r);
      if (model.heights[r] != null) trow.height = model.heights[r];
      for (const mc of model.cells[r]) { const tc = trow.getCell(mc.c); if (mc.style) tc.style = mc.style; if (mc.value !== null && mc.value !== undefined) tc.value = mc.value; }
    }
    for (const m of modelMerges) { const [a, b] = m.split(':'); try { ws.mergeCells(shiftAddr(a, off) + ':' + shiftAddr(b, off)); } catch (e) {} }
  }

  // 2. Llenar cada bloque
  const fecha = new Date().toLocaleDateString('es-PE');
  const contratista = proy.ownerEmpresa || '';
  const plano = proy.nombre || '';
  const valOr = (v) => (v && String(v).trim() && String(v).trim() !== '-') ? String(v).trim() : 'SN';

  for (let i = 0; i < N; i++) {
    const p = postes[i]; const off = i * BLOCK; const d = p.datos || {};
    const num = (d.numero || '');
    const setV = (addr, v) => { ws.getCell(shiftAddr(addr, off)).value = v; };
    // Provincia/Distrito: usa los campos separados; si faltan (puntos viejos), los saca de "ubicacion" = "ciudad, región"
    const ub = String(d.ubicacion || '').split(',').map(s => s.trim()).filter(Boolean);
    const distrito = valOr(d.distrito || ub[0]);
    const provincia = valOr(d.provincia || ub[1] || ub[0]);
    setV('D6', contratista); setV('D7', plano); setV('D8', provincia);
    setV('I6', distrito); setV('I7', valOr(d.direccion)); setV('I8', fecha);
    // N° de poste en los 4 rótulos, en tamaño 12 (la plantilla traía 16)
    ['F13', 'L13', 'F45', 'L45'].forEach(a => { const c = ws.getCell(shiftAddr(a, off)); c.value = num; c.font = { ...(c.font || {}), size: 12 }; });
    setV('G14', null);
    for (const [key, item] of FOTOS) {
      const foto = getFotoPoste(p, item);
      if (!foto) continue;
      let buf = null;
      try { buf = await procesarFotoExport(foto, makeDatosEstampado(p, proy), logoBuffer, stampConfig); } catch (e) {}
      if (!buf) continue;
      const a = ANCHOR[key];
      const fit = await fitImagen(buf, EXT.width, EXT.height);
      const id = wb.addImage({ buffer: buf, extension: 'jpeg' });
      ws.addImage(id, { tl: { nativeCol: a.col, nativeColOff: a.off + fit.colOffExtra, nativeRow: a.row + off, nativeRowOff: a.roff + fit.rowOffExtra }, ext: fit.ext, editAs: 'oneCell' });
    }
    if (i < N - 1) ws.getRow(START + off + BLOCK - 1).addPageBreak();
  }

  // 3. Sin postes eléctricos: conservar encabezado, reemplazar la grilla por un mensaje
  if (N === 0) {
    insertarMensajeSinDatos(ws, 13, 'NO SE USARON POSTES ELÉCTRICOS EN ESTE PLANO');
  } else if (N < 2) {
    // Quitar bloques de ejemplo sobrantes si hay menos de 2 postes
    const desde = START + Math.max(N, 0) * BLOCK;
    (ws.model.merges || []).slice().forEach(m => { if (rowOf(m.split(':')[0]) >= desde) { try { ws.unMergeCells(m); } catch (e) {} } });
    if (desde <= ws.rowCount) ws.spliceRows(desde, ws.rowCount - desde + 1);
  }

  const content = await wb.xlsx.writeBuffer();
  return [{
    nombre: `REPORTE FOTOGRAFICO DE POSTES ELECTRICOS - ${proy.nombre || 'PROYECTO'}.xlsx`,
    buffer: Buffer.from(content),
    numPuntos: N,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }];
};

// ============================================================
// REPORTE FOTOGRÁFICO — TENDIDO DE FO (usa plantilla)
// Todos los puntos en orden de posición (ordenTendido). Bloque = 2 fotos
// (izq/der), 1 punto cada una: REGION · DISTRITO · N° de posición + foto frontal.
// ============================================================
const generarReporteTendido = async (proy, puntosProyecto, logoBuffer, stampConfig) => {
  const TPL_PATH = path.join(__dirname, 'templates', 'RF_TENDIDO_DE_FO.xlsx');
  const BLOCK = 23, START = 7;

  const puntos = [...puntosProyecto].sort((a, b) => {
    const oa = a.datos && a.datos.ordenTendido, ob = b.datos && b.datos.ordenTendido;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1;
    if (ob != null) return 1;
    return parseInt(a.id) - parseInt(b.id);
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TPL_PATH);
  const ws = wb.worksheets[0];

  // Capturar bloque modelo (filas START..START+BLOCK-1)
  const model = { heights: [], cells: [] };
  for (let r = 0; r < BLOCK; r++) {
    const row = ws.getRow(START + r);
    model.heights[r] = row.height;
    const cs = [];
    for (let c = 1; c <= 12; c++) { const cell = row.getCell(c); cs.push({ c, style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : null, value: cell.value }); }
    model.cells.push(cs);
  }
  const rowOf = (a) => parseInt(a.match(/\d+/)[0], 10);
  const shiftAddr = (a, d) => a.replace(/([A-Z]+)(\d+)/g, (m, col, n) => col + (parseInt(n, 10) + d));
  const modelMerges = (ws.model.merges || []).filter(m => { const t = rowOf(m.split(':')[0]); return t >= START && t < START + BLOCK; });

  const EXT = { width: 541, height: 721 };
  const ANCHOR = {
    L: { col: 1, off: 196663, roff: 180000 }, // foto izquierda
    R: { col: 7, off: 210110, roff: 180000 }, // foto derecha
  };
  const PHOTO_NROW = 9; // nativeRow (0-based) de la foto en el bloque 0

  const tiposDeTendido = (d) => { const r = d && d.tipoElemento; return Array.isArray(r) ? r : (r ? [r] : []); };
  const esMedioTramoTendido = (d) => tiposDeTendido(d).includes('medioTramo');
  const normalizarFoto = (val) => {
    if (!val) return null;
    let url = typeof val === 'string' ? val : (val.url || val.urlHD);
    if (url && url.startsWith('blob:')) url = null;
    const thumb = (typeof val === 'object' && typeof val.thumb === 'string') ? val.thumb : null;
    if (!url && !thumb) return null;
    return { url, thumb, fechaCaptura: (typeof val === 'object' ? val.fechaCaptura : null), horaCaptura: (typeof val === 'object' ? val.horaCaptura : null) };
  };
  // Poste normal: frontal (pestaña POSTE). Medio tramo: no tiene sección POSTE —
  // usa VISTA DE COSTADO y, si falta, VISTA DESDE ABAJO o ZOOM A LA FERRETERÍA.
  const getFrontal = (p) => {
    const d = p.datos || {};
    const fotos = d.fotos || {};
    if (esMedioTramoTendido(d)) {
      const mt = fotos.medioTramo || {};
      for (const item of ['vistaCostado', 'vistaAbajo', 'zoomFerreteria']) {
        const f = normalizarFoto(mt[item]);
        if (f) return f;
      }
      return null;
    }
    return normalizarFoto(fotos.poste && fotos.poste.frontal);
  };
  const valOr = (v) => (v && String(v).trim() && String(v).trim() !== '-') ? String(v).trim() : 'SN';
  const ubParts = (d) => String(d.ubicacion || '').split(',').map(s => s.trim()).filter(Boolean);
  const distritoDe = (d) => valOr(d.distrito || ubParts(d)[0]);
  // OJO: NO usar d.estado — ese campo es el estado del punto ('confirmado'), no la región.
  const regionDe = (d) => valOr(d.region || d.provincia || ubParts(d)[1] || ubParts(d)[0]);

  const N = puntos.length;
  const nBlocks = Math.max(1, Math.ceil(N / 2));

  // Replicar bloque modelo para b >= 1 (el bloque 0 ya está en la plantilla)
  for (let b = 1; b < nBlocks; b++) {
    const off = b * BLOCK;
    for (let r = 0; r < BLOCK; r++) {
      const trow = ws.getRow(START + off + r);
      if (model.heights[r] != null) trow.height = model.heights[r];
      for (const mc of model.cells[r]) { const tc = trow.getCell(mc.c); if (mc.style) tc.style = mc.style; if (mc.value !== null && mc.value !== undefined) tc.value = mc.value; }
    }
    for (const m of modelMerges) { const [a, bb] = m.split(':'); try { ws.mergeCells(shiftAddr(a, off) + ':' + shiftAddr(bb, off)); } catch (e) {} }
  }

  // Encabezado
  ws.getCell('C4').value = proy.nombre || '';
  ws.getCell('C5').value = puntos[0] ? distritoDe(puntos[0].datos || {}) : 'SN';

  // Llenar cada punto (2 por bloque)
  for (let k = 0; k < N; k++) {
    const p = puntos[k]; const d = p.datos || {};
    const b = Math.floor(k / 2); const isLeft = (k % 2) === 0; const off = b * BLOCK;
    const cols = isLeft ? { reg: 'B', dis: 'C', num: 'D' } : { reg: 'H', dis: 'I', num: 'J' };
    ws.getCell(shiftAddr(cols.reg + '8', off)).value = regionDe(d);
    ws.getCell(shiftAddr(cols.dis + '8', off)).value = distritoDe(d);
    ws.getCell(shiftAddr(cols.num + '8', off)).value = (d.numero || ''); // ITEM (orden va por posición)
    const foto = getFrontal(p);
    if (foto) {
      let buf = null;
      try { buf = await procesarFotoExport(foto, makeDatosEstampado(p, proy), logoBuffer, stampConfig); } catch (e) {}
      if (buf) {
        const a = isLeft ? ANCHOR.L : ANCHOR.R;
        const fit = await fitImagen(buf, EXT.width, EXT.height);
        const id = wb.addImage({ buffer: buf, extension: 'jpeg' });
        ws.addImage(id, { tl: { nativeCol: a.col, nativeColOff: a.off + fit.colOffExtra, nativeRow: PHOTO_NROW + off, nativeRowOff: a.roff + fit.rowOffExtra }, ext: fit.ext, editAs: 'oneCell' });
      }
    }
  }

  // Forzar la línea vertical derecha en las 3 filas del encabezado de cada bloque (izq=F, der=L)
  const thinR = { style: 'thin', color: { argb: 'FF000000' } };
  for (let b = 0; b < nBlocks; b++) {
    const off = b * BLOCK;
    for (const rr of [7, 8, 9]) {
      for (const col of ['F', 'L']) {
        const cell = ws.getCell(shiftAddr(col + rr, off));
        cell.border = { ...(cell.border || {}), right: thinR };
      }
    }
  }

  const content = await wb.xlsx.writeBuffer();
  return [{
    nombre: `REPORTE FOTOGRAFICO DEL TENDIDO DE FO - ${proy.nombre || 'PROYECTO'}.xlsx`,
    buffer: Buffer.from(content),
    numPuntos: N,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }];
};

// ============================================================
// REPORTE PEXT — RF DE LA FERRETERÍA (usa plantilla .xlsm → sale .xlsx)
// Bloques de 4 puntos (orden de posición). Por slot: lista de materiales
// (celda izq), foto de ferretería (parte superior), y rótulo item/prop/código
// (o texto de "medio tramo"). Propietario se llena en la hoja PROPIETARIOS.
// ============================================================
const generarReporteFerreteria = async (proy, puntosProyecto, logoBuffer, stampConfig, catalogoFerreteria) => {
  const TPL_PATH = path.join(__dirname, 'templates', 'RF_DE_LA_FERRETERIA.xlsm');
  const START = 13, BLOCK = 12, SPACING = 13; // bloque 13-24 + 1 fila libre

  const puntos = [...puntosProyecto].sort((a, b) => {
    const oa = a.datos && a.datos.ordenTendido, ob = b.datos && b.datos.ordenTendido;
    if (oa != null && ob != null) return oa - ob;
    if (oa != null) return -1;
    if (ob != null) return 1;
    return parseInt(a.id) - parseInt(b.id);
  });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TPL_PATH);
  const ws = wb.worksheets[0];

  // Capturar bloque modelo (filas 13-24)
  const model = { heights: [], cells: [] };
  for (let r = 0; r < BLOCK; r++) {
    const row = ws.getRow(START + r);
    model.heights[r] = row.height;
    const cs = [];
    for (let c = 1; c <= 21; c++) { const cell = row.getCell(c); cs.push({ c, style: cell.style ? JSON.parse(JSON.stringify(cell.style)) : null, value: cell.value }); }
    model.cells.push(cs);
  }
  const rowOf = (a) => parseInt(a.match(/\d+/)[0], 10);
  const shiftAddr = (a, d) => a.replace(/([A-Z]+)(\d+)/g, (m, col, n) => col + (parseInt(n, 10) + d));
  const modelMerges = (ws.model.merges || []).filter(m => { const t = rowOf(m.split(':')[0]); return t >= START && t < START + BLOCK + 1; });

  // Slots: columna de materiales (ancha, izq) + columna izq de la foto (nativeCol 0-based)
  const SLOTS = [
    { mat: 'C', pcol: 3 },   // foto D:F
    { mat: 'H', pcol: 8 },   // foto I:K
    { mat: 'M', pcol: 13 },  // foto N:P
    { mat: 'R', pcol: 18 },  // foto S:U
  ];
  const EXT = { width: 174, height: 232 };
  const PHOTO_NROW = 12; // 0-based (fila 13) para el bloque 0

  const porId = new Map((catalogoFerreteria || []).map(f => [f.id, f]));
  const getConsolidado = (d) => {
    const t = {};
    if (d.ferreteriaFinal && Object.keys(d.ferreteriaFinal).length > 0) { Object.entries(d.ferreteriaFinal).forEach(([id, c]) => { if (c) t[id] = (t[id] || 0) + c; }); return t; }
    (d.armadosSeleccionados || []).forEach(a => (a.items || []).forEach(it => { t[it.idRef] = (t[it.idRef] || 0) + it.cant; }));
    Object.entries(d.ferreteriaExtra || {}).forEach(([id, c]) => { if (c) t[id] = (t[id] || 0) + c; });
    return t;
  };
  const materialesTexto = (d) => Object.entries(sinCableAcero(getConsolidado(d)))
    .filter(([id, c]) => c > 0 && porId.has(id))
    .map(([id, c]) => `- ${c}  ${porId.get(id).nombre}`).join('\n');

  const tiposDe = (d) => { const r = d && d.tipoElemento; return Array.isArray(r) ? r : (r ? [r] : []); };
  const esMedioTramo = (d) => tiposDe(d).includes('medioTramo');

  // Nombres de empresa según el PROPIETARIO del punto (llegan del modal del cliente)
  const EMPRESAS = (stampConfig && stampConfig.empresas) || {};
  const normProp = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const nombreEmpresa = (d) => {
    const t = normProp(d && d.tipoPoste);
    if (t === 'electrico') return String(EMPRESAS.electrica || '').trim() || 'SN';
    if (t === 'propio') return String(EMPRESAS.propietaria || '').trim() || 'SN';
    if (t === 'tercero') return String(EMPRESAS.teleco || '').trim() || 'SN';
    return 'SN';
  };
  // Rótulo bajo la foto: "ITEM / EMPRESA / CÓDIGO" (SC si no hay código).
  // Medio tramo: "MEDIO TRAMO - ITEM".
  const rotuloDe = (d) => {
    const item = String((d && d.numero) || '').trim();
    if (esMedioTramo(d)) return item ? `MEDIO TRAMO - ${item}` : 'MEDIO TRAMO';
    const cod = String((d && d.codigo) || '').trim() || 'SC';
    return `${item || 'SN'} / ${nombreEmpresa(d)} / ${cod}`;
  };

  const getFotoFerr = (p) => {
    const d = p.datos || {};
    const fotos = d.fotos || {};
    // Medio tramo no tiene sección POSTE: su equivalente es ZOOM A LA FERRETERÍA
    const val = esMedioTramo(d)
      ? (fotos.medioTramo && fotos.medioTramo.zoomFerreteria)
      : (fotos.poste && fotos.poste.ferreteria);
    if (!val) return null;
    let url = typeof val === 'string' ? val : (val.url || val.urlHD);
    if (url && url.startsWith('blob:')) url = null;
    const thumb = (typeof val === 'object' && typeof val.thumb === 'string') ? val.thumb : null;
    if (!url && !thumb) return null;
    return { url, thumb, fechaCaptura: (typeof val === 'object' ? val.fechaCaptura : null), horaCaptura: (typeof val === 'object' ? val.horaCaptura : null) };
  };

  const N = puntos.length;
  const nBlocks = Math.max(1, Math.ceil(N / 4));

  // Replicar bloque para b >= 1
  for (let b = 1; b < nBlocks; b++) {
    const off = b * SPACING;
    for (let r = 0; r < BLOCK; r++) {
      const trow = ws.getRow(START + off + r);
      if (model.heights[r] != null) trow.height = model.heights[r];
      for (const mc of model.cells[r]) { const tc = trow.getCell(mc.c); if (mc.style) tc.style = mc.style; if (mc.value !== null && mc.value !== undefined) tc.value = mc.value; }
    }
    for (const m of modelMerges) { const [a, bb] = m.split(':'); try { ws.mergeCells(shiftAddr(a, off) + ':' + shiftAddr(bb, off)); } catch (e) {} }
  }

  // Encabezado (solo amarillos)
  ws.getCell('S6').value = proy.nombre || '';                        // PROYECTO
  ws.getCell('H9').value = proy.ownerEmpresa || '';                  // NOMBRE DEL CONTRATISTA / empresa
  ws.getCell('S9').value = new Date().toLocaleDateString('es-PE');   // FECHA TERMINACIÓN (fecha del reporte)

  // Llenar cada punto (4 por bloque)
  for (let k = 0; k < N; k++) {
    const p = puntos[k]; const d = p.datos || {};
    const b = Math.floor(k / 4); const s = k % 4; const off = b * SPACING;
    const slot = SLOTS[s];

    // Materiales (celda ancha izquierda, lista vertical)
    try { ws.mergeCells(shiftAddr(slot.mat + '13', off) + ':' + shiftAddr(slot.mat + '23', off)); } catch (e) {}
    const matCell = ws.getCell(shiftAddr(slot.mat + '13', off));
    matCell.value = materialesTexto(d);
    matCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    matCell.font = { size: 5 };

    // Rótulo directo: "ITEM / EMPRESA / CÓDIGO" o "MEDIO TRAMO - ITEM"
    ws.getCell(shiftAddr(slot.mat + '24', off)).value = rotuloDe(d);

    // Foto de ferretería (parte superior) — con sello
    const foto = getFotoFerr(p);
    if (foto) {
      let buf = null;
      try { buf = await procesarFotoExport(foto, makeDatosEstampado(p, proy), logoBuffer, stampConfig); } catch (e) {}
      if (buf) {
        const fit = await fitImagen(buf, EXT.width, EXT.height);
        const id = wb.addImage({ buffer: buf, extension: 'jpeg' });
        ws.addImage(id, { tl: { nativeCol: slot.pcol, nativeColOff: 45000 + fit.colOffExtra, nativeRow: PHOTO_NROW + off, nativeRowOff: 80000 + fit.rowOffExtra }, ext: fit.ext, editAs: 'oneCell' });
      }
    }
  }

  // Forzar bordes en cada bloque (se pierden al replicar), SIN tocar las celdas
  // amarillas de materiales (borde grueso rojo) ni los separadores delgados (G/L/Q).
  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  const red = { style: 'thick', color: { argb: 'FFFF0000' } };
  const photoCols = [4, 5, 6, 9, 10, 11, 14, 15, 16, 19, 20, 21]; // D-F, I-K, N-P, S-U
  const photoRight = [6, 11, 16, 21];   // F K P U (derecha de cada foto)
  const labelCols = [3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 18, 19, 20, 21]; // cols de los 4 rótulos
  const labelLeft = [3, 8, 13, 18];     // C H M R (izq de cada rótulo)
  const matCols = [3, 8, 13, 18];       // C H M R (celdas de materiales, borde rojo)
  const sepCols = [7, 12, 17];          // G L Q (separadores delgados)
  for (let b = 0; b < nBlocks; b++) {
    const off = b * SPACING;
    const rTop = START + off, rBot = START + off + 10, rLbl = START + off + 11; // fila 13 / 23 / 24
    // foto: borde superior + derecho
    for (const c of photoCols) { const cell = ws.getRow(rTop).getCell(c); cell.border = { ...(cell.border || {}), top: thin }; }
    for (let rr = 0; rr <= 10; rr++) { for (const c of photoRight) { const cell = ws.getRow(START + off + rr).getCell(c); cell.border = { ...(cell.border || {}), right: thin }; } }
    // rótulo (fila 24): top solo en la parte de la foto (no pisar el rojo de arriba), bottom en todo, left/right
    for (const c of photoCols) { const cell = ws.getRow(rLbl).getCell(c); cell.border = { ...(cell.border || {}), top: thin }; }
    for (const c of labelCols) { const cell = ws.getRow(rLbl).getCell(c); cell.border = { ...(cell.border || {}), bottom: thin }; }
    for (const c of labelLeft) { const cell = ws.getRow(rLbl).getCell(c); cell.border = { ...(cell.border || {}), left: thin }; }
    for (const c of photoRight) { const cell = ws.getRow(rLbl).getCell(c); cell.border = { ...(cell.border || {}), right: thin }; }
    // separadores: sin líneas
    for (let rr = 0; rr <= 11; rr++) { for (const c of sepCols) { ws.getRow(START + off + rr).getCell(c).border = {}; } }
    // caja roja de materiales en la celda MAESTRA (C13/H13/M13/R13). Al guardar,
    // ExcelJS solo conserva el borde de la maestra de la combinación → así sí sale el borde inferior.
    for (const c of matCols) { ws.getRow(START + off).getCell(c).border = { top: red, bottom: red, left: red, right: red }; }
  }

  const content = await wb.xlsx.writeBuffer();
  return [{
    nombre: `REPORTE FOTOGRAFICO DE LA FERRETERÍA - ${proy.nombre || 'PROYECTO'}.xlsx`,
    buffer: Buffer.from(content),
    numPuntos: N,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }];
};

// ============================================================
// REPORTE RF EQUIPOS PASIVOS (servidor) — port fiel del generador cliente
// (src/utils/rfEquiposPasivos.js). Fotos: fetch/thumb + upscale + sello + anclado
// con desplazamiento 70px/12px, sin deformar.
// ============================================================
const generarReporteRfEquiposPasivos = async (proy, puntosProyecto, logoBuffer, stampConfig) => {
  const TPL_PATH = path.join(__dirname, 'templates', 'RF_EQUIPOS_PASIVOS.xlsx');
  const txt = (ws, addr) => {
    let v = ws.getCell(addr).value;
    if (v && typeof v === 'object') v = v.richText ? v.richText.map(t => t.text).join('') : (v.text || v.result || '');
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  };
  const colToNum = (s) => { let n = 0; for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64); return n; };
  const colPx = (ws, c) => Math.round(((ws.getColumn(c).width || 8.43) * 7) + 5);
  const rowPx = (ws, r) => Math.round((ws.getRow(r).height || 15) * 4 / 3);
  const set = (ws, addr, val) => {
    if (val == null || val === '') return;
    const cell = ws.getCell(addr);
    cell.value = val;
    cell.font = Object.assign({}, cell.font || {}, { color: { argb: 'FF000000' } });
  };
  const urlHttp = (x) => typeof x === 'string' && x.startsWith('http');
  const esImg = (x) => typeof x === 'string' && (x.startsWith('http') || x.startsWith('data:'));
  const fuenteFoto = (f) => {
    if (!f) return null;
    if (typeof f === 'string') return esImg(f) ? { url: f, thumb: null } : null;
    const url = urlHttp(f.url) ? f.url : (urlHttp(f.urlHD) ? f.urlHD : null);
    const thumb = esImg(f.thumb) ? f.thumb : null;
    if (!url && !thumb) return null;
    return { url, thumb };
  };
  const normFat = (val) => String(val || '').replace(/^fat[\s\-]*/i, '').trim();
  // Un poste puede tener VARIOS equipos pasivos (FAT + HBOX...), cada uno con su
  // propio código y serie en datos.equipos. Puntos antiguos (sin esa lista) caen a
  // los campos sueltos datos.pasivo / datos.codigoSerie.
  const equipoDe = (d, tipo) => {
    const lista = Array.isArray(d && d.equipos) ? d.equipos : [];
    const e = lista.find(x => x && x.tipo === tipo);
    if (e) return { pasivo: String(e.pasivo || '').trim(), serie: String(e.codigoSerie || '').trim() };
    if (!lista.length) return { pasivo: String((d && d.pasivo) || '').trim(), serie: String((d && d.codigoSerie) || '').trim() };
    return { pasivo: '', serie: '' };
  };
  const tiposDe = (d) => { const r = d && d.tipoElemento; return Array.isArray(r) ? r : (r ? [r] : []); };
  const numEn = (s) => { const m = String(s || '').match(/\d+/); return m ? parseInt(m[0], 10) : 0; };
  const ordenHbox = (p) => { const s = String(p || '').toUpperCase(); const m = s.match(/HB\s*(\d+)/); return m ? parseInt(m[1], 10) : numEn(p); };
  const ciudadDe = (d) => {
    let c = '';
    const ub = String((d && d.ubicacion) || '').split(',').map(s => s.trim()).filter(Boolean);
    if (ub.length) c = ub[ub.length - 1];
    else c = (d && (d.provincia || d.departamento || d.ciudad)) || '';
    return c.replace(/\s*metropolitana\s*/i, ' ').replace(/\s+/g, ' ').trim();
  };
  const distritoDe = (d) => {
    if (d && d.distrito) return d.distrito;
    const ub = String((d && d.ubicacion) || '').split(',').map(s => s.trim()).filter(Boolean);
    return ub[0] || '';
  };
  const primeraFoto = (fotos, seccion, candidatos) => {
    for (const cand of candidatos) {
      let v;
      if (cand.includes('.')) {
        const parts = cand.split('.'); const sub = parts[0], it = parts[1];
        const anidado = fotos && fotos[seccion] && fotos[seccion][sub] && fotos[seccion][sub][it];
        v = anidado != null ? anidado : (fotos && fotos[seccion] && fotos[seccion][it]);
      } else v = fotos && fotos[seccion] && fotos[seccion][cand];
      const s = fuenteFoto(v);
      if (s) return { url: s.url, thumb: s.thumb };
    }
    return null;
  };
  const runParallel = async (items, fn, conc = 6) => {
    const out = new Array(items.length); let i = 0;
    const work = async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch { out[k] = null; } } };
    await Promise.all(Array.from({ length: Math.min(conc, items.length || 1) }, work));
    return out;
  };
  const escanearBloques = (ws) => {
    const merges = (ws.model && ws.model.merges) || [];
    const mergeDesde = (col, top) => merges.find(m => {
      const mm = m.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      return mm && mm[1] === col && +mm[2] >= top && +mm[2] <= top + 2 && (+mm[4] - +mm[2]) >= 8;
    });
    const bloques = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      if (!/IMPLEMENTACION/i.test(txt(ws, `D${r}`))) continue;
      const izq = /FOTOGRAFIA/i.test(txt(ws, `B${r + 2}`)) ? mergeDesde('B', r + 3) : null;
      const conDerecha = /IMPLEMENTACION/i.test(txt(ws, `K${r}`)) || /FOTOGRAFIA/i.test(txt(ws, `I${r + 2}`));
      const der = conDerecha ? mergeDesde('I', r + 3) : null;
      let fechaRow = null;
      for (let f = r + 3; f <= Math.min(r + 34, ws.rowCount); f++) {
        if (/IMPLEMENTACION/i.test(txt(ws, `D${f}`))) break;
        if (/FECHA DE INSPECCION/i.test(txt(ws, `B${f}`))) { fechaRow = f; break; }
      }
      bloques.push({ header: r, izq, der, conDerecha, fechaRow });
    }
    return bloques;
  };
  const llenarBloque = (ws, b, eq, fechaHoy) => {
    const rv = b.header + 1;
    set(ws, `B${rv}`, eq.ciudad); set(ws, `C${rv}`, eq.distrito); set(ws, `D${rv}`, eq.pasivo);
    if (b.conDerecha) { set(ws, `I${rv}`, eq.ciudad); set(ws, `J${rv}`, eq.distrito); set(ws, `K${rv}`, eq.pasivo); }
    if (b.fechaRow) { set(ws, `C${b.fechaRow}`, fechaHoy); if (b.conDerecha) set(ws, `J${b.fechaRow}`, fechaHoy); }
  };
  const CFG = {
    XBOX: {
      tipo: 'xbox', bloquesPorEquipo: 4, seccion: () => 'xbox',
      fotos: [
        [['frontalBandeja'], ['posteriorBandeja']],
        [['bandejasAseguradas'], ['fibraAsegurada']],
        [['cierreCarcasa'], ['panoramica']],
        [['etiquetaEntrada'], ['etiquetaSalida', 'sub_etiquetaSalida.salida1']],
      ],
      orden: (d) => numEn(equipoDe(d, 'xbox').pasivo),
    },
    HUBBOX: {
      tipo: 'hbox', bloquesPorEquipo: 2, seccion: () => 'hbox',
      fotos: [
        [['cierreCarcasa'], ['panoramica']],
        [['etiquetaIngreso'], ['sub_etiquetaFat.salida1', 'sub_etiquetaFat.salida2', 'sub_etiquetaFat.salida3']],
      ],
      orden: (d) => ordenHbox(equipoDe(d, 'hbox').pasivo),
    },
    FAT: {
      tipo: 'fat', bloquesPorEquipo: 2,
      seccion: () => 'fatPrecoNueva',
      fotos: [
        [['frontalRotulado'], ['panoramica', 'perfil']],
        [['etiqueta', 'codigoSerie'], null],
      ],
      orden: (d) => numEn(equipoDe(d, 'fat').pasivo),
    },
  };

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TPL_PATH);
  const todos = puntosProyecto || [];
  const nombreProyecto = proy.nombre || '';
  const fechaHoy = new Date().toLocaleDateString('es-PE');

  const datosSello = (punto) => {
    const d = (punto && punto.datos) || {};
    const c = (punto && punto.coords) || {};
    const lat = (c.lat || 0).toFixed(6), lng = (c.lng || 0).toFixed(6);
    return {
      numero: String(d.numero || ''),
      proyecto: nombreProyecto,
      gps: `${lat}, ${lng}`,
      fecha: d.fecha || new Date().toISOString(),
      hora: d.hora || '',
      codFat: normFat(d.codFat || ''),
      pasivo: String(d.pasivo || ''),
      direccion: d.direccion || '',
      ubicacion: d.ubicacion || '',
    };
  };

  const jobs = [];

  // Hojas de equipos
  for (const hoja of Object.keys(CFG)) {
    const cfg = CFG[hoja];
    const ws = wb.getWorksheet(hoja);
    if (!ws) continue;
    const unidades = todos
      .filter(p => tiposDe(p.datos || {}).includes(cfg.tipo))
      .sort((a, b) => cfg.orden(a.datos || {}) - cfg.orden(b.datos || {}));
    if (!unidades.length) continue;
    const d0 = unidades[0].datos || {};
    const rDir = hoja === 'XBOX' ? 6 : 5;
    set(ws, `C${rDir}`, d0.direccion || '');
    set(ws, `C${rDir + 1}`, nombreProyecto);
    set(ws, `C${rDir + 3}`, distritoDe(d0));
    const bloques = escanearBloques(ws);
    const capacidad = Math.floor(bloques.length / cfg.bloquesPorEquipo);
    unidades.slice(0, capacidad).forEach((unit, u) => {
      const d = unit.datos || {};
      const eq = { ciudad: ciudadDe(d), distrito: distritoDe(d), pasivo: equipoDe(d, cfg.tipo).pasivo };
      for (let bi = 0; bi < cfg.bloquesPorEquipo; bi++) {
        const b = bloques[u * cfg.bloquesPorEquipo + bi];
        if (!b) break;
        llenarBloque(ws, b, eq, fechaHoy);
        const par = cfg.fotos[bi] || [null, null];
        const candIzq = par[0], candDer = par[1];
        const sec = cfg.seccion(d);
        if (candIzq && b.izq) { const f = primeraFoto(d.fotos, sec, candIzq); if (f) jobs.push({ ws, merge: b.izq, url: f.url, thumb: f.thumb, punto: unit }); }
        if (candDer && b.der) { const f = primeraFoto(d.fotos, sec, candDer); if (f) jobs.push({ ws, merge: b.der, url: f.url, thumb: f.thumb, punto: unit }); }
      }
    });
  }

  // INVENTARIO
  const wsInv = wb.getWorksheet('INVENTARIO');
  if (wsInv) {
    const porTipo = (tipo, orden) => todos
      .filter(p => tiposDe(p.datos || {}).includes(tipo))
      .sort((a, b) => orden(a.datos || {}) - orden(b.datos || {}));
    const seccionSerieDe = (d, tipo) => tipo === 'xbox' ? 'xbox' : tipo === 'hbox' ? 'hbox' : 'fatPrecoNueva';
    const equipos = [];
    const tipos = [
      ['xbox', (d) => numEn(equipoDe(d, 'xbox').pasivo)],
      ['hbox', (d) => ordenHbox(equipoDe(d, 'hbox').pasivo)],
      ['fat', (d) => numEn(equipoDe(d, 'fat').pasivo)],
    ];
    for (const [tipo, orden] of tipos) {
      for (const p of porTipo(tipo, orden)) {
        const d = p.datos || {};
        equipos.push({
          punto: p,
          item: String(d.numero || '').trim(),
          pasivo: equipoDe(d, tipo).pasivo,
          serie: equipoDe(d, tipo).serie,
          ciudad: ciudadDe(d), distrito: distritoDe(d),
          foto: primeraFoto(d.fotos, seccionSerieDe(d, tipo), ['codigoSerie']),
        });
      }
    }
    if (equipos.length) { set(wsInv, 'C5', nombreProyecto); set(wsInv, 'C6', equipos[0].distrito); }
    const mergesInv = (wsInv.model && wsInv.model.merges) || [];
    const mergeDesdeInv = (col, top) => mergesInv.find(m => {
      const mm = m.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
      return mm && mm[1] === col && +mm[2] >= top && +mm[2] <= top + 2 && (+mm[4] - +mm[2]) >= 8;
    });
    const slots = [];
    for (let r = 1; r <= wsInv.rowCount; r++) {
      if (!/^REGION$/i.test(txt(wsInv, `B${r}`))) continue;
      slots.push({ header: r, lado: 'B' });
      if (/^REGION$/i.test(txt(wsInv, `I${r}`))) slots.push({ header: r, lado: 'I' });
    }
    slots.forEach((slot, i) => {
      const eq = equipos[i];
      if (!eq) return;
      const r = slot.header;
      if (slot.lado === 'B') {
        set(wsInv, `D${r}`, eq.item);
        set(wsInv, `B${r + 1}`, eq.ciudad); set(wsInv, `C${r + 1}`, eq.distrito); set(wsInv, `D${r + 1}`, eq.pasivo);
        set(wsInv, `E${r + 2}`, eq.serie);
        const mg = mergeDesdeInv('B', r + 3);
        if (eq.foto && mg) jobs.push({ ws: wsInv, merge: mg, url: eq.foto.url, thumb: eq.foto.thumb, punto: eq.punto });
      } else {
        set(wsInv, `K${r}`, eq.item);
        set(wsInv, `I${r + 1}`, eq.ciudad); set(wsInv, `J${r + 1}`, eq.distrito); set(wsInv, `K${r + 1}`, eq.pasivo);
        set(wsInv, `L${r + 2}`, eq.serie);
        const mg = mergeDesdeInv('I', r + 3);
        if (eq.foto && mg) jobs.push({ ws: wsInv, merge: mg, url: eq.foto.url, thumb: eq.foto.thumb, punto: eq.punto });
      }
    });
  }

  // Procesar fotos: fetch/thumb → upscale → sello → dims
  const procesar = async (job) => {
    let buf = null;
    if (job.url) { try { buf = await fetchPhotoBuffer(job.url); } catch { buf = null; } }
    if (!buf && job.thumb) { try { buf = await thumbToBuffer(job.thumb); } catch { buf = null; } }
    if (!buf) return null;
    buf = await upscaleIfSmall(buf);
    if (!stampConfig.sinDatos) {
      try { buf = await estamparMetadatos(buf, datosSello(job.punto), logoBuffer, stampConfig); } catch (e) { /* sin sello si falla */ }
    }
    let nat = null;
    try { const img = await loadImage(buf); nat = { w: img.width, h: img.height }; } catch { /* dims desconocidas */ }
    return { buffer: Buffer.from(buf), nat };
  };
  const datos = await runParallel(jobs, procesar);
  jobs.forEach((j, k) => {
    const info = datos[k];
    if (!info) return;
    const imgId = wb.addImage({ buffer: info.buffer, extension: 'jpeg' });
    const mm = j.merge.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    const c1 = colToNum(mm[1]), r1 = +mm[2], c2 = colToNum(mm[3]), r2 = +mm[4];
    const OFF_X = 70, OFF_Y = 12;
    const tl = { col: (c1 - 1) + OFF_X / colPx(j.ws, c1), row: (r1 - 1) + OFF_Y / rowPx(j.ws, r1) };
    if (!info.nat || !info.nat.w || !info.nat.h) { j.ws.addImage(imgId, { tl, br: { col: c2, row: r2 } }); return; }
    let boxW = 0; for (let c = c1; c <= c2; c++) boxW += colPx(j.ws, c);
    let boxH = 0; for (let r = r1; r <= r2; r++) boxH += rowPx(j.ws, r);
    const scale = Math.min(boxW / info.nat.w, boxH / info.nat.h) * 0.97;
    const dw = Math.max(1, Math.round(info.nat.w * scale)), dh = Math.max(1, Math.round(info.nat.h * scale));
    j.ws.addImage(imgId, { tl, ext: { width: dw, height: dh } });
  });

  const content = await wb.xlsx.writeBuffer();
  const equipos = todos.filter(p => tiposDe(p.datos || {}).some(t => ['xbox', 'hbox', 'fat'].includes(t))).length;
  return [{
    nombre: `REPORTE FOTOGRAFICO DE EQUIPOS PASIVOS - ${nombreProyecto || 'PROYECTO'}.xlsx`,
    buffer: Buffer.from(content),
    numPuntos: equipos,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }];
};

// ============================================================
// CLOUD FUNCTION 1 — HTTP Callable
// Crea el job en Firestore y retorna el exportId inmediatamente.
// ============================================================

exports.crearExportacion = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const { proyectoId, tipo, limiteFotos = 700, stampConfig = {} } = request.data;
  if (!proyectoId || !tipo) throw new HttpsError('invalid-argument', 'Faltan parámetros.');

  const userId = request.auth.uid;

  // Verificar acceso al proyecto
  const proyDoc = await db.collection('proyectos').doc(proyectoId).get();
  if (!proyDoc.exists) throw new HttpsError('not-found', 'Proyecto no encontrado.');
  const proy = proyDoc.data();
  // Dueño, o miembro (`miembrosUids`), sea editor o supervisor: exportar no modifica la
  // obra. Desde el paso 6 ya no se mira `compartidoCon`, el sistema viejo.
  const tieneAcceso = proy.ownerId === userId
    || (Array.isArray(proy.miembrosUids) && proy.miembrosUids.includes(userId));
  if (!tieneAcceso) throw new HttpsError('permission-denied', 'Sin acceso al proyecto.');

  const exportRef = await db.collection('exportaciones').add({
    userId,
    proyectoId,
    tipo: tipo.toUpperCase(),
    limiteFotos,
    stampConfig,
    status: 'pendiente',
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { exportId: exportRef.id };
});

// ============================================================
// CLOUD FUNCTION 2 — Firestore Trigger
// Se dispara cuando se crea un doc en 'exportaciones/{exportId}'.
// Hace todo el trabajo de procesamiento.
// ============================================================

exports.procesarExportacion = onDocumentCreated(
  { document: 'exportaciones/{exportId}', memory: '4GiB', timeoutSeconds: 540 },
  async (event) => {
    const exportId = event.params.exportId;
    const data = event.data.data();
    const exportRef = db.collection('exportaciones').doc(exportId);

    try {
      await exportRef.update({ status: 'procesando' });

      const { userId, proyectoId, tipo, limiteFotos = 700, stampConfig = {} } = data;

      // Cargar proyecto
      const proyDoc = await db.collection('proyectos').doc(proyectoId).get();
      if (!proyDoc.exists) throw new Error('Proyecto no encontrado');
      const proy = { id: proyectoId, ...proyDoc.data() };

      // Cargar puntos del proyecto (de cualquier autor: dueño o editores).
      // Se consulta por proyectoId — robusto para proyectos compartidos/colaborativos.
      const diasIds = new Set((proy.dias || []).map(d => d.id));
      let puntosProyecto = [];
      try {
        const puntosSnap = await db.collection('puntos').where('proyectoId', '==', proyectoId).get();
        puntosProyecto = puntosSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      } catch (e) { console.error('Error consultando puntos por proyectoId:', e.message); }
      // Respaldo (datos legacy sin proyectoId): puntos del dueño cuyo diaId pertenece al proyecto
      if (puntosProyecto.length === 0 && diasIds.size > 0) {
        const ownerPuntosSnap = await db.collection('puntos').where('ownerId', '==', proy.ownerId || userId).get();
        puntosProyecto = ownerPuntosSnap.docs.map(d => ({ ...d.data(), id: d.id })).filter(p => diasIds.has(p.diaId));
      }

      // RANGO DEL REPORTE: el usuario puede pedir solo un tramo de postes. Las
      // posiciones llegan 1..N sobre el MISMO orden con el que se arman los reportes
      // (ordenTendido, y al final por id los que nunca se ordenaron), así lo que se
      // recorta coincide con lo que se eligió en la lista.
      const { desde, hasta } = stampConfig;
      if (desde || hasta) {
        const ordenados = [...puntosProyecto].sort((x, y) => {
          const ox = x.datos?.ordenTendido, oy = y.datos?.ordenTendido;
          if (ox != null && oy != null) return ox - oy;
          if (ox != null) return -1;
          if (oy != null) return 1;
          return parseInt(x.id) - parseInt(y.id);
        });
        const ini = Math.max(1, desde || 1);
        const fin = Math.min(ordenados.length, hasta || ordenados.length);
        puntosProyecto = ordenados.slice(ini - 1, fin);
        console.log(`Rango del reporte: ${ini} a ${fin} -> ${puntosProyecto.length} puntos`);
      }

      console.log(`Exportando ${tipo}: ${puntosProyecto.length} puntos`);

      // Cargar conexiones: el KMZ las dibuja y el EXCEL las necesita para saber a
      // qué ramal pertenece cada poste.
      let conexiones = [];
      if (tipo === 'KMZ' || tipo === 'EXCEL') {
        try {
          const conexSnap = await db.collection('conexiones').where('proyectoId', '==', proyectoId).get();
          conexiones = conexSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) { console.error('Error consultando conexiones por proyectoId:', e.message); }
        console.log(`Conexiones cargadas: ${conexiones.length} proyectoId=${proyectoId}`);
      }

      // Cables de acero: el KMZ los dibuja y el EXCEL suma sus metros en el RESUMEN.
      // Sin try: si fallara, el reporte saldría con los metros cortos sin avisar.
      let cablesAcero = [];
      if (tipo === 'KMZ' || tipo === 'EXCEL') {
        const aceroSnap = await db.collection('cablesAcero').where('proyectoId', '==', String(proyectoId)).get();
        cablesAcero = aceroSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`Cables de acero cargados: ${cablesAcero.length}`);
      }

      // Cargar logo
      let logoBuffer = null;
      if (proy.logoEmpresa) {
        try {
          const logoRes = await fetch(proy.logoEmpresa, { signal: AbortSignal.timeout(15000) });
          if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer());
        } catch (e) { console.error('Logo no cargado:', e.message); }
      }

      // Cargar catálogo de ferretería y armados. El Excel lo usa para las columnas y el
      // KMZ para nombrar los cables de acero.
      let ferreteriasVisibles = [];
      let armadosConfig = [];
      if (tipo === 'EXCEL' || tipo === 'KMZ') {
        // El catálogo del DUEÑO: los ids de ferretería de la obra son de su catálogo. Con
        // el de quien exporta, un editor o supervisor veía sin nombre los materiales que
        // el dueño agregó a mano (`f_…`).
        const configSnap = await db.collection('configuraciones').doc(String(proy.ownerId || userId)).get();
        if (configSnap.exists) {
          ferreteriasVisibles = configSnap.data().catalogoFerreteria || [];
        }
        // Los ARMADOS son del proyecto.
        armadosConfig = Array.isArray(proy.armados) ? proy.armados : [];
      }

      // Generar archivo(s)
      let volumenes = [];
      if (tipo === 'ZIP') {
        volumenes = await generarZIP(proy, puntosProyecto, logoBuffer, limiteFotos, stampConfig);
      } else if (tipo === 'KMZ') {
        volumenes = await generarKMZ(proy, puntosProyecto, conexiones, puntosProyecto, logoBuffer, limiteFotos, stampConfig, cablesAcero, ferreteriasVisibles);
      } else if (tipo === 'EXCEL') {
        if (stampConfig.reporte === 'postesPropios') {
          volumenes = await generarReportePostesPropios(proy, puntosProyecto, logoBuffer, stampConfig);
        } else if (stampConfig.reporte === 'postesElectricos') {
          volumenes = await generarReportePostesElectricos(proy, puntosProyecto, logoBuffer, stampConfig);
        } else if (stampConfig.reporte === 'tendido') {
          volumenes = await generarReporteTendido(proy, puntosProyecto, logoBuffer, stampConfig);
        } else if (stampConfig.reporte === 'ferreteria') {
          volumenes = await generarReporteFerreteria(proy, puntosProyecto, logoBuffer, stampConfig, ferreteriasVisibles);
        } else if (stampConfig.reporte === 'rfEquiposPasivos') {
          volumenes = await generarReporteRfEquiposPasivos(proy, puntosProyecto, logoBuffer, stampConfig);
        } else {
          // El reporte de tendido es el mismo generador: misma hoja DATOS, pero con
          // una hoja por ramal en vez de una por poste.
          volumenes = await generarExcel(proy, puntosProyecto, logoBuffer, limiteFotos, stampConfig, ferreteriasVisibles, armadosConfig, conexiones, stampConfig.reporte === 'tendidoRamales', cablesAcero);
        }
      } else {
        throw new Error(`Tipo no soportado: ${tipo}`);
      }

      // Subir a Storage y obtener URLs firmadas (válidas 48h)
      const bucket = storage.bucket();
      const resultados = [];
      for (const vol of volumenes) {
        const filePath = `exportaciones/${userId}/${exportId}_${vol.nombre}`;
        const file = bucket.file(filePath);
        const downloadToken = crypto.randomBytes(16).toString('hex');
        await file.save(vol.buffer, {
          metadata: {
            contentType: vol.contentType,
            contentDisposition: `attachment; filename="${vol.nombre}"`,
            metadata: { firebaseStorageDownloadTokens: downloadToken },
          },
        });
        const bucketName = bucket.name;
        const encodedPath = encodeURIComponent(filePath);
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;
        resultados.push({
          nombre: vol.nombre,
          downloadUrl,
          tamano: vol.buffer.length,
          numPuntos: vol.numPuntos,
        });
      }

      await exportRef.update({
        status: 'listo',
        resultados,
        terminadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Exportación ${exportId} completada: ${resultados.length} volumen(es)`);

    } catch (error) {
      console.error(`Error exportación ${exportId}:`, error);
      await exportRef.update({
        status: 'error',
        error: error.message || 'Error desconocido',
        terminadoEn: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);

// ============================================================
// CLOUD FUNCTION — crearUsuario
// Crea una cuenta en Firebase Auth y guarda datos en Firestore.
// ============================================================

exports.crearUsuario = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const { email, password, nombre, empresa } = request.data;
  if (!email || !password || !nombre) throw new HttpsError('invalid-argument', 'Faltan parámetros.');

  // Crear cuenta en Firebase Auth
  let userRecord;
  try {
    userRecord = await admin.auth().createUser({ email, password, displayName: nombre });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'El email ya está registrado.');
    throw new HttpsError('internal', e.message);
  }

  const uid = userRecord.uid;

  // Guardar configuración del usuario
  await db.collection('configuraciones').doc(uid).set({
    nombrePersonal: nombre,
    empresaPersonal: empresa || '',
    email,
  });

  // La contraseña NO se guarda aquí: vive solo en Firebase Auth. Antes se copiaba en
  // texto plano, y hasta el 24/09 las reglas dejaban leer `usuarios` a cualquier cuenta.
  await db.collection('usuarios').doc(email).set({
    dispositivosAutorizados: [],
    tipoAcceso: 'total',
    calidadFotos: 'alta',
    perfil: 'base',
  }, { merge: true });

  return { uid };
});

// ============================================================
// CLOUD FUNCTION — auditarFotosHuerfanas
// Solo lectura. Lista las fotos de un proyecto que están en Storage pero
// que NINGÚN punto/ficha reclama (huérfanas). Solo admin.
// ============================================================

const ADMIN_UID_AUDIT = 'E8CaZVgP4eZnjnN3OKTVi7bmoJN2';

// Extrae el path de Storage desde una URL de descarga de Firebase
const pathDesdeUrl = (u) => {
  if (typeof u !== 'string') return null;
  const m = u.match(/\/o\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

// Cuando un reporte fotográfico no tiene NINGÚN punto que cumpla su filtro: borra la
// grilla de fotos (desde filaGrilla hasta el final de la hoja) y deja un mensaje en su
// lugar, conservando intacto el encabezado del template (título + etiquetas B:L).
const insertarMensajeSinDatos = (ws, filaGrilla, mensaje) => {
  const rowOf = (a) => parseInt(a.match(/\d+/)[0], 10);
  // 1. Deshacer TODA combinación que toque la zona a borrar (inicio o fin)
  (ws.model.merges || []).slice().forEach(m => {
    const [a, b] = m.split(':');
    if (rowOf(a) >= filaGrilla || rowOf(b) >= filaGrilla) { try { ws.unMergeCells(m); } catch (e) {} }
  });
  // 2. Limpiar estilos (rellenos/bordes del template) y borrar fila por fila DESDE ABAJO:
  //    spliceRows con un count grande es no-op en ExcelJS y dejaba la plantilla visible.
  for (let r = ws.rowCount; r >= filaGrilla; r--) {
    const rw = ws.getRow(r);
    rw.eachCell({ includeEmpty: true }, (cell) => { cell.style = {}; cell.value = null; });
    try { ws.spliceRows(r, 1); } catch (e) {}
  }
  const row = ws.getRow(filaGrilla);
  row.height = 28;
  ws.mergeCells(filaGrilla, 2, filaGrilla, 12); // B..L, mismo ancho que la barra de título
  const cell = ws.getCell(filaGrilla, 2);
  cell.value = mensaje;
  cell.font = { bold: true, size: 12 };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  cell.border = { top: thin, left: thin, bottom: thin, right: thin };
};

// Conversión WGS84 (lat/lng grados) → UTM. Zona por longitud (Perú cruza 17S/18S/19S,
// se calcula por punto, no fija); hemisferio por el signo de la latitud.
const wgs84ToUtm = (lat, lng) => {
  const a = 6378137.0, eccSq = 0.00669438, k0 = 0.9996;
  const latRad = lat * Math.PI / 180, lngRad = lng * Math.PI / 180;
  const zona = Math.floor((lng + 180) / 6) + 1;
  const lngOrigenRad = ((zona - 1) * 6 - 180 + 3) * Math.PI / 180;
  const eccPrimeSq = eccSq / (1 - eccSq);
  const N = a / Math.sqrt(1 - eccSq * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = eccPrimeSq * Math.cos(latRad) ** 2;
  const Ang = Math.cos(latRad) * (lngRad - lngOrigenRad);
  const M = a * (
    (1 - eccSq / 4 - 3 * eccSq ** 2 / 64 - 5 * eccSq ** 3 / 256) * latRad
    - (3 * eccSq / 8 + 3 * eccSq ** 2 / 32 + 45 * eccSq ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * eccSq ** 2 / 256 + 45 * eccSq ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * eccSq ** 3 / 3072) * Math.sin(6 * latRad)
  );
  const x = k0 * N * (Ang + (1 - T + C) * Ang ** 3 / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSq) * Ang ** 5 / 120) + 500000.0;
  let y = k0 * (M + N * Math.tan(latRad) * (Ang * Ang / 2 + (5 - T + 9 * C + 4 * C * C) * Ang ** 4 / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * eccPrimeSq) * Ang ** 6 / 720));
  if (lat < 0) y += 10000000.0; // offset UTM para hemisferio sur
  return { zona, hemisferio: lat < 0 ? 'S' : 'N', x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
};

// Orden de exportación: respeta la posición ajustada con la herramienta ORDENAR
// (datos.ordenTendido); los puntos sin posición asignada caen al final, por id.
const ordenarPorPosicion = (lista) => [...lista].sort((a, b) => {
  const oa = a.datos && a.datos.ordenTendido, ob = b.datos && b.datos.ordenTendido;
  if (oa != null && ob != null) return oa - ob;
  if (oa != null) return -1;
  if (ob != null) return 1;
  return parseInt(a.id) - parseInt(b.id);
});

// Recolecta todos los paths de Storage referenciados dentro de un nodo (datos.fotos, arrays, etc.)
const recolectarPaths = (node, set) => {
  if (!node) return;
  if (Array.isArray(node)) { node.forEach(n => recolectarPaths(n, set)); return; }
  if (typeof node === 'string') { const p = pathDesdeUrl(node); if (p) set.add(p); return; }
  if (typeof node === 'object') {
    if (node._path) set.add(node._path);
    if (node._pathHD) set.add(node._pathHD);
    if (node.storagePath) set.add(node.storagePath);
    ['url', 'urlHD', 'thumb'].forEach(k => { const p = pathDesdeUrl(node[k]); if (p) set.add(p); });
    Object.values(node).forEach(v => { if (v && typeof v === 'object') recolectarPaths(v, set); });
  }
};

exports.auditarFotosHuerfanas = onCall({ region: 'us-central1', timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  if (request.auth.uid !== ADMIN_UID_AUDIT) throw new HttpsError('permission-denied', 'Solo admin.');

  const { proyectoId } = request.data || {};
  if (!proyectoId) throw new HttpsError('invalid-argument', 'Falta proyectoId.');

  const bucket = storage.bucket();

  // 1. Listar archivos de fotos del proyecto (detalle + generales)
  const prefixes = [
    `proyectos/${proyectoId}/fotos_detalle/`,
    `proyectos/${proyectoId}/fotos_generales/`,
  ];
  let archivos = [];
  for (const prefix of prefixes) {
    const [files] = await bucket.getFiles({ prefix });
    archivos = archivos.concat(files);
  }

  // 2. Construir el conjunto de paths REFERENCIADOS
  const referenciados = new Set();

  // 2a. Puntos del proyecto
  const puntosSnap = await db.collection('puntos').where('proyectoId', '==', proyectoId).get();
  puntosSnap.forEach(doc => {
    const d = doc.data();
    recolectarPaths(d?.datos?.fotos, referenciados);
    recolectarPaths(d?.datos?.fotosGenerales, referenciados);
  });

  // 2b. fotosProyecto (respaldo / mapa)
  const fpSnap = await db.collection('proyectos').doc(proyectoId).collection('fotosProyecto').get();
  fpSnap.forEach(doc => recolectarPaths(doc.data(), referenciados));

  // 3. Huérfanas = archivos NO referenciados
  const huerfanas = [];
  let bytesHuerfanas = 0;
  for (const file of archivos) {
    if (referenciados.has(file.name)) continue;
    const meta = file.metadata || {};
    const size = parseInt(meta.size || '0', 10) || 0;
    bytesHuerfanas += size;
    // URL de descarga: preferir token de Firebase (sin firmar); si no hay, firmar
    let url = null;
    const token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
    if (token) {
      const t = String(token).split(',')[0];
      url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${t}`;
    } else {
      try {
        const [signed] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 7 * 24 * 60 * 60 * 1000 });
        url = signed;
      } catch (e) { url = null; }
    }
    huerfanas.push({
      path: file.name,
      nombre: file.name.split('/').pop(),
      size,
      updated: meta.updated || null,
      url,
    });
  }

  huerfanas.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

  return {
    ok: true,
    proyectoId,
    totalArchivos: archivos.length,
    totalReferenciados: referenciados.size,
    totalHuerfanas: huerfanas.length,
    bytesHuerfanas,
    huerfanas,
  };
});

// ============================================================
// CLOUD FUNCTION — clasificarFotosProyecto
// Clasifica cada foto de cada punto como 'buena' (archivo grande = full-res) o
// 'mini' (archivo chico = miniatura / o sin archivo), mirando el PESO real del
// archivo en Storage (sin descargar). Devuelve conteos por punto y sección.
// ============================================================

// Umbral de bytes: por debajo se considera miniatura. Un thumb 256px ~8-30KB;
// una comprimida 1280px ~80-500KB. 40KB separa bien ambos casos.
const UMBRAL_BUENA_BYTES = 40000;

exports.clasificarFotosProyecto = onCall({ region: 'us-central1', timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { proyectoId } = request.data || {};
  if (!proyectoId) throw new HttpsError('invalid-argument', 'Falta proyectoId.');

  const bucket = storage.bucket();

  // 1. Mapa path -> peso (bytes) de todos los archivos de fotos del proyecto
  const pesoPorPath = new Map();
  for (const prefix of [`proyectos/${proyectoId}/fotos_detalle/`, `proyectos/${proyectoId}/fotos_generales/`]) {
    const [files] = await bucket.getFiles({ prefix });
    for (const f of files) pesoPorPath.set(f.name, parseInt((f.metadata && f.metadata.size) || '0', 10) || 0);
  }

  // Clasifica una foto guardada según el PESO real del archivo que referencia
  const clasificar = (v) => {
    if (!v) return null;
    const links = [];
    if (typeof v === 'string') links.push(v);
    else if (typeof v === 'object') {
      if (v.url) links.push(v.url);
      if (v.urlHD) links.push(v.urlHD);
      if (typeof v.thumb === 'string' && v.thumb.startsWith('http')) links.push(v.thumb);
    }
    const httpLinks = links.filter(l => typeof l === 'string' && l.startsWith('http'));
    if (httpLinks.length === 0) {
      // Sin link http: solo miniatura base64 en Firestore, o vacío
      if (typeof v === 'object' && (v.thumb || v.uploading)) return 'mini';
      if (typeof v === 'string' && v.startsWith('data:')) return 'mini';
      return null;
    }
    // Hay link(s): tomar el archivo más pesado que exista
    let maxPeso = -1;
    for (const l of httpLinks) {
      const p = pathDesdeUrl(l);
      const s = p != null ? pesoPorPath.get(p) : undefined;
      if (s != null && s > maxPeso) maxPeso = s;
    }
    if (maxPeso < 0) return 'mini'; // el/los archivo(s) ya no existen en el depósito
    return maxPeso >= UMBRAL_BUENA_BYTES ? 'buena' : 'mini';
  };

  // 2. Puntos del proyecto
  const snap = await db.collection('puntos').where('proyectoId', '==', proyectoId).get();
  const postes = [];
  const minis = []; // slots foto en miniatura: { puntoId, section, item }
  snap.forEach(doc => {
    const d = doc.data();
    const fotos = (d && d.datos && d.datos.fotos) || {};
    const secciones = {};
    for (const secId of Object.keys(fotos)) {
      const sec = fotos[secId];
      let buenas = 0, mini = 0;
      if (sec && typeof sec === 'object') {
        for (const k of Object.keys(sec)) {
          const c = clasificar(sec[k]);
          if (c === 'buena') buenas++;
          else if (c === 'mini') { mini++; minis.push({ puntoId: doc.id, section: secId, item: k }); }
        }
      }
      secciones[secId] = { buenas, mini };
    }
    postes.push({
      id: doc.id,
      numero: (d && d.datos && d.datos.numero) || '',
      ordenTendido: (d && d.datos && d.datos.ordenTendido != null) ? d.datos.ordenTendido : null,
      secciones,
    });
  });

  return { ok: true, umbralBytes: UMBRAL_BUENA_BYTES, totalPostes: postes.length, postes, minis };
});

// ============================================================
// FASE 4 — VERIFICACIÓN DE FOTOS POR PROYECTO
// Para un lote de puntos, verifica cada foto contra Storage:
//   nube (el archivo existe) · caída (hay url pero el archivo NO existe) · respaldo
// "equipo" lo cruza el CLIENTE (IndexedDB local). Se llama en lotes → progreso real.
// ============================================================

// ¿El valor es una foto (hoja) o un contenedor de subsección?
const esFotoSlot = (v) => {
  if (!v) return false;
  if (typeof v === 'string') return true;
  if (typeof v !== 'object') return false;
  return !!(v.url || v.urlHD || v.thumb || v.uploading || v._path);
};

// ============================================================
// INDEPENDIZAR FOTOS DE PUNTOS (al copiar/pasar puntos a otro proyecto)
// Copia los ARCHIVOS de foto a la carpeta del proyecto DESTINO y re-vincula las URLs,
// así el punto copiado deja de depender de las fotos del proyecto original (y la
// verificación deja de marcarlas "caídas"). Copia server-side (rápida) + token nuevo.
// ============================================================
exports.independizarFotosPuntos = onCall({ region: 'us-central1', timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { puntoIds, proyectoDestino } = request.data || {};
  if (!Array.isArray(puntoIds) || !puntoIds.length || !proyectoDestino) throw new HttpsError('invalid-argument', 'Faltan datos.');

  const bucket = storage.bucket();
  const prefijoDestino = `proyectos/${proyectoDestino}/`;
  const nuevoUrl = (path, token) => `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  let copiadas = 0, errores = 0;

  // Copia un archivo al proyecto destino (si no está ya ahí y existe). Devuelve {path,url} o null.
  const copiarArchivo = async (srcPath) => {
    if (!srcPath || typeof srcPath !== 'string') return null;
    if (srcPath.startsWith(prefijoDestino)) return null; // ya está en el destino
    const m = srcPath.match(/proyectos\/[^/]+\/(.+)$/);
    const resto = m ? m[1] : srcPath.split('/').pop();
    const destPath = `${prefijoDestino}${resto}`;
    const src = bucket.file(srcPath);
    const [ex] = await src.exists();
    if (!ex) return null; // el original no existe: nada que copiar
    const token = crypto.randomBytes(16).toString('hex');
    await src.copy(bucket.file(destPath));
    await bucket.file(destPath).setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
    copiadas++;
    return { path: destPath, url: nuevoUrl(destPath, token) };
  };

  // Procesa una foto (string url o objeto {url,urlHD,thumb,_path,_pathHD}).
  const procesarSlot = async (v) => {
    if (typeof v === 'string') {
      if (!v.startsWith('http')) return v; // data: uri → dejar
      const r = await copiarArchivo(pathDesdeUrl(v));
      return r ? r.url : v;
    }
    if (v && typeof v === 'object') {
      const nuevo = { ...v };
      const srcPath = v._path || (typeof v.url === 'string' && v.url.startsWith('http') ? pathDesdeUrl(v.url) : null);
      if (srcPath) { const r = await copiarArchivo(srcPath); if (r) { nuevo.url = r.url; nuevo._path = r.path; } }
      const srcHD = v._pathHD || (typeof v.urlHD === 'string' && v.urlHD.startsWith('http') ? pathDesdeUrl(v.urlHD) : null);
      if (srcHD) { const r = await copiarArchivo(srcHD); if (r) { nuevo.urlHD = r.url; nuevo._pathHD = r.path; } }
      return nuevo;
    }
    return v;
  };

  for (const pid of puntoIds) {
    try {
      const ref = db.collection('puntos').doc(String(pid));
      const snap = await ref.get();
      if (!snap.exists) continue;
      const d = snap.data() || {};
      const fotos = d.datos && d.datos.fotos;
      const update = {};

      if (fotos && typeof fotos === 'object') {
        const nuevasFotos = {};
        for (const secId of Object.keys(fotos)) {
          const sec = fotos[secId];
          if (!sec || typeof sec !== 'object') { nuevasFotos[secId] = sec; continue; }
          const nuevaSec = {};
          for (const k of Object.keys(sec)) {
            const val = sec[k];
            if (esFotoSlot(val)) nuevaSec[k] = await procesarSlot(val);
            else if (val && typeof val === 'object') {
              const nuevaSub = {};
              for (const k2 of Object.keys(val)) nuevaSub[k2] = esFotoSlot(val[k2]) ? await procesarSlot(val[k2]) : val[k2];
              nuevaSec[k] = nuevaSub;
            } else nuevaSec[k] = val;
          }
          nuevasFotos[secId] = nuevaSec;
        }
        update['datos.fotos'] = nuevasFotos;
      }

      const generales = d.datos && d.datos.fotosGenerales;
      if (Array.isArray(generales) && generales.length) {
        update['datos.fotosGenerales'] = await Promise.all(generales.map(g => procesarSlot(g)));
      }

      if (Object.keys(update).length) await ref.update(update);
    } catch (e) { errores++; console.error('independizar punto', pid, e.message); }
  }
  return { ok: true, copiadas, errores };
});

exports.verificarFotosProyecto = onCall({ region: 'us-central1', timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { proyectoId, puntoIds } = request.data || {};
  if (!proyectoId) throw new HttpsError('invalid-argument', 'Falta proyectoId.');

  const bucket = storage.bucket();

  // 1. Inventario real de archivos (un listado por prefijo, no N exists())
  const nubeSet = new Set();
  for (const prefix of [`proyectos/${proyectoId}/fotos_detalle/`, `proyectos/${proyectoId}/fotos_generales/`, `proyectos/${proyectoId}/fotos/`]) {
    const [files] = await bucket.getFiles({ prefix });
    files.forEach(f => nubeSet.add(f.name));
  }
  const respaldoSet = new Set();
  {
    const [files] = await bucket.getFiles({ prefix: `respaldo/proyectos/${proyectoId}/` });
    files.forEach(f => respaldoSet.add(f.name.replace(/^respaldo\//, '')));
  }

  // 2. Puntos a verificar (lote o todos)
  let docs = [];
  if (Array.isArray(puntoIds) && puntoIds.length > 0) {
    const refs = puntoIds.map(id => db.collection('puntos').doc(String(id)));
    docs = (await db.getAll(...refs)).filter(d => d.exists);
  } else {
    const snap = await db.collection('puntos').where('proyectoId', '==', proyectoId).get();
    docs = snap.docs;
  }

  // Requeridas por sección según el catálogo (subsecciones cuentan sus items)
  const requeridasDe = (secId) => {
    const tab = TABS_CONFIG[secId];
    if (!tab || !Array.isArray(tab.items) || tab.items.length === 0) return null; // dinámica
    let n = 0;
    tab.items.forEach(it => { if (it.items) n += it.items.length; else n++; });
    return n;
  };

  const puntos = [];
  for (const docSnap of docs) {
    const d = docSnap.data() || {};
    const fotos = (d.datos && d.datos.fotos) || {};
    const items = [];      // detalle por slot (para reparar e íconos)
    const secciones = {};  // resumen por sección

    const evaluar = (secId, itemKey, v) => {
      const urlHttp = (x) => typeof x === 'string' && x.startsWith('http');
      const url = typeof v === 'string' ? v : (v.url || null);
      const urlHD = typeof v === 'object' ? (v.urlHD || null) : null;
      const tieneUrl = urlHttp(url) || urlHttp(urlHD);
      // Paths candidatos (guardados o derivados de la url)
      const cand = [];
      if (typeof v === 'object') {
        if (v._path) cand.push(v._path);
        if (v._pathHD) cand.push(v._pathHD);
      }
      if (!cand.length) {
        const p1 = urlHttp(url) ? pathDesdeUrl(url) : null;
        const p2 = urlHttp(urlHD) ? pathDesdeUrl(urlHD) : null;
        if (p1) cand.push(p1);
        if (p2) cand.push(p2);
      }
      const nube = cand.some(p => nubeSet.has(p)) || (tieneUrl && cand.length === 0); // sin path derivable: no alarmar
      const caida = tieneUrl && cand.length > 0 && !cand.some(p => nubeSet.has(p));
      const respaldo = cand.some(p => respaldoSet.has(p));
      const pathPrincipal = cand[0] || null;
      items.push({ s: secId, i: itemKey, p: pathPrincipal, n: nube ? 1 : 0, r: respaldo ? 1 : 0, c: caida ? 1 : 0, u: tieneUrl ? 1 : 0 });
      const st = secciones[secId] || (secciones[secId] = { tom: 0, req: requeridasDe(secId), n: 0, r: 0, c: 0 });
      st.tom++;
      if (nube && tieneUrl && !caida) st.n++;
      if (respaldo) st.r++;
      if (caida) st.c++;
    };

    for (const secId of Object.keys(fotos)) {
      const sec = fotos[secId];
      if (!sec || typeof sec !== 'object') continue;
      for (const k of Object.keys(sec)) {
        const v = sec[k];
        if (!v) continue;
        if (esFotoSlot(v)) evaluar(secId, k, v);
        else if (typeof v === 'object') {
          // Subsección (ej. sub_etiquetaSalida) → un nivel más
          for (const k2 of Object.keys(v)) {
            if (esFotoSlot(v[k2])) evaluar(secId, `${k}.${k2}`, v[k2]);
          }
        }
      }
    }
    // Secciones dinámicas: requeridas = tomadas
    Object.values(secciones).forEach(st => { if (st.req == null || st.req < st.tom) st.req = st.tom; });
    puntos.push({ id: docSnap.id, numero: (d.datos && d.datos.numero) || '', items, secciones });
  }

  return { ok: true, puntos };
});

// REPARACIÓN COMPLETA EN SERVIDOR: una vez invocada, TERMINA aunque el cliente
// cierre la app (el trabajo vive en el servidor). Hace:
//   1. Backfill del respaldo espejo (idempotente).
//   2. Restaura archivos CAÍDOS copiando desde respaldo/ y re-vincula la URL en el punto.
// Lo ÚNICO que no puede hacer el servidor es subir blobs que solo existen en el
// dispositivo del usuario (eso lo hace el cliente antes de llamar aquí).
exports.repararFotosServidor = onCall({ region: 'us-central1', timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { proyectoId } = request.data || {};
  if (!proyectoId) throw new HttpsError('invalid-argument', 'Falta proyectoId.');
  const bucket = storage.bucket();

  // 1. Backfill de respaldo (paralelo, idempotente)
  let respaldadas = 0;
  for (const prefijo of ['fotos_detalle/', 'fotos/', 'fotos_generales/']) {
    const [files] = await bucket.getFiles({ prefix: `proyectos/${proyectoId}/${prefijo}` });
    const lotes = [];
    for (let i = 0; i < files.length; i += 20) lotes.push(files.slice(i, i + 20));
    for (const lote of lotes) {
      await Promise.all(lote.map(async (f) => {
        try {
          const destino = bucket.file(`respaldo/${f.name}`);
          const [ex] = await destino.exists();
          if (!ex) { await f.copy(destino); respaldadas++; }
        } catch (e) { console.warn('backfill', f.name, e.message); }
      }));
    }
  }

  // 2. Inventario de archivos vivos y de respaldos
  const nubeSet = new Set();
  for (const prefix of [`proyectos/${proyectoId}/fotos_detalle/`, `proyectos/${proyectoId}/fotos_generales/`, `proyectos/${proyectoId}/fotos/`]) {
    const [files] = await bucket.getFiles({ prefix });
    files.forEach(f => nubeSet.add(f.name));
  }
  const respaldoSet = new Set();
  {
    const [files] = await bucket.getFiles({ prefix: `respaldo/proyectos/${proyectoId}/` });
    files.forEach(f => respaldoSet.add(f.name.replace(/^respaldo\//, '')));
  }

  // 3. Recorrer los puntos: restaurar caídas desde respaldo y re-vincular URL
  const snap = await db.collection('puntos').where('proyectoId', '==', proyectoId).get();
  let restauradas = 0, sinFuente = 0;
  const urlHttp = (x) => typeof x === 'string' && x.startsWith('http');
  for (const docSnap of snap.docs) {
    const d = docSnap.data() || {};
    const fotos = (d.datos && d.datos.fotos) || {};
    const updates = {};
    const procesarSlot = async (secId, itemKey, v) => {
      if (!v || typeof v !== 'object') return;
      const tieneUrl = urlHttp(v.url) || urlHttp(v.urlHD);
      if (!tieneUrl) return;
      const cand = [];
      if (v._path) cand.push(v._path);
      if (v._pathHD) cand.push(v._pathHD);
      if (!cand.length) {
        const p1 = urlHttp(v.url) ? pathDesdeUrl(v.url) : null;
        if (p1) cand.push(p1);
      }
      if (!cand.length || cand.some(p => nubeSet.has(p))) return; // sana o indeterminable
      const p = cand[0];
      if (!respaldoSet.has(p)) { sinFuente++; return; }
      try {
        await bucket.file(`respaldo/${p}`).copy(bucket.file(p));
        // Asegurar token de descarga y re-vincular la URL en el documento
        const file = bucket.file(p);
        const [meta] = await file.getMetadata();
        let token = meta.metadata && meta.metadata.firebaseStorageDownloadTokens;
        if (!token) {
          token = crypto.randomUUID();
          await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
        }
        const urlNueva = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(p)}?alt=media&token=${String(token).split(',')[0]}`;
        updates[`datos.fotos.${secId}.${itemKey}.url`] = urlNueva;
        nubeSet.add(p);
        restauradas++;
      } catch (e) { console.warn('restaurar', p, e.message); sinFuente++; }
    };
    for (const secId of Object.keys(fotos)) {
      const sec = fotos[secId];
      if (!sec || typeof sec !== 'object') continue;
      for (const k of Object.keys(sec)) {
        const v = sec[k];
        if (!v) continue;
        if (esFotoSlot(v)) await procesarSlot(secId, k, v);
        else if (typeof v === 'object') {
          for (const k2 of Object.keys(v)) {
            if (esFotoSlot(v[k2])) await procesarSlot(secId, `${k}.${k2}`, v[k2]);
          }
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      try { await docSnap.ref.update(updates); } catch (e) { console.warn('update punto', docSnap.id, e.message); }
    }
  }

  return { ok: true, respaldadas, restauradas, sinFuente };
});

// Repara archivos CAÍDOS copiando desde el respaldo espejo (respaldo/{path} → {path}).
exports.repararDesdeRespaldo = onCall({ region: 'us-central1', timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { paths } = request.data || {};
  if (!Array.isArray(paths) || paths.length === 0) throw new HttpsError('invalid-argument', 'Faltan paths.');
  const bucket = storage.bucket();
  const resultados = {};
  for (const p of paths.slice(0, 500)) {
    if (typeof p !== 'string' || !p || p.startsWith('respaldo/')) { resultados[p] = 'invalido'; continue; }
    try {
      const original = bucket.file(p);
      const copia = bucket.file(`respaldo/${p}`);
      const [exOrig] = await original.exists();
      if (exOrig) { resultados[p] = 'ya-existia'; continue; }
      const [exCopia] = await copia.exists();
      if (!exCopia) { resultados[p] = 'sin-respaldo'; continue; }
      await copia.copy(original);
      resultados[p] = 'restaurado';
    } catch (e) {
      resultados[p] = 'error';
      console.warn('repararDesdeRespaldo', p, e.message);
    }
  }
  return { ok: true, resultados };
});

// ============================================================
// CLOUD FUNCTION — eliminarUsuarioAuth
// Elimina la cuenta de Firebase Auth (los datos de Firestore se borran desde el cliente).
// ============================================================

exports.eliminarUsuarioAuth = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const { uid } = request.data;
  if (!uid) throw new HttpsError('invalid-argument', 'Falta uid.');

  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    throw new HttpsError('internal', e.message);
  }

  return { ok: true };
});

// ============================================================
// FASE 3 — RESPALDO ESPEJO DE FOTOS EN STORAGE
// Al confirmarse la subida de una foto, el SERVIDOR la copia a respaldo/{path}.
// Como actúa DESPUÉS de que el archivo existe, no hay carrera de vínculo.
// El cliente solo puede LEER respaldo/ (regla); lo borra únicamente la purga.
// ============================================================
const RUTAS_RESPALDO = [
  /^proyectos\/[^/]+\/fotos_detalle\//,   // fotos de puntos (incluye HD)
  /^proyectos\/[^/]+\/fotos\//,           // fotos directas del mapa
  /^proyectos\/[^/]+\/fotos_generales\//, // fotos generales
];

exports.respaldarFoto = onObjectFinalized({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 120 }, async (event) => {
  const filePath = event.data.name || '';
  if (filePath.startsWith('respaldo/')) return;               // nunca re-respaldar el respaldo
  if (!RUTAS_RESPALDO.some(re => re.test(filePath))) return;  // solo fotos de proyectos
  const bucket = storage.bucket(event.data.bucket);
  try {
    await bucket.file(filePath).copy(bucket.file(`respaldo/${filePath}`));
    console.log('Respaldo creado:', filePath);
  } catch (e) {
    console.error('Error respaldando', filePath, e.message);
  }
});

// Respalda las fotos EXISTENTES de un proyecto (subidas antes de activar el respaldo
// automático). Idempotente: salta las que ya tienen copia.
exports.respaldarFotosExistentes = onCall({ region: 'us-central1', timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { proyectoId } = request.data || {};
  if (!proyectoId) throw new HttpsError('invalid-argument', 'Falta proyectoId.');
  const bucket = storage.bucket();
  let copiadas = 0, yaExistian = 0, errores = 0;
  for (const prefijo of ['fotos_detalle/', 'fotos/', 'fotos_generales/']) {
    const [files] = await bucket.getFiles({ prefix: `proyectos/${proyectoId}/${prefijo}` });
    for (const f of files) {
      const destino = bucket.file(`respaldo/${f.name}`);
      try {
        const [exists] = await destino.exists();
        if (exists) { yaExistian++; continue; }
        await f.copy(destino);
        copiadas++;
      } catch (e) { errores++; console.warn('No se pudo respaldar', f.name, e.message); }
    }
  }
  return { ok: true, copiadas, yaExistian, errores };
});

// ============================================================
// CLOUD FUNCTION — purgarPapelera (programada, 1 vez al día)
// Borra DEFINITIVAMENTE las entradas de papelera vencidas (>15 días) y,
// recién ahí, sus archivos de Storage (storagePaths). Es el ÚNICO lugar
// del sistema que borra archivos de fotos: el cliente nunca lo hace.
// ============================================================
exports.purgarPapelera = onSchedule({
  schedule: 'every 24 hours',
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '256MiB',
}, async () => {
  const ahora = Date.now();
  const snap = await db.collection('papelera').where('expiraEn', '<', ahora).get();
  if (snap.empty) { console.log('Papelera: nada que purgar.'); return; }
  const bucket = storage.bucket();
  let docsBorrados = 0, archivosBorrados = 0;
  for (const d of snap.docs) {
    const e = d.data() || {};
    for (const p of (e.storagePaths || [])) {
      if (!p || typeof p !== 'string') continue;
      try { await bucket.file(p).delete(); archivosBorrados++; }
      catch (err) { if (err.code !== 404) console.warn('No se pudo borrar', p, err.message); }
      // También el respaldo espejo (si existe)
      try { await bucket.file(`respaldo/${p}`).delete(); } catch (_) {}
    }
    await d.ref.delete();
    docsBorrados++;
  }
  console.log(`Papelera purgada: ${docsBorrados} entradas, ${archivosBorrados} archivos.`);
});

// ============================================================
// CLOUD FUNCTION — migrarMiembros (solo admin)
// Paso 2 del rediseño de equipos: escribe en cada proyecto sus miembros
// (`miembros.{uid} = { rol, desde, migrado }` y `miembrosUids`) a partir del sistema
// viejo. Quién entra y con qué rol lo decide `calcularMiembros` (miembros.js).
// Por defecto SOLO SIMULA: devuelve lo que haría sin escribir nada; para escribir hay
// que pedirlo con `simulacro: false`. Solo AGREGA: nunca pisa un miembro que ya esté,
// ni toca los campos viejos, que siguen mandando en los teléfonos sin actualizar.
// ============================================================
exports.migrarMiembros = onCall({ region: 'us-central1', timeoutSeconds: 300, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  if (request.auth.uid !== ADMIN_UID_AUDIT) throw new HttpsError('permission-denied', 'Solo admin.');
  const { calcularMiembros } = require('./miembros');
  const simulacro = (request.data || {}).simulacro !== false;
  const ahora = new Date().toISOString();

  const snap = await db.collection('proyectos').get();
  const filas = [];
  const uids = new Set();
  let escritos = 0;
  for (const d of snap.docs) {
    const p = d.data();
    const { agregar, omitidos, avisos } = calcularMiembros(p, ahora);
    const nuevos = Object.keys(agregar);
    if (!simulacro && nuevos.length) {
      // Campos punteados y arrayUnion: se agregan entradas sin tocar las que ya hay.
      const cambios = { miembrosUids: admin.firestore.FieldValue.arrayUnion(...nuevos) };
      for (const uid of nuevos) cambios[`miembros.${uid}`] = agregar[uid];
      await d.ref.update(cambios);
      escritos++;
    }
    if (p.ownerId) uids.add(String(p.ownerId));
    nuevos.forEach(u => uids.add(u));
    omitidos.forEach(o => uids.add(o.uid));
    filas.push({
      id: d.id,
      nombre: p.nombre || '',
      archivado: !!p.archivado,
      equipo: !!p.grupoId,
      dueno: p.ownerId ? String(p.ownerId) : null,
      yaMiembros: Object.keys(p.miembros || {}),
      agregar: Object.fromEntries(nuevos.map(u => [u, agregar[u].rol])),
      omitidos,
      avisos,
    });
  }

  // Nombres, para que el informe se pueda leer: los de la configuración de cada uno.
  const nombres = {};
  const lista = [...uids];
  for (let i = 0; i < lista.length; i += 100) {
    const refs = lista.slice(i, i + 100).map(u => db.collection('configuraciones').doc(u));
    const docs = await db.getAll(...refs);
    for (const c of docs) {
      const x = c.exists ? c.data() : {};
      nombres[c.id] = x.nombrePersonal || x.email || c.id;
    }
  }

  return {
    simulacro,
    total: snap.size,
    conCambios: filas.filter(f => Object.keys(f.agregar).length).length,
    escritos,
    filas,
    nombres,
  };
});

// ============================================================
// CLOUD FUNCTION — aceptarInvitacion
// Paso 3a del rediseño de equipos: el invitado acepta una invitación a un proyecto.
// Lo hace el SERVIDOR y no el teléfono: valida el código, suma al miembro y gasta el
// link, todo en una transacción. Así la protección del código es real (el invitado no
// puede escribirse solo en el proyecto) y un link no sirve dos veces aunque lo acepten
// dos personas en el mismo instante.
// Desde el paso 5 el miembro se anota solo en `miembros` (con su nombre y empresa) y en
// `miembrosUids`: los campos viejos (`compartidoCon`, `permisos`, `supervisoresInfo`) ya
// no se escriben. Las reglas y la app ya reconocen a los miembros por esos dos. Lógica
// compartida con la app en invitaciones.js (copia de src/utils/equipoProyecto.js).
// ============================================================
exports.aceptarInvitacion = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { codigo } = request.data || {};
  if (typeof codigo !== 'string' || !/^[A-Za-z0-9]{15,40}$/.test(codigo)) {
    throw new HttpsError('invalid-argument', 'inexistente');
  }
  const { estadoInvitacion, rolEnProyecto } = require('./invitaciones');
  const uid = request.auth.uid;
  const conf = await db.collection('configuraciones').doc(uid).get();
  const c = conf.exists ? conf.data() : {};
  const nombre = c.nombrePersonal || String(c.email || request.auth.token.email || '').split('@')[0] || '';
  const FV = admin.firestore.FieldValue;
  const invRef = db.collection('invitaciones').doc(codigo);

  return db.runTransaction(async (tx) => {
    const invSnap = await tx.get(invRef);
    const inv = invSnap.exists ? invSnap.data() : null;
    const estado = estadoInvitacion(inv, Date.now());
    if (estado !== 'abierta') throw new HttpsError('failed-precondition', estado);
    if (!['editor', 'supervisor'].includes(inv.rol)) throw new HttpsError('failed-precondition', 'inexistente');

    const proyRef = db.collection('proyectos').doc(String(inv.proyectoId));
    const proySnap = await tx.get(proyRef);
    if (!proySnap.exists) throw new HttpsError('failed-precondition', 'inexistente');
    const proy = proySnap.data();
    const base = { proyectoId: proyRef.id, proyectoNombre: proy.nombre || '' };

    // Quien ya es miembro no cambia de rol por aceptar otra invitación: eso lo decide el
    // dueño desde EQUIPO. Y el link no se gasta.
    const rolActual = rolEnProyecto(proy, uid);
    if (rolActual) return { ...base, rol: rolActual, yaEra: true };

    const ahora = new Date().toISOString();
    tx.update(proyRef, {
      [`miembros.${uid}`]: { rol: inv.rol, desde: ahora, por: inv.deUid || null, invitacion: codigo, nombre, empresa: c.empresaPersonal || '' },
      miembrosUids: FV.arrayUnion(uid),
    });
    if (inv.tipo === 'qr') tx.update(invRef, { usos: FV.increment(1), ultimoUso: ahora });
    else tx.update(invRef, { estado: 'usada', usadaPor: uid, usadaEn: ahora });
    return { ...base, rol: inv.rol, yaEra: false };
  });
});

// ============================================================
// CLOUD FUNCTION — traspasarProyecto
// Paso 3c del rediseño de equipos: el dueño le pasa el proyecto a otro miembro. Lo
// hace el SERVIDOR porque toca cosas que el dueño no puede escribir desde su teléfono:
// el catálogo de ferretería del nuevo dueño (cada uno escribe solo el suyo) y el aviso.
// No se copia NADA de la obra: postes, fibras y fotos no viven "dentro" del dueño, son
// documentos sueltos con proyectoId. Cambia `ownerId` del proyecto, y además:
//  - el dueño anterior queda como editor, con su nombre en `miembros`;
//  - al nuevo se le agregan los ítems de ferretería que la obra usa y él no tiene, con
//    el mismo id (traspaso.js);
//  - los controles de ferretería del dueño anterior para esta obra pasan al nuevo;
//  - las invitaciones abiertas de la obra se anulan: las creó quien ya no es dueño;
//  - el nuevo dueño recibe un aviso al abrir Kipo.
// ============================================================
exports.traspasarProyecto = onCall({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  const { proyectoId, nuevoDuenoUid } = request.data || {};
  if (!proyectoId || !nuevoDuenoUid) throw new HttpsError('invalid-argument', 'Faltan parámetros.');
  const yo = request.auth.uid;
  const nuevo = String(nuevoDuenoUid);
  if (nuevo === yo) throw new HttpsError('invalid-argument', 'Ya eres el dueño.');
  const { rolEnProyecto } = require('./invitaciones');
  const { idsFerreteriaDeObra, itemsQueFaltan } = require('./traspaso');
  const FV = admin.firestore.FieldValue;
  const id = String(proyectoId);
  const proyRef = db.collection('proyectos').doc(id);
  const esMiembro = (p) => ['editor', 'supervisor'].includes(rolEnProyecto(p, nuevo));

  const p0Snap = await proyRef.get();
  if (!p0Snap.exists) throw new HttpsError('not-found', 'Proyecto no encontrado.');
  const p0 = p0Snap.data();
  if (String(p0.ownerId) !== yo) throw new HttpsError('permission-denied', 'Solo el dueño puede pasar el proyecto.');
  if (!esMiembro(p0)) throw new HttpsError('failed-precondition', 'Solo se le puede pasar a alguien que ya es miembro del proyecto.');

  // Lo que usa la obra, fuera de la transacción: pueden ser miles de puntos.
  const [ptsSnap, acSnap, ctrlSnap, cfgYo] = await Promise.all([
    db.collection('puntos').where('proyectoId', '==', id).get(),
    db.collection('cablesAcero').where('proyectoId', '==', id).get(),
    db.collection('controlFerreteria').where('proyectoId', '==', id).get(),
    db.collection('configuraciones').doc(yo).get(),
  ]);
  // Solo los controles del dueño anterior: los que armó un editor siguen siendo suyos.
  const misControles = ctrlSnap.docs.filter(d => String(d.data().ownerId) === yo);
  const usados = idsFerreteriaDeObra({
    puntos: ptsSnap.docs.map(d => d.data()),
    armados: p0.armados || [],
    cables: acSnap.docs.map(d => d.data()),
    controles: misControles.map(d => d.data()),
  });
  const yoCfg = cfgYo.exists ? cfgYo.data() : {};
  const miNombre = yoCfg.nombrePersonal || p0.ownerNombre || String(request.auth.token.email || '').split('@')[0] || '';
  const ahora = new Date().toISOString();
  const cfgNuevoRef = db.collection('configuraciones').doc(nuevo);

  const resultado = await db.runTransaction(async (tx) => {
    const [pSnap, cfgNuevoSnap] = await tx.getAll(proyRef, cfgNuevoRef);
    const p = pSnap.data();
    // Si mientras tanto cambió algo (otro traspaso, lo quitaron del proyecto), no se sigue.
    if (String(p.ownerId) !== yo || !esMiembro(p)) {
      throw new HttpsError('failed-precondition', 'El proyecto cambió mientras tanto. Vuelve a intentarlo.');
    }
    const nuevoCfg = cfgNuevoSnap.exists ? cfgNuevoSnap.data() : {};
    const { agregar, sinOrigen } = itemsQueFaltan(usados, yoCfg.catalogoFerreteria || [], nuevoCfg.catalogoFerreteria || []);

    // Cada uno conserva lo que ya tenía como miembro (desde cuándo, quién lo invitó), y el
    // anterior queda como editor con su nombre (paso 5: los nombres viven en `miembros`).
    // Los campos del sistema viejo ya no existen (paso 6): no se tocan.
    const antes = p.miembros || {};
    const infoNuevo = antes[nuevo] || {};
    tx.update(proyRef, {
      ownerId: nuevo,
      // Al abrir Kipo, el nuevo dueño los pone al día con su configuración (App.jsx).
      ownerNombre: nuevoCfg.nombrePersonal || infoNuevo.nombre || String(nuevoCfg.email || '').split('@')[0] || '',
      ownerEmpresa: nuevoCfg.empresaPersonal || infoNuevo.empresa || '',
      [`miembros.${nuevo}`]: { ...(antes[nuevo] || { desde: ahora }), rol: 'dueno', duenoDesde: ahora },
      [`miembros.${yo}`]: { ...(antes[yo] || { desde: ahora }), rol: 'editor', nombre: miNombre, empresa: yoCfg.empresaPersonal || '' },
      miembrosUids: FV.arrayUnion(nuevo, yo),
    });
    // Sin configuración (no debería pasar: crearUsuario la crea) no se inventa una a medias.
    const agregados = (agregar.length && cfgNuevoSnap.exists) ? agregar.length : 0;
    if (agregados) {
      tx.set(cfgNuevoRef, { catalogoFerreteria: [...(nuevoCfg.catalogoFerreteria || []), ...agregar] }, { merge: true });
    }
    return { proyectoNombre: p.nombre || '', agregados, sinOrigen: sinOrigen + (agregar.length - agregados) };
  });

  // Después, lo que no necesita ir junto. Si falla, el traspaso YA está hecho: no se
  // devuelve error, porque al reintentar diría "solo el dueño puede pasar el proyecto".
  let completo = true;
  try {
    const lote = db.batch();
    misControles.forEach(d => lote.update(d.ref, { ownerId: nuevo }));
    const invs = await db.collection('invitaciones').where('proyectoId', '==', id).where('estado', '==', 'abierta').get();
    invs.docs.forEach(d => lote.update(d.ref, { estado: 'anulada', anuladaEn: ahora }));
    lote.set(db.collection('avisos').doc(), {
      para: nuevo, tipo: 'traspaso', proyectoId: id, proyectoNombre: resultado.proyectoNombre,
      rol: 'dueno', deUid: yo, deNombre: miNombre, creado: ahora, visto: false,
    });
    await lote.commit();
  } catch (e) {
    console.error('traspasarProyecto: pasos finales sin hacer', id, e);
    completo = false;
  }

  return { ok: true, completo, ...resultado };
});

// ============================================================
// CLOUD FUNCTION — paso6 (solo admin)
// Paso 6 del rediseño de equipos: dejar cada proyecto solo con `miembros` +
// `miembrosUids` y sacar los campos del sistema viejo (lógica en paso6.js).
// Tres acciones, que el admin corre desde su panel en la app:
//  - 'simular' (por defecto): informa qué haría. No escribe nada.
//  - 'completar': SOLO AGREGA. Quien esté en `compartidoCon` y no en `miembros` pasa a
//    ser miembro con el rol que hoy tiene; los nombres de `supervisoresInfo` pasan a
//    `miembros`; el dueño y `miembrosUids` quedan completos. Nadie pierde el proyecto.
//  - 'limpiar': en los proyectos que ya no tengan nada por completar, guarda los campos
//    viejos en `respaldoPaso6/{proyectoId}` y después los borra; los documentos de
//    `equipos` se guardan en `respaldoPaso6Equipos/{id}` y se borran. Con los respaldos
//    se puede volver atrás. Un proyecto al que le falte completar no se toca.
// ============================================================
exports.paso6 = onCall({ region: 'us-central1', timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  if (request.auth.uid !== ADMIN_UID_AUDIT) throw new HttpsError('permission-denied', 'Solo admin.');
  const accion = (request.data || {}).accion || 'simular';
  if (!['simular', 'completar', 'limpiar'].includes(accion)) throw new HttpsError('invalid-argument', 'Acción desconocida.');
  const { planPaso6, cambiosDeCompletar } = require('./paso6');
  const FV = admin.firestore.FieldValue;
  const ahora = new Date().toISOString();

  const snap = await db.collection('proyectos').get();
  const filas = [];
  const uids = new Set();
  let escritos = 0;
  for (const d of snap.docs) {
    const p = d.data();
    const plan = planPaso6(p, ahora);
    const fila = {
      id: d.id,
      nombre: p.nombre || '',
      archivado: !!p.archivado,
      agregar: Object.fromEntries(Object.entries(plan.agregar).map(([u, m]) => [u, m.rol])),
      agregarDueno: plan.agregarDueno,
      nombres: Object.keys(plan.nombres),
      faltanEnUids: plan.faltanEnUids,
      viejos: plan.viejos,
      porCompletar: plan.porCompletar,
      hecho: null,
    };
    Object.keys(plan.agregar).forEach(u => uids.add(u));
    if (p.ownerId) uids.add(String(p.ownerId));

    if (accion === 'completar' && plan.porCompletar) {
      await d.ref.update(cambiosDeCompletar(p, plan, ahora, (lista) => FV.arrayUnion(...lista)));
      escritos++;
      fila.hecho = 'completado';
    }
    if (accion === 'limpiar' && plan.viejos.length) {
      if (!plan.listoParaLimpiar) {
        fila.hecho = 'sin limpiar: falta completar';
      } else {
        const campos = Object.fromEntries(plan.viejos.map(k => [k, p[k]]));
        const lote = db.batch();
        lote.set(db.collection('respaldoPaso6').doc(d.id), { proyectoId: d.id, nombre: p.nombre || '', campos, fecha: ahora });
        lote.update(d.ref, Object.fromEntries(plan.viejos.map(k => [k, FV.delete()])));
        await lote.commit();
        escritos++;
        fila.hecho = 'limpiado';
      }
    }
    if (plan.porCompletar || plan.viejos.length || fila.hecho) filas.push(fila);
  }

  // La colección de equipos del sistema viejo: se respalda y se borra al limpiar.
  const eq = await db.collection('equipos').get();
  let equiposBorrados = 0;
  if (accion === 'limpiar') {
    for (let i = 0; i < eq.docs.length; i += 200) {
      const tanda = eq.docs.slice(i, i + 200);
      const lote = db.batch();
      tanda.forEach(e => {
        lote.set(db.collection('respaldoPaso6Equipos').doc(e.id), { ...e.data(), respaldadoEn: ahora });
        lote.delete(e.ref);
      });
      await lote.commit();
      equiposBorrados += tanda.length;
    }
  }

  // Nombres, para que el informe se pueda leer
  const nombres = {};
  const lista = [...uids];
  for (let i = 0; i < lista.length; i += 100) {
    const refs = lista.slice(i, i + 100).map(u => db.collection('configuraciones').doc(u));
    const docs = await db.getAll(...refs);
    for (const c of docs) {
      const x = c.exists ? c.data() : {};
      nombres[c.id] = x.nombrePersonal || x.email || c.id;
    }
  }

  return {
    accion,
    total: snap.size,
    porCompletar: filas.filter(f => f.porCompletar).length,
    conViejos: filas.filter(f => f.viejos.length).length,
    escritos,
    equipos: eq.size,
    equiposBorrados,
    filas,
    nombres,
  };
});
