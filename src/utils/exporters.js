import { Zip, ZipPassThrough } from 'fflate';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { urlABase64, estamparMetadatos, perteneceAProyecto } from './helpers';

// Orden de exportación: respeta la posición ajustada con la herramienta ORDENAR
// (datos.ordenTendido); sin posición asignada, cae al final por id.
const ordenarPorPosicion = (lista) => [...lista].sort((a, b) => {
  const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
  if (oa != null && ob != null) return oa - ob;
  if (oa != null) return -1;
  if (ob != null) return 1;
  return parseInt(a.id) - parseInt(b.id);
});

import { TABS_CONFIG, EXTRAS_ITEMS } from '../components/PhotoManager';
import { ref, getBlob } from 'firebase/storage';
import { storage } from '../firebaseConfig';

// Fetch usando SDK de Firebase Storage (evita CORS en URLs de Firebase)
const fetchStorageBlob = async (url) => {
  if (url && url.includes('firebasestorage.googleapis.com')) {
    try {
      const storageRef = ref(storage, url);
      return await getBlob(storageRef);
    } catch (e) {
      console.error('getBlob failed, fallback fetch:', e);
    }
  }
  const response = await fetch(url);
  return response.blob();
};

// --- HELPER COMPARTIDO PARA EXTRAER FOTOS ---
const getFormattedPhotos = (punto) => {
  const fotos = punto.datos.fotos;
  if (!fotos) return [];
  const processed = [];

  // 1. Iterar sobre la configuración oficial
  Object.values(TABS_CONFIG).forEach(tab => {
    const sectionPhotos = fotos[tab.id];
    if (!sectionPhotos) return;

    tab.items.forEach(item => {
      // Caso 1: Subsección de items fijos
      if (item.items) {
        item.items.forEach(sub => {
          const val = sectionPhotos[sub.id];
          if (val) {
            const url = typeof val === 'string' ? val : val.url;
            if (url) processed.push({ url, label: `${item.title} - ${sub.label}`, section: tab.title });
          }
        });
      }
      // Caso 2: Subgallery dinámica (acceso_0, acceso_1, ...)
      else if (item.type === 'subgallery') {
        Object.entries(sectionPhotos)
          .filter(([k]) => k.startsWith(item.id + '_'))
          .sort(([a], [b]) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
          .forEach(([, val], i) => {
            if (!val) return;
            const url = typeof val === 'string' ? val : val.url;
            if (url) processed.push({ url, label: `${item.label.replace('\n', ' ')} ${i + 1}`, section: tab.title });
          });
      }
      // Caso 3: Item normal
      else {
        const val = sectionPhotos[item.id];
        if (val) {
          const url = typeof val === 'string' ? val : val.url;
          if (url) processed.push({ url, label: item.label.replace('\n', ' '), section: tab.title });
        }
      }
    });

    // Caso 3: Extras
    EXTRAS_ITEMS.forEach(extraLabel => {
      const val = sectionPhotos[extraLabel];
      if (val) {
        const url = typeof val === 'string' ? val : val.url;
        if (url) processed.push({ url, label: extraLabel, section: tab.title });
      }
    });

    // Caso 4: Tabs dinámicos (adicionales) — todas las keys numéricas
    if (tab.dynamic) {
      const processedKeys = new Set([
        ...tab.items.flatMap(i => i.items ? i.items.map(s => s.id) : [i.id]),
        ...EXTRAS_ITEMS
      ]);
      Object.entries(sectionPhotos).forEach(([key, val]) => {
        if (processedKeys.has(key) || !val) return;
        const url = typeof val === 'string' ? val : val.url;
        if (url) processed.push({ url, label: `Adicional ${parseInt(key) + 1}`, section: tab.title });
      });
    }
  });

  // 2. Soporte Legacy (Array directo)
  if (Array.isArray(fotos)) {
    fotos.forEach((f, i) => {
      const url = typeof f === 'string' ? f : f.url;
      if (url) processed.push({ url, label: `Foto ${i + 1}`, section: 'FOTOS' });
    });
  }

  return processed;
};

// --- UTILIDAD PARA CANCELACIÓN ---
const checkSignal = (signal) => {
  if (signal && signal.aborted) {
    throw new Error("EXPORT_CANCELLED");
  }
};

// --- HELPER: Construir ZIP con fflate (sin compresión — STORE) ---
// Recibe un Map de { 'ruta/archivo.jpg' → Uint8Array } y devuelve un Blob ZIP.
// ZipPassThrough = STORE mode: sin compresión (los JPEG ya están comprimidos).
const buildFflateZip = (files) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const zip = new Zip((err, chunk, final) => {
      if (err) { reject(err); return; }
      chunks.push(chunk);
      if (final) resolve(new Blob(chunks, { type: 'application/zip' }));
    });
    for (const [name, data] of files) {
      const entry = new ZipPassThrough(name);
      zip.add(entry);
      entry.push(data instanceof Uint8Array ? data : new Uint8Array(data), true);
    }
    zip.end();
  });

