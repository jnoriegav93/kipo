import React from 'react';
import { ArrowLeft, Trash2, RotateCcw, MapPin, Cable, Image as ImageIcon, Folder, ClipboardList, Loader2, Download, X } from 'lucide-react';
import { suscribirsePapelera, suscribirsePapeleraProyecto, diasRestantes, restaurarPunto, restaurarFibra, restaurarFoto, restaurarLista, restaurarProyecto, contarFotos } from '../utils/papelera';

const ICONO = { punto: MapPin, fibra: Cable, foto: ImageIcon, proyecto: Folder, lista: ClipboardList };
const NOMBRE_TIPO = { punto: 'Puntos', fibra: 'Fibras', foto: 'Fotos', proyecto: 'Proyectos', lista: 'Listas' };
const ORDEN = ['proyecto', 'punto', 'fibra', 'foto', 'lista'];

const srcDeFoto = (f) => {
  if (!f) return null;
  if (typeof f === 'string') return f;
  return f.url || f.thumb || null;
};

// Nombre limpio (sin sufijos "(reemplazada)" acumulados de entradas antiguas)
const nombreLimpio = (it) => (it.nombre || it.idOriginal || '').replace(/\s*\(reemplazada\)/g, '');

// Modos:
//  - proyectoId: papelera DEL PROYECTO (todo lo borrado por cualquier usuario, sin proyectos)
//  - soloProyectos: papelera del MENÚ (solo PROYECTOS eliminados del usuario)
//  - default (legacy): todo lo del usuario
export default function VistaPapelera({ theme, isDark, onVolver, user, puntos, proyectos = [], setAlertData, proyectoId = null, soloProyectos = false }) {
  const [items, setItems] = React.useState(null); // null = cargando
  const [restaurandoId, setRestaurandoId] = React.useState(null);
  const [conflictoFoto, setConflictoFoto] = React.useState(null); // { entrada, fotoActual }
  const [sinDestino, setSinDestino] = React.useState(null);       // { entrada, motivo } → ofrecer descargar
  const [verFoto, setVerFoto] = React.useState(null);             // entrada → visor grande
  const [descargando, setDescargando] = React.useState(false);

  React.useEffect(() => {
    const ordenar = (lista) => [...lista].sort((a, b) => (b.eliminadoEn || 0) - (a.eliminadoEn || 0));
    if (proyectoId) {
      const unsub = suscribirsePapeleraProyecto(proyectoId, (lista) => setItems(ordenar(lista)));
      return unsub;
    }
    if (!user?.uid) { setItems([]); return; }
    const unsub = suscribirsePapelera(user.uid, (lista) => {
      setItems(ordenar(soloProyectos ? lista.filter(e => e.tipo === 'proyecto' || e.meta?.grupo) : lista));
    });
    return unsub;
  }, [user?.uid, proyectoId, soloProyectos]);

  // Nombre del proyecto: primero el guardado en la entrada; si no, resolver por id (si aún existe)
  const nombreProyecto = (it) => it.proyectoNombre || proyectos.find(p => p.id === it.proyectoId)?.nombre || '';

  // Descarga la foto full (la EXIF con GPS/fecha/proyecto va DENTRO del archivo)
  const descargarFoto = async (entrada) => {
    if (descargando) return;
    setDescargando(true);
    try {
      const src = srcDeFoto(entrada?.snapshot);
      if (!src) throw new Error('sin url');
      const res = await fetch(src);
      const blob = await res.blob();
      const { saveAs } = await import('file-saver');
      const nombreArchivo = `${(entrada.nombre || 'foto').replace(/[^\w.\- ()]+/g, '_')}.jpg`;
      saveAs(blob, nombreArchivo);
    } catch (e) {
      console.error('Descarga:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo descargar la foto.', theme });
    } finally {
      setDescargando(false);
    }
  };

  const restaurar = async (it) => {
    if (restaurandoId) return;
    setRestaurandoId(it.id);
    try {
      if (it.tipo === 'punto') {
        await restaurarPunto(it);
      } else if (it.tipo === 'fibra') {
        const r = await restaurarFibra(it, puntos || []);
        if (!r.ok) {
          const det = (r.faltantes || []).map(f => `• ${f.id} (${f.motivo === 'movido' ? 'se movió de lugar' : 'no existe'})`).join('\n');
          setAlertData?.({ title: 'No se puede restaurar la fibra', message: `La fibra solo se restaura si TODOS sus puntos existen en su ubicación original.\n\n${det}\n\nRestaura esos puntos primero.`, theme });
        }
      } else if (it.tipo === 'foto') {
        const r = await restaurarFoto(it);
        if (!r.ok && r.motivo === 'ocupado') setConflictoFoto({ entrada: it, fotoActual: r.fotoActual });
        else if (!r.ok) setSinDestino({ entrada: it, motivo: r.motivo }); // punto o proyecto ya no existen
      } else if (it.tipo === 'lista') {
        await restaurarLista(it);
      } else if (it.tipo === 'proyecto') {
        const r = await restaurarProyecto(it, user.uid);
        setAlertData?.({ title: 'Proyecto restaurado', message: `Volvieron el proyecto y ${r.hijos} elemento${r.hijos !== 1 ? 's' : ''} (puntos y fibras). Los colaboradores no se restauran.`, theme });
      }
    } catch (e) {
      console.error('Error restaurando:', e);
      setAlertData?.({ title: 'Error', message: 'No se pudo restaurar. Verifica tu conexión.', theme });
    } finally {
      setRestaurandoId(null);
    }
  };

  const resolverConflicto = async (elegirPapelera) => {
    const c = conflictoFoto;
    setConflictoFoto(null);
    if (!c || !elegirPapelera) return; // mantener la actual: no se toca nada
    setRestaurandoId(c.entrada.id);
    try { await restaurarFoto(c.entrada, { forzar: true }); }
    catch (e) { console.error(e); setAlertData?.({ title: 'Error', message: 'No se pudo restaurar la foto.', theme }); }
    finally { setRestaurandoId(null); }
  };

  // Los HIJOS de un proyecto borrado (meta.grupo) no se listan sueltos: vuelven todos
  // juntos al restaurar el proyecto. Así la lista no se llena con cientos de entradas.
  const visibles = React.useMemo(() => (items || []).filter(it => !it.meta?.grupo), [items]);
  const ocultosGrupo = (items || []).length - visibles.length;

  const grupos = React.useMemo(() => {
    const g = {};
    visibles.forEach(it => { (g[it.tipo] || (g[it.tipo] = [])).push(it); });
    return g;
  }, [visibles]);

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col ${theme.bg}`}>
      {/* Header */}
      <div className={`${theme.header} px-4 flex items-center gap-3 border-b-2 ${theme.border} shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
        <button onClick={onVolver} className={`p-2 rounded-xl border-2 ${theme.border} ${theme.text} active:scale-95`}><ArrowLeft size={22} /></button>
        <div className="flex items-center gap-2">
          <Trash2 size={22} className={theme.text} />
          <h3 className={`font-black ${theme.text} text-xl uppercase`}>{proyectoId ? 'Papelera del proyecto' : 'Papelera'}</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className={`text-[11px] ${theme.textSec} mb-3 text-center`}>
          {proyectoId
            ? <>Lo borrado <b>en este proyecto</b> (por cualquier usuario) se guarda <b>15 días</b> y luego se elimina solo. Puedes restaurarlo mientras tanto.</>
            : soloProyectos
              ? <>Los <b>proyectos eliminados</b> se guardan acá <b>15 días</b> y luego se eliminan solos. Puedes restaurarlos mientras tanto.</>
              : <>Lo borrado se guarda acá <b>15 días</b> y luego se elimina solo. Puedes restaurarlo mientras tanto.</>}
        </div>

        {items === null ? (
          <div className="flex justify-center py-10"><Loader2 size={26} className="animate-spin text-slate-400" /></div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-16">
            <Trash2 size={44} className="mx-auto mb-3 text-slate-300" />
            <p className={`text-sm font-bold ${theme.textSec}`}>La papelera está vacía.</p>
          </div>
        ) : (
          <>
            {ORDEN.filter(t => grupos[t]?.length).map(tipo => {
              const Icono = ICONO[tipo] || Trash2;
              return (
                <div key={tipo} className="mb-5">
                  <div className={`flex items-center gap-2 mb-2 ${theme.text}`}>
                    <Icono size={16} />
                    <span className="text-xs font-black uppercase tracking-wide">{NOMBRE_TIPO[tipo] || tipo}</span>
                    <span className={`text-[10px] ${theme.textSec}`}>({grupos[tipo].length})</span>
                  </div>
                  <div className="space-y-2">
                    {grupos[tipo].map(it => {
                      const dias = diasRestantes(it);
                      const miniatura = it.tipo === 'foto' ? srcDeFoto(it.snapshot) : null;
                      const proy = it.tipo !== 'proyecto' ? nombreProyecto(it) : '';
                      const Linea = ({ k, v }) => (
                        <p className={`text-[11px] truncate ${theme.text}`}>
                          <span className={`font-black uppercase text-[9px] tracking-wide ${theme.textSec}`}>{k}: </span>
                          <span className="font-bold">{v || '—'}</span>
                        </p>
                      );
                      // Cuerpo etiquetado según tipo (lectura fácil)
                      let cuerpo;
                      if (it.tipo === 'foto') {
                        // nombre guardado: "Pestaña – Campo (ITEM)" | fotos del mapa: meta.mapa
                        const nom = nombreLimpio(it);
                        let pestania = nom, campo = '';
                        const partes = nom.split(' – ');
                        if (partes.length >= 2) { pestania = partes[0]; campo = partes.slice(1).join(' – '); }
                        if (it.meta?.mapa) { pestania = 'Fotos del mapa'; campo = nom; }
                        cuerpo = (<>
                          <Linea k="Proyecto" v={proy} />
                          <Linea k="Foto" v={pestania} />
                          <Linea k="Campo" v={campo} />
                        </>);
                      } else if (it.tipo === 'punto') {
                        const d = it.snapshot?.datos || {};
                        const nf = contarFotos(d);
                        cuerpo = (<>
                          <Linea k="Proyecto" v={proy} />
                          <Linea k="Item" v={d.numero} />
                          <Linea k="Pasivo" v={d.pasivo || d.codFat} />
                          <Linea k="Fotos" v={String(nf)} />
                        </>);
                      } else if (it.tipo === 'proyecto') {
                        const m = it.meta || {};
                        const pts = m.puntos != null ? String(m.puntos) : (m.hijos ? `${m.hijos} elementos` : '—');
                        cuerpo = (<>
                          <Linea k="Proyecto" v={nombreLimpio(it)} />
                          <Linea k="Puntos" v={pts} />
                        </>);
                      } else {
                        cuerpo = (<>
                          <p className={`text-sm font-bold truncate ${theme.text}`}>{nombreLimpio(it)}</p>
                          {proy && <Linea k="Proyecto" v={proy} />}
                        </>);
                      }
                      return (
                        <div key={it.id} className={`${theme.card} border-2 ${theme.border} rounded-xl p-3 flex items-center gap-3`}>
                          {miniatura && (
                            <button onClick={() => setVerFoto(it)} className="shrink-0 active:scale-95">
                              <img src={miniatura} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-300" />
                            </button>
                          )}
                          <div className="flex-1 min-w-0">
                            {cuerpo}
                          </div>
                          <div className="shrink-0 flex flex-col items-center gap-1">
                            <button
                              onClick={() => restaurar(it)}
                              disabled={restaurandoId === it.id}
                              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-black border-2 active:scale-95 ${isDark ? 'border-green-500 text-green-400' : 'border-green-600 text-green-700'} disabled:opacity-50`}
                            >
                              {restaurandoId === it.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restaurar
                            </button>
                            <span className={`text-[9px] font-bold ${theme.textSec}`}>Vence en {dias} día{dias !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {ocultosGrupo > 0 && (
              <p className={`text-[10px] text-center ${theme.textSec}`}>+ {ocultosGrupo} elemento{ocultosGrupo !== 1 ? 's' : ''} de proyectos borrados (vuelven al restaurar su proyecto)</p>
            )}
          </>
        )}
      </div>

      {/* Visor de foto en grande (con descarga) */}
      {verFoto && (
        <div className="fixed inset-0 z-[400] flex flex-col bg-black/95" onClick={() => setVerFoto(null)}>
          <div className="flex items-center justify-between p-3 shrink-0" onClick={e => e.stopPropagation()}>
            <div className="min-w-0 pr-2">
              <p className="text-white text-sm font-bold truncate">{nombreLimpio(verFoto)}</p>
              {nombreProyecto(verFoto) && <p className="text-slate-400 text-[11px] truncate">{nombreProyecto(verFoto)}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => descargarFoto(verFoto)} disabled={descargando} className="p-2.5 rounded-xl bg-white/10 text-white border border-white/30 active:scale-95 disabled:opacity-50">
                {descargando ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
              </button>
              <button onClick={() => setVerFoto(null)} className="p-2.5 rounded-xl bg-white/10 text-white border border-white/30 active:scale-95"><X size={20} /></button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-2">
            <img src={srcDeFoto(verFoto.snapshot)} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          </div>
        </div>
      )}

      {/* La foto no tiene dónde volver (punto/proyecto borrado) → descargarla para no perderla */}
      {sinDestino && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/85 backdrop-blur-sm p-6" onClick={() => setSinDestino(null)}>
          <div className={`${theme.card} border-2 ${theme.border} w-full max-w-xs rounded-2xl p-5 text-center`} onClick={e => e.stopPropagation()}>
            <ImageIcon size={38} className="mx-auto mb-2 text-amber-500" />
            <h3 className={`font-black ${theme.text} text-base mb-1`}>No tiene dónde volver</h3>
            <p className={`text-xs ${theme.textSec} mb-4`}>
              {sinDestino.motivo === 'proyecto' ? 'El proyecto de esta foto ya no existe.' : 'El punto de esta foto ya no existe.'} Puedes restaurar {sinDestino.motivo === 'proyecto' ? 'el proyecto' : 'el punto'} primero, o <b>descargarla</b> para no perderla (la foto lleva adentro su GPS, fecha y proyecto).
            </p>
            <img src={srcDeFoto(sinDestino.entrada?.snapshot)} alt="" className="w-full h-40 object-cover rounded-xl border-2 border-slate-300 mb-3" />
            <div className="flex flex-col gap-2">
              <button onClick={() => descargarFoto(sinDestino.entrada)} disabled={descargando} className="w-full py-2.5 rounded-xl text-xs font-black bg-blue-600 text-white border-2 border-blue-800 active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50">
                {descargando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} DESCARGAR FOTO
              </button>
              <button onClick={() => setSinDestino(null)} className={`w-full py-2 rounded-xl text-[11px] font-bold ${theme.textSec} border ${theme.border}`}>CERRAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Conflicto: el casillero ya tiene otra foto → comparar y elegir */}
      {conflictoFoto && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={() => setConflictoFoto(null)}>
          <div className={`${theme.card} border-2 ${theme.border} w-full max-w-md rounded-2xl p-4`} onClick={e => e.stopPropagation()}>
            <h3 className={`font-black ${theme.text} text-base mb-1 text-center`}>Ya existe una foto en ese lugar</h3>
            <p className={`text-[11px] ${theme.textSec} mb-3 text-center`}>Elige con cuál quedarte. La otra irá a la papelera.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <p className={`text-[10px] font-black text-center uppercase ${theme.textSec}`}>Actual</p>
                <img src={srcDeFoto(conflictoFoto.fotoActual)} alt="actual" className="w-full h-44 object-cover rounded-xl border-2 border-slate-300" />
                <button onClick={() => resolverConflicto(false)} className="w-full py-2.5 rounded-xl text-xs font-black bg-slate-700 text-white border-2 border-slate-900 active:scale-95">MANTENER ACTUAL</button>
              </div>
              <div className="flex flex-col gap-2">
                <p className={`text-[10px] font-black text-center uppercase ${theme.textSec}`}>De la papelera</p>
                <img src={srcDeFoto(conflictoFoto.entrada?.snapshot)} alt="papelera" className="w-full h-44 object-cover rounded-xl border-2 border-green-500" />
                <button onClick={() => resolverConflicto(true)} className="w-full py-2.5 rounded-xl text-xs font-black bg-green-600 text-white border-2 border-green-800 active:scale-95">RESTAURAR ESTA</button>
              </div>
            </div>
            <button onClick={() => setConflictoFoto(null)} className={`mt-3 w-full py-2 rounded-xl text-[11px] font-bold ${theme.textSec} border ${theme.border}`}>CANCELAR</button>
          </div>
        </div>
      )}
    </div>
  );
}
