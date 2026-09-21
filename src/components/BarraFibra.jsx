import React, { useState, useRef, useEffect } from 'react';
import { Save, Trash2, Eye, EyeOff, X, List, Undo2, Crosshair, Magnet, RotateCcw, Plus, Spline } from 'lucide-react';
import { CAPACIDADES, getColorFibra, longitudFibra } from '../utils/fibraUtils';

// Editor de un ramal ya guardado. Es presentacional: los cambios viven arriba,
// en `edit`, y quedan PENDIENTES hasta pulsar GUARDAR. Así se ve el color nuevo
// sobre el mapa antes de decidir, y cerrar la lista puede avisar de lo pendiente.
function EditorRamal({ edit, setEdit, isDark, hayCambios, onProbarCapacidad, onGuardar }) {
  const claseInput = isDark
    ? 'border-slate-600 text-slate-100 placeholder:text-slate-500'
    : 'border-slate-400 text-slate-800 placeholder:text-slate-400';

  return (
    <div className={'px-2 pb-2 pt-1 border-t-2 ' + (isDark ? 'border-slate-700' : 'border-slate-200')}>
      <input
        value={edit.nombre}
        onChange={(e) => setEdit(p => ({ ...p, nombre: e.target.value }))}
        placeholder="SIN NOMBRE"
        maxLength={60}
        className={'w-full mb-2 px-2 py-1.5 rounded-lg border-2 bg-transparent outline-none text-[11px] font-black uppercase tracking-wide ' + claseInput}
      />
      <div className="grid grid-cols-3 gap-1 mb-2">
        {CAPACIDADES.map(v => (
          <button
            key={v}
            onClick={() => onProbarCapacidad(v)}
            className={'flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-black border-2 transition-all ' + (v === edit.capacidad
              ? 'bg-blue-600 text-white border-blue-700'
              : isDark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-white text-slate-700 border-slate-400')}
          >
            <div className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: getColorFibra(v) }} />
            {v}
          </button>
        ))}
      </div>
      <button
        onClick={onGuardar}
        disabled={!hayCambios}
        className={'w-full py-2 rounded-lg border-2 text-[10px] font-black tracking-widest transition-all ' + (hayCambios
          ? 'border-blue-700 bg-blue-600 text-white active:scale-95'
          : isDark ? 'border-slate-700 text-slate-600' : 'border-slate-300 text-slate-400')}
      >
        {hayCambios ? 'GUARDAR CAMBIOS' : 'SIN CAMBIOS'}
      </button>
    </div>
  );
}

