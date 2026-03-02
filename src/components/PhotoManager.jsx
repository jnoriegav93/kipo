import React, { useRef, useState, useEffect } from 'react';
import { Camera, Trash2, X, RefreshCw, ArrowLeft, Maximize2, Share2, Plus } from 'lucide-react';
import { uploadImage } from '../utils/storage';
import { estamparMetadatos, urlABase64 } from '../utils/helpers';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
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
      { id: 'cajaPiso', label: 'CAJA EN PISO', help: 'Debe apreciarse la caja en una superficie segura con la carcasa abierta' },
      { id: 'fusiones', label: 'FUSIONES', help: 'Debe apreciarse la FUSIÓN de FO, fijación, orden y curvatura de las fibras' },
      { id: 'bandejasAseguradas', label: 'BANDEJAS\nASEGURADAS', help: 'Debe apreciarse las bandejas de FO aseguradas con cinta Velcro' },
      { id: 'cablesAsegurados', label: 'CABLES OPTICOS\nASEGURADOS', help: 'Verifique que los cables estén asegurados de manera confiable.' },
      { id: 'cierreCarcasa', label: 'CIERRE DE LA\nCARCASA', help: 'Debe apreciarse el cierre de la carcasa en poste.' },
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
      { id: 'cierreCarcasa', label: 'CIERRE DE LA\nCARCASA', help: 'Debe apreciarse el cierre de la carcasa en poste.' },
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
      { id: 'codigoSerie', label: 'CODIGO SERIE', centered: true }
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
      { id: 'cierreCarcasa', label: 'CIERRE DE LA\nCARCASA', help: 'La junta de la carcasa es plana' },
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
      { id: 'cierreCarcasa', label: 'CIERRE DE LA\nCARCASA', help: 'La junta de la carcasa es plana' },
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
  }
};

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

