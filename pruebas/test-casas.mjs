// Prueba de src/utils/disenoCasas.js: las casas del formato regular (25/09).
// Manzanas de mentira armadas en metros sobre Arequipa. Mutantes: copias del módulo con
// un error metido a propósito; cada una TIENE que fallar algún caso.
import fs from 'fs';
import { pathToFileURL } from 'url';
import { aGrados, aMetros, areaM2 } from '../src/utils/disenoGeo.js';

const MODULO = new URL('../src/utils/disenoCasas.js', import.meta.url);
const REF = [-16.409, -71.537];
const g = (x, y) => aGrados([x, y], REF);
const m = (p) => aMetros(p, REF);

// 60 m a lo largo de x, 30 m de fondo; la base (primer lado) va a lo largo
const R1 = [g(0, 0), g(60, 0), g(60, 30), g(0, 30)];
// La misma, pero dibujada empezando por el lado corto
const R2 = [g(0, 0), g(0, 30), g(60, 30), g(60, 0)];
// Un vértice corrido: cuatro lados, ya no recta
const Q = [g(0, 0), g(60, 0), g(66, 33), g(0, 30)];

const casos = (mod) => {
  const fallas = [];
  const ok = (nombre, cond, detalle = '') => { if (!cond) fallas.push(`${nombre}${detalle ? `\n      ${detalle}` : ''}`); };
  const cerca = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
  const sumaAreas = (casas) => casas.reduce((s, c) => s + areaM2(c.latlngs), 0);
  // Punto medio del frente de una casa, en metros
  const medioFrente = (c) => {
    const a = m(c.latlngs[c.frente]), b = m(c.latlngs[(c.frente + 1) % 4]);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };

  // ── Dos filas ──
  {
    const f = mod.formatoNuevo(R1);
    ok('dos filas: nace con las filas a lo largo del lado largo y una casa cada 6 m', f.tipo === 'dos-filas' && f.giro === 0 && f.n === 10, JSON.stringify(f));
    const casas = mod.generarCasas(R1, f);
    ok('dos filas: 20 casas', casas.length === 20, `${casas.length}`);
    ok('dos filas: cubren la manzana entera', cerca(sumaAreas(casas), areaM2(R1), 1), `${sumaAreas(casas).toFixed(1)} de ${areaM2(R1).toFixed(1)} m²`);
    ok('dos filas: cada casa de 6 × 15 m', casas.every(c => cerca(areaM2(c.latlngs), 90, 0.5)));
    ok('dos filas: nacen con 1 familia', casas.every(c => c.familias === 1) && mod.totalFamilias(casas) === 20);
    const fila0 = casas.slice(0, 10), fila1 = casas.slice(10);
    ok('dos filas: la primera fila da a la calle de la base', fila0.every(c => cerca(medioFrente(c)[1], 0, 0.05)),
      JSON.stringify(fila0.map(c => medioFrente(c).map(v => v.toFixed(1)))));
    ok('dos filas: la segunda, a la de enfrente', fila1.every(c => cerca(medioFrente(c)[1], 30, 0.05)));
    ok('dos filas: cuatro esquinas', casas.filter(c => c.esquina).length === 4);
    ok('ids c1..c20', casas.map(c => c.id).join() === Array.from({ length: 20 }, (_, i) => `c${i + 1}`).join());
  }
  {
    const f = mod.formatoNuevo(R2);
    ok('dibujada por el lado corto: igual nace a lo largo del largo', f.giro === 1 && f.n === 10, JSON.stringify(f));
  }
  {
    const f = mod.formatoNuevo(R1, 'dos-filas', 1);
    ok('girada: filas a lo largo del lado corto, 5 casas por fila', f.n === 5, JSON.stringify(f));
    const casas = mod.generarCasas(R1, f);
    ok('girada: 10 casas de 6 × 30 m', casas.length === 10 && casas.every(c => cerca(areaM2(c.latlngs), 180, 0.8)));
  }
  {
    const casas = mod.generarCasas(R1, { tipo: 'dos-filas', giro: 0, n: 1 });
    ok('una casa por fila: el frente es el lado más largo (empate de intermedias)', casas.every(c => [0, 2].includes(c.frente)),
      JSON.stringify(casas.map(c => c.frente)));
  }

  // ── Tres zonas ──
  {
    const f = mod.formatoNuevo(R1, 'tres-zonas');
    ok('tres zonas: costados según el fondo y centro según medio largo', f.nLat === 5 && f.nCentro === 5, JSON.stringify(f));
    const casas = mod.generarCasas(R1, f);
    ok('tres zonas: 20 casas', casas.length === 20);
    ok('tres zonas: cubren la manzana', cerca(sumaAreas(casas), areaM2(R1), 1));
    const izquierda = casas.slice(0, 5);
    ok('tres zonas: las intermedias del costado dan al costado', izquierda.slice(1, 4).every(c => cerca(medioFrente(c)[0], 0, 0.05)));
    ok('tres zonas: la esquina del costado va al lado con más intermedias (el centro: 5 contra 3)',
      cerca(medioFrente(izquierda[0])[1], 0, 0.05), JSON.stringify(medioFrente(izquierda[0])));
  }
  {
    const casas = mod.generarCasas(R1, { tipo: 'tres-zonas', giro: 0, nLat: 8, nCentro: 2 });
    const esquina = casas[0];
    ok('tres zonas: con 6 intermedias al costado y 2 en el centro, la esquina da al costado',
      cerca(medioFrente(esquina)[0], 0, 0.05), JSON.stringify(medioFrente(esquina)));
  }

  // ── Una fila ──
  {
    const f = mod.formatoNuevo(R1, 'una-fila');
    const casas = mod.generarCasas(R1, f);
    ok('una fila: 10 casas de todo el fondo', f.n === 10 && casas.length === 10 && casas.every(c => cerca(areaM2(c.latlngs), 180, 0.8)));
    ok('una fila: todas dan a la base', casas.every(c => cerca(medioFrente(c)[1], 0, 0.05)));
    ok('una fila: el fondo no cuenta, solo dos esquinas', casas.filter(c => c.esquina).length === 2, `${casas.filter(c => c.esquina).length}`);
    const f2 = { ...f, giro: 2 };
    const casas2 = mod.generarCasas(R1, f2);
    ok('una fila girada dos veces: dan a la calle de enfrente', casas2.every(c => cerca(medioFrente(c)[1], 30, 0.05)));
  }

  // ── Cuadra que ya no es recta ──
  {
    const casas = mod.generarCasas(Q, mod.formatoNuevo(Q));
    ok('cuatro lados no rectos: las casas la cubren igual', cerca(sumaAreas(casas), areaM2(Q), 1), `${sumaAreas(casas).toFixed(1)} de ${areaM2(Q).toFixed(1)}`);
  }

  // ── Límites y giros ──
  ok('manzana chiquita: al menos 1 casa', mod.formatoNuevo([g(0, 0), g(3, 0), g(3, 3), g(0, 3)]).n === 1);
  ok('manzana muy larga: tope de casas', mod.formatoNuevo([g(0, 0), g(1000, 0), g(1000, 30), g(0, 30)]).n === mod.MAX_CASAS);
  ok('girar en dos filas: dos sentidos', [0, 1].map(x => mod.siguienteGiro('dos-filas', x)).join() === '1,0');
  ok('girar en una fila: cuatro lados', [0, 1, 2, 3].map(x => mod.siguienteGiro('una-fila', x)).join() === '1,2,3,0');
  ok('solo cuatro esquinas admiten el formato regular', mod.admiteFormatoRegular(R1) && !mod.admiteFormatoRegular([...R1, g(10, 40)]));
  ok('sin cuatro esquinas no hay casas', mod.generarCasas([...R1, g(10, 40)], mod.formatoNuevo(R1)).length === 0);
  return fallas;
};

