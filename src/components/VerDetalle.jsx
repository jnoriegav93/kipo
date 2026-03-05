import { useState, useRef } from 'react';
import { ArrowLeft, Edit3, Camera, X, Send, Share2 } from 'lucide-react';
import { addDoc, collection, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TABS_CONFIG, EXTRAS_ITEMS } from './PhotoManager';
import { estamparMetadatos, urlABase64 } from '../utils/helpers';

// Componente fuera de VerDetalle para evitar remounts
function FotoMini({ url, label, onClickPhoto }) {
  const [error, setError] = useState(false);
  // url puede ser string o { url, thumb, timestamp } según cómo se guardó
  const displayUrl = url && typeof url === 'object' ? (url.thumb || url.url) : url;
  const fullUrl = url && typeof url === 'object' ? (url.url || url.thumb) : url;
  const showImage = displayUrl && !error;

  return (
    <div
      onClick={() => showImage && onClickPhoto({ url: fullUrl, label })}
      className={`relative aspect-square rounded-lg overflow-hidden bg-slate-200 border-2 border-slate-300 ${showImage ? 'cursor-pointer hover:opacity-90' : ''}`}
    >
      {showImage ? (
        <>
          <img src={displayUrl} alt={label} className="w-full h-full object-cover" onError={() => setError(true)} />
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
            <p className="text-white text-[8px] font-bold text-center truncate uppercase leading-tight">{label.replace('\n', ' ')}</p>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-1">
          <Camera size={14} className="text-slate-400 mb-1" />
          <p className="text-slate-500 text-[9px] font-bold text-center uppercase leading-tight">{label.replace('\n', ' ')}</p>
        </div>
      )}
    </div>
  );
}

