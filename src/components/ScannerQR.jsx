import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// Escáner QR: cámara trasera + BarcodeDetector nativo, con jsQR de respaldo. Lo usan
// EQUIPOS (unirse a un equipo) y PROYECTOS (aceptar una invitación a un proyecto).
const ScannerQR = ({ onResult, onClose, titulo = 'Escanear QR', ayuda = '' }) => {
  const videoRef = useRef(null);
  const [errorCam, setErrorCam] = useState('');
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let stream = null, raf = 0, activo = true, detector = null, jsqr = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = async () => {
      if (!activo) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes.length && activo) { activo = false; onResultRef.current(codes[0].rawValue); return; }
          } else if (jsqr) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsqr(img.data, img.width, img.height);
            if (code?.data && activo) { activo = false; onResultRef.current(code.data); return; }
          }
        } catch { /* frame fallido, seguir intentando */ }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if ('BarcodeDetector' in window) {
          try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch { detector = null; }
        }
        if (!detector) jsqr = (await import('jsqr')).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!activo) { stream.getTracks().forEach(t => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        raf = requestAnimationFrame(tick);
      } catch (e) {
        console.error('Cámara QR:', e);
        setErrorCam('No se pudo abrir la cámara. Revisa los permisos de cámara de la app.');
      }
    })();

    return () => { activo = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  return (
    <div className="fixed inset-0 z-[4000] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 pb-3 shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)' }}>
        <p className="text-white font-black text-sm uppercase tracking-wider">{titulo}</p>
        <button onClick={onClose} className="p-2 rounded-xl bg-white/10 text-white active:scale-95"><X size={18} /></button>
      </div>
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-56 h-56 rounded-3xl border-4 border-orange-500/90" />
        </div>
        {errorCam && (
          <div className="absolute inset-x-6 top-6 bg-red-600 text-white text-xs font-bold rounded-xl px-4 py-3 text-center">{errorCam}</div>
        )}
      </div>
      {ayuda && <p className="text-slate-300 text-[11px] text-center px-6 py-4 shrink-0">{ayuda}</p>}
    </div>
  );
};

export default ScannerQR;