let mal = false;
const informar = (titulo, fallas, debeFallar) => {
  const bien = debeFallar ? fallas.length > 0 : fallas.length === 0;
  if (!bien) mal = true;
  console.log(`${bien ? '✓' : '✗'} ${titulo}${debeFallar ? ` (falla ${fallas.length}, como debe)` : ''}`);
  if (!debeFallar) fallas.forEach(f => console.log(`    ✗ ${f}`));
  if (debeFallar && fallas.length) console.log(`    cae en: ${fallas.map(f => f.split('\n')[0]).join(' | ')}`);
};

informar('disenoCasas.js', casos(await import(MODULO.href)), false);

const fuente = fs.readFileSync(MODULO, 'utf8');
const MUTANTES = [
  ['sin la regla de esquina', 'frente = [...lados].sort((a, b) => (intermedias[b] - intermedias[a]) || porLargo(a, b))[0];', 'frente = lados[0];'],
  ['empate: el lado más corto', '? largo(b) - largo(a) : a - b', '? largo(a) - largo(b) : a - b'],
  ["en Una fila el fondo cuenta", "if (c.v2 === 1 && formato.tipo !== 'una-fila') lados.push(2);", 'if (c.v2 === 1) lados.push(2);'],
  ['siempre 10 casas', 'const cuantas = (metros) => limitar(metros / METROS_POR_CASA);', 'const cuantas = () => 10;'],
  ['siempre desde la base dibujada', 'g = metrosEntre(q[0], q[1]) >= metrosEntre(q[1], q[2]) ? 0 : 1;', 'g = 0;'],
  ['bilineal cruzado', '(1 - u) * (1 - v) * A[0] + u * (1 - v) * B[0] + u * v * C[0] + (1 - u) * v * D[0],', '(1 - u) * (1 - v) * A[0] + u * (1 - v) * B[0] + u * v * D[0] + (1 - u) * v * C[0],'],
  ['tres zonas sin centro por medio largo', 'nCentro: cuantas(largoFilas(q) / 2)', 'nCentro: cuantas(largoFilas(q))'],
];
const dir = fs.mkdtempSync(new URL('./', MODULO).pathname.replace(/^\/(?=[A-Za-z]:)/, '') + '.mutante-');
for (const [nombre, de, a] of MUTANTES) {
  let hecho = null;
  for (const E of ['\r\n', '\n']) {
    const deE = de.split('\n').join(E);
    if (fuente.includes(deE)) { hecho = fuente.replace(deE, a.split('\n').join(E)); break; }
  }
  if (!hecho) { console.log(`✗ MUTANTE "${nombre}": no se encontró el texto a cambiar`); mal = true; continue; }
  // Junto al original, para que su import de ./disenoGeo.js funcione
  const archivo = `${dir}/disenoCasas.mjs`;
  fs.writeFileSync(archivo, hecho.replace("from './disenoGeo.js'", "from '../disenoGeo.js'"));
  informar(`MUTANTE: ${nombre}`, casos(await import(`${pathToFileURL(archivo).href}?${encodeURIComponent(nombre)}`)), true);
}
fs.rmSync(dir, { recursive: true, force: true });

console.log(`\nRESULTADO: ${mal ? 'MAL' : 'OK'}`);
process.exit(mal ? 1 : 0);