export default function VerDetalle({
  datos,
  config,
  theme,
  onVolver,
  onEditar,
  onEditarFotos,
  readOnly = false,
  esSupervision = false,
  proyectoId,
  user,
  logoApp,
  proyectoActual,
}) {

  // Función para consolidar ferretería
  const consolidarFerreteria = () => {
    const consolidado = {};

    // 1. Sumar ferretería de armados
    (datos.armadosSeleccionados || []).forEach(armado => {
      armado.items.forEach(item => {
        const ferr = config.catalogoFerreteria.find(f => f.id === item.idRef);
        if (ferr) {
          const key = ferr.nombre;
          if (!consolidado[key]) {
            consolidado[key] = { cantidad: 0, unidad: ferr.unidad, nombre: ferr.nombre };
          }
          consolidado[key].cantidad += item.cant;
        }
      });
    });

    // 2. Sumar/Restar ferretería extra (incluye positivos Y negativos)
    Object.entries(datos.ferreteriaExtra || {}).forEach(([id, cantidad]) => {
      const ferr = config.catalogoFerreteria.find(f => f.id === id);
      if (ferr && cantidad !== 0) {  // ← Cambio: ahora incluye negativos
        const key = ferr.nombre;
        if (!consolidado[key]) {
          consolidado[key] = { cantidad: 0, unidad: ferr.unidad, nombre: ferr.nombre };
        }
        consolidado[key].cantidad += cantidad;  // ← Suma positivos, resta negativos
      }
    });

    return Object.values(consolidado);
  };

  const totalConsolidado = consolidarFerreteria();

  // Estado para ver foto en pantalla completa
  const [fullscreenPhoto, setFullscreenPhoto] = useState(null);

  // Estado para observaciones del supervisor
  const [observacion, setObservacion] = useState('');
  const [enviandoObs, setEnviandoObs] = useState(false);

  // compartirModal: null | { tabId, tabTitle, step: 'elegir'|'config' }
  const [compartirModal, setCompartirModal] = useState(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [stampConfigCompartir, setStampConfigCompartir] = useState(() => {
    try { const s = localStorage.getItem('kipo_stamp_config'); if (s) return JSON.parse(s); } catch {}
    return { logoPosition: 'right', mostrarNroPoste: true, mostrarCodFat: false, fondoSello: 'white' };
  });
  const [logoModalBase64, setLogoModalBase64] = useState(null);
  const [logoModalCargando, setLogoModalCargando] = useState(false);
  const [sinLogoAdvertencia, setSinLogoAdvertencia] = useState(false);
  const logoModalInputRef = useRef(null);
  const prefetchVDRef = useRef(null);

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
      // 3. Firestore usuarios
      if (user?.email) {
        const snap = await getDoc(doc(db, 'usuarios', user.email));
        const data = snap.data();
        if (data?.logoEmpresaBase64) { setLogoModalBase64(data.logoEmpresaBase64); return; }
        if (data?.logoEmpresa) {
          const b64 = await urlABase64(data.logoEmpresa);
          if (b64) { setLogoModalBase64(b64); return; }
        }
      }
      // 4. logoApp como URL
      if (logoApp) {
        const b64 = await urlABase64(logoApp);
        if (b64) { setLogoModalBase64(b64); return; }
      }
    } catch (e) { console.error('[MODAL] ❌ Error:', e); }
    finally { setLogoModalCargando(false); }
  };

  const buildFotoItemsVD = (tabId) => {
    const tab = TABS_CONFIG[tabId];
    const fotosTab = getFotos(tabId);
    const items = [];
    if (tab.dynamic) {
      Object.entries(fotosTab)
        .filter(([, v]) => { const u = typeof v === 'string' ? v : v?.url; return !!u; })
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .forEach(([idx, fotoRaw]) => {
          const url = typeof fotoRaw === 'string' ? fotoRaw : fotoRaw?.url;
          if (url) items.push({ url, label: `FOTO ${parseInt(idx) + 1}` });
        });
    } else {
      tab.items.forEach(item => {
        if (item.items) {
          item.items.forEach(sub => {
            const fotoRaw = fotosTab[sub.id];
            const url = typeof fotoRaw === 'string' ? fotoRaw : fotoRaw?.url;
            if (url) items.push({ url, label: sub.label.replace('\n', ' ') });
          });
        } else {
          const fotoRaw = fotosTab[item.id];
          const url = typeof fotoRaw === 'string' ? fotoRaw : fotoRaw?.url;
          if (url) items.push({ url, label: item.label.replace('\n', ' ') });
        }
      });
      EXTRAS_ITEMS.forEach(label => {
        const fotoRaw = fotosTab[label];
        const url = typeof fotoRaw === 'string' ? fotoRaw : fotoRaw?.url;
        if (url) items.push({ url, label });
      });
    }
    return items;
  };

  const iniciarCompartir = (tabId, tabTitle) => {
    const fotoItems = buildFotoItemsVD(tabId);
    if (fotoItems.length === 0) { alert('No hay fotos para compartir'); return; }
    if (!navigator.share || !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      alert('Función de compartir no disponible en este dispositivo'); return;
    }
    prefetchVDRef.current = Promise.all(fotoItems.map(({ url }) => fetch(url).then(r => r.blob()).catch(() => null)));
    setCompartirModal({ tabId, tabTitle, step: 'elegir' });
  };

  const ejecutarCompartir = async (conSello, stampCfg) => {
    const { tabId, tabTitle } = compartirModal;
    setCompartiendo(true);
    try {
      const fotoItems = buildFotoItemsVD(tabId);
      if (fotoItems.length === 0) return;

      const blobs = await (prefetchVDRef.current || Promise.all(fotoItems.map(({ url }) => fetch(url).then(r => r.blob()).catch(() => null))));

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
        `FOTOS DE ${tabTitle}`,
        nroPoste ? `ITEM: *${nroPoste}*` : null,
        pasivoVal ? `COD E. PASIVO: *${pasivoVal}*` : null,
      ].filter(Boolean).join('\n');
      const listText = '*LISTA DE FOTOS:*\n' + fotoItems.map(f => `• ${f.label}`).join('\n');

      const { modo = 'fotos' } = compartirModal;
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
      prefetchVDRef.current = null;
    }
  };

  const compartirListaVD = async (tabId, tabTitle) => {
    const fotoItems = buildFotoItemsVD(tabId);
    if (fotoItems.length === 0) { alert('No hay fotos para compartir'); return; }
    if (!navigator.share || !/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      alert('Función de compartir no disponible en este dispositivo'); return;
    }
    const nroPoste = datos?.numero || '';
    const pasivoVal = datos?.pasivo || '';
    const headerText = [
      `FOTOS DE ${tabTitle}`,
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

  const enviarObservacion = async () => {
    if (!observacion.trim() || enviandoObs || !proyectoId || !user) return;
    setEnviandoObs(true);
    try {
      const fat = datos?.codFat || '-';
      const pt = datos?.numero || '-';
      const nombreAutor = config?.nombrePersonal || user.displayName || user.email?.split('@')[0] || 'Supervisor';
      const empresaAutor = config?.empresaPersonal || '';

      await addDoc(collection(db, "bitacora"), {
        proyectoId,
        mensaje: observacion.trim(),
        autorUid: user.uid,
        autorNombre: nombreAutor,
        autorEmpresa: empresaAutor,
        autorEmail: user.email,
        timestamp: new Date().toISOString(),
        tipo: 'observacion',
        codFat: fat,
        nroPt: pt
      });
      setObservacion('');
    } catch (error) {
      console.error("Error enviando observación:", error);
    } finally {
      setEnviandoObs(false);
    }
  };

  // Función para obtener fotos de una sección
  const getFotos = (seccion) => {
    return datos.fotos?.[seccion] || {};
  };

  return (
    <div className={`fixed inset-0 z-[200] ${theme.bg} flex flex-col`}>

      {/* HEADER */}
      <div className={`${theme.header} border-b-2 ${theme.border} px-4 flex justify-between items-center shadow-lg shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
        <button onClick={onVolver} className="flex items-center gap-2">
          <ArrowLeft size={24} className={theme.text} strokeWidth={2.5} />
          <span className={`font-black ${theme.text} text-sm uppercase`}>Volver</span>
        </button>
        <h2 className={`font-black ${theme.text} text-xl uppercase`}>VER DETALLE</h2>
        <div className="w-20"></div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3" style={{ paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>

        {/* INFO DEL POSTE */}
        <div className={`${theme.card} border-2 ${theme.border} rounded-xl p-3 mb-3`}>
          <h3 className={`text-xs font-black ${theme.text} uppercase mb-2 opacity-70`}>Info del Poste</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {/* Fila 1: ITEM y Pasivo — valores en fuente normal */}
            <div><span className={`font-bold ${theme.text} opacity-60`}>ITEM:</span> <span className={`font-black ${theme.text}`}>{datos.numero || '-'}</span></div>
            <div><span className={`font-bold ${theme.text} opacity-60`}>Pasivo:</span> <span className={`font-black ${theme.text}`}>{datos.pasivo || '-'}</span></div>

            {/* Fila 2: Fecha y Coor — todo pequeño */}
            <div className="min-w-0 flex items-baseline gap-1"><span className={`font-bold ${theme.text} opacity-60 shrink-0 text-[10px]`}>Fecha:</span> <span className={`font-black ${theme.text} text-[10px] truncate`}>{datos.fecha ? `${new Date(datos.fecha).toLocaleDateString('es-PE')}${datos.hora ? ` - ${datos.hora}` : ''}` : '-'}</span></div>
            <div className="min-w-0 flex items-baseline gap-1"><span className={`font-bold ${theme.text} opacity-60 shrink-0 text-[10px]`}>Coor:</span> <span className={`font-black ${theme.text} text-[10px] truncate`}>{datos.coords ? `${datos.coords.lat.toFixed(6)}, ${datos.coords.lng.toFixed(6)}` : '-'}</span></div>

            {/* Fila 3: Dir y Ubic — todo pequeño */}
            <div className="min-w-0 flex items-baseline gap-1"><span className={`font-bold ${theme.text} opacity-60 shrink-0 text-[10px]`}>Dir:</span> <span className={`font-black ${theme.text} text-[10px] truncate`}>{datos.direccion || '-'}</span></div>
            <div className="min-w-0 flex items-baseline gap-1"><span className={`font-bold ${theme.text} opacity-60 shrink-0 text-[10px]`}>Ubic:</span> <span className={`font-black ${theme.text} text-[10px] truncate`}>{datos.ubicacion || '-'}</span></div>
          </div>
        </div>

        {/* CARACTERÍSTICAS DEL POSTE */}
        <div className={`${theme.card} border-2 ${theme.border} rounded-xl p-3 mb-3`}>
          <div className="flex justify-between items-center mb-2">
            <h3 className={`text-xs font-black ${theme.text} uppercase opacity-70`}>Características del Poste</h3>
            {!readOnly && (
              <button onClick={onEditar} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold active:scale-95">
                <Edit3 size={12} /> EDITAR
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><span className={`font-bold ${theme.text} opacity-60`}>Altura:</span> <span className={`font-black ${theme.text}`}>{datos.altura ? `${datos.altura} m` : '-'}</span></div>
            <div><span className={`font-bold ${theme.text} opacity-60`}>Fuerza:</span> <span className={`font-black ${theme.text}`}>{datos.fuerza || '-'}</span></div>

            <div><span className={`font-bold ${theme.text} opacity-60`}>Material:</span> <span className={`font-black ${theme.text}`}>{datos.material || '-'}</span></div>
            <div><span className={`font-bold ${theme.text} opacity-60`}>Tipo Red:</span> <span className={`font-black ${theme.text}`}>{datos.tipo || '-'}</span></div>

            <div><span className={`font-bold ${theme.text} opacity-60`}>Cables:</span> <span className={`font-black ${theme.text}`}>{datos.cables || '-'}</span></div>
            <div><span className={`font-bold ${theme.text} opacity-60`}>Armado:</span> <span className={`font-black ${theme.text}`}>{datos.armadosSeleccionados?.map(a => a.nombre).join(', ') || '-'}</span></div>

            <div className="col-span-2"><span className={`font-bold ${theme.text} opacity-60`}>Extras:</span> <span className={`font-black ${theme.text}`}>{datos.extrasSeleccionados?.join(', ') || '-'}</span></div>
          </div>
        </div>

        {/* FERRETERÍA DE ARMADOS */}
        {datos.armadosSeleccionados && datos.armadosSeleccionados.length > 0 && (
          <details className={`${theme.card} border-2 ${theme.border} rounded-xl overflow-hidden mb-3`}>
            <summary className="px-3 py-2 cursor-pointer font-black text-xs uppercase opacity-70 hover:bg-slate-50 select-none">
              Ferretería {datos.armadosSeleccionados.map(a => a.nombre).join(', ')}
            </summary>
            <div className="px-3 pb-2 pt-1 bg-slate-50/50 space-y-0 divide-y divide-slate-200">
              {datos.armadosSeleccionados.flatMap(armado =>
                armado.items.map((item, idx) => {
                  const ferr = config.catalogoFerreteria.find(f => f.id === item.idRef);
                  return (
                    <div key={`${armado.id}-${idx}`} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                      <span className="font-black text-sm text-blue-600 w-8 text-right">{item.cant}</span>
                      <span className="font-bold text-[10px] opacity-60 uppercase w-10">{ferr?.unidad}</span>
                      <div className="h-3 w-px bg-slate-300"></div>
                      <span className="font-bold text-xs flex-1">{ferr?.nombre || 'Desconocido'}</span>
                    </div>
                  );
                })
              )}
            </div>
          </details>
        )}

        {/* FERRETERÍA EXTRA */}
        {datos.ferreteriaExtra && Object.keys(datos.ferreteriaExtra).length > 0 && (
          <details className={`${theme.card} border-2 ${theme.border} rounded-xl overflow-hidden mb-3`}>
            <summary className="px-3 py-2 cursor-pointer font-black text-xs uppercase opacity-70 hover:bg-slate-50 select-none">
              Ferretería Extra
            </summary>
            <div className="px-3 pb-2 pt-1 bg-slate-50/50 space-y-0 divide-y divide-slate-200">
              {Object.entries(datos.ferreteriaExtra).map(([id, cantidad]) => {
                const ferr = config.catalogoFerreteria.find(f => f.id === id);
                if (!ferr || cantidad === 0) return null;
                return (
                  <div key={id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                    <span className="font-black text-sm text-blue-600 w-8 text-right">{cantidad}</span>
                    <span className="font-bold text-[10px] opacity-60 uppercase w-10">{ferr.unidad}</span>
                    <div className="h-3 w-px bg-slate-300"></div>
                    <span className="font-bold text-xs flex-1">{ferr.nombre}</span>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* CONSOLIDADO FERRETERÍAS */}
        {totalConsolidado.length > 0 && (
          <div className="bg-green-50 border-2 border-green-600 rounded-xl p-3 mb-3">
            <h3 className="text-xs font-black text-green-700 uppercase mb-2">Consolidado Ferreterías</h3>
            <div className="space-y-0 divide-y divide-green-300">
              {totalConsolidado.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                  <span className="font-black text-sm text-green-700 w-8 text-right">{item.cantidad}</span>
                  <span className="font-bold text-[10px] text-green-600 uppercase w-10">{item.unidad}</span>
                  <div className="h-3 w-px bg-green-400"></div>
                  <span className="font-bold text-xs text-green-900 flex-1">{item.nombre}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FOTOS - DINÁMICAS */}
        {/* HELPER PARA ORDENAR SECCIONES y RENDERIZADO */}
        {(() => {
          const SECTION_ORDER = [
            'poste',
            'fatPrecoNueva',
            'fatPrecoExistente',
            'napMec',
            'mufaTroncal',
            'mufaFdt',
            'xbox',
            'hbox',
            'adicionales'
          ];

          // Filtrar y ordenar tabs según config
          let orderedTabs = SECTION_ORDER
            .map(id => Object.values(TABS_CONFIG).find(tab => tab.id === id))
            .filter(Boolean);

          // LÓGICA DE ORDENAMIENTO (FEATURE REQUEST):
          // 1. Las secciones con al menos 1 foto van PRIMERO.
          // 2. Se respeta el orden relativo de SECTION_ORDER dentro de cada grupo.
          orderedTabs = orderedTabs.sort((a, b) => {
            const fotosA = getFotos(a.id);
            const fotosB = getFotos(b.id);

            // Función auxiliar para saber si tiene fotos
            const hasFotos = (tabId, fotos) => {
              const tabConfig = TABS_CONFIG[tabId];
              if (tabConfig.dynamic) {
                return Object.keys(fotos).filter(k => fotos[k]).length > 0;
              }
              // Principales
              let principales = 0;
              tabConfig.items.forEach(item => {
                if (item.items) {
                  item.items.forEach(sub => { if (fotos[sub.id]) principales++; });
                } else {
                  if (fotos[item.id]) principales++;
                }
              });
              // Extras
              const extras = EXTRAS_ITEMS.filter(label => fotos[label]).length;
              return (principales + extras) > 0;
            };

            const aHas = hasFotos(a.id, fotosA);
            const bHas = hasFotos(b.id, fotosB);

            if (aHas && !bHas) return -1; // a va antes
            if (!aHas && bHas) return 1;  // b va antes
            return 0; // mantener orden relativo original (SECTION_ORDER)
          });

          return (
            <>
              {orderedTabs.length > 0 && (
                <div className="flex items-center gap-2 mb-3 mt-4">
                  <div className="h-0.5 flex-1 bg-slate-300"></div>
                  <h3 className={`text-sm font-black ${theme.text} uppercase tracking-widest`}>FOTOS</h3>
                  <div className="h-0.5 flex-1 bg-slate-300"></div>
                </div>
              )}

              {orderedTabs.map(tab => {
                const fotosTab = getFotos(tab.id);

                // --- TAB DINÁMICO (ADICIONALES) ---
                if (tab.dynamic) {
                  const fotosEntries = Object.entries(fotosTab)
                    .filter(([, v]) => v)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b));
                  const count = fotosEntries.length;
                  const hasPhotos = count > 0;
                  const headerBgClass = hasPhotos ? 'bg-slate-700 text-white' : 'bg-slate-50/50 hover:bg-slate-100 text-slate-800';
                  const headerTextClass = hasPhotos ? 'text-white' : theme.text;

                  return (
                    <details key={tab.id} className={`${theme.card} border-2 ${theme.border} rounded-xl mb-3 overflow-hidden group`}>
                      <summary className={`px-3 py-3 flex justify-between items-center cursor-pointer transition-colors select-none ${headerBgClass}`}>
                        <span className={`text-xs font-black uppercase ${headerTextClass}`}>{tab.title}</span>
                        <span className={`text-xs font-black opacity-90 ${headerTextClass}`}>({count} fotos)</span>
                      </summary>
                      <div className="p-3 border-t-2 border-slate-100 bg-white">
                        <div className="flex justify-between items-center mb-2">
                          <p className={`text-[10px] font-bold ${theme.text} opacity-60`}>FOTOS</p>
                          <div className="flex gap-2">
                            {!readOnly && proyectoActual?.modoFotos !== 'altaCalidad' && (
                              <button onClick={() => iniciarCompartir(tab.id, tab.title)} className="flex items-center gap-1 bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-bold active:scale-95">
                                <Share2 size={12} /> COMPARTIR
                              </button>
                            )}
                            {!readOnly && (
                              <button onClick={() => onEditarFotos(tab.id)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold active:scale-95">
                                <Edit3 size={12} /> EDITAR
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          {fotosEntries.map(([idx, fotoRaw]) => (
                            <div key={idx} className="w-[31%] flex justify-center">
                              <div className="w-full">
                                <FotoMini
                                  url={typeof fotoRaw === 'string' ? fotoRaw : (fotoRaw?.url || fotoRaw?.thumb)}
                                  label={`FOTO ${parseInt(idx) + 1}`}
                                  onClickPhoto={setFullscreenPhoto}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  );
                }

                // --- TAB ESTÁNDAR ---
                const extrasCount = EXTRAS_ITEMS.filter(label => fotosTab[label]).length;

                // Calcular totales
                let totalPrincipales = 0;
                let filledPrincipales = 0;
                tab.items.forEach(item => {
                  if (item.items) {
                    totalPrincipales += item.items.length;
                    item.items.forEach(sub => { if (fotosTab[sub.id]) filledPrincipales++; });
                  } else {
                    totalPrincipales++;
                    if (fotosTab[item.id]) filledPrincipales++;
                  }
                });

                const hasPhotos = filledPrincipales > 0 || extrasCount > 0;
                const headerBgClass = hasPhotos ? 'bg-slate-700 text-white' : 'bg-slate-50/50 hover:bg-slate-100 text-slate-800';
                const headerTextClass = hasPhotos ? 'text-white' : theme.text;

                // Agrupar items (misma lógica que PhotoManager)
                const groups = [];
                let currentNormalGroup = [];
                tab.items.forEach(item => {
                  if (item.items) {
                    if (currentNormalGroup.length > 0) {
                      groups.push({ type: 'normal', items: [...currentNormalGroup] });
                      currentNormalGroup = [];
                    }
                    groups.push({ type: 'section', data: item });
                  } else {
                    currentNormalGroup.push(item);
                  }
                });
                if (currentNormalGroup.length > 0) groups.push({ type: 'normal', items: currentNormalGroup });

                return (
                  <details key={tab.id} className={`${theme.card} border-2 ${theme.border} rounded-xl mb-3 overflow-hidden group`}>
                    <summary className={`px-3 py-3 flex justify-between items-center cursor-pointer transition-colors select-none ${headerBgClass}`}>
                      <span className={`text-xs font-black uppercase ${headerTextClass}`}>{tab.title}</span>
                      <span className={`text-xs font-black opacity-90 ${headerTextClass}`}>({filledPrincipales}/{totalPrincipales})</span>
                    </summary>

                    <div className="p-3 border-t-2 border-slate-100 bg-white">
                      <div className="flex justify-between items-center mb-2">
                        <p className={`text-[10px] font-bold ${theme.text} opacity-60`}>PRINCIPALES</p>
                        <div className="flex gap-2">
                          {!readOnly && proyectoActual?.modoFotos !== 'altaCalidad' && (
                            <button onClick={() => iniciarCompartir(tab.id, tab.title)} className="flex items-center gap-1 bg-slate-700 text-white px-3 py-1 rounded-lg text-xs font-bold active:scale-95">
                              <Share2 size={12} /> COMPARTIR
                            </button>
                          )}
                          {!readOnly && (
                            <button onClick={() => onEditarFotos(tab.id)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold active:scale-95">
                              <Edit3 size={12} /> EDITAR
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 mb-3">
                        {groups.map((group, gIdx) => {
                          if (group.type === 'normal') {
                            return (
                              <div key={gIdx} className="flex flex-wrap justify-center gap-2">
                                {group.items.map(item => {
                                  let widthClass = 'w-[31%]';
                                  if (item.fullWidth) widthClass = 'w-full';

                                  return (
                                    <div key={item.id} className={`${widthClass} flex justify-center`}>
                                      <div className="w-full">
                                        <FotoMini
                                          url={fotosTab[item.id]}
                                          label={item.label}
                                          onClickPhoto={setFullscreenPhoto}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } else {
                            // Subsección
                            return (
                              <div key={gIdx} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <h4 className={`text-[9px] font-black ${theme.text} uppercase tracking-widest mb-2 text-center opacity-70`}>
                                  {group.data.title}
                                </h4>
                                <div className="flex flex-wrap justify-center gap-2">
                                  {group.data.items.map(subItem => (
                                    <div key={subItem.id} className="w-[31%] flex justify-center">
                                      <div className="w-full">
                                        <FotoMini
                                          url={fotosTab[subItem.id]}
                                          label={subItem.label}
                                          onClickPhoto={setFullscreenPhoto}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>

                      <details className="mt-3 border-t border-slate-200 pt-2">
                        <summary className={`text-[10px] font-bold ${theme.text} opacity-60 cursor-pointer hover:opacity-100 select-none py-1`}>
                          EXTRAS ({extrasCount} fotos)
                        </summary>
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                          {EXTRAS_ITEMS.map((label, i) => (
                            <div key={i} className="w-[31%] flex justify-center">
                              <div className="w-full">
                                <FotoMini key={i} url={fotosTab[label]} label={label} onClickPhoto={setFullscreenPhoto} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </details>
                );
              })}
            </>
          );
        })()}

        {/* OBSERVACIONES DEL SUPERVISOR */}
        {esSupervision && (
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-3">
            <h3 className="text-xs font-black text-amber-700 uppercase mb-2">Observación del Supervisor</h3>
            <p className={`text-[10px] text-amber-600 font-bold mb-2`}>
              Se enviará a la bitácora con referencia: COD FAT: {datos?.codFat || '-'} | NRO PT: {datos?.numero || '-'}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarObservacion()}
                placeholder="Escribe una observación..."
                disabled={enviandoObs}
                className="flex-1 px-3 py-2.5 rounded-lg border-2 border-amber-300 bg-white text-sm font-bold text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={enviarObservacion}
                disabled={!observacion.trim() || enviandoObs}
                className="bg-amber-500 text-white p-2.5 rounded-lg active:scale-95 transition-transform disabled:opacity-50 disabled:bg-slate-400 shadow-md"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

      </div>

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
                const { updateDoc } = await import('firebase/firestore');
                const storageRef = sRef(storage, `logos_proyectos/${proyectoId}/${Date.now()}_logo`);
                await uploadBytes(storageRef, file);
                const urlDescarga = await getDownloadURL(storageRef);
                await updateDoc(doc(db, 'proyectos', proyectoId), { logoEmpresa: urlDescarga });
              } catch (err) { console.error('Error guardando logo:', err); }
              setLogoModalCargando(false);
            };
            img.onerror = () => { URL.revokeObjectURL(objUrl); setLogoModalCargando(false); };
            img.src = objUrl;
          }} />
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-end justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-slate-900 px-4 py-3">
              <p className="text-white font-black text-sm uppercase tracking-widest text-center">Compartir Fotos</p>
              <p className="text-slate-400 text-[10px] text-center mt-0.5">{compartirModal.tabTitle}</p>
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
                    <button onClick={() => { compartirListaVD(compartirModal.tabId, compartirModal.tabTitle); setCompartirModal(m => m ? { ...m, step: 'config' } : null); }}
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

      {/* MODAL FULLSCREEN FOTO */}
      {
        fullscreenPhoto && (
          <div className="fixed inset-0 z-[999] bg-black flex flex-col" onClick={() => setFullscreenPhoto(null)}>
            <div className="flex justify-between items-center px-4 pb-4 bg-black/80 backdrop-blur-md border-b border-white/10" style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
              <div>
                <h3 className="font-bold text-white text-base">{fullscreenPhoto.label.replace('\n', ' ')}</h3>
              </div>
              <button onClick={() => setFullscreenPhoto(null)} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 bg-black">
              <img src={fullscreenPhoto.url} className="max-w-full max-h-full object-contain" alt={fullscreenPhoto.label} />
            </div>
          </div>
        )
      }
    </div >
  );
}