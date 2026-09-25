// Prueba de src/utils/escuchasPorProyecto.js: qué escuchas de puntos, fibras y cables se
// abren y cierran cuando cambia la lista de proyectos (24/09).
//
// Firestore de mentira: cada escucha queda anotada y la prueba la responde a mano.
// Control: el algoritmo de antes (cerrar todo y rehacer los grupos), copiado aquí con la
// misma interfaz; TIENE que fallar lo del proyecto que aparece. Mutantes: copias del
// módulo con un error metido a propósito; cada una TIENE que fallar algún caso.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';

const MODULO = new URL('../src/utils/escuchasPorProyecto.js', import.meta.url);
const real = await import(MODULO.href);

// useFirebaseData hasta el 24/09, con la misma interfaz: ante cualquier cambio cierra
// todo, rehace los grupos de 30 en 30 y no publica hasta que llegaron todos.
const crearAntes = ({ escuchar, publicar }) => {
  let cerrarTodo = () => {};
  return {
    sincronizar(ids) {
      cerrarTodo();
      cerrarTodo = () => {};
      if (!ids.length) { publicar([]); return; }
      const grupos = [];
      for (let i = 0; i < ids.length; i += 30) grupos.push(ids.slice(i, i + 30));
      const porGrupo = grupos.map(() => []);
      const llegaron = grupos.map(() => false);
      const pub = () => { if (llegaron.every(Boolean)) publicar(porGrupo.flat()); };
      const unsubs = grupos.map((g, i) => escuchar(g,
        (docs) => { porGrupo[i] = docs; llegaron[i] = true; pub(); },
        () => { llegaron[i] = true; pub(); }));
      cerrarTodo = () => unsubs.forEach(u => u());
    },
    cerrar() { cerrarTodo(); cerrarTodo = () => {}; },
  };
};
// Lo de antes no filtraba: publicaba lo que llegaba
const soloVisiblesAntes = (docs) => docs;

