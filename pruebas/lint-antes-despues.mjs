// Lint de un archivo: la versión del último commit contra la del disco, con la API de
// ESLint (la misma configuración del repo). Uso: node lint-antes-despues.mjs src/App.jsx
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const RAIZ = decodeURIComponent(new URL('..', import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:)/, '').replace(/\/$/, '');
const require = createRequire(`${RAIZ}/package.json`);
const { ESLint } = require('eslint');
const eslint = new ESLint({ cwd: RAIZ });
for (const rel of process.argv.slice(2)) {
  let antes = null;
  try { antes = execSync(`git show HEAD:${rel}`, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch { /* archivo nuevo */ }
  const ahora = fs.readFileSync(`${RAIZ}/${rel}`, 'utf8');
  const contar = async (texto) => {
    const [r] = await eslint.lintText(texto, { filePath: `${RAIZ}/${rel}` });
    return { total: r.errorCount + r.warningCount, mensajes: r.messages.map(m => `${m.line}:${m.column} ${m.ruleId} ${m.message}`) };
  };
  const a = antes == null ? null : await contar(antes);
  const d = await contar(ahora);
  console.log(`${rel}: antes ${a ? a.total : '(nuevo)'} → después ${d.total}`);
  if (a) {
    const nuevos = d.mensajes.filter(m => !a.mensajes.some(x => x.split(' ').slice(1).join(' ') === m.split(' ').slice(1).join(' ')));
    nuevos.forEach(m => console.log('   nuevo: ' + m));
  }
}
