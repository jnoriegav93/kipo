import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { 
  MapPin, Menu, Settings, X, Plus, Save, 
  Trash2, Camera, Link as LinkIcon, Tag, Cloud, CloudOff, RefreshCw,
  ChevronDown, Edit3, Eye, Check, EyeOff, Folder, MapPinOff,
  AlertTriangle, Circle, ZoomIn, ZoomOut, AlertCircle, FolderDown, Navigation,
  LogOut, User, Lock, Sun, Moon, Layers, Share2, FileDown, Star, FileJson, Image as ImageIcon
} from 'lucide-react';
// En App.jsx, arriba donde están los imports:
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, updateDoc, doc, setDoc, query, where, onSnapshot, getDocs, writeBatch, deleteDoc } from "firebase/firestore";
import { db, storage } from './firebaseConfig';
// 🔔 IMPORTANTE PARA VS CODE: 
// 1. Instala las dependencias: npm install leaflet react-leaflet firebase
// 2. Descomenta las siguientes importaciones:
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { auth } from './firebaseConfig';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { generarHuellaDigital } from './security';
import Login from './Login';
import { useSync } from './context/SyncContext';

// 3. (Opcional) Fix para los iconos de Leaflet en React que a veces fallan al compilar
/*
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

*/

// --- CONFIGURACIÓN ---
const APP_VERSION = "v19.0-BBDD-Ready";

