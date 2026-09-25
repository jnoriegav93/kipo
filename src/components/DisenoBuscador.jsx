import { useState, useRef } from 'react';
import { Search, Loader2, X, MapPin } from 'lucide-react';

/* Buscador de lugares del modo Diseño: ciudad, distrito, localidad o calle, como
   el de Google Maps. Solo mueve el mapa; no trae nada al diseño.

   Usa Nominatim, el geocodificador de OpenStreetMap que Kipo ya usa para ponerle
   dirección a los puntos. Sus reglas de uso no permiten buscar a cada tecla, así
   que se busca al pulsar Enter o la lupa. */

const BASE = import.meta.env.DEV ? '/api/nominatim' : 'https://nominatim.openstreetmap.org';

const buscarLugares = async (texto, mapa, signal) => {
  const params = new URLSearchParams({ format: 'json', q: texto, limit: '6', 'accept-language': 'es' });
  // Prefiere lo cercano a la vista actual, sin descartar lo demás
  const b = mapa.getBounds();
  params.set('viewbox', [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()].join(','));
  params.set('bounded', '0');
  const r = await fetch(`${BASE}/search?${params}`, { signal });
  if (!r.ok) throw new Error(`Nominatim respondió ${r.status}`);
  return r.json();
};

// `clase`: el ancho (en el celular va a lo ancho, sobre el mapa). `alElegir`: al ir a un
// lugar, para que quien lo abrió lo cierre.
export default function DisenoBuscador({ mapa, clase = 'w-72 max-w-[40vw]', autoFocus = false, alElegir }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('inactivo');   // inactivo | buscando | resultados | vacio | error
  const [resultados, setResultados] = useState([]);
  const pedido = useRef(null);

  const buscar = async () => {
    const q = texto.trim();
    if (q.length < 2 || !mapa || estado === 'buscando') return;
    pedido.current?.abort();
    const control = new AbortController();
    pedido.current = control;
    setEstado('buscando');
    try {
      const lista = await buscarLugares(q, mapa, control.signal);
      setResultados(lista);
      setEstado(lista.length ? 'resultados' : 'vacio');
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error('No se pudo buscar el lugar', e);
      setEstado('error');
    }
  };

  const cerrar = () => { pedido.current?.abort(); setEstado('inactivo'); };

  // Nominatim da la caja del lugar: una ciudad se ve entera y una calle, de cerca
  const ir = (lugar) => {
    const [sur, norte, oeste, este] = (lugar.boundingbox || []).map(Number);
    if ([sur, norte, oeste, este].every(Number.isFinite)) {
      mapa.fitBounds([[sur, oeste], [norte, este]], { maxZoom: 18 });
    } else {
      mapa.setView([Number(lugar.lat), Number(lugar.lon)], 17);
    }
    setTexto(lugar.display_name.split(',')[0]);
    setEstado('inactivo');
    alElegir?.();
  };

  const abierto = estado === 'resultados' || estado === 'vacio' || estado === 'error';

  return (
    <div className={`relative shrink-0 ${clase}`}>
      <form
        onSubmit={(e) => { e.preventDefault(); buscar(); }}
        className="h-10 flex items-center rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-alto)] focus-within:border-brand-500 transition-colors"
      >
        <input
          autoFocus={autoFocus}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') cerrar(); }}
          placeholder="Buscar ciudad, distrito o calle"
          className="flex-1 min-w-0 h-full bg-transparent pl-3 text-sm font-bold outline-none placeholder:text-[var(--d-suave)]"
        />
        <button
          type="submit"
          disabled={texto.trim().length < 2 || estado === 'buscando'}
          title="Buscar"
          className="w-10 h-full flex items-center justify-center text-[var(--d-suave)] hover:text-[var(--d-texto)] disabled:opacity-40"
        >
          {estado === 'buscando' ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={2.5} />}
        </button>
      </form>

      {abierto && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-[1100] rounded-xl border-2 border-[var(--d-borde)] bg-[var(--d-panel)] shadow-2xl overflow-hidden">
          {estado === 'resultados' && resultados.map(lugar => {
            const [nombre, ...resto] = lugar.display_name.split(',');
            return (
              <button
                key={lugar.place_id}
                onClick={() => ir(lugar)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/5 border-b border-[var(--d-borde)]"
              >
                <MapPin size={14} className="text-brand-500 shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-black truncate">{nombre}</span>
                  <span className="block text-[11px] font-bold text-[var(--d-suave)] truncate">{resto.join(',').trim()}</span>
                </span>
              </button>
            );
          })}
          {estado === 'vacio' && (
            <p className="px-3 py-3 text-[11px] font-bold text-[var(--d-suave)] border-b border-[var(--d-borde)]">No se encontró ese lugar.</p>
          )}
          {estado === 'error' && (
            <p className="px-3 py-3 text-[11px] font-bold text-red-400 border-b border-[var(--d-borde)]">No se pudo buscar. ¿Hay internet?</p>
          )}
          <div className="h-8 px-3 flex items-center justify-between">
            <span className="text-[9px] font-bold text-[var(--d-suave)]">Datos © OpenStreetMap</span>
            <button onClick={cerrar} className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[var(--d-suave)] hover:text-[var(--d-texto)]">
              <X size={11} /> Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
