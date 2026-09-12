import { useEffect, useState } from 'react';
import { Download, Share, MoreVertical } from 'lucide-react';
import {
  promptGuardado, instalar, yaInstalada, plataforma, esMovil,
  AVISO_DISPONIBLE, AVISO_INSTALADA,
} from '../utils/instalacion';

// Pasos manuales para cuando el navegador no ofrece el diálogo de instalación.
const INSTRUCCIONES = {
  ios: {
    titulo: 'Instalar en iPhone o iPad',
    pasos: ['Toca el botón Compartir de Safari', 'Elige “Añadir a pantalla de inicio”', 'Confirma con “Añadir”'],
    icono: Share,
  },
  'ios-otro': {
    titulo: 'Ábrelo en Safari',
    pasos: ['En iPhone y iPad solo Safari puede instalar aplicaciones', 'Abre kipo-d29af.web.app en Safari', 'Compartir → “Añadir a pantalla de inicio”'],
    icono: Share,
  },
  android: {
    titulo: 'Instalar en Android',
    pasos: ['Abre el menú del navegador (tres puntos)', 'Elige “Instalar aplicación” o “Añadir a pantalla de inicio”', 'Confirma con “Instalar”'],
    icono: MoreVertical,
  },
  escritorio: {
    titulo: 'Instalar en el computador',
    pasos: ['Busca el icono de instalar al final de la barra de direcciones', 'O abre el menú del navegador (tres puntos) → “Instalar Kipo”', 'Confirma con “Instalar”'],
    icono: MoreVertical,
  },
  firefox: {
    titulo: 'Firefox no permite instalar',
    pasos: ['Firefox de escritorio no instala aplicaciones web', 'Abre kipo-d29af.web.app en Chrome, Edge o Safari', 'Desde ahí podrás instalarla'],
    icono: MoreVertical,
  },
};

export default function InstalarApp() {
  const [hayPrompt, setHayPrompt] = useState(() => !!promptGuardado());
  // No se puede cerrar: el aviso queda hasta que la app esté instalada.
  // En computador ni se muestra; ahí la app se usa desde el navegador.
  const [oculto, setOculto] = useState(() => yaInstalada() || !esMovil());
  const [verPasos, setVerPasos] = useState(false);

  useEffect(() => {
    const disponible = () => setHayPrompt(true);
    const instalada = () => setOculto(true);
    window.addEventListener(AVISO_DISPONIBLE, disponible);
    window.addEventListener(AVISO_INSTALADA, instalada);
    return () => {
      window.removeEventListener(AVISO_DISPONIBLE, disponible);
      window.removeEventListener(AVISO_INSTALADA, instalada);
    };
  }, []);

  if (oculto) return null;

  const pulsar = async () => {
    // Con diálogo nativo se instala de una; si no, se explican los pasos a mano.
    if (hayPrompt) {
      const aceptado = await instalar();
      setHayPrompt(false);
      if (aceptado) setOculto(true);
      else setVerPasos(true); // rechazó o el diálogo no salió: queda la vía manual
      return;
    }
    setVerPasos(v => !v);
  };

  const guia = INSTRUCCIONES[plataforma()] || INSTRUCCIONES.escritorio;
  const IconoGuia = guia.icono;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] p-4 pointer-events-none"
      style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto mx-auto max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 flex items-center gap-3">
          <img src="/pwa-192x192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm uppercase tracking-wide leading-tight">Instalar Kipo</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-tight">Acceso directo y trabajo sin conexión</p>
          </div>
          <button
            onClick={pulsar}
            className="shrink-0 bg-brand-600 text-white font-black text-xs uppercase px-4 py-2 rounded-xl active:scale-95 transition-transform flex items-center gap-1.5"
          >
            <Download size={14} />
            {hayPrompt ? 'Instalar' : 'Cómo'}
          </button>
        </div>

        {verPasos && (
          <div className="px-4 pb-4 pt-0">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-brand-500 flex items-center gap-1.5">
                <IconoGuia size={13} /> {guia.titulo}
              </p>
              <ol className="mt-2 space-y-1.5">
                {guia.pasos.map((p, i) => (
                  <li key={i} className="text-[11px] text-slate-300 leading-snug flex gap-2">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-slate-700 text-white text-[9px] font-black flex items-center justify-center">{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
