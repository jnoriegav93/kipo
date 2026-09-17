// ── RUMBO DE LA BRÚJULA ───────────────────────────────────────────────────────
// Convierte lo que informa el teléfono en un rumbo de 0 a 360 grados, donde 0 es
// el norte y crece hacia el este, como una brújula de verdad. Sirve para el cono
// del punto azul: hacia dónde está mirando el técnico.
//
// Cada sistema lo entrega distinto:
//   iPhone  → `webkitCompassHeading`: ya viene como rumbo (0 = norte, crece al este).
//   Android → `alpha`: cuánto giró el aparato hacia la IZQUIERDA desde el norte,
//             así que el rumbo es 360 − alpha.
//
// Un evento que no sea absoluto (`absolute === false`) no sirve: dice cuánto giraste
// desde que empezaste a mirar, no hacia dónde mirás. En ese caso no hay cono.
//
// La app está bloqueada en vertical (`orientation: 'portrait'` en el manifiesto),
// pero en el navegador la pantalla sí puede girar: por eso se le puede restar el
// ángulo de la pantalla.

export const SIN_RUMBO = null;

export const normalizarGrados = (g) => {
  if (typeof g !== 'number' || Number.isNaN(g)) return SIN_RUMBO;
  return ((g % 360) + 360) % 360;
};

export const rumboDesdeEvento = (evento, anguloPantalla = 0) => {
  if (!evento) return SIN_RUMBO;
  // iPhone: ya es un rumbo hecho y derecho
  const brujula = evento.webkitCompassHeading;
  if (typeof brujula === 'number' && !Number.isNaN(brujula)) return normalizarGrados(brujula);
  // Android: alpha, y solo si es absoluto (medido contra el norte)
  const alpha = evento.alpha;
  if (typeof alpha !== 'number' || Number.isNaN(alpha)) return SIN_RUMBO;
  if (evento.absolute === false) return SIN_RUMBO;
  return normalizarGrados(360 - alpha - (anguloPantalla || 0));
};

// Diferencia más corta entre dos rumbos, de −180 a 180. Cruzar el norte (de 350 a
// 10) son 20 grados hacia la derecha, no 340 hacia la izquierda.
export const diferenciaGrados = (desde, hasta) => {
  const a = normalizarGrados(desde), b = normalizarGrados(hasta);
  if (a === SIN_RUMBO || b === SIN_RUMBO) return 0;
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

// El rumbo del teléfono tiembla: la brújula salta unos grados aunque estés quieto.
// Esto acerca el valor mostrado al real por el camino corto, para que el cono no
// vibre. Con factor 1 sigue al instante; con 0.2 se mueve suave.
export const suavizarRumbo = (actual, nuevo, factor = 0.25) => {
  const destino = normalizarGrados(nuevo);
  if (destino === SIN_RUMBO) return normalizarGrados(actual);
  const desde = normalizarGrados(actual);
  if (desde === SIN_RUMBO) return destino;          // primer valor: sin suavizar
  const f = Math.min(1, Math.max(0, factor));
  const d = diferenciaGrados(desde, destino);
  // Cuando ya casi llegó se fija el valor exacto. Si no, como cada paso es una
  // fracción de lo que falta, el cono se quedaría para siempre unos grados corrido.
  if (Math.abs(d) < 0.5) return destino;
  return normalizarGrados(desde + d * f);
};

// ¿Vale la pena redibujar? Mover el cono por menos de un grado no se ve y obliga a
// repintar: se ignora.
export const cambioNotorio = (actual, nuevo, minimo = 1) => {
  if (normalizarGrados(actual) === SIN_RUMBO) return normalizarGrados(nuevo) !== SIN_RUMBO;
  if (normalizarGrados(nuevo) === SIN_RUMBO) return false;
  return Math.abs(diferenciaGrados(actual, nuevo)) >= minimo;
};

// iOS exige pedir permiso con un toque del usuario; Android no pide nada.
export const necesitaPermisoBrujula = (win = globalThis) =>
  typeof win?.DeviceOrientationEvent?.requestPermission === 'function';
