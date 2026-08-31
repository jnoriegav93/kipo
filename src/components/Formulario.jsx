import React, { useRef } from 'react';
import { X, Save, Camera , Settings } from 'lucide-react';
import { equiposDePunto, sincronizarEquipos, LABEL_EQUIPO } from '../utils/equiposPasivos';
import { ThemedInput } from './UI';
import { SelectorGrid, SelectorGridMulti, ListaContadores } from './Selectores';

export default function Formulario({
  theme,
  isDesktop = false,
  perfilActivo = 'claro',
  tipoProyecto = 'liquidacion',
  datosFormulario,
  setDatosFormulario,
  config,
  proyectoActual,
  modoLectura,
  modoEdicion,
  setVista,
  guardarPunto,
  cancelarPunto,
  intentarCancelar,
  onAbrirConfigDatos,
  setModalOpen,
  setAlertData,
  inputCamaraRef,
  setPhotoTab
}) {
  const [subiendoFoto, setSubiendoFoto] = React.useState(false);

  // Nota: ya NO se bloquea GUARDAR ni la cámara por "fotos subiendo". El sistema de
  // pendientes + cola de recuperación garantiza que nada se pierda, así que bloquear
  // (esperando al servidor) era contraproducente offline. Se puede guardar y ver
  // fotos en cualquier momento; lo pendiente se sube solo al reconectar.

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
    // Hora real de captura (file.lastModified). Fallback: ahora.
    const capDate = file.lastModified ? new Date(file.lastModified) : new Date();
    const fechaCaptura = capDate.toISOString();
    const horaCaptura = capDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false });
    const coordsPunto = datosFormulario?.coords;
    const datosExif = {
      fecha: fechaCaptura,
      hora: horaCaptura,
      gps: coordsPunto ? `${coordsPunto.lat?.toFixed(6)}, ${coordsPunto.lng?.toFixed(6)}` : '',
      numero: datosFormulario?.numero || '',
      proyecto: proyectoActual?.nombre || '',
    };
    try {
      setSubiendoFoto(true);
      const { fullBlob, thumbBase64 } = await import('../utils/helpers').then(m => m.procesarImagenInput(file));
      // Mostrar thumb inmediatamente
      setDatosFormulario(prev => ({
        ...prev,
        fotosGenerales: [...(prev.fotosGenerales || []), { _tempId: tempId, thumb: thumbBase64, uploading: true, timestamp: new Date().toISOString(), fechaCaptura, horaCaptura }]
      }));
      const path = `proyectos/${proyectoActual?.id || 'temp'}/fotos/${Date.now()}.jpg`;
      const { inyectarEXIFenBlob } = await import('../utils/exif');
      const blobToUpload = await inyectarEXIFenBlob(altaCalidad ? file : fullBlob, datosExif);
      const urlDescarga = await import('../utils/storage').then(m => m.uploadImage(blobToUpload, path));
      setDatosFormulario(prev => ({
        ...prev,
        fotosGenerales: (prev.fotosGenerales || []).map(f =>
          f._tempId === tempId ? { ...f, url: urlDescarga, uploading: false, fechaCaptura, horaCaptura } : f
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

  // ── Detección de cambios: snapshot del punto al abrir ──
  // La X se DESACTIVA (no se oculta): en EDICIÓN cuando hay cualquier cambio;
  // en punto NUEVO cuando ya se tomó al menos una foto. En lectura siempre activa.
  const snapInicialRef = useRef(null);
  React.useEffect(() => {
    snapInicialRef.current = JSON.stringify(datosFormulario || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const hayCambios = React.useMemo(() => {
    if (snapInicialRef.current == null) return false;
    try { return JSON.stringify(datosFormulario || {}) !== snapInicialRef.current; } catch { return true; }
  }, [datosFormulario]);
  const xDeshabilitada = !modoLectura && (modoEdicion
    ? hayCambios
    : puntoTieneFotos(datosFormulario?.fotos));

  return (
    <>
      <div className={`fixed z-[200] ${theme.bg} flex flex-col animate-in duration-200 ${isDesktop ? `inset-y-0 right-0 w-[460px] max-w-[92vw] shadow-2xl border-l-2 ${theme.border} slide-in-from-right` : 'inset-0 slide-in-from-bottom'}`}>

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

          {/* Configuración (negro) + Cerrar (rojo) — mismo tamaño, juntos a la derecha */}
          <div className="flex items-center gap-1.5 ml-auto shrink-0">
            {tipoProyecto === 'levantamiento' && onAbrirConfigDatos && (
              <button onClick={onAbrirConfigDatos} title="Configurar botones del formulario"
                className={`hover:opacity-70 p-2 rounded-xl border-2 ${theme.border} shrink-0 ${theme.text}`}>
                <Settings size={26} className={theme.text} />
              </button>
            )}
            <button
              onClick={() => intentarCancelar ? intentarCancelar() : (cancelarPunto ? cancelarPunto() : setVista('mapa'))}
              disabled={xDeshabilitada}
              title={xDeshabilitada ? (modoEdicion ? 'Hay cambios: usa ACTUALIZAR' : 'Ya hay fotos: usa GUARDAR PUNTO') : 'Cerrar'}
              className="hover:opacity-70 p-2 rounded-xl border-2 border-red-500 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
              <X size={26} className="text-red-600" />
            </button>
          </div>
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
            <InputsDatos datos={datosFormulario} setDatos={setDatosFormulario} theme={theme} disabled={modoLectura} tipoProyecto={tipoProyecto} />

            <GrupoPropietario datos={datosFormulario} setDatos={setDatosFormulario} theme={theme} disabled={modoLectura} setAlertData={setAlertData} />

            {/* EQ. PASIVO: exclusivo de los tipos de red (LEVANTAMIENTO no lleva) */}
            {tipoProyecto !== 'levantamiento' && (
              <GrupoElemento datos={datosFormulario} setDatos={setDatosFormulario} theme={theme} disabled={modoLectura} tipoProyecto={tipoProyecto} setAlertData={setAlertData} />
            )}

            <BloqueLevantamiento
              config={config}
              datosFormulario={datosFormulario}
              setDatosFormulario={setDatosFormulario}
              theme={theme}
              disabled={modoLectura}
              sinTipoPoste
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
            <button onClick={() => guardarPunto()} className="flex-1 bg-green-600 text-white h-14 rounded-xl font-bold text-xl shadow-xl active:scale-95 flex items-center justify-center gap-2 border-b-4 border-green-800 active:border-b-0 active:mt-1 transition-all">
              {modoEdicion ? 'ACTUALIZAR' : 'GUARDAR PUNTO'}
            </button>
            <button
              onClick={() => { setPhotoTab('poste'); setModalOpen('MODO_FOTOS'); }}
              className={`w-20 h-14 ${theme.input} rounded-xl border-2 ${theme.border} flex flex-col items-center justify-center text-brand-500 active:scale-95`}
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


// ── INPUTS DE DATOS (por perfil) — reutilizable (formulario y revisión) ────────
export const InputsDatos = ({ datos, setDatos, theme, disabled = false, tipoProyecto = 'liquidacion' }) => {
  const inputCls = `w-full ${theme.input} border-2 ${theme.border} rounded-xl px-3 py-2 ${theme.text} text-sm font-bold focus:border-brand-500 focus:outline-none disabled:opacity-50`;
  const inp = (campo, ph, extra = '') => (
    <input type="text" placeholder={ph} value={datos[campo] || ''} onChange={v => setDatos(prev => ({ ...prev, [campo]: v.target.value.toUpperCase() }))} disabled={disabled} className={`${inputCls} ${extra}`} />
  );
  // Una fila por equipo pasivo marcado: NOMBRE + su código de pasivo + su código de serie.
  // Los campos sueltos datos.pasivo/codigoSerie se mantienen concatenados (compatibilidad).
  const equipos = equiposDePunto(datos);
  const setEquipo = (tipo, campo, valor) => {
    setDatos(prev => {
      const lista = equiposDePunto(prev).map(e => e.tipo === tipo ? { ...e, [campo]: valor.toUpperCase() } : e);
      return sincronizarEquipos({ ...prev, equipos: lista });
    });
  };
  return (
    <div className="flex flex-col gap-2 mb-4">
      {tipoProyecto !== 'levantamiento' ? (
        <>
          <div className="grid grid-cols-3 gap-2">{inp('numero', 'ITEM')}{inp('codigo', 'COD POSTE', 'col-span-2')}</div>
          {equipos.map(e => (
            <div key={e.tipo} className="grid grid-cols-3 gap-2">
              {/* El tipo de equipo va DENTRO del input, como placeholder */}
              <input type="text" placeholder={LABEL_EQUIPO[e.tipo] || e.tipo} value={e.pasivo || ''} disabled={disabled}
                onChange={v => setEquipo(e.tipo, 'pasivo', v.target.value)}
                className={inputCls} />
              <input type="text" placeholder="CODIGO DE SERIE" value={e.codigoSerie || ''} disabled={disabled}
                onChange={v => setEquipo(e.tipo, 'codigoSerie', v.target.value)}
                className={`${inputCls} col-span-2`} />
            </div>
          ))}
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2">{inp('numero', 'ITEM')}{inp('codigo', 'COD POSTE')}{inp('suministro', 'SUMINISTRO')}</div>
      )}
    </div>
  );
};

// ¿El punto tiene AL MENOS UNA foto en cualquier sección? (con fotos, la X se oculta
// para obligar a guardar el punto)
const puntoTieneFotos = (fotos) => {
  if (!fotos || typeof fotos !== 'object') return false;
  return Object.keys(fotos).some(sec => seccionConFotos(fotos, sec));
};

// ¿La sección de fotos del punto tiene al menos una? (bloquea desmarcar en el formulario)
const seccionConFotos = (fotos, secId) => {
  const sec = fotos?.[secId];
  if (!sec || typeof sec !== 'object') return false;
  const hay = (v) => {
    if (!v) return false;
    if (typeof v === 'string') return true;
    if (Array.isArray(v)) return v.some(hay);
    if (typeof v === 'object') return !!(v.url || v.thumb) || Object.values(v).some(hay);
    return false;
  };
  return Object.values(sec).some(hay);
};
const SECCION_DE_ELEMENTO = { fat: 'fatPrecoNueva', nap: 'napMec', mufa: 'mufaTroncal', xbox: 'xbox', hbox: 'hbox', camara: 'camara', medioTramo: 'medioTramo' };

// ── GRUPO PROPIETARIO (antes TIPO DE POSTE) — single-select, reutilizable ──────
export const GrupoPropietario = ({ datos, setDatos, theme, disabled = false, setAlertData }) => {
  const aviso = (message) => setAlertData ? setAlertData({ title: 'Sección con fotos', message }) : alert(message);
  const opts = [
    { v: 'Tercero', label: 'EMP. TELECO' },
    { v: 'Eléctrico', label: 'EMP. ELECTRICA' },
    { v: 'Propio', label: 'PROPIO' },
  ];
  const sel = datos.tipoPoste || null;
  const setSel = (v) => {
    if (disabled) return;
    setDatos(prev => {
      // Cambiar de propietario es libre; QUITARLO del todo no si POSTE ya tiene fotos
      if (prev.tipoPoste === v && seccionConFotos(prev.fotos, 'poste')) {
        aviso('La sección POSTE contiene fotos, no se puede desmarcar el propietario (sí puedes cambiarlo por otro).');
        return prev;
      }
      // Seleccionar un propietario con MEDIO TRAMO activo: el tramo se desmarca (simétrico),
      // salvo que el tramo tenga fotos.
      const arr = Array.isArray(prev.tipoElemento) ? prev.tipoElemento : (prev.tipoElemento ? [prev.tipoElemento] : []);
      if (prev.tipoPoste !== v && arr.includes('medioTramo')) {
        if (seccionConFotos(prev.fotos, 'medioTramo')) {
          aviso('MEDIO TRAMO contiene fotos, no se puede desmarcar.');
          return prev;
        }
        return { ...prev, tipoPoste: v, tipoElemento: arr.filter(x => x !== 'medioTramo') };
      }
      return { ...prev, tipoPoste: prev.tipoPoste === v ? null : v };
    });
  };
  return (
    <div className="mb-3">
      <h3 className={`text-xs font-black ${theme.text} mb-2 uppercase tracking-wider text-center`}>PROPIETARIO</h3>
      <div className="grid grid-cols-3 gap-2">
        {opts.map(op => {
          const activo = sel === op.v;
          return (
            <button key={op.v} onClick={() => setSel(op.v)} disabled={disabled}
              className={`h-12 rounded-lg text-[13px] font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center disabled:opacity-50 ${activo ? 'bg-orange-500 text-white border-orange-600 shadow-md' : `border-orange-500 ${theme.text}`}`}>
              <span className="px-1 break-words leading-tight">{op.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── GRUPO EQ. PASIVO / PUNTO (NO POSTE) — multi-select (MEDIO TRAMO exclusivo), por perfil ──
export const GrupoElemento = ({ datos, setDatos, theme, disabled = false, tipoProyecto = 'liquidacion', setAlertData }) => {
  const aviso = (message) => setAlertData ? setAlertData({ title: 'Sección con fotos', message }) : alert(message);
  const naranja = { activo: 'bg-orange-500 text-white border-orange-600 shadow-md', inactivo: `border-orange-500 ${theme.text}` };
  const azul = { activo: 'bg-blue-500 text-white border-blue-600 shadow-md', inactivo: `border-blue-500 ${theme.text}` };
  const filasPreco = [
    [{ v: 'mufa', label: 'MUFA', c: naranja }, { v: 'xbox', label: 'XBOX', c: naranja }, { v: 'hbox', label: 'HBOX', c: naranja }, { v: 'fat', label: 'FAT', c: naranja }],
    [{ v: 'camara', label: 'CAMARA', c: azul }, { v: 'medioTramo', label: 'MEDIO TRAMO', c: azul }],
  ];
  // BALANCEADA = preco + NAP (elemento propio 'nap' → sección de fotos NAP/napMec)
  const filas = tipoProyecto === 'balanceada'
    ? [filasPreco[0], [...filasPreco[1], { v: 'nap', label: 'NAP', c: naranja }]]
    : filasPreco;
  const raw = datos.tipoElemento;
  const sel = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const setSel = (v) => {
    if (disabled) return;
    setDatos(prev => {
      let arr = Array.isArray(prev.tipoElemento) ? [...prev.tipoElemento] : (prev.tipoElemento ? [prev.tipoElemento] : []);
      const conFotos = (x) => seccionConFotos(prev.fotos, SECCION_DE_ELEMENTO[x]);
      // Desmarcar un elemento cuya sección de fotos ya tiene fotos: BLOQUEADO
      if (arr.includes(v) && conFotos(v)) {
        aviso('Este equipo pasivo contiene fotos, no se puede desmarcar.');
        return prev;
      }
      if (v === 'medioTramo') {
        const activar = !arr.includes('medioTramo');
        if (activar) {
          const bloqueado = arr.find(x => x !== 'medioTramo' && conFotos(x));
          if (bloqueado) { aviso('Hay un equipo pasivo con fotos seleccionado, no se puede cambiar a MEDIO TRAMO.'); return prev; }
          if (seccionConFotos(prev.fotos, 'poste')) { aviso('La sección POSTE contiene fotos, no se puede cambiar a MEDIO TRAMO.'); return prev; }
        }
        arr = activar ? ['medioTramo'] : [];
        // Al marcar MEDIO TRAMO se deselecciona el PROPIETARIO y los campos de poste (no aplican al tramo).
        if (activar) return sincronizarEquipos({ ...prev, tipoElemento: arr, tipoPoste: null, material: null, tipo: null, fuerza: null, altura: null, cables: null });
        return sincronizarEquipos({ ...prev, tipoElemento: arr });
      }
      // Seleccionar otro elemento quita MEDIO TRAMO: bloqueado si el tramo tiene fotos
      if (arr.includes('medioTramo') && conFotos('medioTramo')) {
        aviso('MEDIO TRAMO contiene fotos, no se puede desmarcar.');
        return prev;
      }
      arr = arr.filter(x => x !== 'medioTramo'); arr = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
      // Recalcular la lista de equipos (y los campos sueltos concatenados)
      return sincronizarEquipos({ ...prev, tipoElemento: arr });
    });
  };
  return (
    <div className="mb-1">
      <h3 className={`text-xs font-black ${theme.text} mb-2 uppercase tracking-wider text-center`}>EQ. PASIVO O PUNTO (NO POSTE)</h3>
      <div className="flex flex-col gap-2">
        {filas.map((fila, fi) => (
          <div key={fi} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${fila.length}, 1fr)` }}>
            {fila.map(op => {
              const activo = sel.includes(op.v);
              return (
                <button key={op.label} onClick={() => setSel(op.v)} disabled={disabled}
                  className={`h-12 rounded-lg text-[13px] font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center disabled:opacity-50 ${activo ? op.c.activo : op.c.inactivo}`}>
                  <span className="px-1 break-words leading-tight">{op.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};


// 1. BLOQUE LEVANTAMIENTO
export const BloqueLevantamiento = ({ config, datosFormulario, setDatosFormulario, theme, disabled, sinTipoPoste = false }) => {
  const toggle = (v) => {
    if (disabled) return;
    const exists = datosFormulario.extrasSeleccionados.includes(v);
    const nuevos = exists
      ? datosFormulario.extrasSeleccionados.filter(x => x !== v)
      : [...datosFormulario.extrasSeleccionados, v];
    setDatosFormulario(prev => ({ ...prev, extrasSeleccionados: nuevos }));
  };

  // Opciones fijas (no configurables: no se apagan, no se agregan ni eliminan)
  const TIPO_POSTE_OPCIONES = [
    { v: 'Tercero', visible: true },
    { v: 'Eléctrico', visible: true },
    { v: 'Propio', visible: true },
  ];

  const sections = [
    { key: 'tipoPoste', titulo: 'TIPO DE POSTE',       cols: 3, opciones: TIPO_POSTE_OPCIONES,           seleccion: datosFormulario.tipoPoste, onSelect: v => setDatosFormulario(prev => ({ ...prev, tipoPoste: v })), type: 'single', borderAccent: '!border-orange-500', activeClass: 'bg-orange-500 text-white border-orange-600 shadow-md' },
    { key: 'material', titulo: 'MATERIAL DEL POSTE',   cols: 4, opciones: config.botonesPoste.materiales, seleccion: datosFormulario.material, onSelect: v => setDatosFormulario(prev => ({ ...prev, material: v })), type: 'single' },
    { key: 'tipo',     titulo: 'TIPO DE RED',           cols: 4, opciones: config.botonesPoste.tipos,      seleccion: datosFormulario.tipo,      onSelect: v => setDatosFormulario(prev => ({ ...prev, tipo: v })),     type: 'single' },
    { key: 'fuerza',   titulo: 'FUERZA ESTRUCTURAL',    cols: 4, opciones: config.botonesPoste.fuerzas,    seleccion: datosFormulario.fuerza,    onSelect: v => setDatosFormulario(prev => ({ ...prev, fuerza: v })),   type: 'single' },
    { key: 'altura',   titulo: 'ALTURA DEL POSTE',      cols: 5, opciones: config.botonesPoste.alturas,    seleccion: datosFormulario.altura,    onSelect: v => setDatosFormulario(prev => ({ ...prev, altura: v })),   type: 'single' },
    { key: 'cables',   titulo: 'CANTIDAD DE CABLES',    cols: 5, opciones: config.botonesPoste.cables,     seleccion: datosFormulario.cables,    onSelect: v => setDatosFormulario(prev => ({ ...prev, cables: v })),   type: 'single' },
    { key: 'extras',   titulo: 'EXTRAS',                cols: 3, opciones: config.botonesPoste.extras,     seleccion: datosFormulario.extrasSeleccionados, onToggle: toggle, type: 'multi' },
  ].filter(s => s.opciones.filter(o => o.visible).length > 0 && !(sinTipoPoste && s.key === 'tipoPoste'));

  return (
    <div className={`space-y-3 animate-in fade-in py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {sections.map(s =>
        s.type === 'single'
          ? <SelectorGrid      key={s.key} titulo={s.titulo} cols={s.cols} opciones={s.opciones} seleccion={s.seleccion} onSelect={s.onSelect}  theme={theme} borderAccent={s.borderAccent || ''} activeClass={s.activeClass || ''} />
          : <SelectorGridMulti key={s.key} titulo={s.titulo} cols={s.cols} opciones={s.opciones} seleccion={s.seleccion} onToggle={s.onToggle} theme={theme} />
      )}
    </div>
  );
};

// 2. BLOQUE LIQUIDACIÓN
export const BloqueLiquidacion = ({ config, datosFormulario, setDatosFormulario, theme, disabled, subirConValor }) => {
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
        subirConValor={subirConValor}
      />
    </div>
  );
};
