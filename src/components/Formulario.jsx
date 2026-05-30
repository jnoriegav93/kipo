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
  const [subiendoFoto, setSubiendoFoto] = React.useState(false);

  const hayFotosSubiendo = React.useMemo(() => {
    const fotos = datosFormulario?.fotos;
    if (!fotos || typeof fotos !== 'object') return false;
    return Object.values(fotos).some(section =>
      section && typeof section === 'object' &&
      Object.values(section).some(v => v?.uploading === true)
    );
  }, [datosFormulario?.fotos]);

  const bloqueadoPorFotos = subiendoFoto || hayFotosSubiendo;

  // Hay pestaña de ferretería solo en proyectos de liquidación
  const hasFerreteriaTab = proyectoActual?.tipo !== 'levantamiento';

  // Siempre abre en datos
  const [tabActiva, setTabActiva] = React.useState('datos');

  // Swipe: izquierda → ferretería (tab derecho), derecha → datos (tab izquierdo)
  const touchStartX = useRef(null);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null || !hasFerreteriaTab) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) {
      setTabActiva(dx < 0 ? 'ferreteria' : 'datos');
    }
    touchStartX.current = null;
  };

  const procesarFoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const tempId = `tmp_${Date.now()}`;
    const altaCalidad = proyectoActual?.modoFotos === 'altaCalidad';
    try {
      setSubiendoFoto(true);
      const { fullBlob, thumbBase64 } = await import('../utils/helpers').then(m => m.procesarImagenInput(file));
      // Mostrar thumb inmediatamente
      setDatosFormulario(prev => ({
        ...prev,
        fotosGenerales: [...(prev.fotosGenerales || []), { _tempId: tempId, thumb: thumbBase64, uploading: true, timestamp: new Date().toISOString() }]
      }));
      const path = `proyectos/${proyectoActual?.id || 'temp'}/fotos/${Date.now()}.jpg`;
      const blobToUpload = altaCalidad ? file : fullBlob;
      const urlDescarga = await import('../utils/storage').then(m => m.uploadImage(blobToUpload, path));
      setDatosFormulario(prev => ({
        ...prev,
        fotosGenerales: (prev.fotosGenerales || []).map(f =>
          f._tempId === tempId ? { ...f, url: urlDescarga, uploading: false } : f
        )
      }));
    } catch (error) {
      console.error("Error subiendo foto:", error);
      setDatosFormulario(prev => ({
        ...prev,
        fotosGenerales: (prev.fotosGenerales || []).filter(f => f._tempId !== tempId)
      }));
      alert("Error al subir la foto. Verifique su conexión.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  return (
    <>
      <div className={`fixed inset-0 z-[200] ${theme.bg} flex flex-col animate-in slide-in-from-bottom duration-200`}>

        {/* HEADER */}
        <div className={`${theme.header} border-b-2 ${theme.border} px-4 flex items-center justify-between gap-2 shadow-lg shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
          {/* Título */}
          <h2 className={`font-black ${theme.text} text-xl uppercase shrink-0`}>
            {modoLectura ? 'DETALLE' : (modoEdicion ? 'EDITAR' : 'NUEVO')}
          </h2>

          {/* Pestañas — solo si hay ferretería */}
          {hasFerreteriaTab && (
            <div className={`flex flex-1 max-w-[200px] rounded-xl overflow-hidden border-2 ${theme.border} mx-2`}>
              <button
                onClick={() => setTabActiva('datos')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase transition-all ${
                  tabActiva === 'datos'
                    ? 'bg-slate-900 text-white'
                    : `${theme.bg} ${theme.text} opacity-50`
                }`}
              >
                Datos
              </button>
              <button
                onClick={() => setTabActiva('ferreteria')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase transition-all border-l ${theme.border} ${
                  tabActiva === 'ferreteria'
                    ? 'bg-slate-900 text-white'
                    : `${theme.bg} ${theme.text} opacity-50`
                }`}
              >
                Ferretería
              </button>
            </div>
          )}

          {/* Cerrar */}
          <button onClick={() => cancelarPunto ? cancelarPunto() : setVista('mapa')} className={`${theme.text} hover:opacity-70 p-2 rounded-xl border-2 ${theme.border} shrink-0`}>
            <X size={28} />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto overflow-x-hidden p-3"
          style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Fotos generales */}
          {datosFormulario.fotosGenerales?.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
              {datosFormulario.fotosGenerales.map((f, i) => {
                const src = typeof f === 'string' ? f : (f.thumb || f.url);
                const uploading = f?.uploading;
                return (
                  <div key={i} className="relative shrink-0">
                    <img src={src} className={`w-20 h-20 rounded-lg object-cover border-2 ${theme.border} shadow-md ${uploading ? 'opacity-60' : ''}`} />
                    {uploading && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/30"><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /></div>}
                  </div>
                );
              })}
            </div>
          )}

          {subiendoFoto && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 text-blue-500 rounded-lg mb-2 border border-blue-500/30 animate-pulse">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-bold">Subiendo foto optimizada...</span>
            </div>
          )}

          {/* CONTENIDO POR PESTAÑA */}
          {tabActiva === 'ferreteria' && hasFerreteriaTab && (
            <BloqueLiquidacion
              config={config}
              datosFormulario={datosFormulario}
              setDatosFormulario={setDatosFormulario}
              theme={theme}
              disabled={modoLectura}
            />
          )}

          {tabActiva === 'datos' && (
            <>
            <div className="flex flex-col gap-2 mb-4">
              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="ABS INI" value={datosFormulario.absIn || ''} onChange={v => setDatosFormulario(prev => ({ ...prev, absIn: v.target.value.toUpperCase() }))} disabled={modoLectura} className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}/>
                <input type="text" placeholder="COD POSTE" value={datosFormulario.codigo || ''} onChange={v => setDatosFormulario(prev => ({ ...prev, codigo: v.target.value.toUpperCase() }))} disabled={modoLectura} className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}/>
                <input type="text" placeholder="ITEM" value={datosFormulario.numero || ''} onChange={v => setDatosFormulario(prev => ({ ...prev, numero: v.target.value.toUpperCase() }))} disabled={modoLectura} className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}/>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" placeholder="ABS FINAL" value={datosFormulario.absOut || ''} onChange={v => setDatosFormulario(prev => ({ ...prev, absOut: v.target.value.toUpperCase() }))} disabled={modoLectura} className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}/>
                <input type="text" placeholder="SUMINISTRO" value={datosFormulario.suministro || ''} onChange={v => setDatosFormulario(prev => ({ ...prev, suministro: v.target.value.toUpperCase() }))} disabled={modoLectura} className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}/>
                <input type="text" placeholder="PASIVO" value={datosFormulario.pasivo || ''} onChange={v => setDatosFormulario(prev => ({ ...prev, pasivo: v.target.value.toUpperCase() }))} disabled={modoLectura} className={`w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`}/>
              </div>
            </div>
            <BloqueLevantamiento
              config={config}
              datosFormulario={datosFormulario}
              setDatosFormulario={setDatosFormulario}
              theme={theme}
              disabled={modoLectura}
            />
            </>
          )}

          {/* OBSERVACIONES — siempre visibles */}
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

        {/* BARRA INFERIOR */}
        {!modoLectura && (
          <div className={`${theme.bottomBar} p-3 border-t-2 flex gap-3 shrink-0 absolute bottom-0 w-full z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]`}>
            <button onClick={guardarPunto} disabled={bloqueadoPorFotos} className="flex-1 bg-green-600 text-white h-14 rounded-xl font-bold text-xl shadow-xl active:scale-95 flex items-center justify-center gap-2 border-b-4 border-green-800 active:border-b-0 active:mt-1 transition-all disabled:opacity-50 disabled:active:scale-100">
              {hayFotosSubiendo
                ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> SUBIENDO FOTOS...</>
                : <><Save size={24} /> {modoEdicion ? 'ACTUALIZAR' : 'GUARDAR'}</>
              }
            </button>
            <button
              onClick={() => { setPhotoTab('poste'); setModalOpen('MODO_FOTOS'); }}
              disabled={bloqueadoPorFotos}
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

  const sections = [
    { key: 'material', titulo: 'MATERIAL DEL POSTE',   cols: 4, opciones: config.botonesPoste.materiales, seleccion: datosFormulario.material, onSelect: v => setDatosFormulario(prev => ({ ...prev, material: v })), type: 'single' },
    { key: 'tipo',     titulo: 'TIPO DE RED',           cols: 4, opciones: config.botonesPoste.tipos,      seleccion: datosFormulario.tipo,      onSelect: v => setDatosFormulario(prev => ({ ...prev, tipo: v })),     type: 'single' },
    { key: 'fuerza',   titulo: 'FUERZA ESTRUCTURAL',    cols: 4, opciones: config.botonesPoste.fuerzas,    seleccion: datosFormulario.fuerza,    onSelect: v => setDatosFormulario(prev => ({ ...prev, fuerza: v })),   type: 'single' },
    { key: 'altura',   titulo: 'ALTURA DEL POSTE',      cols: 5, opciones: config.botonesPoste.alturas,    seleccion: datosFormulario.altura,    onSelect: v => setDatosFormulario(prev => ({ ...prev, altura: v })),   type: 'single' },
    { key: 'cables',   titulo: 'CANTIDAD DE CABLES',    cols: 5, opciones: config.botonesPoste.cables,     seleccion: datosFormulario.cables,    onSelect: v => setDatosFormulario(prev => ({ ...prev, cables: v })),   type: 'single' },
    { key: 'extras',   titulo: 'EXTRAS',                cols: 3, opciones: config.botonesPoste.extras,     seleccion: datosFormulario.extrasSeleccionados, onToggle: toggle, type: 'multi' },
  ].filter(s => s.opciones.filter(o => o.visible).length > 0);

  return (
    <div className={`space-y-3 animate-in fade-in py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {sections.map(s =>
        s.type === 'single'
          ? <SelectorGrid      key={s.key} titulo={s.titulo} cols={s.cols} opciones={s.opciones} seleccion={s.seleccion} onSelect={s.onSelect}  theme={theme} />
          : <SelectorGridMulti key={s.key} titulo={s.titulo} cols={s.cols} opciones={s.opciones} seleccion={s.seleccion} onToggle={s.onToggle} theme={theme} />
      )}
    </div>
  );
};