// --- HELPER: Procesamiento paralelo con concurrencia limitada ---
// Procesa `items` llamando a `processFn(item)` con máximo `concurrency` tareas simultáneas.
// Preserva el orden de resultados. Si un item falla, su resultado es null.
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
        if (e?.message === 'EXPORT_CANCELLED') throw e;
        console.error('Error procesando foto:', e);
        results[i] = null;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runWorker)
  );
  return results;
};

// --- EXPORTAR EXCEL (PAGINADO + ATÓMICO) ---
// --- EXPORTAR EXCEL (PAGINADO + ATÓMICO) ---



// --- EXPORTAR ZIP (PAGINADO + ATÓMICO) ---
export const descargarFotosZip = async (proy, puntos, logoApp, signal, maxPhotosPerVol = 700, stampConfig = {}) => {
  if (!proy) return [];
  checkSignal(signal);

  let logoParaEstampar = null;
  let blobLogo = null;
  if (logoApp) {
    try {
      const response = await fetch(logoApp);
      blobLogo = await response.blob();
      logoParaEstampar = await urlABase64(logoApp); // Para estampar
    } catch (e) { console.error(e); }
  }
  checkSignal(signal);

  const puntosProyecto = ordenarPorPosicion(puntos.filter(p => perteneceAProyecto(p, proy)));
  const VOLUMENES = [];
  let volumenActual = 1;
  let puntosBuffer = [];
  let fotosCountBuffer = 0;
  const LIMITE_FOTOS = maxPhotosPerVol;

  const cerrarVolumen = async (listaPuntos, numVol) => {
    checkSignal(signal);
    const nombreCarpetaRaiz = proy.nombre.replace(/[\/\\?\*\[\]:]/g, '_').trim() || 'PROYECTO';

    // Map de ruta → Uint8Array para fflate (sin compresión)
    const allFiles = new Map();
    if (blobLogo) {
      allFiles.set(`${nombreCarpetaRaiz}/LOGO_EMPRESA.png`, new Uint8Array(await blobLogo.arrayBuffer()));
    }

    const contadoresPuntos = {};

    for (const p of listaPuntos) {
      checkSignal(signal);
      const numItem = String(p.datos.numero || 'SN');
      const partes = [numItem];
      if (p.datos.pasivo) partes.push(p.datos.pasivo);
      if (p.datos.tipo) partes.push(p.datos.tipo);
      const nombrePuntoBase = partes.join('-').replace(/[\/\\?\*\[\]:]/g, '_');

      // Deduplicar nombres de carpeta si hay puntos con igual item+pasivo
      let nombrePunto = nombrePuntoBase;
      if (contadoresPuntos[nombrePuntoBase] !== undefined) {
        contadoresPuntos[nombrePuntoBase]++;
        nombrePunto = `${nombrePuntoBase} (${contadoresPuntos[nombrePuntoBase]})`;
      } else {
        contadoresPuntos[nombrePuntoBase] = 1;
      }

      const carpetaPuntoPath = `${nombreCarpetaRaiz}/${nombrePunto}`;
      const gpsStr = `${(p.coords.lat || 0).toFixed(6)}, ${(p.coords.lng || 0).toFixed(6)}`;

      // Jobs de fotos para este punto: { url, path }
      const allZipJobs = [];
      const zipDatosEstampado = {
        numero: p.datos.numero,
        proyecto: proy.nombre,
        gps: gpsStr,
        fecha: p.datos.fecha || '',
        hora: p.datos.hora || '',
        codFat: p.datos.codFat || '',
        pasivo: p.datos.pasivo || '',
        direccion: p.datos.direccion || '',
        ubicacion: p.datos.ubicacion || '',
      };

      // --- FASE 1: Recopilar jobs de todas las secciones ---
      // Iterar secciones (tabs) con fotos
      for (const tabId of Object.keys(TABS_CONFIG)) {
        const tab = TABS_CONFIG[tabId];
        const secFotos = (p.datos.fotos && !Array.isArray(p.datos.fotos))
          ? (p.datos.fotos[tab.id] || {})
          : {};

        const secItems = [];
        tab.items.forEach(tabItem => {
          if (tabItem.items) {
            tabItem.items.forEach(sub => {
              const val = secFotos[sub.id];
              if (val) {
                const url = typeof val === 'string' ? val : val.url;
                if (url) secItems.push({ url, label: sub.label.replace('\n', ' ') });
              }
            });
          } else if (tabItem.type === 'subgallery') {
            Object.entries(secFotos)
              .filter(([k]) => k.startsWith(tabItem.id + '_'))
              .sort(([a], [b]) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
              .forEach(([, val], i) => {
                if (!val) return;
                const url = typeof val === 'string' ? val : val.url;
                if (url) secItems.push({ url, label: `${tabItem.label.replace('\n', ' ')} ${i + 1}` });
              });
          } else {
            const val = secFotos[tabItem.id];
            if (val) {
              const url = typeof val === 'string' ? val : val.url;
              if (url) secItems.push({ url, label: tabItem.label.replace('\n', ' ') });
            }
          }
        });
        EXTRAS_ITEMS.forEach(extraLabel => {
          const val = secFotos[extraLabel];
          if (val) {
            const url = typeof val === 'string' ? val : val.url;
            if (url) secItems.push({ url, label: extraLabel });
          }
        });

        // Catch-all: cualquier foto con key no cubierta (tabs dinámicos como adicionales)
        {
          const processedIds = new Set([
            ...tab.items.flatMap(i => i.items ? i.items.map(s => s.id) : [i.id]),
            ...EXTRAS_ITEMS
          ]);
          Object.entries(secFotos).forEach(([key, val]) => {
            if (processedIds.has(key) || !val) return;
            const url = typeof val === 'string' ? val : val.url;
            if (url && !url.startsWith('blob:')) secItems.push({ url, label: key });
          });
        }

        if (secItems.length === 0) continue;

        // Recopilar jobs con ruta completa
        for (const item of secItems) {
          if (!item.url || item.url.startsWith('blob:')) continue;
          const cleanLabel = item.label.replace(/[\/\\?\*\[\]:]/g, '_').substring(0, 50);
          allZipJobs.push({ url: item.url, path: `${carpetaPuntoPath}/${tab.title}/${cleanLabel}.jpg` });
        }
      }

      // Legacy: fotosGenerales
      const fotosGen = p.datos.fotosGenerales;
      if (Array.isArray(fotosGen) && fotosGen.length > 0) {
        fotosGen.forEach((f, i) => {
          const url = typeof f === 'string' ? f : f?.url;
          if (url && !url.startsWith('blob:')) {
            allZipJobs.push({ url, path: `${carpetaPuntoPath}/GENERALES/General_${i + 1}.jpg` });
          }
        });
      }

      // DEBUG TEMPORAL
      console.log('[ZIP] fotos raw:', JSON.stringify(p.datos.fotos?.adicionales));
      console.log('[ZIP] allZipJobs:', allZipJobs.map(j => j.path));

      // --- FASE 2: Descarga + estampado en paralelo (hasta 6 fotos simultáneas) ---
      const zipBuffers = await runParallel(allZipJobs, async (job) => {
        checkSignal(signal);
        const blob = await fetchStorageBlob(job.url);
        const res = await estamparMetadatos(blob, zipDatosEstampado, logoParaEstampar, stampConfig);
        return res.buffer;
      });

      // --- FASE 3: Registrar buffers en el mapa de archivos ---
      for (let k = 0; k < allZipJobs.length; k++) {
        if (!zipBuffers[k]) continue;
        allFiles.set(allZipJobs[k].path, new Uint8Array(zipBuffers[k]));
      }
    }

    const content = await buildFflateZip(allFiles);
    const nombreBase = proy.nombre.replace(/\s+/g, '_').toUpperCase();
    const nombreArchivo = (VOLUMENES.length === 0 && listaPuntos.length === puntosProyecto.length)
      ? `${nombreBase}.zip`
      : `${nombreBase}_VOL${numVol}.zip`;

    return {
      name: nombreArchivo,
      blob: content,
      numPuntos: listaPuntos.length
    };
  };

  for (const p of puntosProyecto) {
    checkSignal(signal);
    // CALCULAR FOTOS REALES (Usando helper)
    const fotosPunto = getFormattedPhotos(p).length;

    // FIX: Split si superamos FOTOS O PUNTOS
    const pesoLogico = Math.max(fotosPunto, 1);

    if (fotosCountBuffer + pesoLogico > LIMITE_FOTOS && puntosBuffer.length > 0) {
      const volFile = await cerrarVolumen(puntosBuffer, volumenActual);
      VOLUMENES.push(volFile);
      volumenActual++;
      puntosBuffer = [];
      fotosCountBuffer = 0;
    }
    puntosBuffer.push(p);
    fotosCountBuffer += pesoLogico;
  }
  if (puntosBuffer.length > 0) {
    const volFile = await cerrarVolumen(puntosBuffer, volumenActual);
    VOLUMENES.push(volFile);
  }

  return VOLUMENES;
};


// --- EXPORTAR KMZ (PAGINADO + ATÓMICO) ---
export const handleExportKML = async (proy, puntos, conexiones, logoApp, setExportData, signal, maxPhotosPerVol = 700, stampConfig = {}) => {
  if (!proy) return [];
  if (setExportData) setExportData(null);
  checkSignal(signal);

  let logoBase64 = null;
  if (logoApp) {
    logoBase64 = await urlABase64(logoApp);
  }

  const puntosProyecto = ordenarPorPosicion(puntos.filter(p => perteneceAProyecto(p, proy)));
  const conexionesProyecto = conexiones.filter(c => perteneceAProyecto(c, proy));

  // Colores por capacidad de fibra (hex → KML AABBGGRR)
  // Escapa texto que va dentro de una etiqueta XML/KML. El nombre del ramal lo
// escribe el usuario y un solo & dejaría el KMZ ilegible para Google Earth.
const escXml = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const KML_COLORES = { 6:'fff65c8b', 12:'fff6823b', 24:'ff9948ec', 48:'ff1673f9', 96:'ff4444ef', 144:'ff16cc84' };
  const capsUnicas = [...new Set(conexionesProyecto.map(c => c.capacidad).filter(Boolean))];
  const estilosLineas = [
    ...capsUnicas.map(cap => `  <Style id="linea_${cap}"><LineStyle><color>${KML_COLORES[cap] || 'fff6823b'}</color><width>3</width></LineStyle></Style>`),
    `  <Style id="linea_default"><LineStyle><color>fff6823b</color><width>3</width></LineStyle></Style>`
  ].join('\n');

  const VOLUMENES = [];
  let volumenActual = 1;
  let puntosBuffer = [];
  let fotosCountBuffer = 0;
  const LIMITE_FOTOS = maxPhotosPerVol; // Mismo límite

  const cerrarVolumen = async (listaPuntos, numVol) => {
    checkSignal(signal);
    const kmzFiles = new Map(); // ruta → Uint8Array

    let kmlHead = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${proy.nombre} (VOL ${numVol})</name>
  <Style id="posteStyle"><IconStyle><color>ffff0000</color><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><color>ffffff00</color><scale>0.8</scale></LabelStyle><BalloonStyle><text>$[description]</text></BalloonStyle></Style>
${estilosLineas}
  <Folder><name>Puntos</name>`;

    let kmlBody = "";

    const EVA_URL = 'https://www.evadigitalgroup.com/index.html';
    const evaPageHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>EVA Digital</title><style>body{font-family:Arial,sans-serif;padding:30px;background:#f5f5f5;color:#333;margin:0;font-size:14px;line-height:1.7}</style></head><body><p>Copia el siguiente link y conoce a EVA DIGITAL, empresa especialista en el diseño, implementacion y documentacion de redes de fibra optica: <a href="${EVA_URL}">${EVA_URL}</a></p></body></html>`;
    kmzFiles.set('files/eva.html', new TextEncoder().encode(evaPageHtml));

    for (let ptIdx = 0; ptIdx < listaPuntos.length; ptIdx++) {
      checkSignal(signal);
      const p = listaPuntos[ptIdx];
      const uid = ptIdx;
      const lat = (p.coords.lat || 0).toFixed(6);
      const lng = (p.coords.lng || 0).toFixed(6);
      const fotos = p.datos.fotos || {};

      // Construir secciones con fotos (misma estructura que ZIP/Excel)
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

      // Soporte legacy (array directo)
      if (Array.isArray(fotos)) {
        const legItems = [];
        fotos.forEach((f, i) => {
          const url = typeof f === 'string' ? f : f.url;
          if (url && !url.startsWith('blob:')) legItems.push({ url, label: `Foto ${i + 1}`, fileIdx: photoIdx++ });
        });
        if (legItems.length > 0) sections.push({ title: 'FOTOS', photos: legItems });
      }

      // Aplanar solo fotos con URL (items sin foto se muestran grises en selector)
      const allKmzPhotos = sections.flatMap(sec => sec.photos.filter(ph => ph.url));
      const kmzDatosEstampado = {
        numero: p.datos.numero,
        proyecto: proy.nombre,
        gps: `${lat}, ${lng}`,
        fecha: p.datos.fecha || new Date().toISOString(),
        hora: p.datos.hora || '',
        codFat: p.datos.codFat || '',
        pasivo: p.datos.pasivo || '',
        direccion: p.datos.direccion || '',
        ubicacion: p.datos.ubicacion || '',
      };

      // --- Descarga + estampado en paralelo (hasta 6 fotos simultáneas) ---
      const kmzBuffers = await runParallel(allKmzPhotos, async (photo) => {
        checkSignal(signal);
        const blobOrig = await fetchStorageBlob(photo.url);
        const res = await estamparMetadatos(blobOrig, kmzDatosEstampado, logoBase64, stampConfig);
        return res.buffer;
      });

      // Guardar y asignar nombres (modifica los objetos originales en `sections`)
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

      // Construir selector de fotos (desglosable por sección)
      let selectorHtml = '';
      if (sectionsConFotos.length > 0) {
        sectionsConFotos.forEach((sec, sIdx) => {
          const openAttr = sIdx === 0 ? ' open' : '';
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
          // Acordeón: for loop en vez de forEach para compatibilidad con Google Earth
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
    <div style="color:#FCBF26;font-weight:900;font-size:14px;">${proy.nombre.toUpperCase()}</div>
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
          <div style="color:#FCBF26;font-weight:900;font-size:14px;margin-bottom:3px;">${proy.nombre.toUpperCase()}</div>
          <div style="font-size:11px;color:#ccc;"><span style="margin-right:16px;"><span style="color:#888;">ITEM</span>&nbsp;<b style="color:#fff;">${p.datos.numero || 'S/N'}</b></span><span><span style="color:#888;">PASIVO</span>&nbsp;<b style="color:#fff;">${p.datos.pasivo || '-'}</b></span></div>
        </td>
        <td style="vertical-align:middle;text-align:right;font-size:9px;color:#fff;padding:0 0 0 12px;white-space:nowrap;width:1%;">${p.datos.direccion ? '<div>' + p.datos.direccion + '</div>' : ''}${p.datos.ubicacion ? '<div>' + p.datos.ubicacion + '</div>' : ''}<div>${lat}, ${lng}</div></td>
      </tr>
    </table>
  </div>
  <div style="padding:6px 10px;border-bottom:2px solid #eee;font-size:11px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Armado</span><b>${p.datos.armado || '-'}</b></td>
        <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Material</span><b>${p.datos.material || '-'}</b></td>
        <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Red</span><b>${p.datos.red || '-'}</b></td>
        <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Altura</span><b>${p.datos.altura || '-'}</b></td>
        <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Fuerza</span><b>${p.datos.fuerza || '-'}</b></td>
        <td style="padding:3px 5px;text-align:center;"><span style="color:#888;font-size:9px;display:block;text-transform:uppercase;">Cables</span><b>${p.datos.cables || '-'}</b></td>
      </tr>
    </table>
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
            <name>${p.datos.numero || 'S/N'}${p.datos.pasivo ? '-' + p.datos.pasivo : ''}</name>
            <Snippet maxLines="0"/>
            <styleUrl>#posteStyle</styleUrl>
            <description><![CDATA[${htmlPopup}]]></description>
            <Point><coordinates>${lng},${lat},0</coordinates></Point>
          </Placemark>`;
    }

    let kmlLines = "";
    if (numVol === 1) { // LÍNEAS SOLO EN VOL 1
      kmlLines += `</Folder><Folder><name>Líneas</name>`;
      conexionesProyecto.forEach(c => {
        // La fibra nueva trae su propia geometría. Las viejas solo guardan ids de
        // poste y su forma se sigue deduciendo de dónde estén esos postes.
        const coords = (Array.isArray(c.vertices) && c.vertices.length >= 2)
          ? c.vertices
              .filter(v => v && v.lat != null && v.lng != null)
              .map(v => `${(v.lng || 0).toFixed(6)},${(v.lat || 0).toFixed(6)},0`)
          : ((Array.isArray(c.puntos) && c.puntos.length >= 2) ? c.puntos : [c.from, c.to].filter(Boolean))
              .map(id => puntos.find(p => String(p.id) === String(id)))
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
    }

    const kmlFinal = `${kmlHead}${kmlBody}${kmlLines}</Folder></Document></kml>`;
    kmzFiles.set('doc.kml', new TextEncoder().encode(kmlFinal));

    const content = await buildFflateZip(kmzFiles);
    const nombreBase = proy.nombre.replace(/\s+/g, '_').toUpperCase();
    const nombreArchivo = (VOLUMENES.length === 0 && listaPuntos.length === puntosProyecto.length)
      ? `${nombreBase}.kmz`
      : `${nombreBase}_VOL${numVol}.kmz`;

    return {
      name: nombreArchivo,
      blob: content,
      numPuntos: listaPuntos.length
    };
  };

  for (const p of puntosProyecto) {
    checkSignal(signal);
    // CALCULAR FOTOS REALES (Usando helper)
    const fotosPunto = getFormattedPhotos(p).length;

    // FIX: Split si superamos FOTOS O PUNTOS
    const pesoLogico = Math.max(fotosPunto, 1);

    if (fotosCountBuffer + pesoLogico > LIMITE_FOTOS && puntosBuffer.length > 0) {
      const volFile = await cerrarVolumen(puntosBuffer, volumenActual);
      VOLUMENES.push(volFile);
      volumenActual++;
      puntosBuffer = [];
      fotosCountBuffer = 0;
    }
    puntosBuffer.push(p);
    fotosCountBuffer += pesoLogico;
  }
  if (puntosBuffer.length > 0) {
    const volFile = await cerrarVolumen(puntosBuffer, volumenActual);
    VOLUMENES.push(volFile);
  }

  return VOLUMENES;
};
