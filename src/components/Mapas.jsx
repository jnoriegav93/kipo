import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinOff } from 'lucide-react';
import { getColorFibra, agruparPorTramo, calcularOffsetCoords } from '../utils/fibraUtils';

// --- PARTE 1: EL AYUDANTE (CON SALTO INICIAL Y DESCANSO) ---
const MapController = ({ gpsTrigger, miUbicacion, setViewState, handleMapaClick, reintentarGPS, yaSaltoAlInicio, setYaSaltoAlInicio }) => {
  const map = useMap();

  useEffect(() => {
    if (miUbicacion && !yaSaltoAlInicio) {
      map.setView(miUbicacion, 18);
      if (setViewState) setViewState({ center: miUbicacion, zoom: 18 });
      setYaSaltoAlInicio(true);
    }
  }, [miUbicacion, map, yaSaltoAlInicio]);

  useEffect(() => {
    if (gpsTrigger > 0) {
      if (miUbicacion) {
        map.flyTo(miUbicacion, 18, { animate: true, duration: 1.5 });
        if (setViewState) setViewState({ center: miUbicacion, zoom: 18 });
      } else {
        reintentarGPS();
      }
    }
  }, [gpsTrigger]);

  useMapEvents({
    moveend: () => {
      if (setViewState) setViewState({ center: map.getCenter(), zoom: map.getZoom() });
    },
    click: (e) => handleMapaClick(e)
  });

  return null;
};

