// Web Worker: estampado de fotos alta calidad usando OffscreenCanvas
// Corre en un hilo separado, no bloquea el hilo principal (UI)

function fitFont(ctx, text, maxW, defaultFs, bold) {
  let fs = defaultFs;
  ctx.font = `${bold ? '700' : '400'} ${fs}px Arial, sans-serif`;
  while (fs > 8 && ctx.measureText(text).width > maxW) {
    fs -= 1;
    ctx.font = `${bold ? '700' : '400'} ${fs}px Arial, sans-serif`;
  }
}

async function estamparEnWorker(imageBitmap, datos, logoBase64, stampConfig, quality = 0.85) {
  const {
    logoPosition = 'right',
    mostrarNroPoste = true,
    mostrarCodFat = false,
    fondoSello = 'white',
  } = stampConfig || {};

  const w = imageBitmap.width;
  const h = imageBitmap.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0, w, h);

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

    if (fondoSello === 'glass') {
      try {
        ctx.save();
        ctx.filter = 'blur(10px)';
        ctx.drawImage(imageBitmap, 0, yBase, w, cajaAlto, 0, yBase, w, cajaAlto);
        ctx.restore();
      } catch {}
      ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
      ctx.fillRect(0, yBase, w, cajaAlto);
    } else if (fondoSello === 'black') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.80)';
      ctx.fillRect(0, yBase, w, cajaAlto);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.90)';
      ctx.fillRect(0, yBase, w, cajaAlto);
    }

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

    const fs = Math.max(14, Math.round(cajaAlto * 0.28));
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

    // Columna 1 (25% izq): Proyecto / Nro
    ctx.textAlign = 'left';
    const c1MaxW = xDiv1 - hPad * 2;
    ctx.fillStyle = clrBold;
    const proyTxt = (datos.proyecto || '').toUpperCase();
    fitFont(ctx, proyTxt, c1MaxW, fs, true);
    ctx.fillText(proyTxt, hPad, r1Y);

    const nro = String(datos.numero || '-').padStart(3, '0');
    const pasivo = datos.pasivo || datos.codFat || '-';
    let idTxt = '';
    if (mostrarNroPoste && mostrarCodFat) idTxt = `${nro}  |  ${pasivo}`;
    else if (mostrarNroPoste) idTxt = nro;
    else if (mostrarCodFat) idTxt = pasivo;
    else idTxt = nro;
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
        ? (typeof f === 'string' && f.includes('T') ? new Date(f).toLocaleDateString('es-PE') : f)
        : new Date().toLocaleDateString('es-PE');
      fechaTxt = datos.hora ? `${fechaStr}  ${datos.hora}` : fechaStr;
    } catch {
      fechaTxt = datos.fecha || new Date().toLocaleDateString();
    }
    fitFont(ctx, fechaTxt, c2MaxW, fs, false);
    ctx.fillText(fechaTxt, c2x, r1Y);
    fitFont(ctx, datos.gps || '', c2MaxW, fs, false);
    ctx.fillText(datos.gps || '', c2x, r2Y);

    // Columna 3 (35% der): Dirección / Ubicación
    ctx.textAlign = 'right';
    const c3x = w - hPad;
    const c3MaxW = w - xDiv2 - hPad * 2;
    ctx.fillStyle = clrNormal;
    fitFont(ctx, datos.direccion || '', c3MaxW, fs, false);
    ctx.fillText(datos.direccion || '', c3x, r1Y);
    ctx.fillStyle = clrFaint;
    fitFont(ctx, datos.ubicacion || '', c3MaxW, fs, false);
    ctx.fillText(datos.ubicacion || '', c3x, r2Y);

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Logo en esquina superior
    if (logoBase64) {
      try {
        const logoResp = await fetch(logoBase64);
        const logoBlob = await logoResp.blob();
        const logoBitmap = await createImageBitmap(logoBlob);
        const logoMaxH = h * 0.156;
        const logoMaxW = w * 0.264;
        const scale = Math.min(logoMaxW / logoBitmap.width, logoMaxH / logoBitmap.height, 1);
        const anchoL = logoBitmap.width * scale;
        const altoL = logoBitmap.height * scale;
        const logoPad = Math.max(w * 0.012, 4);
        const xLogo = logoPosition === 'left' ? logoPad : w - anchoL - logoPad;
        ctx.drawImage(logoBitmap, xLogo, logoPad, anchoL, altoL);
      } catch {}
    }
  }

  const resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  const jpegBuffer = await resultBlob.arrayBuffer();
  return inyectarEXIF(jpegBuffer, datos);
}