// --- DATOS INICIALES ---
const DATA_INICIAL = {
  catalogoFerreteria: [
    { id: 'f1', nombre: 'Clevis Tipo D', unidad: 'und' },
    { id: 'f2', nombre: 'Aislador Carrete', unidad: 'und' },
    { id: 'f3', nombre: 'Fleje Acero 1/2', unidad: 'mts' },
    { id: 'f4', nombre: 'Hebilla Bandit 1/2', unidad: 'und' },
    { id: 'f5', nombre: 'Chapa Susp. ADSS', unidad: 'und' },
    { id: 'f6', nombre: 'Preformado Rojo', unidad: 'und' },
    { id: 'f7', nombre: 'Clamp 3 Bolt', unidad: 'und' },
    { id: 'f8', nombre: 'Cruceta 80cm', unidad: 'und' },
    { id: 'f9', nombre: 'Cruceta 60cm', unidad: 'und' },
    { id: 'f10', nombre: 'Mufa 48', unidad: 'und' },
    { id: 'f11', nombre: 'Mufa 96', unidad: 'und' },
    { id: 'f12', nombre: 'Cintillo 30cm', unidad: 'und' },
    { id: 'f13', nombre: 'Caja NAP x8', unidad: 'und' },
    { id: 'f14', nombre: 'Caja NAP x16', unidad: 'und' },
  ],
  armados: [
    { id: 'a1', nombre: 'Retención', items: [{ idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f3', cant: 1.8 }, { idRef: 'f4', cant: 2 }] },
    { id: 'a2', nombre: 'Suspensión', items: [{ idRef: 'f5', cant: 1 }, { idRef: 'f1', cant: 1 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a3', nombre: 'Medio Tramo', items: [{ idRef: 'f1', cant: 1 }, { idRef: 'f2', cant: 1 }, { idRef: 'f3', cant: 1.8 }, { idRef: 'f4', cant: 2 }, { idRef: 'f6', cant: 2 }, { idRef: 'f7', cant: 1 }] },
    { id: 'a4', nombre: 'Reserva', items: [{ idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f8', cant: 1 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a5', nombre: 'Mufa 48', items: [{ idRef: 'f10', cant: 1 }, { idRef: 'f8', cant: 1 }, { idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f12', cant: 5 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a6', nombre: 'Mufa 96', items: [{ idRef: 'f11', cant: 1 }, { idRef: 'f8', cant: 1 }, { idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f12', cant: 5 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a7', nombre: 'NAP x8', items: [{ idRef: 'f13', cant: 1 }, { idRef: 'f9', cant: 1 }, { idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f12', cant: 5 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a8', nombre: 'NAP x16', items: [{ idRef: 'f14', cant: 1 }, { idRef: 'f9', cant: 1 }, { idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f12', cant: 5 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] }
  ],
  botonesPoste: {
    alturas: [{ v: 8, visible: true }, { v: 9, visible: true }, { v: 11, visible: true }, { v: 13, visible: true }, { v: 15, visible: true }],
    fuerzas: [{ v: 200, visible: true }, { v: 300, visible: true }, { v: 400, visible: true }, { v: 500, visible: true }],
    materiales: [{ v: 'Concreto', visible: true }, { v: 'Madera', visible: true }, { v: 'Fierro', visible: true }, { v: 'Fibra', visible: true }],
    tipos: [{ v: 'MT', visible: true }, { v: 'BT', visible: true }, { v: 'AT', visible: true }, { v: 'TEL', visible: true }],
    extras: [{ v: 'Saturado', visible: true }, { v: 'Transformador', visible: true }, { v: 'Brazo', visible: true }],
    cables: [{ v: '1', visible: true }, { v: '2', visible: true }, { v: '3', visible: true }, { v: '4', visible: true }, { v: '5', visible: true }],
    ferreteriaExtra: [{ v: '1 Pref', visible: true }, { v: '2 Pref', visible: true }, { v: '3 Pref', visible: true }, { v: 'Br 1m', visible: true }, { v: 'Br 80cm', visible: true }]
  }
};

const COLORES_DIA = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444'];
const COLORES_PROYECTO = ['#f97316', '#3b82f6']; 

// --- TEMAS ---
const getTheme = (isDark) => isDark ? {
  bg: 'bg-slate-950',
  card: 'bg-slate-900',
  header: 'bg-slate-900',
  border: 'border-slate-800',
  text: 'text-slate-100',
  textSec: 'text-slate-400',
  input: 'bg-slate-800 text-white border-slate-700',
  activeItem: 'bg-slate-800 text-brand-400 border-slate-700',
  inactiveItem: 'text-slate-400 hover:bg-slate-800 border-transparent',
  gridBtn: 'bg-slate-800 text-slate-400 border-slate-700',
  gridBtnActive: 'bg-slate-100 text-slate-900 border-white',
  mapOverlay: 'rgba(255, 255, 255, 0.4)',
  mapGrid: 'radial-gradient(#fff 1px, transparent 1px)',
  bottomBar: 'bg-slate-950 border-slate-800',
  selectedDay: 'bg-brand-900/30 border-brand-500 text-white',
  actionBtn: 'border-slate-700 text-slate-400 hover:text-brand-500 hover:border-brand-500'
} : {
  bg: 'bg-white',
  card: 'bg-white',
  header: 'bg-white',
  border: 'border-slate-900', 
  text: 'text-black', 
  textSec: 'text-slate-800', 
  input: 'bg-white text-black border-slate-900 font-bold',
  activeItem: 'bg-slate-900 text-white border-black',
  inactiveItem: 'text-slate-900 hover:bg-slate-100 border-transparent',
  gridBtn: 'bg-white text-black border-slate-900 shadow-sm',
  gridBtnActive: 'bg-slate-900 text-white border-black shadow-md', 
  mapOverlay: 'rgba(0, 0, 0, 0.8)', 
  mapGrid: 'radial-gradient(#000 1px, transparent 1px)',
  bottomBar: 'bg-white border-slate-900',
  selectedDay: 'bg-slate-900 text-white border-black shadow-lg',
  actionBtn: 'border-slate-900 text-slate-900 hover:bg-slate-100 font-bold'
};

// --- COMPONENTES UI ---
const Modal = ({ isOpen, onClose, title, children, theme }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden`}>
        <div className={`${theme.header} p-4 border-b-2 ${theme.border} flex justify-between items-center`}>
          <h3 className={`font-black ${theme.text} text-xl uppercase`}>{title}</h3>
          <button onClick={onClose}><X size={28} className={theme.text}/></button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, actionText, theme }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden p-6 text-center`}>
        <div className="flex justify-center mb-4 text-yellow-500"><AlertTriangle size={48} /></div>
        <h3 className={`font-black ${theme.text} text-2xl mb-2`}>{title}</h3>
        <p className={`${theme.text} text-sm mb-6 font-medium`}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className={`flex-1 py-3 rounded-xl font-bold ${theme.bg} ${theme.text} border-2 ${theme.border}`}>CANCELAR</button>
          <button onClick={onConfirm} className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white shadow-lg border-2 border-red-800">{actionText || 'ELIMINAR'}</button>
        </div>
      </div>
    </div>
  );
};

const AlertModal = ({ isOpen, onClose, title, message, theme }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden p-6 text-center`}>
        <div className="flex justify-center mb-4 text-blue-500"><AlertCircle size={48} /></div>
        <h3 className={`font-black ${theme.text} text-2xl mb-2`}>{title}</h3>
        <p className={`${theme.text} text-sm mb-6 font-medium`}>{message}</p>
        <button onClick={onClose} className="w-full py-3 rounded-xl font-bold bg-blue-600 text-white shadow-lg border-2 border-blue-800">ENTENDIDO</button>
      </div>
    </div>
  );
};

const ExportModal = ({ isOpen, onClose, fileName, onConfirm, theme }) => {
  if (!isOpen) return null;
  return (
    <div className="absolute inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in zoom-in-95 duration-200">
      <div className={`${theme.card} border-2 ${theme.border} w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden p-6 text-center`}>
        <div className="flex justify-center mb-4 text-green-500"><FileDown size={48} /></div>
        <h3 className={`font-black ${theme.text} text-xl mb-2`}>EXPORTAR DATOS</h3>
        <p className={`${theme.text} text-sm mb-6 font-medium break-all`}>{fileName}</p>
        <button onClick={onConfirm} className="w-full py-3 rounded-xl font-bold bg-green-600 text-white shadow-lg border-2 border-green-800 flex items-center justify-center gap-2">
            <Share2 size={20}/> DESCARGAR / COMPARTIR
        </button>
        <button onClick={onClose} className={`mt-3 w-full py-3 rounded-xl font-bold ${theme.bg} ${theme.text} border-2 ${theme.border}`}>CANCELAR</button>
      </div>
    </div>
  );
};

const BotonMenu = ({ icon, label, active, onClick, theme }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-colors border-2 ${active ? theme.activeItem : theme.inactiveItem}`}>
    <div className={active ? 'text-brand-500' : ''}>{icon}</div>
    <span className={`font-bold text-lg ${active ? 'text-brand-500' : theme.text}`}>{label}</span>
  </button>
);


// BUSCA ESTA FUNCIÓN PEQUEÑA Y REEMPLÁZALA TODA:
const ThemedInput = ({ placeholder, val, onChange, theme, autoFocus, disabled }) => (
  <input 
    type="text" 
    autoFocus={autoFocus}
    value={val} 
    onChange={onChange} 
    
    // 1. AQUÍ APLICAMOS EL BLOQUEO REAL
    disabled={disabled} 

    // 2. AQUÍ CAMBIAMOS EL COLOR SI ESTÁ BLOQUEADO
    className={`w-full ${theme.input} border-2 rounded-xl px-4 py-4 text-lg font-bold placeholder-slate-500 focus:border-brand-500 focus:outline-none transition-colors
      ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100/50' : ''} 
    `} 
    
    placeholder={placeholder} 
  />
);




/* ----------------------------------------------------------------------------------
   🔔 ZONA DE MAPAS
   
   Aquí he dejado el "MapaSimulado" activo para que funcione en este entorno web.
   Abajo encontrarás el componente "MapaReal" comentado. 
   
   EN VS CODE:
   1. Comenta o borra el componente MapaSimulado.
   2. Descomenta el componente MapaReal.
   3. En el componente App, asegúrate de pasar las props correctas.
---------------------------------------------------------------------------------- */

// --- MAPA SIMULADO (ACTUAL) ---
const MapaSimulado = ({ theme, mapStyle, handleMapaClick, puntosVisiblesMapa, iconSize, obtenerColorDia, puntoSeleccionado, handlePuntoClick, puntoTemporal, modoUnion, puntoA_Union, conexionesVisiblesMapa }) => {
  return (
    <div 
      className={`flex-1 relative ${theme.bg} overflow-hidden cursor-crosshair touch-none`} 
      onClick={handleMapaClick}
    >
      <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: mapStyle === 'vector' 
            ? theme.mapGrid
            : 'linear-gradient(45deg, #111 25%, transparent 25%), linear-gradient(-45deg, #111 25%, transparent 25%)',
          backgroundSize: '30px 30px',
          backgroundColor: mapStyle === 'satellite' ? '#0f172a' : 'transparent'
      }}></div>
      
      {/* Conexiones */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        {conexionesVisiblesMapa.map(con => {
          const pA = puntosVisiblesMapa.find(p => p.id === con.from); 
          const pB = puntosVisiblesMapa.find(p => p.id === con.to);
          if(!pA || !pB) return null;
          return ( <line key={con.id} x1={pA.coords.x} y1={pA.coords.y} x2={pB.coords.x} y2={pB.coords.y} stroke={theme.mapOverlay} strokeWidth="3" strokeDasharray="5,5" /> );
        })}
      </svg>
      
      {/* Puntos */}
      {puntosVisiblesMapa.map(p => {
        const colorDia = obtenerColorDia(p.diaId); 
        const isSelected = puntoSeleccionado === p.id;
        const isUnionStart = modoUnion && puntoA_Union === p.id;
        const size = (isSelected || isUnionStart) ? 36 * iconSize : 24 * iconSize;

        return (
          <div key={p.id} onClick={(e) => handlePuntoClick(e, p.id)} className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-transform ${isSelected || isUnionStart ? 'z-40' : 'z-10'}`} style={{left: p.coords.x, top: p.coords.y}}>
            <div style={{ width: size, height: size, backgroundColor: colorDia, border: isUnionStart ? '4px solid #facc15' : '3px solid white', boxShadow: '0 4px 6px rgba(0,0,0,0.5)' }} className={`rounded-full flex items-center justify-center ${isSelected ? 'ring-4 ring-black/50' : ''}`}>
              <div className="w-1.5 h-1.5 bg-white rounded-full opacity-70"></div>
            </div>
            {p.datos.codigo && <span className={`absolute -top-8 ${theme.card} ${theme.text} font-bold text-xs px-2 py-1 rounded border-2 ${theme.border} whitespace-nowrap z-50 pointer-events-none shadow-lg`}>{p.datos.codigo}</span>}
          </div>
        )
      })}
      
      {/* Punto Temporal */}
      {puntoTemporal && !modoUnion && (
         <div className="absolute transform -translate-x-1/2 -translate-y-1/2" style={{left: puntoTemporal.x, top: puntoTemporal.y}}>
           <div className="w-5 h-5 bg-gray-500 rounded-full border-2 border-white shadow-lg relative">
             <div className="absolute -inset-4 rounded-full border-2 border-gray-500/30 animate-ping"></div>
           </div>
         </div>
      )}
      <div className="absolute bottom-2 right-2 bg-black/50 text-white px-2 py-1 text-xs rounded pointer-events-none">MODO SIMULACIÓN (PIXELES)</div>
    </div>
  );
};


// --- PARTE 1: EL AYUDANTE (CON SALTO INICIAL Y DESCANSO) ---
const MapController = ({ gpsTrigger, miUbicacion, setViewState, handleMapaClick, reintentarGPS, yaSaltoAlInicio, setYaSaltoAlInicio }) => {
  const map = useMap();
  
  // 1. SALTO AUTOMÁTICO AL INICIO
  // Ahora consultamos la variable 'yaSaltoAlInicio' que viene de afuera (App.jsx)
  useEffect(() => {
    if (miUbicacion && !yaSaltoAlInicio) {
      console.log("🏠 Primer salto automático a tu ubicación actual");
      map.setView(miUbicacion, 18);
      if(setViewState) setViewState({ center: miUbicacion, zoom: 18 });
      setYaSaltoAlInicio(true); // Avisamos a la App principal que ya saltamos
    }
  }, [miUbicacion, map, yaSaltoAlInicio]);

  // 2. SALTO MANUAL (SOLO POR BOTÓN)
  useEffect(() => {
    if (gpsTrigger > 0) {
      if (miUbicacion) {
        map.flyTo(miUbicacion, 18, { animate: true, duration: 1.5 });
        if(setViewState) setViewState({ center: miUbicacion, zoom: 18 });
      } else {
        reintentarGPS(); 
      }
    }
  }, [gpsTrigger]); // Solo depende del botón

  useMapEvents({
    moveend: () => {
      if(setViewState) setViewState({ center: map.getCenter(), zoom: map.getZoom() });
    },
    click: (e) => handleMapaClick(e)
  });

  return null;
};

// --- PARTE 2: EL MAPA PRINCIPAL ---
const MapaReal = ({ 
  theme, mapStyle, handleMapaClick, puntosVisiblesMapa, iconSize, 
  obtenerColorDia, puntoSeleccionado, handlePuntoClick, puntoTemporal, 
  modoUnion, puntoA_Union, conexionesVisiblesMapa, mostrarEtiquetas,
  viewState, setViewState,
  gpsTrigger,
  // Recibimos las nuevas props de la App
  yaSaltoAlInicio, 
  setYaSaltoAlInicio
}) => {

  const [miUbicacion, setMiUbicacion] = useState(null);
  const [gpsError, setGpsError] = useState(false); 
  const [vigilanciaID, setVigilanciaID] = useState(0); 

  const reintentarGPS = () => {
    setGpsError(false);
    setVigilanciaID(v => v + 1);
  };

  useEffect(() => {
    if (!navigator.geolocation) {
        setGpsError(true);
        return;
    }
    const opciones = { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setMiUbicacion([pos.coords.latitude, pos.coords.longitude]);
        setGpsError(false);
      },
      (err) => {
        setMiUbicacion(null);
        setGpsError(true);
      },
      opciones
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [vigilanciaID]);

  const userIcon = React.useMemo(() => L.divIcon({
      className: 'user-icon',
      html: `<div style="width: 20px; height: 20px; background-color: #2563eb; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3); animation: pulse-blue 2s infinite;"></div>`,
      iconSize: [20, 20], iconAnchor: [10, 10]
  }), []);

  // ... (aquí van los demás iconos como tempIcon) ...
  const tempIcon = React.useMemo(() => {
    const baseSize = 24 * iconSize;
    return L.divIcon({
      className: 'temp-icon',
      html: `<div style="width: ${baseSize}px; height: ${baseSize}px; background: #000; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2]
    });
  }, [iconSize]);

  return (
    <div className="h-full w-full relative z-0">
      <style>{`@keyframes pulse-blue { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5); } 70% { box-shadow: 0 0 0 15px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }`}</style>

      {gpsError && (
        <div className="absolute top-4 right-4 z-[5000] animate-in fade-in slide-in-from-right-2">
            <button onClick={reintentarGPS} className="bg-red-500/90 hover:bg-red-600 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl border border-white/20 transition-all active:scale-95 cursor-pointer">
                <MapPinOff size={14} />
                <span>Sin GPS. Toca para reintentar</span>
            </button>
        </div>
      )}

      <MapContainer center={viewState.center} zoom={viewState.zoom} maxZoom={22} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          {mapStyle === 'vector' ? (
                <TileLayer attribution='© OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={22} maxNativeZoom={19} />
          ) : (
                <TileLayer attribution='Tiles © Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={22} maxNativeZoom={18} />
          )}

          <MapController 
              gpsTrigger={gpsTrigger} 
              miUbicacion={miUbicacion} 
              setViewState={setViewState}
              handleMapaClick={handleMapaClick}
              reintentarGPS={reintentarGPS}
              // PASAMOS LAS PROPS DE MEMORIA
              yaSaltoAlInicio={yaSaltoAlInicio}
              setYaSaltoAlInicio={setYaSaltoAlInicio}
          />

          {miUbicacion && <Marker position={miUbicacion} icon={userIcon} zIndexOffset={9999} />}

          {/* Renderizado de conexiones */}
          {conexionesVisiblesMapa.map(con => {
              const pA = puntosVisiblesMapa.find(p => p.id === con.from);
              const pB = puntosVisiblesMapa.find(p => p.id === con.to);
              if(!pA || !pB) return null;
              return <Polyline key={con.id} positions={[[pA.coords.lat, pA.coords.lng], [pB.coords.lat, pB.coords.lng]]} pathOptions={{ color: mapStyle==='satellite'?'#fbbf24':'#000', weight: 4, dashArray: '10,10', opacity: 0.8 }} />
          })}

          {/* Renderizado de puntos (CON EL FIX DEL BORDE AMARILLO QUE YA TENÍAS) */}
          {puntosVisiblesMapa.map(p => {
                const colorDia = obtenerColorDia(p.diaId);
                const isSelected = puntoSeleccionado === p.id;
                const isUnionStart = modoUnion && puntoA_Union === p.id;
                const baseSize = 24 * iconSize;
                const customIcon = L.divIcon({
                  className: 'custom-icon',
                  html: `<div style="width: ${baseSize}px; height: ${baseSize}px; background: ${colorDia}; border: ${(isUnionStart || isSelected) ? '4px solid #facc15' : '2px solid white'}; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;">
                          ${mostrarEtiquetas ? `<span style="position: absolute; top: -18px; background: white; color: black; padding: 0 4px; border-radius: 4px; font-size: 11px; font-weight: 800; border: 2px solid black; white-space: nowrap; z-index: 1000;">${p.datos.numero || p.datos.codigo || 'S/N'}</span>` : ''}
                        </div>`,
                  iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2]
                });
                return <Marker key={p.id} position={[p.coords.lat, p.coords.lng]} icon={customIcon} eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); handlePuntoClick(e, p.id); } }} />
          })}
          
          {puntoTemporal && <Marker position={[puntoTemporal.lat, puntoTemporal.lng]} icon={tempIcon} zIndexOffset={1000} />}
      </MapContainer>
    </div>
  );
};


// Subcomponentes auxiliares
const SelectorGrid = ({ titulo, opciones, seleccion, onSelect, cols, textSize = 'text-lg', theme }) => (
  <div>
    <h3 className={`text-xs font-black ${theme.text} mb-2 ml-1 uppercase tracking-wider`}>{titulo}</h3>
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {opciones.filter(o => o.visible).map(op => (
        <button key={op.v} onClick={() => onSelect(op.v)} className={`h-14 rounded-lg ${textSize} font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${seleccion === op.v ? theme.gridBtnActive : theme.gridBtn}`}>
          <span className="px-1 break-words leading-tight">{op.v}</span>
        </button>
      ))}
    </div>
  </div>
);

const SelectorGridMulti = ({ titulo, opciones, seleccion, onToggle, cols, textSize = 'text-[12px]', theme }) => (
  <div>
    <h3 className={`text-xs font-black ${theme.text} mb-2 ml-1 uppercase tracking-wider`}>{titulo}</h3>
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {opciones.filter(o => o.visible).map(op => {
        const isActive = seleccion.includes(op.v);
        return (
          <button key={op.v} onClick={() => onToggle(op.v)} className={`h-14 rounded-lg ${textSize} font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${isActive ? theme.gridBtnActive : theme.gridBtn}`}>
            <span className="px-1 break-words leading-tight">{op.v}</span>
          </button>
        )
      })}
    </div>
  </div>
);

// --- APP PRINCIPAL ---
function App() {
  const { estadoSync, cola } = useSync();
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(DATA_INICIAL);
  const [iconSize, setIconSize] = useState(1);
  const [mapStyle, setMapStyle] = useState('vector'); 
  const [isDark, setIsDark] = useState(false); 
  const theme = getTheme(isDark); 
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(false);
  const { agregarTarea } = useSync();
  const [yaSaltoAlInicio, setYaSaltoAlInicio] = useState(false);
  
  // Estados Datos
  const [proyectos, setProyectos] = useState([]);
  const [proyectoActual, setProyectoActual] = useState(null); 
  const [diaActual, setDiaActual] = useState(null); 
  const [diasVisibles, setDiasVisibles] = useState([]); 
  const [puntos, setPuntos] = useState([]); 
  const [conexiones, setConexiones] = useState([]); 
  
  // Estados UI
  const [vista, setVista] = useState('mapa'); 
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [puntoTemporal, setPuntoTemporal] = useState(null);
  const [modoUnion, setModoUnion] = useState(false);
  const [puntoA_Union, setPuntoA_Union] = useState(null); 
  const [puntoSeleccionado, setPuntoSeleccionado] = useState(null); 
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modoLectura, setModoLectura] = useState(false); 
  const [configTab, setConfigTab] = useState('armados');
  const [selectorColorAbierto, setSelectorColorAbierto] = useState(null);

  const [acordeonAbierto, setAcordeonAbierto] = useState('armados_vis');
  const [mapViewState, setMapViewState] = useState(null);
  const [gpsTrigger, setGpsTrigger] = useState(0);

  // Formulario
  const [memoriaUltimoPunto, setMemoriaUltimoPunto] = useState(null);
  const [datosFormulario, setDatosFormulario] = useState({
  codigo: '', suministro: '', numero: '', // <--- Añadido numero
  altura: null, fuerza: null, material: null, tipo: null, extrasSeleccionados: [], 
  armadoSeleccionado: null, cables: null, ferreteriaExtraSeleccionada: [],
  fotos: [], observaciones: ''
});
  const inputCamaraRef = useRef(null);

  // Modales
  const [modalOpen, setModalOpen] = useState(null);
  const [tempData, setTempData] = useState({});
  const [confirmData, setConfirmData] = useState(null);
  const [alertData, setAlertData] = useState(null);
  const [exportData, setExportData] = useState(null);

// 🔔 DETECTOR DE SESIÓN: Restaura el usuario al recargar la página
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usuarioFirebase) => {
      if (usuarioFirebase) {
        setUser({
          uid: usuarioFirebase.uid,
          email: usuarioFirebase.email,
          name: usuarioFirebase.displayName || usuarioFirebase.email.split('@')[0],
          photoURL: usuarioFirebase.photoURL
        });
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);


// FUNCIÓN PARA CERRAR SESIÓN REAL
  const cerrarSesion = async () => {
    try {
      await signOut(auth); // 1. Avisar a Firebase
      setUser(null);       // 2. Limpiar variable local
      setVista('mapa');    // 3. Resetear vista por si acaso
      setMenuAbierto(false);
    } catch (error) {
      console.error("Error al salir:", error);
    }
  };  

// 🔔 EFECTO: OBTENER GPS AL INICIAR
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // ¡ÉXITO! Tenemos tu ubicación real
          setMapViewState({
            center: [position.coords.latitude, position.coords.longitude],
            zoom: 18
          });
        },
        (error) => {
          console.error("Error GPS:", error);
          // SI FALLA (ej: usuario deniega permiso), usamos una por defecto (Arequipa) para que no falle la app
          setMapViewState({ center: [-16.409047, -71.537451], zoom: 15 });
        },
        { enableHighAccuracy: true }
      );
    } else {
       // Si el navegador es muy viejo
       setMapViewState({ center: [-16.409047, -71.537451], zoom: 15 });
    }
  }, []);



  // 🔔 SISTEMA DE CARGA AUTOMÁTICA (LISTENERS)
  // Se conecta a Firebase y descarga tus datos al iniciar sesión
  useEffect(() => {
    if (!user) {
      setProyectos([]); setPuntos([]); setConexiones([]);
      return;
    }

    console.log("Iniciando conexión con Firebase para UID:", user.uid);

    // 1. ESCUCHAR PROYECTOS (Quitamos el where temporalmente para probar carga total)
    const qProyectos = query(collection(db, "proyectos"), where("ownerId", "==", user.uid));
    const unsubProyectos = onSnapshot(qProyectos, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      console.log("Proyectos cargados:", docs.length);
      setProyectos(docs);
    }, (error) => console.error("Error en Proyectos:", error));

    // 2. ESCUCHAR PUNTOS
    const qPuntos = query(collection(db, "puntos"), where("ownerId", "==", user.uid));
    const unsubPuntos = onSnapshot(qPuntos, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      console.log("Puntos cargados:", docs.length);
      setPuntos(docs);
    }, (error) => console.error("Error en Puntos:", error));

    // 3. ESCUCHAR CABLES
    const qConexiones = query(collection(db, "conexiones"), where("ownerId", "==", user.uid));
    const unsubConexiones = onSnapshot(qConexiones, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setConexiones(docs);
    });

    // 4. ESCUCHAR CONFIGURACIÓN
    const configRef = doc(db, "configuraciones", user.uid);
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) setConfig(docSnap.data());
    });

    return () => { 
      unsubProyectos(); 
      unsubPuntos(); 
      unsubConexiones(); 
      unsubConfig(); 
    };
  }, [user]);

  // 🔔 AUTO-APERTURA: Si hay proyectos y no he seleccionado ninguno, abro el último
  useEffect(() => {
    if (proyectos.length > 0 && !proyectoActual) {
      // Tomamos el último proyecto de la lista (el más reciente)
      const ultimoProyecto = proyectos[proyectos.length - 1];
      seleccionarProyecto(ultimoProyecto);
    }
  }, [proyectos]);
