// ── GIRAR EL MAPA ─────────────────────────────────────────────────────────────
// Leaflet no gira: da por sentado que el norte está arriba. El giro se hace
// torciendo el contenedor con CSS, y entonces hay que corregir a mano lo poco que
// eso descoloca. Todo lo de aquí es geometría pura, sin Leaflet ni React, para
// poder probarlo con Node.
//
// Convenio: `giro` son los grados que se torció el mapa en el sentido del reloj.
// Con giro 0 el norte está arriba, como siempre.
// La extensión va explícita para que Node pueda cargar este archivo en las pruebas
import { normalizarGrados, diferenciaGrados } from './rumbo.js';

const RAD = Math.PI / 180;

// ── El toque y la coordenada ──────────────────────────────────────────────────
// Lo más delicado de todo: el dedo cae en la pantalla YA girada, pero Leaflet
// convierte a coordenada como si nada se hubiera movido. Antes de entregarle el
// punto hay que des-girarlo alrededor del centro del mapa. Si esto falla, un poste
// nuevo se guarda corrido; por eso existe `ida y vuelta` en las pruebas.
export const desgirarPunto = (p, centro, giro) => {
  if (!p || !centro) return p;
  const g = normalizarGrados(giro) || 0;
  if (g === 0) return { x: p.x, y: p.y };
  const s = Math.sin(g * RAD), c = Math.cos(g * RAD);
  const dx = p.x - centro.x, dy = p.y - centro.y;
  return {
    x: centro.x + dx * c + dy * s,
    y: centro.y - dx * s + dy * c,
  };
};

// La operación inversa: dónde se ve en pantalla un punto del mapa sin girar.
export const girarPunto = (p, centro, giro) => {
  if (!p || !centro) return p;
  const g = normalizarGrados(giro) || 0;
  if (g === 0) return { x: p.x, y: p.y };
  const s = Math.sin(g * RAD), c = Math.cos(g * RAD);
  const dx = p.x - centro.x, dy = p.y - centro.y;
  return {
    x: centro.x + dx * c - dy * s,
    y: centro.y + dx * s + dy * c,
  };
};

// ── El tamaño del contenedor ──────────────────────────────────────────────────
// Al torcer un rectángulo dentro de su marco quedan esquinas vacías, como al girar
// una foto dentro de un portarretratos. Para taparlas, el mapa se dibuja cuadrado y
// del tamaño de la diagonal. Solo hace falta mientras está girado.
export const ladoContenedor = (ancho, alto) => Math.ceil(Math.hypot(ancho || 0, alto || 0));

// Cuánto hay que correr ese cuadrado para que su centro siga coincidiendo con el
// centro de lo que se ve (sale negativo: se desborda por igual a los dos lados).
// Sin redondear a propósito: medio píxel de más corre el eje sobre el que gira todo,
// y el CSS acepta fracciones sin problema.
export const desplazamientoContenedor = (ancho, alto) => {
  const lado = ladoContenedor(ancho, alto);
  return { x: (ancho - lado) / 2, y: (alto - lado) / 2 };
};

// ── Las etiquetas ─────────────────────────────────────────────────────────────
// Los íconos giran con el mapa (un cuadrado queda rombo y está bien), pero el texto
// no: se contra-gira tomando como referencia el centro del ícono, que es donde está
// la coordenada real. Así la etiqueta queda horizontal Y encima del punto, en vez de
// orbitar a su alrededor.
export const contraGiro = (giro) => -(normalizarGrados(giro) || 0);

// La etiqueta de una fibra sí sigue a su línea, pero nunca debe leerse de cabeza.
// `angBase` es el ángulo del tramo con el norte arriba; se decide el volteo contra
// el ángulo REAL en pantalla (que incluye el giro) y se devuelve lo que hay que
// aplicarle dentro del contenedor ya girado.
export const anguloEtiquetaFibra = (angBase, giro) => {
  const g = normalizarGrados(giro) || 0;
  let pantalla = diferenciaGrados(0, (angBase || 0) + g); // a favor del camino corto
  if (pantalla > 90) pantalla -= 180;
  else if (pantalla < -90) pantalla += 180;
  return pantalla - g;
};

// ── El gesto de dos dedos ─────────────────────────────────────────────────────
// Acercar y girar salen del mismo gesto: la separación entre los dedos da el zoom y
// el ángulo entre ellos da el giro. La zona muerta evita que un pellizco apenas
// torcido empiece a girar sin querer; pasada esa zona, los dos funcionan juntos.
const distancia = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const anguloEntre = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) / RAD;

export const gestoDosDedos = (inicio, ahora, { zonaMuerta = 12 } = {}) => {
  const d0 = distancia(inicio.a, inicio.b);
  const d1 = distancia(ahora.a, ahora.b);
  const escala = d0 > 0 ? d1 / d0 : 1;
  const delta = diferenciaGrados(anguloEntre(inicio.a, inicio.b), anguloEntre(ahora.a, ahora.b));
  return { escala, delta, pasaZonaMuerta: Math.abs(delta) >= zonaMuerta };
};

// ── Herramientas que exigen el norte arriba ───────────────────────────────────
// Mover un poste, dibujar fibra o acero, ajustar apoyos, ordenar y corregir tocan la
// geometría de los datos: ahí el mapa se endereza solo y se trabaja como siempre.
// Girar queda para mirar y caminar.
export const HERRAMIENTAS_AL_NORTE = ['mover', 'fibra', 'acero', 'ajuste', 'ordenar', 'corregir', 'moverPuntos'];

export const exigeNorte = (modos = {}) => HERRAMIENTAS_AL_NORTE.some(k => !!modos[k]);
