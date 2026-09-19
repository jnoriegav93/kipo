import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Pane, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinOff, Compass } from 'lucide-react';
import { getColorFibra, distanciaMetros } from '../utils/fibraUtils';
import { TRAZO_ACERO_VACIO } from '../utils/cablesAcero';
import { useRumbo } from '../hooks/useRumbo';
import { exigeNorte, anguloEtiquetaFibra, gestoDosDedos } from '../utils/giroMapa';
import { instalarGiro } from '../utils/giroLeaflet';
import { agruparPuntos, ocultaEtiquetas } from '../utils/agruparPuntos';

// --- PARTE 0: CONTROLADOR DE MARCADOR ARRASTRABLE (NATIVO LEAFLET, FUERA DE REACT) ---
// Radio de imantado, en píxeles de pantalla. En píxeles y no en metros para que se
// sienta igual a cualquier zoom: cerca es "cerca en la pantalla".
const SNAP_PX = 18;

const DragMoverController = ({ modoMover, puntoSeleccionado, puntosVisiblesMapa, iconSize, obtenerColorDia, onPuntoDragEnd, verticesSnap = [] }) => {
  const map = useMap();
  const markerRef = useRef(null);
  const haloRef = useRef(null);
  const onDragEndRef = useRef(onPuntoDragEnd);
  // Los vértices viven en un ref: así el arrastre siempre ve la lista fresca sin
  // tener que recrear el marcador (que cancelaría el arrastre en curso).
  const verticesRef = useRef(verticesSnap);

  // Mantener callbacks y datos siempre frescos sin recrear el marcador
  useEffect(() => { onDragEndRef.current = onPuntoDragEnd; });
  useEffect(() => { verticesRef.current = verticesSnap; }, [verticesSnap]);

  useEffect(() => {
    // Limpiar marcador anterior
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    if (!modoMover || !puntoSeleccionado) return;

    const punto = puntosVisiblesMapa.find(p => p.id === puntoSeleccionado);
    if (!punto) return;

    const colorDia = obtenerColorDia(punto.diaId);
    const baseSize = 24 * iconSize;
    const icon = L.divIcon({
      className: 'custom-icon',
      html: `<div style="width:${baseSize}px;height:${baseSize}px;background:${colorDia};border:4px solid #facc15;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>`,
      iconSize: [baseSize, baseSize],
      iconAnchor: [baseSize / 2, baseSize / 2]
    });

    const marker = L.marker([punto.coords.lat, punto.coords.lng], { draggable: true, icon, zIndexOffset: 2000 });

    // Halo que señala el vértice al que se va a pegar. Se crea una sola vez y se
    // mueve; crearlo y destruirlo en cada movimiento daría tirones.
    const halo = L.circleMarker([punto.coords.lat, punto.coords.lng], {
      radius: 11, color: '#06b6d4', weight: 3, fillColor: '#06b6d4', fillOpacity: 0.25, interactive: false
    });

    // Vértice de fibra más cercano al puntero, si está dentro del radio de imantado.
    const verticeCercano = (latlng) => {
      const lista = verticesRef.current;
      if (!lista || lista.length === 0) return null;
      const p = map.latLngToLayerPoint(latlng);
      let mejor = null, mejorD = SNAP_PX;
      for (const v of lista) {
        const q = map.latLngToLayerPoint(L.latLng(v.lat, v.lng));
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < mejorD) { mejorD = d; mejor = v; }
      }
      return mejor;
    };

    marker.on('drag', () => {
      const v = verticeCercano(marker.getLatLng());
      if (v) {
        marker.setLatLng([v.lat, v.lng]);   // se pega al vértice
        halo.setLatLng([v.lat, v.lng]);
        if (!map.hasLayer(halo)) halo.addTo(map);
      } else if (map.hasLayer(halo)) {
        halo.remove();
      }
    });

    marker.on('dragend', () => {
      if (map.hasLayer(halo)) halo.remove();
      const { lat, lng } = marker.getLatLng();
      onDragEndRef.current(puntoSeleccionado, lat, lng);
    });
    marker.addTo(map);
    markerRef.current = marker;
    haloRef.current = halo;

    return () => {
      marker.remove();
      halo.remove();
      markerRef.current = null;
      haloRef.current = null;
    };
  }, [modoMover, puntoSeleccionado]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

// El nombre del ramal lo escribe el usuario y termina dentro del HTML de un icono:
// hay que escaparlo para que un < no rompa el marcador.
const escaparHtml = (t) => String(t == null ? '' : t)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- CONTADOR DE TILES ---
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const CACHE_NAMES = { esri: 'tiles-esri', google: 'tiles-google' };

// Lee la cantidad REAL de tiles únicos guardados en la Cache Storage del SW
export const getTileCount = async (provider) => {
  try {
    if (!('caches' in window)) return 0;
    const cache = await caches.open(CACHE_NAMES[provider]);
    const keys = await cache.keys();
    return keys.length;
  } catch { return 0; }
};

// Avisa que hubo actividad de tiles (el conteo real lo lee VistaMapa de la caché)
const notifyTileActivity = (provider) => {
  window.dispatchEvent(new CustomEvent('kipo_tile_loaded', { detail: { provider } }));
};

// Handlers estables (definidos fuera de componentes para no recrearse en cada render)
const makeTileHandlers = (provider) => ({
  tileload: () => notifyTileActivity(provider),
  tileerror: (e) => {
    const tile = e.tile;
    if (tile && tile.src !== TRANSPARENT_PIXEL) tile.src = TRANSPARENT_PIXEL;
  },
});

// --- PARTE 1: EL AYUDANTE (CON SALTO INICIAL Y DESCANSO) ---
const MapController = ({ gpsTrigger, miUbicacion, setViewState, handleMapaClick, reintentarGPS, yaSaltoAlInicio, setYaSaltoAlInicio, dibujandoFibra, centrarEnCoord, giro = 0, giroRef }) => {
  const map = useMap();

  // Marca el contenedor mientras se dibuja fibra, para que el CSS pueda cambiar el
  // puntero. Se hace sobre el elemento real y no por className de MapContainer,
  // que react-leaflet no siempre reaplica después del montaje.
  useEffect(() => {
    const el = map.getContainer();
    if (dibujandoFibra) el.classList.add('fibra-dibujando');
    else el.classList.remove('fibra-dibujando');
    return () => el.classList.remove('fibra-dibujando');
  }, [map, dibujandoFibra]);

  // Forzar recálculo de tamaño al montar — necesario en iOS/WebKit donde el contenedor
  // puede no tener dimensiones finales cuando Leaflet inicializa las tiles
  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map]);

  // Al empezar o dejar de girar, el contenedor cambia de tamaño (pasa a ser un
  // cuadrado del tamaño de la diagonal, para que no se vean esquinas vacías).
  // Leaflet necesita que se lo digan o sigue creyendo que mide lo de antes.
  const alNorte = giro === 0;
  useEffect(() => {
    map.invalidateSize({ animate: false });
  }, [map, alNorte]);

  // En vez de corregir a Leaflet desde afuera, se le ENSEÑA el ángulo: sus
  // manejadores quedan encendidos, así que conserva su arrastre con inercia, su zoom
  // suave y su `touch-action` —sin el cual, en iOS, el navegador se queda el gesto—.
  // El parche consulta el ref en cada evento, así que se instala una sola vez.
  useEffect(() => instalarGiro(map, () => giroRef?.current || 0), [map, giroRef]);

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

  // Centrar en una coordenada concreta (por ejemplo un ramal de la lista). Se dispara
  // por el contador n, no por las coordenadas, para poder repetir el mismo destino.
  useEffect(() => {
    if (!centrarEnCoord || centrarEnCoord.lat == null) return;
    map.flyTo([centrarEnCoord.lat, centrarEnCoord.lng], Math.max(map.getZoom(), 17), { animate: true, duration: 0.8 });
  }, [centrarEnCoord?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useMapEvents({
    moveend: () => {
      if (setViewState) setViewState({ center: map.getCenter(), zoom: map.getZoom() });
    },
    // Ya no hace falta corregir la coordenada: Leaflet conoce el ángulo
    click: (e) => handleMapaClick(e)
  });

  return null;
};

// --- PARTE 2: EL MAPA PRINCIPAL ---
export const MapaReal = ({
  theme, mapStyle, handleMapaClick, puntosVisiblesMapa, iconSize,
  obtenerColorDia, puntoSeleccionado, handlePuntoClick, puntoTemporal,
  modoFibra, dibujandoFibra, capacidadFibra,
  puntosRecorrido = [], conexionesVisiblesMapa, mostrarEtiquetas, centrarEnCoord,
  previewFibra = null,
  viewState, setViewState,
  giro = 0,              // grados que se torció el mapa (0 = norte arriba)
  setGiro,               // si no llega, el mapa no se puede girar
  mostrarZoom = false,   // TEMPORAL: número de zoom en pantalla, para afinar umbrales
  gpsTrigger,
  yaSaltoAlInicio,
  setYaSaltoAlInicio,
  conexionSeleccionada,
  handleConexionClick,
  modoMover,
  pendingCoords,
  onPuntoDragEnd,
  fotosConCoordenadas = [],
  fotoPuntosActivo = false,
  onFotoMarkerClick,
  puntoResaltado = null,
  modoMoverPuntos = false,
  puntosSeleccionadosMover = [],
  modoOrdenar = false,
  ordenSeleccion = [],
  modoCorregir = null,
  correccionSel = [],
  ordenTrabajo = [],
  prefijoOrden = [],
  previewAjuste = [],
  modoAjuste = false,
  apoyadosAjuste = [],
  simbologiaActiva = false,
  coloresArmado = {},
  // Cable de acero: otra capa, que se dibuja desde la misma barra que la fibra
  modoLinea = 'fibra',
  lineasAcero = [],
  trazoAcero = TRAZO_ACERO_VACIO,
  onTocarFibraAcero,
  cableAceroSeleccionado = null,
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

  // Brújula del equipo: solo para pintar el cono. Si no hay, no pasa nada.
  const { rumbo, estado: estadoBrujula, pedirPermiso } = useRumbo();

  // ── Giro del mapa ───────────────────────────────────────────────────────────
  // Las herramientas que tocan la geometría de los datos (mover, dibujar, ajustar,
  // ordenar, corregir) trabajan SIEMPRE con el norte arriba. No se borra el giro
  // elegido: se ignora mientras dure la herramienta y vuelve solo al terminar.
  const marcoRef = useRef(null);
  const rotanteRef = useRef(null);
  const alNorteForzado = exigeNorte({
    mover: modoMover,
    fibra: modoFibra,
    acero: modoLinea === 'acero',
    ajuste: modoAjuste,
    ordenar: modoOrdenar,
    corregir: !!modoCorregir,
    moverPuntos: modoMoverPuntos,
  });
  const giroEfectivo = alNorteForzado ? 0 : (giro || 0);

  // El toque cae sobre el mapa YA girado, pero Leaflet lo interpreta como si el norte
  // siguiera arriba. Se des-gira alrededor del centro de lo que se ve y recién ahí se
  // convierte a coordenada. Si esto fallara, un poste nuevo se guardaría corrido.
  // El ángulo del momento, para que los parches de Leaflet lo consulten en cada
  // evento. Durante el gesto se adelanta al estado de React, que recién se entera al
  // soltar los dedos.
  const giroVivoRef = useRef(giroEfectivo);
  // Se actualiza en un efecto y no durante el render (React no deja tocar refs ahí).
  // No importa que llegue un instante tarde: los parches lo leen cuando hay un gesto,
  // que siempre ocurre después de pintar.
  useEffect(() => { giroVivoRef.current = giroEfectivo; }, [giroEfectivo]);

  // ── El gesto de dos dedos ───────────────────────────────────────────────────
  // La separación entre los dedos la sigue manejando Leaflet (es el zoom de
  // siempre); aquí solo se mira el ÁNGULO, así que acercar y girar salen del mismo
  // gesto. La zona muerta evita que un pellizco apenas torcido empiece a girar sin
  // querer, y al pasarla se arranca desde cero para que no pegue un salto.
  const gestoRef = useRef(null);
  const dosDedos = (e) => (e.touches && e.touches.length === 2)
    ? { a: { x: e.touches[0].clientX, y: e.touches[0].clientY }, b: { x: e.touches[1].clientX, y: e.touches[1].clientY } }
    : null;
  // El ángulo se PINTA en el DOM durante el gesto. Pasarlo por el estado de React en
  // cada movimiento redibujaba los cientos de postes cuadro a cuadro: de ahí venía el
  // tirón. React se entera al soltar los dedos.
  const pintarGiro = (grados) => {
    if (rotanteRef.current) {
      rotanteRef.current.style.transform = `translate(-50%, -50%) rotate(${grados}deg)`;
    }
  };

  const alEmpezarGesto = (e) => {
    const dedos = dosDedos(e);
    if (!dedos || !setGiro || alNorteForzado) { gestoRef.current = null; return; }
    gestoRef.current = { inicio: dedos, giroInicial: giro || 0, sueltoElFreno: false, arranque: 0, ultimo: giro || 0 };
  };

  const alMoverGesto = (e) => {
    const g = gestoRef.current;
    const dedos = dosDedos(e);
    if (!g || !dedos) return;
    // Solo se mira el ÁNGULO: la separación entre los dedos la sigue manejando
    // Leaflet, que ya sabe del giro y hace su zoom suave anclado donde corresponde.
    const { delta, pasaZonaMuerta } = gestoDosDedos(g.inicio, dedos);
    if (!g.sueltoElFreno) {
      if (!pasaZonaMuerta) return;
      g.sueltoElFreno = true;
      g.arranque = delta;
    }
    g.ultimo = g.giroInicial + (delta - g.arranque);
    giroVivoRef.current = g.ultimo;   // para que los parches de Leaflet vayan al día
    pintarGiro(g.ultimo);
  };

  const alTerminarGesto = () => {
    const g = gestoRef.current;
    gestoRef.current = null;
    if (g?.sueltoElFreno && setGiro) setGiro(g.ultimo);
  };

  // Punto azul con su cono de linterna. Se construye UNA SOLA VEZ: cuando cambia el
  // rumbo solo se le escribe el giro al cono (en el efecto de más abajo). Antes se
  // rehacía el ícono entero en cada lectura de la brújula, con lo cual Leaflet
  // reemplazaba el elemento, la animación del punto se reiniciaba y el conjunto
  // parecía bailar: eran dos piezas sueltas en vez de una.
  const userIcon = React.useMemo(() => L.divIcon({
    className: 'user-icon',
    html: `<div style="position:relative; width:76px; height:76px;">
        <div data-cono style="position:absolute; left:0; top:0; width:76px; height:76px; opacity:0; z-index:1; transform-origin:38px 38px; will-change:transform; pointer-events:none;">
          <svg width="76" height="76" viewBox="0 0 76 76" style="display:block; filter:drop-shadow(0 0 2px rgba(255,255,255,0.85));">
            <defs>
              <!-- El degradado se ancla a la POSICIÓN del técnico (38,38). Arranca
                   transparente en el primer tramo para que el cono salga de DETRÁS del
                   punto azul en vez de taparlo. -->
              <radialGradient id="conoRumbo" gradientUnits="userSpaceOnUse" cx="38" cy="38" r="34">
                <stop offset="0%" stop-color="#1d4ed8" stop-opacity="0" />
                <stop offset="24%" stop-color="#1d4ed8" stop-opacity="0.95" />
                <stop offset="60%" stop-color="#2563eb" stop-opacity="0.55" />
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05" />
              </radialGradient>
            </defs>
            <path d="M38 38 L20 9.2 A34 34 0 0 1 56 9.2 Z" fill="url(#conoRumbo)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        </div>
        <!-- El punto se centra por PORCENTAJE, no por píxeles contados a mano: el reset
             de Tailwind pone box-sizing border-box, con lo cual el borde de 3 px va por
             dentro y el punto mide 20 y no 26. Contando a mano quedaba 3 px arriba y 3 a
             la izquierda del origen del cono, y por eso parecían dos piezas sueltas. -->
        <div data-punto style="position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); width:20px; height:20px; z-index:2; background-color:#2563eb; border:3px solid white; border-radius:50%; box-shadow:0 0 0 4px rgba(37, 99, 235, 0.3); animation:pulse-blue 2s infinite;"></div>
      </div>`,
    iconSize: [76, 76], iconAnchor: [38, 38]
  }), []);

  // El rumbo se escribe DIRECTO en el DOM, sin pasar por React ni por Leaflet: así el
  // ícono nunca se rehace y el cono y el punto se mueven como una sola pieza. El cono
  // es el único que gira a propósito, por eso se le descuenta el giro del mapa.
  const marcadorUsuarioRef = useRef(null);
  useEffect(() => {
    const cono = marcadorUsuarioRef.current?.getElement?.()?.querySelector('[data-cono]');
    if (!cono) return;
    if (rumbo == null) { cono.style.opacity = '0'; return; }
    cono.style.transform = `rotate(${(rumbo - giroEfectivo).toFixed(1)}deg)`;
    cono.style.opacity = '1';
  }, [rumbo, giroEfectivo, miUbicacion]);

  // ── Agrupar de lejos ────────────────────────────────────────────────────────
  // A partir de cierto zoom, los puntos que caen juntos se muestran como una burbuja
  // con su cantidad. Lo que está EN JUEGO nunca se agrupa: el seleccionado, el
  // temporal, el resaltado, los del trazo en curso y los marcados en cada modo.
  const zoomActual = viewState?.zoom;
  const claseDePunto = React.useCallback((p) => {
    const raw = p?.datos?.tipoElemento;
    const tipos = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    if (tipos.includes('medioTramo')) return 'medioTramo';
    if (tipos.includes('camara')) return 'camara';
    return 'poste';
  }, []);

  const { sueltos: puntosSueltos, grupos: gruposPuntos } = React.useMemo(() => {
    const enJuego = new Set([
      puntoSeleccionado, puntoResaltado,
      ...puntosRecorrido.map(v => v?.puntoId),
      ...puntosSeleccionadosMover, ...ordenSeleccion, ...correccionSel,
      ...(trazoAcero?.postes || []), trazoAcero?.medioTramo,
    ].filter(Boolean).map(String));
    return agruparPuntos(puntosVisiblesMapa, zoomActual, { claseDe: claseDePunto, siempreSolos: enJuego });
  }, [puntosVisiblesMapa, zoomActual, claseDePunto, puntoSeleccionado, puntoResaltado,
    puntosRecorrido, puntosSeleccionadosMover, ordenSeleccion, correccionSel, trazoAcero]);

  // La burbuja se ve IGUAL que un marcador suelto —mismo tamaño, misma forma y mismo
  // color que tendría ese punto— y solo cambia que lleva el número adentro. Así, al
  // alejarse, el mapa no cambia de aspecto: solo aparecen números.
  const iconoGrupo = React.useCallback((g) => {
    const primero = g.puntos[0];
    const esMedioTramo = g.clase === 'medioTramo';
    // Mismas cuentas que el marcador suelto, para que midan exactamente lo mismo
    const baseSize = 24 * Math.max(0.4, iconSize - 0.2);
    const fuente = Math.max(9, Math.round(baseSize * 0.5));
    const color = simbologiaActiva
      ? (coloresArmado[primero?.datos?.armadoSeleccionadoId] || '#9ca3af')
      : obtenerColorDia(primero?.diaId);

    if (esMedioTramo) {
      // Triángulo amarillo, como el medio tramo suelto, con la cantidad abajo
      const half = baseSize / 2;
      const t = Math.max(2, Math.round(baseSize * 0.16));
      const relleno = simbologiaActiva ? color : '#facc15';
      return L.divIcon({
        className: 'grupo-icon',
        html: `<div style="position:relative; width:${baseSize}px; height:${baseSize}px;">
            <div style="position:absolute; left:0; bottom:0; width:0; height:0; border-left:${half}px solid transparent; border-right:${half}px solid transparent; border-bottom:${baseSize}px solid #1e293b;"></div>
            <div style="position:absolute; left:${t}px; bottom:${Math.round(t * 0.6)}px; width:0; height:0; border-left:${half - t}px solid transparent; border-right:${half - t}px solid transparent; border-bottom:${baseSize - Math.round(t * 1.8)}px solid ${relleno};"></div>
            <div style="position:absolute; left:0; bottom:0; width:${baseSize}px; height:${baseSize}px; display:flex; align-items:flex-end; justify-content:center; padding-bottom:1px;"><span style="color:#000; font-weight:900; font-size:${Math.max(8, Math.round(baseSize * 0.36))}px; line-height:1;">${g.cantidad}</span></div>
          </div>`,
        iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2],
      });
    }
    return L.divIcon({
      className: 'grupo-icon',
      html: `<div style="width:${baseSize}px; height:${baseSize}px; background:${color}; border:2px solid white; border-radius:50%; display:flex; align-items:center; justify-content:center;">
          <span style="color:white; font-weight:900; font-size:${fuente}px; line-height:1;">${g.cantidad}</span>
        </div>`,
      iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2],
    });
  }, [iconSize, simbologiaActiva, coloresArmado, obtenerColorDia]);

  // Tocar una burbuja acerca el mapa: es la forma de "abrirla" sin inventar gestos.
  const acercarAGrupo = React.useCallback((e, g) => {
    const mapa = e?.target?._map;
    if (!mapa) return;
    mapa.setView([g.centro.lat, g.centro.lng], Math.min(mapa.getZoom() + 2, mapa.getMaxZoom() || 22));
  }, []);

  // De lejos las etiquetas se esconden aunque estén encendidas: los globitos se pisan
  // y no se lee ninguno. No se apagan, se ocultan, y se avisa.
  const etiquetasOcultas = ocultaEtiquetas(zoomActual)
    && !!(mostrarEtiquetas?.item || mostrarEtiquetas?.pasivo || mostrarEtiquetas?.fibra);
  const etiquetasVisibles = etiquetasOcultas ? { item: false, pasivo: false, fibra: false } : mostrarEtiquetas;

  const tempIcon = React.useMemo(() => {
    const baseSize = 24 * iconSize;
    return L.divIcon({
      className: 'temp-icon',
      html: `<div style="width: ${baseSize}px; height: ${baseSize}px; background: #000; border: 3px solid white; border-radius: 50%; box-shadow: 0 4px 8px rgba(0,0,0,0.5);"></div>`,
      iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2]
    });
  }, [iconSize]);

  // Postes clavados en algún ramal: se eligieron al dibujar la fibra, así que ya
  // están apoyados y no hay nada que ajustar en ellos. Durante el ajuste se pintan
  // verdes para que a simple vista solo queden sin marcar los que están fuera del
  // umbral y habría que revisar.
  const postesEnFibra = useMemo(() => {
    const s = new Set();
    conexionesVisiblesMapa.forEach(c => {
      (Array.isArray(c.vertices) ? c.vertices : []).forEach(v => { if (v?.puntoId) s.add(String(v.puntoId)); });
    });
    return s;
  }, [conexionesVisiblesMapa]);

  // Puntero con forma de poste mientras se dibuja. El '#' del color va escapado
  // porque va dentro de una URL de datos SVG.
  const colorTrazo = getColorFibra(capacidadFibra);
  const cursorVertice = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'><circle cx='13' cy='13' r='8' fill='${colorTrazo.replace('#', '%23')}' fill-opacity='0.8' stroke='white' stroke-width='3'/></svg>") 13 13, crosshair`;

  // Pre-calcular segmentos virtuales para renderizado y grupos para offset paralelo
  const { lineasFibra, etiquetasFibra, verticesSnap } = useMemo(() => {
    const segmentos = [];

    // Coordenada de un poste por id. Solo hace falta para las fibras LEGADAS, que
    // guardaban únicamente ids y sacaban su forma de dónde estuvieran los postes.
    const coordDePunto = (id) => {
      const p = puntosVisiblesMapa.find(x => String(x.id) === String(id));
      return p?.coords?.lat != null ? { lat: p.coords.lat, lng: p.coords.lng } : null;
    };

    // 1. Descomponer conexiones en segmentos, cada uno ya con sus dos coordenadas
    conexionesVisiblesMapa.forEach(con => {
      // NUEVO: la fibra trae su propia geometría; no depende de ningún poste.
      // Si el ramal se está editando, se dibuja con su geometría PENDIENTE.
      const vsCon = (previewFibra && String(previewFibra.id) === String(con.id) && Array.isArray(previewFibra.vertices))
        ? previewFibra.vertices : con.vertices;
      if (Array.isArray(vsCon) && vsCon.length >= 2) {
        for (let i = 0; i < vsCon.length - 1; i++) {
          const a = vsCon[i], b = vsCon[i + 1];
          if (a?.lat == null || b?.lat == null) continue;
          segmentos.push({
            ...con,
            idOriginal: con.id,
            idSegmento: `${con.id}-${i}`,
            coordA: { lat: a.lat, lng: a.lng },
            coordB: { lat: b.lat, lng: b.lng },
            esSegmento: true
          });
        }
        return;
      }
      // LEGADO: lista de ids de poste. Se sigue dibujando igual que siempre.
      if (con.puntos && con.puntos.length >= 2) {
        for (let i = 0; i < con.puntos.length - 1; i++) {
          const a = coordDePunto(con.puntos[i]), b = coordDePunto(con.puntos[i + 1]);
          if (!a || !b) continue; // poste oculto o borrado: ese tramo no se dibuja
          segmentos.push({
            ...con,
            idOriginal: con.id,
            idSegmento: `${con.id}-${i}`,
            from: con.puntos[i],
            to: con.puntos[i + 1],
            coordA: a, coordB: b,
            esSegmento: true
          });
        }
      } else {
        const a = coordDePunto(con.from), b = coordDePunto(con.to);
        if (!a || !b) return;
        segmentos.push({ ...con, idOriginal: con.id, idSegmento: con.id, coordA: a, coordB: b });
      }
    });

    // 1b. Etiquetas del ramal: al inicio, al final y cada 100 m. Cada una se gira
    // para seguir el sentido del tramo donde cae, así se lee sobre la línea.
    const etiquetas = [];
    conexionesVisiblesMapa.forEach(con => {
      const pts = (Array.isArray(con.vertices) && con.vertices.length >= 2)
        ? con.vertices.filter(v => v?.lat != null).map(v => ({ lat: v.lat, lng: v.lng }))
        : ((con.puntos?.length >= 2 ? con.puntos : [con.from, con.to]).filter(Boolean).map(coordDePunto).filter(Boolean));
      if (pts.length < 2) return;

      const segs = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const d = distanciaMetros(pts[i], pts[i + 1]);
        segs.push({ a: pts[i], b: pts[i + 1], d, acum: total });
        total += d;
      }
      if (total <= 0) return;

      // Marcas: 0, 100, 200… y el final. Si el final cae casi sobre una marca de
      // 100 no se repite, para no encimar dos etiquetas iguales.
      const marcas = [0];
      for (let m = 100; m < total; m += 100) marcas.push(m);
      if (total - marcas[marcas.length - 1] > 5) marcas.push(total);

      const cap = con.capacidad || 12;
      const texto = con.nombre ? (con.nombre + ' \u00B7 ' + cap + ' FO') : (cap + ' FO');
      const color = getColorFibra(cap);

      marcas.forEach((m, k) => {
        const seg = segs.find(x => m <= x.acum + x.d) || segs[segs.length - 1];
        const t = seg.d > 0 ? Math.min(1, Math.max(0, (m - seg.acum) / seg.d)) : 0;
        const pos = {
          lat: seg.a.lat + (seg.b.lat - seg.a.lat) * t,
          lng: seg.a.lng + (seg.b.lng - seg.a.lng) * t
        };
        // Ángulo en pantalla del tramo. El eje Y de la pantalla crece hacia abajo,
        // por eso el signo cambiado respecto a la latitud.
        const mLat = 111320;
        const mLng = 111320 * Math.cos(seg.a.lat * Math.PI / 180);
        const dx = (seg.b.lng - seg.a.lng) * mLng;
        const dy = (seg.b.lat - seg.a.lat) * mLat;
        let ang = -Math.atan2(dy, dx) * 180 / Math.PI;
        // Se voltea si quedaría cabeza abajo: el texto siempre legible.
        if (ang > 90) ang -= 180; else if (ang < -90) ang += 180;
        etiquetas.push({ id: con.id + '-' + k, pos, angulo: ang, color, texto });
      });
    });

    // Cada ramal se dibuja EXACTAMENTE donde está. No hay separación automática:
    // movía las líneas de su sitio real y en las curvas llegaba a cruzarlas. Para que
    // dos fibras no se pisen, el dibujo impide acercarse a menos del umbral.
    const porFibra = new Map();
    segmentos.forEach(seg => {
      if (!porFibra.has(seg.idOriginal)) porFibra.set(seg.idOriginal, []);
      porFibra.get(seg.idOriginal).push(seg);
    });

    const lineasFibra = [];
    porFibra.forEach((segs, idFibra) => {
      const positions = [[segs[0].coordA.lat, segs[0].coordA.lng]];
      segs.forEach(seg => positions.push([seg.coordB.lat, seg.coordB.lng]));
      lineasFibra.push({ id: idFibra, capacidad: segs[0].capacidad, datos: segs[0], positions });
    });

    // Vértices a los que se puede imantar un poste al moverlo. Salen de los extremos
    // de cada segmento ya resuelto, así sirve igual para fibras nuevas y viejas.
    const vistos = new Set();
    const verticesSnap = [];
    segmentos.forEach(seg => {
      [seg.coordA, seg.coordB].forEach(c => {
        if (!c) return;
        const k = `${c.lat.toFixed(7)},${c.lng.toFixed(7)}`;
        if (vistos.has(k)) return;
        vistos.add(k);
        verticesSnap.push({ lat: c.lat, lng: c.lng });
      });
    });

    return {
      lineasFibra,
      etiquetasFibra: etiquetas,
      verticesSnap
    };
  }, [conexionesVisiblesMapa, puntosVisiblesMapa]);

  // Dentro del modo de líneas, la fibra solo se dibuja "en modo" cuando es ella la
  // que se está trazando; con el acero activo se ve como fuera del modo.
  const modoAcero = modoFibra && modoLinea === 'acero';
  const modoFibraLinea = modoFibra && !modoAcero;

  // CABLES DE ACERO: poste a poste, gris acero punteado sobre un contorno oscuro, para
  // leerse sobre el satélite sin parecerse a ninguna fibra (van de color y sin contorno).
  const coordPoste = (id) => {
    const p = puntosVisiblesMapa.find(x => String(x.id) === String(id));
    return p?.coords?.lat != null ? [p.coords.lat, p.coords.lng] : null;
  };
  const tramoAceroEnCurso = modoAcero && trazoAcero.postes.length === 2 ? trazoAcero.postes.map(coordPoste) : null;
  // Fibras apoyadas: las del cable elegido en la lista o, si no hay, las que se van
  // marcando en el trazo. Se ven gruesas y sin puntear.
  const trazandoAcero = modoAcero && dibujandoFibra;
  const fibrasApoyadas = new Set(!modoAcero ? []
    : cableAceroSeleccionado ? (cableAceroSeleccionado.fibras || []).map(String)
    : trazoAcero.fibras);
  const capaAcero = (
    <>
      {lineasAcero.map(c => {
        const sel = cableAceroSeleccionado && String(cableAceroSeleccionado.id) === String(c.id);
        const pos = [[c.a.coords.lat, c.a.coords.lng], [c.b.coords.lat, c.b.coords.lng]];
        return (
          <React.Fragment key={`ac-${c.id}`}>
            <Polyline positions={pos} interactive={false} pathOptions={{ color: '#0f172a', weight: sel ? 9 : 6, opacity: 0.85 }} />
            <Polyline positions={pos} interactive={false} pathOptions={{ color: sel ? '#fbbf24' : '#e2e8f0', weight: sel ? 5 : 3, dashArray: '4,5' }} />
          </React.Fragment>
        );
      })}
      {tramoAceroEnCurso && tramoAceroEnCurso.every(Boolean) && (
        <Polyline positions={tramoAceroEnCurso} interactive={false} pathOptions={{ color: '#fbbf24', weight: 4, dashArray: '10,6', opacity: 0.95 }} />
      )}
      {/* Tipo y metros a mitad del vano, solo mientras se trabaja con el acero */}
      {modoAcero && lineasAcero.map(c => (
        <Marker
          key={`acl-${c.id}`}
          position={[(c.a.coords.lat + c.b.coords.lat) / 2, (c.a.coords.lng + c.b.coords.lng) / 2]}
          interactive={false}
          zIndexOffset={400}
          icon={L.divIcon({
            className: '',
            html: `<div style="white-space:nowrap; font-size:10px; font-weight:900; color:#e2e8f0; transform:translate(-50%,-50%); text-shadow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000,1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;">${escaparHtml(`${c.nombreTipo} · ${c.metros} m`)}</div>`,
            iconSize: [0, 0], iconAnchor: [0, 0]
          })}
        />
      ))}
    </>
  );

  return (
    <div className="h-full w-full relative z-0">
      <style>{`
        @keyframes pulse-blue { 0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.5); } 70% { box-shadow: 0 0 0 15px rgba(37, 99, 235, 0); } 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); } }

        /* Dibujando fibra: el puntero es un círculo del color de la capacidad, del
           tamaño de un poste, para ver dónde va a caer el vértice libre.
           Sobre un poste vuelve a ser la flecha y el poste se resalta, porque ahí el
           vértice se clava en la coordenada del poste y no donde está el ratón.
           Solo aplica en PC: en el celular no hay puntero. */
        .leaflet-container.fibra-dibujando { cursor: ${cursorVertice}; }
        .leaflet-container.fibra-dibujando .custom-icon { cursor: default; }
        .leaflet-container.fibra-dibujando .custom-icon:hover {
          /* filter no altera el transform con el que Leaflet posiciona el marcador */
          filter: drop-shadow(0 0 3px #fff) drop-shadow(0 0 9px ${colorTrazo});
        }
      `}</style>

      {gpsError && (
        <div className="absolute top-4 right-4 z-[5000] animate-in fade-in slide-in-from-right-2">
          <button onClick={reintentarGPS} className="bg-red-500/90 hover:bg-red-600 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl border border-white/20 transition-all active:scale-95 cursor-pointer">
            <MapPinOff size={14} />
            <span>Sin GPS. Toca para reintentar</span>
          </button>
        </div>
      )}

      {/* Las etiquetas no se apagaron: están ocultas porque de lejos se pisan entre sí.
          Se avisa para que nadie las dé por perdidas y las vuelva a tocar. */}
      {etiquetasOcultas && (
        <div className="absolute bottom-2 right-2 z-[5000] px-2 py-1 rounded-md bg-black/70 text-white text-[10px] font-bold pointer-events-none max-w-[60vw]">
          Etiquetas activas, ocultas por el zoom. Acercá para verlas.
        </div>
      )}

      {/* TEMPORAL: el nivel de zoom, para decidir a partir de qué distancia se agrupan
          los postes y se simplifica el dibujo. Se quita cuando estén fijados. */}
      {mostrarZoom && (
        <div className="absolute bottom-2 left-2 z-[5000] px-2 py-0.5 rounded-md bg-black/70 text-white text-[11px] font-black tracking-wider pointer-events-none">
          ZOOM {Number(viewState?.zoom ?? 0).toFixed(1)}
        </div>
      )}

      {/* iPhone: la brújula solo se habilita si el usuario la autoriza con un toque */}
      {estadoBrujula === 'permiso' && (
        <div className="absolute top-16 right-4 z-[5000] animate-in fade-in slide-in-from-right-2">
          <button onClick={pedirPermiso} className="bg-blue-600/90 hover:bg-blue-700 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xl border border-white/20 transition-all active:scale-95 cursor-pointer">
            <Compass size={14} />
            <span>Activar brújula</span>
          </button>
        </div>
      )}

      {/* Marco que recorta y, dentro, lo que gira. Sin giro es exactamente el mapa de
          siempre; girado pasa a ser un cuadrado más grande que la pantalla (150vmax
          cubre cualquier ángulo) para que no aparezcan esquinas vacías. */}
      <div ref={marcoRef} className="absolute inset-0 overflow-hidden"
        onTouchStart={alEmpezarGesto} onTouchMove={alMoverGesto} onTouchEnd={alTerminarGesto} onTouchCancel={alTerminarGesto}>
      {/* Mientras el giro esté habilitado, el mapa se dibuja SIEMPRE cuadrado y más
          grande que la pantalla: si solo se agrandara al torcerlo, al empezar a girar
          aparecerían esquinas vacías a mitad del gesto. */}
      <div ref={rotanteRef} style={setGiro
        ? { position: 'absolute', left: '50%', top: '50%', width: '150vmax', height: '150vmax', transform: `translate(-50%, -50%) rotate(${giroEfectivo}deg)`, transformOrigin: '50% 50%' }
        : { position: 'absolute', inset: 0 }}>
      <MapContainer center={viewState.center} zoom={viewState.zoom} maxZoom={22} style={{ height: "100%", width: "100%" }} zoomControl={false}>
        {mapStyle === 'vector' && (
          <TileLayer attribution='© OpenStreetMap contributors © CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={22} maxNativeZoom={20} />
        )}
        {mapStyle === 'google' && (
          <>
            <TileLayer
              attribution='© Google Maps'
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              maxZoom={22}
              maxNativeZoom={21}
              eventHandlers={makeTileHandlers('google')}
            />
            {/* Capa de nombres de calles (CARTO solo etiquetas, sin negocios ni POIs) */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={22}
              maxNativeZoom={20}
              opacity={0.9}
            />
          </>
        )}

        <MapController
          centrarEnCoord={centrarEnCoord}
          dibujandoFibra={modoFibraLinea && dibujandoFibra}
          gpsTrigger={gpsTrigger}
          miUbicacion={miUbicacion}
          setViewState={setViewState}
          handleMapaClick={handleMapaClick}
          giro={giroEfectivo}
          giroRef={giroVivoRef}
          reintentarGPS={reintentarGPS}
          yaSaltoAlInicio={yaSaltoAlInicio}
          setYaSaltoAlInicio={setYaSaltoAlInicio}
        />

        {miUbicacion && <Marker ref={marcadorUsuarioRef} position={miUbicacion} icon={userIcon} zIndexOffset={9999} />}

        {/* Cables de acero por DEBAJO de las fibras, salvo mientras se trabaja con ellos:
            comparten postes y el contorno oscuro taparía el color de la fibra */}
        <Pane name="acero-bajo" style={{ zIndex: 395 }}>{!modoAcero && capaAcero}</Pane>

        {/* Renderizado de conexiones/fibras */}
        {lineasFibra.map(f => {
          const isSelCon = conexionSeleccionada && String(conexionSeleccionada.id) === String(f.id);
          // Si se está probando otra capacidad en el editor, la línea toma ese color
          // al momento, aunque todavía no se haya guardado.
          const capacidad = (previewFibra && String(previewFibra.id) === String(f.id) && previewFibra.capacidad != null)
            ? previewFibra.capacidad
            : (f.capacidad || 12);
          const colorFibra = getColorFibra(capacidad);

          // Apoyada en el cable de acero que se traza (o en el elegido): gruesa y continua
          const apoyada = fibrasApoyadas.has(String(f.id));

          return (
            <React.Fragment key={f.id}>
              <Polyline
                positions={f.positions}
                pathOptions={{
                  // Seleccionada = más gruesa, nunca de otro color: el color ES el dato
                  // (la capacidad), y pintarla de rojo tapaba justo lo que se está editando.
                  color: colorFibra,
                  weight: isSelCon || apoyada ? 7 : (modoFibraLinea ? 4 : 3),
                  dashArray: modoFibraLinea || apoyada ? undefined : '8,8',
                  opacity: isSelCon || apoyada ? 1 : (modoFibraLinea ? 0.95 : 1.0),
                  ...(modoFibraLinea && (capacidad === 1) ? { className: 'fibra-blanca' } : {})
                }}
                eventHandlers={modoFibraLinea && !dibujandoFibra ? {
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    if (handleConexionClick) handleConexionClick({ ...f.datos, id: f.id });
                  }
                } : {}}
              />
              {/* Trazando acero, la fibra se toca para marcarla como apoyada. La línea
                  visible es fina y punteada: esta, invisible y ancha, recibe el toque. */}
              {trazandoAcero && (
                <Polyline
                  positions={f.positions}
                  pathOptions={{ color: '#000', opacity: 0, weight: 22 }}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      onTocarFibraAcero?.(f.id);
                    }
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

        <Pane name="acero-sobre" style={{ zIndex: 405 }}>{modoAcero && capaAcero}</Pane>

        {/* Controlador del marcador arrastrable (nativo Leaflet) */}
        <DragMoverController
          modoMover={modoMover}
          puntoSeleccionado={puntoSeleccionado}
          puntosVisiblesMapa={puntosVisiblesMapa}
          iconSize={iconSize}
          obtenerColorDia={obtenerColorDia}
          onPuntoDragEnd={onPuntoDragEnd}
          verticesSnap={verticesSnap}
        />

        {/* Burbujas: de lejos, los puntos que caen juntos se muestran como uno con su
            cantidad. Nunca mezclan clases y jamás agrupan lo que está en juego. */}
        {gruposPuntos.map(g => (
          <Marker
            key={g.id}
            position={[g.centro.lat, g.centro.lng]}
            icon={iconoGrupo(g)}
            eventHandlers={{
              click: (e) => { L.DomEvent.stopPropagation(e); acercarAGrupo(e, g); }
            }}
          />
        ))}

        {/* Renderizado de puntos. De lejos se dibujan solo los SUELTOS: los demás
            viajan dentro de una burbuja. El arrastre y el imantado siguen recibiendo
            la lista completa, que para eso no depende de lo que se ve. */}
        {puntosSueltos.map(p => {
          // El punto seleccionado en modo mover se maneja por DragMoverController
          if (modoMover && p.id === puntoSeleccionado) return null;
          // Con la simbología encendida el color sale del armado del punto; sin
          // armado o sin color asignado, gris. Sustituye al color del día.
          const colorDia = simbologiaActiva
            ? (coloresArmado[p.datos?.armadoSeleccionadoId] || '#9ca3af')
            : obtenerColorDia(p.diaId);
          const isSelected = !modoMoverPuntos && puntoSeleccionado === p.id;
          // En el trazo en curso: vértice de la fibra, o poste o medio tramo del acero
          const isInRecorrido = modoFibra && dibujandoFibra && (modoAcero
            ? (trazoAcero.postes.includes(String(p.id)) || trazoAcero.medioTramo === String(p.id))
            : puntosRecorrido.some(v => v && String(v.puntoId) === String(p.id)));
          const isEnSeleccion = modoMoverPuntos && puntosSeleccionadosMover.includes(p.id);
          // Corrigiendo: TODOS los puntos muestran su posición actual (hace falta para
          // poder elegir el ancla). Los marcados muestran en cambio el orden en que se
          // tocaron, que es el orden en que se van a insertar.
          // Poste que el ajuste va a mover: se pinta ámbar para poder calibrar el
          // umbral viendo el efecto antes de aplicarlo.
          const enAjuste = previewAjuste.some(a => String(a.id) === String(p.id));
          // Verde = no hay nada que ajustar: o es vértice del ramal, o ya está encima
          // de la línea aunque nunca se registrara como vértice.
          const ancladoAFibra = modoAjuste && !enAjuste &&
            (postesEnFibra.has(String(p.id)) || apoyadosAjuste.some(id => String(id) === String(p.id)));
          const marcaCorr = modoCorregir ? (correccionSel.indexOf(p.id) + 1) : 0;
          // Al retomar, los ya ordenados llevan su número original y lo tocado
          // después sigue contando a partir de ellos.
          const idxPrefijo = prefijoOrden.indexOf(p.id);
          const idxSel = ordenSeleccion.indexOf(p.id);
          const posOrden = modoCorregir
            ? (marcaCorr > 0 ? marcaCorr : ordenTrabajo.indexOf(p.id) + 1)
            : (modoOrdenar
              ? (idxPrefijo >= 0 ? idxPrefijo + 1 : (idxSel >= 0 ? prefijoOrden.length + idxSel + 1 : 0))
              : 0);
          const isEnOrden = posOrden > 0;
          const te = p.datos?.tipoElemento;
          const tiposArr = Array.isArray(te) ? te : (te ? [te] : []);
          const isMedioTramo = tiposArr.includes('medioTramo');
          const isCajaEquipo = !isMedioTramo && ['mufa', 'xbox', 'hbox', 'fat'].some(x => tiposArr.includes(x));
          const isBorrador = p.datos?.estado === 'borrador'; // punto sin terminar (aún no confirmado)
          // Reducción de tamaño por forma, en "toques de lupa" (cada toque = 0.2):
          // cuadrado −2, triángulo −1, círculo −1.
          const reduccionForma = isCajaEquipo ? 0.4 : 0.2;
          const multForma = Math.max(0.4, iconSize - reduccionForma);
          const baseSize = (isEnOrden ? 30 : 24) * multForma;
          const bg = enAjuste ? '#f59e0b' : ancladoAFibra ? '#16a34a' : marcaCorr > 0 ? '#ea580c' : isEnOrden ? '#16a34a' : (isEnSeleccion ? '#a855f7' : colorDia);
          const bord = enAjuste ? '4px solid #b45309' : ancladoAFibra ? '4px solid #15803d' : marcaCorr > 0 ? '4px solid #9a3412' : isEnOrden ? '4px solid #15803d' : isEnSeleccion ? '4px solid #7c3aed' : (isInRecorrido || isSelected) ? '4px solid #facc15' : '2px solid white';
          const numOrdenHtml = isEnOrden ? `<span style="color:white; font-weight:900; font-size:${Math.max(9, Math.round(baseSize * 0.5))}px; line-height:1;">${posOrden}</span>` : '';
          const labelHtml = (() => {
            const showItem = etiquetasVisibles?.item;
            const showPasivo = etiquetasVisibles?.pasivo;
            if (!showItem && !showPasivo) return '';
            const limpio = (x) => { const s = (x == null ? '' : x).toString().trim(); return (s && s !== '-') ? s : null; };
            const partes = [];
            if (showItem) { const v = limpio(p.datos.numero); if (v) partes.push(v); }
            if (showPasivo) { const v = limpio(p.datos.pasivo); if (v) partes.push(v); }
            if (partes.length === 0) return ''; // sin datos → sin globito
            const bgLabel = isMedioTramo ? '#facc15' : isCajaEquipo ? '#22c55e' : '#ffffff';
            const fgLabel = isMedioTramo ? '#000000' : isCajaEquipo ? '#000000' : '#333333';
            // El ícono gira con el mapa, pero el globito NO: se contra-gira tomando
            // como eje el CENTRO del ícono, que es donde está la coordenada real. Por
            // eso cuelga de un punto sin tamaño puesto en ese centro: así queda
            // horizontal y siempre encima del poste, en vez de orbitar a su alrededor.
            const alto = Math.round(baseSize / 2) + 4;
            return `<div style="position:absolute; left:50%; top:50%; width:0; height:0; transform:rotate(${(-giroEfectivo).toFixed(1)}deg);">
              <div style="position: absolute; bottom: ${alto}px; left: 0; transform: translateX(-50%); background: ${bgLabel}; color: ${fgLabel}; padding: 2px 5px; border-radius: 4px; font-size: 9px; font-weight: 800; border: 2px solid black; white-space: nowrap; z-index: 1000;">${partes.join(' - ')}</div>
            </div>`;
          })();
          let customIcon;
          if (isMedioTramo) {
            // Medio tramo: triángulo SIEMPRE amarillo (sin importar el día). El borde refleja selección/orden.
            const half = baseSize / 2;
            const t = Math.max(2, Math.round(baseSize * 0.16));
            const outline = enAjuste ? '#b45309' : ancladoAFibra ? '#15803d' : marcaCorr > 0 ? '#9a3412'
              : isEnOrden ? '#15803d' : isEnSeleccion ? '#7c3aed' : (isInRecorrido || isSelected) ? '#ea580c' : '#1e293b';
            // El relleno amarillo se sustituye para que el estado se vea de lejos
            const rellenoMT = enAjuste ? '#f59e0b' : ancladoAFibra ? '#16a34a' : marcaCorr > 0 ? '#ea580c'
              : simbologiaActiva ? colorDia : '#facc15';
            customIcon = L.divIcon({
              className: isBorrador ? 'custom-icon punto-borrador' : 'custom-icon',
              html: `<div style="position:relative; width:${baseSize}px; height:${baseSize}px;">
                          ${labelHtml}
                          <div style="position:absolute; left:0; bottom:0; width:0; height:0; border-left:${half}px solid transparent; border-right:${half}px solid transparent; border-bottom:${baseSize}px solid ${outline};"></div>
                          <div style="position:absolute; left:${t}px; bottom:${Math.round(t * 0.6)}px; width:0; height:0; border-left:${half - t}px solid transparent; border-right:${half - t}px solid transparent; border-bottom:${baseSize - Math.round(t * 1.8)}px solid ${rellenoMT};"></div>
                          ${isEnOrden ? `<div style="position:absolute; left:0; bottom:0; width:${baseSize}px; height:${baseSize}px; display:flex; align-items:flex-end; justify-content:center; padding-bottom:1px;"><span style="color:#000; font-weight:900; font-size:${Math.max(8, Math.round(baseSize * 0.36))}px; line-height:1;">${posOrden}</span></div>` : ''}
                        </div>`,
              iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2]
            });
          } else if (isCajaEquipo) {
            // Mufa/Xbox/Hbox/Fat: cuadrado SIEMPRE rojo con borde y punto negro (sin importar el día).
            const bw = Math.max(2, Math.round(baseSize * 0.14));
            const dot = Math.max(4, Math.round(baseSize * 0.28));
            const ring = enAjuste ? '#b45309' : ancladoAFibra ? '#15803d' : marcaCorr > 0 ? '#9a3412'
              : isEnOrden ? '#15803d' : isEnSeleccion ? '#a855f7' : (isInRecorrido || isSelected) ? '#f97316' : null;
            const rellenoCaja = enAjuste ? '#f59e0b' : marcaCorr > 0 ? '#ea580c'
              : simbologiaActiva ? colorDia : '#22c55e';
            customIcon = L.divIcon({
              className: isBorrador ? 'custom-icon punto-borrador' : 'custom-icon',
              html: `<div style="position:relative; width:${baseSize}px; height:${baseSize}px; display:flex; align-items:center; justify-content:center;">
                          ${labelHtml}
                          <div style="width:${baseSize}px; height:${baseSize}px; box-sizing:border-box; background:${rellenoCaja}; border:${bw}px solid #000;${ring ? ` box-shadow:0 0 0 3px ${ring};` : ''} display:flex; align-items:center; justify-content:center;">
                            ${isEnOrden
                              ? `<span style="color:#fff; font-weight:900; font-size:${Math.max(9, Math.round(baseSize * 0.45))}px; line-height:1; text-shadow:0 1px 2px #000;">${posOrden}</span>`
                              : `<div style="width:${dot}px; height:${dot}px; background:#000; border-radius:50%;"></div>`}
                          </div>
                        </div>`,
              iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2]
            });
          } else {
            customIcon = L.divIcon({
              className: isBorrador ? 'custom-icon punto-borrador' : 'custom-icon',
              html: `<div style="width: ${baseSize}px; height: ${baseSize}px; background: ${bg}; border: ${bord}; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
                          ${numOrdenHtml}
                          ${labelHtml}
                        </div>`,
              iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2]
            });
          }
          return <Marker
            key={p.id}
            position={[p.coords.lat, p.coords.lng]}
            icon={customIcon}
            eventHandlers={{
              click: (e) => { L.DomEvent.stopPropagation(e); handlePuntoClick(e, p.id); }
            }}
          />
        })}

        {/* Etiquetas de las fibras. interactive={false} es importante: si capturaran
            el clic, taparían el mapa justo donde se van a poner vértices. */}
        {etiquetasVisibles?.fibra && etiquetasFibra.map(et => (
          <Marker
            key={`etf-${et.id}`}
            position={[et.pos.lat, et.pos.lng]}
            interactive={false}
            zIndexOffset={400}
            icon={L.divIcon({
              className: '',
              // El halo se hace con ocho sombras de 1px en vez de -webkit-text-stroke,
              // que adelgaza la letra y en tamaños chicos la vuelve ilegible.
              html: `<div style="white-space:nowrap; font-size:10px; font-weight:900; letter-spacing:0.3px; color:${et.color}; transform:translate(-50%,-50%) rotate(${anguloEtiquetaFibra(et.angulo, giroEfectivo)}deg); text-shadow:1px 0 0 #000,-1px 0 0 #000,0 1px 0 #000,0 -1px 0 #000,1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000;">${escaparHtml(et.texto)}</div>`,
              iconSize: [0, 0], iconAnchor: [0, 0]
            })}
          />
        ))}

        {/* Hacia dónde se moverá cada poste: línea punteada del sitio actual al
            punto de apoyo sobre la fibra. */}
        {previewAjuste.map(a => (
          <Polyline
            key={`aj-${a.id}`}
            positions={[[a.antes.lat, a.antes.lng], [a.destino.lat, a.destino.lng]]}
            pathOptions={{ color: '#f59e0b', weight: 3, dashArray: '4,4', opacity: 0.95 }}
            interactive={false}
          />
        ))}

        {/* Polylines temporales del trazo de fibra actual */}
        {modoFibra && dibujandoFibra && puntosRecorrido.length >= 2 && puntosRecorrido.slice(0, -1).map((vA, idx) => {
          const vB = puntosRecorrido[idx + 1];
          if (vA?.lat == null || vB?.lat == null) return null;
          return <Polyline
            key={`rec-${idx}`}
            positions={[[vA.lat, vA.lng], [vB.lat, vB.lng]]}
            pathOptions={{ color: getColorFibra(capacidadFibra), weight: 5, opacity: 0.9 }}
          />;
        })}

        {/* Marcas de los vértices LIBRES del trazo en curso (los que no caen sobre
            un poste no tendrían nada que los señale) */}
        {modoFibra && puntosRecorrido.map((v, idx) => (v && v.lat != null && !v.puntoId) ? (
          <Marker
            key={`vert-${idx}`}
            position={[v.lat, v.lng]}
            icon={L.divIcon({
              className: '',
              html: `<div style="width:14px;height:14px;border-radius:50%;background:${getColorFibra(capacidadFibra)};border:3px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.4)"></div>`,
              iconSize: [14, 14], iconAnchor: [7, 7]
            })}
            zIndexOffset={500}
          />
        ) : null)}

        {/* Polylines del trazo terminado pero no guardado */}
        {modoFibra && !dibujandoFibra && puntosRecorrido.length >= 2 && puntosRecorrido.slice(0, -1).map((vA, idx) => {
          const vB = puntosRecorrido[idx + 1];
          if (vA?.lat == null || vB?.lat == null) return null;
          return <Polyline
            key={`pending-${idx}`}
            positions={[[vA.lat, vA.lng], [vB.lat, vB.lng]]}
            pathOptions={{ color: getColorFibra(capacidadFibra), weight: 5, dashArray: '12,6', opacity: 0.7 }}
          />;
        })}

        {puntoTemporal && <Marker position={[puntoTemporal.lat, puntoTemporal.lng]} icon={tempIcon} zIndexOffset={1000} />}

        {/* Marcadores de fotos guardadas (capa activable) */}
        {fotoPuntosActivo && fotosConCoordenadas.map(foto => {
          const fotoIcon = L.divIcon({
            className: '',
            html: `<div style="width:32px;height:32px;background:#7c3aed;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          return (
            <Marker
              key={foto.id}
              position={[foto.lat, foto.lng]}
              icon={fotoIcon}
              zIndexOffset={500}
              eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); onFotoMarkerClick?.(foto); } }}
            />
          );
        })}

        {/* Punto resaltado para asociación */}
        {puntoResaltado && (() => {
          const p = puntosVisiblesMapa.find(pt => pt.id === puntoResaltado);
          if (!p) return null;
          const baseSize = 28 * iconSize;
          const resaltadoIcon = L.divIcon({
            className: '',
            html: `<div style="width:${baseSize}px;height:${baseSize}px;background:${obtenerColorDia(p.diaId)};border:4px solid #facc15;border-radius:50%;box-shadow:0 0 0 4px rgba(250,204,21,0.4),0 2px 8px rgba(0,0,0,0.5);"></div>`,
            iconSize: [baseSize, baseSize],
            iconAnchor: [baseSize / 2, baseSize / 2],
          });
          return <Marker key={`res-${p.id}`} position={[p.coords.lat, p.coords.lng]} icon={resaltadoIcon} zIndexOffset={2000} />;
        })()}
      </MapContainer>
      </div>
      </div>
    </div>
  );
};

// ─── MINI-MAPA de revisión (read-only): centra en el punto activo, etiqueta los
// postes por ITEM y resalta el que se está revisando. Se embebe en el visor. ───
const RecenterMini = ({ center }) => {
  const map = useMap();
  useEffect(() => { const t = setTimeout(() => map.invalidateSize(), 60); return () => clearTimeout(t); }, [map]);
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center && center[0], center && center[1]]); // eslint-disable-line
  return null;
};

export const MiniMapaRevision = ({ puntos = [], puntoActivo }) => {
  const conCoords = (puntos || []).filter(p => p.coords && p.coords.lat != null && p.coords.lng != null);
  const c = puntoActivo && puntoActivo.coords;
  if (!c || c.lat == null || c.lng == null) {
    return <div className="h-full w-full flex items-center justify-center bg-slate-100 text-slate-400 text-sm font-bold">Este punto no tiene ubicación</div>;
  }
  const center = [c.lat, c.lng];
  return (
    <MapContainer center={center} zoom={19} maxZoom={22} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
      {/* Base: Google Maps satélite + capa de etiquetas de calles */}
      <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" maxZoom={22} maxNativeZoom={21} />
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={22} maxNativeZoom={20} opacity={0.9} />
      <RecenterMini center={center} />
      {conCoords.map(p => {
        const activo = puntoActivo && p.id === puntoActivo.id;
        const label = (p.datos && p.datos.numero) || '';
        const dot = activo ? 20 : 12;
        const icon = L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-${dot / 2}px);">
              <div style="width:${dot}px;height:${dot}px;background:${activo ? '#f97316' : '#3b82f6'};border:2px solid #fff;border-radius:50%;box-shadow:${activo ? '0 0 0 4px rgba(249,115,22,.35),' : ''}0 1px 3px rgba(0,0,0,.5);"></div>
              ${label ? `<span style="font-size:9px;font-weight:800;color:#111;background:rgba(255,255,255,.85);border-radius:3px;padding:0 3px;margin-top:1px;white-space:nowrap;line-height:1.3;">${label}</span>` : ''}
            </div>`,
          iconSize: [60, dot + 16],
          iconAnchor: [30, dot / 2],
        });
        return <Marker key={p.id} position={[p.coords.lat, p.coords.lng]} icon={icon} zIndexOffset={activo ? 2000 : 0} />;
      })}
    </MapContainer>
  );
};