// Función para guardar cambios en el catálogo en la nube
  const guardarConfiguracion = async (nuevaConfig) => {
    setConfig(nuevaConfig); // Actualiza la pantalla
    try { 
        await setDoc(doc(db, "configuraciones", user.uid), nuevaConfig); 
        console.log("Configuración sincronizada");
    } catch (error) { 
        console.error("Error guardando config:", error); 
    }
  };

  // --- FUNCIONES ---
  const obtenerColorDia = (diaId) => {
    for (const proy of proyectos) {
      const dia = proy.dias.find(d => d.id === diaId);
      if (dia) return dia.color;
    }
    return '#ef4444'; 
  };

  const handleMapaClick = (e) => {
    if(menuAbierto) return;
    if (modoUnion) { setPuntoA_Union(null); setModoUnion(false); return; }
    if (puntoSeleccionado) { setPuntoSeleccionado(null); return; }
    
    if(vista === 'mapa') {
      if(!diaActual) {
        if (proyectos.length === 0) setVista('proyectos');
        else setAlertData({title: "Atención", message: "Selecciona un DÍA de trabajo para empezar."});
        return;
      }
      if(!diasVisibles.includes(diaActual)) {
        setAlertData({title: "Capa Oculta", message: "El día seleccionado está oculto. Enciéndelo para ver los puntos nuevos."});
      }

      // 🔔 IMPORTANTE LEAFLET:
      // Cuando uses Leaflet, 'e' será el objeto que pasamos desde MapEvents
      if (e.latlng) {
          setPuntoTemporal({ lat: e.latlng.lat, lng: e.latlng.lng, id: Date.now(), diaId: diaActual });
      } else {
      
      // LOGICA SIMULADA (PIXELES)
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPuntoTemporal({ x, y, id: Date.now(), diaId: diaActual }); 
      
      }
    }
  };

const handlePuntoClick = async (e, puntoId) => {
    // 1. CORRECCIÓN DEL ERROR (Blindaje para Leaflet)
    // Solo intentamos detener el evento si la función existe.
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    } else if (e && e.originalEvent && typeof e.originalEvent.stopPropagation === 'function') {
      // A veces Leaflet guarda el evento real aquí
      e.originalEvent.stopPropagation();
    }

    // 2. LÓGICA DE UNIÓN (Cables)
    if (modoUnion) {
      if (!puntoA_Union) {
        setPuntoA_Union(puntoId); 
      } else {
        if (puntoA_Union !== puntoId) {
          // Crear objeto conexión
          const nuevaConexion = { 
            from: puntoA_Union, 
            to: puntoId, 
            id: Date.now(), 
            diaId: diaActual,
            proyectoId: proyectoActual.id, // Guardamos referencia

            ownerId: user.uid
          };

          // Dibujar rápido
          setConexiones([...conexiones, nuevaConexion]);
          
          // Guardar en Firebase
          try {
            await addDoc(collection(db, "conexiones"), nuevaConexion);
            console.log("Cable guardado correctamente en la nube");
          } catch (error) {
            console.error("Error al guardar el cable:", error);
          }
          
          setPuntoA_Union(null); 
          setModoUnion(false); 
        }
      }
      return;
    }

    // 3. SELECCIÓN NORMAL
    setPuntoSeleccionado(puntoId);
    setPuntoTemporal(null);
  };

  const solicitarBorrarPunto = () => {
    setConfirmData({
      title: '¿Eliminar Poste?', message: 'Se borrará permanentemente.', actionText: 'BORRAR', theme,
      onConfirm: () => {
        // 🔔 BBDD: Borrar de Firebase
        // db.collection('puntos').doc(puntoSeleccionado).delete();
        
        setPuntos(prev => prev.filter(p => p.id !== puntoSeleccionado));
        setConexiones(prev => prev.filter(c => c.from !== puntoSeleccionado && c.to !== puntoSeleccionado));
        setPuntoSeleccionado(null);
        setConfirmData(null);
      }
    });
  };

  const intentarAgregarDatos = (e) => {
    e.stopPropagation(); 
    if(puntoTemporal) abrirFormulario(); 
    else setAlertData({title: "Mapa vacío", message: "Toca el mapa primero para crear un punto (gris).", theme});
  };

// --- NUEVA FUNCIÓN: VER DETALLE ---
const verDetalle = () => {
  // 1. Buscamos el punto igual que en iniciarEdicion
  const punto = puntos.find(p => p.id === puntoSeleccionado);
  
  if(punto) {
    // 2. Cargamos los datos igual que siempre
    setDatosFormulario(JSON.parse(JSON.stringify(punto.datos)));
    
    // 3. ACTIVAMOS MODO LECTURA (Bloquea los inputs)
    setModoLectura(true); 
    
    // 4. Mostramos el formulario
    setModoEdicion(true);
    setVista('formulario');
  }
};

  const iniciarEdicion = () => {
    const punto = puntos.find(p => p.id === puntoSeleccionado);
    if(punto) {
      setDatosFormulario(JSON.parse(JSON.stringify(punto.datos)));
      setModoLectura(false);
      setModoEdicion(true);
      setVista('formulario');
    }
  };

  const abrirFormulario = () => {
    setModoEdicion(false);
    setModoLectura(false);
    if (memoriaUltimoPunto) {
      setDatosFormulario({ ...memoriaUltimoPunto, codigo: '', suministro: '', numero: '',fotos: [], observaciones: '' });
    } else {
      setDatosFormulario({ codigo: '', suministro: '', altura: null, fuerza: null, material: null, tipo: null, extrasSeleccionados: [], armadoSeleccionado: null, cables: null, ferreteriaExtraSeleccionada: [], fotos: [], observaciones: '' });
    }
    setVista('formulario');
  };

// --- NUEVA FUNCIÓN: Solo comprime y devuelve texto (Base64) ---
const prepararFoto = (blobUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = blobUrl;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024; 
      const scaleSize = MAX_WIDTH / img.width;
      
      // Ajustar tamaño
      if (scaleSize < 1) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
      } else {
          canvas.width = img.width;
          canvas.height = img.height;
      }

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // AQUÍ ESTÁ LA CLAVE: .toDataURL() devuelve el texto base64
      // Esto nos permite guardarlo en LocalStorage
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      resolve(dataUrl); 
    };
    
    img.onerror = (e) => reject(e);
  });
};


// --- FUNCIÓN GUARDAR PUNTO (CON MEMORIA Y OFFLINE) ---
const guardarPunto = async () => {
    // 1. OPTIMISTIC UI: Cerrar formulario AL INSTANTE
    setVista('mapa');
    
    // Identificar ID
    const idFinal = (modoEdicion && puntoSeleccionado) ? puntoSeleccionado : puntoTemporal.id;
    const datosPreliminares = { ...datosFormulario }; 

    // Actualizar Visualmente
    if (modoEdicion && puntoSeleccionado) {
       setPuntos(prev => prev.map(p => p.id === idFinal ? { ...p, datos: datosPreliminares } : p));
    } else {
       const pVisual = { 
          id: idFinal, diaId: diaActual, proyectoId: proyectoActual.id, ownerId: user.uid,
          coords: { lat: puntoTemporal?.lat||0, lng: puntoTemporal?.lng||0, x: puntoTemporal?.x||0, y: puntoTemporal?.y||0 },
          datos: datosPreliminares
       };
       setPuntos(prev => [...prev, pVisual]);
       setPuntoTemporal(null);
    }

    // ✅✅✅ AQUÍ ESTÁ LA MEMORIA DE SELECCIÓN (LO QUE FALTABA) ✅✅✅
    if (!modoEdicion) { 
        setMemoriaUltimoPunto({
            altura: datosFormulario.altura,
            fuerza: datosFormulario.fuerza,
            material: datosFormulario.material,
            tipo: datosFormulario.tipo,
            extrasSeleccionados: datosFormulario.extrasSeleccionados,
            armadoSeleccionado: datosFormulario.armadoSeleccionado,
            cables: datosFormulario.cables,
            ferreteriaExtraSeleccionada: datosFormulario.ferreteriaExtraSeleccionada
        });
    }

    // 2. PROCESO DE SUBIDA (Offline)
    try {
        const fotosBase64 = await Promise.all(
            datosFormulario.fotos.map(async (url) => {
                if (url.startsWith('blob:')) return await prepararFoto(url);
                return url; 
            })
        );

        const paquete = {
            modo: (modoEdicion && puntoSeleccionado) ? 'editar' : 'crear',
            coleccion: 'puntos',
            idDoc: idFinal, 
            datos: {
                 id: idFinal, diaId: diaActual, proyectoId: proyectoActual.id, ownerId: user.uid,
                 coords: { lat: puntoTemporal?.lat||0, lng: puntoTemporal?.lng||0, x: puntoTemporal?.x||0, y: puntoTemporal?.y||0 },
                 datos: { ...datosFormulario, fotos: fotosBase64 }, 
                 timestamp: new Date().toISOString()
            }
        };

        agregarTarea('guardar_punto', paquete);

    } catch (e) {
        console.error("Error al empaquetar:", e);
    }

    // Limpieza
    setModoEdicion(false);
    setPuntoSeleccionado(null);
};


const procesarFoto = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // 1. Creamos un enlace temporal local (blob:...)
      // Esto permite que la foto se vea al instante sin usar internet
      const urlLocal = URL.createObjectURL(file);
      
      // 2. Guardamos la foto en el formulario
      // (La función guardarPunto se encargará de leer este archivo y subirlo después)
      setDatosFormulario(prev => ({...prev, fotos: [...prev.fotos, urlLocal]}));
    }
  };


// --- HELPER: COMPRIMIR Y ESCALAR (Mantiene Proporción - "Contain") ---
  const comprimirImagen = (url, maxWidth = 400, maxHeight = 500) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "Anonymous"; 
      img.src = url;

      img.onload = () => {
        // 1. Calcular Factor de Escala (Para que quepa sin estirarse)
        let scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        
        // Si la imagen es pequeña, no la agrandamos (scale = 1), o sí? 
        // Mejor siempre respetamos el límite máximo.
        if (scale > 1) scale = 1; // Opcional: quitar si quieres agrandar fotos pequeñas

        const finalWidth = Math.floor(img.width * scale);
        const finalHeight = Math.floor(img.height * scale);

        // 2. Crear Canvas con dimensiones exactas reescaladas
        const canvas = document.createElement('canvas');
        canvas.width = finalWidth;
        canvas.height = finalHeight;
        const ctx = canvas.getContext('2d');
        
        // Suavizado de imagen
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high'; 
        ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

        // 3. Exportar
        canvas.toBlob(async (blob) => {
           if (blob) {
             const buffer = await blob.arrayBuffer();
             // DEVOLVEMOS EL BUFFER Y LAS MEDIDAS PIXEL EXACTAS
             resolve({ buffer, width: finalWidth, height: finalHeight });
           } else {
             reject(new Error("Error compresión"));
           }
        }, 'image/jpeg', 0.9); // Calidad alta
      };

      img.onerror = (err) => reject(err);
    });
  };
  

  const pedirLogo = () => {
  return new Promise((resolve) => {
    // Si prefieres no usar el confirm del sistema, eliminamos la pregunta
    // y abrimos directamente la galería. Si el usuario cierra sin elegir, resolve(null).
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result);
        reader.readAsDataURL(file);
      } else {
        resolve(null);
      }
    };
    // Pequeño delay para asegurar que el hilo de ejecución esté libre
    setTimeout(() => input.click(), 100);
  });
};

