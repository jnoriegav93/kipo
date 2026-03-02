import { Zip, ZipPassThrough } from 'fflate';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { urlABase64, estamparMetadatos } from './helpers';
import { TABS_CONFIG, EXTRAS_ITEMS } from '../components/PhotoManager';

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
      // Caso 1: Subsección de items
      if (item.items) {
        item.items.forEach(sub => {
          const val = sectionPhotos[sub.id];
          if (val) {
            const url = typeof val === 'string' ? val : val.url;
            if (url) processed.push({ url, label: `${item.title} - ${sub.label}`, section: tab.title });
          }
        });
      }
      // Caso 2: Item normal
      else {
        const val = sectionPhotos[item.id];
        if (val) {
          const url = typeof val === 'string' ? val : val.url;
          if (url) processed.push({ url, label: item.label.replace('\n', ' '), section: tab.title });
        }
      }
    });

    // Caso 3: Extras (que se guardan en el mismo objeto de sección)
    EXTRAS_ITEMS.forEach(extraLabel => {
      const val = sectionPhotos[extraLabel];
      if (val) {
        const url = typeof val === 'string' ? val : val.url;
        if (url) processed.push({ url, label: extraLabel, section: tab.title });
      }
    });
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
export const descargarReporteExcel = async (proy, puntos, logoApp, config, signal, maxPhotosPerVol = 700, stampConfig = {}) => {
  if (!proy) return [];
  checkSignal(signal);

  let logoBase64 = null;
  if (logoApp) {
    logoBase64 = await urlABase64(logoApp);
  }
  checkSignal(signal);

  const puntosProyecto = puntos.filter(p => proy.dias.some(d => d.id === p.diaId));
  const VOLUMENES = [];
  let volumenActual = 1;

  let puntosBuffer = [];
  let fotosCountBuffer = 0;
  const LIMITE_FOTOS = maxPhotosPerVol;

  // Helper: elimina prefijo "FAT " si el usuario lo escribió en el campo
  const normFat = (val) => (val || '').replace(/^fat[\s\-]*/i, '').trim();

  // Helper: consolida ferretería (armado base + extras/restas)
  const getConsolidado = (datos) => {
    const totals = {};
    (datos.armadosSeleccionados || []).forEach(armado => {
      (armado.items || []).forEach(item => {
        totals[item.idRef] = (totals[item.idRef] || 0) + item.cant;
      });
    });
    Object.entries(datos.ferreteriaExtra || {}).forEach(([id, cantidad]) => {
      if (cantidad !== 0) totals[id] = (totals[id] || 0) + cantidad;
    });
    return totals;
  };

  // Ferreterías del catálogo principal (todas, independientemente de si están visibles en el formulario)
  const ferreteriasVisibles = config.catalogoFerreteria || [];

  // Dimensiones de celda para fotos (mismo ancho/alto que antes)
  const PHOTO_COL_WIDTH = 55;  // caracteres (≈385 px)
  const PHOTO_ROW_HEIGHT = 400; // puntos Excel (≈533 px)
  const LABEL_ROW_HEIGHT = 20;  // puntos para fila de etiqueta
  const SEC_COL_WIDTH = 10;     // columna A: nombre de sección (texto rotado)

  const cerrarVolumen = async (listaPuntos, numVol) => {
    checkSignal(signal);
    const workbook = new ExcelJS.Workbook();

    // --- HOJA DATOS ---
    const colsDef = [
      { header: 'CORRELATIVO',     key: 'correlativo',      width: 12 },
      { header: 'ITEM',            key: 'numero',           width: 12 },
      { header: 'PASIVO',          key: 'pasivo',           width: 14 },
      { header: 'COD POSTE',       key: 'codPoste',         width: 15 },
      { header: 'SUMINISTRO',      key: 'sum',              width: 15 },
      { header: 'ALTURA',          key: 'alt',              width: 10 },
      { header: 'MATERIAL',        key: 'mat',              width: 12 },
      { header: 'FUERZA (kg)',     key: 'fuerza',           width: 12 },
      { header: 'TIPO DE RED',     key: 'tipo',             width: 14 },
      { header: 'EXTRAS',          key: 'extras',           width: 25 },
      { header: 'CANT. CABLES',    key: 'cables',           width: 12 },
      { header: 'ARMADO',          key: 'arm',              width: 20 },
      ...ferreteriasVisibles.map(f => ({
        header: f.nombre.toUpperCase(),
        key: `ferr_${f.id}`,
        width: Math.max(12, Math.min(f.nombre.length + 4, 22))
      })),
      { header: 'ABSCISA INICIAL', key: 'abscisaInicial',  width: 15 },
      { header: 'ABSCISA FINAL',   key: 'abscisaFinal',    width: 15 },
      { header: 'FECHA',           key: 'fecha',            width: 12 },
      { header: 'HORA',            key: 'hora',             width: 10 },
      { header: 'DIRECCIÓN',       key: 'dir',              width: 30 },
      { header: 'UBICACIÓN',       key: 'ubic',             width: 22 },
      { header: 'LATITUD',         key: 'lat',              width: 15 },
      { header: 'LONGITUD',        key: 'lng',              width: 15 },
      { header: 'GPS',             key: 'gps',              width: 25 },
      { header: 'OBSERVACIONES',   key: 'obs',              width: 35 },
    ];

    const wsDatos = workbook.addWorksheet('DATOS', { views: [{ state: 'frozen', ySplit: 2 }] });
    wsDatos.columns = colsDef;
    wsDatos.insertRow(1, []); // Empuja headers a fila 2, libera fila 1 para título

    // Título (fila 1, sin logo)
    wsDatos.mergeCells(1, 1, 1, 8);
    const cellTitulo = wsDatos.getCell('A1');
    cellTitulo.value = `REPORTE: ${proy.nombre.toUpperCase()} (VOL ${numVol})`;
    cellTitulo.font = { size: 14, bold: true, color: { argb: 'FF1F4E78' } };
    cellTitulo.alignment = { vertical: 'middle' };
    wsDatos.getRow(1).height = 26;

    // Estilo cabeceras (fila 2)
    const headerRow = wsDatos.getRow(2);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Color #FCBF26 con texto negro para columnas de ARMADO y FERRETERÍAS
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

    // --- 2. UNA HOJA POR PUNTO ---
    for (let i = 0; i < listaPuntos.length; i++) {
      checkSignal(signal);
      const p = listaPuntos[i];
      const correlativo = String(i + 1).padStart(3, '0');
      const valNum = p.datos.numero || '-';
      const valFat = normFat(p.datos.codFat || '');
      const lat = (p.coords.lat || 0).toFixed(6);
      const lng = (p.coords.lng || 0).toFixed(6);

      // Nombre de hoja: correlativo (001, 002, 003...)
      let sheetName = correlativo;
      if (usedSheetNames.has(sheetName)) {
        let cnt = 2;
        while (usedSheetNames.has(`${correlativo}_${cnt}`)) cnt++;
        sheetName = `${correlativo}_${cnt}`;
      }
      usedSheetNames.add(sheetName);

      // Fila en hoja DATOS (datos desde fila 3: fila 1=título, fila 2=cabeceras)
      const totals = getConsolidado(p.datos);
      const ferrValues = {};
      ferreteriasVisibles.forEach(f => {
        ferrValues[`ferr_${f.id}`] = totals[f.id] || 0;
      });

      const armNombre = (p.datos.armadosSeleccionados?.length > 0)
        ? p.datos.armadosSeleccionados.map(a => a.nombre).join(', ')
        : (p.datos.armadoSeleccionado
          ? config.armados?.find(a => a.id === p.datos.armadoSeleccionado.idArmado)?.nombre
          : null) || '-';

      const fechaFormateada = p.datos.fecha
        ? new Date(p.datos.fecha).toLocaleDateString('es-PE')
        : '-';

      const row = wsDatos.getRow(i + 3);
      row.values = {
        correlativo,
        numero: valNum,
        pasivo: p.datos.pasivo || '-',
        codPoste: p.datos.codigo || '-',
        sum: p.datos.suministro || '-',
        alt: p.datos.altura || '-',
        mat: p.datos.material || '-',
        fuerza: p.datos.fuerza || '-',
        tipo: p.datos.tipo || '-',
        extras: Array.isArray(p.datos.extrasSeleccionados) ? (p.datos.extrasSeleccionados.join(', ') || '-') : '-',
        cables: p.datos.cables || '-',
        arm: armNombre,
        ...ferrValues,
        abscisaInicial: p.datos.absIn || '-',
        abscisaFinal: p.datos.absOut || '-',
        fecha: fechaFormateada,
        hora: p.datos.hora || '-',
        dir: p.datos.direccion || '-',
        ubic: p.datos.ubicacion || '-',
        lat: Number(lat),
        lng: Number(lng),
        gps: `${lat}, ${lng}`,
        obs: p.datos.observaciones || '-'
      };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      // Correlativo con hipervínculo a la hoja de fotos
      const cellCorr = row.getCell('correlativo');
      cellCorr.value = { text: correlativo, hyperlink: `#'${sheetName}'!A1` };
      cellCorr.font = { color: { argb: 'FF0000FF' }, underline: true, bold: true };

      // --- HOJA DEL PUNTO ---
      const wsPoint = workbook.addWorksheet(sheetName);
      wsPoint.getColumn(1).width = SEC_COL_WIDTH;
      let curRow = 1;
      let esPrimeraSeccion = true;

      // Jobs de fotos: { url, colIdx, imgRowIdx } — se llenan en fase 1 y se procesan en fase 2
      const allPhotoJobs = [];

      // Metadatos de estampado (iguales para todas las fotos del punto)
      const datosEstampado = {
        numero: valNum,
        proyecto: proy.nombre,
        gps: `${lat}, ${lng}`,
        fecha: p.datos.fecha || new Date().toISOString(),
        hora: p.datos.hora || '',
        codFat: valFat,
        pasivo: p.datos.pasivo || '',
        direccion: p.datos.direccion || '',
        ubicacion: p.datos.ubicacion || '',
      };

      // --- FASE 1: Estructura de celdas (sync) + recopilación de jobs de fotos ---
      for (const tabId of Object.keys(TABS_CONFIG)) {
        const tab = TABS_CONFIG[tabId];
        const secFotos = (p.datos.fotos && !Array.isArray(p.datos.fotos))
          ? (p.datos.fotos[tab.id] || {})
          : {};

        const secItems = [];
        tab.items.forEach(item => {
          if (item.items) {
            item.items.forEach(sub => {
              const val = secFotos[sub.id];
              if (val) {
                const url = typeof val === 'string' ? val : val.url;
                if (url && !url.startsWith('blob:')) secItems.push({ url, label: sub.label.replace('\n', ' ') });
              }
            });
          } else {
            const val = secFotos[item.id];
            if (val) {
              const url = typeof val === 'string' ? val : val.url;
              if (url && !url.startsWith('blob:')) secItems.push({ url, label: item.label.replace('\n', ' ') });
            }
          }
        });
        EXTRAS_ITEMS.forEach(extraLabel => {
          const val = secFotos[extraLabel];
          if (val) {
            const url = typeof val === 'string' ? val : val.url;
            if (url && !url.startsWith('blob:')) secItems.push({ url, label: extraLabel });
          }
        });

        if (secItems.length === 0) continue;

        if (!esPrimeraSeccion) {
          wsPoint.getRow(curRow).height = 12;
          curRow++;
        }
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

      // Legacy: fotosGenerales
      const fotosGen = p.datos.fotosGenerales;
      if (Array.isArray(fotosGen) && fotosGen.length > 0) {
        const genItems = fotosGen
          .map((f, idx) => ({ url: typeof f === 'string' ? f : f?.url, label: `General ${idx + 1}` }))
          .filter(item => item.url && !item.url.startsWith('blob:'));
        if (genItems.length > 0) {
          for (let c = 2; c <= genItems.length + 1; c++) {
            const col = wsPoint.getColumn(c);
            if (!col.width || col.width < PHOTO_COL_WIDTH) col.width = PHOTO_COL_WIDTH;
          }
          if (!esPrimeraSeccion) {
            wsPoint.getRow(curRow).height = 12;
            curRow++;
          }
          esPrimeraSeccion = false;
          const imgRowIdx = curRow;
          const lblRowIdx = curRow + 1;
          wsPoint.getRow(imgRowIdx).height = PHOTO_ROW_HEIGHT;
          wsPoint.getRow(lblRowIdx).height = LABEL_ROW_HEIGHT;
          wsPoint.mergeCells(imgRowIdx, 1, lblRowIdx, 1);
          const cellSecGen = wsPoint.getCell(imgRowIdx, 1);
          cellSecGen.value = 'GENERALES';
          cellSecGen.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
          cellSecGen.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF404040' } };
          cellSecGen.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
          for (let j = 0; j < genItems.length; j++) {
            const colIdx = j + 2;
            const cellLbl = wsPoint.getCell(lblRowIdx, colIdx);
            cellLbl.value = genItems[j].label;
            cellLbl.alignment = { horizontal: 'center', vertical: 'middle' };
            cellLbl.font = { bold: true, size: 9 };
            cellLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
            allPhotoJobs.push({ url: genItems[j].url, colIdx, imgRowIdx });
          }
          curRow += 2;
        }
      }

      // --- FASE 2: Descarga + estampado en paralelo (hasta 6 fotos simultáneas) ---
      const photoBuffers = await runParallel(allPhotoJobs, async (job) => {
        checkSignal(signal);
        const response = await fetch(job.url);
        const blob = await response.blob();
        const res = await estamparMetadatos(blob, datosEstampado, logoBase64, stampConfig);
        return res.buffer;
      });

      // --- FASE 3: Insertar imágenes en el workbook (en orden) ---
      for (let k = 0; k < allPhotoJobs.length; k++) {
        if (!photoBuffers[k]) continue;
        const { colIdx, imgRowIdx } = allPhotoJobs[k];
        const imgId = workbook.addImage({ buffer: photoBuffers[k], extension: 'jpeg' });
        wsPoint.addImage(imgId, {
          tl: { col: colIdx - 1, row: imgRowIdx - 1 },
          br: { col: colIdx, row: imgRowIdx }
        });
      }
    }

    const content = await workbook.xlsx.writeBuffer();
    const nombreBase = proy.nombre.replace(/\s+/g, '_').toUpperCase();
    const nombreArchivo = VOLUMENES.length === 0 && listaPuntos.length === puntosProyecto.length
      ? `${nombreBase}.xlsx`
      : `${nombreBase}_VOL${numVol}.xlsx`;

    return {
      name: nombreArchivo,
      blob: new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      numPuntos: listaPuntos.length
    };
  };

  for (const p of puntosProyecto) {
    checkSignal(signal);
    // CALCULAR FOTOS REALES (Usando helper)
    const fotosPunto = getFormattedPhotos(p).length;

    // FIX: Split si superamos FOTOS O PUNTOS (si no hay fotos, dividimos por puntos equitativamente)
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

  const puntosProyecto = puntos.filter(p => proy.dias.some(d => d.id === p.diaId));
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
      const pasivoItem = p.datos.pasivo || 'SP';
      const nombrePuntoBase = `${numItem} - ${pasivoItem}`.replace(/[\/\\?\*\[\]:]/g, '_');

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

      // --- FASE 2: Descarga + estampado en paralelo (hasta 6 fotos simultáneas) ---
      const zipBuffers = await runParallel(allZipJobs, async (job) => {
        checkSignal(signal);
        const response = await fetch(job.url);
        const blob = await response.blob();
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

  const puntosProyecto = puntos.filter(p => proy.dias.some(d => d.id === p.diaId));
  const conexionesProyecto = conexiones.filter(c => proy.dias.some(d => d.id === c.diaId));

  // Colores por capacidad de fibra (hex → KML AABBGGRR)
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
  <Style id="posteStyle"><IconStyle><scale>1.0</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><BalloonStyle><text>$[description]</text></BalloonStyle></Style>
${estilosLineas}
  <Folder><name>Puntos</name>`;

    let kmlBody = "";

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
        const response = await fetch(photo.url);
        const blobOrig = await response.blob();
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

      // Construir selector de fotos (desglosable por sección)
      let selectorHtml = '';
      if (sections.length > 0) {
        sections.forEach((sec, sIdx) => {
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

      const evaHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title> </title><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f0f0f0}.card{background:#fff;margin:20px 16px;padding:24px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.15)}.logo{font-size:20px;font-weight:900;text-align:center;margin-bottom:14px}.eva{color:#FCBF26}.dig{color:#100F1D}p{color:#555;font-size:13px;text-align:center;line-height:1.6;margin-bottom:14px}.url-box{border:1px dashed #ccc;padding:8px 12px;font-size:11px;color:#888;text-align:center;margin-bottom:16px;word-break:break-all}.btn{display:block;width:100%;background:#100F1D;color:#FCBF26;font-weight:bold;font-size:13px;padding:12px;border:none;border-radius:4px;cursor:pointer;letter-spacing:1px}</style></head><body><div class="card"><div class="logo"><span class="eva">EVA</span> <span class="dig">Digital</span></div><p>Si te interesa conocer mas sobre nuestras soluciones de ingenieria, diseno de redes y software especializado, visita nuestra web:</p><div class="url-box">https://www.evadigitalgroup.com/index.html</div><button class="btn" onclick="var t=document.createElement('textarea');t.value='https://www.evadigitalgroup.com/index.html';document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);this.innerText='COPIADO!'">COPIAR ENLACE</button></div></body></html>`;
      const evaDataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(evaHtml);

      const htmlPopup = `<div style="font-family:Segoe UI,Arial,sans-serif;width:570px;background:#fff;color:#333;border-radius:0;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.2);">
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
            <name>ITEM: ${p.datos.numero || 'S/N'}${p.datos.pasivo ? ' - ' + p.datos.pasivo : ''}</name>
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
        // Usar todos los puntos del recorrido (multi-segmento), con fallback a from/to
        const idsSerie = (Array.isArray(c.puntos) && c.puntos.length >= 2)
          ? c.puntos
          : [c.from, c.to].filter(Boolean);
        const coords = idsSerie
          .map(id => puntos.find(p => p.id === id))
          .filter(p => p && p.coords)
          .map(p => `${p.coords.lng.toFixed(6)},${p.coords.lat.toFixed(6)},0`);
        if (coords.length < 2) return;
        const cap = c.capacidad;
        const styleId = (cap && KML_COLORES[cap]) ? `linea_${cap}` : 'linea_default';
        const nombre = cap ? `${cap} hilos` : 'Línea de fibra';
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
