// Inyector de EXIF para JPEG producidos por canvas (que no tienen metadata).
// Inserta un segmento APP1 con GPS, DateTime, DateTimeOriginal, ImageDescription y Artist.
// Portado de stampWorker.js para uso en el hilo principal (antes de subir la foto).
//
// datos: { fecha, hora, gps, numero, proyecto }
//   - fecha: ISO string o "dd/mm/yyyy"
//   - hora:  "HH:MM" (opcional; si fecha es ISO con hora, se usa esa)
//   - gps:   "lat, lng" (opcional)
//
// Devuelve un ArrayBuffer con el JPEG + EXIF.

export function inyectarEXIF(jpegBuffer, datos) {
  const pad = n => String(n).padStart(2, '0');

  // GPS "lat, lng"
  let gpsData = null;
  if (datos?.gps) {
    const parts = datos.gps.split(',').map(s => s.trim());
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) gpsData = { lat, lng };
    }
  }

  // DateTime "YYYY:MM:DD HH:MM:SS"
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

  const nroStr = String(datos?.numero || '');
  const imageDesc = `Kipo - ${datos?.proyecto || ''} #${nroStr}`;

  const toDMS = (decimal) => {
    const abs = Math.abs(decimal);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60 * 1000);
    return [deg, min, sec];
  };

  const bytes = [];
  const u8  = v => bytes.push(v & 0xFF);
  const u16 = v => { u8(v); u8(v >> 8); };
  const u32 = v => { u16(v); u16(v >> 16); };
  const asc = s => { for (const c of s) u8(c.charCodeAt(0)); u8(0); };
  const rat = (n, d) => { u32(n); u32(d); };

  const entry = (tag, type, count, val) => {
    u16(tag); u16(type); u32(count);
    if (typeof val === 'number') { u32(val); }
    else { for (let i = 0; i < 4; i++) u8(i < val.length ? val[i] : 0); }
  };

  const descLen   = imageDesc.length + 1;
  const dtLen     = dtStr.length + 1;
  const artistLen = 5;
  const gpsDateLen = dtGps.length + 1;

  const hasGPS = gpsData !== null;
  const ifd0Entries  = hasGPS ? 5 : 4;
  const ifd0Size     = 2 + ifd0Entries * 12 + 4;
  const exifIFDStart = 8 + ifd0Size;
  const exifIFDSize  = 2 + 2 * 12 + 4;
  const gpsIFDStart  = exifIFDStart + exifIFDSize;
  const gpsIFDSize   = hasGPS ? (2 + 6 * 12 + 4) : 0;

  let cur = gpsIFDStart + gpsIFDSize;
  const descOff    = cur; cur += descLen;
  const dtOff      = cur; cur += dtLen;
  const artistOff  = cur; cur += artistLen;
  const dtOrigOff  = cur; cur += dtLen;
  const dtDigOff   = cur; cur += dtLen;
  let latOff, lngOff, gpsDateOff;
  if (hasGPS) {
    latOff     = cur; cur += 24;
    lngOff     = cur; cur += 24;
    gpsDateOff = cur; cur += gpsDateLen;
  }

  // TIFF header
  u8(0x49); u8(0x49);
  u16(42);
  u32(8);

  // IFD0
  u16(ifd0Entries);
  entry(0x010E, 2, descLen,    descOff);
  entry(0x0132, 2, dtLen,      dtOff);
  entry(0x013B, 2, artistLen,  artistOff);
  entry(0x8769, 4, 1,          exifIFDStart);
  if (hasGPS) entry(0x8825, 4, 1, gpsIFDStart);
  u32(0);

  // ExifIFD
  u16(2);
  entry(0x9003, 2, dtLen, dtOrigOff);
  entry(0x9004, 2, dtLen, dtDigOff);
  u32(0);

  // GPSIFD
  if (hasGPS) {
    const { lat, lng } = gpsData;
    const latDMS = toDMS(lat);
    const lngDMS = toDMS(lng);
    u16(6);
    entry(0x0000, 1, 4,  [2, 3, 0, 0]);
    entry(0x0001, 2, 2,  lat >= 0 ? [78,0,0,0] : [83,0,0,0]);
    entry(0x0002, 5, 3,  latOff);
    entry(0x0003, 2, 2,  lng >= 0 ? [69,0,0,0] : [87,0,0,0]);
    entry(0x0004, 5, 3,  lngOff);
    entry(0x001D, 2, gpsDateLen, gpsDateOff);
    u32(0);
    rat(latDMS[0], 1); rat(latDMS[1], 1); rat(latDMS[2], 1000);
    rat(lngDMS[0], 1); rat(lngDMS[1], 1); rat(lngDMS[2], 1000);
    asc(dtGps);
  }

  // Data section
  asc(imageDesc);
  asc(dtStr);
  asc('Kipo');
  asc(dtStr);
  asc(dtStr);

  const tiffData = new Uint8Array(bytes);

  // APP1 segment
  const app1PayloadLen = 2 + 6 + tiffData.length;
  const app1 = new Uint8Array(2 + app1PayloadLen);
  app1[0] = 0xFF; app1[1] = 0xE1;
  app1[2] = (app1PayloadLen >> 8) & 0xFF;
  app1[3] = app1PayloadLen & 0xFF;
  app1[4] = 0x45; app1[5] = 0x78; app1[6] = 0x69; app1[7] = 0x66;
  app1[8] = 0x00; app1[9] = 0x00;
  app1.set(tiffData, 10);

  // Insertar APP1 después de SOI (FF D8)
  const jpeg = new Uint8Array(jpegBuffer);
  const result = new Uint8Array(jpeg.length + app1.length);
  result.set(jpeg.slice(0, 2), 0);
  result.set(app1, 2);
  result.set(jpeg.slice(2), 2 + app1.length);
  return result.buffer;
}

// Helper: inyecta EXIF en un Blob JPEG y devuelve un nuevo Blob con metadata.
export async function inyectarEXIFenBlob(blob, datos) {
  try {
    const buf = await blob.arrayBuffer();
    const conExif = inyectarEXIF(buf, datos);
    return new Blob([conExif], { type: 'image/jpeg' });
  } catch (e) {
    console.warn('No se pudo inyectar EXIF, se sube sin metadata:', e);
    return blob;
  }
}