const comprimirYEstampar = (url, maxWidth, maxHeight, datos, logoBase64) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > h) { if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; } }
      else { if (h > maxHeight) { w *= maxHeight / h; h = maxHeight; } }

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      if (datos) {
        const cajaAlto = h * 0.10; // Reducido 15% adicional (Franja muy fina)
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(0, h - cajaAlto, w, cajaAlto);

        const zona1 = w * 0.25;
        const zona2 = w * 0.50;
        const xDiv2 = zona1 + zona2;

        // 1. NÚMERO (Amarillo)
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${cajaAlto * 0.65}px Arial`;
        ctx.fillText(String(datos.numero || '000').padStart(3, '0'), zona1/2, h - (cajaAlto/2));

        // 2. TEXTO CENTRAL
        const fSizeBase = cajaAlto * 0.25;
        const xCentro = zona1 + (zona2 / 2);
        
        // Proyecto (Amarillo, negrita, tamaño original)
        ctx.fillStyle = "#fbbf24";
        ctx.font = `bold ${fSizeBase}px Arial`;
        ctx.fillText((datos.proyecto || '').toUpperCase(), xCentro, h - (cajaAlto * 0.7));

        // GPS y Fecha (Blanco, más pequeños)
        ctx.fillStyle = "white";
        ctx.font = `${fSizeBase * 0.75}px Arial`;
        ctx.fillText(datos.gps, xCentro, h - (cajaAlto * 0.45));
        ctx.fillText(new Date().toLocaleDateString(), xCentro, h - (cajaAlto * 0.2));

        // 3. LOGO (Más pequeño, 50% del alto de la franja)
        if (logoBase64) {
          const imgLogo = new Image();
          imgLogo.src = logoBase64;
          imgLogo.onload = () => {
            const altoL = cajaAlto * 0.5; // Tamaño reducido
            const anchoL = imgLogo.width * (altoL / imgLogo.height);
            ctx.drawImage(imgLogo, xDiv2 + (zona1/2) - (anchoL/2), h - (cajaAlto/2) - (altoL/2), anchoL, altoL);
            finalizar();
          };
          imgLogo.onerror = () => finalizar();
        } else { finalizar(); }
      } else { finalizar(); }

      function finalizar() {
        canvas.toBlob((b) => {
          const reader = new FileReader();
          reader.readAsArrayBuffer(b);
          reader.onloadend = () => resolve({ buffer: reader.result, width: w, height: h });
        }, "image/jpeg", 0.9);
      }
    };
  });
};


  // =========================================================
  // 2. NUEVA FUNCIÓN: COMPARTIR O DESCARGAR
  // =========================================================
  const compartirODescargar = async (blob, nombre) => {
    // Si es celular y soporta compartir
    if (navigator.canShare && navigator.share) {
      try {
        const file = new File([blob], nombre, { type: blob.type });
        await navigator.share({ files: [file], title: nombre });
        return; 
      } catch (e) { console.log("Cancelado o error, descargando..."); }
    }
    // Si es PC
    saveAs(blob, nombre);
  };

const descargarReporteExcel = async (proy) => {
  if (!proy) return;
  const logoUser = await pedirLogo(); // Ahora usa tu aviso personalizado
  const workbook = new ExcelJS.Workbook();
  const wsDatos = workbook.addWorksheet('1. DATOS', { views: [{state: 'frozen', ySplit: 1}] });
  const wsFotos = workbook.addWorksheet('2. FOTOS');

  wsFotos.columns = [{ width: 25 }, { width: 55 }, { width: 55 }, { width: 55 }, { width: 55 }];
  
  // 1. Columnas según tu lista exacta
  wsDatos.columns = [
    { header: 'ITEM', key: 'item', width: 7 },
    { header: 'NRO', key: 'numero', width: 12 },
    { header: 'CÓDIGO', key: 'codigo', width: 15 },
    { header: 'LATITUD', key: 'lat', width: 15 },
    { header: 'LONGITUD', key: 'lng', width: 15 },
    { header: 'GPS (Concat)', key: 'gps', width: 25 },
    { header: 'SUMINISTRO', key: 'sum', width: 15 },
    { header: 'TIPO RED', key: 'tipo', width: 12 },
    { header: 'MATERIAL', key: 'mat', width: 12 },
    { header: 'ALTURA', key: 'alt', width: 10 },
    { header: 'FUERZA', key: 'fuerza', width: 10 },
    { header: 'CABLES', key: 'cables', width: 10 },
    { header: 'ARMADO', key: 'arm', width: 25 },
    { header: 'EXTRAS', key: 'extras', width: 30 },
    { header: 'FERRETERÍA EXTRA', key: 'ferr', width: 30 },
    { header: 'OBSERVACIONES', key: 'obs', width: 35 },
  ];

  // Estilo de encabezado (Azul profesional)
  const headerRow = wsDatos.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { horizontal: 'center' };
  });

  let filaGaleria = 1;
  const pts = puntos.filter(p => proy.dias.some(d => d.id === p.diaId));

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const valNum = p.datos.numero || '-';
    const lat = (p.coords.lat || 0).toFixed(6);
    const lng = (p.coords.lng || 0).toFixed(6);

    const row = wsDatos.getRow(i + 2);
    row.values = {
      item: i + 1,
      numero: valNum,
      codigo: p.datos.codigo || '-',
      lat: Number(lat),
      lng: Number(lng),
      gps: `${lat}, ${lng}`,
      sum: p.datos.suministro || '-',
      tipo: p.datos.tipo || '-',
      mat: p.datos.material || '-',
      alt: p.datos.altura || '-',
      fuerza: p.datos.fuerza || '-',
      cables: p.datos.cables || '-',
      arm: config.armados.find(a => a.id === p.datos.armadoSeleccionado?.idArmado)?.nombre || '-',
      // CONCATENACIÓN DE EXTRAS
      extras: Array.isArray(p.datos.extrasSeleccionados) ? p.datos.extrasSeleccionados.join(', ') : '-',
      ferr: Array.isArray(p.datos.ferreteriaExtraSeleccionada) ? p.datos.ferreteriaExtraSeleccionada.join(', ') : '-',
      obs: p.datos.observaciones || '-'
    };

    if (valNum !== '-') {
      const cell = row.getCell('numero');
      cell.value = { text: valNum, hyperlink: `#'2. FOTOS'!A${filaGaleria}` };
      cell.font = { color: { argb: 'FF0000FF' }, underline: true, bold: true };
    }

    // Hoja de Fotos (Título Poste con color)
    wsFotos.getRow(filaGaleria).height = 400;
    const cellTit = wsFotos.getCell(filaGaleria, 1);
    cellTit.value = `POSTE ${valNum}`;
    cellTit.font = { size: 20, bold: true, color: { argb: 'FF1F4E78' } };
    cellTit.alignment = { vertical: 'middle', horizontal: 'center' };

    if (p.datos.fotos) {
      for (let j = 0; j < p.datos.fotos.length; j++) {
        try {
          const res = await comprimirYEstampar(p.datos.fotos[j], 500, 500, {
            numero: valNum, proyecto: proy.nombre, gps: `${lat}, ${lng}`
          }, logoUser);
          const imgId = workbook.addImage({ buffer: res.buffer, extension: 'jpeg' });
          wsFotos.addImage(imgId, { tl: { col: j + 1, row: filaGaleria - 1 }, ext: { width: res.width, height: res.height } });
        } catch (e) {}
      }
    }
    filaGaleria++;
  }
  const buffer = await workbook.xlsx.writeBuffer();
  compartirODescargar(new Blob([buffer]), `Reporte_${proy.nombre}.xlsx`);
};

const descargarFotosZip = async (proy) => {
  if (!proy) return;
  const logoUser = await pedirLogo();
  
  const zip = new JSZip();
  // Carpeta Raíz con nombre del proyecto
  const nombreCarpetaRaiz = proy.nombre.replace(/\s+/g, '_').toUpperCase();
  const root = zip.folder(nombreCarpetaRaiz);
  
  const pts = puntos.filter(p => proy.dias.some(d => d.id === p.diaId));
  const contadores = {};

  for (const p of pts) {
    let numOriginal = String(p.datos.numero || 'SN');
    let numCarpeta = numOriginal;

    // Lógica de letras para repetidos (a, b, c...)
    if (contadores[numOriginal]) {
      const letra = String.fromCharCode(96 + contadores[numOriginal]);
      numCarpeta = `${numOriginal}${letra}`;
      contadores[numOriginal]++;
    } else {
      contadores[numOriginal] = 1;
    }

    const carpetaPoste = root.folder(numCarpeta); // Carpeta solo con NRO poste
    const gpsStr = `${(p.coords.lat||0).toFixed(6)}, ${(p.coords.lng||0).toFixed(6)}`;

    if (p.datos.fotos) {
      for (let i = 0; i < p.datos.fotos.length; i++) {
        const res = await comprimirYEstampar(p.datos.fotos[i], 900, 900, {
          numero: p.datos.numero, proyecto: proy.nombre, gps: gpsStr
        }, logoUser);
        carpetaPoste.file(`Foto_${i+1}.jpg`, res.buffer);
      }
    }
  }
  const content = await zip.generateAsync({ type: "blob" });
  compartirODescargar(content, `FOTOS_${nombreCarpetaRaiz}.zip`);
};