// 2. BLOQUE LIQUIDACIÓN
const BloqueLiquidacion = ({ config, datosFormulario, setDatosFormulario, theme, disabled }) => {
  const armadoSeleccionadoId = datosFormulario.armadoSeleccionadoId || null;
  const armadoObj = config.armados.find(a => a.id === armadoSeleccionadoId) || null;

  return (
    <div className={`space-y-4 animate-in fade-in py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {config.armados.filter(a => a.visible !== false).length > 0 && (
        <div>
          <h3 className={`text-xs font-black ${theme.text} opacity-70 uppercase mb-2 ml-1`}>ARMADOS</h3>
          <div className="grid grid-cols-3 gap-2">
            {config.armados.filter(a => a.visible !== false).map(armado => {
              const isSelected = armadoSeleccionadoId === armado.id;
              return (
                <button
                  key={armado.id}
                  onClick={() => {
                    if (disabled) return;
                    if (isSelected) {
                      setDatosFormulario(prev => ({ ...prev, armadoSeleccionadoId: null, ferreteriaFinal: {} }));
                    } else {
                      const ferreteriaFinal = {};
                      armado.items.forEach(item => { if (item.cant > 0) ferreteriaFinal[item.idRef] = item.cant; });
                      setDatosFormulario(prev => ({ ...prev, armadoSeleccionadoId: armado.id, ferreteriaFinal }));
                    }
                  }}
                  className={`h-12 px-1 rounded-xl text-[13px] font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${isSelected ? theme.gridBtnActive : theme.gridBtn}`}
                >
                  <span className="scale-110 block">{armado.nombre}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <ListaContadores
        config={config}
        datos={datosFormulario.ferreteriaFinal || {}}
        setDatos={(nuevos) => setDatosFormulario(prev => ({ ...prev, ferreteriaFinal: nuevos }))}
        theme={theme}
        disabled={disabled}
        armadoSeleccionado={armadoObj}
      />
    </div>
  );
};
