import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Save, Trash2, Eye, EyeOff, X } from 'lucide-react';
import { CAPACIDADES, getColorFibra } from '../utils/fibraUtils';

export default function BarraFibra({
  theme,
  isDark,
  dibujandoFibra,
  setDibujandoFibra,
  capacidadFibra,
  setCapacidadFibra,
  puntosRecorrido,
  onGuardarFibra,
  conexionSeleccionada,
  onEliminarConexion,
  onCambiarCapacidad,
  fibrasVisibles,
  setFibrasVisibles,
  totalFibras,
  onCerrar,
  setPuntosRecorrido
}) {
  const [barraCapacidadAbierta, setBarraCapacidadAbierta] = useState(false);
  const refBarra = useRef(null);

  useEffect(() => {
    if (!barraCapacidadAbierta) return;
    const handler = (e) => {
      if (refBarra.current && !refBarra.current.contains(e.target)) {
        setBarraCapacidadAbierta(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [barraCapacidadAbierta]);

  const capacidadActiva = conexionSeleccionada
    ? (conexionSeleccionada.capacidad || 12)
    : capacidadFibra;

  const puedeGuardar = puntosRecorrido.length >= 2 && !dibujandoFibra;

  const btnBase = "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0";
  // Estilo normal de botón (bordes oscuros, fondo blanco)
  const btnNormal = isDark
    ? 'bg-slate-700 text-slate-200 border-slate-500'
    : 'bg-white text-slate-700 border-slate-500';
  const btnDisabled = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-500'
    : 'bg-white border-slate-400 text-slate-400';

  return (
    <div className="relative shrink-0 flex flex-col items-center justify-center w-full pointer-events-none" ref={refBarra}>
      {/* Barra principal flotante */}
      <div className={`pointer-events-auto mt-2 rounded-2xl ${isDark ? 'bg-slate-800/95 border-slate-600' : 'bg-white/95 border-slate-400'} border-2 px-2 py-1.5 flex items-center gap-1.5 shadow-xl backdrop-blur-sm`}>

        {/* CREAR */}
        <button
          onClick={() => {
            if (dibujandoFibra) {
              setDibujandoFibra(false);
            } else {
              setPuntosRecorrido([]);
              setDibujandoFibra(true);
            }
          }}
          className={`${btnBase} border-2 ${dibujandoFibra
            ? 'bg-green-500 text-white border-green-600 animate-pulse'
            : btnNormal
            }`}
          title={dibujandoFibra ? 'Terminar' : 'Crear'}
        >
          <Pencil size={18} />
        </button>

        {/* CAPACIDAD */}
        <button
          onClick={() => setBarraCapacidadAbierta(!barraCapacidadAbierta)}
          className={`${btnBase} border-2 ${barraCapacidadAbierta ? (isDark ? 'bg-slate-600 border-slate-400' : 'bg-slate-200 border-slate-500') : btnNormal}`}
          title="Capacidad"
        >
          <div
            className="w-5 h-5 rounded-full border-2 border-white/60 shadow-sm"
            style={{ backgroundColor: getColorFibra(capacidadActiva) }}
          />
        </button>

        {/* GUARDAR */}
        <button
          onClick={onGuardarFibra}
          disabled={!puedeGuardar}
          className={`${btnBase} border-2 ${puedeGuardar
            ? 'bg-blue-600 text-white border-blue-700 active:scale-95'
            : `${btnDisabled} opacity-40 cursor-not-allowed`
            }`}
          title="Guardar"
        >
          <Save size={18} />
        </button>

        {/* CONTADOR */}
        <div className={`${btnBase} border-2 ${isDark ? 'bg-slate-950 border-slate-500 text-slate-300' : 'bg-slate-700 border-slate-600 text-white'} text-[11px] font-black`}>
          {totalFibras}
        </div>

        {/* SEPARADOR */}
        <div className={`w-[1px] h-7 ${isDark ? 'bg-slate-600' : 'bg-slate-400'} shrink-0`} />

        {/* ELIMINAR */}
        <button
          onClick={() => { if (conexionSeleccionada) onEliminarConexion(conexionSeleccionada); }}
          disabled={!conexionSeleccionada}
          className={`${btnBase} border-2 ${conexionSeleccionada
            ? 'border-red-500 text-red-500 bg-white active:bg-red-500/10'
            : `${btnDisabled} opacity-30 cursor-not-allowed`
            }`}
          title="Eliminar"
        >
          <Trash2 size={18} />
        </button>

        {/* VER/OCULTAR */}
        <button
          onClick={() => setFibrasVisibles(!fibrasVisibles)}
          className={`${btnBase} border-2 ${fibrasVisibles
            ? btnNormal
            : 'bg-slate-600 text-white border-slate-700'
            }`}
          title={fibrasVisibles ? 'Ocultar' : 'Mostrar'}
        >
          {fibrasVisibles ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>

        {/* CERRAR */}
        <button
          onClick={onCerrar}
          className={`${btnBase} border-2 border-red-500 text-red-600 bg-white active:bg-red-50 active:scale-95`}
          title="Cerrar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Barra de capacidad (tercera barra, fuera y debajo) */}
      {barraCapacidadAbierta && (
        <div className={`pointer-events-auto mt-1 rounded-2xl ${isDark ? 'bg-slate-800/95 border-slate-600' : 'bg-white/95 border-slate-400'} border-2 px-2 py-1.5 shadow-xl backdrop-blur-sm flex items-center gap-1 overflow-x-auto max-w-[90vw]`}>
          {CAPACIDADES.map(cap => (
            <button
              key={cap}
              onClick={() => {
                if (conexionSeleccionada) {
                  onCambiarCapacidad(conexionSeleccionada, cap);
                } else {
                  setCapacidadFibra(cap);
                }
                setBarraCapacidadAbierta(false);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black border-2 transition-all shrink-0 ${capacidadActiva === cap
                ? 'bg-blue-600 text-white border-blue-700 scale-105'
                : isDark
                  ? 'bg-slate-700 text-slate-200 border-slate-500'
                  : 'bg-white text-slate-700 border-slate-500'
                }`}
            >
              <div
                className="w-3 h-3 rounded-full border border-black/20 shrink-0"
                style={{ backgroundColor: getColorFibra(cap) }}
              />
              {cap}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