// --- 🚀 EXPORTACIÓN KML FINAL (Diseño EVA Digital + Posición Natural) ---
  const handleExportKML = async (proyParam) => {
    const proy = proyParam || (exportData && exportData.proyecto);
    if (!proy) return;

    // 1. Pedir Logo
    const logoBase64 = await pedirLogo(); 

    const ptsProy = puntos.filter(p => proy.dias.some(d => d.id === p.diaId));
    const conProy = conexiones.filter(c => proy.dias.some(d => d.id === c.diaId));
    const fileName = `${proy.nombre.replace(/\s+/g, '_')}_Kipo.kml`;

    // --- 2. EL HTML DEL AVISO (Colores de Marca + Ubicación Simple) ---
    const urlWeb = "https://www.evadigitalgroup.com/index.html";
    
    // Paleta de colores:
    // EVA: #FCBF26 (Amarillo)
    // Digital/Fondo: #100F1D (Oscuro)

    const htmlPopup = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
            background-color: #f0f2f5;
            margin: 0;
            padding: 20px; /* Margen natural arriba a la izquierda */
          }
          .card {
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 380px;
            overflow: hidden; /* Para que el header respete el borde */
            border: 1px solid #ddd;
          }
          .header {
            background-color: #100F1D; /* Color Oscuro Corporativo */
            padding: 20px;
            text-align: center;
          }
          .brand-eva {
            color: #FCBF26; /* Color Amarillo Corporativo */
            font-weight: 900;
            font-size: 24px;
            letter-spacing: 1px;
          }
          .brand-digital {
            color: #ffffff;
            font-weight: 300;
            font-size: 24px;
          }
          .content {
            padding: 25px;
            text-align: center;
            color: #444;
          }
          p { font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
          
          .link-box {
            background-color: #f8f9fa;
            border: 1px dashed #100F1D; /* Borde con el color de la marca */
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 20px;
            font-family: monospace;
            font-size: 12px;
            color: #333;
            word-break: break-all;
            user-select: all;
          }
          .copy-btn {
            background-color: #100F1D; /* Botón oscuro */
            color: #FCBF26; /* Texto amarillo */
            border: none;
            padding: 12px 25px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: opacity 0.2s;
          }
          .copy-btn:hover { opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <span class="brand-eva">EVA</span> <span class="brand-digital">Digital</span>
          </div>
          
          <div class="content">
            <p>
              <strong>¡Hola!</strong> Si te interesa conocer más sobre nuestras soluciones de ingeniería, diseño de redes y software especializado, visita nuestra web:
            </p>
            
            <div class="link-box" onclick="selectText(this)">${urlWeb}</div>
            
            <button class="copy-btn" onclick="copyLink()">
              COPIAR ENLACE
            </button>
          </div>
        </div>

        <script>
          function selectText(element) {
            const range = document.createRange();
            range.selectNodeContents(element);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          }
          function copyLink() {
            const linkText = document.querySelector('.link-box').innerText;
            const textArea = document.createElement("textarea");
            textArea.value = linkText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            
            const btn = document.querySelector('.copy-btn');
            const originalText = btn.innerText;
            btn.innerText = '¡COPIADO!';
            btn.style.backgroundColor = '#27ae60'; // Verde temporal
            btn.style.color = '#fff';
            setTimeout(() => {
              btn.innerText = originalText;
              btn.style.backgroundColor = '#100F1D'; // Vuelve al color marca
              btn.style.color = '#FCBF26';
            }, 2000);
          }
        </script>
      </body>
      </html>
    `;
    
    const hrefAviso = `data:text/html;charset=utf-8,${encodeURIComponent(htmlPopup)}`;

    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${proy.nombre}</name>
    
    <Style id="posteStyle">
      <IconStyle>
        <color>ff00ffff</color>
        <scale>1.0</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
      <LabelStyle><color>ff00ffff</color><scale>1.0</scale></LabelStyle>
      <BalloonStyle><text>$[description]</text></BalloonStyle>
    </Style>

    <Style id="lineaStyle">
      <LineStyle><color>ffff0000</color><width>3</width></LineStyle>
    </Style>

    <Folder>
      <name>Puntos</name>`;

    ptsProy.forEach(p => {
      const lng = p.coords.lng.toFixed(6);
      const lat = p.coords.lat.toFixed(6);
      const cantFotos = p.datos.fotos ? p.datos.fotos.length : 0;
      
      let fotosHtml = "";
      if (cantFotos > 0) {
        // Reiniciamos variable para evitar duplicidad
        fotosHtml = `<div style="width:260px; overflow-x:auto; white-space:nowrap; margin-top:4px;">`;
        p.datos.fotos.forEach(url => {
          fotosHtml += `<img src="${url}" style="width:250px; display:inline-block; margin-right:5px; border-radius:2px;"/>`;
        });
        fotosHtml += `</div>`;
      }

      kml += `
      <Placemark>
        <name>${p.datos.numero || 's/n'}</name>
        <Snippet maxLines="0"></Snippet>
        <styleUrl>#posteStyle</styleUrl>
        <description><![CDATA[
          <div style="font-family:Segoe UI, Arial; width:260px; color:#333;">
            
            <table style="width:100%; border-collapse:collapse;">
              <tr>
                <td style="text-align:left; vertical-align:top; width:55%;">
                  <div style="font-size:10px; color:#555; margin-bottom:1px;"><b>PROYECTO / PLANO:</b></div>
                  <div style="font-size:14px; font-weight:bold; color:#000; line-height:1.1; margin-bottom:4px;">
                    ${proy.nombre.toUpperCase()}
                  </div>
                  <div style="font-size:10px; color:#555;"><b>NRO:</b> ${p.datos.numero || 'S/N'}</div>
                  <div style="font-size:10px; color:#555;"><b>COD:</b> ${p.datos.codigo || 'S/C'}</div>
                  <div style="font-size:10px; color:#555;"><b>SUM:</b> ${p.datos.suministro || '-'}</div>
                </td>
                <td style="text-align:center; vertical-align:middle; width:45%;">
                  ${logoBase64 ? 
                    `<img src="${logoBase64}" style="width:100%; max-width:110px; max-height:90px; object-fit:contain;"/>` 
                    : ''}
                </td>
              </tr>
            </table>

            <hr style="border:0; border-top:1px solid #ddd; margin: 4px 0;">

            <table style="width:100%; font-size:9px; color:#444; margin-bottom:2px;">
              <tr>
                <td style="width:50%;"><b>ARMADO:</b> ${p.datos.armadoSeleccionado?.idArmado || '-'}</td>
                <td><b>RED:</b> ${p.datos.tipo || '-'}</td>
              </tr>
              <tr>
                <td><b>ALTURA:</b> ${p.datos.altura || '-'}m</td>
                <td><b>FUERZA:</b> ${p.datos.fuerza || '-'}</td>
              </tr>
              <tr>
                <td><b>MATERIAL:</b> ${p.datos.material || '-'}</td>
                <td><b>CABLES:</b> ${p.datos.cables || '-'}</td>
              </tr>
            </table>

            <hr style="border:0; border-top:1px solid #ddd; margin: 4px 0;">

            <div style="font-size:10px; color:#aaa; margin-bottom:2px;">
              COOR: ${lat}, ${lng} <span style="float:right; font-size:9px;">[${cantFotos} FOTOS]</span>
            </div>

            ${fotosHtml}

            <div style="margin-top:6px; padding-top:4px; border-top:1px solid #eee; font-size:9px; color:#aaa; text-align:center;">
              KMZ elaborado por Kipo, App de 
              <a href="${hrefAviso}" style="color:#aaa; text-decoration:underline; font-weight:bold;">EVA Digital</a>
            </div>
          </div>
        ]]></description>
        <Point><coordinates>${lng},${lat},0</coordinates></Point>
      </Placemark>`;
    });

    kml += `</Folder><Folder><name>Líneas</name>`;
    conProy.forEach(c => {
      const pA = puntos.find(p => p.id === c.from);
      const pB = puntos.find(p => p.id === c.to);
      if(pA && pB) {
        kml += `<Placemark><Snippet maxLines="0"></Snippet><styleUrl>#lineaStyle</styleUrl><LineString><tessellate>1</tessellate><coordinates>${pA.coords.lng.toFixed(6)},${pA.coords.lat.toFixed(6)},0 ${pB.coords.lng.toFixed(6)},${pB.coords.lat.toFixed(6)},0</coordinates></LineString></Placemark>`;
      }
    });
    kml += `</Folder></Document></kml>`;

    compartirODescargar(new Blob([kml]), fileName);
    if(setExportData) setExportData(null);
  };

  // --- PROYECTOS ---
  const confirmarCrearProyecto = async () => {
    if(!tempData.nombre) return;
    
    // 1. Preparar datos
    const tipo = tempData.tipo || 'levantamiento';
    const diaUno = { id: `d_${Date.now()}`, nombre: 'Día 1', fecha: new Date().toLocaleDateString(), color: '#ef4444' };
    
    // Usamos el ID como String para que sea compatible con todo
    const idProyecto = String(Date.now());

    const nuevo = { 
        id: idProyecto, 
        nombre: tempData.nombre, 
        tipo, 
        dias: [diaUno], 
        ownerId: user.uid // 🔒 IMPORTANTE: Solo tú puedes ver este proyecto
    };

    // 2. Actualizar visualmente (Rápido)
    setProyectos([...proyectos, nuevo]);
    setProyectoActual(nuevo);
    setDiaActual(diaUno.id);
    setDiasVisibles([...diasVisibles, diaUno.id]);
    setModalOpen(null);

    // 3. 🔔 GUARDAR EN FIREBASE
    try {
        // Usamos setDoc para nosotros decidir el ID (el mismo Date.now) y que sea fácil buscarlo luego
        await setDoc(doc(db, "proyectos", idProyecto), nuevo);
        console.log("Proyecto creado en la nube");
    } catch (error) {
        console.error("Error al crear proyecto:", error);
    }
  };
  
const confirmarCrearDia = async () => {
    if(!tempData.nombre || !proyectoActual) return;
    
    // 1. Crear el nuevo día
    const nuevoDia = { id: `d_${Date.now()}`, nombre: tempData.nombre, fecha: new Date().toLocaleDateString(), color: '#ef4444' };
    
    // 2. Actualizar el objeto proyecto localmente
    const proyActualizado = { ...proyectoActual, dias: [...proyectoActual.dias, nuevoDia] };
    
    // 3. Actualizar estado visual
    setProyectos(proyectos.map(p => p.id === proyectoActual.id ? proyActualizado : p));
    setProyectoActual(proyActualizado); 
    setDiaActual(nuevoDia.id);
    setDiasVisibles([...diasVisibles, nuevoDia.id]);
    setModalOpen(null);

    // 4. 🔔 ACTUALIZAR EN FIREBASE
    try {
        // Buscamos el proyecto en la base de datos por su ID
        const proyectoRef = doc(db, "proyectos", String(proyectoActual.id));
        
        // Solo actualizamos la lista de días (no tocamos el nombre ni el tipo)
        await updateDoc(proyectoRef, { dias: proyActualizado.dias });
        console.log("Nuevo día guardado en la nube");
    } catch (error) {
        console.error("Error al guardar el día:", error);
    }
  };

const seleccionarProyecto = (proy) => {
    setProyectoActual(proy);
    if (proy.dias && proy.dias.length > 0) {
      const ultimoDia = proy.dias[proy.dias.length - 1];
      setDiaActual(ultimoDia.id);
      
      // EXPLICACIÓN: Esto asegura que al abrir un proyecto, sus días se vuelvan visibles
      const idsNuevos = proy.dias.map(d => d.id);
      setDiasVisibles(prev => [...new Set([...prev, ...idsNuevos])]);
    } else { 
      setDiaActual(null); 
    }
  };

  const toggleVisibilidadDia = (diaId) => {
    if(diasVisibles.includes(diaId)) setDiasVisibles(diasVisibles.filter(d => d !== diaId));
    else setDiasVisibles([...diasVisibles, diaId]);
  };

  const toggleVisibilidadProyecto = (e, proy) => {
    e.stopPropagation();
    const idsDiasProyecto = proy.dias.map(d => d.id);
    const todosVisibles = idsDiasProyecto.every(id => diasVisibles.includes(id));
    if (todosVisibles) setDiasVisibles(diasVisibles.filter(id => !idsDiasProyecto.includes(id)));
    else setDiasVisibles([...new Set([...diasVisibles, ...idsDiasProyecto])]);
  };

  const cambiarColorDia = (proyId, diaId, color) => {
    setProyectos(prev => prev.map(p => p.id === proyId ? { ...p, dias: p.dias.map(d => d.id === diaId ? { ...d, color } : d) } : p));
    if(proyectoActual?.id === proyId) setProyectoActual(prev => ({ ...prev, dias: prev.dias.map(d => d.id === diaId ? { ...d, color } : d) }));
  };

const cambiarColorProyecto = (e, proyId, color) => {
    e.stopPropagation();
    setProyectos(prev => prev.map(p => p.id === proyId ? { 
        ...p, 
        colorGlobal: color, // <--- ESTO FALTABA (Guardar el color en el proyecto)
        dias: p.dias.map(d => ({ ...d, color })) // Actualiza todos los días
    } : p));
    
    // Si es el actual, actualizamos también el estado individual
    if(proyectoActual?.id === proyId) {
        setProyectoActual(prev => ({ 
            ...prev, 
            colorGlobal: color, 
            dias: prev.dias.map(d => ({ ...d, color })) 
        }));
    }
  };

const solicitarBorrarProyecto = (proyId) => {
    setConfirmData({
      title: '¿Eliminar Proyecto?', 
      message: 'Se borrará el proyecto y TODOS sus puntos permanentemente de la base de datos.', 
      actionText: 'ELIMINAR TODO', 
      theme,
      onConfirm: async () => {
        // 1. Ocultar inmediatamente (Feedback visual rápido)
        const proyecto = proyectos.find(p => p.id === proyId);
        if (proyecto) {
           // Filtramos visualmente para que desaparezca ya
           const idsDias = proyecto.dias ? proyecto.dias.map(d => d.id) : [];
           setPuntos(prev => prev.filter(p => !idsDias.includes(p.diaId)));
           setConexiones(prev => prev.filter(c => !idsDias.includes(c.diaId)));
        }
        setProyectos(prev => prev.filter(p => p.id !== proyId));
        if(proyectoActual?.id === proyId) { setProyectoActual(null); setDiaActual(null); }
        setConfirmData(null);

        // 2. 🔔 BORRADO REAL EN FIREBASE (Esto es lo que faltaba)
        try {
          const batch = writeBatch(db);

          // A. Borrar el documento del Proyecto
          const proyRef = doc(db, "proyectos", proyId);
          batch.delete(proyRef);

          // B. Borrar Puntos asociados (Para no dejar basura)
          // Nota: Buscamos por proyectoId para asegurar que borramos todo lo de ese proyecto
          const qPuntos = query(collection(db, "puntos"), where("proyectoId", "==", proyId));
          const snapPuntos = await getDocs(qPuntos);
          snapPuntos.forEach((docPunto) => batch.delete(docPunto.ref));

          // C. Borrar Cables asociados
          const qCables = query(collection(db, "conexiones"), where("proyectoId", "==", proyId));
          const snapCables = await getDocs(qCables);
          snapCables.forEach((docCable) => batch.delete(docCable.ref));

          // Ejecutar borrado masivo
          await batch.commit();
          console.log("Proyecto eliminado correctamente de la nube.");

        } catch (error) {
          console.error("Error al borrar de Firebase:", error);
          alert("Ocurrió un error al borrar de la nube, revisa tu conexión.");
        }
      }
    });
  };

// --- FILTROS DE VISIBILIDAD ---
  const puntosVisiblesMapa = puntos.filter(p => {
    const esVisible = diasVisibles.includes(p.diaId);
    // Extra: Aseguramos que el proyecto padre también exista (para evitar fantasmas)
    const proyectoExiste = proyectos.some(proy => proy.id === p.proyectoId);
    return esVisible && proyectoExiste;
  });

  const conexionesVisiblesMapa = conexiones.filter(c => {
    const esVisible = diasVisibles.includes(c.diaId);
    const proyectoExiste = proyectos.some(proy => proy.id === c.proyectoId);
    return esVisible && proyectoExiste;
  });



// ✅ USAMOS EL NUEVO LOGIN
if (!user) return <Login onLogin={setUser} />;

  return (
    <div className={`h-screen w-full flex flex-col ${theme.bg} ${theme.text} font-sans overflow-hidden select-none relative transition-colors duration-300`}>
      
    {/* HEADER COMPLETO (RESTAURADO + GPS) */}
      <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} z-[50] relative shrink-0 h-16`}>
        
        {/* LADO IZQUIERDO: MENÚ + TEXTO CORRECTO */}
        <div className="flex items-center gap-3 overflow-hidden">
             <button onClick={() => setMenuAbierto(true)}>
               <Menu size={28} className={theme.text} strokeWidth={2.5}/>
             </button>
             
             <div className="flex flex-col justify-center">
               {proyectoActual ? (
                 <>
                   <h1 className={`font-black text-lg uppercase tracking-tight leading-none ${theme.text}`}>
                     {proyectoActual.nombre}
                   </h1>
                   <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest truncate">
                     {diaActual ? (proyectoActual?.dias?.find(d => d.id === diaActual)?.nombre || 'DÍA SELECCIONADO') : 'SELECCIONA DÍA'}
                   </span>
                 </>
               ) : (
                 // TEXTO GRIS Y PEQUEÑO (COMO QUERÍAS)
                 <span className="text-xs font-bold text-slate-400 italic uppercase tracking-wider">
                   Sin Proyecto Seleccionado
                 </span>
               )}
             </div>
        </div>

{/* LADO DERECHO: TODAS LAS HERRAMIENTAS */}
        <div className="flex items-center gap-2">
           
   {/* --- 0. INDICADOR DE SINCRONIZACIÓN (CORREGIDO Y EXCLUSIVO) --- */}
           <div className={`
             flex items-center justify-center w-10 h-10 rounded-xl border-2 transition-all duration-300 relative
             ${estadoSync === 'synced' 
                ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' // OPCIÓN A: VERDE
                : estadoSync === 'syncing' 
                  ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400'  // OPCIÓN B: AMARILLO
                  : estadoSync === 'offline' 
                    ? 'bg-slate-700/50 border-slate-600 text-slate-500'      // OPCIÓN C: GRIS
                    : `${theme.bg} ${theme.border} text-slate-400`            // OPCIÓN D: DEFAULT
             }
           `}>
             {estadoSync === 'syncing' && <RefreshCw size={20} className="animate-spin" />}
             {estadoSync === 'synced' && <Cloud size={20} />}
             {estadoSync === 'offline' && <CloudOff size={20} />}
             
             {cola.length > 0 && (
               <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white z-10 shadow-sm border border-white/20">
                 {cola.length}
               </span>
             )}
           </div>

           {/* 1. BOTÓN GPS */}
           <button 
             onClick={() => setGpsTrigger(t => t + 1)} 
             className={`p-2 rounded-xl border-2 font-bold transition-all active:scale-95 ${theme.bg} ${theme.text} ${theme.border}`}
             title="Ir a mi ubicación"
           >
             <Navigation size={20} className={theme.text} fill="currentColor" />
           </button>

           {/* 2. ETIQUETAS */}
           <button 
             onClick={() => setMostrarEtiquetas(!mostrarEtiquetas)} 
             className={`p-2 rounded-xl border-2 font-bold transition-all active:scale-95 ${mostrarEtiquetas ? 'bg-brand-50 border-brand-500 text-brand-600' : `${theme.bg} ${theme.text} ${theme.border}`}`}
           >
             <Tag size={20} />
           </button>

           {/* 3. TEMA LUNA/SOL */}
           <button 
             onClick={() => setIsDark(!isDark)} 
             className={`p-2 rounded-xl border-2 font-bold transition-all active:scale-95 ${theme.bg} ${theme.text} ${theme.border}`}
           >
             {isDark ? <Sun size={20} /> : <Moon size={20} />}
           </button>

           {/* 4. ZOOM / LUPAS */}
           <div className={`flex items-center border-2 ${theme.border} rounded-xl overflow-hidden ${theme.bg}`}>
              <button 
                onClick={() => setIconSize(s => Math.max(0.5, s - 0.2))}
                className={`p-2 hover:bg-black/5 active:bg-black/10 border-r ${theme.border} ${theme.text}`}
              >
                <ZoomOut size={20} />
              </button>
              <button 
                onClick={() => setIconSize(s => Math.min(2.5, s + 0.2))}
                className={`p-2 hover:bg-black/5 active:bg-black/10 ${theme.text}`}
              >
                <ZoomIn size={20} />
              </button>
           </div>

        </div>

      </div>

      {/* SIDEBAR */}
      {menuAbierto && (
        <div className="absolute inset-0 z-[2000] flex">
          <div className={`w-4/5 max-w-xs ${theme.card} border-r-2 ${theme.border} h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200`}>
            <div className="p-6 bg-brand-600 text-white mb-2">
              <h2 className="text-2xl font-black">Menú Kipo</h2>
              <p className="text-xs text-brand-200">{user.name}</p>
            </div>
            <nav className="flex-1 p-2 space-y-2 overflow-y-auto">
              <BotonMenu icon={<MapPin size={24}/>} label="Mapa Principal" active={vista==='mapa'} onClick={()=>{ setVista('mapa'); setMenuAbierto(false); }} theme={theme} />
              <BotonMenu icon={<Folder size={24}/>} label="Gestionar Proyectos" active={vista.includes('proyectos')} onClick={()=>{setVista('proyectos'); setMenuAbierto(false)}} theme={theme} />
              <BotonMenu icon={<Settings size={24}/>} label="Configuración" active={vista==='config'} onClick={()=>{setVista('config'); setMenuAbierto(false)}} theme={theme} />
              
              <div className={`pt-4 border-t-2 ${theme.border} mt-4`}>
                 <p className={`px-4 text-xs ${theme.text} font-black mb-2`}>ESTILO DE MAPA</p>
                 <button onClick={() => setMapStyle('vector')} className={`w-full flex items-center px-4 py-3 text-sm font-bold ${mapStyle === 'vector' ? theme.activeItem : theme.inactiveItem}`}>
                   <Layers size={18} className="mr-3"/> Vectorial
                 </button>
                 <button onClick={() => setMapStyle('satellite')} className={`w-full flex items-center px-4 py-3 text-sm font-bold ${mapStyle === 'satellite' ? theme.activeItem : theme.inactiveItem}`}>
                   <Camera size={18} className="mr-3"/> Satelital
                 </button>
              </div>
            </nav>
            <button 
              onClick={cerrarSesion} 
              className={`m-4 p-4 rounded-xl ${theme.bg} text-red-600 font-bold flex items-center justify-center gap-2 border-2 ${theme.border}`}
            >
              <LogOut size={20} /> CERRAR SESIÓN
            </button>
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMenuAbierto(false)}></div>
        </div>
      )}

{/* VISTA MAPA (LIMPIA Y SIN BOTONES FLOTANTES EXTRA) */}
      {vista === 'mapa' && (
        <div className="flex-1 relative h-full w-full overflow-hidden">
            
            {/* 1. LÓGICA DE CARGA: Si hay coordenadas, mostramos mapa */}
            {mapViewState ? (
                <MapaReal 
                    theme={theme}
                    mapStyle={mapStyle}
                    handleMapaClick={handleMapaClick}
                    puntosVisiblesMapa={puntosVisiblesMapa}
                    iconSize={iconSize}
                    obtenerColorDia={obtenerColorDia}
                    puntoSeleccionado={puntoSeleccionado}
                    handlePuntoClick={handlePuntoClick}
                    puntoTemporal={puntoTemporal}
                    modoUnion={modoUnion}
                    puntoA_Union={puntoA_Union}
                    conexionesVisiblesMapa={conexionesVisiblesMapa}
                    mostrarEtiquetas={mostrarEtiquetas}
                    viewState={mapViewState}      
                    setViewState={setMapViewState} 
                    gpsTrigger={gpsTrigger}
                    yaSaltoAlInicio={yaSaltoAlInicio}
                    setYaSaltoAlInicio={setYaSaltoAlInicio}
                />
            ) : (
                // PANTALLA DE CARGA (Mientras busca GPS)
                <div className={`h-full w-full flex flex-col items-center justify-center ${theme.bg} ${theme.text}`}>
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-500 mb-6"></div>
                    <h3 className="text-xl font-black tracking-widest animate-pulse">LOCALIZANDO...</h3>
                    <p className="text-sm opacity-60 mt-2">Esperando señal GPS</p>
                </div>
            )}

            {/* --- BARRA INFERIOR (SOLO ESTO SE QUEDA) --- */}
             <div className={`absolute bottom-0 left-0 right-0 h-20 bg-white border-t-2 border-slate-200 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-[400] flex overflow-hidden`}>
              
              {puntoSeleccionado ? (
                  // --- CASO A: PUNTO SELECCIONADO ---
                  <>
                    <button onClick={verDetalle} className="flex-1 bg-white text-slate-800 font-black text-lg flex items-center justify-center gap-2 active:bg-slate-100 transition-colors">
                      <Eye size={24} strokeWidth={2.5}/> VER
                    </button>
                    <div className="w-[2px] h-10 self-center bg-slate-300 rounded-full"></div>
                    <button onClick={iniciarEdicion} className="flex-1 bg-white text-slate-800 font-black text-lg flex items-center justify-center gap-2 active:bg-slate-100 transition-colors">
                      <Edit3 size={24} strokeWidth={2.5}/> EDITAR
                    </button>
                    <div className="w-[2px] h-10 self-center bg-slate-300 rounded-full"></div>
                    <button onClick={solicitarBorrarPunto} className="w-20 bg-white text-red-600 font-black flex flex-col items-center justify-center active:bg-red-50 transition-colors">
                      <Trash2 size={26} strokeWidth={2.5}/> 
                      <span className="text-[9px] mt-1 tracking-widest">BORRAR</span>
                    </button>
                  </>
              ) : (
                  // --- CASO B: MAPA NORMAL ---
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setModoUnion(!modoUnion); setPuntoA_Union(null); }} className={`flex-1 flex items-center justify-center gap-2 font-black text-lg ${modoUnion ? 'bg-yellow-400 text-black' : 'bg-white text-slate-800 hover:text-black active:bg-slate-100'}`}>
                      <LinkIcon size={24} strokeWidth={2.5} /> {modoUnion ? 'CANCELAR' : 'UNIR'}
                    </button>
                    <div className="w-[2px] h-10 self-center bg-slate-300 rounded-full"></div>
                    <button onClick={intentarAgregarDatos} className={`flex-1 flex items-center justify-center gap-2 font-black text-lg ${puntoTemporal ? 'bg-brand-600 text-white' : 'bg-white text-slate-800 hover:text-black active:bg-slate-100'}`}>
                      <Plus size={24} strokeWidth={2.5} /> AGREGAR
                    </button>
                  </>
              )}
            </div>

            {/* Aviso Modo Unión */}
            {modoUnion && <div className="absolute top-24 left-0 right-0 flex justify-center pointer-events-none z-40"><div className="bg-yellow-400 text-black px-4 py-2 rounded-full text-xs font-bold shadow-lg border-2 border-yellow-600 animate-pulse">{puntoA_Union ? 'TOCA EL SEGUNDO POSTE' : 'SELECCIONA EL PRIMER POSTE'}</div></div>}
        </div>
      )}

{/* VISTA PROYECTOS (VERSIÓN FINAL DEFINITIVA) */}
      {vista === 'proyectos' && (
        <div className={`flex-1 ${theme.bg} p-4 overflow-y-auto`}>
           {proyectos.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-500">
               <Folder size={64} className="mb-4 opacity-30"/>
               <p className="mb-4 font-bold">No hay proyectos creados</p>
               <button onClick={() => { setTempData({ tipo: 'levantamiento' }); setModalOpen('CREAR_PROYECTO'); }} className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"><Plus size={20} /> CREAR PRIMER PROYECTO</button>
             </div>
           ) : (
             <>
               {/* HEADER */}
               <div className="flex justify-between items-center mb-6">
                 <h2 className={`text-xl font-black ${theme.text} uppercase tracking-tight`}>PROYECTOS</h2>
                 <div className="flex gap-2">
                    <button onClick={() => setVista('mapa')} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold border-2 border-black hover:bg-black transition-colors">IR AL MAPA</button>
                    <button onClick={() => { setTempData({ tipo: 'levantamiento' }); setModalOpen('CREAR_PROYECTO'); }} className="bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border-2 border-brand-800"><Plus size={16} /> NUEVO PROYECTO</button>
                 </div>
               </div>

               <div className="space-y-4">
                 {proyectos.map(proy => {
                   const esActivo = proyectoActual?.id === proy.id;
                   const colorProyecto = proy.colorGlobal || COLORES_DIA[0]; // Color seguro

                   // --- PROYECTO INACTIVO ---
                   if (!esActivo) {
                     return (
                        <div 
                           key={proy.id} 
                           onClick={() => seleccionarProyecto(proy)} 
                           className="w-full rounded-xl bg-slate-200 border-2 border-slate-400 p-5 cursor-pointer hover:bg-slate-300 hover:border-slate-600 transition-all active:scale-95 shadow-sm"
                        >
                           <h3 className="font-black text-lg uppercase text-slate-600 text-center tracking-widest select-none">
                              {proy.nombre}
                           </h3>
                        </div>
                     );
                   }

                   // --- PROYECTO ACTIVO ---
                   const totalPuntosProy = puntos.filter(p => proy.dias.some(d => d.id === p.diaId)).length;
                   const idsDias = proy.dias.map(d => d.id);
                   const todosVisibles = idsDias.every(id => diasVisibles.includes(id));

                   return (
                    <div key={proy.id} className="rounded-xl border-2 border-black bg-white shadow-2xl animate-in zoom-in-95 duration-200 relative">
                        {/* ^^^ HE QUITADO 'overflow-hidden' AQUÍ PARA QUE EL MENÚ NO SE CORTE ^^^ */}
                        
                        {/* CABECERA (Agregué rounded-t-xl para mantener la forma curva arriba) */}
                        <div className="p-4 flex justify-between items-center bg-white border-b-2 border-slate-200 rounded-t-xl">
                          
                          {/* INFO */}
                          <div className="flex flex-col items-start gap-1">
                            <h3 className="font-black text-xl text-black uppercase leading-none">{proy.nombre}</h3>
                            <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-widest mt-1">
                              {proy.tipo || 'LEVANTAMIENTO'}
                            </span>
                            <span className="mt-1 bg-slate-800 text-white text-[10px] font-black px-2 py-1 rounded border border-black">
                               {totalPuntosProy} PUNTOS
                            </span>
                          </div>

                          {/* ACCIONES */}
                          <div className="flex items-center gap-3">
                             
                         
                            {/* 1. COLOR PROYECTO (CORREGIDO: BOTÓN FIJO + MENÚ ABAJO) */}
                             <div className="relative">
                                
                                {/* A. EL BOTÓN (SIEMPRE VISIBLE) */}
                                <div 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        // Si ya está abierto este mismo, lo cerramos. Si no, lo abrimos.
                                        setSelectorColorAbierto(selectorColorAbierto === proy.id ? null : proy.id); 
                                    }} 
                                    className="w-9 h-9 rounded-md border-2 border-slate-600 cursor-pointer hover:scale-110 shadow-sm transition-transform" 
                                    style={{backgroundColor: colorProyecto}}
                                ></div>

                                {/* B. EL MENÚ FLOTANTE (SOLO APARECE SI ESTÁ ABIERTO) */}
                                {selectorColorAbierto === proy.id && (
                                    <>
                                      {/* Capa invisible para cerrar al hacer clic fuera */}
                                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setSelectorColorAbierto(null); }}></div>
                                      
                                      {/* Contenedor del Menú */}
                                      {/* top-full: Justo debajo del botón */}
                                      {/* mt-2: Un pequeño espacio extra para que no se pegue */}
                                      {/* left-0: Alineado a la izquierda del botón */}
                                      <div className="flex gap-1 animate-in slide-in-from-top-1 duration-200 absolute left-0 top-full mt-2 bg-white p-2 rounded-xl border-2 border-black shadow-2xl z-[100] min-w-max">
                                          {COLORES_DIA.map(c => (
                                              <div 
                                                  key={c} 
                                                  onClick={(e) => { cambiarColorProyecto(e, proy.id, c); setSelectorColorAbierto(null); }} 
                                                  className={`w-8 h-8 rounded-md border-2 cursor-pointer hover:scale-125 transition-transform shadow-sm ${colorProyecto === c ? 'border-black ring-2 ring-offset-1 ring-black' : 'border-slate-200'}`} 
                                                  style={{backgroundColor: c}}
                                              ></div>
                                          ))}
                                          <button onClick={(e) => { e.stopPropagation(); setSelectorColorAbierto(null); }} className="ml-2 bg-slate-100 p-1 rounded hover:bg-red-100 text-slate-500 hover:text-red-600">
                                            <X size={18} strokeWidth={3}/>
                                          </button>
                                      </div>
                                    </>
                                )}
                             </div>

                             {/* 2. FOTOS ZIP */}
                             <button 
                                onClick={(e) => { e.stopPropagation(); descargarFotosZip(proy); }} 
                                className="p-1 text-slate-700 hover:text-blue-600 transition-colors" 
                                title="Descargar Fotos (ZIP)"
                             >
                                <FolderDown size={28} strokeWidth={2.5}/>
                             </button>

                             {/* 3. REPORTE EXCEL */}
                             <button 
                                onClick={(e) => { e.stopPropagation(); descargarReporteExcel(proy); }} 
                                className="p-1 text-slate-700 hover:text-green-600 transition-colors" 
                                title="Reporte Fotográfico (Excel)"
                             >
                                <FileDown size={28} strokeWidth={2.5}/>
                             </button>

                             {/* 4. KMZ */}
                             <button 
                                onClick={(e) => { e.stopPropagation(); handleExportKML(proy); }} 
                                className="p-1 text-slate-700 hover:text-black transition-colors" 
                                title="Exportar KMZ"
                             >
                                <Share2 size={26} strokeWidth={2.5}/>
                             </button>

                             {/* 5. VISTA */}
                             <button onClick={(e) => toggleVisibilidadProyecto(e, proy)} className="p-1">
                                {todosVisibles ? (
                                    <Eye size={28} className="text-orange-500" strokeWidth={2.5}/> 
                                ) : (
                                    <EyeOff size={28} className="text-slate-900" strokeWidth={2.5}/>
                                )}
                             </button>

                             {/* 6. BASURERO */}
                             <button onClick={(e) => { e.stopPropagation(); solicitarBorrarProyecto(proy.id); }} className="p-1 text-slate-700 hover:text-red-600 transition-colors">
                                <Trash2 size={26} strokeWidth={2.5}/>
                             </button>

                          </div>
                        </div>

                        {/* --- LISTA DE DÍAS (Agregué rounded-b-xl para mantener la forma curva abajo) --- */}
                        <div className="bg-slate-100 border-t-2 border-slate-300 p-3 space-y-2 rounded-b-xl">
                             <button onClick={() => { setTempData({}); setModalOpen('CREAR_DIA'); }} className="w-full py-3 border-2 border-dashed border-slate-400 bg-white rounded-xl text-slate-600 font-bold text-xs hover:border-black hover:text-black transition-colors">+ NUEVO DÍA DE TRABAJO</button>
                             
                             {proy.dias.map(dia => {
                                 const isSelected = diaActual === dia.id;
                                 const isVisible = diasVisibles.includes(dia.id);
                                 const ptosDia = puntos.filter(p => p.diaId === dia.id).length;
                                 
                                 return (
                                   <div 
                                      key={dia.id} 
                                      className={`p-3 rounded-lg border-2 flex justify-between items-center transition-colors 
                                        ${isSelected ? 'bg-slate-900 border-black shadow-lg' : 'bg-white border-slate-400'}`}
                                   >
                                     <div className="flex-1 cursor-pointer flex items-center gap-3" onClick={() => { setDiaActual(dia.id); if(!isVisible) toggleVisibilidadDia(dia.id); }}>
                                        <div>
                                          <h4 className={`font-black text-sm ${isSelected ? 'text-white' : 'text-slate-800'}`}>{dia.nombre}</h4>
                                          <span className={`text-[10px] font-bold ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>{dia.fecha} • {ptosDia} pts</span>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-4">
                                        <div className="flex gap-1">
                                          {COLORES_DIA.map(c => (
                                            <div 
                                                key={c} 
                                                onClick={() => cambiarColorDia(proy.id, dia.id, c)} 
                                                className={`w-5 h-5 rounded cursor-pointer transition-transform ${dia.color === c ? 'ring-1 ring-offset-1 ring-black scale-125 z-10 shadow-sm' : 'opacity-40 hover:opacity-100'}`} 
                                                style={{backgroundColor: c}}
                                            ></div>
                                          ))}
                                        </div>
                                        <button onClick={() => toggleVisibilidadDia(dia.id)}>
                                            {isVisible ? 
                                              <Eye size={22} className={isSelected ? "text-orange-400" : "text-brand-600"} strokeWidth={2.5}/> : 
                                              <EyeOff size={22} className={isSelected ? "text-slate-500" : "text-slate-300"} strokeWidth={2.5}/>
                                            }
                                        </button>
                                     </div>
                                   </div>
                                 )
                               })}
                        </div>
                    </div>
                   )


                 })}
               </div>
             </>
           )}
           
           {/* MODALES */}
           <Modal isOpen={modalOpen === 'CREAR_PROYECTO'} onClose={() => setModalOpen(null)} title="Nuevo Proyecto" theme={theme}> 
              <ThemedInput autoFocus placeholder="Nombre" val={tempData.nombre || ''} onChange={e => setTempData({...tempData, nombre: e.target.value})} theme={theme} /> 
              <div className="flex gap-2 my-4"> 
                  <button onClick={() => setTempData({...tempData, tipo: 'levantamiento'})} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'levantamiento' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>LEVANTAMIENTO</button> 
                  <button onClick={() => setTempData({...tempData, tipo: 'liquidacion'})} className={`flex-1 py-3 rounded-lg border-2 font-bold text-xs transition-colors ${tempData.tipo === 'liquidacion' ? 'bg-slate-800 text-white border-black shadow-md' : 'bg-white text-slate-500 border-slate-300'}`}>LIQUIDACIÓN</button> 
              </div> 
              <button onClick={confirmarCrearProyecto} className="w-full bg-brand-600 text-white py-3 rounded font-bold border-2 border-brand-800">CREAR</button> 
           </Modal>
           
           <Modal isOpen={modalOpen === 'CREAR_DIA'} onClose={() => setModalOpen(null)} title="Nuevo Día" theme={theme}> 
              <ThemedInput autoFocus placeholder="Nombre (ej: Lunes 05)" val={tempData.nombre || ''} onChange={e => setTempData({...tempData, nombre: e.target.value})} theme={theme} /> 
              <div className="h-4"></div> 
              <button onClick={confirmarCrearDia} className="w-full bg-brand-600 text-white py-3 rounded font-bold border-2 border-brand-800">AGREGAR</button> 
           </Modal>

        </div>
      )}

