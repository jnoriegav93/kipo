import { saveAs } from 'file-saver';

// --- TEMAS (Colores) ---
export const getTheme = (isDark) => isDark ? {
  bg: 'bg-slate-950',
  card: 'bg-slate-900',
  header: 'bg-slate-900',
  border: 'border-slate-800',
  text: 'text-slate-100',
  textSec: 'text-slate-400',
  input: 'bg-slate-800 text-white border-slate-700',
  activeItem: 'bg-slate-800 text-brand-400 border-slate-700',
  inactiveItem: 'text-slate-400 hover:bg-slate-800 border-transparent',
  gridBtn: 'bg-slate-800 text-slate-400 border-slate-700',
  gridBtnActive: 'bg-slate-100 text-slate-900 border-white',
  mapOverlay: 'rgba(255, 255, 255, 0.4)',
  mapGrid: 'radial-gradient(#fff 1px, transparent 1px)',
  bottomBar: 'bg-slate-950 border-slate-800',
  selectedDay: 'bg-brand-900/30 border-brand-500 text-white',
  actionBtn: 'border-slate-700 text-slate-400 hover:text-brand-500 hover:border-brand-500'
} : {
  bg: 'bg-white',
  card: 'bg-white',
  header: 'bg-white',
  border: 'border-slate-900',
  text: 'text-black',
  textSec: 'text-slate-800',
  input: 'bg-white text-black border-slate-900 font-bold',
  activeItem: 'bg-slate-900 text-white border-black',
  inactiveItem: 'text-slate-900 hover:bg-slate-100 border-transparent',
  gridBtn: 'bg-white text-black border-slate-900 shadow-sm',
  gridBtnActive: 'bg-slate-900 text-white border-black shadow-md',
  mapOverlay: 'rgba(0, 0, 0, 0.8)',
  mapGrid: 'radial-gradient(#000 1px, transparent 1px)',
  bottomBar: 'bg-white border-slate-900',
  selectedDay: 'bg-slate-900 text-white border-black shadow-lg',
  actionBtn: 'border-slate-900 text-slate-900 hover:bg-slate-100 font-bold'
};

// --- IMÁGENES Y ARCHIVOS ---

export const urlABase64 = async (url) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error descargando logo:", error);
    return null;
  }
};

export const prepararFoto = (blobUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = blobUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024;
      const scaleSize = MAX_WIDTH / img.width;
      if (scaleSize < 1) {
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      resolve(dataUrl);
    };
    img.onerror = (e) => reject(e);
  });
};

export const comprimirImagen = (url, maxWidth = 400, maxHeight = 500) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      let scale = Math.min(maxWidth / img.width, maxHeight / img.height);
      if (scale > 1) scale = 1;
      const finalWidth = Math.floor(img.width * scale);
      const finalHeight = Math.floor(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
      canvas.toBlob(async (blob) => {
        if (blob) {
          const buffer = await blob.arrayBuffer();
          resolve({ buffer, width: finalWidth, height: finalHeight });
        } else {
          reject(new Error("Error compresión"));
        }
      }, 'image/jpeg', 0.9);
    };
    img.onerror = (err) => reject(err);
  });
};

export const pedirLogo = () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    };
    setTimeout(() => input.click(), 100);
  });
};

