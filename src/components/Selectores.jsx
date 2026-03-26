import React, { useState } from 'react';
import { Plus, AlertTriangle } from 'lucide-react';

// Subcomponentes auxiliares
export const SelectorGrid = ({ titulo, opciones, seleccion, onSelect, cols, textSize = 'text-lg', theme, titleLine = false }) => {
  const visibles = opciones.filter(o => o.visible);
  if (visibles.length === 0) return null;
  return (
    <div>
      <h3 className={`text-xs font-black ${theme.text} mb-2 uppercase tracking-wider${titleLine ? ' border-l-2 border-b-2 border-slate-400 pl-1.5 pb-1' : ' ml-1'}`}>{titulo}</h3>
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {visibles.map(op => (
          <button key={op.v} onClick={() => onSelect(op.v)} className={`h-14 rounded-lg ${textSize} font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${seleccion === op.v ? theme.gridBtnActive : theme.gridBtn}`}>
            <span className="px-1 break-words leading-tight">{op.v}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export const SelectorGridMulti = ({ titulo, opciones, seleccion, onToggle, cols, textSize = 'text-[12px]', theme, titleLine = false }) => {
  const visibles = opciones.filter(o => o.visible);
  if (visibles.length === 0) return null;
  return (
    <div>
      <h3 className={`text-xs font-black ${theme.text} mb-2 uppercase tracking-wider${titleLine ? ' border-l-2 border-b-2 border-slate-400 pl-1.5 pb-1' : ' ml-1'}`}>{titulo}</h3>
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {visibles.map(op => {
          const isActive = seleccion.includes(op.v);
          return (
            <button key={op.v} onClick={() => onToggle(op.v)} className={`h-14 rounded-lg ${textSize} font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${isActive ? theme.gridBtnActive : theme.gridBtn}`}>
              <span className="px-1 break-words leading-tight">{op.v}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};


// --- COMPONENTE DE LISTA CON CONTADORES ---
export const ListaContadores = ({ config, datos, setDatos, theme, disabled, armadoSeleccionado }) => {
  const itemsVisibles = config.catalogoFerreteria.filter(f => f.visible !== false);
  const [alerta, setAlerta] = useState(null);

  const armado = armadoSeleccionado?.[0];
  const armadoItemIds = new Set((armado?.items || []).map(i => i.idRef));

  // Ítems del armado al tope, el resto debajo (orden original preservado dentro de cada grupo)
  const itemsOrdenados = [...itemsVisibles].sort((a, b) => {
    const aIn = armadoItemIds.has(a.id);
    const bIn = armadoItemIds.has(b.id);
    return aIn === bIn ? 0 : aIn ? -1 : 1;
  });

  const actualizarCantidad = (itemId, delta) => {
    if (disabled) return;
    const cantidadActual = datos[itemId] || 0;
    const nuevaCantidad = cantidadActual + delta;

    // Solo restringir cuando el resultado sería negativo
    if (nuevaCantidad < 0) {
      if (!armadoSeleccionado || armadoSeleccionado.length === 0) {
        setAlerta({ mensaje: 'Debes seleccionar un armado antes de restar ferretería' });
        return;
      }
      const armadoActual = armadoSeleccionado[0];
      const itemEnArmado = armadoActual.items.find(item => item.idRef === itemId);
      if (!itemEnArmado) {
        const ferreteria = config.catalogoFerreteria.find(f => f.id === itemId);
        setAlerta({ mensaje: `"${ferreteria?.nombre || 'Esta ferretería'}" no existe en el armado "${armadoActual.nombre}"` });
        return;
      }
      const cantidadDisponible = itemEnArmado.cant;
      if (Math.abs(nuevaCantidad) > cantidadDisponible) {
        const ferreteria = config.catalogoFerreteria.find(f => f.id === itemId);
        setAlerta({ mensaje: `Solo puedes restar hasta ${cantidadDisponible} ${ferreteria?.unidad || 'unidades'} de "${ferreteria?.nombre}". El armado "${armadoActual.nombre}" solo tiene esa cantidad.` });
        return;
      }
    }

    const nuevosDatos = { ...datos };
    if (nuevaCantidad === 0) {
      delete nuevosDatos[itemId];
    } else {
      nuevosDatos[itemId] = nuevaCantidad;
    }
    setDatos(nuevosDatos);
  };

  if (itemsVisibles.length === 0) return <div className="text-center opacity-50 text-xs">No hay ferretería configurada</div>;

  return (
    <>
      <div className="space-y-3">
        <h3 className={`text-xs font-black ${theme.text} opacity-70 uppercase ml-1`}>FERRETERÍA EXTRA</h3>
        <div className="grid grid-cols-1 gap-2">
          {itemsOrdenados.map(item => {
            const cantidad = datos[item.id] || 0;
            const isActive = cantidad !== 0;
            const isNegative = cantidad < 0;
            const cantArmado = armado?.items.find(i => i.idRef === item.id)?.cant || 0;

            return (
              <div key={item.id} className={`${theme.card} border-2 ${isActive ? (isNegative ? 'border-red-500 bg-red-500/5' : 'border-brand-500 bg-brand-500/5') : theme.border} p-2 rounded-xl flex items-center justify-between transition-all`}>

                {/* NOMBRE Y UNIDAD */}
                <div className="flex-1 pl-2">
                  <div className={`font-bold text-sm leading-tight ${theme.text}`}>{item.nombre}</div>
                  <div className="text-[10px] opacity-60 uppercase font-black">{item.unidad}</div>
                </div>

                {/* CONTROLES (- delta +) */}
                <div className="flex items-center gap-3 bg-slate-900/5 rounded-lg p-1">

                  {/* Cantidad fija del armado (solo referencia visual) */}
                  {cantArmado > 0 && (
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-green-500 text-white font-black text-lg tabular-nums">
                      {cantArmado}
                    </div>
                  )}

                  <button
                    onClick={() => actualizarCantidad(item.id, -1)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg border-2 ${theme.border} ${theme.bg} active:scale-90 transition-transform`}
                  >
                    <span className="text-xl font-bold mb-1">-</span>
                  </button>

                  <div className={`w-12 text-center font-black text-xl tabular-nums ${isNegative ? 'text-red-600' : ''}`}>
                    {cantidad}
                  </div>

                  <button
                    onClick={() => actualizarCantidad(item.id, 1)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg bg-slate-900 text-white active:scale-90 transition-transform shadow-lg`}
                  >
                    <Plus size={20} strokeWidth={3} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ALERTA PERSONALIZADA */}
      {alerta && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setAlerta(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="bg-orange-100 p-2 rounded-full shrink-0">
                <AlertTriangle size={24} className="text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-lg text-slate-900 mb-1">No permitido</h3>
                <p className="text-sm text-slate-600 leading-snug">{alerta.mensaje}</p>
              </div>
            </div>
            <button 
              onClick={() => setAlerta(null)}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </>
  );
};