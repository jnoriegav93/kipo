/* eslint-disable */
'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { Zip, ZipPassThrough } = require('fflate');
const ExcelJS = require('exceljs');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const storage = admin.storage();

// ============================================================
// PHOTO CONFIG (espejo de src/components/PhotoManager.jsx)
// ============================================================
const TABS_CONFIG = {
  napMec: {
    id: 'napMec', title: 'NAP MECANICA',
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
    id: 'mufaTroncal', title: 'MUFA TRONCAL',
    items: [
      { id: 'cajaPiso', label: 'CAJA EN PISO' },
      { id: 'fusiones', label: 'FUSIONES' },
      { id: 'bandejasAseguradas', label: 'BANDEJAS ASEGURADAS' },
      { id: 'cablesAsegurados', label: 'CABLES OPTICOS ASEGURADOS' },
      { id: 'cierreCarcasa', label: 'CIERRE DE LA CARCASA' },
      { id: 'etiquetaIngreso', label: 'ETIQUETA FIBRA INGRESO' },
      { id: 'sub_etiquetaSalida', title: 'ETIQUETAS DE FO DE SALIDA', items: [
        { id: 'salida1', label: 'SALIDA 1' },
        { id: 'salida2', label: 'SALIDA 2' },
        { id: 'salida3', label: 'SALIDA 3' },
      ]},
    ],
  },
  mufaFdt: {
    id: 'mufaFdt', title: 'MUFA FDT',
    items: [
      { id: 'cajaPiso', label: 'CAJA EN PISO' },
      { id: 'fusiones', label: 'FUSIONES' },
      { id: 'bandejasAseguradas', label: 'BANDEJAS ASEGURADAS' },
      { id: 'cablesAsegurados', label: 'CABLES OPTICOS ASEGURADOS' },
      { id: 'cierreCarcasa', label: 'CIERRE DE LA CARCASA' },
      { id: 'etiquetaIngreso', label: 'ETIQUETA FIBRA INGRESO' },
      { id: 'sub_etiquetaSalida', title: 'ETIQUETAS DE FO DE SALIDA', items: [
        { id: 'salida1', label: 'SALIDA 1' },
        { id: 'salida2', label: 'SALIDA 2' },
        { id: 'salida3', label: 'SALIDA 3' },
      ]},
    ],
  },
  fatPrecoNueva: {
    id: 'fatPrecoNueva', title: 'FAT PRECO NUEVA',
    items: [
      { id: 'frontalRotulado', label: 'FRONTAL (ROTULADO)' },
      { id: 'frontalPotencia', label: 'FRONTAL CON POTENCIA' },
      { id: 'perfil', label: 'PERFIL' },
      { id: 'etiqueta', label: 'ETIQUETA' },
      { id: 'codigoSerie', label: 'CODIGO SERIE' },
    ],
  },
  fatPrecoExistente: {
    id: 'fatPrecoExistente', title: 'FAT PRECO EXISTENTE',
    items: [
      { id: 'frontalRotulado', label: 'FRONTAL (ROTULADO)' },
      { id: 'frontalPotencia', label: 'FRONTAL CON POTENCIA' },
      { id: 'perfil', label: 'PERFIL' },
      { id: 'etiqueta', label: 'ETIQUETA' },
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
    id: 'hbox', title: 'HBOX',
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
  adicionales: {
    id: 'adicionales', title: 'ADICIONALES',
    items: [], dynamic: true,
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

    const fs = 26;
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

    const nro = String(datos.numero || '-').padStart(3, '0');
    const pasivo = datos.pasivo || datos.codFat || '-';
    let idTxt = '';
    if (mostrarNroPoste && mostrarCodFat) { idTxt = `${nro}  |  ${pasivo}`; }
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
  const items = [];
  tab.items.forEach(tabItem => {
    if (tabItem.items) {
      tabItem.items.forEach(sub => {
        const val = secFotos[sub.id];
        if (val) {
          const url = resolveUrl(val);
          if (url && !url.startsWith('blob:')) items.push({ url, label: sub.label.replace('\n', ' ') });
        }
      });
    } else {
      const val = secFotos[tabItem.id];
      if (val) {
        const url = resolveUrl(val);
        if (url && !url.startsWith('blob:')) items.push({ url, label: tabItem.label.replace('\n', ' ') });
      }
    }
  });
  EXTRAS_ITEMS.forEach(extraLabel => {
    const val = secFotos[extraLabel];
    if (val) {
      const url = resolveUrl(val);
      if (url && !url.startsWith('blob:')) items.push({ url, label: extraLabel });
    }
  });
  return items;
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
      const pasivoItem = (p.datos && p.datos.pasivo) || 'SP';
      const nombrePuntoBase = `${numItem} - ${pasivoItem}`.replace(/[/\\?*[\]:]/g, '_');
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
          allZipJobs.push({ url: item.url, path: `${carpetaPuntoPath}/${tab.title}/${cleanLabel}.jpg` });
        }
      }

      const fotosGen = p.datos && p.datos.fotosGenerales;
      if (Array.isArray(fotosGen)) {
        fotosGen.forEach((f, i) => {
          const url = typeof f === 'string' ? f : (f && (f.urlHD || f.url));
          if (url && !url.startsWith('blob:')) {
            allZipJobs.push({ url, path: `${carpetaPuntoPath}/GENERALES/General_${i + 1}.jpg` });
          }
        });
      }

      const zipBuffers = await runParallel(allZipJobs, async (job) => {
        const imgBuffer = await fetchPhotoBuffer(job.url);
        return stampConfig.sinDatos ? imgBuffer : estamparMetadatos(imgBuffer, datosEstampado, logoBuffer, stampConfig);
      });

      for (let k = 0; k < allZipJobs.length; k++) {
        if (!zipBuffers[k]) continue;
        allFiles.set(allZipJobs[k].path, new Uint8Array(zipBuffers[k]));
      }
    }

    const zipBuffer = await buildFflateZip(allFiles);
    const nombreBase = (proy.nombre || 'PROYECTO').replace(/\s+/g, '_').toUpperCase();
    const nombre = (VOLUMENES.length === 0 && listaPuntos.length === puntosProyecto.length)
      ? `${nombreBase}.zip` : `${nombreBase}_VOL${numVol}.zip`;
    return { nombre, buffer: zipBuffer, numPuntos: listaPuntos.length, contentType: 'application/zip' };
  };

  for (const p of puntosProyecto) {
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

const generarKMZ = async (proy, puntosProyecto, conexiones, todosPuntos, logoBuffer, limiteFotos, stampConfig) => {
  const VOLUMENES = [];
  let volumenActual = 1;
  let puntosBuffer = [];
  let fotosCountBuffer = 0;

  // Colores por capacidad de fibra (hex → KML AABBGGRR)
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
  <Style id="posteStyle"><IconStyle><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><BalloonStyle><text>$[description]</text></BalloonStyle></Style>
${estilosLineas}
  <Folder><name>Puntos</name>`;
    let kmlBody = '';

    for (let ptIdx = 0; ptIdx < listaPuntos.length; ptIdx++) {
      const p = listaPuntos[ptIdx];
      const uid = ptIdx;
      const lat = ((p.coords && p.coords.lat) || 0).toFixed(6);
      const lng = ((p.coords && p.coords.lng) || 0).toFixed(6);
      const fotos = (p.datos && p.datos.fotos) || {};

      const sections = [];
      let photoIdx = 0;

      for (const tab of Object.values(TABS_CONFIG)) {
        const sectionPhotos = fotos[tab.id] || {};
        const secItems = [];
        for (const item of tab.items) {
          if (item.items) {
            for (const sub of item.items) {
              const val = sectionPhotos[sub.id];
              const rawUrl = val ? (typeof val === 'string' ? val : val.url) : null;
              const url = (rawUrl && !rawUrl.startsWith('blob:')) ? rawUrl : null;
              secItems.push({ url, label: `${item.title} - ${sub.label}`, fileIdx: url ? photoIdx++ : null });
            }
          } else {
            const val = sectionPhotos[item.id];
            const rawUrl = val ? (typeof val === 'string' ? val : val.url) : null;
            const url = (rawUrl && !rawUrl.startsWith('blob:')) ? rawUrl : null;
            secItems.push({ url, label: item.label.replace('\n', ' '), fileIdx: url ? photoIdx++ : null });
          }
        }
        EXTRAS_ITEMS.forEach(extraLabel => {
          const val = sectionPhotos[extraLabel];
          const rawUrl = val ? (typeof val === 'string' ? val : val.url) : null;
          const url = (rawUrl && !rawUrl.startsWith('blob:')) ? rawUrl : null;
          secItems.push({ url, label: extraLabel, fileIdx: url ? photoIdx++ : null });
        });
        // Catch-all: fotos dinámicas (adicionales) o con keys no cubiertos arriba
        const processedIds = new Set([
          ...tab.items.flatMap(item => item.items ? item.items.map(s => s.id) : [item.id]),
          ...EXTRAS_ITEMS
        ]);
        Object.entries(sectionPhotos).forEach(([key, val]) => {
          if (processedIds.has(key) || !val) return;
          const url = typeof val === 'string' ? val : val.url;
          if (url && !url.startsWith('blob:')) secItems.push({ url, label: key, fileIdx: photoIdx++ });
        });
        if (secItems.length > 0) sections.push({ title: tab.title, photos: secItems });
      }

      if (Array.isArray(fotos)) {
        const legItems = [];
        fotos.forEach((f, i) => {
          const url = typeof f === 'string' ? f : (f && f.url);
          if (url && !url.startsWith('blob:')) legItems.push({ url, label: `Foto ${i + 1}`, fileIdx: photoIdx++ });
        });
        if (legItems.length > 0) sections.push({ title: 'FOTOS', photos: legItems });
      }

      const allKmzPhotos = sections.flatMap(sec => sec.photos.filter(ph => ph.url));
      const kmzDatosEstampado = makeDatosEstampado(p, proy);

      const kmzBuffers = await runParallel(allKmzPhotos, async (photo) => {
        const imgBuffer = await fetchPhotoBuffer(photo.url);
        return stampConfig.sinDatos ? imgBuffer : estamparMetadatos(imgBuffer, kmzDatosEstampado, logoBuffer, stampConfig);
      });

      for (let k = 0; k < allKmzPhotos.length; k++) {
        if (!kmzBuffers[k]) { allKmzPhotos[k].fileName = null; continue; }
        const fileName = `pt${uid}_${allKmzPhotos[k].fileIdx}.jpg`;
        kmzFiles.set(`files/${fileName}`, new Uint8Array(kmzBuffers[k]));
        allKmzPhotos[k].fileName = fileName;
      }

      const firstPhoto = sections.flatMap(s => s.photos).find(ph => ph.fileName);

      let selectorHtml = '';
      if (sections.length > 0) {
        sections.forEach((sec, sIdx) => {
          const openAttr = '';
          const secId = `kp${uid}_sec${sIdx}`;
          const photosCount = sec.photos.filter(ph => ph.fileName).length;
          const itemsHtml = sec.photos.map(photo => {
            const labelUp = photo.label.toUpperCase();
            const escHtml = labelUp.replace(/"/g, '&quot;');
            if (photo.fileName) {
              const escJs = labelUp.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              return `<div onclick="var e=document.getElementById('kp${uid}_ph');var l=document.getElementById('kp${uid}_lbl');if(e)e.src='files/${photo.fileName}';if(l)l.innerText='${escJs}';" style="padding:4px 8px;cursor:pointer;border-bottom:1px solid #eee;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml}" onmouseover="this.style.background='#fff3e0'" onmouseout="this.style.background=''">${labelUp}</div>`;
            } else {
              return `<div style="padding:4px 8px;border-bottom:1px solid #eee;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#bbb;" title="${escHtml}">${labelUp}</div>`;
            }
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

      const evaHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title> </title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f0f0f0}.card{background:#fff;margin:20px 16px;padding:24px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.15)}.logo{font-size:20px;font-weight:900;text-align:center;margin-bottom:14px}.eva{color:#FCBF26}.dig{color:#100F1D}p{color:#555;font-size:13px;text-align:center;line-height:1.6;margin-bottom:14px}.url-box{border:1px dashed #ccc;padding:8px 12px;font-size:11px;color:#888;text-align:center;margin-bottom:16px;word-break:break-all}.btn{display:block;width:100%;background:#100F1D;color:#FCBF26;font-weight:bold;font-size:13px;padding:12px;border:none;border-radius:4px;cursor:pointer;letter-spacing:1px}</style></head><body><div class="card"><div class="logo"><span class="eva">EVA</span> <span class="dig">Digital</span></div><p>Si te interesa conocer mas sobre nuestras soluciones de ingenieria, diseno de redes y software especializado, visita nuestra web:</p><div class="url-box">https://www.evadigitalgroup.com/index.html</div><button class="btn" onclick="var t=document.createElement('textarea');t.value='https://www.evadigitalgroup.com/index.html';document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);this.innerText='COPIADO!'">COPIAR ENLACE</button></div></body></html>`;
      const evaDataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(evaHtml);

      const htmlPopup = `<div style="font-family:Segoe UI,Arial,sans-serif;width:570px;background:#fff;color:#333;border-radius:0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.2);">
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
          <div style="position:absolute;bottom:0;left:0;right:0;padding:5px 8px;border-top:1px solid #eee;font-size:8px;color:#aaa;line-height:1.4;background:#fafafa;">KMZ elaborado por Kipo, App de <a href="${evaDataUrl}" style="color:#aaa;text-decoration:underline;">EVA Digital</a></div>
        </div>
      </td>
      <td style="width:370px;height:570px;vertical-align:top;text-align:center;padding:0;background:#f5f5f5;overflow:hidden;">
        ${firstPhoto
          ? `<table style="width:100%;height:100%;border-collapse:collapse;"><tr style="height:100%;"><td style="text-align:center;vertical-align:middle;padding:8px;"><img id="kp${uid}_ph" src="files/${firstPhoto.fileName}" style="max-width:354px;max-height:600px;width:auto;height:auto;display:block;margin:0 auto;border-radius:4px;"/></td></tr><tr><td style="padding:0;"><div id="kp${uid}_lbl" style="display:block;width:100%;font-size:12px;color:#fff;font-weight:bold;background:#100F1D;padding:7px 8px;text-align:center;">${firstLabelUp}</div></td></tr></table>`
          : `<div style="padding:20px;color:#aaa;font-size:12px;text-align:center;">Sin fotos</div>`}
      </td>
    </tr>
  </table>
</div>`;

      kmlBody += `
          <Placemark>
            <name>ITEM: ${(p.datos && p.datos.numero) || 'S/N'}${(p.datos && p.datos.pasivo) ? ' - ' + p.datos.pasivo : ''}</name>
            <Snippet maxLines="0"/>
            <styleUrl>#posteStyle</styleUrl>
            <description><![CDATA[${htmlPopup}]]></description>
            <Point><coordinates>${lng},${lat},0</coordinates></Point>
          </Placemark>`;
    }

    let kmlLines = '';
    if (numVol === 1) {
      kmlLines += `</Folder><Folder><name>Líneas</name>`;
      kmlLines += `<!-- DEBUG: ${conexiones.length} conexiones, todosPuntos: ${todosPuntos.length} -->`;
      conexiones.forEach(c => {
        // Usar todos los puntos del recorrido (multi-segmento), con fallback a from/to
        const idsSerie = (Array.isArray(c.puntos) && c.puntos.length >= 2)
          ? c.puntos
          : [c.from, c.to].filter(Boolean);
        const resueltos = idsSerie.map(id => todosPuntos.find(p => p.id === id));
        const coords = resueltos
          .filter(p => p && p.coords)
          .map(p => `${(p.coords.lng || 0).toFixed(6)},${(p.coords.lat || 0).toFixed(6)},0`);
        const primerIdBuscado = idsSerie[0];
        const primerPuntoEncontrado = todosPuntos.find(p => p.id === primerIdBuscado);
        const primerPuntoEncontradoAlt = primerIdBuscado ? todosPuntos.find(p => String(p.id) === String(primerIdBuscado)) : null;
        kmlLines += `<!-- Linea ${c.id}: ids=${idsSerie.length} resueltos=${resueltos.filter(Boolean).length} coords=${coords.length} cap=${c.capacidad} proyId=${c.proyectoId} diaId=${c.diaId} primerIdBuscado=${primerIdBuscado} encontrado=${primerPuntoEncontrado ? 'SI' : (primerPuntoEncontradoAlt ? 'SI_ALT' : 'NO')} -->`;
        if (coords.length < 2) return;
        const cap = c.capacidad;
        const styleId = (cap && KML_COLORES[cap]) ? `linea_${cap}` : 'linea_default';
        const nombre = cap ? `${cap} hilos` : 'Línea de fibra';
        kmlLines += `<Placemark><name>${nombre}</name><styleUrl>#${styleId}</styleUrl><LineString><tessellate>1</tessellate><coordinates>${coords.join(' ')}</coordinates></LineString></Placemark>`;
      });
    }

    const kmlFinal = `${kmlHead}${kmlBody}${kmlLines}</Folder></Document></kml>`;
    kmzFiles.set('doc.kml', Buffer.from(kmlFinal, 'utf8'));

    const kmzBuffer = await buildFflateZip(kmzFiles);
    const nombreBase = (proy.nombre || 'PROYECTO').replace(/\s+/g, '_').toUpperCase();
    const nombre = (VOLUMENES.length === 0 && listaPuntos.length === puntosProyecto.length)
      ? `${nombreBase}.kmz` : `${nombreBase}_VOL${numVol}.kmz`;
    return { nombre, buffer: kmzBuffer, numPuntos: listaPuntos.length, contentType: 'application/vnd.google-earth.kmz' };
  };

  for (const p of puntosProyecto) {
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

const generarExcel = async (proy, puntosProyecto, logoBuffer, limiteFotos, stampConfig, ferreteriasVisibles) => {
  const VOLUMENES = [];
  let volumenActual = 1;
  let puntosBuffer = [];
  let fotosCountBuffer = 0;

  const normFat = (val) => (val || '').replace(/^fat[\s-]*/i, '').trim();
  const getConsolidado = (datos) => {
    const totals = {};
    (datos.armadosSeleccionados || []).forEach(armado => {
      (armado.items || []).forEach(item => { totals[item.idRef] = (totals[item.idRef] || 0) + item.cant; });
    });
    Object.entries(datos.ferreteriaExtra || {}).forEach(([id, cantidad]) => {
      if (cantidad !== 0) totals[id] = (totals[id] || 0) + cantidad;
    });
    return totals;
  };

  const PHOTO_COL_WIDTH = 55;
  const PHOTO_ROW_HEIGHT = 400;
  const LABEL_ROW_HEIGHT = 20;
  const SEC_COL_WIDTH = 10;

  const cerrarVolumen = async (listaPuntos, numVol) => {
    const workbook = new ExcelJS.Workbook();
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
      ...ferreteriasVisibles.map(f => ({
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
      { header: 'GPS', key: 'gps', width: 25 },
      { header: 'OBSERVACIONES', key: 'obs', width: 35 },
    ];

    const wsDatos = workbook.addWorksheet('DATOS', { views: [{ state: 'frozen', ySplit: 2 }] });
    wsDatos.columns = colsDef;
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

    const armColPos = colsDef.findIndex(c => c.key === 'arm');
    const ferrColStart = colsDef.findIndex(c => c.key.startsWith('ferr_'));
    if (armColPos >= 0) {
      headerRow.getCell(armColPos + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCBF26' } };
      headerRow.getCell(armColPos + 1).font = { bold: true, color: { argb: 'FF000000' } };
    }
    if (ferrColStart >= 0) {
      for (let c = ferrColStart + 1; c <= ferrColStart + ferreteriasVisibles.length; c++) {
        headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCBF26' } };
        headerRow.getCell(c).font = { bold: true, color: { argb: 'FF000000' } };
      }
    }

    const usedSheetNames = new Set(['DATOS']);

    for (let i = 0; i < listaPuntos.length; i++) {
      const p = listaPuntos[i];
      const correlativo = String(i + 1).padStart(3, '0');
      const valNum = (p.datos && p.datos.numero) || '-';
      const valFat = normFat((p.datos && p.datos.codFat) || '');
      const lat = ((p.coords && p.coords.lat) || 0).toFixed(6);
      const lng = ((p.coords && p.coords.lng) || 0).toFixed(6);

      let sheetName = correlativo;
      if (usedSheetNames.has(sheetName)) {
        let cnt = 2;
        while (usedSheetNames.has(`${correlativo}_${cnt}`)) cnt++;
        sheetName = `${correlativo}_${cnt}`;
      }
      usedSheetNames.add(sheetName);

      const totals = getConsolidado(p.datos || {});
      const ferrValues = {};
      ferreteriasVisibles.forEach(f => { ferrValues[`ferr_${f.id}`] = totals[f.id] || 0; });

      const armNombre = (p.datos && p.datos.armadosSeleccionados && p.datos.armadosSeleccionados.length > 0)
        ? p.datos.armadosSeleccionados.map(a => a.nombre).join(', ') : '-';

      const fechaFormateada = (p.datos && p.datos.fecha)
        ? new Date(p.datos.fecha).toLocaleDateString('es-PE') : '-';

      const row = wsDatos.getRow(i + 3);
      row.values = {
        correlativo, numero: valNum,
        pasivo: (p.datos && p.datos.pasivo) || '-',
        codPoste: (p.datos && p.datos.codigo) || '-',
        sum: (p.datos && p.datos.suministro) || '-',
        alt: (p.datos && p.datos.altura) || '-',
        mat: (p.datos && p.datos.material) || '-',
        fuerza: (p.datos && p.datos.fuerza) || '-',
        tipo: (p.datos && p.datos.tipo) || '-',
        extras: Array.isArray(p.datos && p.datos.extrasSeleccionados) ? (p.datos.extrasSeleccionados.join(', ') || '-') : '-',
        cables: (p.datos && p.datos.cables) || '-',
        arm: armNombre,
        ...ferrValues,
        abscisaInicial: (p.datos && p.datos.absIn) || '-',
        abscisaFinal: (p.datos && p.datos.absOut) || '-',
        fecha: fechaFormateada,
        hora: (p.datos && p.datos.hora) || '-',
        dir: (p.datos && p.datos.direccion) || '-',
        ubic: (p.datos && p.datos.ubicacion) || '-',
        lat: Number(lat), lng: Number(lng), gps: `${lat}, ${lng}`,
        obs: (p.datos && p.datos.observaciones) || '-'
      };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
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
          allPhotoJobs.push({ url: secItems[j].url, colIdx, imgRowIdx });
        }
        curRow += 2;
      }

      const photoBuffers = await runParallel(allPhotoJobs, async (job) => {
        const imgBuffer = await fetchPhotoBuffer(job.url);
        return stampConfig.sinDatos ? imgBuffer : estamparMetadatos(imgBuffer, datosEstampado, logoBuffer, stampConfig);
      });

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

  for (const p of puntosProyecto) {
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
  const tieneAcceso = proy.ownerId === userId
    || (Array.isArray(proy.compartidoCon) && proy.compartidoCon.includes(userId));
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
  { document: 'exportaciones/{exportId}', memory: '2GiB', timeoutSeconds: 540 },
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

      // Cargar puntos del usuario y filtrar por dias del proyecto
      const puntosSnap = await db.collection('puntos').where('ownerId', '==', userId).get();
      const todosPuntos = puntosSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      const diasIds = new Set((proy.dias || []).map(d => d.id));
      const puntosProyecto = todosPuntos.filter(p => diasIds.has(p.diaId));

      console.log(`Exportando ${tipo}: ${puntosProyecto.length} puntos`);

      // Cargar conexiones (solo para KMZ)
      let conexiones = [];
      if (tipo === 'KMZ') {
        const conexSnap = await db.collection('conexiones').where('ownerId', '==', userId).get();
        const todasConex = conexSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        conexiones = todasConex.filter(c => c.proyectoId === proyectoId || diasIds.has(c.diaId));
        console.log(`KMZ conexiones: total=${todasConex.length} filtradas=${conexiones.length} proyectoId=${proyectoId} diasIds=[${[...diasIds].join(',')}]`);
      }

      // Cargar logo
      let logoBuffer = null;
      if (proy.logoEmpresa) {
        try {
          const logoRes = await fetch(proy.logoEmpresa, { signal: AbortSignal.timeout(15000) });
          if (logoRes.ok) logoBuffer = Buffer.from(await logoRes.arrayBuffer());
        } catch (e) { console.error('Logo no cargado:', e.message); }
      }

      // Cargar catálogo de ferretería (para Excel)
      let ferreteriasVisibles = [];
      if (tipo === 'EXCEL') {
        const configSnap = await db.collection('configuraciones').doc(userId).get();
        if (configSnap.exists) ferreteriasVisibles = configSnap.data().catalogoFerreteria || [];
      }

      // Generar archivo(s)
      let volumenes = [];
      if (tipo === 'ZIP') {
        volumenes = await generarZIP(proy, puntosProyecto, logoBuffer, limiteFotos, stampConfig);
      } else if (tipo === 'KMZ') {
        volumenes = await generarKMZ(proy, puntosProyecto, conexiones, todosPuntos, logoBuffer, limiteFotos, stampConfig);
      } else if (tipo === 'EXCEL') {
        volumenes = await generarExcel(proy, puntosProyecto, logoBuffer, limiteFotos, stampConfig, ferreteriasVisibles);
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
