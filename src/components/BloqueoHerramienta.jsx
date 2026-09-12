// ── KIPO, la mascota (luciérnaga con casco de obra) + bloqueo de herramientas ──
// La fibra óptica es luz viajando; la luciérnaga lleva su propia luz. Kipo dará
// las guías de cada sección a futuro — por ahora entrega las advertencias de plan.
// Ilustración vectorial estilo personaje de juego (formas suaves, colores planos
// de la app: naranja del casco, amarillo de la luz, gris de alitas).

export const KipoMascota = ({ ancho = 180, isDark = false }) => {
  const cuerpo = isDark ? '#e2e8f0' : '#1e293b';
  const pupila = isDark ? '#1e293b' : '#0f172a';
  const ojo = '#ffffff';
  return (
    <svg width={ancho} viewBox="0 0 200 160" className="mx-auto" style={{ display: 'block' }}>
      {/* Aura de luz */}
      <circle cx="52" cy="103" r="36" fill="#FCBF26" opacity="0.18" />
      <circle cx="52" cy="103" r="24" fill="#FCBF26" opacity="0.28" />

      {/* Alitas (translúcidas, levantadas) */}
      <ellipse cx="93" cy="50" rx="27" ry="11" fill="#94a3b8" opacity="0.5" transform="rotate(-28 93 50)" />
      <ellipse cx="112" cy="47" rx="24" ry="10" fill="#94a3b8" opacity="0.35" transform="rotate(-12 112 47)" />

      {/* Cola encendida */}
      <ellipse cx="60" cy="100" rx="28" ry="19" fill="#FCBF26" />

      {/* Cuerpo */}
      <ellipse cx="103" cy="94" rx="33" ry="26" fill={cuerpo} />

      {/* Patitas */}
      <g stroke={cuerpo} strokeWidth="5" strokeLinecap="round">
        <line x1="88" y1="117" x2="84" y2="129" />
        <line x1="104" y1="120" x2="102" y2="132" />
        <line x1="120" y1="117" x2="123" y2="129" />
      </g>

      {/* Cabeza */}
      <circle cx="140" cy="80" r="26" fill={cuerpo} />

      {/* Antenitas */}
      <g stroke={cuerpo} strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M 138 50 Q 136 36 126 30" />
        <path d="M 148 52 Q 152 38 162 34" />
      </g>
      <circle cx="125" cy="29" r="3.5" fill={cuerpo} />
      <circle cx="163" cy="33" r="3.5" fill={cuerpo} />

      {/* Casco de obra (naranja de la app) */}
      <path d="M 116 66 A 24 22 0 0 1 164 66 Z" fill="#FF6600" />
      <rect x="110" y="63" width="60" height="8" rx="4" fill="#FF6600" />
      <rect x="135" y="47" width="10" height="8" rx="3" fill="#FF6600" />

      {/* Ojo grande */}
      <circle cx="149" cy="82" r="11.5" fill={ojo} />
      <circle cx="152" cy="83" r="5.5" fill={pupila} />
      <circle cx="149.5" cy="78.5" r="2.6" fill={ojo} />

      {/* Sonrisa */}
      <path d="M 138 98 Q 145 104 153 99" stroke={isDark ? '#1e293b' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.9" />

      {/* Destellos de la luz */}
      <g fill="#FCBF26">
        <path d="M 26 78 l 2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4 Z" />
        <path d="M 34 126 l 1.8 4.2 4.2 1.8 -4.2 1.8 -1.8 4.2 -1.8 -4.2 -4.2 -1.8 4.2 -1.8 Z" />
        <circle cx="18" cy="106" r="2.6" />
      </g>
    </svg>
  );
};

const BloqueoHerramienta = ({ titulo, concepto, theme, isDark, onClose }) => (
  <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={onClose}>
    <div className={`${theme.card} border-2 ${theme.border} rounded-3xl w-full max-w-xs p-6 text-center`} onClick={e => e.stopPropagation()}>
      <div className={`rounded-2xl py-4 mb-4 ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'}`}>
        <KipoMascota isDark={isDark} />
      </div>
      <h3 className={`font-black text-base uppercase tracking-wide ${theme.text}`}>{titulo}</h3>
      <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{concepto}</p>
      <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500">
        <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">Disponible desde el plan ESTÁNDAR</span>
      </div>
      <button onClick={onClose} className="w-full mt-5 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest active:scale-95">
        ENTENDIDO
      </button>
    </div>
  </div>
);

export default BloqueoHerramienta;
