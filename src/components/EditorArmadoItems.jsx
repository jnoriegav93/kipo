import React from 'react';
import { ChevronDown } from 'lucide-react';
import { VINCULOS_FERRETERIA } from '../data/constantes';
import { esCableAcero } from '../utils/cablesAcero';

// Editor de los materiales de un armado: selección con cantidades, vínculos entre
// ferreterías que van juntas y reordenado de la lista. Estaba dentro del
// Configurador; se sacó aquí para usarlo igual en los armados del proyecto y no
// mantener dos versiones que acabarían distintas.
export default function EditorArmadoItems({ tempData, setTempData, config, theme, setConfirmData, onCerrar, onGuardar }) {
  // El buscador vive dentro del editor: no lo necesita nadie fuera.
  const [buscaArmado, setBuscaArmado] = React.useState('');
  const setModalOpen = () => onCerrar?.();
  const guardarArmadoConItems = () => onGuardar?.();
        const itemsSeleccion = tempData.itemsSeleccion || {};
        const listaOrden = tempData.listaOrden || config.catalogoFerreteria.map(f => f.id);
        // El cable de acero no va en armados: no es ferretería del poste
        let listaDisplay = listaOrden.map(id => config.catalogoFerreteria.find(f => f.id === id))
          .filter(f => f && !esCableAcero(f.id));

        // VÍNCULOS "van juntas": al ponerle cantidad a una del grupo, las demás se JUNTAN a
        // su lado (aunque estén en 0) y salen resaltadas como SUGERENCIA (no obliga cantidad).
        const normV = (s) => String(s || '').trim().toLowerCase();
        const vinculoDe = {};
        VINCULOS_FERRETERIA.forEach((grupo, gi) => {
          listaDisplay.forEach(f => { if (grupo.includes(normV(f.nombre))) vinculoDe[f.id] = `vg${gi}`; });
        });
        const gruposActivos = new Set(listaDisplay.filter(f => (itemsSeleccion[f.id]?.cant || 0) > 0 && vinculoDe[f.id]).map(f => vinculoDe[f.id]));
        if (gruposActivos.size) {
          const res = []; const done = new Set();
          for (const f of listaDisplay) {
            if (done.has(f.id)) continue;
            const vid = vinculoDe[f.id];
            if (vid && gruposActivos.has(vid)) {
              listaDisplay.filter(x => vinculoDe[x.id] === vid && !done.has(x.id)).forEach(m => { res.push(m); done.add(m.id); });
            } else { res.push(f); done.add(f.id); }
          }
          listaDisplay = res;
        }
        const esSugerida = (id) => vinculoDe[id] && gruposActivos.has(vinculoDe[id]) && (itemsSeleccion[id]?.cant || 0) === 0;

        // Buscador dentro del armado (filtra por nombre)
        if (buscaArmado.trim()) {
          const q = normV(buscaArmado);
          listaDisplay = listaDisplay.filter(f => normV(f.nombre).includes(q));
        }

        // Regla simple: con cantidad (>0) SIEMPRE es primaria; en cero puede ser secundaria
        // (o blanco). Al bajar a cero, una primaria queda en blanco (none).
        const updateCant = (ferrId, delta) => {
          const current = itemsSeleccion[ferrId] || { cant: 0, tipo: 'none' };
          const newCant = Math.max(0, (current.cant || 0) + delta);
          const tipo = newCant > 0 ? 'primaria' : (current.tipo === 'secundaria' ? 'secundaria' : 'none');
          setTempData({ ...tempData, itemsSeleccion: { ...itemsSeleccion, [ferrId]: { ...current, cant: newCant, tipo } } });
        };
        // El botón P/S solo actúa cuando la cantidad es CERO: alterna blanco ↔ secundaria.
        // Con cantidad es primaria fija (no se toca).
        const toggleTipo = (ferrId) => {
          const current = itemsSeleccion[ferrId] || { cant: 0, tipo: 'none' };
          if ((current.cant || 0) > 0) return; // con cantidad = primaria, no cambia
          const nextTipo = current.tipo === 'secundaria' ? 'none' : 'secundaria';
          setTempData({ ...tempData, itemsSeleccion: { ...itemsSeleccion, [ferrId]: { ...current, tipo: nextTipo } } });
        };
        const aplicarOrden = () => {
          const primarias   = config.catalogoFerreteria.filter(f => itemsSeleccion[f.id]?.tipo === 'primaria');
          const secundarias = config.catalogoFerreteria.filter(f => itemsSeleccion[f.id]?.tipo === 'secundaria');
          const sinTipo     = config.catalogoFerreteria.filter(f => { const t = itemsSeleccion[f.id]?.tipo; return !t || t === 'none'; });
          setTempData({ ...tempData, listaOrden: [...primarias, ...secundarias, ...sinTipo].map(f => f.id) });
        };
        const handleVolver = () => {
          const currentSnap = JSON.stringify({ itemsSeleccion, listaOrden });
          if (currentSnap !== tempData.snapshot) {
            setConfirmData({
              title: 'Cambios sin guardar',
              message: '¿Deseas guardar los cambios realizados en el armado?',
              actionText: 'SÍ, GUARDAR',
              theme,
              onClose: () => { setConfirmData(null); setModalOpen(null); },
              onConfirm: () => { setConfirmData(null); guardarArmadoConItems(); },
            });
          } else {
            setModalOpen(null);
          }
        };

        return (
          <div className={`absolute inset-0 z-50 flex flex-col ${theme.bg}`}>
            {/* Header */}
            <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0`}>
              <button onClick={handleVolver}>
                <ChevronDown className={`rotate-90 ${theme.text}`} size={28}/>
              </button>
              {/* El nombre se escribe aquí. Creado desde el proyecto llega vacío y antes no
                  había dónde ponerlo: al guardar pedía un nombre que no se podía escribir. */}
              <input
                type="text"
                value={tempData.nuevoArmadoNombre || ''}
                onChange={e => setTempData({ ...tempData, nuevoArmadoNombre: e.target.value })}
                autoFocus={!tempData.nuevoArmadoNombre}
                placeholder="Nombre del armado"
                className={`flex-1 min-w-0 mx-2 px-3 py-1.5 rounded-lg border-2 ${theme.border} ${theme.bg} ${theme.text} font-black uppercase text-center placeholder:normal-case placeholder:font-bold placeholder:text-slate-400 focus:border-blue-500 focus:outline-none`}
              />
              <button
                onClick={aplicarOrden}
                className="text-[11px] font-black px-3 py-1.5 rounded-lg border-2 border-black bg-slate-900 text-white transition-all shrink-0 active:scale-95"
              >
                ORDENAR
              </button>
            </div>

            {/* Buscador */}
            <div className={`px-3 pt-3 shrink-0 ${theme.bg}`}>
              <input
                type="text"
                placeholder="Buscar ferretería…"
                value={buscaArmado}
                onChange={e => setBuscaArmado(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-lg border-2 ${theme.border} ${theme.bg} ${theme.text} font-bold placeholder-slate-400 focus:border-blue-500 focus:outline-none text-sm`}
              />
            </div>

            {/* Lista de ferreterías */}
            <div className="flex-1 overflow-y-auto p-3 space-y-px">
              {listaDisplay.length === 0 ? (
                <div className="flex items-center justify-center h-full opacity-40 text-xs">No hay ferreterías creadas</div>
              ) : listaDisplay.map(f => {
                const sel = itemsSeleccion[f.id] || { cant: 0, tipo: 'none' };
                const tieneCant = (sel.cant || 0) > 0;
                const tipo = sel.tipo || 'none';
                const esPrimaria = tipo === 'primaria';
                const esSecundaria = tipo === 'secundaria';
                const tieneSelTipo = esPrimaria || esSecundaria;
                const sugerida = esSugerida(f.id);
                // Color de fondo de fila
                const filaBg = sugerida
                  ? 'bg-purple-50/40 border border-dashed border-purple-400'
                  : tieneCant
                    ? (esPrimaria ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200')
                    : tieneSelTipo
                      ? (esPrimaria ? 'bg-green-50/40 border border-green-100' : 'bg-orange-50/40 border border-orange-100')
                      : `${theme.card} border border-transparent`;
                // Botón P/S: P verde (con cantidad) · S naranja (secundaria) · S gris tenue (blanco)
                const btnLetra = esPrimaria ? 'P' : 'S';
                const btnCls = esPrimaria
                  ? 'border-green-500 text-green-600'
                  : esSecundaria
                    ? 'border-orange-500 text-orange-600'
                    : 'border-slate-300 text-slate-300';
                return (
                  <div key={f.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors ${filaBg}`}>
                    <span className={`flex-1 font-bold text-sm ${theme.text} truncate flex items-center gap-1.5`}>
                      {f.nombre}
                      {sugerida && <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-200 text-purple-700 shrink-0">sugerida</span>}
                    </span>
                    {/* Toggle P/S — siempre clickeable */}
                    <button
                      onClick={() => toggleTipo(f.id)}
                      className={`w-8 h-8 rounded-lg text-[11px] font-black border-2 bg-transparent transition-all shrink-0 ${btnCls} ${tieneCant ? 'opacity-60' : ''}`}
                    >
                      {btnLetra}
                    </button>
                    {/* Contador */}
                    <div className={`flex items-center border-2 ${theme.border} rounded-lg overflow-hidden shrink-0`}>
                      <button onClick={() => updateCant(f.id, -1)} className={`w-8 h-8 flex items-center justify-center ${theme.bg} ${theme.text} font-black text-lg active:bg-black/10 select-none`}>−</button>
                      <span className={`w-8 text-center text-sm font-black text-black self-stretch flex items-center justify-center ${
                        !tieneCant ? 'bg-black/[0.06]' : esPrimaria ? 'bg-green-200' : 'bg-orange-200'
                      }`}>{sel.cant}</span>
                      <button onClick={() => updateCant(f.id, 1)} className={`w-8 h-8 flex items-center justify-center ${theme.bg} ${theme.text} font-black text-lg active:bg-black/10 select-none`}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botón guardar */}
            <div className={`shrink-0 border-t-2 ${theme.border} p-3`} style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
              <button
                onClick={guardarArmadoConItems}
                disabled={!String(tempData.nuevoArmadoNombre || '').trim()}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:active:scale-100"
              >
                {String(tempData.nuevoArmadoNombre || '').trim() ? 'GUARDAR ARMADO' : 'PONLE UN NOMBRE ARRIBA'}
              </button>
            </div>
          </div>
        );
}
