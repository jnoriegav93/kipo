import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Plus, X, Camera, Maximize2, Loader2, Trash2 } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { uploadImage, deleteImage } from '../utils/storage';
import { procesarImagenInput } from '../utils/helpers';

const FotosProyecto = ({ proyectoId, proyectoNombre, modoFotos, theme, user, onClose, onCountChange }) => {
  const [fotos, setFotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [fotoVistaCompleta, setFotoVistaCompleta] = useState(null); // { url, nombre }

  // Dialog para ingresar nombre de foto
  const [pendingFile, setPendingFile] = useState(null);
  const [nombreInput, setNombreInput] = useState('');
  const [showNombreDialog, setShowNombreDialog] = useState(false);

  const fileInputRef = useRef(null);
  const nombreInputRef = useRef(null);

  useEffect(() => {
    if (!proyectoId) return;
    cargarFotos();
  }, [proyectoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foco automático en el input de nombre
  useEffect(() => {
    if (showNombreDialog) {
      setTimeout(() => nombreInputRef.current?.focus(), 100);
    }
  }, [showNombreDialog]);

  const cargarFotos = async () => {
    setCargando(true);
    try {
      const col = collection(db, 'proyectos', proyectoId, 'fotosProyecto');
      const q = query(col, orderBy('creadoEn', 'asc'));
      const snap = await getDocs(q);
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFotos(lista);
      onCountChange?.(lista.length);
    } catch (err) {
      console.error('Error cargando fotos del proyecto:', err);
    } finally {
      setCargando(false);
    }
  };

  const handleFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setPendingFile(file);
    setNombreInput('');
    setShowNombreDialog(true);
  };

  const handleGuardarFoto = async () => {
    if (!pendingFile || !nombreInput.trim()) return;
    const nombre = nombreInput.trim();
    setShowNombreDialog(false);
    setSubiendo(true);

    // Preview instantánea mientras procesa
    const previewUrl = URL.createObjectURL(pendingFile);
    const tempId = `tmp_${Date.now()}`;
    setFotos(prev => {
      const actualizado = [...prev, { id: tempId, nombre, url: previewUrl, thumb: previewUrl, _uploading: true }];
      onCountChange?.(actualizado.length);
      return actualizado;
    });

    try {
      const altaCalidad = modoFotos === 'altaCalidad';
      const ts = Date.now();
      const storagePath = `proyectos/${proyectoId}/fotos/${ts}_${user?.uid || 'anon'}.jpg`;

      let url, urlHD, thumbBase64;

      if (altaCalidad) {
        // 1. Subir original → urlHD
        urlHD = await uploadImage(pendingFile, storagePath);

        // 2. Comprimir a 1080px + generar thumb
        const { fullBlob, thumbBase64: tb } = await procesarImagenInput(pendingFile);
        thumbBase64 = tb;
        const storagePathC = `proyectos/${proyectoId}/fotos/${ts}_${user?.uid || 'anon'}_c.jpg`;
        url = await uploadImage(fullBlob, storagePathC);
      } else {
        // Comprimido: 1080px + thumb
        const { fullBlob, thumbBase64: tb } = await procesarImagenInput(pendingFile);
        thumbBase64 = tb;
        url = await uploadImage(fullBlob, storagePath);
      }

      URL.revokeObjectURL(previewUrl);

      const docData = {
        nombre,
        url,
        ...(urlHD ? { urlHD } : {}),
        thumb: thumbBase64,
        storagePath,
        creadoEn: serverTimestamp(),
        uid: user?.uid || null,
      };

      const col = collection(db, 'proyectos', proyectoId, 'fotosProyecto');
      const docRef = await addDoc(col, docData);
      const nueva = { id: docRef.id, ...docData };

      setFotos(prev => {
        const actualizado = prev.map(f => f.id === tempId ? nueva : f);
        onCountChange?.(actualizado.length);
        return actualizado;
      });
    } catch (err) {
      console.error('Error subiendo foto:', err);
      URL.revokeObjectURL(previewUrl);
      setFotos(prev => {
        const actualizado = prev.filter(f => f.id !== tempId);
        onCountChange?.(actualizado.length);
        return actualizado;
      });
      alert('Error al subir la foto. Verifica tu conexión.');
    } finally {
      setSubiendo(false);
      setPendingFile(null);
    }
  };

  const handleEliminar = async (foto, e) => {
    e.stopPropagation();
    try {
      await deleteImage(foto.storagePath || foto.url);
      await deleteDoc(doc(db, 'proyectos', proyectoId, 'fotosProyecto', foto.id));
      setFotos(prev => {
        const actualizado = prev.filter(f => f.id !== foto.id);
        onCountChange?.(actualizado.length);
        return actualizado;
      });
    } catch (err) {
      console.error('Error eliminando foto:', err);
    }
  };

  return (
    <>
      {/* Overlay principal */}
      <div className={`fixed inset-0 z-[300] ${theme.card} flex flex-col`}>

        {/* Header */}
        <div className={`${theme.header} px-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className={`${theme.text} p-2 rounded-lg active:scale-95 transition-transform`}>
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            <div className="bg-white border-2 border-slate-900 p-2 rounded-lg">
              <Camera size={20} className="text-slate-900" />
            </div>
            <div>
              <h3 className={`font-black text-lg ${theme.text} uppercase leading-tight`}>Fotos del Proyecto</h3>
              <p className={`text-xs font-medium opacity-60 ${theme.text}`}>{proyectoNombre}</p>
            </div>
          </div>
        </div>

        {/* Input de archivo — solo cámara */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {cargando ? (
            <div className="flex items-center justify-center h-40 gap-2 opacity-50">
              <Loader2 size={20} className="animate-spin" />
              <span className={`text-sm font-medium ${theme.text}`}>Cargando fotos...</span>
            </div>
          ) : (() => {
            const fotosDirectas = fotos.filter(f => !f.sectionId);
            const fotosMigradas = fotos.filter(f => !!f.sectionId);
            const FotoCard = ({ foto, mostrarEliminar = true }) => {
              const thumb = foto.thumb || foto.url;
              const isUploading = foto._uploading === true;
              return (
                <div
                  key={foto.id}
                  className="relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-black border-2 border-black active:scale-95 transition-transform"
                  onClick={() => !isUploading && setFotoVistaCompleta(foto)}
                >
                  <img src={thumb} alt={foto.nombre} className={`w-full h-full object-cover ${isUploading ? 'opacity-60' : ''}`} />
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 size={28} className="animate-spin text-white" />
                    </div>
                  )}
                  {!isUploading && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-1 px-2">
                      <p className="text-white text-[10px] font-black text-center uppercase tracking-wider leading-tight line-clamp-2">{foto.nombre}</p>
                    </div>
                  )}
                  {!isUploading && <div className="absolute top-1 right-1 bg-black/50 rounded-full p-1"><Maximize2 size={10} className="text-white" /></div>}
                  {!isUploading && mostrarEliminar && (
                    <button onClick={(e) => handleEliminar(foto, e)} className="absolute top-1 left-1 bg-red-600/80 rounded-full p-1 active:scale-110">
                      <Trash2 size={10} className="text-white" />
                    </button>
                  )}
                </div>
              );
            };
            return (
              <>
                {/* Sección 1: fotos del proyecto (directas) */}
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-2 opacity-50 ${theme.text}`}>Fotos del proyecto</p>
                  <div className="grid grid-cols-2 gap-2">
                    {fotosDirectas.map(foto => <FotoCard key={foto.id} foto={foto} mostrarEliminar />)}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl overflow-hidden cursor-pointer bg-white border-2 border-dashed border-slate-900 hover:bg-slate-50 active:scale-95 transition-transform flex items-center justify-center"
                    >
                      <Plus className="w-12 h-12 text-slate-900" strokeWidth={2} />
                    </div>
                  </div>
                </div>

                {/* Sección 2: fotos guardadas de puntos no completados */}
                {fotosMigradas.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className={`text-[10px] font-black uppercase tracking-widest opacity-50 ${theme.text}`}>Guardadas de puntos incompletos</p>
                      <span className="bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{fotosMigradas.length}</span>
                    </div>
                    <p className={`text-[10px] mb-2 opacity-50 ${theme.text}`}>Fotos recuperadas de puntos que no se guardaron. Asócialas desde el mapa.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {fotosMigradas.map(foto => <FotoCard key={foto.id} foto={foto} mostrarEliminar />)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Dialog: ingresar nombre */}
      {showNombreDialog && (
        <div className="fixed inset-0 z-[400] bg-black/70 flex items-center justify-center p-6">
          <div className={`${theme.card} border-2 ${theme.border} rounded-2xl p-5 w-full max-w-sm shadow-2xl`}>
            <h3 className={`font-black text-base uppercase ${theme.text} mb-1`}>Nombre de la foto</h3>
            <p className={`text-xs opacity-60 ${theme.text} mb-4`}>Ingresa un nombre para identificar esta foto</p>
            <input
              ref={nombreInputRef}
              type="text"
              value={nombreInput}
              onChange={e => setNombreInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && nombreInput.trim()) handleGuardarFoto(); }}
              placeholder="Ej: Fachada norte, Poste 12..."
              className={`w-full border-2 ${theme.border} ${theme.bg} ${theme.text} rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-slate-600 mb-4`}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNombreDialog(false); setPendingFile(null); }}
                className={`flex-1 py-3 rounded-xl border-2 ${theme.border} font-black text-sm uppercase active:scale-95 ${theme.text}`}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarFoto}
                disabled={!nombreInput.trim()}
                className={`flex-1 py-3 rounded-xl font-black text-sm uppercase active:scale-95 transition-all ${nombreInput.trim() ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-400'}`}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vista completa de foto */}
      {fotoVistaCompleta && (
        <div
          className="fixed inset-0 z-[500] bg-black flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={() => setFotoVistaCompleta(null)}
        >
          <div className="flex items-center justify-between px-4 py-4">
            <p className="text-white font-black text-sm uppercase">{fotoVistaCompleta.nombre}</p>
            <button className="text-white p-2">
              <X size={22} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-2">
            <img
              src={fotoVistaCompleta.url}
              alt={fotoVistaCompleta.nombre}
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default FotosProyecto;