export default function BarraFibra({
  theme,
  isDark,
  capacidadFibra,
  setCapacidadFibra,
  puntosRecorrido,
  setPuntosRecorrido,
  onGuardarFibra,
  nombreSugerido = '',
  conexiones = [],
  conexionSeleccionada,
  setConexionSeleccionada,
  onEliminarConexion,
  onActualizar,
  onPreviewFibra,
  onCentrar,
  onEditarVertices,          // abre la edición del trazo de ese ramal, en el mapa
  modoAjuste = false,
  setModoAjuste,
  onAjustarFibra,
  // El disquete arranca el trazo cuando no se está dibujando, así que la barra
  // necesita saber y poder cambiar ese estado.
  dibujandoFibra = false,
  setDibujandoFibra,
  umbralAjuste = 3,
  setUmbralAjuste,
  previewAjuste = [],
  aplicandoAjuste = false,
  onAplicarAjuste,
  hayDeshacerAjuste = false,
  onDeshacerAjuste,
  fibrasVisibles,
  setFibrasVisibles,
  totalFibras,
  onCerrar,
  selector = null   // FIBRA | ACERO, arriba de la barra
}) {
  // Edición del ramal elegido en la lista. Los cambios quedan PENDIENTES hasta
  // confirmarlos: así se puede ver el color nuevo en el mapa antes de decidir.
  const [edit, setEdit] = useState(null);            // { id, nombre, capacidad }
  const [idEnEdicion, setIdEnEdicion] = useState(null);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [panel, setPanel] = useState(null); // null | 'guardar' | 'lista'
  const [nombre, setNombre] = useState('');
  const [capacidad, setCapacidad] = useState(capacidadFibra);
  const refBarra = useRef(null);

  useEffect(() => {
    if (!panel) return;
    const handler = (e) => {
      if (refBarra.current && !refBarra.current.contains(e.target)) setPanel(null);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [panel]);

  // El trazo se puede guardar en cuanto tiene una línea, o sea desde el segundo vértice.
  const puedeGuardar = puntosRecorrido.length >= 2;

  // El botón de retroceder sirve para las dos cosas: quitar vértices del trazo que
  // se está dibujando, o del ramal ya guardado que se esté editando en la lista.
  const editandoRamal = !!(edit && edit.vertices && edit.vertices.length > 0);
  const puedeRetroceder = editandoRamal ? edit.vertices.length > 2 : puntosRecorrido.length > 0;

  const abrirGuardar = () => {
    setNombre('');
    setCapacidad(capacidadFibra);
    setPanel('guardar');
  };

  const confirmarGuardar = async () => {
    setPanel(null);
    setCapacidadFibra?.(capacidad); // la próxima fibra arranca con la misma capacidad
    // Sin nombre escrito se usa el correlativo propuesto, para que ningún ramal
    // quede sin identificar.
    await onGuardarFibra?.({ nombre: nombre.trim() || nombreSugerido, capacidad });
  };

  const btnBase = "w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0";
  const btnNormal = isDark
    ? 'bg-slate-700 text-slate-200 border-slate-500'
    : 'bg-white text-slate-700 border-slate-500';
  const btnDisabled = isDark
    ? 'bg-slate-700 border-slate-600 text-slate-500'
    : 'bg-white border-slate-400 text-slate-400';
  const panelBase = `pointer-events-auto mt-1 rounded-2xl ${isDark ? 'bg-slate-800/95 border-slate-600' : 'bg-white/95 border-slate-400'} border-2 shadow-xl backdrop-blur-sm`;

  // Al cambiar de ramal seleccionado se rearma el editor. Se hace aquí, en el
  // render, y no en un efecto: React lo re-ejecuta al momento sin pintar un estado
  // intermedio con los datos del ramal anterior.
  const idSel = conexionSeleccionada?.id ?? null;
  if (idSel !== idEnEdicion) {
    setIdEnEdicion(idSel);
    setEdit(idSel ? {
      id: idSel,
      nombre: conexionSeleccionada.nombre || '',
      capacidad: conexionSeleccionada.capacidad || 12,
      vertices: Array.isArray(conexionSeleccionada.vertices) ? [...conexionSeleccionada.vertices] : null
    } : null);
  }

  // Versión guardada del ramal que se está editando
  const original = edit ? conexiones.find(x => String(x.id) === String(edit.id)) : null;
  const vertOriginales = Array.isArray(original?.vertices) ? original.vertices.length : null;
  const hayCambios = !!(edit && original && (
    (edit.nombre || '').trim() !== (original.nombre || '') ||
    edit.capacidad !== (original.capacidad || 12) ||
    (edit.vertices && vertOriginales != null && edit.vertices.length !== vertOriginales)
  ));

  const guardarEdicion = async () => {
    if (!edit || !original) return;
    const cambios = {};
    if ((edit.nombre || '').trim() !== (original.nombre || '')) cambios.nombre = edit.nombre;
    if (edit.capacidad !== (original.capacidad || 12)) cambios.capacidad = edit.capacidad;
    if (edit.vertices && vertOriginales != null && edit.vertices.length !== vertOriginales) cambios.vertices = edit.vertices;
    await onActualizar?.(original, cambios);
    onPreviewFibra?.(null); // guardado: el mapa vuelve a leer el dato real
  };

  const cerrarEdicion = () => {
    onPreviewFibra?.(null);
    setConexionSeleccionada?.(null); setEdit(null); setConfirmarCierre(false);
  };

  // Se prueba una capacidad: cambia el pendiente y de paso pinta la línea de ese
  // color en el mapa, sin guardar todavía.
  const probarCapacidad = (v) => {
    setEdit(p => ({ ...p, capacidad: v }));
    avisarPreview({ capacidad: v });
  };

  // Le dice al mapa cómo se vería el ramal con los cambios sin guardar (color y
  // recorrido). Con null vuelve a pintarse desde el dato guardado.
  const avisarPreview = (parche) => {
    if (!edit) { onPreviewFibra?.(null); return; }
    const cap = parche.capacidad ?? edit.capacidad;
    const vs = parche.vertices ?? edit.vertices;
    const igual = cap === (original?.capacidad || 12) &&
      (!vs || vertOriginales == null || vs.length === vertOriginales);
    onPreviewFibra?.(igual ? null : { id: edit.id, capacidad: cap, vertices: vs });
  };

  // Quitar el último vértice del ramal en edición. Nunca por debajo de dos: con
  // menos dejaría de ser una línea.
  const quitarVertice = () => {
    if (!edit?.vertices || edit.vertices.length <= 2) return;
    const vs = edit.vertices.slice(0, -1);
    setEdit(p => ({ ...p, vertices: vs }));
    avisarPreview({ vertices: vs });
  };

  // Pulsar LISTA con cambios sin guardar pregunta antes de cerrar. Antes se cerraba
  // en silencio y el ramal quedaba desplegado con los cambios colgando.
  const alPulsarLista = () => {
    if (panel === 'lista' && hayCambios) { setConfirmarCierre(true); return; }
    if (panel === 'lista') cerrarEdicion();
    setPanel(panel === 'lista' ? null : 'lista');
  };

  // Largo del trazo, solo para las fibras que ya traen geometría propia.
  const metrosDe = (c) => Array.isArray(c.vertices) && c.vertices.length >= 2
    ? Math.round(longitudFibra(c.vertices)) : 0;
  const largoDe = (c) => metrosDe(c) > 0 ? `${metrosDe(c)} m` : '—';

  // Los ramales más nuevos arriba. Sin timestamp (datos viejos) van al final.
  const ordenados = [...conexiones].sort((a, b) =>
    String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const largoTotal = conexiones.reduce((t, c) => t + metrosDe(c), 0);

  return (
    <div className="relative shrink-0 flex flex-col items-center justify-center w-full pointer-events-none" ref={refBarra}>
      {selector}

      {/* Barra principal flotante */}
      <div className={`pointer-events-auto ${selector ? 'mt-1.5' : 'mt-2'} rounded-2xl ${isDark ? 'bg-slate-800/95 border-slate-600' : 'bg-white/95 border-slate-400'} border-2 px-2 py-1.5 flex items-center gap-1.5 shadow-xl backdrop-blur-sm`}>

        {/* ATRÁS — quita el último vértice puesto. Sin esto, un toque mal dado
            obligaba a guardar el ramal y borrarlo, porque ya no existe el lápiz
            que antes cancelaba el trazo. */}
        <button
          onClick={() => { if (editandoRamal) quitarVertice(); else setPuntosRecorrido?.(prev => prev.slice(0, -1)); }}
          disabled={!puedeRetroceder}
          className={`${btnBase} border-2 ${puedeRetroceder
            ? `${btnNormal} active:scale-95`
            : `${btnDisabled} opacity-40 cursor-not-allowed`
            }`}
          title={editandoRamal ? 'Quitar el último vértice del ramal' : 'Quitar el último vértice'}
        >
          <Undo2 size={18} />
        </button>

        {/* EMPEZAR / GUARDAR — el mismo botón hace las dos cosas según el momento.
            Sin dibujar, arranca el trazo: hasta entonces los toques del mapa sirven para
            ELEGIR una fibra, no para clavar vértices (una fibra puede empezar en
            cualquier sitio, así que si no se separan los dos estados, cada intento de
            seleccionar creaba el primer vértice de una fibra nueva). */}
        <button
          onClick={() => {
            if (!dibujandoFibra) { setDibujandoFibra?.(true); setPanel(null); return; }
            if (!puedeGuardar) return;
            if (panel === 'guardar') setPanel(null); else abrirGuardar();
          }}
          className={`${btnBase} border-2 ${!dibujandoFibra || puedeGuardar
            ? 'bg-blue-600 text-white border-blue-700 active:scale-95'
            : `${btnDisabled} opacity-40 cursor-not-allowed`
            }`}
          title={dibujandoFibra ? 'Guardar ramal' : 'Empezar un ramal nuevo'}
        >
          {dibujandoFibra ? <Save size={18} /> : <Plus size={18} strokeWidth={3} />}
        </button>

        {/* LISTA DE FIBRAS — el contador abre el listado */}
        <button
          onClick={alPulsarLista}
          className={`${btnBase} border-2 gap-1 px-1 ${panel === 'lista'
            ? 'bg-blue-600 text-white border-blue-700'
            : (isDark ? 'bg-slate-950 border-slate-500 text-slate-300' : 'bg-slate-700 border-slate-600 text-white')} text-[11px] font-black`}
          title="Lista de fibras"
        >
          <List size={13} />
          {totalFibras}
        </button>

        {/* El imán ya no vive acá: cada ramal tiene el suyo en la lista, para ajustar
            solo sus postes y no los de todo el proyecto de una. */}

        <div className={`w-[1px] h-7 ${isDark ? 'bg-slate-600' : 'bg-slate-400'} shrink-0`} />

        {/* ELIMINAR — actúa sobre la fibra elegida en la lista */}
        <button
          onClick={() => { if (conexionSeleccionada) onEliminarConexion(conexionSeleccionada); }}
          disabled={!conexionSeleccionada}
          className={`${btnBase} border-2 ${conexionSeleccionada
            ? 'border-red-500 text-red-500 bg-white active:bg-red-500/10'
            : `${btnDisabled} opacity-30 cursor-not-allowed`
            }`}
          title="Eliminar la fibra seleccionada"
        >
          <Trash2 size={18} />
        </button>

        {/* VER/OCULTAR */}
        <button
          onClick={() => setFibrasVisibles(!fibrasVisibles)}
          className={`${btnBase} border-2 ${fibrasVisibles ? btnNormal : 'bg-slate-600 text-white border-slate-700'}`}
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

      {/* Aviso al cerrar la lista con cambios sin guardar */}
      {confirmarCierre && (
        <div className={panelBase + ' px-3 py-2.5 w-[min(92vw,340px)]'}>
          <p className={'text-[11px] font-black text-center mb-2.5 ' + theme.text}>
            Hay cambios sin guardar en este ramal.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => { cerrarEdicion(); setPanel(null); }}
              className={'flex-1 py-2 rounded-xl border-2 text-[11px] font-black tracking-widest ' + (isDark ? 'border-slate-600 text-slate-300' : 'border-slate-400 text-slate-600')}
            >
              DESCARTAR
            </button>
            <button
              onClick={async () => { await guardarEdicion(); cerrarEdicion(); setPanel(null); }}
              className="flex-1 py-2 rounded-xl border-2 border-blue-700 bg-blue-600 text-white text-[11px] font-black tracking-widest active:scale-95"
            >
              GUARDAR
            </button>
          </div>
        </div>
      )}

      {/* Panel de ajuste: umbral en metros con vista previa en vivo. Los postes que
          se van a mover se pintan en el mapa mientras se toca el − y el +. */}
      {modoAjuste && (
        <div className={`${panelBase} px-3 py-2.5 w-[min(92vw,340px)]`}>
          <label className={`block text-[9px] font-black tracking-widest mb-1.5 ${theme.text} opacity-60`}>
            DISTANCIA MÁXIMA A LA FIBRA
          </label>
          <div className="flex items-center gap-2 mb-2.5">
            <button
              onClick={() => setUmbralAjuste?.(u => Math.max(1, +(u - 1).toFixed(0)))}
              className={`w-10 h-10 rounded-xl border-2 text-lg font-black ${btnNormal} active:scale-95`}
            >−</button>
            <div className={`flex-1 text-center py-2 rounded-xl border-2 ${isDark ? 'border-slate-600' : 'border-slate-400'}`}>
              <span className={`text-lg font-black ${theme.text}`}>{umbralAjuste}</span>
              <span className={`text-[10px] font-bold ml-1 ${theme.text} opacity-60`}>m</span>
            </div>
            <button
              onClick={() => setUmbralAjuste?.(u => Math.min(50, u + 1))}
              className={`w-10 h-10 rounded-xl border-2 text-lg font-black ${btnNormal} active:scale-95`}
            >+</button>
          </div>

          <p className={`text-center text-[11px] font-black mb-2.5 ${previewAjuste.length > 0 ? 'text-amber-500' : `${theme.text} opacity-50`}`}>
            {previewAjuste.length === 0
              ? 'Ningún poste a esa distancia'
              : `SE MOVERÁN ${previewAjuste.length} POSTE${previewAjuste.length === 1 ? '' : 'S'}`}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setModoAjuste?.(false)}
              className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-black tracking-widest ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-400 text-slate-600'}`}
            >
              CANCELAR
            </button>
            <button
              onClick={onAplicarAjuste}
              disabled={previewAjuste.length === 0 || aplicandoAjuste}
              className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-black tracking-widest ${previewAjuste.length > 0 && !aplicandoAjuste
                ? 'border-amber-600 bg-amber-500 text-black active:scale-95'
                : `${btnDisabled} opacity-40`}`}
            >
              {aplicandoAjuste ? 'MOVIENDO…' : 'APLICAR'}
            </button>
          </div>
        </div>
      )}

      {/* Deshacer: disponible mientras no se salga del modo fibra */}
      {!modoAjuste && hayDeshacerAjuste && (
        <button
          onClick={onDeshacerAjuste}
          disabled={aplicandoAjuste}
          className={`${panelBase} pointer-events-auto px-3 py-2 flex items-center gap-2 text-[10px] font-black tracking-widest ${theme.text} disabled:opacity-40`}
        >
          <RotateCcw size={14} /> DESHACER AJUSTE DE POSTES
        </button>
      )}

      {/* Panel de guardado: nombre + capacidad, al terminar el trazo */}
      {panel === 'guardar' && (
        <div className={`${panelBase} px-3 py-2.5 w-[min(92vw,340px)]`}>
          <label className={`block text-[9px] font-black tracking-widest mb-1 ${theme.text} opacity-60`}>NOMBRE DEL RAMAL</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder={nombreSugerido || 'OPCIONAL'}
            maxLength={60}
            autoFocus
            className={`w-full mb-2.5 px-2 py-1.5 rounded-lg border-2 bg-transparent outline-none text-[12px] font-black uppercase tracking-wide ${isDark ? 'border-slate-600 text-slate-100 placeholder:text-slate-500' : 'border-slate-400 text-slate-800 placeholder:text-slate-400'}`}
          />

          <label className={`block text-[9px] font-black tracking-widest mb-1 ${theme.text} opacity-60`}>CAPACIDAD</label>
          {/* Rejilla 3x3: las nueve capacidades a la vista, sin barra de desplazamiento */}
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            {CAPACIDADES.map(cap => (
              <button
                key={cap}
                onClick={() => setCapacidad(cap)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-black border-2 transition-all ${capacidad === cap
                  ? 'bg-blue-600 text-white border-blue-700 scale-105'
                  : isDark ? 'bg-slate-700 text-slate-200 border-slate-500' : 'bg-white text-slate-700 border-slate-500'
                  }`}
              >
                <div className="w-3 h-3 rounded-full border border-black/20 shrink-0" style={{ backgroundColor: getColorFibra(cap) }} />
                {cap}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPanel(null)}
              className={`flex-1 py-2 rounded-xl border-2 text-[11px] font-black tracking-widest ${isDark ? 'border-slate-600 text-slate-300' : 'border-slate-400 text-slate-600'}`}
            >
              CANCELAR
            </button>
            <button
              onClick={confirmarGuardar}
              className="flex-1 py-2 rounded-xl border-2 border-blue-700 bg-blue-600 text-white text-[11px] font-black tracking-widest active:scale-95"
            >
              GUARDAR
            </button>
          </div>
        </div>
      )}

      {/* Lista de ramales. Además de consultarlos, es donde se elige cuál borrar,
          se renombran, se les cambia la capacidad y se centra el mapa en ellos. */}
      {panel === 'lista' && (
        <div className={`${panelBase} w-[min(92vw,360px)] max-h-[55vh] overflow-y-auto p-1.5`}>
          {/* Encabezado: cuántos ramales y cuánta fibra suman */}
          <div className={`flex items-center justify-between px-2 pb-1.5 mb-1 border-b-2 ${isDark ? 'border-slate-700' : 'border-slate-300'}`}>
            <span className={`text-[10px] font-black tracking-widest ${theme.text} opacity-60`}>
              {ordenados.length} RAMAL{ordenados.length === 1 ? '' : 'ES'}
            </span>
            <span className={`text-[10px] font-black tracking-widest ${theme.text} opacity-60`}>
              {largoTotal > 0 ? `${largoTotal.toLocaleString('es-PE')} m` : ''}
            </span>
          </div>

          {ordenados.length === 0 ? (
            <p className={`text-[11px] font-bold text-center py-4 ${theme.text} opacity-50`}>Todavía no hay ramales dibujados.</p>
          ) : ordenados.map((c) => {
            const sel = conexionSeleccionada && String(conexionSeleccionada.id) === String(c.id);
            const cap = c.capacidad || 12;
            return (
              <div
                key={c.id}
                className={`rounded-xl border-2 mb-1 transition-all ${sel
                  ? 'border-blue-600 bg-blue-600/10'
                  : isDark ? 'border-slate-600' : 'border-slate-300'
                  }`}
              >
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setConexionSeleccionada?.(sel ? null : c)}
                    className="flex-1 flex items-center gap-2 px-2 py-2 text-left min-w-0"
                  >
                    <div className="w-3.5 h-3.5 rounded-full border border-black/30 shrink-0" style={{ backgroundColor: getColorFibra(cap) }} />
                    <span className={`flex-1 text-[11px] font-black uppercase truncate ${theme.text}`}>
                      {c.nombre || 'SIN NOMBRE'}
                    </span>
                    <span className={`text-[10px] font-bold shrink-0 ${theme.text} opacity-60`}>{cap} FO</span>
                    <span className={`text-[10px] font-bold shrink-0 w-12 text-right ${theme.text} opacity-50`}>{largoDe(c)}</span>
                  </button>
                  <button
                    onClick={() => onCentrar?.(c)}
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${theme.text} opacity-60 active:opacity-100`}
                    title="Centrar el mapa en este ramal"
                  >
                    <Crosshair size={15} strokeWidth={2.5} />
                  </button>
                  {/* EDITAR EL TRAZO: pasa a mover, agregar y quitar vértices de ESTE
                      ramal. Cierra el panel, porque la edición ocurre toda en el mapa. */}
                  <button
                    onClick={() => { onEditarVertices?.(c); setPanel(null); }}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 opacity-80 active:opacity-100"
                    title="Editar el trazo de este ramal"
                  >
                    <Spline size={15} strokeWidth={2.5} />
                  </button>
                  {/* AJUSTAR: jala hasta la línea los postes cercanos a ESTE ramal, no a
                      todos. Cierra el panel para dejar ver la vista previa en el mapa. */}
                  <button
                    onClick={() => { onAjustarFibra?.(c); setPanel(null); }}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-amber-600 opacity-80 active:opacity-100"
                    title="Ajustar los postes de este ramal"
                  >
                    <Magnet size={15} strokeWidth={2.5} />
                  </button>
                  {/* BORRAR: primero lo deja seleccionado, así queda resaltado en el mapa
                      mientras se decide, y después pide confirmación. */}
                  <button
                    onClick={() => { setConexionSeleccionada?.(c); onEliminarConexion?.(c); }}
                    className="shrink-0 w-8 h-8 mr-1 rounded-lg flex items-center justify-center text-red-500 opacity-80 active:opacity-100"
                    title="Eliminar este ramal"
                  >
                    <Trash2 size={15} strokeWidth={2.5} />
                  </button>
                </div>

                {sel && edit && (
                  <EditorRamal
                    edit={edit}
                    setEdit={setEdit}
                    isDark={isDark}
                    hayCambios={hayCambios}
                    onProbarCapacidad={probarCapacidad}
                    onGuardar={async () => { await guardarEdicion(); }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