export const comprimirYEstampar = (url, maxWidth, maxHeight, datos, logoBase64) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > h) { if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; } }
      else { if (h > maxHeight) { w *= maxHeight / h; h = maxHeight; } }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      if (datos) {
        const cajaAlto = h * 0.10;
        ctx.fillStyle = "rgba(255, 255, 255, 0.70)";
        ctx.fillRect(0, h - cajaAlto, w, cajaAlto);
        const zona1 = w * 0.25;
        const zona2 = w * 0.50;
        const xDiv2 = zona1 + zona2;
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${cajaAlto * 0.65}px Arial`;
        ctx.fillText(String(datos.numero || '000').padStart(3, '0'), zona1 / 2, h - (cajaAlto / 2));
        const fSizeBase = cajaAlto * 0.25;
        const xCentro = zona1 + (zona2 / 2);
        ctx.fillStyle = "#000000";
        ctx.font = `bold ${fSizeBase}px Arial`;
        ctx.fillText((datos.proyecto || '').toUpperCase(), xCentro, h - (cajaAlto * 0.7));
        ctx.fillStyle = "#333333";
        ctx.font = `${fSizeBase * 0.75}px Arial`;
        ctx.fillText(datos.gps, xCentro, h - (cajaAlto * 0.45));
        ctx.fillText(new Date().toLocaleDateString(), xCentro, h - (cajaAlto * 0.2));
        if (logoBase64) {
          const imgLogo = new Image();
          imgLogo.src = logoBase64;
          imgLogo.onload = () => {
            const altoL = cajaAlto * 0.5;
            const anchoL = imgLogo.width * (altoL / imgLogo.height);
            ctx.drawImage(imgLogo, xDiv2 + (zona1 / 2) - (anchoL / 2), h - (cajaAlto / 2) - (altoL / 2), anchoL, altoL);
            finalizar();
          };
          imgLogo.onerror = () => finalizar();
        } else { finalizar(); }
      } else { finalizar(); }
      function finalizar() {
        canvas.toBlob((b) => {
          const reader = new FileReader();
          reader.readAsArrayBuffer(b);
          reader.onloadend = () => resolve({ buffer: reader.result, width: w, height: h });
        }, "image/jpeg", 0.75);
      }
    };
  });
};

export const compartirODescargar = async (blob, nombre) => {
  if (navigator.canShare && navigator.share) {
    try {
      const file = new File([blob], nombre, { type: blob.type });
      await navigator.share({ files: [file], title: nombre });
      return;
    } catch (e) { console.log("Cancelado o error, descargando..."); }
  }
  saveAs(blob, nombre);
};

// --- NUEVA FUNCIÓN DE COMPRESIÓN AVANZADA ---
export const comprimirImagenAvanzada = (url, formato = 'image/jpeg', calidadObjetivo = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      // 1. Redimensionamiento (Max 1920x1080)
      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;
      let w = img.width;
      let h = img.height;

      if (w > h) {
        if (w > MAX_WIDTH) { h *= MAX_WIDTH / w; w = MAX_WIDTH; }
      } else {
        if (h > MAX_HEIGHT) { w *= MAX_HEIGHT / h; h = MAX_HEIGHT; }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      // --- 2. Compresión Iterativa (Objetivo ~300KB)
      // Empezamos con calidad alta y bajamos si es necesario, aunque Canvas no permite saber el tamaño antes de crear el blob.
      // ESTRATEGIA SIMPLE: Usar calidad 0.75-0.8 para JPEG suele dar ~200-400KB para 1080p.
      let qual = calidadObjetivo;
      if (formato === 'image/webp') qual = 0.7;
      if (formato === 'image/jpeg') qual = 0.75;

      canvas.toBlob((blob) => {
        if (blob) {
          // Convertir a ArrayBuffer para JSZip / ExcelJS
          const reader = new FileReader();
          reader.readAsArrayBuffer(blob);
          reader.onloadend = () => resolve({ buffer: reader.result, width: w, height: h, blob });
        } else {
          reject(new Error("Error al comprimir imagen"));
        }
      }, formato, qual);
    };
    img.onerror = (err) => reject(err);
  });
};

// --- PROCESAMIENTO INICIAL (FULL + THUMB) ---
export const procesarImagenInput = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        // Forzar orientación vertical: si la foto es horizontal, rotarla 90° CW
        const esHorizontal = img.width > img.height;
        // Dimensiones reales tratadas siempre como vertical (alto >= ancho)
        const srcW = esHorizontal ? img.height : img.width;
        const srcH = esHorizontal ? img.width : img.height;

        // Helper para dibujar en canvas con rotación si aplica
        const dibujarEnCanvas = (ctx, cw, ch) => {
          if (esHorizontal) {
            ctx.translate(cw / 2, ch / 2);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(img, -ch / 2, -cw / 2, ch, cw);
          } else {
            ctx.drawImage(img, 0, 0, cw, ch);
          }
        };

        // 1. Generar FULL (Max alto 1080px, JPEG 0.8)
        const canvasFull = document.createElement('canvas');
        let wf = srcW; let hf = srcH;
        const MAX_H = 1080;
        if (hf > MAX_H) { wf = Math.round(wf * MAX_H / hf); hf = MAX_H; }
        canvasFull.width = wf; canvasFull.height = hf;
        dibujarEnCanvas(canvasFull.getContext('2d'), wf, hf);

        // 2. Generar THUMB (Max 256px alto, JPEG 0.6)
        const canvasThumb = document.createElement('canvas');
        let wt = srcW; let ht = srcH;
        const MAX_H_T = 256;
        if (ht > MAX_H_T) { wt = Math.round(wt * MAX_H_T / ht); ht = MAX_H_T; }
        canvasThumb.width = wt; canvasThumb.height = ht;
        dibujarEnCanvas(canvasThumb.getContext('2d'), wt, ht);
        const thumbBase64 = canvasThumb.toDataURL('image/jpeg', 0.6);

        // Terminar FULL
        canvasFull.toBlob((blobFull) => {
          resolve({ fullBlob: blobFull, thumbBase64 });
        }, 'image/jpeg', 0.8);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

// --- HELPER PRIVADO: Ajustar fuente para que el texto quepa (shrink-to-fit) ---
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

// --- ESTAMPADO ON-THE-FLY ---
// imagenSource: Blob | ArrayBuffer | string URL
// datos: { numero, proyecto, gps, fecha, hora, codFat, direccion, ubicacion }
// logoBase64: string base64 o null
// stampConfig: { logoPosition: 'left'|'right', mostrarNroPoste: bool, mostrarCodFat: bool }
export const estamparMetadatos = async (imagenSource, datos, logoBase64, stampConfig = {}) => {
  const {
    logoPosition = 'right',
    mostrarNroPoste = true,
    mostrarCodFat = false,
    fondoSello = 'white',
  } = stampConfig;

  let srcUrl = imagenSource;
  if (imagenSource instanceof ArrayBuffer) {
    const blob = new Blob([imagenSource]);
    srcUrl = URL.createObjectURL(blob);
  } else if (imagenSource instanceof Blob) {
    srcUrl = URL.createObjectURL(imagenSource);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = srcUrl;
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      if (datos) {
        const cajaAlto = h * 0.08;
        const yBase = h - cajaAlto;
        const hPad = Math.max(w * 0.02, 4);
        const vPad = Math.max(cajaAlto * 0.06, 2);

        // Colores según fondoSello
        let clrBold, clrNormal, clrFaint, divClr, usarSombra;
        if (fondoSello === 'black') {
          clrBold = "#FCBF26"; clrNormal = "#FFFFFF"; clrFaint = "#FFFFFF";
          divClr = "rgba(255,255,255,0.30)"; usarSombra = false;
        } else if (fondoSello === 'glass') {
          clrBold = "#FFFFFF"; clrNormal = "#FFFFFF"; clrFaint = "rgba(255,255,255,0.85)";
          divClr = "rgba(255,255,255,0.50)"; usarSombra = true;
        } else {
          clrBold = "#000000"; clrNormal = "#000000"; clrFaint = "#000000";
          divClr = "rgba(150,150,150,0.60)"; usarSombra = false;
        }

        // Fondo de la barra inferior
        if (fondoSello === 'glass') {
          // Efecto vidrio: redibujar la zona con desenfoque
          ctx.save();
          ctx.filter = 'blur(10px)';
          ctx.drawImage(img, 0, yBase, w, cajaAlto, 0, yBase, w, cajaAlto);
          ctx.restore();
          // Capa oscura sutil para mejorar contraste del texto
          ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
          ctx.fillRect(0, yBase, w, cajaAlto);
        } else if (fondoSello === 'black') {
          ctx.fillStyle = "rgba(0, 0, 0, 0.80)";
          ctx.fillRect(0, yBase, w, cajaAlto);
        } else {
          ctx.fillStyle = "rgba(255, 255, 255, 0.90)";
          ctx.fillRect(0, yBase, w, cajaAlto);
        }

        // Divisores verticales: 25% | 40% | 35%
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

        // Tamaño de fuente proporcional a la altura de la barra
        const fs = Math.max(14, Math.round(cajaAlto * 0.28));
        const lineH = fs * 1.1;

        // Posición vertical centrada de las 2 filas
        const blockH = fs + lineH;
        const blockStart = yBase + Math.max(vPad, (cajaAlto - blockH) / 2);
        const r1Y = blockStart + fs * 0.5;
        const r2Y = r1Y + lineH;

        ctx.textBaseline = "middle";

        // Sombra sutil para texto sobre fondo vidrio
        if (usarSombra) {
          ctx.shadowColor = 'rgba(0,0,0,0.75)';
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;
        }

        // ---- COLUMNA 1 (25% izquierda): Proyecto / Item+Pasivo — NEGRITA ----
        ctx.textAlign = "left";
        const c1MaxW = xDiv1 - hPad * 2;

        ctx.fillStyle = clrBold;
        const proyTxt = (datos.proyecto || '').toUpperCase();
        fitFont(ctx, proyTxt, c1MaxW, fs, true);
        ctx.fillText(proyTxt, hPad, r1Y);

        const nro = String(datos.numero || '-').padStart(3, '0');
        const pasivo = datos.pasivo || datos.codFat || '-';
        let idTxt = '';
        if (mostrarNroPoste && mostrarCodFat) {
          idTxt = `${nro}  |  ${pasivo}`;
        } else if (mostrarNroPoste) {
          idTxt = nro;
        } else if (mostrarCodFat) {
          idTxt = pasivo;
        } else {
          idTxt = nro;
        }
        fitFont(ctx, idTxt, c1MaxW, fs, true);
        ctx.fillText(idTxt, hPad, r2Y);

        // ---- COLUMNA 2 (40% centro): Fecha+Hora / GPS — centrado ----
        ctx.textAlign = "center";
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

        // ---- COLUMNA 3 (35% derecha): Dirección / Ubicación ----
        ctx.textAlign = "right";
        const c3x = w - hPad;
        const c3MaxW = w - xDiv2 - hPad * 2;

        fitFont(ctx, datos.direccion || '', c3MaxW, fs, false);
        ctx.fillText(datos.direccion || '', c3x, r1Y);
        ctx.fillStyle = clrFaint;
        fitFont(ctx, datos.ubicacion || '', c3MaxW, fs, false);
        ctx.fillText(datos.ubicacion || '', c3x, r2Y);

        // Limpiar sombra si se activó
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // ---- LOGO en esquina SUPERIOR (izquierda o derecha) ----
        if (logoBase64) {
          const imgLogo = new Image();
          imgLogo.crossOrigin = 'anonymous';
          imgLogo.src = logoBase64;
          imgLogo.onload = () => {
            const logoMaxH = h * 0.156;
            const logoMaxW = w * 0.264;
            const scale = Math.min(logoMaxW / imgLogo.width, logoMaxH / imgLogo.height, 1);
            const anchoL = imgLogo.width * scale;
            const altoL = imgLogo.height * scale;
            const logoPad = Math.max(w * 0.012, 4);
            const xLogo = logoPosition === 'left' ? logoPad : w - anchoL - logoPad;
            ctx.drawImage(imgLogo, xLogo, logoPad, anchoL, altoL);
            finalizar();
          };
          imgLogo.onerror = () => finalizar();
        } else {
          finalizar();
        }
      } else {
        finalizar();
      }

      function finalizar() {
        canvas.toBlob((b) => {
          if (!b) { reject(new Error('canvas.toBlob returned null')); return; }
          const reader = new FileReader();
          reader.readAsArrayBuffer(b);
          reader.onloadend = () => resolve({ buffer: reader.result, width: w, height: h });
        }, "image/jpeg", 0.85);
      }
    };
    img.onerror = (e) => reject(e);
  });
};