// Pruebas de firestore.rules en el EMULADOR (proyecto de demostración 'demo-kipo': nada
// toca producción). Se corre con:
//   firebase emulators:exec --only firestore --project demo-kipo "node test-reglas.mjs <ruta de firestore.rules>"
// Cubre la regla nueva de `usuarios` (paso 6) y las del paso 5 que ya están en producción.
// Cada caso dice si TIENE que pasar o TIENE que fallar.
import fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, arrayRemove } from 'firebase/firestore';

const RULES = process.argv[2];
const FINAL = process.argv[3] === 'final'; // reglas del cierre del paso 6
const VIEJO = FINAL ? 'falla' : 'pasa';
const env = await initializeTestEnvironment({
  projectId: 'demo-kipo',
  firestore: { rules: fs.readFileSync(RULES, 'utf8') },
});

const ADMIN = { uid: 'E8CaZVgP4eZnjnN3OKTVi7bmoJN2', email: 'eduardo.valdivia84@gmail.com' };
const como = (uid, email) => env.authenticatedContext(uid, email ? { email } : {}).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

let fallas = 0, total = 0;
const caso = async (nombre, debe, promesa) => {
  total++;
  try {
    await (debe === 'pasa' ? assertSucceeds(promesa) : assertFails(promesa));
    console.log(`✓ ${nombre}`);
  } catch (e) {
    fallas++;
    console.log(`✗ ${nombre} (TENÍA QUE ${debe === 'pasa' ? 'PASAR' : 'FALLAR'}): ${String(e.message || e).split('\n')[0]}`);
  }
};

const sembrar = async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/u@kipo.com'), { dispositivosAutorizados: ['h1'], perfil: 'base' });
    await setDoc(doc(db, 'usuarios/otro@kipo.com'), { dispositivosAutorizados: ['h2'], perfil: 'base' });
    await setDoc(doc(db, 'usuarios/Mayus@kipo.com'), { dispositivosAutorizados: ['h3'] });
    await setDoc(doc(db, 'proyectos/P'), {
      ownerId: 'O', nombre: 'Obra',
      miembros: { O: { rol: 'dueno' }, E: { rol: 'editor' }, S: { rol: 'supervisor' } },
      miembrosUids: ['O', 'E', 'S'],
      compartidoCon: ['L'], permisos: { L: 'edicion' },
    });
    await setDoc(doc(db, 'proyectos/P/fotosProyecto/f0'), { uid: 'O', url: 'x' });
  });
};

