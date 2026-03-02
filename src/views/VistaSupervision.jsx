import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ChevronDown, Eye, Plus, Trash2, Clock, MessageCircle, X, MapPin, ArrowLeft, Loader, Image as ImageIcon } from 'lucide-react';
import ChatBitacora from '../components/ChatBitacora';
import VerDetalle from '../components/VerDetalle';

const VistaSupervision = ({
  theme,
  user,
  proyectosSupervisados,
  solicitudesPendientes = [],
  onVolver,
  setModalCodigoAbierto,
  onEliminarSupervision,
  config,
  notificacionesSupervisados = {},
  marcarChatLeido,
  onGPSProyecto
}) => {

  const hayItems = proyectosSupervisados.length > 0 || solicitudesPendientes.length > 0;
  const [chatAbierto, setChatAbierto] = useState(null);

  // Estado para ver proyecto supervisado
  const [viendoProyecto, setViendoProyecto] = useState(null);
  const [puntosSupervisados, setPuntosSupervisados] = useState([]);
  const [cargandoPuntos, setCargandoPuntos] = useState(false);
  const [filtroPunto, setFiltroPunto] = useState('');
  const [puntoDetalle, setPuntoDetalle] = useState(null);

  const abrirChat = (proy) => {
    setChatAbierto(proy);
    if (marcarChatLeido) marcarChatLeido(proy.id);
  };

  const cerrarChat = () => {
    if (chatAbierto && marcarChatLeido) {
      marcarChatLeido(chatAbierto.id);
    }
    setChatAbierto(null);
  };

  // Cargar puntos del proyecto supervisado
  const cargarPuntos = async (proy) => {
    const q = query(collection(db, "puntos"), where("proyectoId", "==", proy.id));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  };

  const verProyecto = async (proy) => {
    setViendoProyecto(proy);
    setCargandoPuntos(true);
    setFiltroPunto('');
    setPuntoDetalle(null);
    try {
      const pts = await cargarPuntos(proy);
      setPuntosSupervisados(pts);
    } catch (error) {
      console.error("Error cargando puntos supervisados:", error);
      setPuntosSupervisados([]);
    } finally {
      setCargandoPuntos(false);
    }
  };

  // GPS: ver todos los puntos en el mapa
  const gpsProyecto = async (proy) => {
    try {
      const pts = await cargarPuntos(proy);
      if (pts.length === 0) return;
      if (onGPSProyecto) onGPSProyecto(proy, pts, null);
    } catch (error) {
      console.error("Error cargando puntos para GPS:", error);
    }
  };

  // GPS: ver un punto específico en el mapa
  const gpsPunto = (punto) => {
    if (!punto.coords || !viendoProyecto) return;
    if (onGPSProyecto) onGPSProyecto(viendoProyecto, puntosSupervisados, punto.coords);
  };

  const cerrarVistaProyecto = () => {
    setViendoProyecto(null);
    setPuntosSupervisados([]);
    setPuntoDetalle(null);
  };

  // Si estamos viendo detalle de un punto
  if (puntoDetalle) {
    return (
      <VerDetalle
        datos={puntoDetalle.datos}
        proyectoActual={viendoProyecto}
        config={config}
        theme={theme}
        readOnly={true}
        esSupervision={true}
        proyectoId={viendoProyecto?.id}
        user={user}
        onVolver={() => setPuntoDetalle(null)}
        onEditar={() => {}}
        onEditarFotos={() => {}}
      />
    );
  }

  // Si estamos viendo la lista de puntos de un proyecto
  if (viendoProyecto) {
    const puntosFiltrados = puntosSupervisados.filter(p => {
      if (!filtroPunto) return true;
      const busqueda = filtroPunto.toLowerCase();
      const fat = (p.datos?.codFat || '').toLowerCase();
      const numero = (p.datos?.numero || '').toLowerCase();
      const pasivo = (p.datos?.pasivo || '').toLowerCase();
      return fat.includes(busqueda) || numero.includes(busqueda) || pasivo.includes(busqueda);
    });

    return (
      <div className={`flex-1 ${theme.bg} flex flex-col overflow-hidden`}>
        {/* HEADER */}
        <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0 z-20`}>
          <button onClick={cerrarVistaProyecto} className="flex items-center gap-1">
            <ArrowLeft size={24} className={theme.text} strokeWidth={2.5} />
          </button>
          <div className="flex-1 text-center">
            <span className={`font-black ${theme.text} text-sm uppercase`}>{viendoProyecto.nombre}</span>
            <p className={`text-[10px] ${theme.textSec} font-bold`}>
              {viendoProyecto.ownerNombre || 'Sin nombre'} {viendoProyecto.ownerEmpresa ? `• ${viendoProyecto.ownerEmpresa}` : ''}
            </p>
          </div>
          <div className="w-8"></div>
        </div>

        {/* TOTAL */}
        <div className={`${theme.header} px-4 py-2 border-b ${theme.border} shrink-0`}>
          <p className={`text-xs font-black ${theme.text} uppercase`}>
            TOTAL: {puntosSupervisados.length} PUNTOS
          </p>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
          {/* Buscador */}
          <div className="shrink-0">
            <input
              type="text"
              placeholder="Buscar por item o elemento pasivo..."
              value={filtroPunto}
              onChange={(e) => setFiltroPunto(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border-2 ${theme.border} ${theme.bg} ${theme.text} font-bold placeholder-slate-400 focus:border-blue-500 focus:outline-none transition-colors text-base`}
            />
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {cargandoPuntos ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader size={32} className={`${theme.textSec} animate-spin mb-3`} />
                <p className={`text-sm ${theme.textSec} font-bold`}>Cargando puntos...</p>
              </div>
            ) : puntosFiltrados.length === 0 ? (
              <div className="text-center py-8">
                <MapPin size={48} className={`${theme.textSec} mx-auto mb-3 opacity-30`} />
                <p className={`text-sm ${theme.textSec} font-medium`}>
                  {filtroPunto ? 'No se encontraron puntos' : 'No hay puntos registrados'}
                </p>
              </div>
            ) : (
              puntosFiltrados.map((punto) => {
                const datos = punto.datos || {};
                const totalFotos = (() => {
                  const fotos = datos.fotos;
                  if (!fotos || typeof fotos !== 'object') return 0;
                  let count = 0;
                  Object.values(fotos).forEach(section => {
                    if (section && typeof section === 'object') {
                      count += Object.values(section).filter(v => v && (typeof v === 'string' || v.url || v.thumb)).length;
                    }
                  });
                  return count;
                })();

                return (
                  <div
                    key={punto.id}
                    className={`${theme.card} border-2 ${theme.border} rounded-lg px-3 py-2`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className={`text-[10px] font-normal ${theme.textSec} shrink-0`}>ITEM:</span>
                        <span className={`text-xs font-black ${theme.text} truncate`}>{datos.numero || '-'}</span>
                      </div>
                      <div className={`w-px h-3 bg-current ${theme.textSec} opacity-30 shrink-0`}></div>
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span className={`text-[10px] font-normal ${theme.textSec} shrink-0`}>Pasivo:</span>
                        <span className={`text-xs font-black ${theme.text} truncate`}>{datos.pasivo || '-'}</span>
                      </div>
                      <div className={`flex items-center gap-1.5 px-2.5 p-1.5 rounded-lg text-xs font-black shrink-0 shadow-md text-white ${totalFotos > 0 ? 'bg-green-600' : 'bg-red-600'}`}>
                        <ImageIcon size={14} />
                        <span>{totalFotos}</span>
                      </div>
                      <button
                        onClick={() => setPuntoDetalle(punto)}
                        className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-md shrink-0"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => gpsPunto(punto)}
                        className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all shadow-md shrink-0"
                      >
                        <MapPin size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vista principal: lista de proyectos supervisados
  return (
    <div className={`flex-1 ${theme.bg} flex flex-col overflow-hidden`}>

      {/* HEADER */}
      <div className={`${theme.header} px-4 py-3 flex items-center justify-between border-b-2 ${theme.border} shrink-0 z-20`}>
        <button onClick={onVolver}>
          <ChevronDown className={`rotate-90 ${theme.text}`} size={28}/>
        </button>
        <span className={`font-black ${theme.text} text-lg uppercase`}>SUPERVISIÓN</span>
        <div className="w-6"></div>
      </div>

      {/* BOTÓN AGREGAR - Solo si hay items */}
      {hayItems && (
        <div className={`${theme.header} shrink-0 p-2 z-10 shadow-sm`}>
          <button
            onClick={() => setModalCodigoAbierto(true)}
            className={`w-full py-3 border-2 border-dashed ${theme.border} ${theme.card} rounded-xl ${theme.text} font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:border-brand-500 hover:text-brand-500 transition-colors active:scale-95`}
          >
            <Plus size={18} /> AGREGAR PROYECTO A SUPERVISAR
          </button>
        </div>
      )}

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-4">

        {!hayItems ? (

          /* VACÍO */
          <div className={`flex flex-col items-center justify-center h-full ${theme.textSec} p-4`}>
            <Eye size={64} className="mb-4 opacity-30"/>
            <p className="mb-2 font-bold text-center">No estás supervisando ningún proyecto</p>
            <p className="text-xs text-center mb-4">Solicita acceso ingresando un código de proyecto</p>
            <button
              onClick={() => setModalCodigoAbierto(true)}
              className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg"
            >
              <Plus size={20} /> AGREGAR CÓDIGO
            </button>
          </div>

        ) : (

          /* LISTA DE PROYECTOS */
          <div className="space-y-3">

            {/* Solicitudes en espera */}
            {solicitudesPendientes.map(proy => (
              <div
                key={`pending-${proy.id}`}
                className={`${theme.card} border-2 border-dashed border-slate-400 rounded-xl p-4 shadow-sm opacity-70`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-black text-base ${theme.text} uppercase leading-tight truncate`}>
                      {proy.nombre}
                    </h3>
                    <p className={`text-xs ${theme.textSec} font-bold mt-0.5`}>
                      {proy.ownerNombre || 'Sin nombre'} {proy.ownerEmpresa ? `• ${proy.ownerEmpresa}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-300">
                      <Clock size={14} /> EN ESPERA
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {/* Proyectos supervisados activos */}
            {proyectosSupervisados.map(proy => {
              const noLeidos = notificacionesSupervisados[proy.id] || 0;
              return (
                <div
                  key={proy.id}
                  className={`${theme.card} border-2 ${theme.border} rounded-xl p-4 shadow-sm`}
                >
                  <div className="flex items-center gap-3">
                    {/* Info del proyecto */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-black text-base ${theme.text} uppercase leading-tight truncate`}>
                        {proy.nombre}
                      </h3>
                      <p className={`text-xs ${theme.textSec} font-bold mt-0.5`}>
                        {proy.ownerNombre || 'Sin nombre'} {proy.ownerEmpresa ? `• ${proy.ownerEmpresa}` : ''}
                      </p>
                    </div>

                    {/* Botones: Bitácora | Ojo | GPS | Basurero */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => abrirChat(proy)}
                        className={`relative p-2.5 rounded-lg active:scale-95 transition-all shadow-md ${theme.card} border-2 ${theme.border} hover:border-blue-500`}
                        title="Bitácora"
                      >
                        <MessageCircle size={16} className={theme.text} />
                        {noLeidos > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white border-2 border-white">
                            {noLeidos > 9 ? '9+' : noLeidos}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => verProyecto(proy)}
                        className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-md"
                        title="Ver lista de puntos"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => gpsProyecto(proy)}
                        className="bg-blue-600 text-white p-2.5 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-md"
                        title="Ver en mapa"
                      >
                        <MapPin size={16} />
                      </button>
                      <button
                        onClick={() => onEliminarSupervision && onEliminarSupervision(proy)}
                        className="bg-red-600 text-white p-2.5 rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-md"
                        title="Dejar de supervisar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        )}
      </div>

      {/* MODAL CHAT */}
      {chatAbierto && (
        <div className={`fixed inset-0 z-[300] ${theme.card} flex flex-col`}>

          {/* Header */}
          <div className={`${theme.header} px-4 border-b-2 ${theme.border} flex items-center justify-between shrink-0 pt-safe-header`} style={{ paddingBottom: '12px' }}>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <MessageCircle size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className={`font-black text-lg ${theme.text} uppercase`}>Bitácora</h3>
                <p className={`text-xs ${theme.textSec} font-medium`}>{chatAbierto.nombre}</p>
              </div>
            </div>
            <button onClick={cerrarChat} className={`${theme.text} hover:bg-slate-100 p-2 rounded-lg transition-colors`}>
              <X size={24} />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <ChatBitacora
              proyectoId={chatAbierto.id}
              user={user}
              theme={theme}
              esCompartido={true}
              config={config}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VistaSupervision;
