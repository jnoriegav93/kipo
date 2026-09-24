import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Database } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../firebaseConfig';
import { resumenPaso6 } from '../utils/paso6Resumen';

// Paso 6 del rediseño de equipos (CONTEXTO.md), en el panel de Admin: dejar cada proyecto
// solo con `miembros` y sacar los campos del sistema viejo. Lo hace la función `paso6`
// (solo admin), en tres tiempos: SIMULAR no escribe nada; COMPLETAR solo agrega (nadie
// pierde el proyecto); LIMPIAR guarda un respaldo y borra los campos viejos y los equipos.
// Vive aquí y no en una página local: el admin prueba en producción, desde el teléfono.
//
// Los tres botones están siempre activos (salvo mientras corre uno): la función se cuida
// sola, porque LIMPIAR no toca un proyecto al que le falte completar y siempre guarda
// respaldo. Antes COMPLETAR y LIMPIAR se activaban según la última simulación y pedían
// confirmar con window.confirm; en el teléfono del admin no se activaban (24/09), así que
// la confirmación va dentro del panel y no depende de lo que haya en memoria.

const CONFIRMAR = {
  completar: 'COMPLETAR solo AGREGA: suma a miembros a quien hoy está solo en los campos viejos, con el rol que ya tiene, y copia los nombres. No borra nada.',
  limpiar: 'LIMPIAR guarda un respaldo de los campos viejos y de los equipos, y después los BORRA. Los proyectos a los que les falte completar no se tocan.',
};

const Paso6Panel = ({ isDark }) => {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(null);         // la acción en curso
  const [porConfirmar, setPorConfirmar] = useState(null); // 'completar' | 'limpiar'
  const [texto, setTexto] = useState('');
  const [aviso, setAviso] = useState('');

  const correr = async (accion) => {
    if (ocupado) return;
    setPorConfirmar(null);
    setOcupado(accion);
    setAviso('');
    try {
      const fn = httpsCallable(getFunctions(app, 'us-central1'), 'paso6', { timeout: 540000 });
      const { data } = await fn({ accion });
      setTexto(resumenPaso6(data));
    } catch (e) {
      setAviso(`Falló ${accion.toUpperCase()}: ${e.code || ''} ${e.message || ''}`.trim());
    }
    setOcupado(null);
  };

  // SIMULAR corre directo; COMPLETAR y LIMPIAR piden confirmar aquí mismo
  const tocar = (accion) => {
    if (ocupado) return;
    if (accion === 'simular') { correr('simular'); return; }
    setAviso('');
    setPorConfirmar(accion);
  };

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); setAviso('Copiado. Pégalo en el chat.'); }
    catch { setAviso('No se pudo copiar: selecciona el texto a mano.'); }
  };

  const cardBg = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const boton = 'flex-1 py-2 rounded-lg text-xs font-black active:scale-95 disabled:opacity-40';

  return (
    <div className={`mb-4 rounded-2xl border overflow-hidden ${cardBg}`}>
      <button onClick={() => setAbierto(v => !v)} className={`w-full flex items-center gap-3 px-4 py-3 ${isDark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
        <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center shrink-0"><Database size={16} className="text-white" strokeWidth={2.5} /></div>
        <div className="flex-1 text-left">
          <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Equipos · paso 6: limpiar lo viejo</p>
          <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{ocupado ? `${ocupado}…` : 'Simular, completar y limpiar'}</p>
        </div>
        {abierto ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {abierto && (
        <div className="px-4 pb-4 space-y-2">
          <p className={`text-[11px] leading-snug ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            1) SIMULAR no cambia nada. 2) COMPLETAR solo agrega: suma a miembros a quien está solo en los
            campos viejos y copia los nombres. 3) LIMPIAR guarda un respaldo y borra los campos viejos y
            los equipos; no toca los proyectos a los que les falte completar. Después de cada paso,
            copia el resultado y pégalo en el chat.
          </p>
          <div className="flex gap-2">
            <button onClick={() => tocar('simular')} disabled={!!ocupado} className={`${boton} bg-slate-900 text-white`}>SIMULAR</button>
            <button onClick={() => tocar('completar')} disabled={!!ocupado} className={`${boton} bg-amber-500 text-white`}>COMPLETAR</button>
            <button onClick={() => tocar('limpiar')} disabled={!!ocupado} className={`${boton} bg-red-600 text-white`}>LIMPIAR</button>
          </div>
          {porConfirmar && (
            <div className={`rounded-lg border-2 p-3 space-y-2 ${porConfirmar === 'limpiar' ? 'border-red-600' : 'border-amber-500'}`}>
              <p className={`text-[11px] font-bold leading-snug ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{CONFIRMAR[porConfirmar]}</p>
              <div className="flex gap-2">
                <button onClick={() => setPorConfirmar(null)} className={`${boton} border-2 ${isDark ? 'border-slate-600 text-slate-200' : 'border-slate-300 text-slate-700'}`}>CANCELAR</button>
                <button onClick={() => correr(porConfirmar)} className={`${boton} ${porConfirmar === 'limpiar' ? 'bg-red-600' : 'bg-amber-500'} text-white`}>SÍ, {porConfirmar.toUpperCase()}</button>
              </div>
            </div>
          )}
          {aviso && <p className="text-[11px] font-bold text-red-600">{aviso}</p>}
          {texto && (
            <>
              <pre className={`text-[11px] leading-relaxed whitespace-pre-wrap break-words rounded-lg border p-3 max-h-80 overflow-y-auto ${isDark ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>{texto}</pre>
              <button onClick={copiar} className={`w-full ${boton} border-2 ${isDark ? 'border-slate-600 text-slate-200' : 'border-slate-300 text-slate-700'}`}>COPIAR RESULTADO</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Paso6Panel;
