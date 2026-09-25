// Paso 6: rol por obra en el SERVIDOR para puntos, fibras, acero, papelera y fotos del mapa.
// Se corre en el EMULADOR (proyecto 'demo-kipo': nada toca producción):
//   firebase emulators:exec --only firestore --project demo-kipo "node test-reglas-obra.mjs <firestore.rules>"
// Cada caso dice si TIENE que pasar o TIENE que fallar. Con las reglas de producción de las
// 02:03 (escritura abierta), los casos "NO…" tienen que salir mal: esa es la corrida de control.
import fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, deleteField,
  arrayRemove, query, where, writeBatch,
} from 'firebase/firestore';

const RULES = process.argv[2];
const FINAL = process.argv[3] === 'final'; // reglas del cierre del paso 6
const VIEJO = FINAL ? 'falla' : 'pasa';
const env = await initializeTestEnvironment({
  projectId: 'demo-kipo',
  firestore: { rules: fs.readFileSync(RULES, 'utf8') },
});

const ADMIN = { uid: 'E8CaZVgP4eZnjnN3OKTVi7bmoJN2', email: 'eduardo.valdivia84@gmail.com' };
const como = (uid, email) => env.authenticatedContext(uid, email ? { email } : {}).firestore();

let fallas = 0, total = 0;
const malos = [];
const caso = async (nombre, debe, promesa) => {
  total++;
  try {
    await (debe === 'pasa' ? assertSucceeds(promesa) : assertFails(promesa));
    console.log(`✓ ${nombre}`);
  } catch (e) {
    fallas++; malos.push(nombre);
    console.log(`✗ ${nombre} (TENÍA QUE ${debe === 'pasa' ? 'PASAR' : 'FALLAR'}): ${String(e.message || e).split('\n')[0]}`);
  }
};

// La obra P: O dueño, E editor, S supervisor (modelo nuevo); L editor y LS supervisor
// del modelo viejo (compartidoCon + permisos), como quedan hasta LIMPIAR.
const obraP = {
  ownerId: 'O', nombre: 'Obra',
  miembros: { O: { rol: 'dueno' }, E: { rol: 'editor' }, S: { rol: 'supervisor' } },
  miembrosUids: ['O', 'E', 'S'],
  compartidoCon: ['L', 'LS'], permisos: { L: 'edicion', LS: 'supervision' },
};

const sembrar = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'proyectos/P'), obraP);
    await setDoc(doc(db, 'proyectos/Q'), { ownerId: 'E', miembros: { E: { rol: 'dueno' } }, miembrosUids: ['E'] });
    await setDoc(doc(db, 'proyectos/R'), { ownerId: 'S', miembros: { S: { rol: 'dueno' } }, miembrosUids: ['S'] });
    await setDoc(doc(db, 'proyectos/123'), { ownerId: 'O', miembros: { O: { rol: 'dueno' } }, miembrosUids: ['O'] });
    await setDoc(doc(db, 'puntos/p1'), { proyectoId: 'P', ownerId: 'O', diaId: 'd1', coords: { lat: 1, lng: 1 }, datos: { numero: 'P1' } });
    await setDoc(doc(db, 'puntos/pViejo'), { ownerId: 'O', diaId: 'd1', coords: { lat: 1, lng: 1 } });
    await setDoc(doc(db, 'puntos/pNum'), { proyectoId: 123, diaId: 7, coords: { lat: 1, lng: 1 } });
    await setDoc(doc(db, 'puntos/pHuerfano'), { proyectoId: 'NOEXISTE', coords: { lat: 1, lng: 1 } });
    await setDoc(doc(db, 'conexiones/c1'), { proyectoId: 'P', ownerId: 'O', vertices: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }] });
    await setDoc(doc(db, 'cablesAcero/a1'), { proyectoId: 'P', ownerId: 'O', puntos: ['p1', 'p2'], fibras: ['c1'], medioTramo: null });
    await setDoc(doc(db, 'papelera/e1'), { uid: 'E', proyectoId: 'P', tipo: 'punto', coleccionOriginal: 'puntos', idOriginal: 'p9', snapshot: { proyectoId: 'P' } });
    await setDoc(doc(db, 'papelera/eProy'), { uid: 'O', proyectoId: 'BORRADO', tipo: 'proyecto', coleccionOriginal: 'proyectos', idOriginal: 'BORRADO', snapshot: {} });
    await setDoc(doc(db, 'proyectos/P/fotosProyecto/fS'), { uid: 'S', url: 'x' });
    await setDoc(doc(db, 'proyectos/P/fotosProyecto/fE'), { uid: 'E', url: 'x' });
  });
};
const punto = (extra = {}) => ({ proyectoId: 'P', ownerId: 'x', diaId: 'd1', coords: { lat: 3, lng: 3 }, datos: { numero: 'P9' }, ...extra });

