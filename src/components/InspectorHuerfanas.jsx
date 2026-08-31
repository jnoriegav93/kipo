import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { auditarFotosHuerfanas } from '../services/exportacionService';
import { zipSync } from 'fflate';
import { saveAs } from 'file-saver';
import { Search, Download, Loader2, ImageOff, RefreshCw } from 'lucide-react';

const fmtBytes = (b) => {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
};
const fmtFecha = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

export default function InspectorHuerfanas({ isDark }) {
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState('');
  const [cargandoProy, setCargandoProy] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [zipping, setZipping] = useState(false);
  const [zipMsg, setZipMsg] = useState('');
  const [dims, setDims] = useState({}); // path -> { w, h }

  useEffect(() => {
    setCargandoProy(true);
    getDocs(collection(db, 'proyectos'))
      .then(snap => setProyectos(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
      ))
      .catch(() => setError('No se pudieron cargar los proyectos.'))
      .finally(() => setCargandoProy(false));
  }, []);

  const analizar = async () => {
    if (!proyectoId) return;
    setAnalizando(true); setError(''); setRes(null); setZipMsg(''); setDims({});
    try {
      const data = await auditarFotosHuerfanas(proyectoId);
      setRes(data);
    } catch (e) {
      setError(e.message || 'Error al analizar.');
    } finally { setAnalizando(false); }
  };

  const descargarZip = async () => {
    if (!res?.huerfanas?.length) return;
    setZipping(true); setZipMsg(''); setError('');
    try {
      const files = {};
      let i = 0, fallidas = 0;
      for (const h of res.huerfanas) {
        try {
          if (!h.url) { fallidas++; continue; }
          const resp = await fetch(h.url);
          if (!resp.ok) { fallidas++; continue; }
          const buf = new Uint8Array(await resp.arrayBuffer());
          files[`${String(++i).padStart(4, '0')}_${h.nombre}`] = [buf, { level: 0 }];
        } catch { fallidas++; }
      }
      if (Object.keys(files).length === 0) {
        setError('No se pudo descargar ninguna foto (posible bloqueo CORS/red).');
        return;
      }
      const zipped = zipSync(files);
      const proy = proyectos.find(p => p.id === proyectoId);
      saveAs(new Blob([zipped], { type: 'application/zip' }), `FOTOS HUERFANAS - ${proy?.nombre || proyectoId}.zip`);
      setZipMsg(fallidas ? `ZIP listo. ${fallidas} foto(s) no se pudieron incluir.` : `ZIP listo con ${i} foto(s).`);
    } catch (e) {
      setError('Error armando el ZIP: ' + (e.message || ''));
    } finally { setZipping(false); }
  };

  const card = isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const sub = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCl = isDark ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-50 text-slate-900 border-slate-300';

  return (
    <div className={`mb-4 rounded-2xl border-2 p-3 ${card}`}>
      <div className="flex items-center gap-2 mb-2">
        <Search size={14} strokeWidth={2.5} className={sub} />
        <p className={`text-[10px] font-black uppercase tracking-widest ${sub}`}>Inspector de fotos huérfanas</p>
      </div>
      <p className={`text-[10px] mb-3 ${sub}`}>
        Fotos que están en el servidor pero que ningún punto reclama. Solo lectura, no borra nada.
      </p>

      {/* Selector de proyecto */}
      <div className="flex gap-2 mb-2">
        <select
          value={proyectoId}
          onChange={e => setProyectoId(e.target.value)}
          disabled={cargandoProy || analizando}
          className={`flex-1 min-w-0 px-3 py-2 rounded-xl border-2 text-xs font-bold outline-none ${inputCl}`}
        >
          <option value="">{cargandoProy ? 'Cargando proyectos…' : 'Elegí un proyecto…'}</option>
          {proyectos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre || p.id}{p.ownerEmpresa ? ` · ${p.ownerEmpresa}` : ''}</option>
          ))}
        </select>
        <button
          onClick={analizar}
          disabled={!proyectoId || analizando}
          className="shrink-0 flex items-center gap-1.5 bg-orange-500 text-white px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide active:scale-95 transition-all disabled:opacity-40"
        >
          {analizando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {analizando ? 'Analizando…' : 'Analizar'}
        </button>
      </div>

      {error && <p className="text-[11px] text-red-500 font-bold mb-2">{error}</p>}

      {/* Resultados */}
      {res && (
        <div className="mt-2">
          <div className={`flex flex-wrap gap-x-4 gap-y-1 text-[11px] mb-2 ${sub}`}>
            <span>Archivos: <b className={isDark ? 'text-white' : 'text-slate-900'}>{res.totalArchivos}</b></span>
            <span>Reclamadas: <b className={isDark ? 'text-white' : 'text-slate-900'}>{res.totalReferenciados}</b></span>
            <span>Huérfanas: <b className="text-orange-500">{res.totalHuerfanas}</b></span>
            <span>Espacio: <b className="text-orange-500">{fmtBytes(res.bytesHuerfanas)}</b></span>
          </div>
          {(() => {
            const vals = Object.values(dims);
            if (!vals.length) return null;
            const mini = vals.filter(d => Math.max(d.w, d.h) <= 300).length;
            const full = vals.length - mini;
            return (
              <div className={`text-[11px] mb-3 ${sub}`}>
                Analizadas {vals.length}/{res.totalHuerfanas}:{' '}
                <b className="text-red-500">{mini} miniaturas (≤300px)</b> ·{' '}
                <b className="text-green-500">{full} tamaño normal</b>
              </div>
            );
          })()}

          {res.totalHuerfanas > 0 && (
            <button
              onClick={descargarZip}
              disabled={zipping}
              className="w-full mb-3 flex items-center justify-center gap-2 bg-slate-900 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
            >
              {zipping ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {zipping ? 'Armando ZIP…' : `Descargar todas (${res.totalHuerfanas}) en ZIP`}
            </button>
          )}
          {zipMsg && <p className="text-[11px] text-green-500 font-bold mb-2">{zipMsg}</p>}

          {res.totalHuerfanas === 0 ? (
            <p className={`text-xs text-center py-4 ${sub}`}>✅ No hay fotos huérfanas en este proyecto.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {res.huerfanas.map((h) => (
                <a
                  key={h.path}
                  href={h.url || undefined}
                  target="_blank"
                  rel="noreferrer"
                  className={`block rounded-lg overflow-hidden border-2 ${isDark ? 'border-slate-700' : 'border-slate-200'} hover:border-orange-500 transition-colors`}
                  title={`${h.nombre}\n${fmtBytes(h.size)} · ${fmtFecha(h.updated)}`}
                >
                  <div className="aspect-square bg-slate-200 flex items-center justify-center">
                    {h.url
                      ? <img src={h.url} alt={h.nombre} loading="lazy" className="w-full h-full object-cover"
                          onLoad={(e) => { const w = e.target.naturalWidth, hh = e.target.naturalHeight; setDims(prev => prev[h.path] ? prev : { ...prev, [h.path]: { w, h: hh } }); }}
                          onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.noimg').style.display = 'flex'; }} />
                      : null}
                    <div className="noimg w-full h-full items-center justify-center text-slate-400" style={{ display: h.url ? 'none' : 'flex' }}><ImageOff size={20} /></div>
                  </div>
                  <div className={`px-1.5 py-1 text-[8px] leading-tight ${isDark ? 'bg-slate-900 text-slate-400' : 'bg-slate-50 text-slate-500'}`}>
                    <div className="font-bold truncate">
                      {fmtBytes(h.size)}
                      {dims[h.path] && <span className={Math.max(dims[h.path].w, dims[h.path].h) <= 300 ? 'text-red-500' : 'text-green-500'}> · {dims[h.path].w}×{dims[h.path].h}</span>}
                    </div>
                    <div className="truncate">{fmtFecha(h.updated)}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
