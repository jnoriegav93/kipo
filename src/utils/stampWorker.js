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
  return resultBlob.arrayBuffer();
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