{/* VISTA FORMULARIO */}
{vista === 'formulario' && (
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
      
{/* 2. INPUTS SUPERIORES: Orden Suministro (Izquierda) - Código (Centro) - Número (Derecha) */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        
        {/* 1. SUMINISTRO (Ahora a la izquierda) */}
        <ThemedInput 
          placeholder="SUMINISTRO" 
          val={datosFormulario.suministro || ''} 
          onChange={v => setDatosFormulario(prev => ({...prev, suministro: v.target.value}))} 
          theme={theme} 
          disabled={modoLectura} 
        />

        {/* 2. CÓDIGO (Ahora al centro) */}
        <ThemedInput 
          placeholder="CÓDIGO" 
          val={datosFormulario.codigo || ''} 
          onChange={v => setDatosFormulario(prev => ({...prev, codigo: v.target.value}))} 
          theme={theme} 
          disabled={modoLectura} 
        />

        {/* 3. NÚMERO (Sigue a la derecha) */}
        <ThemedInput 
          placeholder="NÚMERO" 
          val={datosFormulario.numero || ''} 
          onChange={v => setDatosFormulario(prev => ({...prev, numero: v.target.value}))} 
          theme={theme} 
          disabled={modoLectura} 
        />
      </div>

      {/* FOTOS: Se muestran, pero en modo lectura no deberías poder borrar (lógica aparte) */}
      {datosFormulario.fotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-4 mb-2">
          {datosFormulario.fotos.map((f, i) => (
            <img key={i} src={f} className={`w-20 h-20 rounded-lg object-cover border-2 ${theme.border} shadow-md`} />
          ))}
        </div>
      )}

      {/* BLOQUES: Nota importante abajo sobre esto * */}
      {proyectoActual?.tipo === 'levantamiento' ? (
        <>
          <BloqueLevantamiento disabled={modoLectura} /> 
          <div className={`my-6 border-t-2 ${theme.border}`}></div>
          <BloqueLiquidacion disabled={modoLectura} />
        </>
      ) : (
        <>
          <BloqueLiquidacion disabled={modoLectura} />
          <div className={`my-6 border-t-2 ${theme.border}`}></div>
          <BloqueLevantamiento disabled={modoLectura} />
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
        <button onClick={() => inputCamaraRef.current.click()} className={`w-20 h-14 ${theme.input} rounded-xl border-2 ${theme.border} flex flex-col items-center justify-center text-brand-500 active:scale-95`}>
          <Camera size={28} />
        </button>
        <input type="file" ref={inputCamaraRef} accept="image/*" capture="environment" className="hidden" onChange={procesarFoto} />
      </div>
    )}
  </div>
)}

      {/* VISTA CONFIGURACIÓN */}
      {vista === 'config' && ( 
        <Configurador 
          config={config} 
          saveConfig={guardarConfiguracion} // <--- CAMBIAMOS setConfig POR saveConfig
          volver={() => setVista('mapa')} 
          modalState={{ modalOpen, setModalOpen, tempData, setTempData, setConfirmData }} 
          theme={theme} 
          tab={configTab}
          setTab={setConfigTab}

          seccionAbierta={acordeonAbierto}
          setSeccionAbierta={setAcordeonAbierto}
        /> 
      )}

      {/* MODALES */}
      <ConfirmModal isOpen={!!confirmData} onClose={() => setConfirmData(null)} {...confirmData} theme={theme} />
      <AlertModal isOpen={!!alertData} onClose={() => setAlertData(null)} {...alertData} theme={theme} />
      <ExportModal isOpen={!!exportData} onClose={() => setExportData(null)} fileName={exportData?.fileName} onConfirm={handleExportKML} theme={theme} />
    </div>
  );

  // 🔔 BLOQUES INTERNOS DEL COMPONENTE APP
 