// ── USUARIOS (paso 6: cerrada) ─────────────────────────────────────────────
await sembrar();
const u = como('u1', 'u@kipo.com');
await caso('usuarios · cada uno lee su documento (lo que hace el ingreso)', 'pasa', getDoc(doc(u, 'usuarios/u@kipo.com')));
await caso('usuarios · no lee el de otro', 'falla', getDoc(doc(u, 'usuarios/otro@kipo.com')));
await caso('usuarios · cambia su logo', 'pasa', updateDoc(doc(u, 'usuarios/u@kipo.com'), { logoEmpresa: 'https://x' }));
await caso('usuarios · el logo con setDoc merge, como useLogo', 'pasa', setDoc(doc(u, 'usuarios/u@kipo.com'), { logoEmpresa: 'https://y', logoEmpresaBase64: 'data:x' }, { merge: true }));
await caso('usuarios · NO se autoriza un dispositivo', 'falla', updateDoc(doc(u, 'usuarios/u@kipo.com'), { dispositivosAutorizados: ['h1', 'hX'] }));
await caso('usuarios · NO se cambia el perfil', 'falla', updateDoc(doc(u, 'usuarios/u@kipo.com'), { perfil: 'avanzado' }));
await caso('usuarios · NO borra su documento', 'falla', deleteDoc(doc(u, 'usuarios/u@kipo.com')));
await caso('usuarios · NO toca el de otro', 'falla', updateDoc(doc(u, 'usuarios/otro@kipo.com'), { logoEmpresa: 'https://x' }));
const nuevo = como('n1', 'nuevo@kipo.com');
await caso('usuarios · crea el suyo solo con el logo', 'pasa', setDoc(doc(nuevo, 'usuarios/nuevo@kipo.com'), { logoEmpresa: 'https://x' }));
await sembrar();
await caso('usuarios · NO se crea el suyo con dispositivos', 'falla', setDoc(doc(nuevo, 'usuarios/nuevo@kipo.com'), { dispositivosAutorizados: ['hX'] }));
await caso('usuarios · el correo se compara en minúsculas', 'pasa', getDoc(doc(como('m1', 'mayus@kipo.com'), 'usuarios/Mayus@kipo.com')));
await caso('usuarios · sin correo en el token, nada', 'falla', getDoc(doc(como('z1'), 'usuarios/u@kipo.com')));
await caso('usuarios · sin sesión, nada', 'falla', getDoc(doc(anonimo(), 'usuarios/u@kipo.com')));
const adm = como(ADMIN.uid, ADMIN.email);
await caso('usuarios · el admin lee a cualquiera', 'pasa', getDoc(doc(adm, 'usuarios/otro@kipo.com')));
await caso('usuarios · el admin autoriza dispositivos', 'pasa', updateDoc(doc(adm, 'usuarios/otro@kipo.com'), { dispositivosAutorizados: ['h2', 'h9'] }));
await caso('usuarios · el admin crea usuarios', 'pasa', setDoc(doc(adm, 'usuarios/creado@kipo.com'), { dispositivosAutorizados: ['h'], perfil: 'basico' }));
await caso('usuarios · el admin borra', 'pasa', deleteDoc(doc(adm, 'usuarios/otro@kipo.com')));
await caso('usuarios · el admin por correo, aunque cambie el uid', 'pasa', getDoc(doc(como('otroUid', ADMIN.email), 'usuarios/u@kipo.com')));

// ── PROYECTOS (paso 5, ya en producción) ───────────────────────────────────
await sembrar();
await caso('proyectos · el dueño cambia lo que sea', 'pasa', updateDoc(doc(como('O'), 'proyectos/P'), { nombre: 'Obra 2', 'miembros.S.rol': 'editor' }));
await sembrar();
await caso('proyectos · el editor renombra', 'pasa', updateDoc(doc(como('E'), 'proyectos/P'), { nombre: 'Obra editada' }));
await caso('proyectos · el editor agrega días', 'pasa', updateDoc(doc(como('E'), 'proyectos/P'), { dias: [{ id: 'd1' }] }));
await caso('proyectos · el editor NO se hace dueño', 'falla', updateDoc(doc(como('E'), 'proyectos/P'), { ownerId: 'E' }));
await caso('proyectos · el editor NO cambia roles', 'falla', updateDoc(doc(como('E'), 'proyectos/P'), { 'miembros.S.rol': 'editor' }));
await caso('proyectos · el editor NO toca compartidoCon', 'falla', updateDoc(doc(como('E'), 'proyectos/P'), { compartidoCon: ['L', 'X'] }));
await caso('proyectos · el supervisor NO cambia nada', 'falla', updateDoc(doc(como('S'), 'proyectos/P'), { nombre: 'x' }));
await caso(`proyectos · el editor viejo (compartidoCon) ${FINAL ? 'ya NO edita' : 'sigue editando'}`, VIEJO, updateDoc(doc(como('L'), 'proyectos/P'), { nombre: 'Obra L' }));
await caso('proyectos · un ajeno NO cambia nada', 'falla', updateDoc(doc(como('X'), 'proyectos/P'), { nombre: 'x' }));
await caso('proyectos · el supervisor NO saca a otro', 'falla', updateDoc(doc(como('S'), 'proyectos/P'), { 'miembros.E': deleteField(), miembrosUids: arrayRemove('E') }));
const salir = (uid) => ({
  compartidoCon: arrayRemove(uid), [`permisos.${uid}`]: deleteField(), enListaDe: arrayRemove(uid),
  [`miembros.${uid}`]: deleteField(), miembrosUids: arrayRemove(uid), [`supervisoresInfo.${uid}`]: deleteField(),
});
await caso('proyectos · el supervisor sale (lo que escribe SALIR)', 'pasa', updateDoc(doc(como('S'), 'proyectos/P'), salir('S')));
await sembrar();
await caso('proyectos · el editor sale', 'pasa', updateDoc(doc(como('E'), 'proyectos/P'), salir('E')));

