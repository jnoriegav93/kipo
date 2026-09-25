// Componentes JSX (<Mayúscula…>) que un archivo usa sin importarlos ni definirlos.
// ESLint no lo detecta (react/jsx-no-undef está apagado) y Vite tampoco: sale como
// pantalla negra recién en el navegador.
// CONTROL: la MISMA función corre sobre un texto con un componente sin importar, y lo
// tiene que marcar. Si no lo marca, el barrido está ciego y su "todo bien" no vale.
import fs from 'fs';

const sinDefinir = (texto) => {
  const usados = new Set([...texto.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>.]/g)].map(m => m[1]));
  const definidos = new Set();
  for (const m of texto.matchAll(/import\s+([A-Z]\w*)\s*(?:,|\s+from)/g)) definidos.add(m[1]);
  for (const m of texto.matchAll(/import\s*(?:\w+\s*,\s*)?\{([^}]*)\}/g)) {
    for (const parte of m[1].split(',')) {
      const nombre = parte.trim().split(/\s+as\s+/).pop().trim();
      if (nombre) definidos.add(nombre);
    }
  }
  for (const m of texto.matchAll(/(?:const|let|function|class)\s+([A-Z]\w*)/g)) definidos.add(m[1]);
  // Desestructurados: const { label, Icon } = … o const { icon: Icono } = …
  for (const m of texto.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const parte of m[1].split(',')) {
      const nombre = parte.split(':').pop().split('=')[0].trim();
      if (/^[A-Z]\w*$/.test(nombre)) definidos.add(nombre);
    }
  }
  // Renombres en los parámetros desestructurados de una flecha: ({ icon: Icon }) =>.
  // Solo ahí: un `{ icon: X }` en un objeto cualquiera NO define X.
  for (const m of texto.matchAll(/\(\{([^()]*)\}\)\s*=>/g)) {
    for (const r of m[1].matchAll(/\w+\s*:\s*([A-Z]\w*)/g)) definidos.add(r[1]);
  }
  return { usados: usados.size, faltan: [...usados].filter(n => !definidos.has(n) && n !== 'React') };
};

// Sin archivos, revisa TODOS los .jsx de src/. (Antes, sin archivos no revisaba nada y
// aun así decía "RESULTADO: OK" por los controles: el 24/09 eso se reportó como barrido
// limpio sin haber mirado un solo archivo.)
const todosLosJsx = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? todosLosJsx(`${dir}/${e.name}`) : (e.name.endsWith('.jsx') ? [`${dir}/${e.name}`] : []));
const RAIZ = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const archivos = process.argv.length > 2 ? process.argv.slice(2) : todosLosJsx(`${RAIZ}/src`);
if (!archivos.length) { console.log('RESULTADO: MAL (no hay archivos que revisar)'); process.exit(1); }
console.log(`${archivos.length} archivos`);

let faltan = 0;
for (const f of archivos) {
  const r = sinDefinir(fs.readFileSync(f, 'utf8'));
  faltan += r.faltan.length;
  console.log(r.faltan.length ? `✗ ${f}: ${r.faltan.join(', ')}` : `✓ ${f}: ${r.usados} componentes, todos definidos`);
}

const control = sinDefinir("import { Uno } from 'x';\nimport Dos from 'y';\nconst Tres = () => null;\nexport default () => <div><Uno/><Dos/><Tres/><NoImportado/></div>;\n");
const control1 = control.faltan.length === 1 && control.faltan[0] === 'NoImportado';
// El renombre en parámetros cuenta como definido…
const control2 = sinDefinir("const Item = ({ icon: Icono, label }) => <div><Icono/>{label}</div>;\n").faltan.length === 0;
// …pero un valor dentro de un objeto cualquiera no.
const r3 = sinDefinir("const cfg = { icon: Fantasma };\nexport default () => <Fantasma/>;\n");
const control3 = r3.faltan.length === 1 && r3.faltan[0] === 'Fantasma';
console.log(control1 ? 'control 1: marca el componente sin importar, y solo ese ✓' : `control 1: FALLÓ (${JSON.stringify(control.faltan)})`);
console.log(control2 ? 'control 2: reconoce ({ icon: Icono }) => como definido ✓' : 'control 2: FALLÓ');
console.log(control3 ? 'control 3: { icon: Fantasma } en un objeto NO define Fantasma ✓' : `control 3: FALLÓ (${JSON.stringify(r3.faltan)})`);
// …y un desestructurado sí define (const { label, Icon } = …), como en QueueModal.
const control4 = sinDefinir("const { label, Icon } = info();\nexport default () => <Icon/>;\n").faltan.length === 0;
console.log(control4 ? 'control 4: const { label, Icon } = … define Icon ✓' : 'control 4: FALLÓ');
const controlOk = control1 && control2 && control3 && control4;
console.log(faltan === 0 && controlOk ? 'RESULTADO: OK' : 'RESULTADO: MAL');
process.exit(faltan === 0 && controlOk ? 0 : 1);
