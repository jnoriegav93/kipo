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
  setVista,        // Antes era 'cerrar', ahora usamos el nombre real
  guardarPunto,    // Antes era 'guardar', ahora usamos el nombre real
  setModalOpen,    // Antes era 'abrirCamara', ahora usamos el nombre real
  procesarFoto, 
  inputCamaraRef 
}) {
    return (
    <>

        <div className={`fixed inset-0 z-[200] ${theme.bg} flex flex-col animate-in slide-in-from-bottom duration-200`}>
          
          {/* 1. HEADER: Cambio de título dinámico */}
          <div className={`${theme.header} border-b-2 ${theme.border} px-4 py-3 flex justify-between items-center shadow-lg shrink-0`}>
            <h2 className={`font-black ${theme.text} text-xl uppercase`}>
              {modoLectura ? 'DETALLE' : (modoEdicion ? 'EDITAR' : 'NUEVO')}
            </h2>
            <button onClick={() => setVista('mapa')} className={`${theme.text} hover:opacity-70 p-2 rounded-full`}>
              <X size={28} />
            </button>
          </div>
      
          <div className="flex-1 overflow-y-auto p-3 pb-24">
            
      {/* 2. INPUTS SUPERIORES: Organizados en dos filas */}
            <div className="flex flex-col gap-3 mb-4">
      
              {/* FILA 1: NÚMERO Y CÓDIGO */}
              <div className="grid grid-cols-2 gap-3">
                <ThemedInput 
                  placeholder="NÚMERO" 
                  val={datosFormulario.numero || ''} 
                  onChange={v => setDatosFormulario(prev => ({...prev, numero: v.target.value}))} 
                  theme={theme} 
                  disabled={modoLectura} 
                />
                <ThemedInput 
                  placeholder="CÓDIGO POSTE" 
                  val={datosFormulario.codigo || ''} 
                  onChange={v => setDatosFormulario(prev => ({...prev, codigo: v.target.value}))} 
                  theme={theme} 
                  disabled={modoLectura} 
                />
              </div>
      
              {/* FILA 2: SUMINISTRO Y CÓDIGO FAT */}
              <div className="grid grid-cols-2 gap-3">
                <ThemedInput 
                  placeholder="SUMINISTRO" 
                  val={datosFormulario.suministro || ''} 
                  onChange={v => setDatosFormulario(prev => ({...prev, suministro: v.target.value}))} 
                  theme={theme} 
                  disabled={modoLectura} 
                />
                <ThemedInput 
                  placeholder="CÓDIGO FAT" 
                  val={datosFormulario.codFat || ''} 
                  onChange={v => setDatosFormulario(prev => ({...prev, codFat: v.target.value}))} 
                  theme={theme} 
                  disabled={modoLectura} 
                />
              </div>
      
            </div>
            {/* FOTOS: Se muestran, pero en modo lectura no deberías poder borrar (lógica aparte) */}
            {datosFormulario.fotos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
                {datosFormulario.fotos.map((f, i) => (
                  <img key={i} src={f} className={`w-20 h-20 rounded-lg object-cover border-2 ${theme.border} shadow-md`} />
                ))}
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
       <div className={`my-6 border-t-2 ${theme.border}`}></div>
       <BloqueLiquidacion 
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
                onChange={e => setDatosFormulario({...datosFormulario, observaciones: e.target.value})} 
                placeholder="Notas..." 
                disabled={modoLectura} // <--- NUEVO
                className={`w-full h-24 ${theme.input} border-2 ${theme.border} rounded-xl p-4 ${theme.text} text-lg focus:border-brand-500 focus:outline-none disabled:opacity-50`} 
              />
            </div>
          </div>
      
          {/* 4. BARRA INFERIOR: Solo se muestra si NO estamos en modo lectura */}
          {!modoLectura && (
            <div className={`${theme.bottomBar} p-3 border-t-2 flex gap-3 shrink-0 absolute bottom-0 w-full z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]`}>
              <button onClick={guardarPunto} className="flex-1 bg-green-600 text-white h-14 rounded-xl font-bold text-xl shadow-xl active:scale-95 flex items-center justify-center gap-2 border-b-4 border-green-800 active:border-b-0 active:mt-1 transition-all">
                <Save size={24} /> {modoEdicion ? 'ACTUALIZAR' : 'GUARDAR'}
              </button>
              <button 
        onClick={() => setModalOpen('MODO_FOTOS')} 
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


// 1. BLOQUE LEVANTAMIENTO
  const BloqueLevantamiento = ({ config, datosFormulario, setDatosFormulario, theme, disabled }) => {
    return (
      <div className={`space-y-4 animate-in fade-in py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
         {/* Datos Físicos del Poste */}
         <SelectorGrid titulo="ALTURA (m)" cols={5} opciones={config.botonesPoste.alturas} seleccion={datosFormulario.altura} onSelect={v => setDatosFormulario(prev => ({...prev, altura: v}))} theme={theme} />
         <SelectorGrid titulo="FUERZA (kg)" cols={4} opciones={config.botonesPoste.fuerzas} seleccion={datosFormulario.fuerza} onSelect={v => setDatosFormulario(prev => ({...prev, fuerza: v}))} theme={theme} />
         <SelectorGrid titulo="MATERIAL DEL POSTE" cols={4} opciones={config.botonesPoste.materiales} seleccion={datosFormulario.material} onSelect={v => setDatosFormulario(prev => ({...prev, material: v}))} theme={theme} />
         
         {/* Datos de Red */}
         <SelectorGrid titulo="TIPO DE RED" cols={4} opciones={config.botonesPoste.tipos} seleccion={datosFormulario.tipo} onSelect={v => setDatosFormulario(prev => ({...prev, tipo: v}))} theme={theme} />
         
         {/* 👇 AQUÍ HEMOS MOVIDO LA CANTIDAD DE CABLES 👇 */}
         <SelectorGrid titulo="CANTIDAD DE CABLES" cols={5} opciones={config.botonesPoste.cables} seleccion={datosFormulario.cables} onSelect={v => setDatosFormulario(prev => ({...prev, cables: v}))} theme={theme} />

         {/* Extras */}
         <SelectorGridMulti titulo="EXTRAS" cols={3} textSize="text-[14px]" opciones={config.botonesPoste.extras} seleccion={datosFormulario.extrasSeleccionados} 
            onToggle={v => {
               if(disabled) return; 
               const exists = datosFormulario.extrasSeleccionados.includes(v);
               const nuevos = exists ? datosFormulario.extrasSeleccionados.filter(x => x !== v) : [...datosFormulario.extrasSeleccionados, v];
               setDatosFormulario(prev => ({...prev, extrasSeleccionados: nuevos}));
            }} theme={theme} 
         />
      </div>
    );
  }

// 2. BLOQUE LIQUIDACIÓN
  const BloqueLiquidacion = ({ config, datosFormulario, setDatosFormulario, theme, disabled }) => {
    return (
      <div className={`space-y-4 animate-in fade-in py-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {/* Armados (BLINDADO) */}
        <div>
            <h3 className={`text-xs font-black ${theme.text} opacity-70 uppercase mb-2 ml-1`}>ARMADOS</h3>
            <div className="grid grid-cols-2 gap-2"> 
                {config.armados.filter(a => a.visible !== false).map(armado => { 
                    // 🛡️ AQUÍ ESTÁ EL BLINDAJE: ( ... || [])
                    // Si armadosSeleccionados es undefined, usamos [] para que no explote.
                    const listaSegura = datosFormulario.armadosSeleccionados || [];
                    const isSelected = listaSegura.some(a => a.id === armado.id); 
                    
                    return ( 
                        <button 
                            key={armado.id} 
                            onClick={() => {
                                if(disabled) return;
                                // Volvemos a leer la lista segura dentro del click
                                const currentList = datosFormulario.armadosSeleccionados || [];
                                const exists = currentList.some(a => a.id === armado.id);
                                
                                const nuevos = exists 
                                    ? currentList.filter(a => a.id !== armado.id) 
                                    : [...currentList, { id: armado.id, nombre: armado.nombre, items: armado.items }];
                                
                                setDatosFormulario(prev => ({...prev, armadosSeleccionados: nuevos}));
                            }} 
                            className={`h-16 px-1 rounded-xl text-[14px] font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${isSelected ? theme.gridBtnActive : theme.gridBtn}`}
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
        />
      </div>
    );
  }