// ── CIERRE DEL PASO 6: nombre propio, salida nueva, lo viejo ────────────────
const NUEVO = FINAL ? 'pasa' : 'falla'; // lo que solo permiten las reglas finales
await sembrar();
await caso(`proyectos · el supervisor pone al día su nombre propio en miembros${FINAL ? '' : ' (aún no)'}`, NUEVO, updateDoc(doc(como('S'), 'proyectos/P'), { 'miembros.S.nombre': 'Sara', 'miembros.S.empresa': 'X' }));
await caso(`proyectos · el editor pone al día su nombre propio${FINAL ? '' : ' (aún no)'}`, NUEVO, updateDoc(doc(como('E'), 'proyectos/P'), { 'miembros.E.nombre': 'Eva' }));
await caso('proyectos · NO se cambia el rol propio con eso', 'falla', updateDoc(doc(como('S'), 'proyectos/P'), { 'miembros.S.rol': 'editor' }));
await caso('proyectos · NO se cambia el nombre de otro', 'falla', updateDoc(doc(como('S'), 'proyectos/P'), { 'miembros.E.nombre': 'x' }));
await caso('proyectos · NO nombre propio + otra cosa', 'falla', updateDoc(doc(como('S'), 'proyectos/P'), { 'miembros.S.nombre': 'Sara', nombre: 'Obra S' }));
await caso('proyectos · NO se mete un ajeno con su nombre', 'falla', updateDoc(doc(como('X'), 'proyectos/P'), { 'miembros.X.nombre': 'x' }));
await sembrar();
await caso('proyectos · el supervisor sale con lo que escribe la app nueva', 'pasa', updateDoc(doc(como('S'), 'proyectos/P'), { 'miembros.S': deleteField(), miembrosUids: arrayRemove('S') }));
await sembrar();
await caso(`proyectos · un ajeno ${FINAL ? 'ya NO' : 'todavía'} escribe solicitudesPendientes`, FINAL ? 'falla' : 'pasa', updateDoc(doc(como('X'), 'proyectos/P'), { solicitudesPendientes: ['X'] }));
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'equipos/T'), { ownerId: 'O', miembrosUids: ['O'] }); });
await caso(`equipos · ${FINAL ? 'ya NO se leen' : 'todavía se leen'}`, FINAL ? 'falla' : 'pasa', getDoc(doc(como('O'), 'equipos/T')));

// ── FOTOS DEL PROYECTO (paso 5) ────────────────────────────────────────────
await sembrar();
await caso('fotosProyecto · el editor sube', 'pasa', setDoc(doc(como('E'), 'proyectos/P/fotosProyecto/f1'), { uid: 'E', url: 'x' }));
await caso('fotosProyecto · el supervisor NO sube', 'falla', setDoc(doc(como('S'), 'proyectos/P/fotosProyecto/f2'), { uid: 'S', url: 'x' }));
await caso('fotosProyecto · el supervisor ve', 'pasa', getDoc(doc(como('S'), 'proyectos/P/fotosProyecto/f0')));
await caso('fotosProyecto · un ajeno NO ve', 'falla', getDoc(doc(como('X'), 'proyectos/P/fotosProyecto/f0')));
await caso(`fotosProyecto · el editor viejo (compartidoCon) ${FINAL ? 'ya NO sube' : 'sube'}`, VIEJO, setDoc(doc(como('L'), 'proyectos/P/fotosProyecto/f3'), { uid: 'L', url: 'x' }));
await caso('fotosProyecto · el dueño sube', 'pasa', setDoc(doc(como('O'), 'proyectos/P/fotosProyecto/f4'), { uid: 'O', url: 'x' }));

await env.cleanup();
console.log(`\n${total - fallas}/${total} casos como se esperaba`);
console.log(fallas ? 'RESULTADO: MAL' : 'RESULTADO: OK');
process.exit(fallas ? 1 : 0);