// 1. BLOQUE LEVANTAMIENTO
// Agregamos { disabled } como prop
function BloqueLevantamiento({ disabled }) {
    return (
      <div className={`space-y-4 animate-in fade-in py-2 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
         {/* NOTA: Al poner 'pointer-events-none' en el div padre, 
             ya no necesitas bloquear cada botón individualmente, 
             el usuario no podrá hacer click en nada dentro de este div.
         */}
         <SelectorGrid titulo="ALTURA (m)" cols={5} opciones={config.botonesPoste.alturas} seleccion={datosFormulario.altura} onSelect={v => setDatosFormulario(prev => ({...prev, altura: v}))} theme={theme} />
         <SelectorGrid titulo="FUERZA (kg)" cols={4} opciones={config.botonesPoste.fuerzas} seleccion={datosFormulario.fuerza} onSelect={v => setDatosFormulario(prev => ({...prev, fuerza: v}))} theme={theme} />
         <SelectorGrid titulo="MATERIAL DEL POSTE" cols={4} opciones={config.botonesPoste.materiales} seleccion={datosFormulario.material} onSelect={v => setDatosFormulario(prev => ({...prev, material: v}))} theme={theme} />
         <SelectorGrid titulo="TIPO DE RED" cols={4} opciones={config.botonesPoste.tipos} seleccion={datosFormulario.tipo} onSelect={v => setDatosFormulario(prev => ({...prev, tipo: v}))} theme={theme} />
         
         <SelectorGridMulti titulo="EXTRAS" cols={3} textSize="text-[14px]" opciones={config.botonesPoste.extras} seleccion={datosFormulario.extrasSeleccionados} 
            onToggle={v => {
               // Doble seguridad por si acaso
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
// Agregamos { disabled } como prop
function BloqueLiquidacion({ disabled }) {
    return (
      <div className={`space-y-4 animate-in fade-in py-2 ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        
        {/* SECCIÓN ARMADOS */}
        <div> 
            <h3 className={`text-xs font-black ${theme.text} mb-2 ml-1 uppercase tracking-wider`}>ARMADOS INSTALADOS</h3> 
            <div className="grid grid-cols-3 gap-2"> 
                {config.armados.filter(a => a.visible !== false).map(armado => { 
                    const isSelected = datosFormulario.armadoSeleccionado?.idArmado === armado.id; 
                    return ( 
                        <button 
                            key={armado.id} 
                            // Bloqueamos el botón nativo también
                            disabled={disabled} 
                            onClick={() => { 
                                if(disabled) return; // Validación extra
                                if(isSelected) setDatosFormulario(prev => ({...prev, armadoSeleccionado: null})); 
                                else setDatosFormulario(prev => ({...prev, armadoSeleccionado: { idArmado: armado.id, cantidad: 1 }})); 
                            }} 
                            className={`h-16 px-1 rounded-xl text-[14px] font-black border-2 active:scale-95 leading-none flex items-center justify-center text-center ${isSelected ? theme.gridBtnActive : theme.gridBtn}`}
                        > 
                            <span className="scale-110 block">{armado.nombre}</span> 
                        </button> 
                    ) 
                })} 
            </div> 
        </div>

        {/* RESTO DE SELECTORES */}
        <SelectorGrid titulo="CANTIDAD DE CABLES" cols={5} opciones={config.botonesPoste.cables} seleccion={datosFormulario.cables} onSelect={v => setDatosFormulario(prev => ({...prev, cables: v}))} theme={theme} />
        
        <SelectorGridMulti titulo="FERRETERÍA EXTRA" cols={4} textSize="text-[14px]" opciones={config.botonesPoste.ferreteriaExtra} seleccion={datosFormulario.ferreteriaExtraSeleccionada} 
            onToggle={v => { 
                if(disabled) return;
                const exists = datosFormulario.ferreteriaExtraSeleccionada.includes(v); 
                const nuevos = exists ? datosFormulario.ferreteriaExtraSeleccionada.filter(x => x !== v) : [...datosFormulario.ferreteriaExtraSeleccionada, v]; 
                setDatosFormulario(prev => ({...prev, ferreteriaExtraSeleccionada: nuevos})); 
            }} theme={theme} 
        />
      </div>
    );
}

// --- CONFIGURADOR (ESTILOS CORREGIDOS + FIX BORRAR) ---
function Configurador({ config, saveConfig, volver, modalState, theme, tab, setTab, seccionAbierta, setSeccionAbierta }) {
  // Ahora modalState ya trae setConfirmData gracias al Paso 1
  const { modalOpen, setModalOpen, tempData, setTempData, setConfirmData } = modalState;
  
  // --- HELPERS CRUD ---
  const crearArmado = () => { if(!tempData.nombre) return; const nuevo = { id: `a_${Date.now()}`, nombre: tempData.nombre, items: [], visible: true }; saveConfig({ ...config, armados: [...config.armados, nuevo] }); setModalOpen(null); };
  const crearFerreteria = () => { if(!tempData.nombre || !tempData.unidad) return; const nuevo = { id: `f_${Date.now()}`, nombre: tempData.nombre, unidad: tempData.unidad }; saveConfig({ ...config, catalogoFerreteria: [...config.catalogoFerreteria, nuevo] }); setModalOpen(null); };
  const agregarMaterial = () => { if(!tempData.matId || !tempData.cant) return; const nuevosArmados = config.armados.map(a => a.id === tempData.armadoId ? { ...a, items: [...a.items, { idRef: tempData.matId, cant: parseFloat(tempData.cant) }] } : a); saveConfig({ ...config, armados: nuevosArmados }); setModalOpen(null); };
  
  const agregarBoton = () => { 
      if(!tempData.val || !tempData.tipoLista) return; 
      const tipo = tempData.tipoLista; 
      const valorFinal = (tipo === 'alturas' || tipo === 'fuerzas') ? parseFloat(tempData.val) : tempData.val; 
      const nuevosBotones = { ...config.botonesPoste, [tipo]: [...config.botonesPoste[tipo], { v: valorFinal, visible: true }] }; 
      saveConfig({ ...config, botonesPoste: nuevosBotones }); 
      setModalOpen(null); 
  };
  
  // Toggles
  const toggleVisibilidadBoton = (tipo, valor) => { 
      const nuevosBotones = { ...config.botonesPoste, [tipo]: config.botonesPoste[tipo].map(b => b.v === valor ? { ...b, visible: !b.visible } : b) }; 
      saveConfig({ ...config, botonesPoste: nuevosBotones }); 
  };

  const toggleVisibilidadArmado = (id) => {
      const nuevosArmados = config.armados.map(a => a.id === id ? { ...a, visible: (a.visible === undefined ? false : !a.visible) } : a);
      saveConfig({ ...config, armados: nuevosArmados });
  };

  // 🔔 FUNCIÓN DE BORRAR (Ahora sí funcionará)
  const confirmarBorrarBoton = (tipo, valor) => {
      if (!setConfirmData) { alert("Error: setConfirmData no recibido"); return; }
      setConfirmData({
          title: 'Eliminar Opción',
          message: `¿Eliminar "${valor}" de la lista?`,
          actionText: 'ELIMINAR',
          theme: theme,
          onConfirm: () => {
              const nuevosBotones = { ...config.botonesPoste, [tipo]: config.botonesPoste[tipo].filter(b => b.v !== valor) };
              saveConfig({ ...config, botonesPoste: nuevosBotones });
              setConfirmData(null);
          }
      });
  };

  const toggleAcordeon = (id) => setSeccionAbierta(seccionAbierta === id ? null : id);

  // Borrados Clásicos
  const borrarArmado = (id) => saveConfig({ ...config, armados: config.armados.filter(a => a.id !== id) });
  const borrarFerreteria = (id) => saveConfig({ ...config, catalogoFerreteria: config.catalogoFerreteria.filter(f => f.id !== id) });
  const borrarMaterialDeArmado = (armadoId, index) => { const nuevosArmados = config.armados.map(a => a.id === armadoId ? {...a, items: a.items.filter((_, i) => i !== index)} : a); saveConfig({ ...config, armados: nuevosArmados }); };
  
  const [expandedId, setExpandedId] = useState(null); 
  const [editId, setEditId] = useState(null); 

  // --- LONG PRESS BUTTON ---
  const LongPressButton = ({ onClick, onLongPress, children, className }) => {
      const timerRef = useRef(null);
      const isLongPress = useRef(false);

      const start = (e) => {
          if (e.type === 'touchstart') e.stopPropagation();
          isLongPress.current = false;
          timerRef.current = setTimeout(() => {
              isLongPress.current = true;
              if (navigator.vibrate) navigator.vibrate(50);
              onLongPress();
          }, 500); 
      };

      const end = (e) => {
          if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
          }
          if (!isLongPress.current) {
              if (e.type === 'touchend') e.preventDefault();
              if (onClick) onClick();
          }
      };

      return (
          <button 
              onMouseDown={start} onMouseUp={end} onMouseLeave={() => clearTimeout(timerRef.current)}
              onTouchStart={start} onTouchEnd={end}
              className={className} type="button"
          >
              {children}
          </button>
      );
  };

  // --- FILA DE PESTAÑAS (TABS) ---
  const FilaPestanas = ({ idA, tituloA, renderA, idB, tituloB, renderB }) => {
      const isOpenA = seccionAbierta === idA;
      const isOpenB = idB ? seccionAbierta === idB : false;

      // Estilo Base de Botón Título (Ahora texto más grande)
      const baseBtnClass = `h-14 rounded-xl border-2 font-black text-xs uppercase tracking-wide transition-all shadow-sm flex items-center justify-center`;
      
      // Estilo Activo vs Inactivo
      const activeClass = `bg-slate-900 text-white border-black ring-2 ring-slate-400`;
      const inactiveClass = `${theme.card} text-slate-800 border-slate-300 hover:bg-slate-100 hover:text-black`;

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

              {isOpenA && <div className={`mt-2 p-3 rounded-xl border-2 ${theme.border} bg-slate-50 animate-in slide-in-from-top-2 duration-200`}>{renderA()}</div>}
              {isOpenB && <div className={`mt-2 p-3 rounded-xl border-2 ${theme.border} bg-slate-50 animate-in slide-in-from-top-2 duration-200`}>{renderB()}</div>}
          </div>
      );
  };

  // Renderizador de Botones Normales
  const renderBotones = (tipo, addModal, tipoAdd) => (
      <div className="flex flex-wrap gap-2">
          {config.botonesPoste[tipo]?.map((item, i) => (
              <LongPressButton 
                  key={i}
                  onClick={() => toggleVisibilidadBoton(tipo, item.v)}
                  onLongPress={() => confirmarBorrarBoton(tipo, item.v)}
                  className={`h-12 px-4 rounded-lg text-sm font-bold border-2 flex items-center gap-2 active:scale-95 transition-all shadow-sm select-none
                  ${item.visible ? 'bg-slate-900 text-white border-black' : 'bg-white text-slate-800 border-slate-300'}`}
              >
                  {item.v} {item.visible ? <Eye size={16}/> : <EyeOff size={16}/>}
              </LongPressButton>
          ))}
          <button 
              onClick={() => { setTempData({ tipoLista: tipoAdd }); setModalOpen(addModal); }}
              className="h-12 w-12 rounded-lg border-2 border-dashed border-slate-400 bg-white flex items-center justify-center text-green-600 hover:bg-green-50 active:scale-95 transition-colors"
          >
              <Plus size={24} strokeWidth={4} />
          </button>
      </div>
  );

  return (
    <div className={`flex-1 flex flex-col ${theme.bg} overflow-hidden relative`}>
      {/* HEADER */}
      <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0`}> 
          <button onClick={volver}><ChevronDown className={`rotate-90 ${theme.text}`} size={28}/></button> 
          <span className={`font-black ${theme.text} text-lg uppercase`}>Configuración</span> 
          <div className="w-6"></div> 
      </div>
      
      {/* TABS SUPERIORES (Estilo mejorado: texto más grande y oscuro) */}
      <div className={`flex ${theme.header} border-b-2 ${theme.border} shrink-0`}> 
          {['armados', 'ferreteria', 'botones'].map(t => ( 
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-4 ${tab === t ? 'border-brand-500 text-brand-500' : 'border-transparent text-slate-700 hover:text-black hover:bg-slate-50'}`}>{t}</button> 
          ))} 
      </div>
      
      <div className="flex-1 overflow-y-auto p-3">
        
        {/* --- PESTAÑA 1: EDITOR DE ARMADOS --- */}
        {tab === 'armados' && ( 
            <div className="space-y-3">
                <button onClick={() => { setTempData({}); setModalOpen('CREAR_ARMADO'); }} className={`w-full py-4 border-2 border-dashed ${theme.border} rounded-xl ${theme.text} text-xs font-black uppercase tracking-widest hover:border-brand-500 hover:text-brand-500`}>+ Crear Armado</button> 
                {config.armados.map(arm => { 
                    const isExpanded = expandedId === arm.id; 
                    const isEditing = editId === arm.id; 
                    return ( 
                        <div key={arm.id} className={`${theme.card} border-2 ${isEditing ? 'border-brand-500' : theme.border} rounded-xl overflow-hidden`}> 
                            <div className={`p-3 flex justify-between items-center ${theme.card}`}> 
                                <span className={`font-bold text-sm ${theme.text}`}>{arm.nombre}</span> 
                                <div className="flex gap-1"> 
                                    <button onClick={() => { setExpandedId(isExpanded ? null : arm.id); setEditId(null); }} className={`p-2 rounded-lg ${isExpanded ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}><Eye size={18} /></button> 
                                    <button onClick={() => { setEditId(isEditing ? null : arm.id); setExpandedId(null); }} className={`p-2 rounded-lg ${isEditing ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{isEditing ? <Save size={18} /> : <Edit3 size={18} />}</button> 
                                    <button onClick={() => borrarArmado(arm.id)} className="p-2 text-red-500 bg-red-50 rounded-lg"><Trash2 size={18} /></button> 
                                </div> 
                            </div> 
                            {isExpanded && ( 
                                <div className={`p-3 border-t text-xs ${theme.textSec}`}>
                                    {arm.items.length === 0 ? "Sin materiales" : arm.items.map((it, i) => {
                                        const m = config.catalogoFerreteria.find(f=>f.id===it.idRef);
                                        return <div key={i} className="flex justify-between py-1 border-b last:border-0 border-slate-100"><span>{m?.nombre}</span><span className="font-bold">{it.cant} {m?.unidad}</span></div>
                                    })}
                                </div> 
                            )} 
                            {isEditing && ( 
                                <div className="p-3 border-t bg-slate-50">
                                    <div className="space-y-2 mb-3">
                                        {arm.items.map((it, i) => {
                                            const m = config.catalogoFerreteria.find(f=>f.id===it.idRef);
                                            return <div key={i} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-xs"><span>{m?.nombre}</span><div className="flex items-center gap-2"><span className="font-bold">{it.cant}</span><button onClick={()=>borrarMaterialDeArmado(arm.id, i)} className="text-red-500"><X size={14}/></button></div></div>
                                        })}
                                    </div>
                                    <button onClick={() => { setTempData({ armadoId: arm.id }); setModalOpen('AGREGAR_MAT'); }} className="w-full bg-brand-600 text-white py-3 rounded-lg font-bold text-xs">+ MATERIAL</button>
                                </div> 
                            )} 
                        </div> 
                    ) 
                })} 
            </div> 
        )}
        
        {/* --- PESTAÑA 2: FERRETERÍA --- */}
        {tab === 'ferreteria' && ( 
            <div className="space-y-2"> 
                <button onClick={() => { setTempData({ unidad: 'und' }); setModalOpen('CREAR_FERR'); }} className={`w-full py-4 border-2 border-dashed ${theme.border} rounded-xl ${theme.text} text-xs font-black uppercase tracking-widest hover:border-brand-500 hover:text-brand-500 mb-2`}>+ Crear Pieza</button> 
                {config.catalogoFerreteria.map(f => ( 
                    <div key={f.id} className={`${theme.card} p-3 rounded-xl border-2 ${theme.border} flex justify-between items-center`}> 
                        <span className={`text-sm ${theme.text} font-bold`}>{f.nombre}</span> 
                        <div className="flex items-center gap-2"> 
                            <span className="text-[9px] bg-slate-100 px-2 py-1 rounded border border-slate-300 uppercase font-bold text-slate-500">{f.unidad}</span> 
                            <button onClick={() => borrarFerreteria(f.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button> 
                        </div> 
                    </div> 
                ))} 
            </div> 
        )}
        
        {/* --- PESTAÑA 3: BOTONES --- */}
        {tab === 'botones' && ( 
          <div className="space-y-4">
            
            {/* 1. LIQUIDACIÓN */}
            <div>
                <h3 className={`text-[10px] font-black ${theme.textSec} mb-2 uppercase tracking-widest ml-1 bg-slate-100 p-2 rounded-lg border ${theme.border} text-center`}>
                    LIQUIDACIÓN
                </h3>
                
                <FilaPestanas 
                    idA="vis_armados" tituloA="Armados"
                    renderA={() => (
                        <div className="flex flex-wrap gap-2">
                            {config.armados.map(arm => (
                                <button key={arm.id} onClick={() => toggleVisibilidadArmado(arm.id)} 
                                    className={`h-12 px-4 rounded-lg text-sm font-bold border-2 flex items-center gap-2 active:scale-95 transition-all shadow-sm select-none
                                    ${arm.visible !== false ? 'bg-slate-900 text-white border-black' : 'bg-white text-slate-800 border-slate-300'}`}>
                                    {arm.nombre} {arm.visible !== false ? <Eye size={16}/> : <EyeOff size={16}/>}
                                </button>
                            ))}
                        </div>
                    )}
                    idB="vis_ferreteria" tituloB="Ferretería Extra"
                    renderB={() => renderBotones('ferreteriaExtra', 'AGREGAR_BOTON', 'ferreteriaExtra')}
                />
                
                <FilaPestanas 
                    idA="vis_cables" tituloA="Cantidad de Cables"
                    renderA={() => renderBotones('cables', 'AGREGAR_BOTON', 'cables')}
                />
            </div>

            {/* 2. POSTES */}
            <div>
                <h3 className={`text-[10px] font-black ${theme.textSec} mb-2 uppercase tracking-widest ml-1 bg-slate-100 p-2 rounded-lg border ${theme.border} text-center mt-4`}>
                    POSTES
                </h3>
                
                <FilaPestanas 
                    idA="vis_altura" tituloA="Altura"
                    renderA={() => renderBotones('alturas', 'AGREGAR_BOTON', 'alturas')}
                    idB="vis_material" tituloB="Material"
                    renderB={() => renderBotones('materiales', 'AGREGAR_BOTON', 'materiales')}
                />

                <FilaPestanas 
                    idA="vis_fuerza" tituloA="Fuerza"
                    renderA={() => renderBotones('fuerzas', 'AGREGAR_BOTON', 'fuerzas')}
                    idB="vis_tipo" tituloB="Tipo de Red"
                    renderB={() => renderBotones('tipos', 'AGREGAR_BOTON', 'tipos')}
                />

                <FilaPestanas 
                    idA="vis_extras" tituloA="Datos Extras"
                    renderA={() => renderBotones('extras', 'AGREGAR_BOTON', 'extras')}
                />
            </div>

          </div> 
        )}
      </div>
      
      {/* Modales (Sin cambios) */}
      <Modal isOpen={modalOpen === 'CREAR_ARMADO'} onClose={() => setModalOpen(null)} title="Nuevo Armado" theme={theme}> <ThemedInput autoFocus placeholder="Nombre" val={tempData.nombre || ''} onChange={e => setTempData({...tempData, nombre: e.target.value})} theme={theme} /> <div className="h-4"></div> <button onClick={crearArmado} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-xl">CREAR</button> </Modal>
      <Modal isOpen={modalOpen === 'CREAR_FERR'} onClose={() => setModalOpen(null)} title="Nueva Pieza" theme={theme}> <ThemedInput autoFocus placeholder="Nombre" val={tempData.nombre || ''} onChange={e => setTempData({...tempData, nombre: e.target.value})} theme={theme} /> <div className="flex gap-2 my-4"> {['und', 'mts'].map(u => ( <button key={u} onClick={() => setTempData({...tempData, unidad: u})} className={`flex-1 py-4 rounded-xl font-bold border-2 text-lg ${tempData.unidad === u ? 'bg-slate-900 text-white' : theme.input}`}> {u.toUpperCase()} </button> ))} </div> <button onClick={crearFerreteria} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-xl">REGISTRAR</button> </Modal>
      <Modal isOpen={modalOpen === 'AGREGAR_MAT'} onClose={() => setModalOpen(null)} title="Agregar Material" theme={theme}> <div className="max-h-60 overflow-y-auto mb-3 bg-slate-800 rounded-xl border border-slate-700 p-2"> {config.catalogoFerreteria.map(f => ( <div key={f.id} onClick={() => setTempData({...tempData, matId: f.id})} className={`p-4 rounded-lg text-base font-medium cursor-pointer mb-1 transition-colors flex justify-between ${tempData.matId === f.id ? 'bg-brand-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700'}`}> <span>{f.nombre}</span> <span className="opacity-60 text-xs uppercase">{f.unidad}</span> </div> ))} </div> <input type="number" placeholder="Cantidad" className={`w-full ${theme.input} p-4 rounded-xl border-2 ${theme.border} mb-4 font-bold text-lg [appearance:textfield]`} onChange={e => setTempData({...tempData, cant: e.target.value})} /> <button onClick={agregarMaterial} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-xl">AGREGAR</button> </Modal>
      <Modal isOpen={modalOpen === 'AGREGAR_BOTON'} onClose={() => setModalOpen(null)} title="Nueva Opción" theme={theme}> <ThemedInput autoFocus placeholder="Valor" val={tempData.val || ''} onChange={e => setTempData({...tempData, val: e.target.value})} theme={theme} /> <div className="h-4"></div> <button onClick={agregarBoton} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-xl">AGREGAR</button> </Modal>
    </div>
  );
}

}

export default App;