// --- PARTE 2: EL MAPA PRINCIPAL ---
export const MapaReal = ({
  theme, mapStyle, handleMapaClick, puntosVisiblesMapa, iconSize,
  obtenerColorDia, puntoSeleccionado, handlePuntoClick, puntoTemporal,
  modoFibra, dibujandoFibra, capacidadFibra,
  puntosRecorrido = [], conexionesVisiblesMapa, mostrarEtiquetas,
  viewState, setViewState,
  gpsTrigger,
  yaSaltoAlInicio,
  setYaSaltoAlInicio,
  conexionSeleccionada,
  handleConexionClick,
  modoMover,
  onPuntoDragEnd
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

  const tempIcon = React.useMemo(() => {
    const baseSize = 24 * iconSize;
    return L.divIcon({
      className: 'temp-icon',
      html: `<div style="width: ${baseSize}px; height: ${baseSize}px; background: #000; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2]
    });
  }, [iconSize]);

  // Pre-calcular segmentos virtuales para renderizado y grupos para offset paralelo
  const { segmentosRenderizables, gruposTramo, offsetIndices } = useMemo(() => {
    const segmentos = [];

    // 1. Descomponer conexiones (multi-punto o simples) en segmentos
    conexionesVisiblesMapa.forEach(con => {
      if (con.puntos && con.puntos.length >= 2) {
        // Es un trazo multi-punto
        for (let i = 0; i < con.puntos.length - 1; i++) {
          segmentos.push({
            ...con, // Hereda props del padre (id, capacidad, etc)
            idOriginal: con.id, // Referencia al doc original
            idSegmento: `${con.id}-${i}`, // ID único para key de React
            from: con.puntos[i],
            to: con.puntos[i + 1],
            esSegmento: true
          });
        }
      } else {
        // Es una conexión simple (legado o tramo único)
        segmentos.push({
          ...con,
          idOriginal: con.id,
          idSegmento: con.id
        });
      }
    });

    // 2. Agrupar por tramo (par de postes) para calcular offsets
    // Usamos nuestra función utilitaria pero ahora con la lista de segmentos expandida
    const grupos = agruparPorTramo(segmentos);

    // 3. Calcular índices de offset
    const indices = {};
    Object.values(grupos).forEach(grupo => {
      // Ordenar consistentemente para que el offset sea estable
      // (Podríamos ordenar por ID o timestamp si existiera)
      grupo.sort((a, b) => a.idOriginal.localeCompare(b.idOriginal));

      grupo.forEach((seg, i) => {
        // Guardamos el índice usando el ID del segmento para recuperarlo luego
        indices[seg.idSegmento] = { indice: i, total: grupo.length };
      });
    });

    return {
      segmentosRenderizables: segmentos,
      gruposTramo: grupos,
      offsetIndices: indices
    };
  }, [conexionesVisiblesMapa]);

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
          <TileLayer attribution='© OpenStreetMap contributors © CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={22} maxNativeZoom={20} />
        ) : (
          <>
            <TileLayer attribution='Tiles © Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={22} maxNativeZoom={18} />
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}" maxZoom={22} maxNativeZoom={18} />
          </>
        )}

        <MapController
          gpsTrigger={gpsTrigger}
          miUbicacion={miUbicacion}
          setViewState={setViewState}
          handleMapaClick={handleMapaClick}
          reintentarGPS={reintentarGPS}
          yaSaltoAlInicio={yaSaltoAlInicio}
          setYaSaltoAlInicio={setYaSaltoAlInicio}
        />

        {miUbicacion && <Marker position={miUbicacion} icon={userIcon} zIndexOffset={9999} />}

        {/* Renderizado de conexiones/fibras */}
        {segmentosRenderizables.map(con => {
          const pA = puntosVisiblesMapa.find(p => p.id === con.from);
          const pB = puntosVisiblesMapa.find(p => p.id === con.to);
          if (!pA || !pB) return null;

          const isSelCon = conexionSeleccionada && (conexionSeleccionada.id === con.idOriginal || conexionSeleccionada.id === con.id);
          const capacidad = con.capacidad || 12;
          const colorFibra = getColorFibra(capacidad);

          // Offset paralelo
          const info = offsetIndices[con.idSegmento] || { indice: 0, total: 1 };
          const [posA, posB] = calcularOffsetCoords(
            [pA.coords.lat, pA.coords.lng],
            [pB.coords.lat, pB.coords.lng],
            info.indice, info.total
          );

          return <Polyline
            key={con.idSegmento}
            positions={[posA, posB]}
            pathOptions={{
              color: isSelCon ? '#ef4444' : colorFibra,
              weight: isSelCon ? 6 : (modoFibra ? 4 : 3),
              dashArray: modoFibra ? undefined : '8,8',
              opacity: isSelCon ? 1 : (modoFibra ? 0.95 : 1.0),
              ...(modoFibra && (capacidad === 1) ? { className: 'fibra-blanca' } : {})
            }}
            eventHandlers={modoFibra && !dibujandoFibra ? {
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (handleConexionClick) handleConexionClick({ ...con, id: con.idOriginal });
              }
            } : {}}
          />
        })}

        {/* Renderizado de puntos */}
        {puntosVisiblesMapa.map(p => {
          const colorDia = obtenerColorDia(p.diaId);
          const isSelected = puntoSeleccionado === p.id;
          const isInRecorrido = modoFibra && dibujandoFibra && puntosRecorrido.includes(p.id);
          const baseSize = 24 * iconSize;
          const customIcon = L.divIcon({
            className: 'custom-icon',
            html: `<div style="width: ${baseSize}px; height: ${baseSize}px; background: ${colorDia}; border: ${(isInRecorrido || isSelected) ? '4px solid #facc15' : '2px solid white'}; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center;">
                          ${mostrarEtiquetas === 'item' ? `<div style="position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: white; color: #333; padding: 2px 5px; border-radius: 4px; font-size: 9px; font-weight: 800; border: 2px solid black; white-space: nowrap; z-index: 1000; margin-bottom: 2px;">${p.datos.numero || 'S/N'}</div>` : ''}
                          ${mostrarEtiquetas === 'pasivo' ? `<div style="position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: white; color: #333; padding: 2px 5px; border-radius: 4px; font-size: 9px; font-weight: 800; border: 2px solid black; white-space: nowrap; z-index: 1000; margin-bottom: 2px;">${p.datos.pasivo || '-'}</div>` : ''}
                        </div>`,
            iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2]
          });
          const isDraggable = modoMover && p.id === puntoSeleccionado;
          return <Marker
            key={p.id}
            position={[p.coords.lat, p.coords.lng]}
            icon={customIcon}
            draggable={isDraggable}
            eventHandlers={{
              click: (e) => { L.DomEvent.stopPropagation(e); handlePuntoClick(e, p.id); },
              ...(isDraggable ? {
                dragend: (e) => {
                  const { lat, lng } = e.target.getLatLng();
                  if (onPuntoDragEnd) onPuntoDragEnd(p.id, lat, lng);
                }
              } : {})
            }}
          />
        })}

        {/* Polylines temporales del trazo de fibra actual */}
        {modoFibra && dibujandoFibra && puntosRecorrido.length >= 2 && puntosRecorrido.slice(0, -1).map((fromId, idx) => {
          const toId = puntosRecorrido[idx + 1];
          const pA = puntosVisiblesMapa.find(p => p.id === fromId);
          const pB = puntosVisiblesMapa.find(p => p.id === toId);
          if (!pA || !pB) return null;
          return <Polyline
            key={`rec-${idx}`}
            positions={[[pA.coords.lat, pA.coords.lng], [pB.coords.lat, pB.coords.lng]]}
            pathOptions={{ color: getColorFibra(capacidadFibra), weight: 5, opacity: 0.9 }}
          />;
        })}

        {/* Polylines del trazo terminado pero no guardado */}
        {modoFibra && !dibujandoFibra && puntosRecorrido.length >= 2 && puntosRecorrido.slice(0, -1).map((fromId, idx) => {
          const toId = puntosRecorrido[idx + 1];
          const pA = puntosVisiblesMapa.find(p => p.id === fromId);
          const pB = puntosVisiblesMapa.find(p => p.id === toId);
          if (!pA || !pB) return null;
          return <Polyline
            key={`pending-${idx}`}
            positions={[[pA.coords.lat, pA.coords.lng], [pB.coords.lat, pB.coords.lng]]}
            pathOptions={{ color: getColorFibra(capacidadFibra), weight: 5, dashArray: '12,6', opacity: 0.7 }}
          />;
        })}

        {puntoTemporal && <Marker position={[puntoTemporal.lat, puntoTemporal.lng]} icon={tempIcon} zIndexOffset={1000} />}
      </MapContainer>
    </div>
  );
};
