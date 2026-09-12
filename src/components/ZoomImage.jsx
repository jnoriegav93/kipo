import React from 'react';
import { Image as ImageIcon, Plus, Minus } from 'lucide-react';

// Extraído de VistaProyectos para poder usarlo también en Ver Detalle: el visor a
// pantalla completa necesitaba el mismo zoom que ya tenía el comparativo.
// ─── VISOR DE FOTO CON ZOOM (pellizco + arrastre + botones) ───────────────────
function ZoomImage({ src, alt = '', heightClass = 'h-96', fallback = null }) {
  const containerRef = React.useRef(null);
  const st = React.useRef({ s: 1, x: 0, y: 0 });
  const [t, setT] = React.useState({ s: 1, x: 0, y: 0 });
  const [imgSrc, setImgSrc] = React.useState(src); // si falla, cae al fallback (miniatura)
  const [imgError, setImgError] = React.useState(false);
  const apply = (next) => { st.current = next; setT(next); };

  React.useEffect(() => { apply({ s: 1, x: 0, y: 0 }); setImgSrc(src); setImgError(false); }, [src]);

  // Zoom manteniendo fijo el punto focal (fx,fy en coords del contenedor)
  const zoomAt = (factor, fx, fy) => {
    const prev = st.current;
    const s = Math.min(6, Math.max(1, prev.s * factor));
    if (s === 1) return apply({ s: 1, x: 0, y: 0 });
    const real = s / prev.s;
    apply({ s, x: fx - real * (fx - prev.x), y: fy - real * (fy - prev.y) });
  };

  // Gestos táctiles con listeners NATIVOS (passive:false) para poder
  // preventDefault y evitar que el navegador robe el arrastre/scroll.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const pts = new Map();
    let lastPan = null, lastDist = 0;
    const rel = (cx, cy) => { const r = el.getBoundingClientRect(); return { x: cx - r.left, y: cy - r.top }; };
    const enCtrl = (target) => target?.closest?.('[data-zoom-ctrl]');

    const down = (e) => {
      if (enCtrl(e.target)) return;
      pts.set(e.pointerId, rel(e.clientX, e.clientY));
      try { el.setPointerCapture(e.pointerId); } catch {}
      if (pts.size === 1) lastPan = [...pts.values()][0];
      else if (pts.size === 2) { const [a, b] = [...pts.values()]; lastDist = Math.hypot(a.x - b.x, a.y - b.y); }
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      e.preventDefault();
      pts.set(e.pointerId, rel(e.clientX, e.clientY));
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (lastDist > 0) zoomAt(dist / lastDist, mid.x, mid.y);
        lastDist = dist;
      } else {
        const p = [...pts.values()][0];
        const prev = st.current;
        if (prev.s > 1 && lastPan) apply({ ...prev, x: prev.x + (p.x - lastPan.x), y: prev.y + (p.y - lastPan.y) });
        lastPan = p;
      }
    };
    const up = (e) => {
      pts.delete(e.pointerId);
      const rest = [...pts.values()];
      if (rest.length === 1) lastPan = rest[0];
      if (rest.length === 2) lastDist = Math.hypot(rest[0].x - rest[1].x, rest[0].y - rest[1].y);
    };
    const wheel = (e) => { e.preventDefault(); const p = rel(e.clientX, e.clientY); zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, p.x, p.y); };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move, { passive: false });
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, []);

  const center = () => { const r = containerRef.current.getBoundingClientRect(); return { x: r.width / 2, y: r.height / 2 }; };

  return (
    <div
      ref={containerRef}
      className={`relative ${heightClass} bg-black rounded-xl overflow-hidden select-none`}
      style={{ touchAction: 'none' }}
    >
      <img
        src={imgSrc} alt={alt} draggable={false}
        onError={() => { if (fallback && imgSrc !== fallback) setImgSrc(fallback); else setImgError(true); }}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transformOrigin: '0 0', display: imgError ? 'none' : undefined }}
      />
      {imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 pointer-events-none px-4 text-center">
          <ImageIcon size={40} className="opacity-60" />
          <span className="text-xs font-bold">Imagen no disponible<br/>(la foto no está en la nube)</span>
        </div>
      )}
      <div data-zoom-ctrl className="absolute bottom-2 right-2 flex flex-col gap-1.5">
        <button onClick={() => { const c = center(); zoomAt(1.4, c.x, c.y); }} className="w-10 h-10 rounded-xl bg-slate-900 text-white border-2 border-white/20 flex items-center justify-center active:scale-90 shadow-lg"><Plus size={18} strokeWidth={3} /></button>
        <button onClick={() => { const c = center(); zoomAt(1 / 1.4, c.x, c.y); }} className="w-10 h-10 rounded-xl bg-slate-900 text-white border-2 border-white/20 flex items-center justify-center active:scale-90 shadow-lg"><Minus size={18} strokeWidth={3} /></button>
      </div>
      {t.s > 1 && (
        <button data-zoom-ctrl onClick={() => apply({ s: 1, x: 0, y: 0 })} className="absolute bottom-2 left-2 px-3 h-10 rounded-xl bg-slate-900 text-white border-2 border-white/20 text-[11px] font-black active:scale-90 shadow-lg">RESET</button>
      )}
    </div>
  );
}

export default ZoomImage;
