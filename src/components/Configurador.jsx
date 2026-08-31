import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Eye, EyeOff, Plus, Save, Edit3, Trash2, X, RotateCcw, Check } from 'lucide-react';
import { Modal, ThemedInput } from './UI';
import { DATA_INICIAL, FERRETERIA_BASE_DEFAULT, VINCULOS_FERRETERIA } from '../data/constantes';
import { useFerreteriaBase } from '../hooks/useFerreteriaBase';

// --- CONFIGURADOR (FINAL: Textos Blancos en Modo Oscuro) ---
export default function Configurador({ config, saveConfig, volver, modalState = {}, theme, tab, setTab, seccionAbierta, setSeccionAbierta, perfilActivo = 'avanzado' }) {
  const { modalOpen, setModalOpen, tempData, setTempData, setConfirmData, setAlertData } = modalState;
  // BÁSICO: armados y ferretería no aplican (su tipo levantamiento no los usa)
  const tabsVisibles = perfilActivo === 'basico' ? ['datos'] : ['armados', 'ferreteria', 'datos'];
  useEffect(() => {
    if (!tabsVisibles.includes(tab)) setTab('datos');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, perfilActivo]);
  const { ferreteriaBase } = useFerreteriaBase();
  const [ferrYaExiste, setFerrYaExiste] = useState(null); // nombre encontrado en el buscador
  const [buscaArmado, setBuscaArmado] = useState(''); // buscador dentro del armado

  // Importar / restaurar la lista base: pone TODOS los ítems de la base (con su MISMO id,
  // así no se rompe el vínculo con proyectos) y quita las que el usuario creó (id 'f_').
  const importarBase = () => {
    const base = (ferreteriaBase && ferreteriaBase.length) ? ferreteriaBase : FERRETERIA_BASE_DEFAULT;
    const creadasPropias = config.catalogoFerreteria.filter(f => String(f.id).startsWith('f_'));
    const ejecutar = () => {
      const nueva = base.map(b => ({ id: b.id, nombre: b.nombre, unidad: 'und', visible: true, codigo: b.codigo || '', detalle: b.detalle || '' }));
      saveConfig({ ...config, catalogoFerreteria: nueva });
      setAlertData?.({ title: 'Lista base cargada', message: `Se cargaron ${nueva.length} ferreterías de la base.`, theme });
    };
    if (creadasPropias.length > 0) {
      setConfirmData?.({
        title: 'Restaurar lista base',
        message: `Vas a volver a la lista base. Se ELIMINARÁN las ${creadasPropias.length} ferreterías que agregaste tú y perderán su vínculo con los proyectos. Las de la base se mantienen. ¿Continuar?`,
        actionText: 'RESTAURAR', theme,
        onConfirm: () => { setConfirmData(null); ejecutar(); },
      });
    } else {
      ejecutar();
    }
  };

  // Re-agrega a la lista del usuario una ferretería que está en la BASE pero él borró.
  // Usa su MISMO id (b..) + codigo/detalle, así vuelve tal cual la base. Va ARRIBA.
  const agregarDesdeBase = (b) => {
    const yaEsta = config.catalogoFerreteria.some(f => f.id === b.id || (f.nombre || '').toLowerCase() === (b.nombre || '').toLowerCase());
    if (yaEsta) return;
    const nuevo = { id: b.id, nombre: b.nombre, unidad: 'und', visible: true, codigo: b.codigo || '', detalle: b.detalle || '' };
    saveConfig({ ...config, catalogoFerreteria: [nuevo, ...config.catalogoFerreteria] });
    setModalOpen(null);
    setTempData({ ...tempData, nombre: '' });
  };

  // Botón "Agregar" del buscador: si el texto coincide EXACTO con una de la base (que no
  // tenés), la trae de la base; si no, la crea como nueva. Nada si ya la tenés.
  const agregarBuscado = () => {
    const q = (tempData.nombre || '').trim();
    if (!q) return;
    if (config.catalogoFerreteria.some(f => (f.nombre || '').toLowerCase() === q.toLowerCase())) return;
    const base = (ferreteriaBase && ferreteriaBase.length) ? ferreteriaBase : FERRETERIA_BASE_DEFAULT;
    const baseMatch = base.find(b => (b.nombre || '').toLowerCase() === q.toLowerCase() && !config.catalogoFerreteria.some(f => f.id === b.id));
    if (baseMatch) agregarDesdeBase(baseMatch);
    else crearFerreteria();
  };

  // Helpers (Sin cambios)
  const crearArmado = () => {
    if(!tempData.nombre) return;

    // Validar que no exista nombre duplicado
    const nombreExiste = config.armados.some(a => a.nombre.toLowerCase() === tempData.nombre.toLowerCase());
    if (nombreExiste) {
      setAlertData({
        title: 'Nombre duplicado',
        message: `Ya existe un armado con el nombre "${tempData.nombre}". Por favor usa otro nombre.`,
        theme: theme
      });
      return;
    }

    // Ir a selección de ferreterías en lugar de guardar directamente
    const defaultOrden = config.catalogoFerreteria.map(f => f.id);
    setTempData({
      nuevoArmadoId: `a_${Date.now()}`,
      nuevoArmadoNombre: tempData.nombre,
      itemsSeleccion: {},
      listaOrden: defaultOrden,
      snapshot: JSON.stringify({ itemsSeleccion: {}, listaOrden: defaultOrden }),
    });
    setBuscaArmado(''); setModalOpen('SELECCIONAR_ITEMS_ARMADO');
  };

  const guardarArmadoConItems = () => {
    const { nuevoArmadoId, nuevoArmadoNombre, itemsSeleccion = {}, modoEdicion, listaOrden } = tempData;
    const orden = listaOrden || config.catalogoFerreteria.map(f => f.id);
    const items = orden
      .filter(id => {
        const s = itemsSeleccion[id];
        if (!s) return false;
        return (s.cant || 0) > 0 || (s.tipo && s.tipo !== 'none');
      })
      .map(id => ({ idRef: id, cant: itemsSeleccion[id].cant || 0, tipo: itemsSeleccion[id].tipo || 'primaria' }));
    if (modoEdicion) {
      const nuevosArmados = config.armados.map(a => a.id === nuevoArmadoId ? { ...a, items } : a);
      saveConfig({ ...config, armados: nuevosArmados });
    } else {
      const nuevo = { id: nuevoArmadoId, nombre: nuevoArmadoNombre, items, visible: true };
      saveConfig({ ...config, armados: [...config.armados, nuevo] });
    }
    setModalOpen(null);
  };
  const crearFerreteria = () => {
    if(!tempData.nombre) return;

    // Validar que no exista nombre duplicado
    const nombreExiste = config.catalogoFerreteria.some(f => f.nombre.toLowerCase() === tempData.nombre.toLowerCase());
    if (nombreExiste) {
      setAlertData({
        title: 'Nombre duplicado',
        message: `Ya existe una ferretería con el nombre "${tempData.nombre}". Por favor usa otro nombre.`,
        theme: theme
      });
      return;
    }

    // El usuario solo agrega el NOMBRE (ferretería local); unidad por defecto 'und'.
    const nuevo = { id: `f_${Date.now()}`, nombre: tempData.nombre, unidad: 'und', visible: true };
    saveConfig({ ...config, catalogoFerreteria: [nuevo, ...config.catalogoFerreteria] });
    setModalOpen(null);
  };
  const agregarMaterial = () => { 
    if(!tempData.matId || !tempData.cant) return; 
    
    // Validar que no exista ya esa ferretería en el armado
    const armado = config.armados.find(a => a.id === tempData.armadoId);
    if (armado) {
      const yaExiste = armado.items.some(item => item.idRef === tempData.matId);
      if (yaExiste) {
        const ferr = config.catalogoFerreteria.find(f => f.id === tempData.matId);
        setAlertData({ 
          title: 'Ferretería duplicada', 
          message: `El material "${ferr?.nombre}" ya está agregado a este armado.`,
          theme: theme 
        });
        return;
      }
    }
    
    const nuevosArmados = config.armados.map(a => a.id === tempData.armadoId ? { ...a, items: [...a.items, { idRef: tempData.matId, cant: parseFloat(tempData.cant) }] } : a); 
    saveConfig({ ...config, armados: nuevosArmados }); 
    setTempData({ armadoId: tempData.armadoId }); 
    setModalOpen(null); 
  };
  const agregarBoton = () => { if(!tempData.val || !tempData.tipoLista) return; const tipo = tempData.tipoLista; const valorFinal = (tipo === 'alturas' || tipo === 'fuerzas') ? parseFloat(tempData.val) : tempData.val; const nuevosBotones = { ...config.botonesPoste, [tipo]: [...config.botonesPoste[tipo], { v: valorFinal, visible: true }] }; saveConfig({ ...config, botonesPoste: nuevosBotones }); setModalOpen(null); };
  const toggleVisibilidadBoton = (tipo, valor) => { const nuevosBotones = { ...config.botonesPoste, [tipo]: config.botonesPoste[tipo].map(b => b.v === valor ? { ...b, visible: !b.visible } : b) }; saveConfig({ ...config, botonesPoste: nuevosBotones }); };
  const toggleVisibilidadArmado = (id) => { const nuevosArmados = config.armados.map(a => a.id === id ? { ...a, visible: (a.visible === undefined ? false : !a.visible) } : a); saveConfig({ ...config, armados: nuevosArmados }); };
  const confirmarBorrarBoton = (tipo, valor) => { if (!setConfirmData) { alert("Error: setConfirmData no recibido"); return; } setConfirmData({ title: 'Eliminar Opción', message: `¿Eliminar "${valor}" de la lista?`, actionText: 'ELIMINAR', theme: theme, onConfirm: () => { const nuevosBotones = { ...config.botonesPoste, [tipo]: config.botonesPoste[tipo].filter(b => b.v !== valor) }; saveConfig({ ...config, botonesPoste: nuevosBotones }); setConfirmData(null); } }); };
  const borrarArmado = (id) => {
    console.log('🗑️ borrarArmado llamado con ID:', id);
    console.log('setConfirmData existe?', !!setConfirmData);
    if (!setConfirmData) { 
      alert("Error: setConfirmData no recibido"); 
      return; 
    }
    const armado = config.armados.find(a => a.id === id);
    console.log('Armado encontrado:', armado);
    setConfirmData({ 
      title: 'Eliminar Armado', 
      message: `¿Estás seguro de eliminar el armado "${armado?.nombre}"? Esta acción no se puede deshacer.`, 
      actionText: 'ELIMINAR', 
      theme: theme, 
      onConfirm: () => { 
        console.log('✅ Confirmado - borrando armado');
        saveConfig({ ...config, armados: config.armados.filter(a => a.id !== id) }); 
        setConfirmData(null); 
      } 
    });
  };
  const borrarFerreteria = (id) => {
    if (!setConfirmData) {
      alert("Error: setConfirmData no recibido");
      return;
    }
    const ferr = config.catalogoFerreteria.find(f => f.id === id);

    // Verificar si la ferretería está en algún armado
    const armadosQueLoUsan = config.armados.filter(a => a.items?.some(item => item.idRef === id));
    if (armadosQueLoUsan.length > 0) {
      const nombres = armadosQueLoUsan.map(a => `"${a.nombre}"`).join(', ');
      setAlertData({
        title: 'No se puede eliminar',
        message: `"${ferr?.nombre}" forma parte del armado ${nombres}. Primero quítala del armado para poder eliminarla.`,
        theme: theme
      });
      return;
    }

    setConfirmData({
      title: 'Eliminar Ferretería',
      message: `¿Estás seguro de eliminar "${ferr?.nombre}"? Esta acción no se puede deshacer.`,
      actionText: 'ELIMINAR',
      theme: theme,
      onConfirm: () => {
        saveConfig({ ...config, catalogoFerreteria: config.catalogoFerreteria.filter(f => f.id !== id) });
        setConfirmData(null);
      }
    });
  };
  const borrarMaterialDeArmado = (armadoId, index) => { const nuevosArmados = config.armados.map(a => a.id === armadoId ? {...a, items: a.items.filter((_, i) => i !== index)} : a); saveConfig({ ...config, armados: nuevosArmados }); };
  
  const [expandedId, setExpandedId] = useState(null); 
  const [editId, setEditId] = useState(null);
  const [modoEditBotones, setModoEditBotones] = useState(null);

  const DeleteButton = ({ onClick, children, className }) => {
      return ( 
        <button 
          onClick={(e) => {
            e.stopPropagation();
            console.log('🗑️ DeleteButton clicked');
            onClick();
          }} 
          className={className} 
          type="button"
        > 
          {children} 
        </button> 
      );
  };

  const LongPressButton = ({ onClick, onLongPress, children, className }) => {
      const timerRef = useRef(null);
      const isLongPress = useRef(false);
      const isTouchRef = useRef(false);

      const startPress = () => {
        isLongPress.current = false;
        timerRef.current = setTimeout(() => {
          isLongPress.current = true;
          if (navigator.vibrate) navigator.vibrate(50);
          onLongPress();
        }, 500);
      };

      const cancelPress = () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };

      const handleClick = () => {
        cancelPress();
        if (!isLongPress.current && onClick) {
          onClick();
        }
        isLongPress.current = false;
      };

      return (
        <button
          onMouseDown={() => { if (!isTouchRef.current) startPress(); }}
          onMouseLeave={() => { if (!isTouchRef.current) cancelPress(); }}
          onTouchStart={() => { isTouchRef.current = true; startPress(); }}
          onTouchEnd={() => { setTimeout(() => { isTouchRef.current = false; }, 500); }}
          onTouchCancel={() => { cancelPress(); setTimeout(() => { isTouchRef.current = false; }, 500); }}
          onClick={handleClick}
          className={className}
          type="button"
        >
          {children}
        </button>
      );
  };

  const FilaPestanas = ({ idA, tituloA, renderA, idB, tituloB, renderB }) => {
      const isOpenA = seccionAbierta === idA;
      const isOpenB = idB ? seccionAbierta === idB : false;

      const baseBtnClass = `h-14 rounded-xl border-2 font-black text-xs uppercase tracking-wide transition-all shadow-sm flex items-center justify-center`;
      
      const activeClass = `bg-orange-500 text-black border-orange-600 shadow-md ring-2 ring-orange-200 transform scale-[1.02]`;
      const inactiveClass = `${theme.card} ${theme.text} border-slate-300 hover:bg-slate-50 hover:text-black opacity-80`;

      return (
          <div className="mb-2">
              <div className={`grid ${idB ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                  <button onClick={() => setSeccionAbierta(isOpenA ? null : idA)} className={`${baseBtnClass} ${isOpenA ? activeClass : inactiveClass}`}>
                      {tituloA}
                  </button>
                  {idB && (
                      <button onClick={() => setSeccionAbierta(isOpenB ? null : idB)} className={`${baseBtnClass} ${isOpenB ? activeClass : inactiveClass}`}>
                          {tituloB}
                      </button>
                  )}
              </div>

              {isOpenA && <div className={`mt-2 p-3 rounded-xl border-2 ${theme.border} ${theme.card} animate-in slide-in-from-top-2 duration-200`}>{renderA()}</div>}
              {isOpenB && <div className={`mt-2 p-3 rounded-xl border-2 ${theme.border} ${theme.card} animate-in slide-in-from-top-2 duration-200`}>{renderB()}</div>}
          </div>
      );
  };

  const renderBotones = (tipo, addModal, tipoAdd) => {
    const enModoEdit = modoEditBotones === tipo;

    return (
      <div className="flex flex-wrap gap-2">
        {config.botonesPoste[tipo]?.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              if (enModoEdit) {
                const nuevosBotones = { ...config.botonesPoste, [tipo]: config.botonesPoste[tipo].filter(b => b.v !== item.v) };
                saveConfig({ ...config, botonesPoste: nuevosBotones });
              } else {
                toggleVisibilidadBoton(tipo, item.v);
              }
            }}
            className={`h-12 rounded-lg text-sm font-bold border-2 flex items-center overflow-hidden active:scale-95 transition-all shadow-sm select-none
            ${item.visible || enModoEdit ? 'bg-slate-900 text-white border-black' : `${theme.card} ${theme.text} border-slate-300`}`}
          >
            <span className="pl-4 pr-3">{item.v}</span>
            <span className={`self-stretch flex items-center px-3 ${
              enModoEdit ? 'bg-red-500 text-white' : item.visible ? 'text-white' : `${theme.text} opacity-60`
            }`}>
              {enModoEdit ? <X size={15} strokeWidth={3}/> : item.visible ? <Eye size={15}/> : <EyeOff size={15}/>}
            </span>
          </button>
        ))}

        {!enModoEdit && (
          <button
            onClick={() => { setTempData({ tipoLista: tipoAdd }); setModalOpen(addModal); }}
            className={`h-12 w-12 rounded-lg border-2 border-dashed ${theme.border} ${theme.card} flex items-center justify-center text-green-600 hover:opacity-80 active:scale-95 transition-colors`}
          >
            <Plus size={24} strokeWidth={4} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`flex-1 flex flex-col ${theme.bg} overflow-hidden relative`}>

      <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0`}>
          <button onClick={() => { if (editId) setEditId(null); volver(); }}>
            <ChevronDown className={`rotate-90 ${theme.text}`} size={28}/>
          </button>
          <span className={`font-black ${theme.text} text-lg uppercase`}>Configuración</span>
          <button
            onClick={importarBase}
            title="Importar / restaurar lista base"
            className="p-1.5 rounded-xl bg-slate-900 border-2 border-slate-900 active:scale-95 transition-all"
          >
            <RotateCcw size={16} className="text-white" strokeWidth={2.5} />
          </button>
      </div>
      
      <div className={`flex ${theme.header} border-b-2 ${theme.border} shrink-0`}> 
          {tabsVisibles.map(t => (
              <button 
                key={t} 
                onClick={() => { 
                  if (editId) setEditId(null);
                  setTab(t); 
                }} 
                className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-4 ${tab === t ? 'border-brand-500 text-brand-500' : `border-transparent ${theme.text} hover:opacity-70`}`}
              >
                {t}
              </button> 
          ))} 
      </div>
      
      <div className="flex-1 overflow-y-auto p-3">

  {tab === 'armados' && (
            <div className="space-y-4 pb-24">

                <button
                    onClick={() => { setTempData({}); setModalOpen('CREAR_ARMADO'); }}
                    className={`w-full py-3 border-2 border-dashed ${theme.border} rounded-xl ${theme.text} text-xs font-black uppercase tracking-widest hover:border-brand-500 hover:text-brand-500 transition-all bg-transparent`}
                >
                    + Crear Armado
                </button>
                
                <div className="space-y-3">
                    {config.armados.map(arm => {
                        const isExpanded = expandedId === arm.id;
                        const isEditing = editId === arm.id;

                        return (
                            <div key={arm.id} className={`${theme.card} border-2 ${theme.border} rounded-xl overflow-hidden transition-all duration-200 ${isExpanded ? 'shadow-xl' : 'shadow-sm'}`}>
                                
                                <div className="p-3 flex items-center justify-between gap-2">
                                    
                                    <span className={`font-bold text-sm ${theme.text} truncate flex-1`}>
                                        {arm.nombre}
                                    </span>

                                    <div className="flex items-center gap-2 shrink-0">
                                        
                                        <button
                                            onClick={() => {
                                              const itemsSeleccion = {};
                                              arm.items.forEach(item => {
                                                itemsSeleccion[item.idRef] = { cant: item.cant, tipo: item.tipo || 'primaria' };
                                              });
                                              // Orden: items guardados primero (en su orden), luego el resto del catálogo
                                              const savedIds = arm.items.map(i => i.idRef);
                                              const restIds = config.catalogoFerreteria.filter(f => !savedIds.includes(f.id)).map(f => f.id);
                                              const listaOrden = [...savedIds, ...restIds];
                                              setTempData({ nuevoArmadoId: arm.id, nuevoArmadoNombre: arm.nombre, itemsSeleccion, listaOrden, snapshot: JSON.stringify({ itemsSeleccion, listaOrden }), modoEdicion: true });
                                              setBuscaArmado(''); setModalOpen('SELECCIONAR_ITEMS_ARMADO');
                                            }}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg border-2 border-black text-slate-800 transition-colors opacity-60 hover:opacity-100"
                                        >
                                            <Edit3 size={18} strokeWidth={2.5}/>
                                        </button>

                                        <DeleteButton
                                            onClick={() => borrarArmado(arm.id)}
                                            className="w-9 h-9 flex items-center justify-center rounded-lg border-2 bg-red-600 border-red-800 text-white hover:bg-red-700 active:scale-90 transition-all"
                                        >
                                            <Trash2 size={18} strokeWidth={2.5} className="text-white"/>
                                        </DeleteButton>

                                        <button 
                                            onClick={() => {
                                                if (isEditing) setEditId(null);
                                                setExpandedId(isExpanded ? null : arm.id);
                                            }}
                                            className={`w-9 h-9 flex items-center justify-center rounded-lg border-2 ${theme.border} ${theme.text} ${isExpanded ? 'bg-slate-500/10' : 'hover:bg-slate-500/5'} transition-all`}
                                        >
                                            <ChevronDown size={20} strokeWidth={2.5} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                        
                                        <div className={`h-6 w-px ${theme.border} mx-1 opacity-50`}></div>

                                        <button 
                                            onClick={() => toggleVisibilidadArmado(arm.id)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-lg border-2 ${arm.visible !== false ? 'bg-slate-900 text-white border-black shadow-md' : `${theme.bg} ${theme.text} border-slate-300 opacity-30 hover:opacity-100`}`}
                                        >
                                            {arm.visible !== false ? <Eye size={18} strokeWidth={2.5}/> : <EyeOff size={18} strokeWidth={2.5}/>}
                                        </button>

                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className={`px-4 py-3 bg-black/5 border-t ${theme.border}`}>
                                        {arm.items.length === 0 ? (
                                            <div className="text-center py-2 opacity-40 text-xs italic">Sin materiales asignados</div>
                                        ) : (
                                            [...arm.items.filter(i => (i.tipo || 'primaria') === 'primaria'), ...arm.items.filter(i => i.tipo === 'secundaria')]
                                            .map((item, idx) => {
                                                const matInfo = config.catalogoFerreteria.find(f => f.id === item.idRef);
                                                const esPrimaria = (item.tipo || 'primaria') === 'primaria';
                                                return (
                                                    <div key={idx} className={`flex justify-between items-center py-2 border-b ${theme.border} last:border-0`}>
                                                        <span className={`font-bold text-xs ${theme.text} opacity-90 truncate flex-1`}>
                                                            {matInfo?.nombre || '???'}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-black ${theme.text} opacity-70`}>
                                                                {item.cant}
                                                            </span>
                                                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${esPrimaria ? 'border-green-500 text-green-600' : 'border-orange-500 text-orange-600'}`}>
                                                                {esPrimaria ? 'P' : 'S'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div> 
                        ) 
                    })} 
                </div>
            </div> 
        )}

{tab === 'ferreteria' && (
            <div className="space-y-3 pb-24">
                <button onClick={() => { setTempData({}); setModalOpen('CREAR_FERR'); }} className={`w-full py-3 border-2 border-dashed ${theme.border} rounded-xl ${theme.text} text-xs font-black uppercase tracking-widest hover:border-brand-500 hover:text-brand-500 transition-all bg-transparent`}>+ Crear Ferretería</button>

                {config.catalogoFerreteria.length === 0 && (
                  <p className={`text-center text-xs ${theme.textSec || 'text-slate-400'} py-4`}>Tu lista está vacía. Presiona <b>Importar base</b> para cargar el catálogo.</p>
                )}

                <div className="space-y-2">
                  {config.catalogoFerreteria.map(f => (
                    <div key={f.id} className={`${theme.card} border-2 ${theme.border} rounded-xl p-3 flex items-center justify-between transition-all hover:shadow-md`}>

                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`font-bold text-sm ${theme.text} truncate`}>{f.nombre}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <DeleteButton
                           onClick={() => borrarFerreteria(f.id)}
                           className="w-9 h-9 flex items-center justify-center rounded-lg border-2 bg-red-600 border-red-800 text-white hover:bg-red-700 active:scale-90 transition-all"
                        >
                           <Trash2 size={16} strokeWidth={2.5} className="text-white"/>
                        </DeleteButton>
                        <div className={`h-6 w-px ${theme.border} opacity-50`}></div>
                        <button
                          onClick={() => {
                             const nuevos = config.catalogoFerreteria.map(item => item.id === f.id ? {...item, visible: !item.visible} : item);
                             saveConfig({...config, catalogoFerreteria: nuevos});
                          }}
                          className={`w-9 h-9 flex items-center justify-center rounded-lg border-2 ${f.visible === true ? 'bg-slate-900 text-white border-black shadow-md' : `${theme.bg} ${theme.text} border-slate-300 opacity-30 hover:opacity-100`}`}
                        >
                          {f.visible === true ? <Eye size={16} strokeWidth={2.5}/> : <EyeOff size={16} strokeWidth={2.5}/>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
        )}
        
{tab === 'datos' && (
          <div className="space-y-6 pb-24">
            {[
              { titulo: 'Altura',            tipo: 'alturas',   tipoAdd: 'alturas'   },
              { titulo: 'Material',          tipo: 'materiales',tipoAdd: 'materiales'},
              { titulo: 'Fuerza',            tipo: 'fuerzas',   tipoAdd: 'fuerzas'   },
              { titulo: 'Tipo de Red',       tipo: 'tipos',     tipoAdd: 'tipos'     },
              { titulo: 'Datos Extras',      tipo: 'extras',    tipoAdd: 'extras'    },
              { titulo: 'Cantidad de Cables',tipo: 'cables',    tipoAdd: 'cables'    },
            ].map(({ titulo, tipo, tipoAdd }) => {
              const enModoEdit = modoEditBotones === tipo;
              return (
                <div key={tipo} className={`${theme.card} border-2 ${theme.border} rounded-xl overflow-hidden`}>
                  <div className={`px-4 py-2 flex items-center justify-between border-b-2 ${theme.border} ${theme.header}`}>
                    <span className={`text-[11px] font-black tracking-[0.15em] uppercase ${theme.text}`}>{titulo}</span>
                    <button
                      onClick={() => setModoEditBotones(enModoEdit ? null : tipo)}
                      className={`text-[11px] font-black px-3 py-1 rounded-lg border-2 transition-all active:scale-95 ${enModoEdit ? 'bg-slate-900 text-white border-black' : `${theme.bg} ${theme.text} ${theme.border}`}`}
                    >
                      {enModoEdit ? 'LISTO' : 'EDITAR'}
                    </button>
                  </div>
                  <div className="p-3">
                    {renderBotones(tipo, 'AGREGAR_BOTON', tipoAdd)}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      <Modal isOpen={modalOpen === 'CREAR_ARMADO'} onClose={() => setModalOpen(null)} title="Nuevo Armado" theme={theme}>
        <ThemedInput autoFocus placeholder="Nombre" val={tempData.nombre || ''} onChange={e => setTempData({...tempData, nombre: e.target.value})} theme={theme} />
        <div className="h-4"></div>
        <button onClick={crearArmado} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-xl">CREAR</button>
      </Modal>



      <Modal isOpen={modalOpen === 'CREAR_FERR'} onClose={() => { setModalOpen(null); setFerrYaExiste(null); }} title="Nueva Ferretería" theme={theme} topAnchor>
        {ferrYaExiste ? (
          <div className="text-center space-y-3 py-2">
            <p className={`text-sm ${theme.textSec || 'text-slate-500'}`}>Esta ferretería ya existe en tu configuración:</p>
            <p className={`font-black text-lg ${theme.text}`}>{ferrYaExiste}</p>
            <button onClick={() => { setFerrYaExiste(null); setTempData({ ...tempData, nombre: '' }); }} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg">AGREGAR OTRA FERRETERÍA</button>
          </div>
        ) : (
          <>
            <ThemedInput autoFocus placeholder="Escribe para buscar o crear…" val={tempData.nombre || ''} onChange={e => setTempData({ ...tempData, nombre: e.target.value })} theme={theme} />
            {(() => {
              const q = (tempData.nombre || '').trim().toLowerCase();
              if (!q) return null;
              const userList = config.catalogoFerreteria;
              const enUser = (nom) => userList.some(f => (f.nombre || '').toLowerCase() === (nom || '').toLowerCase());
              // Coincidencias en TU lista (ya las tenés → "ya existe")
              const matchesUser = userList.filter(f => (f.nombre || '').toLowerCase().includes(q));
              // Coincidencias en la BASE que borraste (no están en tu lista → se pueden re-agregar)
              const base = (ferreteriaBase && ferreteriaBase.length) ? ferreteriaBase : FERRETERIA_BASE_DEFAULT;
              const matchesBase = base.filter(b => (b.nombre || '').toLowerCase().includes(q) && !enUser(b.nombre));
              return (
                <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto">
                  {matchesUser.map(f => (
                    <button key={f.id} onClick={() => setFerrYaExiste(f.nombre)} className={`w-full text-left px-3 py-2.5 rounded-lg border-2 ${theme.border} ${theme.card} ${theme.text} text-sm font-bold active:scale-95 transition-all`}>
                      {f.nombre}
                    </button>
                  ))}
                  {/* De la base (borrada): al tocar SOLO completa el input; se agrega con el botón de abajo */}
                  {matchesBase.map(b => (
                    <button key={b.id} onClick={() => setTempData({ ...tempData, nombre: b.nombre })} className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-lg border-2 border-dashed ${theme.border} ${theme.text} text-sm font-bold active:scale-95 transition-all`}>
                      <span className="truncate">{b.nombre}</span>
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 shrink-0">base</span>
                    </button>
                  ))}
                  {!enUser(q) && (
                    <button onClick={agregarBuscado} className="w-full px-3 py-3 rounded-lg bg-brand-600 text-white text-sm font-black active:scale-95 transition-all">
                      + Agregar “{(tempData.nombre || '').trim()}”
                    </button>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </Modal>

      <Modal isOpen={modalOpen === 'AGREGAR_MAT'} onClose={() => setModalOpen(null)} title="Agregar Ferretería" theme={theme} bottomSheet> 
        
        <div className={`max-h-60 overflow-y-auto rounded-xl border-2 ${theme.border} p-2 ${theme.card} mb-3`}> 
          {config.catalogoFerreteria.map(f => ( 
            <div 
              key={f.id} 
              onClick={() => setTempData({...tempData, matId: f.id})} 
              className={`p-3 rounded-lg text-sm font-medium cursor-pointer mb-1 transition-colors flex justify-between items-center ${tempData.matId === f.id ? 'bg-slate-900 text-white shadow-md' : `${theme.text} hover:bg-slate-100`}`}
            > 
              <span className="font-bold">{f.nombre}</span> 
            </div> 
          ))} 
        </div> 

        <label className={`text-xs font-black ${theme.text} opacity-70 uppercase tracking-wide mb-2 block`}>
          Cantidad {tempData.matId && `(${config.catalogoFerreteria.find(f => f.id === tempData.matId)?.unidad || ''})`}
        </label>
        
        <input 
          type="number" 
          step="0.01"
          placeholder="0.00" 
          className={`w-full ${theme.input} p-4 rounded-xl border-2 ${theme.border} font-bold text-lg ${theme.text} [appearance:textfield] mb-4`} 
          value={tempData.cant || ''} 
          onChange={e => setTempData({...tempData, cant: e.target.value})} 
        />

        <button 
          onClick={agregarMaterial} 
          disabled={!tempData.matId || !tempData.cant}
          className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
        >
          AGREGAR
        </button> 
      </Modal>

      <Modal isOpen={modalOpen === 'AGREGAR_BOTON'} onClose={() => setModalOpen(null)} title="Nueva Opción" theme={theme}> 
        <ThemedInput autoFocus placeholder="Valor" val={tempData.val || ''} onChange={e => setTempData({...tempData, val: e.target.value})} theme={theme} /> 
        <div className="h-4"></div> 
        <button onClick={agregarBoton} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-xl">AGREGAR</button> 
      </Modal>

      {/* PANTALLA COMPLETA: Selección de ferreterías para armado */}
      {modalOpen === 'SELECCIONAR_ITEMS_ARMADO' && (() => {
        const itemsSeleccion = tempData.itemsSeleccion || {};
        const listaOrden = tempData.listaOrden || config.catalogoFerreteria.map(f => f.id);
        let listaDisplay = listaOrden.map(id => config.catalogoFerreteria.find(f => f.id === id)).filter(Boolean);

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
              <span className={`font-black ${theme.text} text-base uppercase truncate mx-2`}>{tempData.nuevoArmadoNombre}</span>
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
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 active:scale-95 transition-all shadow-lg"
              >
                GUARDAR ARMADO
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}