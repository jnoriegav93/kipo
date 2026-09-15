import React from 'react';
import { Loader2, WifiOff } from 'lucide-react';

// Bloquea toda la app mientras se copian o mueven puntos a otro proyecto. No se puede
// cerrar: se quita sola cuando terminan los datos (puntos, fibras y cables) y las fotos,
// o cuando algo falla. Sin señal sigue bloqueada y lo avisa.
export default function PantallaMigracion({ migracion, isOnline = true, theme }) {
  if (!migracion) return null;
  const { modo, n, destino, etapa, hechos, total, fotosHechos, fotosTotal } = migracion;
  const avance = etapa === 'fotos'
    ? (fotosTotal ? fotosHechos / fotosTotal : 0)
    : (total ? hechos / total : 0);

  return (
    <div className="fixed inset-0 z-[9000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" role="alertdialog" aria-busy="true">
      <div className={`${theme.card} w-full max-w-sm rounded-2xl border-2 ${theme.border} p-6 text-center shadow-2xl`}>
        <Loader2 size={36} className="animate-spin mx-auto text-purple-600" />
        <h3 className={`mt-3 font-black text-base uppercase tracking-wide ${theme.text}`}>
          {modo === 'copiar' ? 'Copiando' : 'Moviendo'} {n} punto{n === 1 ? '' : 's'}
        </h3>
        <p className={`text-xs font-bold ${theme.text} opacity-70`}>a “{destino}”</p>

        <p className={`mt-4 text-sm font-black ${theme.text}`}>
          {etapa === 'fotos'
            ? `Fotos: ${fotosHechos} de ${fotosTotal} punto${fotosTotal === 1 ? '' : 's'}`
            : `Puntos, fibras y cables: ${hechos} de ${total}`}
        </p>
        <div className="mt-2 h-2 rounded-full bg-slate-400/30 overflow-hidden">
          <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${Math.round(avance * 100)}%` }} />
        </div>

        {!isOnline && (
          <p className="mt-4 text-xs font-black text-orange-600 flex items-center justify-center gap-1.5">
            <WifiOff size={14} /> Sin señal: sigue apenas vuelva la conexión
          </p>
        )}
        <p className={`mt-4 text-[11px] ${theme.text} opacity-60`}>No cierres la app hasta que termine.</p>
      </div>
    </div>
  );
}