// ── PUNTOS ─────────────────────────────────────────────────────────────────
await sembrar();
await caso('puntos · el dueño crea un poste', 'pasa', setDoc(doc(como('O'), 'puntos/n1'), punto({ ownerId: 'O' })));
await caso('puntos · el editor crea un poste', 'pasa', setDoc(doc(como('E'), 'puntos/n2'), punto({ ownerId: 'E' })));
await caso(`puntos · el editor viejo (compartidoCon) ${FINAL ? 'ya NO crea' : 'crea'}`, VIEJO, setDoc(doc(como('L'), 'puntos/n3'), punto({ ownerId: 'L' })));
await caso('puntos · NO crea el supervisor', 'falla', setDoc(doc(como('S'), 'puntos/n4'), punto({ ownerId: 'S' })));
await caso('puntos · NO crea el supervisor viejo (compartidoCon)', 'falla', setDoc(doc(como('LS'), 'puntos/n5'), punto({ ownerId: 'LS' })));
await caso('puntos · NO crea un ajeno', 'falla', setDoc(doc(como('X'), 'puntos/n6'), punto({ ownerId: 'X' })));
await caso('puntos · el editor mueve un poste', 'pasa', updateDoc(doc(como('E'), 'puntos/p1'), { coords: { lat: 5, lng: 5 } }));
await caso('puntos · el editor marca revisado', 'pasa', updateDoc(doc(como('E'), 'puntos/p1'), { 'datos.revEstado': 'ok' }));
await caso('puntos · NO lo mueve el supervisor', 'falla', updateDoc(doc(como('S'), 'puntos/p1'), { coords: { lat: 6, lng: 6 } }));
await caso('puntos · NO marca revisado el supervisor', 'falla', updateDoc(doc(como('S'), 'puntos/p1'), { 'datos.revEstado': 'ok' }));
await caso('puntos · NO sube foto el supervisor (merge)', 'falla', setDoc(doc(como('S'), 'puntos/p1'), { datos: { fotos: { a: { b: { url: 'x' } } } } }, { merge: true }));
await caso('puntos · el editor sube foto (merge)', 'pasa', setDoc(doc(como('E'), 'puntos/p1'), { datos: { fotos: { a: { b: { url: 'x' } } } } }, { merge: true }));
await caso('puntos · NO se lo lleva el supervisor a su obra', 'falla', updateDoc(doc(como('S'), 'puntos/p1'), { proyectoId: 'R', ownerId: 'S' }));
await caso('puntos · NO lo pasa el editor a una obra ajena', 'falla', updateDoc(doc(como('E'), 'puntos/p1'), { proyectoId: 'R', ownerId: 'E' }));
await caso('puntos · el editor lo pasa a su propia obra (cortar)', 'pasa', updateDoc(doc(como('E'), 'puntos/p1'), { proyectoId: 'Q', ownerId: 'E' }));
await sembrar();
await caso('puntos · NO lo borra el supervisor', 'falla', deleteDoc(doc(como('S'), 'puntos/p1')));
await caso('puntos · NO lo borra un ajeno', 'falla', deleteDoc(doc(como('X'), 'puntos/p1')));
await caso('puntos · el editor lo borra', 'pasa', deleteDoc(doc(como('E'), 'puntos/p1')));
await sembrar();
await caso('puntos · el supervisor lee', 'pasa', getDoc(doc(como('S'), 'puntos/p1')));
await caso('puntos · la consulta por obra sigue abierta', 'pasa', getDocs(query(collection(como('S'), 'puntos'), where('proyectoId', '==', 'P'))));
await caso('puntos · viejo sin proyectoId: como antes', 'pasa', updateDoc(doc(como('S'), 'puntos/pViejo'), { coords: { lat: 9, lng: 9 } }));
await caso('puntos · proyectoId numérico: el dueño lo cambia', 'pasa', updateDoc(doc(como('O'), 'puntos/pNum'), { coords: { lat: 9, lng: 9 } }));
await caso('puntos · proyectoId numérico: NO un ajeno', 'falla', updateDoc(doc(como('S'), 'puntos/pNum'), { coords: { lat: 9, lng: 9 } }));
await caso('puntos · REPARAR (numérico a texto) lo hace el dueño', 'pasa', updateDoc(doc(como('O'), 'puntos/pNum'), { proyectoId: '123', diaId: '7', ownerId: 'O' }));
await caso('puntos · de una obra que ya no existe: como antes', 'pasa', updateDoc(doc(como('X'), 'puntos/pHuerfano'), { coords: { lat: 9, lng: 9 } }));
await caso('puntos · foto de un poste que aún no subió (sin proyectoId): como antes', 'pasa', setDoc(doc(como('E'), 'puntos/nuevoOffline'), { datos: { fotos: { a: { b: { url: 'x' } } } } }, { merge: true }));
await caso('puntos · el admin lo cambia', 'pasa', updateDoc(doc(como(ADMIN.uid, ADMIN.email), 'puntos/p1'), { coords: { lat: 7, lng: 7 } }));
await caso('puntos · el admin lo borra (borrar usuario)', 'pasa', deleteDoc(doc(como(ADMIN.uid, ADMIN.email), 'puntos/p1')));
await sembrar();
// Recuperar un poste de la papelera = volver a crearlo con su snapshot
await caso('puntos · NO lo recupera el supervisor (setDoc del snapshot)', 'falla', setDoc(doc(como('S'), 'puntos/p9'), punto()));
await caso('puntos · el editor lo recupera', 'pasa', setDoc(doc(como('E'), 'puntos/p9'), punto()));

