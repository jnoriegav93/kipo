// Prueba de src/utils/disenoManzanas.js: manzanas a partir de las calles (modo Diseño).
// Calles de mentira armadas en metros sobre Arequipa. Mutantes: copias del módulo con un
// error metido a propósito; cada una TIENE que fallar algún caso.
import fs from 'fs';
import { aGrados } from '../src/utils/disenoGeo.js';
import * as real from '../src/utils/disenoManzanas.js';

const REF = [-16.409, -71.537];
const g = (x, y) => aGrados([x, y], REF);
// Calle vertical: borde A en x, borde B en x + ancho; horizontal: A en y, B en y + ancho
const vertical = (x, y0, y1, ancho = 10) => ({ A: [g(x, y0), g(x, y1)], B: [g(x + ancho, y0), g(x + ancho, y1)] });
const horizontal = (y, x0, x1, ancho = 10) => ({ A: [g(x0, y), g(x1, y)], B: [g(x0, y + ancho), g(x1, y + ancho)] });

// Cuadrícula: calles en 0, 100 y 200 (10 m de ancho) → 4 manzanas de 90 × 90 = 8100 m²
const grilla = ({ medioDesde = -10, medioHasta = 220 } = {}) => [
  vertical(0, -10, 220), vertical(100, medioDesde, medioHasta), vertical(200, -10, 220),
  horizontal(0, -10, 220), horizontal(100, -10, 220), horizontal(200, -10, 220),
];

const casos = (m) => {
  const fallas = [];
  const igual = (nombre, obtenido, esperado) => {
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) fallas.push(`${nombre}\n      esperaba ${JSON.stringify(esperado)}\n      salió    ${JSON.stringify(obtenido)}`);
  };
  const areas = (r) => r.candidatas.map(c => c.areaM2).sort((a, b) => a - b);

  {
    const r = m.manzanasDesdeCalles(grilla());
    igual('cuadrícula: 4 manzanas de 8100 m²', areas(r), [8100, 8100, 8100, 8100]);
    igual('cuadrícula: todas marcadas para entrar', r.candidatas.every(c => c.incluida && !c.yaExiste), true);
    igual('cuadrícula: sin esquinas que cerrar', r.esquinasCerradas, 0);
  }
  {
    // La calle del medio queda a 5 m de las horizontales de arriba y de abajo: se cierra
    const r = m.manzanasDesdeCalles(grilla({ medioDesde: 15, medioHasta: 195 }));
    igual('a 5 m: se cierran las 4 puntas y salen 4 manzanas', [r.esquinasCerradas, r.candidatas.length], [4, 4]);
  }
  {
    // A 15 m ya no: las manzanas de cada fila quedan unidas por el hueco
    const r = m.manzanasDesdeCalles(grilla({ medioDesde: 25, medioHasta: 185 }));
    igual('a 15 m: no se cierra y salen 2 piezas en vez de 4', [r.esquinasCerradas, r.candidatas.length], [0, 2]);
  }
  {
    // Un patio de 12 × 15 = 180 m² entre cuatro calles no es una manzana
    const patio = [vertical(0, -10, 50), vertical(22, -10, 50), horizontal(0, -10, 50), horizontal(25, -10, 50)];
    igual('patio de 180 m²: no entra', m.manzanasDesdeCalles(patio).candidatas.length, 0);
    igual('patio de 180 m²: con mínimo 100 m² sí', areas(m.manzanasDesdeCalles(patio, [], { areaMin: 100 })), [180]);
  }
  {
    // Ya había una manzana dibujada sobre la de abajo a la izquierda
    const existente = { latlngs: [g(10, 10), g(100, 10), g(100, 100), g(10, 100)] };
    const r = m.manzanasDesdeCalles(grilla(), [existente]);
    const marcadas = r.candidatas.filter(c => c.yaExiste);
    igual('ya existe: una sola, desmarcada', [marcadas.length, marcadas.every(c => !c.incluida)], [1, true]);
    igual('ya existe: las otras 3 entran', r.candidatas.filter(c => c.incluida).length, 3);
  }
  igual('una sola calle: nada', m.manzanasDesdeCalles([vertical(0, 0, 100)]).candidatas.length, 0);
  igual('sin calles: nada', m.manzanasDesdeCalles([]).candidatas.length, 0);
  {
    // Las coordenadas vuelven a grados: la manzana de abajo a la izquierda cae donde debe
    const r = m.manzanasDesdeCalles(grilla());
    const esquina = g(10, 10);
    const cerca = r.candidatas.some(c => c.latlngs.some(p => Math.abs(p[0] - esquina[0]) < 1e-7 && Math.abs(p[1] - esquina[1]) < 1e-7));
    igual('grados: un vértice en la esquina (10, 10)', cerca, true);
  }
  return fallas;
};

// Mutantes: el mismo archivo con una línea cambiada, cargado desde una copia temporal
const RUTA = new URL('../src/utils/disenoManzanas.js', import.meta.url);
const fuente = fs.readFileSync(RUTA, 'utf8');
const MUTANTES = {
  'no cierra esquinas': ['if (ini) { nuevo[0] = ini; cerradas++; }', 'if (false) { nuevo[0] = ini; cerradas++; }'],
  'deja las franjas de afuera': ['if (tocaEnvolvente(anillo, env)) continue;', ''],
  'sin mínimo de área': ['if (area < areaMin) continue;', ''],
  'no mira las manzanas existentes': ['const yaExiste = cubierta > area * 0.5;', 'const yaExiste = false;'],
};

const fr = casos(real);
console.log(`real: ${fr.length} falla(s)`); fr.forEach(f => console.log('  ✗ ' + f));
let todos = true;
for (const [nombre, [antes, despues]] of Object.entries(MUTANTES)) {
  if (fuente.split(antes).length !== 2) { console.log(`mutante «${nombre}»: MAL ARMADO`); todos = false; continue; }
  const copia = new URL(`../src/utils/__mutante_${Date.now()}.js`, import.meta.url);
  fs.writeFileSync(copia, fuente.replace(antes, despues));
  let k;
  try { k = casos(await import(copia.href)).length; } catch (e) { k = 1; } finally { fs.unlinkSync(copia); }
  console.log(`mutante «${nombre}» (TIENE que fallar): ${k} falla(s)`);
  if (!k) todos = false;
}
const ok = !fr.length && todos;
console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: MAL');
process.exit(ok ? 0 : 1);