// ─── EXIF binary injector ────────────────────────────────────────────────────
// Writes GPS, DateTime, ImageDescription and Artist tags directly into the JPEG.
// Canvas-produced JPEGs have no EXIF, so we insert a fresh APP1 segment after SOI.

function inyectarEXIF(jpegBuffer, datos) {
  const pad = n => String(n).padStart(2, '0');

  // Parse GPS string "lat, lng"
  let gpsData = null;
  if (datos?.gps) {
    const parts = datos.gps.split(',').map(s => s.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) gpsData = { lat, lng };
    }
  }

  // Build EXIF datetime string "YYYY:MM:DD HH:MM:SS"
  let dtStr = '';
  let dtGps = '';
  try {
    let dt = new Date();
    if (datos?.fecha) {
      const f = datos.fecha;
      if (typeof f === 'string' && f.includes('T')) dt = new Date(f);
      else if (typeof f === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(f)) {
        const [d, m, y] = f.split('/');
        dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      }
    }
    if (datos?.hora && /^\d{1,2}:\d{2}/.test(datos.hora)) {
      const [h, min] = datos.hora.split(':');
      dt.setHours(parseInt(h), parseInt(min), 0);
    }
    dtStr = `${dt.getFullYear()}:${pad(dt.getMonth()+1)}:${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    dtGps = `${dt.getFullYear()}:${pad(dt.getMonth()+1)}:${pad(dt.getDate())}`;
  } catch {
    const now = new Date();
    dtStr = `${now.getFullYear()}:${pad(now.getMonth()+1)}:${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    dtGps = dtStr.slice(0, 10);
  }

  const nroStr = String(datos?.numero || '').padStart(3, '0');
  const imageDesc = `Kipo - ${datos?.proyecto || ''} #${nroStr}`;

  // Decimal degrees → DMS rationals [deg/1, min/1, sec/1000]
  const toDMS = (decimal) => {
    const abs = Math.abs(decimal);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60 * 1000);
    return [deg, min, sec];
  };

  // Minimal byte-array builder (little-endian TIFF)
  const bytes = [];
  const u8  = v => bytes.push(v & 0xFF);
  const u16 = v => { u8(v); u8(v >> 8); };
  const u32 = v => { u16(v); u16(v >> 16); };
  const asc = s => { for (const c of s) u8(c.charCodeAt(0)); u8(0); };
  const rat = (n, d) => { u32(n); u32(d); };

  // IFD entry: tag(2) type(2) count(4) value/offset(4)
  // If val is a number → u32. If array → write up to 4 bytes (padded with 0).
  const entry = (tag, type, count, val) => {
    u16(tag); u16(type); u32(count);
    if (typeof val === 'number') { u32(val); }
    else { for (let i = 0; i < 4; i++) u8(i < val.length ? val[i] : 0); }
  };

  // ASCII string lengths (count includes null terminator)
  const descLen  = imageDesc.length + 1;   // variable
  const dtLen    = dtStr.length + 1;        // 20
  const artistLen = 5;                       // "Kipo\0"
  const gpsDateLen = dtGps.length + 1;      // 11

  // Layout (all offsets relative to start of TIFF header):
  //  0        TIFF header  (8 bytes)
  //  8        IFD0         (2 + 5*12 + 4 = 66 bytes, or 54 without GPS)
  const hasGPS = gpsData !== null;
  const ifd0Entries  = hasGPS ? 5 : 4;
  const ifd0Size     = 2 + ifd0Entries * 12 + 4;
  const exifIFDStart = 8 + ifd0Size;
  const exifIFDSize  = 2 + 2 * 12 + 4;     // 30 bytes
  const gpsIFDStart  = exifIFDStart + exifIFDSize;
  const gpsIFDSize   = hasGPS ? (2 + 6 * 12 + 4) : 0;

  // Data section starts here
  let cur = gpsIFDStart + gpsIFDSize;
  const descOff    = cur; cur += descLen;
  const dtOff      = cur; cur += dtLen;
  const artistOff  = cur; cur += artistLen;
  const dtOrigOff  = cur; cur += dtLen;
  const dtDigOff   = cur; cur += dtLen;
  let latOff, lngOff, gpsDateOff;
  if (hasGPS) {
    latOff     = cur; cur += 24;  // 3 rationals
    lngOff     = cur; cur += 24;
    gpsDateOff = cur; cur += gpsDateLen;
  }

  // ── TIFF header ──
  u8(0x49); u8(0x49);  // 'II' little-endian
  u16(42);             // magic
  u32(8);              // IFD0 at offset 8

  // ── IFD0 (entries must be sorted by tag) ──
  u16(ifd0Entries);
  entry(0x010E, 2, descLen,    descOff);        // ImageDescription
  entry(0x0132, 2, dtLen,      dtOff);           // DateTime
  entry(0x013B, 2, artistLen,  artistOff);       // Artist
  entry(0x8769, 4, 1,          exifIFDStart);    // ExifIFD pointer
  if (hasGPS) entry(0x8825, 4, 1, gpsIFDStart); // GPSIFD pointer
  u32(0); // no more IFDs

  // ── ExifIFD ──
  u16(2);
  entry(0x9003, 2, dtLen, dtOrigOff); // DateTimeOriginal
  entry(0x9004, 2, dtLen, dtDigOff);  // DateTimeDigitized
  u32(0);

  // ── GPSIFD ──
  if (hasGPS) {
    const { lat, lng } = gpsData;
    const latDMS = toDMS(lat);
    const lngDMS = toDMS(lng);
    u16(6);
    entry(0x0000, 1, 4,  [2, 3, 0, 0]);                              // GPSVersionID
    entry(0x0001, 2, 2,  lat >= 0 ? [78,0,0,0] : [83,0,0,0]);       // LatRef N/S
    entry(0x0002, 5, 3,  latOff);                                     // Latitude
    entry(0x0003, 2, 2,  lng >= 0 ? [69,0,0,0] : [87,0,0,0]);       // LngRef E/W
    entry(0x0004, 5, 3,  lngOff);                                     // Longitude
    entry(0x001D, 2, gpsDateLen, gpsDateOff);                         // GPSDateStamp
    u32(0);

    // GPS rational data
    rat(latDMS[0], 1); rat(latDMS[1], 1); rat(latDMS[2], 1000);
    rat(lngDMS[0], 1); rat(lngDMS[1], 1); rat(lngDMS[2], 1000);
    asc(dtGps);
  }

  // ── Data section ──
  asc(imageDesc);  // ImageDescription
  asc(dtStr);      // DateTime
  asc('Kipo');     // Artist
  asc(dtStr);      // DateTimeOriginal
  asc(dtStr);      // DateTimeDigitized

  const tiffData = new Uint8Array(bytes);

  // ── Build APP1 segment ──
  // Layout: FF E1 | length(2, BE) | "Exif\0\0"(6) | tiffData
  const app1PayloadLen = 2 + 6 + tiffData.length; // length field includes itself
  const app1 = new Uint8Array(2 + app1PayloadLen);
  app1[0] = 0xFF; app1[1] = 0xE1;
  app1[2] = (app1PayloadLen >> 8) & 0xFF;
  app1[3] = app1PayloadLen & 0xFF;
  app1[4] = 0x45; app1[5] = 0x78; app1[6] = 0x69; app1[7] = 0x66; // "Exif"
  app1[8] = 0x00; app1[9] = 0x00;
  app1.set(tiffData, 10);

  // ── Insert APP1 right after SOI (FF D8) ──
  const jpeg = new Uint8Array(jpegBuffer);
  const result = new Uint8Array(jpeg.length + app1.length);
  result.set(jpeg.slice(0, 2), 0);          // SOI
  result.set(app1, 2);                       // our APP1
  result.set(jpeg.slice(2), 2 + app1.length); // rest of original JPEG
  return result.buffer;
}

self.onmessage = async ({ data }) => {
  const { id, imageBitmap, datos, logoBase64, stampConfig, quality } = data;
  try {
    const buffer = await estamparEnWorker(imageBitmap, datos, logoBase64, stampConfig, quality);
    self.postMessage({ id, ok: true, buffer }, [buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: err.message });
  }
};