// ── FIBRAS ─────────────────────────────────────────────────────────────────
await sembrar();
const fibra = { proyectoId: 'P', ownerId: 'x', vertices: [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], capacidad: 24, tipo: 'trazo' };
await caso('fibras · el editor traza una', 'pasa', addDoc(collection(como('E'), 'conexiones'), fibra));
await caso('fibras · NO traza el supervisor', 'falla', addDoc(collection(como('S'), 'conexiones'), fibra));
await caso('fibras · el editor la edita', 'pasa', updateDoc(doc(como('E'), 'conexiones/c1'), { nombre: 'R1', vertices: [{ lat: 1, lng: 1 }] }));
await caso('fibras · NO la edita el supervisor', 'falla', updateDoc(doc(como('S'), 'conexiones/c1'), { nombre: 'R2' }));
await caso('fibras · NO la borra el supervisor', 'falla', deleteDoc(doc(como('S'), 'conexiones/c1')));
await caso(`fibras · el editor viejo (compartidoCon) ${FINAL ? 'ya NO la borra' : 'la borra'}`, VIEJO, deleteDoc(doc(como('L'), 'conexiones/c1')));

// ── CABLES DE ACERO ────────────────────────────────────────────────────────
await sembrar();
const acero = { proyectoId: 'P', ownerId: 'x', diaId: 'd1', puntos: ['p1', 'p2'], fibras: [], medioTramo: null, tipo: 'A' };
await caso('acero · el editor crea uno', 'pasa', addDoc(collection(como('E'), 'cablesAcero'), acero));
await caso('acero · NO crea el supervisor', 'falla', addDoc(collection(como('S'), 'cablesAcero'), acero));
await caso('acero · NO le suelta una fibra el supervisor', 'falla', updateDoc(doc(como('S'), 'cablesAcero/a1'), { fibras: arrayRemove('c1') }));
await caso('acero · el editor le suelta una fibra', 'pasa', updateDoc(doc(como('E'), 'cablesAcero/a1'), { fibras: arrayRemove('c1') }));
await caso('acero · el dueño lo borra', 'pasa', deleteDoc(doc(como('O'), 'cablesAcero/a1')));

