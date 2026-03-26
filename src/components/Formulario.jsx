import React, { useRef } from 'react';
import { X, Save, Camera } from 'lucide-react';
import { ThemedInput } from './UI';
import { SelectorGrid, SelectorGridMulti, ListaContadores } from './Selectores';

export default function Formulario({
  theme,
  datosFormulario,
  setDatosFormulario,
  config,
  proyectoActual,
  modoLectura,
  modoEdicion,
  setVista,
  guardarPunto,
  cancelarPunto,
  setModalOpen,
  inputCamaraRef,
  setPhotoTab
}) {
  // Estado de subida de imágenes
  const [subiendoFoto, setSubiendoFoto] = React.useState(false);

  // Procesar Foto (Nueva Lógica: Storage + Thumb)
  const procesarFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setSubiendoFoto(true);

      // 1. Procesar localmente (Full + Thumb)
      const { fullBlob, thumbBase64 } = await import('../utils/helpers').then(m => m.procesarImagenInput(file));

      // 2. Subir Full a Storage
      const path = `proyectos/${proyectoActual?.id || 'temp'}/fotos/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
      const urlDescarga = await import('../utils/storage').then(m => m.uploadImage(fullBlob, path));

      // 3. Guardar Referencia (URL + Thumb)
      const nuevaFoto = {
        url: urlDescarga,
        thumb: thumbBase64, // Para vista previa instantánea
        path: path,
        timestamp: new Date().toISOString()
      };

      setDatosFormulario(prev => ({
        ...prev,
        // Usamos ARRAY separado para evitar colisión con PhotoManager (Objeto)
        fotosGenerales: [...(prev.fotosGenerales || []), nuevaFoto]
      }));

    } catch (error) {
      console.error("Error subiendo foto:", error);
      alert("Error al subir la foto. Verifique su conexión.");
    } finally {
      setSubiendoFoto(false);
      // Limpiar input
      if (inputCamaraRef.current) inputCamaraRef.current.value = '';
    }
  };

  return (
    <>

      <div className={`fixed inset-0 z-[200] ${theme.bg} flex flex-col animate-in slide-in-from-bottom duration-200`}>

        {/* 1. HEADER: Cambio de título dinámico */}
        <div className={`${theme.header} border-b-2 ${theme.border} px-4 flex justify-between items-center shadow-lg shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
          <h2 className={`font-black ${theme.text} text-xl uppercase`}>
            {modoLectura ? 'DETALLE' : (modoEdicion ? 'EDITAR' : 'NUEVO')}
          </h2>
          <button onClick={() => cancelarPunto ? cancelarPunto() : setVista('mapa')} className={`${theme.text} hover:opacity-70 p-2 rounded-full`}>
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>

          {/* 2. INPUTS SUPERIORES: 2 filas de 3 */}
          <div className="flex flex-col gap-2 mb-4">

            {/* FILA 1: ITEM, COD POSTE, PASIVO */}
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="ITEM"
                value={datosFormulario.numero || ''}
                onChange={v => setDatosFormulario(prev => ({ ...prev, numero: v.target.value }))}
                disabled={modoLectura}
                className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}
              />
              <input
                type="text"
                placeholder="COD POSTE"
                value={datosFormulario.codigo || ''}
                onChange={v => setDatosFormulario(prev => ({ ...prev, codigo: v.target.value }))}
                disabled={modoLectura}
                className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}
              />
              <input
                type="text"
                placeholder="PASIVO"
                value={datosFormulario.pasivo || ''}
                onChange={v => setDatosFormulario(prev => ({ ...prev, pasivo: v.target.value }))}
                disabled={modoLectura}
                className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}
              />
            </div>

            {/* FILA 2: SUMINISTRO, ABS IN, ABS OUT */}
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="SUMINISTRO"
                value={datosFormulario.suministro || ''}
                onChange={v => setDatosFormulario(prev => ({ ...prev, suministro: v.target.value }))}
                disabled={modoLectura}
                className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}
              />
              <input
                type="text"
                placeholder="ABS INI"
                value={datosFormulario.absIn || ''}
                onChange={v => setDatosFormulario(prev => ({ ...prev, absIn: v.target.value }))}
                disabled={modoLectura}
                className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}
              />
              <input
                type="text"
                placeholder="ABS FINAL"
                value={datosFormulario.absOut || ''}
                onChange={v => setDatosFormulario(prev => ({ ...prev, absOut: v.target.value }))}
                disabled={modoLectura}
                className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}
              />
            </div>

          </div>
          {/* FOTOS: Se muestran, pero en modo lectura no deberías poder borrar (lógica aparte) */}
          {/* FOTOS GENERALES (Cámara inferior) */}
          {datosFormulario.fotosGenerales?.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
              {datosFormulario.fotosGenerales.map((f, i) => {
                // Soporte híbrido: string (legacy base64) o objeto nuevo { thumb, url }
                const src = typeof f === 'string' ? f : (f.thumb || f.url);
                return (
                  <img key={i} src={src} className={`w-20 h-20 rounded-lg object-cover border-2 ${theme.border} shadow-md`} />
                );
              })}
            </div>
          )}

          {/* Spinner de Subida */}
          {subiendoFoto && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 text-blue-500 rounded-lg mb-2 border border-blue-500/30 animate-pulse">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-bold">Subiendo foto optimizada...</span>
            </div>
          )}

          {/* BLOQUES: Conectados correctamente con config, theme y datos */}
          {proyectoActual?.tipo === 'levantamiento' ? (
            <>
              <BloqueLevantamiento
                config={config}
                datosFormulario={datosFormulario}
                setDatosFormulario={setDatosFormulario}
                theme={theme}
                disabled={modoLectura}
              />
            </>
          ) : (
            <>
              <BloqueLiquidacion
                config={config}
                datosFormulario={datosFormulario}
                setDatosFormulario={setDatosFormulario}
                theme={theme}
                disabled={modoLectura}
              />
              <div className={`my-6 border-t-2 ${theme.border}`}></div>
              <BloqueLevantamiento
                config={config}
                datosFormulario={datosFormulario}
                setDatosFormulario={setDatosFormulario}
                theme={theme}
                disabled={modoLectura}
              />
            </>
          )}
          {/* 3. OBSERVACIONES: Bloqueado */}
          <div className="mt-8">
            <h3 className={`text-xs font-black ${theme.text} mb-2 ml-1 uppercase`}>OBSERVACIONES</h3>
            <textarea
              value={datosFormulario.observaciones}
              onChange={e => setDatosFormulario({ ...datosFormulario, observaciones: e.target.value })}
              placeholder="Notas..."
              disabled={modoLectura}
              className={`w-full h-24 ${theme.input} border-2 ${theme.border} rounded-xl p-4 ${theme.text} text-lg focus:border-brand-500 focus:outline-none disabled:opacity-50`}
            />
          </div>
        </div>

        {/* 4. BARRA INFERIOR: Solo se muestra si NO estamos en modo lectura */}
        {!modoLectura && (
          <div className={`${theme.bottomBar} p-3 border-t-2 flex gap-3 shrink-0 absolute bottom-0 w-full z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]`}>
            <button onClick={guardarPunto} disabled={subiendoFoto} className="flex-1 bg-green-600 text-white h-14 rounded-xl font-bold text-xl shadow-xl active:scale-95 flex items-center justify-center gap-2 border-b-4 border-green-800 active:border-b-0 active:mt-1 transition-all disabled:opacity-50 disabled:active:scale-100">
              <Save size={24} /> {modoEdicion ? 'ACTUALIZAR' : 'GUARDAR'}
            </button>
            <button
              onClick={() => {
                setPhotoTab('poste');
                setModalOpen('MODO_FOTOS');
              }}
              disabled={subiendoFoto}
              className={`w-20 h-14 ${theme.input} rounded-xl border-2 ${theme.border} flex flex-col items-center justify-center text-brand-500 active:scale-95 disabled:opacity-50`}
            >
              <Camera size={28} />
            </button>
            <input type="file" ref={inputCamaraRef} accept="image/*" capture="environment" className="hidden" onChange={procesarFoto} />
          </div>
        )}
      </div>

    </>
  );
}


