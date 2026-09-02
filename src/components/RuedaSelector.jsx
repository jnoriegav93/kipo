import React from 'react';

// Selector tipo rueda, como el de fechas del sistema.
// Va sobre scroll nativo con scroll-snap en vez de arrastre a mano: así hereda la
// inercia y el rebote del propio teléfono, y no hay que escribir gestos.
// Un <select> largo era el problema anterior: en móvil abre una lista a pantalla
// completa y con doscientos postes se desbordaba.
export default function RuedaSelector({
  items = [],            // [{ valor, etiqueta }]
  valor,
  onChange,
  isDark = false,
  itemAlto = 38,
  visibles = 5,          // filas a la vista (impar, para que haya una central)
}) {
  const ref = React.useRef(null);
  const timer = React.useRef(null);
  const alto = itemAlto * visibles;
  const relleno = (alto - itemAlto) / 2;

  const indice = Math.max(0, items.findIndex(i => String(i.valor) === String(valor)));

  // Colocar la rueda en el valor actual. Sin animación: es la posición de partida,
  // no un movimiento que el usuario haya pedido.
  React.useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = indice * itemAlto;
    // Solo al montar y cuando cambia la lista: si siguiera al valor, cada scroll
    // se pelearía con el dedo del usuario.
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 'scrollend' todavía no está en todos lados, así que se espera a que pare.
  const alDesplazar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / itemAlto)));
      const destino = i * itemAlto;
      if (Math.abs(el.scrollTop - destino) > 1) el.scrollTo({ top: destino, behavior: 'smooth' });
      const item = items[i];
      if (item && String(item.valor) !== String(valor)) onChange?.(item.valor);
    }, 120);
  };

  const borde = isDark ? 'border-slate-600' : 'border-slate-300';
  const texto = isDark ? 'text-slate-100' : 'text-slate-800';
  const apagado = isDark ? 'text-slate-500' : 'text-slate-400';
  const fondo = isDark ? '#1e293b' : '#ffffff';

  return (
    <div className={`relative rounded-xl border-2 ${borde} overflow-hidden`} style={{ height: alto }}>
      <style>{`.rueda-kipo::-webkit-scrollbar{display:none}`}</style>

      {/* Banda central: marca cuál queda elegido */}
      <div
        className={`absolute left-0 right-0 pointer-events-none border-y-2 ${isDark ? 'border-blue-500/60 bg-blue-500/10' : 'border-blue-500/70 bg-blue-500/5'}`}
        style={{ top: relleno, height: itemAlto }}
      />

      {/* Difuminado arriba y abajo, para que la rueda parezca curvarse */}
      <div className="absolute inset-x-0 top-0 pointer-events-none z-10"
        style={{ height: relleno, background: `linear-gradient(${fondo}, ${fondo}00)` }} />
      <div className="absolute inset-x-0 bottom-0 pointer-events-none z-10"
        style={{ height: relleno, background: `linear-gradient(${fondo}00, ${fondo})` }} />

      <div
        ref={ref}
        onScroll={alDesplazar}
        className="rueda-kipo h-full overflow-y-auto"
        style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', paddingTop: relleno, paddingBottom: relleno }}
      >
        {items.map((it, i) => (
          <div
            key={it.valor}
            onClick={() => ref.current?.scrollTo({ top: i * itemAlto, behavior: 'smooth' })}
            className={`flex items-center justify-center font-black truncate px-2 cursor-pointer transition-colors ${i === indice ? `${texto} text-[15px]` : `${apagado} text-[13px]`}`}
            style={{ height: itemAlto, scrollSnapAlign: 'center' }}
          >
            {it.etiqueta}
          </div>
        ))}
      </div>
    </div>
  );
}