// ── PAPELERA ───────────────────────────────────────────────────────────────
await sembrar();
const entrada = (uid) => ({ uid, tipo: 'punto', snapshot: { proyectoId: 'P' }, coleccionOriginal: 'puntos', idOriginal: 'p1', proyectoId: 'P', eliminadoEn: 1, expiraEn: 2 });
await caso('papelera · el editor manda algo', 'pasa', addDoc(collection(como('E'), 'papelera'), entrada('E')));
await caso('papelera · NO manda el supervisor', 'falla', addDoc(collection(como('S'), 'papelera'), entrada('S')));
await caso('papelera · NO se manda a nombre de otro', 'falla', addDoc(collection(como('E'), 'papelera'), entrada('O')));
await caso('papelera · el supervisor la ve (consulta por obra)', 'pasa', getDocs(query(collection(como('S'), 'papelera'), where('proyectoId', '==', 'P'))));
await caso('papelera · NO saca (recupera) el supervisor', 'falla', deleteDoc(doc(como('S'), 'papelera/e1')));
await caso('papelera · el editor saca', 'pasa', deleteDoc(doc(como('E'), 'papelera/e1')));
await caso('papelera · la de una obra borrada la saca su dueño (recuperar la obra)', 'pasa', deleteDoc(doc(como('O'), 'papelera/eProy')));

// ── FOTOS DEL MAPA ─────────────────────────────────────────────────────────
await sembrar();
await caso('fotos del mapa · NO borra su foto quien ya es supervisor', 'falla', deleteDoc(doc(como('S'), 'proyectos/P/fotosProyecto/fS')));
await caso('fotos del mapa · el editor borra la suya', 'pasa', deleteDoc(doc(como('E'), 'proyectos/P/fotosProyecto/fE')));
await caso('fotos del mapa · el dueño borra cualquiera', 'pasa', deleteDoc(doc(como('O'), 'proyectos/P/fotosProyecto/fS')));

// ── BITÁCORA (no cambia: el supervisor escribe) ─────────────────────────────
await caso('bitácora · el supervisor escribe', 'pasa', addDoc(collection(como('S'), 'bitacora'), { autorUid: 'S', proyectoId: 'P', texto: 'visto' }));

// ── LOTES (una sola escritura con cientos de documentos) ───────────────────
const sembrarLote = async (n) => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'proyectos/P'), obraP);
    const b = writeBatch(db);
    for (let i = 0; i < n; i++) b.set(doc(db, `puntos/L${i}`), { proyectoId: 'P', coords: { lat: i, lng: i } });
    await b.commit();
  });
};
const N = 450;
const loteMover = (uid) => {
  const db = como(uid);
  const b = writeBatch(db);
  for (let i = 0; i < N; i++) b.update(doc(db, `puntos/L${i}`), { coords: { lat: -i, lng: -i } });
  return b.commit();
};
await sembrarLote(N);
await caso(`lote · el dueño mueve ${N} postes de una vez (ajuste a fibra)`, 'pasa', loteMover('O'));
await caso(`lote · el editor mueve ${N} postes de una vez`, 'pasa', loteMover('E'));
await caso(`lote · el editor viejo ${FINAL ? 'ya NO mueve' : 'mueve'} ${N} postes de una vez`, VIEJO, loteMover('L'));
await caso(`lote · NO los mueve el supervisor`, 'falla', loteMover('S'));
{
  const db = como('O');
  const b = writeBatch(db);
  b.delete(doc(db, 'proyectos/P'));
  for (let i = 0; i < N; i++) b.delete(doc(db, `puntos/L${i}`));
  await caso(`lote · el dueño borra la obra con sus ${N} postes (un solo lote)`, 'pasa', b.commit());
}

await env.cleanup();
console.log(`\n${total - fallas}/${total} casos como se esperaba`);
if (malos.length) console.log('SALIERON MAL:\n  ' + malos.join('\n  '));
console.log(fallas ? 'RESULTADO: MAL' : 'RESULTADO: OK');
process.exit(fallas ? 1 : 0);