// 1. BLOQUE LEVANTAMIENTO
const BloqueLevantamiento = ({ config, datosFormulario, setDatosFormulario, theme, disabled }) => {
  const toggle = (v) => {
    if (disabled) return;
    const exists = datosFormulario.extrasSeleccionados.includes(v);
    const nuevos = exists
      ? datosFormulario.extrasSeleccionados.filter(x => x !== v)
      : [...datosFormulario.extrasSeleccionados, v];
    setDatosFormulario(prev => ({ ...prev, extrasSeleccionados: nuevos }));
  };

  // Orden: familia-4 primero, familia-5, familia-3
  const allSections = [
    { key: 'material', titulo: 'MATERIAL DEL POSTE', cols: 4, opciones: config.botonesPoste.materiales, seleccion: datosFormulario.material, onSelect: v => setDatosFormulario(prev => ({ ...prev, material: v })), type: 'single' },
    { key: 'tipo',     titulo: 'TIPO DE RED',         cols: 4, opciones: config.botonesPoste.tipos,      seleccion: datosFormulario.tipo,      onSelect: v => setDatosFormulario(prev => ({ ...prev, tipo: v })),     type: 'single' },
    { key: 'fuerza',   titulo: 'FUERZA (kg)',          cols: 4, opciones: config.botonesPoste.fuerzas,    seleccion: datosFormulario.fuerza,    onSelect: v => setDatosFormulario(prev => ({ ...prev, fuerza: v })),   type: 'single' },
    { key: 'altura',   titulo: 'ALTURA (m)',            cols: 5, opciones: config.botonesPoste.alturas,   seleccion: datosFormulario.altura,    onSelect: v => setDatosFormulario(prev => ({ ...prev, altura: v })),   type: 'single' },
    { key: 'cables',   titulo: 'CANTIDAD DE CABLES',   cols: 5, opciones: config.botonesPoste.cables,    seleccion: datosFormulario.cables,    onSelect: v => setDatosFormulario(prev => ({ ...prev, cables: v })),   type: 'single' },
    { key: 'extras',   titulo: 'EXTRAS',               cols: 3, opciones: config.botonesPoste.extras,    seleccion: datosFormulario.extrasSeleccionados, onToggle: toggle, type: 'multi' },
  ];

  // Filtrar vacías y añadir vc (visible count)
  const sections = allSections
    .map(s => ({ ...s, vc: s.opciones.filter(o => o.visible).length }))
    .filter(s => s.vc > 0);

  // Agrupar secciones consecutivas de la misma familia (cols) cuando son "pequeñas" (vc < cols)
  const groups = [];
  let i = 0;
  while (i < sections.length) {
    const cur = sections[i];
    if (cur.vc < cur.cols) {
      const group = [cur];
      let j = i + 1;
      while (j < sections.length && sections[j].cols === cur.cols && sections[j].vc < sections[j].cols) {
        group.push(sections[j]);
        j++;
      }
      groups.push(group);
      i = j;
    } else {
      groups.push([cur]);
      i++;
    }
  }

  const renderSection = (s, inRow = false) => {
    // En fila compartida: máx 2 cols internos para mantener botones tapeables
    const innerCols = inRow ? Math.min(s.vc, 2) : s.cols;
    const textSize  = inRow ? 'text-sm' : 'text-lg';
    return s.type === 'single'
      ? <SelectorGrid      titulo={s.titulo} cols={innerCols} opciones={s.opciones} seleccion={s.seleccion}  onSelect={s.onSelect}  theme={theme} textSize={textSize} />
      : <SelectorGridMulti titulo={s.titulo} cols={innerCols} opciones={s.opciones} seleccion={s.seleccion}  onToggle={s.onToggle} theme={theme} />;
  };

  return (
    <div className={`space-y-3 animate-in fade-in py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {groups.map((group, gi) => {
        if (group.length === 1) {
          return <div key={group[0].key}>{renderSection(group[0])}</div>;
        }

        // Fila compartida: span proporcional a min(vc, 2) por sección
        const spans      = group.map(s => Math.min(s.vc, 2));
        const totalSpan  = spans.reduce((a, b) => a + b, 0);

        return (
          <div
            key={gi}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${totalSpan}, minmax(0, 1fr))` }}
          >
            {group.map((s, si) => (
              <div
                key={s.key}
                className="rounded-xl border-2 border-slate-200 p-2.5"
                style={{ gridColumn: `span ${spans[si]}` }}
              >
                {renderSection(s, true)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// 2. BLOQUE LIQUIDACIÓN
const BloqueLiquidacion = ({ config, datosFormulario, setDatosFormulario, theme, disabled }) => {
  return (
    <div className={`space-y-4 animate-in fade-in py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Armados (SELECCIÓN ÚNICA) */}
      <div>
        <h3 className={`text-xs font-black ${theme.text} opacity-70 uppercase mb-2 ml-1`}>ARMADOS</h3>
        <div className="grid grid-cols-3 gap-2">
          {config.armados.filter(a => a.visible !== false).map(armado => {
            const listaSegura = datosFormulario.armadosSeleccionados || [];
            const isSelected = listaSegura.some(a => a.id === armado.id);

            return (
              <button
                key={armado.id}
                onClick={() => {
                  if (disabled) return;
                  // SELECCIÓN ÚNICA: Si ya está seleccionado, deseleccionar. Si no, seleccionar solo este.
                  const currentList = datosFormulario.armadosSeleccionados || [];
                  const exists = currentList.some(a => a.id === armado.id);

                  const nuevos = exists
                    ? [] // Deseleccionar
                    : [{ id: armado.id, nombre: armado.nombre, items: armado.items }]; // Solo este

                  setDatosFormulario(prev => ({ ...prev, armadosSeleccionados: nuevos }));
                }}
                className={`h-12 px-1 rounded-xl text-[13px] font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${isSelected ? theme.gridBtnActive : theme.gridBtn}`}
              >
                <span className="scale-110 block">{armado.nombre}</span>
              </button>
            )
          })}
        </div>
      </div>

      <ListaContadores
        config={config}
        datos={datosFormulario.ferreteriaExtra || {}}
        setDatos={(nuevos) => setDatosFormulario(prev => ({ ...prev, ferreteriaExtra: nuevos }))}
        theme={theme}
        disabled={disabled}
        armadoSeleccionado={datosFormulario.armadosSeleccionados || []}
      />
    </div>
  );
}