export default function PhotoManager({ onClose, datos, setDatos, proyectoActual, puntoTemporal, initialTab = 'napMec', puntoId, logoApp }) {
  const fotosActuales = datos?.fotos || {}; // Inicializar vacío seguro
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [regenerandoThumbs, setRegenerandoThumbs] = useState(new Set());
  // compartirModal: null | { sectionId, step: 'elegir'|'config' }
  const [compartirModal, setCompartirModal] = useState(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [stampConfigCompartir, setStampConfigCompartir] = useState(() => {
    try { const s = localStorage.getItem('kipo_stamp_config'); if (s) return JSON.parse(s); } catch {}
    return DEFAULT_STAMP_CONFIG;
  });
  const [logoModalBase64, setLogoModalBase64] = useState(null);
  const [logoModalCargando, setLogoModalCargando] = useState(false);
  const [sinLogoAdvertencia, setSinLogoAdvertencia] = useState(false);
  const logoModalInputRef = useRef(null);
  const prefetchRef = useRef(null);

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

  // Pestaña activa - inicializar con initialTab
  const [activeTab, setActiveTab] = useState(initialTab);

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
          const direccion = `${road} ${house}`.trim() || 'Ingresa la dirección';

          const city = data.address.city || data.address.town || data.address.village || data.address.municipality || '';
          const state = data.address.state || data.address.region || '';
          const ubicacion = [city, state].filter(Boolean).join(', ') || '';

          setDatos(prev => ({ ...prev, direccion, ubicacion }));
        } else {
          setDatos(prev => ({ ...prev, direccion: 'Ingresa la dirección' }));
        }
      } catch (error) {
        // En caso de error (ej: CORS en localhost), mostrar mensaje
        setDatos(prev => ({ ...prev, direccion: 'Ingresa la dirección' }));
      }
    };

    obtenerDireccion();
  }, [coords.lat, coords.lng]);

  const triggerCamera = (e, section, item) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (fileInputRef.current) fileInputRef.current.value = '';
    activeCaptureRef.current = { section, item };
    fileInputRef.current.click();
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

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();

      img.onerror = () => {
        const ext = (file.name || '').toLowerCase().split('.').pop();
        const isHeic = ext === 'heic' || ext === 'heif' || (file.type || '').includes('heic') || (file.type || '').includes('heif');
        if (isHeic) {
          alert('Formato HEIC (iPhone) no compatible con el navegador.\n\nEn tu iPhone: Configuración → Cámara → Formatos → Mayor Compatibilidad para capturar en JPEG.');
        } else {
          alert('No se pudo cargar la imagen. Intenta con otro formato (JPEG o PNG).');
        }
      };

      img.onload = () => {
        // --- Thumbnail pequeño (max 256px, JPEG 0.6) → se guarda en Firestore ---
        const MAX_T = 256;
        const scaleT = Math.min(MAX_T / img.width, MAX_T / img.height, 1);
        const wt = Math.floor(img.width * scaleT);
        const ht = Math.floor(img.height * scaleT);
        const canvasThumb = document.createElement('canvas');
        canvasThumb.width = wt; canvasThumb.height = ht;
        canvasThumb.getContext('2d').drawImage(img, 0, 0, wt, ht);
        const thumbUrl = canvasThumb.toDataURL('image/jpeg', 0.6);

        // --- Full comprimida (max 1280px, ~300KB) → se sube a Firebase Storage ---
        const MAX_F = 1280;
        const scaleF = Math.min(MAX_F / img.width, MAX_F / img.height, 1);
        const wf = Math.floor(img.width * scaleF);
        const hf = Math.floor(img.height * scaleF);
        const canvasFull = document.createElement('canvas');
        canvasFull.width = wf; canvasFull.height = hf;
        canvasFull.getContext('2d').drawImage(img, 0, 0, wf, hf);

        // Mostrar thumb inmediatamente con estado "subiendo"
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

        // Subir a Firebase en segundo plano
        canvasFull.toBlob(async (blob) => {
          if (!blob) {
            setDatos(prev => {
              const prevFotos = { ...(prev.fotos || {}) };
              if (prevFotos[section]) {
                const sec = { ...prevFotos[section] };
                delete sec[item];
                prevFotos[section] = sec;
              }
              return { ...prev, fotos: prevFotos };
            });
            alert('Error al procesar la imagen.');
            return;
          }
          try {
            const path = `proyectos/${proyectoActual?.id || 'temp'}/fotos_detalle/${section}_${item}_${Date.now()}.jpg`;
            const downloadUrl = await uploadImage(blob, path);
            setDatos(prev => {
              const prevFotos = prev.fotos || {};
              return {
                ...prev,
                fotos: {
                  ...prevFotos,
                  [section]: {
                    ...(prevFotos[section] || {}),
                    [item]: { url: downloadUrl, thumb: thumbUrl, timestamp: new Date().toISOString() }
                  }
                }
              };
            });
          } catch (err) {
            console.error('Error subiendo foto:', err);
            setDatos(prev => {
              const prevFotos = { ...(prev.fotos || {}) };
              if (prevFotos[section]) {
                const sec = { ...prevFotos[section] };
                delete sec[item];
                prevFotos[section] = sec;
              }
              return { ...prev, fotos: prevFotos };
            });
            alert('Error al subir la foto. Verifique su conexión.');
          }
        }, 'image/jpeg', 0.75);
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
    setCompartirModal({ sectionId, step: 'elegir' });
  };

  const ejecutarCompartir = async (conSello, stampCfg) => {
    const { sectionId } = compartirModal;
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
      const listText = '*LISTA DE FOTOS:*\n' + fotoItems.map(f => `• ${f.label}`).join('\n') + '\n⬇️⬇️⬇️';

      await navigator.share({ files, text: `${headerText}\n${listText}` });
    } catch (error) {
      if (error.name !== 'AbortError') console.log('Error compartiendo:', error);
    } finally {
      setCompartiendo(false);
      setCompartirModal(null);
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
      return { text: `(${taken})`, color: taken > 0 ? 'text-green-600' : 'text-slate-400' };
    }

    // Aplanar items para contar
    let allItems = [];
    cfg.items.forEach(item => {
      if (item.items) {
        item.items.forEach(sub => allItems.push(sub.id));
      } else {
        allItems.push(item.id);
      }
    });

    const taken = allItems.filter(id => sectionPhotos[id]).length;
    const total = allItems.length;
    const isComplete = taken === total;
    const isEmpty = taken === 0;

    return {
      text: `(${taken}/${total})`,
      color: isEmpty ? 'text-red-600' : (isComplete ? 'text-green-600' : 'text-orange-600')
    };
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-100">

      {/* HEADER */}
      <div className="bg-slate-900 px-4 flex items-center justify-between shadow-md shrink-0 pt-safe-header" style={{ paddingBottom: '12px' }}>
        <button onClick={onClose} className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors active:scale-95">
          <div className="bg-white/10 p-1.5 rounded-full">
            <ArrowLeft className="w-5 h-5" strokeWidth={3} />
          </div>
          <span className="block font-black text-xs uppercase tracking-widest">Volver</span>
        </button>
        <div className="flex flex-col items-end">
          <span className="text-white font-black uppercase tracking-wider text-sm">CÁMARA</span>
          <span className="text-[9px] text-orange-500 font-bold">REGISTRO</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

        {/* PESTAÑAS - 3 FILAS DE 3 */}
        <div className="bg-white border-b-2 border-slate-900 flex flex-col">
          {[
            ['poste', 'mufaTroncal', 'mufaFdt'],
            ['fatPrecoExistente', 'fatPrecoNueva', 'napMec'],
            ['xbox', 'hbox', 'adicionales']
          ].map((row, rowIdx) => (
            <div key={rowIdx} className={`flex ${rowIdx < 2 ? 'border-b border-slate-200' : ''}`}>
              {row.map((tabId) => {
                const tab = TABS_CONFIG[tabId];
                if (!tab) return null;
                const counter = getCounter(tab.id);
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-1 px-1 border-r last:border-r-0 border-slate-200 transition-all ${isActive ? 'bg-slate-900' : 'bg-white hover:bg-slate-50'}`}
                  >
                    <div className="p-1">
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
          ))}
        </div>

        {/* CONTENIDO (Grid de fotos) */}
        <div className="p-3 flex-1 overflow-y-auto">
          {/* Separador */}
          <div className="flex items-center gap-2 mb-3">
            <span className="font-black text-slate-900 text-sm uppercase tracking-widest border-b-2 border-slate-900 pb-1">
              FOTOS: {TABS_CONFIG[activeTab]?.title}
            </span>
            <div className="flex-1 h-px bg-slate-300"></div>
          </div>

          <button onClick={() => compartirFotos(activeTab)} className="w-full mb-4 flex items-center justify-center gap-2 bg-slate-900 text-white py-2 rounded-lg font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-md">
            <Share2 size={16} />
            COMPARTIR FOTOS
          </button>

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

                  TABS_CONFIG[activeTab].items.forEach(item => {
                    if (item.items) {
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
                    if (group.type === 'grid') {
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

      {/* VISUALIZADOR */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[1000] bg-black flex flex-col">
          <div className="flex justify-between items-center p-4 bg-black/80 backdrop-blur-md border-b border-white/10">
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
          <div className="p-6 bg-black border-t border-white/10 flex gap-4 justify-center pb-10">
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

                  <button onClick={() => { if (!logoModalBase64) { setSinLogoAdvertencia(true); } else { ejecutarCompartir(true, stampConfigCompartir); } }}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-wide active:scale-95 transition-transform mt-1">
                    COMPARTIR
                  </button>
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