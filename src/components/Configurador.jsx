import React, { useState, useRef } from 'react';
import { ChevronDown, Eye, EyeOff, Plus, Save, Edit3, Trash2, X } from 'lucide-react';
import { Modal, ThemedInput } from './UI';

// --- CONFIGURADOR (FINAL: Textos Blancos en Modo Oscuro) ---
export default function Configurador({ config, saveConfig, volver, modalState = {}, theme, tab, setTab, seccionAbierta, setSeccionAbierta }) {
  const { modalOpen, setModalOpen, tempData, setTempData, setConfirmData, setAlertData } = modalState;
  
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
    
    const nuevo = { id: `a_${Date.now()}`, nombre: tempData.nombre, items: [], visible: true }; 
    saveConfig({ ...config, armados: [...config.armados, nuevo] }); 
    setModalOpen(null); 
  };
  const crearFerreteria = () => { 
    if(!tempData.nombre || !tempData.unidad) return; 
    
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
    
    const nuevo = { id: `f_${Date.now()}`, nombre: tempData.nombre, unidad: tempData.unidad }; 
    saveConfig({ ...config, catalogoFerreteria: [...config.catalogoFerreteria, nuevo] }); 
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
    console.log('🗑️ borrarFerreteria llamado con ID:', id);
    console.log('setConfirmData existe?', !!setConfirmData);
    if (!setConfirmData) { 
      alert("Error: setConfirmData no recibido"); 
      return; 
    }
    const ferr = config.catalogoFerreteria.find(f => f.id === id);
    console.log('Ferretería encontrada:', ferr);
    setConfirmData({ 
      title: 'Eliminar Ferretería', 
      message: `¿Estás seguro de eliminar "${ferr?.nombre}"? Esta acción no se puede deshacer.`, 
      actionText: 'ELIMINAR', 
      theme: theme, 
      onConfirm: () => { 
        console.log('✅ Confirmado - borrando ferretería');
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
      <div className="space-y-2">
        {enModoEdit && (
          <div className="flex justify-end">
            <button 
              onClick={() => setModoEditBotones(null)}
              className="text-sm font-bold text-brand-600 hover:text-brand-700 px-3 py-1 rounded"
            >
              Listo
            </button>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          {config.botonesPoste[tipo]?.map((item, i) => (
            <div key={i} className="relative">
              <LongPressButton 
                onClick={() => !enModoEdit && toggleVisibilidadBoton(tipo, item.v)}
                onLongPress={() => setModoEditBotones(tipo)}
                className={`h-12 px-4 rounded-lg text-sm font-bold border-2 flex items-center gap-2 active:scale-95 transition-all shadow-sm select-none
                ${item.visible ? 'bg-slate-900 text-white border-black' : `${theme.card} ${theme.text} border-slate-300`}
                ${enModoEdit ? 'animate-wiggle' : ''}`}
              >
                {item.v} {!enModoEdit && (item.visible ? <Eye size={16}/> : <EyeOff size={16}/>)}
              </LongPressButton>
              
              {enModoEdit && (
                <button
                  onClick={() => {
                    const nuevosBotones = { ...config.botonesPoste, [tipo]: config.botonesPoste[tipo].filter(b => b.v !== item.v) };
                    saveConfig({ ...config, botonesPoste: nuevosBotones });
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 active:scale-90 z-10"
                >
                  <X size={14} strokeWidth={3}/>
                </button>
              )}
            </div>
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
          <div className="w-6"></div> 
      </div>
      
      <div className={`flex ${theme.header} border-b-2 ${theme.border} shrink-0`}> 
          {['armados', 'ferreteria', 'botones'].map(t => ( 
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
                                                if (isEditing) {
                                                    setEditId(null);
                                                } else {
                                                    setEditId(arm.id);
                                                    setExpandedId(arm.id); 
                                                }
                                            }}
                                            className={`w-9 h-9 flex items-center justify-center rounded-lg border-2 transition-colors ${isEditing ? 'bg-green-600 border-green-700 text-white shadow-md' : `${theme.border} ${theme.text} opacity-60 hover:opacity-100`}`}
                                        >
                                            {isEditing ? <Save size={18} strokeWidth={2.5}/> : <Edit3 size={18} strokeWidth={2.5}/>}
                                        </button>

                                        <DeleteButton 
                                            onClick={() => borrarArmado(arm.id)}
                                            className={`w-9 h-9 flex items-center justify-center rounded-lg border-2 ${theme.border} text-red-600 bg-red-50 hover:bg-red-100 transition-colors`}
                                        >
                                            <Trash2 size={18} strokeWidth={2.5}/>
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
                                        
                                        <div className="flex flex-col mb-3">
                                            {arm.items.length === 0 ? (
                                                <div className="text-center py-2 opacity-40 text-xs italic">Sin materiales asignados</div>
                                            ) : (
                                                arm.items.map((item, idx) => {
                                                    const matInfo = config.catalogoFerreteria.find(f => f.id === item.idRef);
                                                    return (
                                                        <div key={idx} className={`flex justify-between items-center py-2 border-b ${theme.border} last:border-0`}>
                                                            <span className={`font-bold text-xs ${theme.text} opacity-90 truncate flex-1`}>
                                                                {matInfo?.nombre || '???'}
                                                            </span>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`text-xs font-black ${theme.text} opacity-70`}>
                                                                    {item.cant} {matInfo?.unidad}
                                                                </span>
                                                                {isEditing && (
                                                                    <button onClick={() => borrarMaterialDeArmado(arm.id, idx)} className="text-red-500 hover:text-red-700 p-1">
                                                                        <X size={16}/>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                        
                                        {isEditing && (
                                            <button 
                                                onClick={() => { setTempData({ armadoId: arm.id }); setModalOpen('AGREGAR_MAT'); }}
                                                className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                                            >
                                                <Plus size={16} strokeWidth={3} /> AGREGAR FERRETERÍA
                                            </button>
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
                
                <div className="space-y-2">
                  {config.catalogoFerreteria.map(f => ( 
                    <div key={f.id} className={`${theme.card} border-2 ${theme.border} rounded-xl p-3 flex items-center justify-between transition-all hover:shadow-md`}> 
                      
                      <div className="flex items-baseline gap-2 overflow-hidden">
                        <span className={`font-bold text-sm ${theme.text} truncate`}>{f.nombre}</span>
                        <span className="text-[10px] opacity-50 font-black uppercase shrink-0">{f.unidad}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <DeleteButton 
                           onClick={() => borrarFerreteria(f.id)} 
                           className="w-9 h-9 flex items-center justify-center rounded-lg border-2 border-red-200 bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                           <Trash2 size={16} strokeWidth={2.5}/>
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
        
{tab === 'botones' && ( 
          <div className="space-y-2 pb-24">
            
            <div className="relative flex py-2 items-center mt-2 mb-2">
                <div className={`flex-grow border-t-2 ${theme.border}`}></div>
                <span className={`flex-shrink-0 mx-4 ${theme.text} opacity-50 text-[10px] font-black tracking-[0.2em] uppercase`}>Datos de Postes</span>
                <div className={`flex-grow border-t-2 ${theme.border}`}></div>
            </div>
            
            <FilaPestanas idA="vis_altura" tituloA="Altura" renderA={() => renderBotones('alturas', 'AGREGAR_BOTON', 'alturas')} idB="vis_material" tituloB="Material" renderB={() => renderBotones('materiales', 'AGREGAR_BOTON', 'materiales')}/>
            <FilaPestanas idA="vis_fuerza" tituloA="Fuerza" renderA={() => renderBotones('fuerzas', 'AGREGAR_BOTON', 'fuerzas')} idB="vis_tipo" tituloB="Tipo de Red" renderB={() => renderBotones('tipos', 'AGREGAR_BOTON', 'tipos')}/>
            <FilaPestanas 
                idA="vis_extras" 
                tituloA="Datos Extras" 
                renderA={() => renderBotones('extras', 'AGREGAR_BOTON', 'extras')} 
                idB="vis_cables" 
                tituloB="Cantidad de Cables" 
                renderB={() => renderBotones('cables', 'AGREGAR_BOTON', 'cables')}
            />
          </div> 
        )}

      </div>

      <Modal isOpen={modalOpen === 'CREAR_ARMADO'} onClose={() => setModalOpen(null)} title="Nuevo Armado" theme={theme}> 
        <ThemedInput autoFocus placeholder="Nombre" val={tempData.nombre || ''} onChange={e => setTempData({...tempData, nombre: e.target.value})} theme={theme} /> 
        <div className="h-4"></div> 
        <button onClick={crearArmado} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-xl">CREAR</button> 
      </Modal>

      <Modal isOpen={modalOpen === 'CREAR_FERR'} onClose={() => setModalOpen(null)} title="Nueva Ferretería" theme={theme}> 
        <ThemedInput autoFocus placeholder="Nombre" val={tempData.nombre || ''} onChange={e => setTempData({...tempData, nombre: e.target.value})} theme={theme} /> 
        <div className="flex gap-2 my-4"> 
          {['und', 'mts'].map(u => ( <button key={u} onClick={() => setTempData({...tempData, unidad: u})} className={`flex-1 py-4 rounded-xl font-bold border-2 text-lg ${tempData.unidad === u ? 'bg-slate-900 text-white' : theme.input}`}> {u.toUpperCase()} </button> ))} 
        </div> 
        <button onClick={crearFerreteria} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-xl">REGISTRAR</button> 
      </Modal>

      <Modal isOpen={modalOpen === 'AGREGAR_MAT'} onClose={() => setModalOpen(null)} title="Agregar Ferretería" theme={theme}> 
        
        <div className={`max-h-60 overflow-y-auto rounded-xl border-2 ${theme.border} p-2 ${theme.card} mb-3`}> 
          {config.catalogoFerreteria.map(f => ( 
            <div 
              key={f.id} 
              onClick={() => setTempData({...tempData, matId: f.id})} 
              className={`p-3 rounded-lg text-sm font-medium cursor-pointer mb-1 transition-colors flex justify-between items-center ${tempData.matId === f.id ? 'bg-slate-900 text-white shadow-md' : `${theme.text} hover:bg-slate-100`}`}
            > 
              <span className="font-bold">{f.nombre}</span> 
              <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${tempData.matId === f.id ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}>{f.unidad}</span> 
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

    </div>
  );
}