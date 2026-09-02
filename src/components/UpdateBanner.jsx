import { useRegisterSW } from 'virtual:pwa-register/react';

// Cada cuánto se le pregunta al servidor si hay versión nueva. Sin esto, el service
// worker solo comprueba al cargar la página: con la app abierta un rato largo, los
// despliegues pasaban desapercibidos y el aviso nunca llegaba a salir.
const CADA_MS = 60 * 1000;

export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      setInterval(() => { registro.update().catch(() => {}); }, CADA_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
      <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xl">
        <div>
          <p className="font-black text-sm uppercase tracking-wide">Nueva versión disponible</p>
          <p className="text-xs text-slate-400 mt-0.5">Actualiza para ver los últimos cambios</p>
        </div>
        <button
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 bg-brand-600 text-white font-black text-xs uppercase px-4 py-2 rounded-xl active:scale-95 transition-transform"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
}
