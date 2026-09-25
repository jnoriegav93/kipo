// Umbral del límite de lecturas por lote en el emulador: cuántas obras DISTINTAS caben.
import fs from 'fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-kipo',
  firestore: { rules: fs.readFileSync(process.argv[2], 'utf8') },
});
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (let i = 0; i < 22; i++) {
    await setDoc(doc(db, `proyectos/G${i}`), { ownerId: 'O', miembros: { O: { rol: 'dueno' } }, miembrosUids: ['O'] });
    await setDoc(doc(db, `puntos/g${i}`), { proyectoId: `G${i}`, coords: { lat: i, lng: i } });
  }
});
for (const n of [1, 10, 11, 20, 21]) {
  const db = env.authenticatedContext('O').firestore();
  const b = writeBatch(db);
  for (let i = 0; i < n; i++) b.update(doc(db, `puntos/g${i}`), { coords: { lat: -i - n, lng: -i } });
  let r;
  try { await b.commit(); r = 'pasa'; } catch (e) { r = 'FALLA'; }
  console.log(`LOTE con ${n} obra(s) distinta(s): ${r}`);
}
await env.cleanup();
