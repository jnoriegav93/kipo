import React, { useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';
import { VINCULOS_FERRETERIA } from '../data/constantes';
import { esCableAcero } from '../utils/cablesAcero';

// Subcomponentes auxiliares
const chunkArray = (arr, size) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
};

export const SelectorGrid = ({ titulo, opciones, seleccion, onSelect, cols, textSize = 'text-lg', theme, titleLine = false, borderAccent = '', activeClass = '' }) => {
  const visibles = opciones.filter(o => o.visible);
  if (visibles.length === 0) return null;
  const colW = `calc((100% - ${cols - 1} * 0.5rem) / ${cols})`;
  const filas = chunkArray(visibles, cols);
  return (
    <div>
      <h3 className={`text-xs font-black ${theme.text} mb-2 uppercase tracking-wider${titleLine ? ' border-l-2 border-b-2 border-slate-400 pl-1.5 pb-1' : ' text-center'}`}>{titulo}</h3>
      <div className="flex flex-col gap-2">
        {filas.map((fila, fi) => (
          <div key={fi} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${fila.length}, ${colW})`, justifyContent: 'center' }}>
            {fila.map(op => {
              const activo = seleccion === op.v;
              // Toggle: al tocar la opción ya seleccionada, se deselecciona (null)
              return (
                <button key={op.v} onClick={() => onSelect(activo ? null : op.v)} className={`h-14 rounded-lg ${textSize} font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${activo ? (activeClass || theme.gridBtnActive) : theme.gridBtn} ${borderAccent}`}>
                  <span className="px-1 break-words leading-tight">{op.v}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const SelectorGridMulti = ({ titulo, opciones, seleccion, onToggle, cols, textSize = 'text-[12px]', theme, titleLine = false }) => {
  const visibles = opciones.filter(o => o.visible);
  if (visibles.length === 0) return null;
  const colW = `calc((100% - ${cols - 1} * 0.5rem) / ${cols})`;
  const filas = chunkArray(visibles, cols);
  return (
    <div>
      <h3 className={`text-xs font-black ${theme.text} mb-2 uppercase tracking-wider${titleLine ? ' border-l-2 border-b-2 border-slate-400 pl-1.5 pb-1' : ' text-center'}`}>{titulo}</h3>
      <div className="flex flex-col gap-2">
        {filas.map((fila, fi) => (
          <div key={fi} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${fila.length}, ${colW})`, justifyContent: 'center' }}>
            {fila.map(op => {
              const isActive = seleccion.includes(op.v);
              return (
                <button key={op.v} onClick={() => onToggle(op.v)} className={`h-14 rounded-lg ${textSize} font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${isActive ? theme.gridBtnActive : theme.gridBtn}`}>
                  <span className="px-1 break-words leading-tight">{op.v}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};


// --- COMPONENTE DE LISTA CON CONTADORES ---
export const ListaContadores = ({ config, datos, setDatos, theme, disabled, armadoSeleccionado, subirConValor }) => {
  // El cable de acero no es ferretería del poste: se tiende en el mapa y se liquida por
  // metro. No aparece aunque el punto traiga una cantidad de antes, que ya no suma.
  const itemsVisibles = config.catalogoFerreteria.filter(f => f.visible !== false && !esCableAcero(f.id));

  // Determinar tipo de cada ítem según el armado seleccionado
  const getTipo = (ferrId) => {
    if (!armadoSeleccionado) return null;
    const item = armadoSeleccionado.items?.find(i => i.idRef === ferrId);
    return item?.tipo || null;
  };

  // Orden: primarias (con o sin cant) → secundarias (con o sin cant) → resto
  const primarias   = itemsVisibles.filter(f => getTipo(f.id) === 'primaria');
  const secundarias = itemsVisibles.filter(f => getTipo(f.id) === 'secundaria');
  const resto       = itemsVisibles.filter(f => !getTipo(f.id));
  let itemsOrdenados = [...primarias, ...secundarias, ...resto];
  // Subir al inicio las ferreterías con valor mayor a cero (sort estable)
  if (subirConValor) itemsOrdenados = [...itemsOrdenados].sort((a, b) => ((datos[b.id] || 0) > 0 ? 1 : 0) - ((datos[a.id] || 0) > 0 ? 1 : 0));

  // VÍNCULOS ("van juntas"): pares INTERNOS (constantes.js, por nombre). Al tener cantidad
  // UNA del grupo, las demás se JUNTAN a su lado (aunque estén en 0) como SUGERENCIA.
  const norm = (s) => String(s || '').trim().toLowerCase();
  const vinculoDe = {};
  VINCULOS_FERRETERIA.forEach((grupo, gi) => {
    itemsVisibles.forEach(f => { if (grupo.includes(norm(f.nombre))) vinculoDe[f.id] = `vg${gi}`; });
  });
  const gruposActivos = new Set(itemsVisibles.filter(f => (datos[f.id] || 0) > 0 && vinculoDe[f.id]).map(f => vinculoDe[f.id]));
  if (gruposActivos.size) {
    const res = []; const done = new Set();
    for (const f of itemsOrdenados) {
      if (done.has(f.id)) continue;
      const vid = vinculoDe[f.id];
      if (vid && gruposActivos.has(vid)) {
        itemsOrdenados.filter(x => vinculoDe[x.id] === vid && !done.has(x.id)).forEach(m => { res.push(m); done.add(m.id); });
      } else { res.push(f); done.add(f.id); }
    }
    itemsOrdenados = res;
  }
  const esSugerida = (id) => vinculoDe[id] && gruposActivos.has(vinculoDe[id]) && (datos[id] || 0) === 0;

  const actualizarCantidad = (itemId, delta) => {
    if (disabled) return;
    const nuevaCantidad = Math.max(0, (datos[itemId] || 0) + delta);
    const nuevosDatos = { ...datos };
    if (nuevaCantidad === 0) delete nuevosDatos[itemId];
    else nuevosDatos[itemId] = nuevaCantidad;
    setDatos(nuevosDatos);
  };

  if (itemsVisibles.length === 0) return <div className="text-center opacity-50 text-xs py-4">No hay ferretería configurada</div>;

  return (
    <div className="grid grid-cols-1 gap-2">
      {itemsOrdenados.map(item => {
        const cantidad = datos[item.id] || 0;
        const isActive = cantidad > 0;
        const tipo = getTipo(item.id);
        const sugerida = esSugerida(item.id);
        const borderClass = sugerida             ? 'border-dashed border-purple-400 bg-purple-50/30'
                          : tipo === 'primaria'   ? (isActive ? 'border-green-500 bg-green-50/40'   : 'border-green-400/50')
                          : tipo === 'secundaria' ? (isActive ? 'border-orange-500 bg-orange-50/40' : 'border-orange-400/50')
                          : isActive              ? 'border-blue-500 bg-blue-50/40'
                          : theme.border;

        return (
          <div key={item.id} className={`${theme.card} border-2 ${borderClass} p-2 rounded-xl flex items-center justify-between transition-all`}>
            <div className="flex-1 pl-2">
              <div className={`font-bold text-sm leading-tight ${theme.text} flex items-center gap-1.5`}>
                {item.nombre}
                {sugerida && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-200 text-purple-700 shrink-0">sugerida</span>}              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/5 rounded-lg p-1">
              <button
                onClick={() => actualizarCantidad(item.id, -1)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg border-2 ${theme.border} ${theme.bg} active:scale-90 transition-transform`}
              >
                <span className="text-xl font-bold mb-0.5">−</span>
              </button>
              <div className={`w-12 text-center font-black text-xl tabular-nums ${
                tipo === 'primaria' ? (isActive ? 'text-green-600' : 'text-green-500') : tipo === 'secundaria' ? (isActive ? 'text-orange-600' : 'text-orange-500') : isActive ? 'text-blue-600' : 'text-slate-400'
              }`}>
                {cantidad}
              </div>
              <button
                onClick={() => actualizarCantidad(item.id, 1)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-900 text-white active:scale-90 transition-transform shadow-lg"
              >
                <Plus size={20} strokeWidth={3} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};