const casos = ({ crearEscuchasPorProyecto: crear, soloVisibles }) => {
  const fallas = [];
  const ok = (nombre, cond, detalle = '') => { if (!cond) fallas.push(`${nombre}${detalle ? `\n      ${detalle}` : ''}`); };

  // Firestore de mentira: una escucha cerrada ya no responde
  const escuchas = [];
  const escuchar = (ids, alDatos, alError) => {
    const e = { ids: [...ids], alDatos, alError, abierta: true };
    escuchas.push(e);
    return () => { e.abierta = false; };
  };
  const datos = {};
  const responder = (e) => { if (e.abierta) e.alDatos(e.ids.flatMap(id => datos[id] || [])); };
  const abiertas = () => escuchas.filter(e => e.abierta);
  const listas = () => abiertas().map(e => e.ids.join(','));
  let publicado = null, veces = 0;
  const esc = crear({ escuchar, publicar: (d) => { publicado = d; veces++; } });
  const idsDe = (docs) => (docs || []).map(d => d.id).sort();

  const nombres = (letra, n) => Array.from({ length: n }, (_, i) => `${letra}${String(i + 1).padStart(2, '0')}`);
  const PROPIOS = nombres('P', 25), COMPARTIDOS = nombres('S', 10);
  [...PROPIOS, ...COMPARTIDOS].forEach(id => { datos[id] = [{ id: `${id}-a`, proyectoId: id }, { id: `${id}-b`, proyectoId: id }]; });
  const TODOS = [...PROPIOS, ...COMPARTIDOS];
  const DE_30_EN_30 = [TODOS.slice(0, 30).join(','), TODOS.slice(30).join(',')];

  // 1. Arranque: llegan los propios; las compartidas todavía no
  esc.sincronizar(PROPIOS, false);
  ok('arranque: una escucha con los 25 propios', JSON.stringify(listas()) === JSON.stringify([PROPIOS.join(',')]));

  // 2. Llegan las compartidas y, en el mismo cambio, `asentado`: de 30 en 30, como antes
  esc.sincronizar(TODOS, true);
  ok('asentado: termina en grupos de 30 en 30, como antes', JSON.stringify(listas()) === JSON.stringify(DE_30_EN_30), JSON.stringify(listas()));

  // 3. No se publica hasta que llegaron los dos grupos
  const [g1, g2] = abiertas();
  responder(g1);
  ok('no publica con un grupo sin llegar', publicado === null);
  responder(g2);
  ok('publica al llegar los dos', idsDe(publicado).length === 70);

  // 4. Aparece un proyecto propio nuevo: va detrás de los propios, antes de los compartidos
  const NUEVO = 'P26';
  datos[NUEVO] = [];
  const TODOS2 = [...PROPIOS, NUEVO, ...COMPARTIDOS];
  const n4 = escuchas.length;
  esc.sincronizar(TODOS2, true);
  const nuevas = escuchas.slice(n4);
  ok('proyecto nuevo: se abre UNA escucha, solo con él', nuevas.length === 1 && nuevas[0].ids.join(',') === NUEVO,
    `se abrieron ${nuevas.length}: ${JSON.stringify(nuevas.map(e => e.ids.length))} proyectos`);
  ok('proyecto nuevo: las escuchas que había siguen abiertas', g1.abierta && g2.abierta);

  // 5. Mientras el nuevo no responde, un cambio en otra obra se publica igual
  const gNuevo = nuevas[0] || { abierta: false };
  datos.P01 = [...datos.P01, { id: 'P01-c', proyectoId: 'P01' }];
  const v5 = veces;
  responder(g1.abierta ? g1 : abiertas()[0]);
  ok('un cambio en otra obra se publica sin esperar al proyecto nuevo', veces === v5 + 1 && idsDe(publicado).includes('P01-c'));

  // 6. Llega el nuevo con un poste
  datos[NUEVO] = [{ id: 'P26-a', proyectoId: NUEVO }];
  if (gNuevo.abierta) responder(gNuevo); else abiertas().forEach(responder);
  ok('el poste del proyecto nuevo se publica', idsDe(publicado).includes('P26-a'));
  ok('y lo de antes sigue ahí', idsDe(publicado).length === 72);

  // 7. Desaparece una obra compartida: no se abre ni se cierra nada
  const sinS03 = TODOS2.filter(id => id !== 'S03');
  const n7 = escuchas.length;
  esc.sincronizar(sinS03, true);
  ok('obra que desaparece: no se reabre nada', escuchas.length === n7 && g1.abierta && g2.abierta && gNuevo.abierta);

  // 8. Desaparecen todas las del segundo grupo: ese grupo se cierra, los demás no
  const sinG2 = sinS03.filter(id => !g2.ids.includes(id));
  esc.sincronizar(sinG2, true);
  ok('grupo sin obras a la vista: se cierra', !g2.abierta);
  ok('grupo sin obras a la vista: los demás siguen', g1.abierta && gNuevo.abierta && escuchas.length === n7);

  // 9. Vuelve S08 (su grupo ya se cerró): escucha nueva, solo para ella
  esc.sincronizar([...sinG2, 'S08'], true);
  const n9 = escuchas.slice(n7);
  ok('obra que vuelve con su grupo cerrado: una escucha para ella', n9.length === 1 && n9[0].ids.join(',') === 'S08',
    JSON.stringify(n9.map(e => e.ids.length)));

  // 10. Vuelve S03 (su grupo sigue abierto por las otras): no se abre nada
  const n10 = escuchas.length;
  esc.sincronizar([...sinG2, 'S08', 'S03'], true);
  ok('obra que vuelve con su grupo abierto: no se abre nada', escuchas.length === n10);

  // 11. Una escucha cerrada que igual responde no publica (Firestore no lo hace; por si acaso)
  const v11 = veces;
  g2.alDatos([{ id: 'fantasma', proyectoId: 'S09' }]);
  ok('una escucha cerrada no publica', veces === v11);

  // 12. Cerrar sesión: sin proyectos, todo cerrado
  esc.sincronizar([], false);
  ok('sin proyectos: todo cerrado', abiertas().length === 0);

  // 13. Otra sesión, con las compartidas llegando primero: termina de 30 en 30
  esc.sincronizar(COMPARTIDOS, false);
  esc.sincronizar(TODOS, true);
  ok('otra sesión: termina de 30 en 30', JSON.stringify(listas()) === JSON.stringify(DE_30_EN_30), JSON.stringify(listas()));

  // 14. Mismo cambio dos veces: no se reabre nada
  const n14 = escuchas.length;
  esc.sincronizar(TODOS, true);
  ok('la misma lista otra vez: no se reabre nada', escuchas.length === n14);

  // 15. Un grupo que falla cuenta como llegado: los demás se publican
  const [h1, h2] = abiertas();
  publicado = null;
  responder(h1);
  h2.alError(new Error('permiso'));
  // 30 obras con 2 postes cada una, más el tercero que ganó P01 en el paso 5
  ok('un grupo que falla no frena a los demás', idsDe(publicado).length === 61, `publicados ${idsDe(publicado).length}`);

  // 16. cerrar() (la vista se desmonta, o React la prueba dos veces): todo cerrado y, al
  //     volver, de 30 en 30
  esc.cerrar();
  ok('cerrar: todo cerrado', abiertas().length === 0);
  esc.sincronizar(TODOS2, true);
  const TODOS2_30 = [TODOS2.slice(0, 30).join(','), TODOS2.slice(30).join(',')];
  ok('después de cerrar: de 30 en 30 otra vez', JSON.stringify(listas()) === JSON.stringify(TODOS2_30), JSON.stringify(listas()));
  // ... y como en el arranque, sin publicar hasta que llegaron todos
  const [k1, k2] = abiertas();
  publicado = null;
  responder(k1);
  ok('después de cerrar: no publica con un grupo sin llegar', publicado === null);
  if (k2) responder(k2);
  ok('después de cerrar: publica al llegar todos', idsDe(publicado).length === 72, `publicados ${idsDe(publicado).length}`);

  // soloVisibles: lo que se muestra
  const docs = [{ id: 'a', proyectoId: 'P1' }, { id: 'b', proyectoId: 'P2' }, { id: 'c', proyectoId: 7 }, { id: 'd' }, { id: 'e', proyectoId: '' }];
  ok('soloVisibles: quita lo de proyectos que no están', JSON.stringify(idsDe(soloVisibles(docs, ['P1', '7']))) === JSON.stringify(['a', 'c', 'd', 'e']),
    JSON.stringify(idsDe(soloVisibles(docs, ['P1', '7']))));
  ok('soloVisibles: sin proyectos, nada', soloVisibles(docs, []).length === 0);
  ok('soloVisibles: si no sobra nada, la misma lista', soloVisibles(docs, ['P1', 'P2', '7']) === docs);

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

informar('escuchasPorProyecto.js', casos(real), false);
informar('CONTROL: el de antes', casos({ crearEscuchasPorProyecto: crearAntes, soloVisibles: soloVisiblesAntes }), true);

// Mutantes
const fuente = fs.readFileSync(MODULO, 'utf8');
const MUTANTES = [
  ['todo de 30 en 30 siempre', 'const deTreintaEnTreinta = !asentado || !yaAsentado || ids.length === 0;', 'const deTreintaEnTreinta = true;'],
  ['el proyecto nuevo frena la publicación', 'grupos.push(abrir(lista, false))', 'grupos.push(abrir(lista, true))'],
  ['nunca cierra un grupo', "        g.cerrar();\n        return false;", '        return true;'],
  ['sin la primera vez de 30 en 30', 'const deTreintaEnTreinta = !asentado || !yaAsentado || ids.length === 0;', 'const deTreintaEnTreinta = !asentado || ids.length === 0;'],
  ['un grupo cerrado publica', 'if (grupos.includes(g)) intentarPublicar();', 'intentarPublicar();'],
  ['soloVisibles no filtra', 'return quedan.length === docs.length ? docs : quedan;', 'return docs;'],
  ['cerrar no reinicia', "      grupos = [];\n      yaAsentado = false;", '      grupos = [];'],
];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kipo-escuchas-'));
for (const [nombre, de, a] of MUTANTES) {
  let hecho = null;
  for (const E of ['\r\n', '\n']) {
    const deE = de.split('\n').join(E);
    if (fuente.includes(deE)) { hecho = fuente.replace(deE, a.split('\n').join(E)); break; }
  }
  if (!hecho) { console.log(`✗ MUTANTE "${nombre}": no se encontró el texto a cambiar`); mal = true; continue; }
  const archivo = path.join(dir, `${nombre.replace(/\W+/g, '-')}.mjs`);
  fs.writeFileSync(archivo, hecho);
  informar(`MUTANTE: ${nombre}`, casos(await import(pathToFileURL(archivo).href)), true);
}
fs.rmSync(dir, { recursive: true, force: true });

console.log(`\nRESULTADO: ${mal ? 'MAL' : 'OK'}`);
process.exit(mal ? 1 : 0);
