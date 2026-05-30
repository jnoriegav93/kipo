import React, { useRef, useState, useEffect } from 'react';
import { Camera, Trash2, X, RefreshCw, ArrowLeft, Maximize2, Share2, Plus, Image as ImageIcon, FolderOpen, Check, ChevronDown } from 'lucide-react';
import { uploadImage } from '../utils/storage';
import { saveUploadPending, deleteUploadPending } from '../utils/photoDB';
import { estamparMetadatos, urlABase64 } from '../utils/helpers';
import { doc, updateDoc, getDoc, collection, query, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// CONFIGURACIÓN - 3 PESTAÑAS DE FOTOS
export const TABS_CONFIG = {
  // 1. NAP MEC (Principal)
  napMec: {
    id: 'napMec',
    title: 'NAP MECANICA',
    items: [
      { id: 'frontalRotulado', label: 'FRONTAL\n(ROTULADO)' },
      { id: 'frontalPotencia', label: 'FRONTAL CON\nPOTENCIA' },
      { id: 'perfil', label: 'PERFIL' },
      { id: 'splitter', label: 'SPLITTER' },
      { id: 'bandejaFusiones', label: 'BANDEJA CON\nFUSIONES' },
      { id: 'etiquetaEntrada', label: 'ETIQUETA\nENTRADA', help: 'Entrada de la FO alimentadora' },
      { id: 'etiquetaSalida', label: 'ETIQUETA\nSALIDA', help: 'Salida de la FO alimentadora', centered: true },
      // SUBSECCION
      {
        id: 'sub_etiquetasExtremos',
        title: 'ETIQUETAS DE FO DE SALIDA',
        items: [
          { id: 'salida1', label: 'SALIDA 1' },
          { id: 'salida2', label: 'SALIDA 2' },
          { id: 'salida3', label: 'SALIDA 3' }
        ]
      }
    ]
  },
  // 2. MUFA TRONCAL
  mufaTroncal: {
    id: 'mufaTroncal',
    title: 'MUFA TRONCAL',
    items: [
      { id: 'frontal', label: 'FRONTAL', help: 'Vista frontal de la mufa en la parte superior del poste' },
      { id: 'panoramica', label: 'PANORAMICA', help: 'Vista panorámica del poste' },
      { id: 'vistaFrontalBandejas', label: 'VISTA FRONTAL\nBANDEJAS', help: 'Debe apreciarse la fijación, orden y curvatura de las fibras' },
      { id: 'vistaPosteriorBandejas', label: 'VISTA PERFIL\nBANDEJAS', help: 'Debe apreciarse la fusión de las fibras' },
      { id: 'bandejasAseguradas', label: 'BANDEJAS ASEG.\nFRONTAL', help: 'Debe apreciarse las bandejas de FO aseguradas con cinta Velcro' },
      { id: 'bandejasAseguradaPerfil', label: 'BANDEJAS ASEG.\nPERFIL', help: 'Debe apreciarse las bandejas aseguradas con Velcro' },
      { id: 'cierreCarcasa', label: 'CIERRE DE\nCARCASA', help: 'Foto de la mufa cerrada en el piso' },
      { id: 'cajaPiso', label: 'CAJA EN PISO', help: 'Debe apreciarse la caja en una superficie segura con la carcasa abierta' },
      { id: 'fusiones', label: 'FUSIONES', help: 'Debe apreciarse la FUSIÓN de FO, fijación, orden y curvatura de las fibras' },
      { id: 'cablesAsegurados', label: 'CABLES OPTICOS\nASEGURADOS', help: 'Verifique que los cables estén asegurados de manera confiable.' },
      { id: 'etiquetasGenerales', label: 'ETIQUETAS\nGENERALES', help: 'Debe verse la descripción de todas las etiquetas' },
      { id: 'herreria', label: 'HERRAJES', help: 'Foto tomada desde abajo a toda la mufa y sus herrajes' },
      { id: 'etiquetaIngreso', label: 'ETIQUETA FIBRA\nINGRESO' },
      // SUBSECCION
      {
        id: 'sub_etiquetaSalida',
        title: 'ETIQUETAS DE FO DE SALIDA',
        items: [
          { id: 'salida1', label: 'SALIDA 1' },
          { id: 'salida2', label: 'SALIDA 2' },
          { id: 'salida3', label: 'SALIDA 3' }
        ]
      }
    ]
  },
  // 3. MUFA FDT (Igual a Troncal)
  mufaFdt: {
    id: 'mufaFdt',
    title: 'MUFA FDT',
    items: [
      { id: 'cajaPiso', label: 'CAJA EN PISO', help: 'Debe apreciarse la caja en una superficie segura con la carcasa abierta' },
      { id: 'fusiones', label: 'FUSIONES', help: 'Debe apreciarse la FUSIÓN de FO, fijación, orden y curvatura de las fibras' },
      { id: 'bandejasAseguradas', label: 'BANDEJAS\nASEGURADAS', help: 'Debe apreciarse las bandejas de FO aseguradas con cinta Velcro' },
      { id: 'cablesAsegurados', label: 'CABLES OPTICOS\nASEGURADOS', help: 'Verifique que los cables estén asegurados de manera confiable.' },
      { id: 'cierreCarcasa', label: 'FRONTAL', help: 'Debe apreciarse el cierre de la carcasa en poste.' },
      { id: 'etiquetaIngreso', label: 'ETIQUETA FIBRA\nINGRESO' },
      // SUBSECCION
      {
        id: 'sub_etiquetaSalida',
        title: 'ETIQUETAS DE FO DE SALIDA',
        items: [
          { id: 'salida1', label: 'SALIDA 1' },
          { id: 'salida2', label: 'SALIDA 2' },
          { id: 'salida3', label: 'SALIDA 3' }
        ]
      }
    ]
  },
  // 4. FAT PRECO NUEVA
  fatPrecoNueva: {
    id: 'fatPrecoNueva', // ANTES napFatNueva
    title: 'FAT PRECO NUEVA',
    items: [
      { id: 'frontalRotulado', label: 'FRONTAL\n(ROTULADO)' },
      { id: 'frontalPotencia', label: 'FRONTAL CON\nPOTENCIA' },
      { id: 'perfil', label: 'PERFIL' },
      { id: 'etiqueta', label: 'ETIQUETA' },
      { id: 'panoramica', label: 'PANORAMICA' },
      { id: 'codigoSerie', label: 'CODIGO SERIE' }
    ]
  },
  // 5. FAT PRECO EXISTENTE
  fatPrecoExistente: {
    id: 'fatPrecoExistente', // ANTES napFatExistente
    title: 'FAT PRECO EXISTENTE',
    items: [
      { id: 'frontalRotulado', label: 'FRONTAL\n(ROTULADO)' },
      { id: 'frontalPotencia', label: 'FRONTAL CON\nPOTENCIA' },
      { id: 'perfil', label: 'PERFIL' },
      { id: 'etiqueta', label: 'ETIQUETA' },
      { id: 'codigoSerie', label: 'CODIGO SERIE', centered: true }
    ]
  },
  // 6. XBOX
  xbox: {
    id: 'xbox',
    title: 'XBOX',
    items: [
      { id: 'cierreCarcasa', label: 'FRONTAL\n(ROTULADO)', help: 'La junta de la carcasa es plana' },
      { id: 'frontalBandeja', label: 'FRONTAL\nBANDEJA', help: 'Debe apreciarse las fusiones, fijación, orden y curvatura de las fibras' },
      { id: 'posteriorBandeja', label: 'POSTERIOR\nBANDEJA', help: 'Debe apreciarse la fijación, orden y curvatura de las fibras' },
      { id: 'bandejasAseguradas', label: 'BANDEJAS\nASEGURADAS', help: 'Debe apreciarse las bandejas aseguradas con cinta Velcro' },
      { id: 'fibraAsegurada', label: 'FIBRA\nASEGURADA', help: 'Verifique si los cables ópticos y las fibras están asegurados.' },
      { id: 'codigoSerie', label: 'CODIGO SERIE', help: 'Número de serie visible.' },
      { id: 'panoramica', label: 'PANORAMICA', help: 'Debe observarse la ubicación  al centro de la cruceta' },
      { id: 'etiquetaEntrada', label: 'ETIQUETA\nENTRADA', help: 'Entrada de la FO alimentadora' },
      { id: 'etiquetaSalida', label: 'ETIQUETA\nSALIDA', help: 'Salida de la FO alimentadora', centered: true },
      // SUBSECCION
      {
        id: 'sub_etiquetaSalida',
        title: 'ETIQUETAS DE FO DE SALIDA',
        items: [
          { id: 'salida1', label: 'SALIDA 1' },
          { id: 'salida2', label: 'SALIDA 2' },
          { id: 'salida3', label: 'SALIDA 3' }
        ]
      }
    ]
  },
  // 7. HBOX
  hbox: {
    id: 'hbox',
    title: 'HBOX',
    items: [
      { id: 'cierreCarcasa', label: 'FRONTAL\n(ROTULADO)', help: 'La junta de la carcasa es plana' },
      { id: 'panoramica', label: 'PANORAMICA', help: 'Debe observarse la ubicación y fijación del HBOX al centro de la cruceta' },
      { id: 'codigoSerie', label: 'CODIGO SERIE' },
      { id: 'etiquetaIngreso', label: 'ETIQUETA FO\nINGRESO', help: 'Entrada de la FO alimentadora' },
      // SUBSECCION
      {
        id: 'sub_etiquetaFat',
        title: 'ETIQUETAS DE FO DE SALIDA',
        items: [
          { id: 'salida1', label: 'SALIDA 1' },
          { id: 'salida2', label: 'SALIDA 2' },
          { id: 'salida3', label: 'SALIDA 3' }
        ]
      }
    ]
  },
  // 8. POSTE
  poste: {
    id: 'poste',
    title: 'POSTE',
    items: [
      { id: 'frontal', label: 'Frontal' },
      { id: 'perfil', label: 'Perfil' },
      { id: 'codigo', label: 'Código' },
      { id: 'alturaFuerza', label: 'Altura/Fuerza' },
      { id: 'base', label: 'Base' },
      { id: 'ferreteria', label: 'Parte Superior\n(Ferretería)' },
      { id: 'abscisaInicial', label: 'ABSCISA\nINICIAL' },
      { id: 'abscisaFinal', label: 'ABSCISA\nFINAL' }
    ]
  },
  // 9. ADICIONALES (dinámico)
  adicionales: {
    id: 'adicionales',
    title: 'ADICIONALES',
    items: [],
    dynamic: true
  },
  // 10. INSTALACIÓN
  instalacion: {
    id: 'instalacion',
    title: 'INSTALACIÓN',
    items: [
      { id: 'centradoPoste',      label: 'CENTRADO\nDE POSTE',    help: 'Izado recto del poste con grua' },
      { id: 'cimentacionPiedras', label: 'CIMENTACION\nPIEDRAS',  help: 'Piedras de 8" en la base del poste' },
      { id: 'cimentacionCemento', label: 'CIMENTACION\nCEMENTO',  help: 'Personal cubriendo con cemento la base del poste' },
      { id: 'basamento',          label: 'BASAMENTO',             help: 'Cobertura de la base con cemento o asfalto según superficie' },
      { id: 'frontal',            label: 'FRONTAL',               help: 'Vista frontal panorámica del poste instalado' },
      { id: 'perfil',             label: 'PERFIL',                help: 'Vista de perfil del poste instalado' },
      { id: 'rotulado',           label: 'ROTULADO',              help: 'Foto al rotulado del poste' }
    ]
  },
  // 11. SITE 1
  site1: {
    id: 'site1',
    title: 'SITE 1',
    items: [
      { id: 'acceso', label: 'FOTOS DE\nACCESO', type: 'subgallery', minSlots: 5 },
      { id: 'finalRuta',         label: 'FINAL DE\nRUTA',           help: 'Tubería ingreso al gabinete' },
      { id: 'gabinete',          label: 'GABINETE',                 help: 'Vista frontal gabinete cerrado' },
      { id: 'panoramica',        label: 'PANORAMICA',               help: 'Vista de todos los equipos internos del gabinete' },
      { id: 'interiorPanduit',   label: 'INTERIOR\nPANDUIT',        help: 'Fibra acondicionada en caja panduit' },
      { id: 'instalacionPanduit',label: 'INSTALACION\nPANDUIT',     help: 'Vista panorámica mostrando ubicación del panduit' },
      { id: 'rotuladoPanduit',   label: 'ROTULADO\nPANDUIT',        help: 'Rotulado de la caja panduit' },
      { id: 'jumper01',          label: 'JUMPER 01\nA EQUIPO rCSR', help: 'Primer extremo del jumper' },
      { id: 'jumper02',          label: 'JUMPER 02\nA EQUIPO rCSR', help: 'Segundo extremo del jumper' }
    ]
  },
  // 12. SITE 2
  site2: {
    id: 'site2',
    title: 'SITE 2',
    items: [
      { id: 'acceso', label: 'FOTOS DE\nACCESO', type: 'subgallery', minSlots: 5 },
      { id: 'finalRuta',         label: 'FINAL DE\nRUTA',           help: 'Tubería ingreso al gabinete' },
      { id: 'gabinete',          label: 'GABINETE',                 help: 'Vista frontal gabinete cerrado' },
      { id: 'panoramica',        label: 'PANORAMICA',               help: 'Vista de todos los equipos internos del gabinete' },
      { id: 'interiorPanduit',   label: 'INTERIOR\nPANDUIT',        help: 'Fibra acondicionada en caja panduit' },
      { id: 'instalacionPanduit',label: 'INSTALACION\nPANDUIT',     help: 'Vista panorámica mostrando ubicación del panduit' },
      { id: 'rotuladoPanduit',   label: 'ROTULADO\nPANDUIT',        help: 'Rotulado de la caja panduit' },
      { id: 'jumper01',          label: 'JUMPER 01\nA EQUIPO rCSR', help: 'Primer extremo del jumper' },
      { id: 'jumper02',          label: 'JUMPER 02\nA EQUIPO rCSR', help: 'Segundo extremo del jumper' }
    ]
  },
  // 13. NODO
  nodo: {
    id: 'nodo',
    title: 'NODO',
    items: [
      { id: 'ingreso',           label: 'INGRESO' },
      { id: 'panoramicaGabinete',label: 'PANORAMICA\nGABINETE' },
      { id: 'switch',            label: 'SWITCH' },
      { id: 'router',            label: 'ROUTER' },
      { id: 'olt',               label: 'OLT' },
      { id: 'odf01',             label: 'ODF 01' },
      { id: 'odf02',             label: 'ODF 02' }
    ]
  }
};

export const MAIN_TABS = [
  { id: 'postes',    label: 'POSTES',    subs: ['poste', 'instalacion'] },
  { id: 'mufas',     label: 'MUFAS',     subs: ['mufaTroncal', 'mufaFdt'] },
  { id: 'fatNap',    label: 'FAT/NAP',   subs: ['fatPrecoExistente', 'fatPrecoNueva', 'napMec'] },
  { id: 'box',       label: 'BOX',       subs: ['xbox', 'hbox'] },
  { id: 'sites',     label: 'SITES',     subs: ['site1', 'site2', 'nodo'] },
  { id: 'adicionales', label: 'ADICIONALES', subs: [] },
];

export const EXTRAS_ITEMS = ['Extra 1', 'Extra 2', 'Extra 3'];

// Helpers para normalizar fotos que pueden ser string o { url, thumb, timestamp }
const getFotoThumb = (foto) => {
  if (!foto) return null;
  if (typeof foto === 'string') return foto;
  return foto.thumb || foto.url || null;
};
const getFotoUrl = (foto) => {
  if (!foto) return null;
  if (typeof foto === 'string') return foto;
  return foto.url || foto.thumb || null;
};

const DEFAULT_STAMP_CONFIG = { logoPosition: 'right', mostrarNroPoste: true, mostrarCodFat: false, fondoSello: 'white' };

export default function PhotoManager({ onClose, datos, setDatos, proyectoActual, puntoTemporal, initialTab = 'napMec', puntoId, logoApp, onFotoSubida }) {
  const fotosActuales = datos?.fotos || {}; // Inicializar vacío seguro
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [regenerandoThumbs, setRegenerandoThumbs] = useState(new Set());
  // compartirModal: null | { sectionId, step: 'elegir'|'config' }
  const [compartirModal, setCompartirModal] = useState(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [iosShareFallbackUrl, setIosShareFallbackUrl] = useState(null);
  const [stampConfigCompartir, setStampConfigCompartir] = useState(() => {
    try { const s = localStorage.getItem('kipo_stamp_config'); if (s) return JSON.parse(s); } catch {}
    return DEFAULT_STAMP_CONFIG;
  });
  const [logoModalBase64, setLogoModalBase64] = useState(null);
  const [logoModalCargando, setLogoModalCargando] = useState(false);
  const [sinLogoAdvertencia, setSinLogoAdvertencia] = useState(false);
  const logoModalInputRef = useRef(null);
  const prefetchRef = useRef(null);
  const workerRef = useRef(null);
  const workerPendingRef = useRef({});
  const logoCacheRef = useRef(null);
  const [hrToasts, setHrToasts] = useState([]);

  const updateStampConfig = (updater) => {
    setStampConfigCompartir(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem('kipo_stamp_config', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const cargarLogoModal = async () => {
    setLogoModalCargando(true);
    setLogoModalBase64(null);
    try {
      // 1. logoApp ya es base64
      if (logoApp?.startsWith('data:')) { setLogoModalBase64(logoApp); return; }
      // 2. Logo del proyecto (misma fuente que usan los exports)
      if (proyectoActual?.logoEmpresa) {
        const b64 = await urlABase64(proyectoActual.logoEmpresa);
        if (b64) { setLogoModalBase64(b64); return; }
      }
      // 3. logoApp como URL
      if (logoApp) {
        const b64 = await urlABase64(logoApp);
        if (b64) { setLogoModalBase64(b64); return; }
      }
    } catch (e) { console.error('Error cargando logo para modal:', e); }
    finally { setLogoModalCargando(false); }
  };
  const fileInputRef = useRef(null);
  const activeCaptureRef = useRef(null);
  const lastFileRef = useRef({ name: '', size: 0, time: 0 });
  const generalCameraRef = useRef(null);
  const [asociarModal, setAsociarModal] = useState(null); // null | { tabId, selectedLeft: null|number, selectedRight: null|string, fotosProyecto: [], cargando: bool }

  // Cargar fotos del proyecto cuando se abre el modal asociar
  const abrirAsociarModal = async (tabId) => {
    setAsociarModal({ tabId, selectedLeft: null, selectedRight: null, fotosProyecto: [], cargando: true });
    try {
      const col = collection(db, 'proyectos', proyectoActual?.id, 'fotosProyecto');
      const snap = await getDocs(query(col, orderBy('creadoEn', 'asc')));
      const fotos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAsociarModal(prev => prev ? { ...prev, fotosProyecto: fotos, cargando: false } : prev);
    } catch {
      setAsociarModal(prev => prev ? { ...prev, cargando: false } : prev);
    }
  };

  // Pestaña activa — restaurar última usada, o la que pide el padre
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('kipo_last_tab');
    if (saved && TABS_CONFIG[saved]) return saved;
    return initialTab;
  });

  // Main tab (fila superior): derivar desde activeTab
  const mainTabForSub = (subId) => {
    if (subId === 'adicionales') return 'adicionales';
    return MAIN_TABS.find(m => m.subs.includes(subId))?.id || MAIN_TABS[0].id;
  };
  const [activeMainTab, setActiveMainTab] = useState(() => mainTabForSub(
    (() => { const s = localStorage.getItem('kipo_last_tab'); return s && TABS_CONFIG[s] ? s : initialTab; })()
  ));

  const [subGalleryOpen, setSubGalleryOpen] = useState(null); // 'site1' | 'site2' | null

  const cambiarMain = (mainId) => {
    setActiveMainTab(mainId);
    if (mainId === 'adicionales') {
      cambiarTab('adicionales');
    } else {
      const main = MAIN_TABS.find(m => m.id === mainId);
      if (main?.subs.length) cambiarTab(main.subs[0]);
    }
  };

  const cambiarTab = (tabId) => {
    setActiveTab(tabId);
    try { localStorage.setItem('kipo_last_tab', tabId); } catch {}
  };

  // Bloquear botón Atrás del dispositivo mientras la cámara está abierta
  useEffect(() => {
    history.pushState({ kipo: 'fotos' }, '');
    const handlePop = () => history.pushState({ kipo: 'fotos' }, '');
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Persistir fotos en localStorage para recuperar tras kill de app (solo puntos nuevos)
  useEffect(() => {
    if (puntoId) return;
    try {
      localStorage.setItem('kipo_draft', JSON.stringify({
        fotos: datos?.fotos || {},
        proyectoId: proyectoActual?.id,
        lat: puntoTemporal?.lat || coords?.lat || null,
        lng: puntoTemporal?.lng || coords?.lng || null,
        ts: Date.now()
      }));
    } catch {}
  }, [datos?.fotos]);

  // Obtener coordenadas (del punto guardado o del punto temporal)
  const coords = datos?.coords || (puntoTemporal ? { lat: puntoTemporal.lat, lng: puntoTemporal.lng } : { lat: 0, lng: 0 });

  // Geocoding: obtener dirección de coordenadas
  useEffect(() => {
    const obtenerDireccion = async () => {
      if (!coords.lat || !coords.lng || datos?.direccion) return;

      try {
        const nominatimBase = import.meta.env.DEV
          ? '/api/nominatim'
          : 'https://nominatim.openstreetmap.org';
        const response = await fetch(
          `${nominatimBase}/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`
        );
        const data = await response.json();

        if (data.address) {
          const road = data.address.road || data.address.street || '';
          const house = data.address.house_number || '';
          const direccion = `${road} ${house}`.trim() || '-';

          const city = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
          const state = data.address.state || data.address.region || '';
          const ubicacion = [city, state].filter(Boolean).join(', ') || '';

          setDatos(prev => ({ ...prev, direccion, ubicacion }));
        } else {
          setDatos(prev => ({ ...prev, direccion: '-' }));
        }
      } catch (error) {
        // En caso de error (ej: CORS en localhost), mostrar mensaje
        setDatos(prev => ({ ...prev, direccion: '-' }));
      }
    };

    obtenerDireccion();
  }, [coords.lat, coords.lng]);

  // Worker de estampado alta calidad (hilo separado, no bloquea UI)
  useEffect(() => {
    try {
      const worker = new Worker(new URL('../utils/stampWorker.js', import.meta.url));
      worker.onmessage = ({ data }) => {
        const handler = workerPendingRef.current[data.id];
        if (handler) {
          delete workerPendingRef.current[data.id];
          if (data.ok) handler.resolve(data.buffer);
          else handler.reject(new Error(data.error));
        }
      };
      worker.onerror = (err) => { console.error('Worker error:', err); };
      workerRef.current = worker;
      return () => worker.terminate();
    } catch (e) {
      console.error('No se pudo inicializar el worker de estampado:', e);
    }
  }, []);

  // Pre-fetch logo del proyecto al cargar / cambiar proyecto
  useEffect(() => {
    if (!proyectoActual?.logoEmpresa) { logoCacheRef.current = null; return; }
    urlABase64(proyectoActual.logoEmpresa)
      .then(b64 => { logoCacheRef.current = b64; })
      .catch(() => { logoCacheRef.current = null; });
  }, [proyectoActual?.logoEmpresa]);

  const stampViaWorker = (imageBitmap, datos, logoBase64, stampConfig, quality = 0.92) =>
    new Promise((resolve, reject) => {
      if (!workerRef.current) { reject(new Error('Worker no disponible')); return; }
      const id = Math.random().toString(36).slice(2);
      workerPendingRef.current[id] = { resolve, reject };
      workerRef.current.postMessage({ id, imageBitmap, datos, logoBase64, stampConfig, quality }, [imageBitmap]);
    });

  const guardarHrToast = async (toast) => {
    const { blob, fileName, id } = toast;
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS && navigator.share) {
      try {
        const shareFile = new File([blob], fileName, { type: 'image/jpeg' });
        await navigator.share({ files: [shareFile] });
        setHrToasts(prev => prev.filter(t => t.id !== id));
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    // Fallback: overlay in-app (iOS) o descarga directa (Android/desktop)
    const urlHR = URL.createObjectURL(blob);
    if (isIOS) {
      setIosShareFallbackUrl(urlHR);
      setHrToasts(prev => prev.filter(t => t.id !== id));
    } else {
      const a = document.createElement('a');
      a.href = urlHR; a.download = fileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(urlHR), 2000);
      setHrToasts(prev => prev.filter(t => t.id !== id));
    }
  };

  const triggerCamera = (e, section, item) => {
    if (e && e.stopPropagation) e.stopPropagation();
    activeCaptureRef.current = { section, item };
    if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); }
  };

  const handleFileChange = (e) => {
    if (!e.target.files || e.target.files.length === 0 || !activeCaptureRef.current) return;

    const file = e.target.files[0];
    const now = Date.now();

    if (file.name === lastFileRef.current.name && file.size === lastFileRef.current.size && (now - lastFileRef.current.time) < 1000) {
      return;
    }
    lastFileRef.current = { name: file.name, size: file.size, time: now };

    const { section, item } = activeCaptureRef.current;
    activeCaptureRef.current = null;

    // Mostrar preview inmediato con object URL (sin esperar decoding)
    const previewUrl = URL.createObjectURL(file);
    setDatos(prev => {
      const prevFotos = prev.fotos || {};
      return {
        ...prev,
        fotos: {
          ...prevFotos,
          [section]: { ...(prevFotos[section] || {}), [item]: { thumb: previewUrl, uploading: true } }
        }
      };
    });

    const img = new Image();

    img.onerror = () => {
      URL.revokeObjectURL(previewUrl);
      const ext = (file.name || '').toLowerCase().split('.').pop();
      const isHeic = ext === 'heic' || ext === 'heif' || (file.type || '').includes('heic') || (file.type || '').includes('heif');
      if (isHeic) {
        alert('Formato HEIC (iPhone) no compatible con el navegador.\n\nEn tu iPhone: Configuración → Cámara → Formatos → Mayor Compatibilidad para capturar en JPEG.');
      } else {
        alert('No se pudo cargar la imagen. Intenta con otro formato (JPEG o PNG).');
      }
    };

    img.onload = async () => {
        const altaCalidad = proyectoActual?.modoFotos === 'altaCalidad';

        // --- Thumbnail pequeño (max 256px, JPEG 0.6) → se guarda en Firestore ---
        const MAX_T = 256;
        const scaleT = Math.min(MAX_T / img.width, MAX_T / img.height, 1);
        const wt = Math.floor(img.width * scaleT);
        const ht = Math.floor(img.height * scaleT);
        const canvasThumb = document.createElement('canvas');
        canvasThumb.width = wt; canvasThumb.height = ht;
        canvasThumb.getContext('2d').drawImage(img, 0, 0, wt, ht);
        const thumbUrl = canvasThumb.toDataURL('image/jpeg', 0.6);

        // Reemplazar la preview con el thumb base64 comprimido y liberar la URL temporal
        URL.revokeObjectURL(previewUrl);
        setDatos(prev => {
          const prevFotos = prev.fotos || {};
          return {
            ...prev,
            fotos: {
              ...prevFotos,
              [section]: { ...(prevFotos[section] || {}), [item]: { thumb: thumbUrl, uploading: true } }
            }
          };
        });

        const uploadPath = `proyectos/${proyectoActual?.id || 'temp'}/fotos_detalle/${section}_${item}_${Date.now()}.jpg`;

        // Registrar path como pendiente para limpieza de huérfanos
        const trackUpload = (path) => {
          try {
            const list = JSON.parse(localStorage.getItem('kipo_pending_paths') || '[]');
            if (!list.find(e => e.path === path)) {
              list.push({ path, ts: Date.now() });
              localStorage.setItem('kipo_pending_paths', JSON.stringify(list));
            }
          } catch {}
        };

        const limpiarFoto = () => {
          setDatos(prev => {
            const prevFotos = { ...(prev.fotos || {}) };
            if (prevFotos[section]) { const sec = { ...prevFotos[section] }; delete sec[item]; prevFotos[section] = sec; }
            return { ...prev, fotos: prevFotos };
          });
        };
        const guardarFoto = async (blobToUpload) => {
          trackUpload(uploadPath);
          await saveUploadPending({ path: uploadPath, blob: blobToUpload, section, item, proyectoId: proyectoActual?.id, puntoId: puntoId || null, thumb: thumbUrl });
          const downloadUrl = await uploadImage(blobToUpload, uploadPath);
          await deleteUploadPending(uploadPath);
          onFotoSubida?.(downloadUrl);
          const fotoData = { url: downloadUrl, thumb: thumbUrl, timestamp: new Date().toISOString(), _path: uploadPath };
          setDatos(prev => {
            const prevFotos = prev.fotos || {};
            return {
              ...prev,
              fotos: {
                ...prevFotos,
                [section]: { ...(prevFotos[section] || {}), [item]: fotoData }
              }
            };
          });
          // Persistir inmediatamente a Firestore si es edición de punto existente
          if (puntoId) {
            updateDoc(doc(db, 'puntos', puntoId), {
              [`datos.fotos.${section}.${item}`]: fotoData
            }).catch(() => {});
          }
        };

        if (altaCalidad) {
          // Alta calidad: subir original (urlHD) + comprimida (url), no bloqueante
          (async () => {
            try {
              // 1. Subir original al 100% → urlHD (para encarpetado/ZIP)
              trackUpload(uploadPath);
              const urlHD = await uploadImage(file, uploadPath);
              onFotoSubida?.(urlHD);

              // 2. Crear versión comprimida 1280px → url (para EXCEL, KMZ y vista previa)
              const MAX_F = 1280;
              const scaleF = Math.min(MAX_F / img.width, MAX_F / img.height, 1);
              const wf = Math.floor(img.width * scaleF);
              const hf = Math.floor(img.height * scaleF);
              const canvasFull = document.createElement('canvas');
              canvasFull.width = wf; canvasFull.height = hf;
              canvasFull.getContext('2d').drawImage(img, 0, 0, wf, hf);
              const compressedBlob = await new Promise((res, rej) =>
                canvasFull.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.75)
              );
              const uploadPathC = `proyectos/${proyectoActual?.id || 'temp'}/fotos_detalle/${section}_${item}_${Date.now()}_c.jpg`;
              trackUpload(uploadPathC);
              const urlC = await uploadImage(compressedBlob, uploadPathC);
              onFotoSubida?.(urlC);

              const fotoDataHD = { url: urlC, urlHD, thumb: thumbUrl, timestamp: new Date().toISOString(), _path: uploadPathC, _pathHD: uploadPath };
              setDatos(prev => {
                const prevFotos = prev.fotos || {};
                return {
                  ...prev,
                  fotos: {
                    ...prevFotos,
                    [section]: { ...(prevFotos[section] || {}), [item]: fotoDataHD }
                  }
                };
              });
              if (puntoId) {
                updateDoc(doc(db, 'puntos', puntoId), {
                  [`datos.fotos.${section}.${item}`]: fotoDataHD
                }).catch(() => {});
              }
            } catch (err) {
              console.error('Error subiendo foto alta calidad:', err);
              limpiarFoto();
            }
          })();
        } else {
          // Comprimido: redimensionar a 1280px, Q:0.75
          const MAX_F = 1280;
          const scaleF = Math.min(MAX_F / img.width, MAX_F / img.height, 1);
          const wf = Math.floor(img.width * scaleF);
          const hf = Math.floor(img.height * scaleF);
          const canvasFull = document.createElement('canvas');
          canvasFull.width = wf; canvasFull.height = hf;
          canvasFull.getContext('2d').drawImage(img, 0, 0, wf, hf);
          canvasFull.toBlob(async (blob) => {
            if (!blob) { limpiarFoto(); alert('Error al procesar la imagen.'); return; }
            try { await guardarFoto(blob); }
            catch (err) { console.error('Error subiendo foto:', err); limpiarFoto(); alert('Error al subir la foto. Verifique su conexión.'); }
          }, 'image/jpeg', 0.75);
        }
      };

    img.src = previewUrl;
  };

  // Cámara general — agrega fotos a fotosGenerales para usar con ASOCIAR FOTO
  const handleGeneralCamera = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const MAX_T = 512;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const scale = Math.min(MAX_T / img.width, MAX_T / img.height, 1);
        const w = Math.floor(img.width * scale), h = Math.floor(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const thumbBase64 = canvas.toDataURL('image/jpeg', 0.7);
        const tempId = `gp_${Date.now()}`;
        setDatos(prev => ({
          ...prev,
          fotosGenerales: [...(prev.fotosGenerales || []), { _tempId: tempId, thumb: thumbBase64, uploading: true, timestamp: new Date().toISOString() }]
        }));
        try {
          const path = `proyectos/${proyectoActual?.id || 'temp'}/fotos/${Date.now()}.jpg`;
          const blob = await fetch(thumbBase64).then(r => r.blob());
          const { uploadImage } = await import('../utils/storage');
          const url = await uploadImage(blob, path);
          setDatos(prev => ({
            ...prev,
            fotosGenerales: (prev.fotosGenerales || []).map(f => f._tempId === tempId ? { ...f, url, uploading: false } : f)
          }));
        } catch {
          setDatos(prev => ({
            ...prev,
            fotosGenerales: (prev.fotosGenerales || []).filter(f => f._tempId !== tempId)
          }));
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = () => {
    if (!viewingPhoto) return;
    const { section, item } = viewingPhoto;

    setDatos(prevDatos => {
      const prevFotos = prevDatos.fotos || {};
      if (prevFotos[section]) {
        const newSection = { ...prevFotos[section] };
        delete newSection[item];
        return { ...prevDatos, fotos: { ...prevFotos, [section]: newSection } };
      }
      return prevDatos;
    });
    setViewingPhoto(null);
  };

  // Construye lista de fotos con URLs y etiquetas para una sección
  const buildFotoItems = (sectionId) => {
    const sectionPhotos = fotosActuales[sectionId] || {};
    const tab = TABS_CONFIG[sectionId];
    const items = [];
    if (tab.dynamic) {
      Object.entries(sectionPhotos)
        .filter(([, v]) => getFotoUrl(v))
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([idx, fotoRaw]) => {
          const url = getFotoUrl(fotoRaw);
          if (url) items.push({ url, label: `FOTO ${parseInt(idx) + 1}` });
        });
    } else {
      tab.items.forEach(item => {
        if (item.items) {
          item.items.forEach(sub => {
            const url = getFotoUrl(sectionPhotos[sub.id]);
            if (url) items.push({ url, label: sub.label.replace('\n', ' ') });
          });
        } else {
          const url = getFotoUrl(sectionPhotos[item.id]);
          if (url) items.push({ url, label: item.label.replace('\n', ' ') });
        }
      });
      EXTRAS_ITEMS.forEach(label => {
        const url = getFotoUrl(sectionPhotos[label]);
        if (url) items.push({ url, label });
      });
    }
    return items;
  };

  const compartirFotos = (sectionId) => {
    const fotoItems = buildFotoItems(sectionId);
    if (fotoItems.length === 0) { alert('No hay fotos para compartir'); return; }
    if (!navigator.share || !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      alert('Función de compartir no disponible en este dispositivo'); return;
    }
    // Pre-fetch imágenes inmediatamente para evitar NotAllowedError
    prefetchRef.current = Promise.all(fotoItems.map(({ url }) => fetch(url).then(r => r.blob()).catch(() => null)));
    setCompartirModal({ sectionId, step: 'elegir', modo: 'fotos' });
  };

  const compartirLista = async (sectionId) => {
    const fotoItems = buildFotoItems(sectionId);
    if (fotoItems.length === 0) { alert('No hay fotos para compartir'); return; }
    if (!navigator.share || !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      alert('Función de compartir no disponible en este dispositivo'); return;
    }
    const tab = TABS_CONFIG[sectionId];
    const nroPoste = datos?.numero || '';
    const pasivoVal = datos?.pasivo || '';
    const headerText = [
      `FOTOS DE ${tab.title}`,
      nroPoste ? `ITEM: *${nroPoste}*` : null,
      pasivoVal ? `COD E. PASIVO: *${pasivoVal}*` : null,
    ].filter(Boolean).join('\n');
    const listText = '*LISTA DE FOTOS:*\n' + fotoItems.map(f => `• ${f.label}`).join('\n');
    try {
      await navigator.share({ text: `${headerText}\n${listText}` });
    } catch (error) {
      if (error.name !== 'AbortError') console.log('Error compartiendo lista:', error);
    }
  };

  const ejecutarCompartir = async (conSello, stampCfg) => {
    const { sectionId, modo = 'fotos' } = compartirModal;
    setCompartiendo(true);
    try {
      const fotoItems = buildFotoItems(sectionId);
      const tab = TABS_CONFIG[sectionId];
      if (fotoItems.length === 0) return;

      const blobs = await (prefetchRef.current || Promise.all(fotoItems.map(({ url }) => fetch(url).then(r => r.blob()).catch(() => null))));

      const coords = datos?.coords;
      const gps = coords ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` : '';
      const datosEstampado = {
        numero: datos?.numero || '', proyecto: proyectoActual?.nombre || '',
        gps, fecha: datos?.fecha || new Date().toISOString(), hora: datos?.hora || '',
        codFat: datos?.pasivo || '', pasivo: datos?.pasivo || '',
        direccion: datos?.direccion || '', ubicacion: datos?.ubicacion || '',
      };

      const logoParam = conSello ? (logoModalBase64 || null) : null;

      const files = (await Promise.all(
        blobs.map(async (blob, i) => {
          if (!blob) return null;
          if (conSello) {
            const stamped = await estamparMetadatos(blob, datosEstampado, logoParam, stampCfg);
            return new File([stamped.buffer], `foto_${i + 1}.jpg`, { type: 'image/jpeg' });
          }
          return new File([blob], `foto_${i + 1}.jpg`, { type: 'image/jpeg' });
        })
      )).filter(Boolean);

      const nroPoste = datos?.numero || '';
      const pasivoVal = datos?.pasivo || '';
      const headerText = [
        `FOTOS DE ${tab.title}`,
        nroPoste ? `ITEM: *${nroPoste}*` : null,
        pasivoVal ? `COD E. PASIVO: *${pasivoVal}*` : null,
      ].filter(Boolean).join('\n');
      const listText = '*LISTA DE FOTOS:*\n' + fotoItems.map(f => `• ${f.label}`).join('\n');

      if (modo === 'lista') {
        await navigator.share({ text: `${headerText}\n${listText}` });
      } else {
        await navigator.share({ files });
      }
    } catch (error) {
      if (error.name !== 'AbortError') console.log('Error compartiendo:', error);
    } finally {
      setCompartiendo(false);
      setCompartirModal(m => m ? { ...m, step: 'config' } : null);
      prefetchRef.current = null;
    }
  };

  const handleThumbError = async (section, item, fotoUrl) => {
    if (!fotoUrl || !fotoUrl.startsWith('http')) return;
    const key = `${section}/${item}`;
    if (regenerandoThumbs.has(key)) return;

    setRegenerandoThumbs(prev => new Set([...prev, key]));
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = `${fotoUrl}?t=${Date.now()}`;
      });

      const MAX_T = 256;
      const scale = Math.min(MAX_T / img.width, MAX_T / img.height, 1);
      const w = Math.floor(img.width * scale);
      const h = Math.floor(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const newThumb = canvas.toDataURL('image/jpeg', 0.6);

      setDatos(prev => {
        const prevFotos = prev.fotos || {};
        const prevSection = prevFotos[section] || {};
        const prevItem = prevSection[item] || {};
        return {
          ...prev,
          fotos: {
            ...prevFotos,
            [section]: { ...prevSection, [item]: { ...prevItem, thumb: newThumb } }
          }
        };
      });

      if (puntoId) {
        await updateDoc(doc(db, 'puntos', String(puntoId)), {
          [`datos.fotos.${section}.${item}.thumb`]: newThumb
        });
      }
    } catch (err) {
      console.error('Error regenerando miniatura:', err);
    } finally {
      setRegenerandoThumbs(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const PhotoSquare = ({ label, help, image, onClick, uploading, isRegenerando, onThumbError }) => {
    const lines = label.split('\n');
    const blocked = uploading || isRegenerando;
    return (
      <div onClick={blocked ? undefined : onClick} className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all select-none ${blocked ? 'cursor-wait' : 'active:scale-95'} ${image ? 'bg-black border-2 border-black' : 'bg-white border-2 border-dashed border-slate-900 hover:bg-slate-50'}`}>
        {image ? (
          <>
            <img src={image} alt={label} className="w-full h-full object-cover" onError={onThumbError} />
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-1 px-2">
              <p className="text-white text-[10px] font-black text-center uppercase tracking-wider leading-tight">
                {lines.map((line, i) => <span key={i} className="block">{line}</span>)}
              </p>
            </div>
            {uploading ? (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-[9px] font-bold">Subiendo...</span>
              </div>
            ) : isRegenerando ? (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1">
                <div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-[9px] font-bold">Regenerando...</span>
              </div>
            ) : (
              <div className="absolute top-1 right-1 bg-black/50 rounded-full p-1">
                <Maximize2 size={10} className="text-white" />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-1 text-center relative">
            <Camera className="w-8 h-8 text-slate-900 mb-1" strokeWidth={2} />
            <p className="text-slate-900 text-[10px] font-black uppercase leading-tight">
              {lines.map((line, i) => <span key={i} className="block">{line}</span>)}
            </p>
            {help && (
              <p className="text-[8px] text-slate-500 font-bold mt-1 leading-tight px-1">{help}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Calcular contador para cada pestaña (Helper recursivo o plano)
  const getCounter = (tabId) => {
    const cfg = TABS_CONFIG[tabId];
    const sectionPhotos = fotosActuales[tabId] || {};

    // Pestaña dinámica (adicionales): contar fotos existentes
    if (cfg.dynamic) {
      const taken = Object.keys(sectionPhotos).filter(k => sectionPhotos[k]).length;
      return { text: `(${taken})`, color: taken > 0 ? 'text-green-600' : 'text-slate-400', count: taken };
    }

    // Aplanar items para contar
    let allItems = [];
    let subgalleryCount = 0;
    cfg.items.forEach(item => {
      if (item.type === 'subgallery') {
        subgalleryCount += Object.keys(sectionPhotos).filter(k => k.startsWith(item.id + '_') && sectionPhotos[k]).length;
      } else if (item.items) {
        item.items.forEach(sub => allItems.push(sub.id));
      } else {
        allItems.push(item.id);
      }
    });

    const taken = allItems.filter(id => sectionPhotos[id]).length + subgalleryCount;
    const total = allItems.length;
    const isComplete = taken === total && total > 0;
    const isEmpty = taken === 0;

    return {
      text: total > 0 ? `(${taken}/${total})` : '',
      color: isEmpty ? 'text-red-600' : (isComplete ? 'text-green-600' : 'text-orange-600'),
      count: taken
    };
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-100">

      {/* HEADER */}
      <div className="bg-slate-900 px-4 flex items-center justify-between shadow-md shrink-0 pt-safe-header" style={{ paddingBottom: '12px' }}>
        <button onClick={onClose} className="flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest border-2 border-slate-300 active:scale-95 transition-all shadow-md">
          <ArrowLeft className="w-4 h-4" strokeWidth={3} />
          CONFIRMAR
        </button>
        <div className="flex flex-col items-end">
          <span className="text-white font-black uppercase tracking-wider text-sm">CÁMARA</span>
          <span className="text-[9px] text-orange-500 font-bold">REGISTRO</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

        {/* PESTAÑAS - 3 FILAS JERÁRQUICAS */}
        <div className="bg-white border-b-2 border-slate-900 flex flex-col">
          {/* Filas 1 y 2: categorías principales (3 por fila) */}
          {[[0,1,2],[3,4,5]].map((indices, rowIdx) => (
            <div key={rowIdx} className={`flex ${rowIdx === 0 ? 'border-b border-slate-200' : 'border-b border-slate-900'}`}>
              {indices.map((i) => {
                const main = MAIN_TABS[i];
                if (!main) return <div key={i} className="flex-1" />;
                const isActive = activeMainTab === main.id;
                const subIds = main.subs.length ? main.subs : [main.id];
                const totalFotos = subIds.reduce((sum, sid) => sum + (getCounter(sid).count || 0), 0);
                return (
                  <button
                    key={main.id}
                    onClick={() => cambiarMain(main.id)}
                    className={`flex-1 min-h-[38px] py-1 px-1 border-r last:border-r-0 border-slate-200 transition-all flex items-center justify-center ${isActive ? 'bg-slate-900' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="p-1 flex flex-col items-center gap-0.5">
                      <div className={`text-[10px] font-black uppercase leading-tight ${isActive ? 'text-white' : 'text-slate-600'}`}>
                        {main.label}
                      </div>
                      {totalFotos > 0 && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-orange-400' : 'bg-green-500'}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          {/* Fila 3: sub-pestañas de la categoría activa */}
          {activeMainTab !== 'adicionales' && (
            <div className="flex">
              {(MAIN_TABS.find(m => m.id === activeMainTab)?.subs || []).map((tabId) => {
                const tab = TABS_CONFIG[tabId];
                if (!tab) return null;
                const counter = getCounter(tab.id);
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tabId}
                    onClick={() => cambiarTab(tab.id)}
                    className={`flex-1 min-h-[38px] py-1 px-1 border-r last:border-r-0 border-slate-200 transition-all flex items-center justify-center ${isActive ? 'bg-orange-500' : 'bg-slate-50 hover:bg-slate-100'}`}
                  >
                    <div className="p-1 flex flex-col items-center">
                      <div className={`text-[8px] font-black uppercase leading-tight ${isActive ? 'text-white' : 'text-slate-600'}`}>
                        {tab.title}
                      </div>
                      <div className={`text-[9px] font-black mt-0.5 ${isActive ? 'text-white' : counter.color}`}>
                        {counter.text}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* CONTENIDO (Grid de fotos) */}
        <div className="p-3 flex-1 overflow-y-auto">
          {/* Separador */}
          <div className="flex items-center gap-2 mb-3">
            <span className="font-black text-slate-900 text-sm uppercase tracking-widest border-b-2 border-slate-900 pb-1 shrink-0">
              {TABS_CONFIG[activeTab]?.title}
            </span>
            <div className="flex-1 h-px bg-slate-300"></div>
            {activeTab !== 'adicionales' && (
              <button
                onClick={() => abrirAsociarModal(activeTab)}
                className="flex items-center gap-1 bg-slate-900 text-white rounded-lg px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform shrink-0 shadow-md hover:bg-slate-700"
              >
                <FolderOpen size={12} /> ASOCIAR FOTO
              </button>
            )}
          </div>

          {proyectoActual?.modoFotos !== 'altaCalidad' && (
            <button onClick={() => compartirFotos(activeTab)} className="w-full mb-4 flex items-center justify-center gap-2 bg-slate-900 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-md">
              <Share2 size={16} />
              COMPARTIR FOTOS
            </button>
          )}

          {activeTab === 'adicionales' ? (
            /* ADICIONALES: grid dinámico con botón "+" */
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(fotosActuales['adicionales'] || {})
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([idx, fotoRaw]) => {
                  const image = getFotoThumb(fotoRaw);
                  const isUploading = typeof fotoRaw === 'object' && fotoRaw?.uploading === true;
                  const isRegen = regenerandoThumbs.has(`adicionales/${idx}`);
                  const fotoUrl = getFotoUrl(fotoRaw);
                  return (
                    <PhotoSquare
                      key={idx}
                      label={`FOTO ${parseInt(idx) + 1}`}
                      image={image}
                      uploading={isUploading}
                      isRegenerando={isRegen}
                      onThumbError={fotoUrl?.startsWith('http') ? () => handleThumbError('adicionales', idx, fotoUrl) : undefined}
                      onClick={(e) => fotoRaw && !isUploading ? setViewingPhoto({ section: 'adicionales', item: idx, url: fotoUrl }) : (!fotoRaw ? triggerCamera(e, 'adicionales', idx) : undefined)}
                    />
                  );
                })}
              {/* Botón "+" para agregar foto */}
              <div
                onClick={(e) => triggerCamera(e, 'adicionales', String(Object.keys(fotosActuales['adicionales'] || {}).length))}
                className="aspect-square rounded-xl overflow-hidden cursor-pointer bg-white border-2 border-dashed border-slate-900 hover:bg-slate-50 active:scale-95 transition-transform flex items-center justify-center"
              >
                <Plus className="w-12 h-12 text-slate-900" strokeWidth={2} />
              </div>
            </div>
          ) : (
            /* TABS ESTÁNDAR: fotos fijas + extras */
            <>
              {/* Fotos principales (y subsecciones) */}
              <div className="space-y-4 mb-3">
                {(() => {
                  const groups = [];
                  let currentNormalGroup = [];

                  (TABS_CONFIG[activeTab]?.items || []).forEach(item => {
                    if (item.type === 'subgallery') {
                      if (currentNormalGroup.length > 0) {
                        groups.push({ type: 'grid', items: [...currentNormalGroup] });
                        currentNormalGroup = [];
                      }
                      groups.push({ type: 'subgallery', data: item });
                    } else if (item.items) {
                      if (currentNormalGroup.length > 0) {
                        groups.push({ type: 'grid', items: [...currentNormalGroup] });
                        currentNormalGroup = [];
                      }
                      groups.push({ type: 'section', data: item });
                    } else {
                      currentNormalGroup.push(item);
                    }
                  });
                  if (currentNormalGroup.length > 0) groups.push({ type: 'grid', items: currentNormalGroup });

                  return groups.map((group, gIdx) => {
                    if (group.type === 'subgallery') {
                      const sgItem = group.data;
                      const sgSection = fotosActuales[activeTab] || {};
                      const sgKeys = Object.keys(sgSection)
                        .filter(k => k.startsWith(sgItem.id + '_'));
                      const sgIndices = sgKeys.map(k => parseInt(k.split('_')[1]));
                      const maxIdx = sgIndices.length > 0 ? Math.max(...sgIndices) : -1;
                      const slotsToShow = Math.max(sgItem.minSlots || 5, maxIdx + 1);
                      const sgCount = sgKeys.filter(k => sgSection[k]).length;
                      const isOpen = subGalleryOpen === activeTab + '_' + sgItem.id;
                      return (
                        <div key={sgItem.id}>
                          {/* Tile especial */}
                          <div
                            onClick={() => setSubGalleryOpen(isOpen ? null : activeTab + '_' + sgItem.id)}
                            className="w-full rounded-xl overflow-hidden cursor-pointer bg-blue-600 border-2 border-blue-800 active:scale-95 transition-all select-none px-4 py-3 flex items-center justify-between"
                          >
                            <div>
                              <div className="text-white font-black text-xs uppercase tracking-widest">FOTOS DE ACCESO</div>
                              <div className="text-blue-200 text-[10px] font-bold mt-0.5">{sgCount} foto{sgCount !== 1 ? 's' : ''}</div>
                            </div>
                            <ChevronDown size={18} className={`text-white transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                          </div>
                          {/* Sub-galería expandida */}
                          {isOpen && (
                            <div className="mt-2 bg-blue-50 border-2 border-blue-200 rounded-xl p-2">
                              <div className="grid grid-cols-2 gap-2">
                                {Array.from({ length: slotsToShow }).map((_, idx) => {
                                  const key = `${sgItem.id}_${idx}`;
                                  const fotoRaw = sgSection[key];
                                  const image = getFotoThumb(fotoRaw);
                                  const isUploading = typeof fotoRaw === 'object' && fotoRaw?.uploading === true;
                                  const isRegen = regenerandoThumbs.has(`${activeTab}/${key}`);
                                  const fotoUrl = getFotoUrl(fotoRaw);
                                  return (
                                    <PhotoSquare
                                      key={key}
                                      label={`ACCESO ${idx + 1}`}
                                      image={image}
                                      uploading={isUploading}
                                      isRegenerando={isRegen}
                                      onThumbError={fotoUrl?.startsWith('http') ? () => handleThumbError(activeTab, key, fotoUrl) : undefined}
                                      onClick={(e) => fotoRaw && !isUploading ? setViewingPhoto({ section: activeTab, item: key, url: fotoUrl }) : (!fotoRaw ? triggerCamera(e, activeTab, key) : undefined)}
                                    />
                                  );
                                })}
                                {/* Botón + para agregar más */}
                                <div
                                  onClick={(e) => triggerCamera(e, activeTab, `${sgItem.id}_${slotsToShow}`)}
                                  className="aspect-square rounded-xl overflow-hidden cursor-pointer bg-white border-2 border-dashed border-blue-400 hover:bg-blue-50 active:scale-95 transition-transform flex items-center justify-center"
                                >
                                  <Plus className="w-10 h-10 text-blue-400" strokeWidth={2} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    } else if (group.type === 'grid') {
                      return (
                        <div key={`g-${gIdx}`} className="grid grid-cols-2 gap-2">
                          {group.items.map(item => {
                            const fotoRaw = fotosActuales[activeTab]?.[item.id];
                            const image = getFotoThumb(fotoRaw);
                            const isUploading = typeof fotoRaw === 'object' && fotoRaw?.uploading === true;
                            const isRegen = regenerandoThumbs.has(`${activeTab}/${item.id}`);
                            const fotoUrl = getFotoUrl(fotoRaw);
                            let colClass = '';
                            if (item.fullWidth) colClass = 'col-span-2';
                            if (item.centered) colClass = 'col-span-2 flex justify-center';

                            return (
                              <div key={item.id} className={colClass}>
                                <div className={item.centered ? 'w-1/2' : 'w-full'}>
                                  <PhotoSquare
                                    label={item.label}
                                    help={item.help}
                                    image={image}
                                    uploading={isUploading}
                                    isRegenerando={isRegen}
                                    onThumbError={fotoUrl?.startsWith('http') ? () => handleThumbError(activeTab, item.id, fotoUrl) : undefined}
                                    onClick={(e) => fotoRaw && !isUploading ? setViewingPhoto({ section: activeTab, item: item.id, url: fotoUrl }) : (!fotoRaw ? triggerCamera(e, activeTab, item.id) : undefined)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    } else {
                      const item = group.data;
                      return (
                        <div key={item.id} className="bg-slate-200 p-2 rounded-xl border border-slate-300">
                          <h4 className="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 border-b border-slate-300 pb-1 text-center">
                            {item.title}
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            {item.items.map(subItem => {
                              const fotoRaw = fotosActuales[activeTab]?.[subItem.id];
                              const image = getFotoThumb(fotoRaw);
                              const isUploading = typeof fotoRaw === 'object' && fotoRaw?.uploading === true;
                              const isRegen = regenerandoThumbs.has(`${activeTab}/${subItem.id}`);
                              const fotoUrl = getFotoUrl(fotoRaw);
                              return (
                                <PhotoSquare
                                  key={subItem.id}
                                  label={subItem.label}
                                  help={subItem.help}
                                  image={image}
                                  uploading={isUploading}
                                  isRegenerando={isRegen}
                                  onThumbError={fotoUrl?.startsWith('http') ? () => handleThumbError(activeTab, subItem.id, fotoUrl) : undefined}
                                  onClick={(e) => fotoRaw && !isUploading ? setViewingPhoto({ section: activeTab, item: subItem.id, url: fotoUrl }) : (!fotoRaw ? triggerCamera(e, activeTab, subItem.id) : undefined)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                  });
                })()}
              </div>

              {/* Separador extras */}
              <div className="flex items-center gap-2 my-3">
                <div className="h-0.5 flex-1 bg-slate-700"></div>
                <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Adicionales</span>
                <div className="h-0.5 flex-1 bg-slate-700"></div>
              </div>

              {/* Fotos extras */}
              <div className="grid grid-cols-3 gap-2">
                {EXTRAS_ITEMS.map(item => {
                  const fotoRaw = fotosActuales[activeTab]?.[item];
                  const image = getFotoThumb(fotoRaw);
                  const isUploading = typeof fotoRaw === 'object' && fotoRaw?.uploading === true;
                  const isRegen = regenerandoThumbs.has(`${activeTab}/${item}`);
                  const fotoUrl = getFotoUrl(fotoRaw);
                  return (
                    <PhotoSquare
                      key={item}
                      label={item}
                      image={image}
                      uploading={isUploading}
                      isRegenerando={isRegen}
                      onThumbError={fotoUrl?.startsWith('http') ? () => handleThumbError(activeTab, item, fotoUrl) : undefined}
                      onClick={(e) => fotoRaw && !isUploading ? setViewingPhoto({ section: activeTab, item, url: fotoUrl }) : (!fotoRaw ? triggerCamera(e, activeTab, item) : undefined)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MODAL: ASOCIAR FOTO (fotosGenerales → slot de tab) */}
      {asociarModal && (
        <div className="fixed inset-0 z-[1100] bg-white flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b-2 border-slate-900 shrink-0">
            <h3 className="text-slate-900 text-sm uppercase tracking-widest leading-tight">
              <span className="font-normal text-slate-400">ITEM </span><span className="font-black">{datos?.numero || '-'}</span>
              <span className="font-normal text-slate-400"> · PASIVO </span><span className="font-black">{datos?.pasivo || '-'}</span>
            </h3>
            <button onClick={() => setAsociarModal(null)} className="p-2 rounded-xl border-2 border-slate-900 text-slate-900"><X size={20} /></button>
          </div>
          <p className="text-slate-500 text-[10px] text-center py-2 px-4 border-b-2 border-slate-900 shrink-0">
            Selecciona una foto de proyecto (izq.) y el slot destino (der.), luego pulsa ACEPTAR.
          </p>
          {/* Split view */}
          <div className="flex flex-1 overflow-hidden gap-px bg-slate-900">
            {/* LEFT: fotos de la Cámara Proyecto */}
            <div className="flex-1 overflow-y-auto bg-white p-2">
              <p className="text-slate-900 text-[9px] font-black uppercase tracking-widest mb-2 text-center border-b-2 border-slate-900 pb-1">CÁMARA PROYECTO</p>
              {asociarModal.cargando ? (
                <div className="flex justify-center py-8"><RefreshCw size={20} className="text-slate-400 animate-spin" /></div>
              ) : asociarModal.fotosProyecto.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">Sin fotos de proyecto</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {asociarModal.fotosProyecto.map((foto) => {
                    const thumb = foto.thumb || foto.url;
                    if (!thumb) return null;
                    const isSelected = asociarModal.selectedLeft === foto.id;
                    return (
                      <div key={foto.id}
                        onClick={() => setAsociarModal(prev => ({ ...prev, selectedLeft: isSelected ? null : foto.id }))}
                        className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all active:scale-95 ${isSelected ? 'border-orange-500' : 'border-slate-900'}`}
                      >
                        <img src={thumb} className="w-full h-full object-cover" alt={foto.nombre} />
                        {/* Nombre centrado con fondo vidrio — ancho completo */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none px-0">
                          <div className="w-full py-1.5 px-3" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
                            <p className="text-white text-xs font-black text-center uppercase leading-tight">{foto.nombre}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute inset-0 bg-orange-500/40 flex items-center justify-center">
                            <Check size={32} className="text-white drop-shadow-lg" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* RIGHT: slots del tab activo */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-2">
              <p className="text-slate-900 text-[9px] font-black uppercase tracking-widest mb-2 text-center border-b-2 border-slate-900 pb-1">SLOTS DESTINO</p>
              <div className="grid grid-cols-1 gap-2">
                {(() => {
                  const tab = TABS_CONFIG[asociarModal.tabId];
                  const slots = [];
                  (tab?.items || []).forEach(item => {
                    if (item.items) {
                      item.items.forEach(sub => slots.push({ id: sub.id, label: sub.label }));
                    } else {
                      slots.push({ id: item.id, label: item.label });
                    }
                  });
                  return slots.map(slot => {
                    const fotoRaw = fotosActuales[asociarModal.tabId]?.[slot.id];
                    const thumb = getFotoThumb(fotoRaw);
                    const isSelected = asociarModal.selectedRight === slot.id;
                    return (
                      <div key={slot.id}
                        onClick={() => setAsociarModal(prev => ({ ...prev, selectedRight: isSelected ? null : slot.id }))}
                        className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all active:scale-95 ${isSelected ? 'border-4 border-orange-500' : thumb ? 'border-2 border-slate-900' : 'border-2 border-dashed border-slate-900'}`}
                      >
                        {thumb ? (
                          <img src={thumb} className="w-full h-full object-cover" alt={slot.label} />
                        ) : (
                          <div className="w-full h-full bg-white" />
                        )}
                        {/* Nombre: con fondo vidrio si hay foto, texto negro sin fondo si no hay */}
                        {thumb ? (
                          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none px-0">
                            <div className="w-full py-1.5 px-3" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
                              <p className="text-white text-xs font-black text-center uppercase leading-tight">{slot.label.replace('\n', ' ')}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <p className="text-slate-900 text-xs font-black text-center uppercase leading-tight px-2">{slot.label.replace('\n', ' ')}</p>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-orange-500/40 flex items-center justify-center">
                            <Check size={32} className="text-white drop-shadow-lg" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          {/* Footer: ACEPTAR */}
          <div className="shrink-0 p-4 bg-white border-t-2 border-slate-900">
            <button
              disabled={asociarModal.selectedLeft === null || asociarModal.selectedRight === null}
              onClick={async () => {
                const { tabId, selectedLeft, selectedRight, fotosProyecto } = asociarModal;
                if (!selectedLeft || selectedRight === null) return;
                const foto = fotosProyecto.find(f => f.id === selectedLeft);
                if (!foto) return;
                setDatos(prev => {
                  const prevFotos = prev.fotos || {};
                  return {
                    ...prev,
                    fotos: {
                      ...prevFotos,
                      [tabId]: {
                        ...(prevFotos[tabId] || {}),
                        [selectedRight]: { url: foto.url, thumb: foto.thumb || foto.url, timestamp: new Date().toISOString() }
                      }
                    }
                  };
                });
                // Eliminar foto de Cámara Proyecto en Firestore y del estado
                try {
                  await deleteDoc(doc(db, 'proyectos', proyectoActual?.id, 'fotosProyecto', selectedLeft));
                } catch (err) {
                  console.error('Error eliminando foto de proyecto:', err);
                }
                setAsociarModal(prev => prev ? {
                  ...prev,
                  fotosProyecto: prev.fotosProyecto.filter(f => f.id !== selectedLeft),
                  selectedLeft: null,
                  selectedRight: null,
                } : null);
              }}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform"
            >
              ACEPTAR — MOVER FOTO AL SLOT
            </button>
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex justify-between items-center px-4 py-4 bg-black/80 backdrop-blur-md border-b border-white/10">
            <div>
              {/* Intentar buscar el label bonito, si no usar el ID */}
              <h3 className="font-bold text-white text-lg">
                {(() => {
                  // Buscar en items recursivo
                  const config = TABS_CONFIG[viewingPhoto.section];
                  let label = viewingPhoto.item;
                  if (config) {
                    for (const it of config.items) {
                      if (it.id === viewingPhoto.item) return it.label.replace('\n', ' ');
                      if (it.items) {
                        const sub = it.items.find(s => s.id === viewingPhoto.item);
                        if (sub) return sub.label;
                      }
                    }
                  }
                  return label;
                })()}
              </h3>
              <p className="text-gray-400 text-xs uppercase">{TABS_CONFIG[viewingPhoto.section]?.title || viewingPhoto.section}</p>
            </div>
            <button onClick={() => setViewingPhoto(null)} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 bg-black">
            <img src={viewingPhoto.url} className="max-w-full max-h-full object-contain shadow-2xl" alt="Detalle" />
          </div>
          <div className="p-6 bg-black border-t border-white/10 flex gap-4 justify-center" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
            <button
              onClick={(e) => triggerCamera(e, viewingPhoto.section, viewingPhoto.item)}
              className="flex-1 bg-white text-black py-4 px-6 rounded-xl font-black flex justify-center items-center gap-2 active:scale-95 transition-transform"
            >
              <RefreshCw size={20} /> RETOMAR
            </button>
            <button
              onClick={handleDelete}
              className="flex-none bg-red-600 text-white py-4 px-6 rounded-xl font-bold flex justify-center items-center active:scale-95 transition-transform"
            >
              <Trash2 size={24} />
            </button>
          </div>
        </div>
      )}

      {/* TOASTS: fotos alta calidad listas para guardar */}
      {hrToasts.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[1500] flex flex-col gap-2 px-4" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          {hrToasts.map(toast => (
            <div key={toast.id} className="bg-slate-900 rounded-2xl flex items-center gap-3 px-4 py-3 shadow-2xl border border-white/10">
              <span className="text-xl shrink-0">📷</span>
              <p className="text-white text-xs font-bold flex-1 leading-snug">Foto lista en alta calidad</p>
              <button
                onClick={() => guardarHrToast(toast)}
                className="bg-orange-500 text-white text-xs font-black px-3 py-2 rounded-xl active:scale-95 transition-transform shrink-0"
              >Guardar</button>
              <button
                onClick={() => setHrToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-white/50 shrink-0 p-1"
              ><X size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {/* OVERLAY iOS: guardar foto alta calidad */}
      {iosShareFallbackUrl && (
        <div className="fixed inset-0 z-[2000] bg-black flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="px-4 py-3 flex items-center justify-between shrink-0">
            <p className="text-white text-xs font-bold leading-snug">Mantén pulsada la imagen para guardar en Fotos</p>
            <button
              onClick={() => { URL.revokeObjectURL(iosShareFallbackUrl); setIosShareFallbackUrl(null); }}
              className="text-white text-sm font-bold bg-white/20 rounded-lg px-3 py-1.5"
            >Cerrar</button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={iosShareFallbackUrl} alt="Foto" className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}

      {/* MODAL: Compartir */}
      {compartirModal && (
        <>
        <input ref={logoModalInputRef} type="file" accept="image/*" className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            e.target.value = '';
            setLogoModalCargando(true);
            setSinLogoAdvertencia(false);
            const objUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = async () => {
              const maxDim = 500;
              const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
              const canvas = document.createElement('canvas');
              canvas.width = Math.round(img.width * scale);
              canvas.height = Math.round(img.height * scale);
              canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
              URL.revokeObjectURL(objUrl);
              const b64 = canvas.toDataURL('image/png');
              setLogoModalBase64(b64);
              try {
                const { ref: sRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
                const { storage } = await import('../firebaseConfig');
                const { updateDoc, doc: fDoc } = await import('firebase/firestore');
                const { db: fDb } = await import('../firebaseConfig');
                const storageRef = sRef(storage, `logos_proyectos/${proyectoActual?.id}/${Date.now()}_logo`);
                await uploadBytes(storageRef, file);
                const urlDescarga = await getDownloadURL(storageRef);
                await updateDoc(fDoc(fDb, 'proyectos', proyectoActual?.id), { logoEmpresa: urlDescarga });
              } catch (err) { console.error('Error guardando logo:', err); }
              setLogoModalCargando(false);
            };
            img.onerror = () => { URL.revokeObjectURL(objUrl); setLogoModalCargando(false); };
            img.src = objUrl;
          }} />
        <div className="fixed inset-0 z-[1100] bg-black/60 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-4 py-3">
              <p className="text-white font-black text-sm uppercase tracking-widest text-center">Compartir Fotos</p>
              <p className="text-slate-400 text-[10px] text-center mt-0.5">{TABS_CONFIG[compartirModal.sectionId]?.title}</p>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {compartiendo ? (
                <div className="flex flex-col items-center py-4 gap-2">
                  <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span className="text-slate-600 text-xs font-bold">Procesando...</span>
                </div>
              ) : compartirModal.step === 'elegir' ? (
                <>
                  <button onClick={() => { setCompartirModal(m => ({ ...m, step: 'config' })); cargarLogoModal(); setSinLogoAdvertencia(false); }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform">
                    CON SELLO
                  </button>
                  <button onClick={() => ejecutarCompartir(false, null)}
                    className="w-full py-3 bg-white border-2 border-slate-900 text-slate-900 rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform">
                    SIN SELLO
                  </button>
                  <button onClick={() => setCompartirModal(null)}
                    className="w-full py-2 text-slate-900 font-bold text-sm">
                    Cancelar
                  </button>
                </>
              ) : sinLogoAdvertencia ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start">
                    <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
                    <p className="text-amber-700 text-xs font-bold leading-snug">No hay logo cargado. Las fotos se compartirán sin logo en el sello.</p>
                  </div>
                  <button onClick={() => { setSinLogoAdvertencia(false); logoModalInputRef.current?.click(); }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform">
                    Subir logo
                  </button>
                  <button onClick={() => { setSinLogoAdvertencia(false); ejecutarCompartir(true, stampConfigCompartir); }}
                    className="w-full py-3 bg-white border-2 border-slate-900 text-slate-900 rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform">
                    Continuar sin logo
                  </button>
                  <button onClick={() => setSinLogoAdvertencia(false)}
                    className="w-full py-2 text-slate-900 font-bold text-sm">
                    ← Atrás
                  </button>
                </>
              ) : (
                /* config: configuración del sello */
                <>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest text-center">Configurar Sello</p>

                  {/* Simulador de sello */}
                  {(() => {
                    const f = stampConfigCompartir.fondoSello || 'white';
                    const bg = f === 'black' ? 'rgba(0,0,0,0.80)' : f === 'glass' ? 'rgba(50,50,50,0.45)' : 'rgba(255,255,255,0.92)';
                    const c1 = f === 'white' ? '#000' : f === 'black' ? '#FCBF26' : '#fff';
                    const c2 = f === 'white' ? '#000' : '#fff';
                    const dv = f === 'white' ? '#cbd5e1' : f === 'glass' ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.30)';
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 text-center">Vista previa del sello</p>
                        <div className="relative rounded overflow-hidden border border-slate-300 bg-slate-300" style={{ height: '72px' }}>
                          <div className={`absolute top-1 ${stampConfigCompartir.logoPosition === 'left' ? 'left-1' : 'right-1'} bg-white/80 border border-slate-400 rounded px-1.5 py-0.5 text-[7px] font-black text-slate-600`}>LOGO</div>
                          <div className="absolute bottom-0 left-0 right-0 flex items-center border-t border-slate-400" style={{ height: '38%', backgroundColor: bg }}>
                            <div className="flex flex-col justify-center overflow-hidden shrink-0" style={{ width: '25%', padding: '1px 3px 1px 4px', gap: '1px' }}>
                              <span className="font-black truncate leading-none" style={{ fontSize: '6px', color: c1 }}>PROYECTO</span>
                              <span className="font-black truncate leading-none" style={{ fontSize: '6px', color: c1 }}>
                                {stampConfigCompartir.mostrarNroPoste && '001'}{stampConfigCompartir.mostrarNroPoste && stampConfigCompartir.mostrarCodFat && ' | '}{stampConfigCompartir.mostrarCodFat && 'M25'}{!stampConfigCompartir.mostrarNroPoste && !stampConfigCompartir.mostrarCodFat && '—'}
                              </span>
                            </div>
                            <div className="self-stretch shrink-0" style={{ width: '1px', margin: '2px 0', backgroundColor: dv }} />
                            <div className="flex flex-col justify-center items-center overflow-hidden shrink-0" style={{ width: '40%', padding: '1px 3px', gap: '1px' }}>
                              <span className="truncate leading-none" style={{ fontSize: '6px', color: c2 }}>15/01/2025 · 09:30</span>
                              <span className="truncate leading-none" style={{ fontSize: '6px', color: c2 }}>-12.345, -76.987</span>
                            </div>
                            <div className="self-stretch shrink-0" style={{ width: '1px', margin: '2px 0', backgroundColor: dv }} />
                            <div className="flex flex-col justify-center overflow-hidden flex-1" style={{ padding: '1px 4px 1px 3px', gap: '1px' }}>
                              <span className="truncate leading-none" style={{ fontSize: '6px', color: c2, textAlign: 'right' }}>Av. Principal 123</span>
                              <span className="truncate leading-none" style={{ fontSize: '6px', color: c2, textAlign: 'right' }}>Arequipa, Perú</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Logo: preview + estado */}
                  <div className="bg-slate-50 rounded-xl px-3 py-2 flex flex-col gap-2">
                    {logoModalBase64 && (
                      <div className="flex justify-center">
                        <img src={logoModalBase64} alt="Logo" className="h-10 object-contain rounded" />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {logoModalCargando
                          ? <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                          : <span className={`text-xs font-black ${logoModalBase64 ? 'text-green-500' : 'text-slate-400'}`}>{logoModalBase64 ? '✓' : '✕'}</span>
                        }
                        <span className="text-[10px] text-slate-600 font-bold">
                          {logoModalCargando ? 'Cargando logo...' : logoModalBase64 ? 'Logo cargado' : 'Sin logo'}
                        </span>
                      </div>
                      <button onClick={() => logoModalInputRef.current?.click()}
                        className="text-[10px] text-orange-500 font-bold underline">
                        {logoModalBase64 ? 'Cambiar' : 'Subir logo'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Posición del logo en la parte superior</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['left','right'].map(pos => (
                        <button key={pos} onClick={() => updateStampConfig(c => ({ ...c, logoPosition: pos }))}
                          className={`py-2 rounded-lg text-xs font-black uppercase border-2 transition-all ${stampConfigCompartir.logoPosition === pos ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>
                          {pos === 'left' ? 'Izquierda' : 'Derecha'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Identificadores</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[['mostrarNroPoste','Item'],['mostrarCodFat','Pasivo']].map(([key, label]) => (
                        <button key={key} onClick={() => updateStampConfig(c => ({ ...c, [key]: !c[key] }))}
                          className={`py-2 rounded-lg text-xs font-black uppercase border-2 transition-all ${stampConfigCompartir[key] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Fondo del sello</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[['glass','Vidrio'],['white','Blanco'],['black','Negro']].map(([val, label]) => (
                        <button key={val} onClick={() => updateStampConfig(c => ({ ...c, fondoSello: val }))}
                          className={`py-2 rounded-lg text-xs font-black uppercase border-2 transition-all ${stampConfigCompartir.fondoSello === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-center font-black text-slate-900 text-xs uppercase tracking-widest mt-1">Compartir</p>
                  <div className="flex gap-2">
                    <button onClick={() => { if (!logoModalBase64) { setSinLogoAdvertencia(true); } else { ejecutarCompartir(true, stampConfigCompartir); } }}
                      className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform">
                      FOTOS
                    </button>
                    <button onClick={() => { compartirLista(compartirModal.sectionId); setCompartirModal(null); }}
                      className="flex-1 py-3 bg-white border-2 border-slate-900 text-slate-900 rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform">
                      LISTA
                    </button>
                  </div>
                  <button onClick={() => setCompartirModal(m => ({ ...m, step: 'elegir' }))}
                    className="w-full py-2 text-slate-900 font-bold text-sm">
                    ← Atrás
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}