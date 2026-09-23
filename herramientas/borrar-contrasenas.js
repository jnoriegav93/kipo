// Borra las contraseñas que quedaron guardadas en texto plano en `usuarios/{email}`.
// Página SOLO LOCAL, fuera de la app (ver el comentario de borrar-contrasenas.html).
// Desde el 23/09, `crearUsuario` ya no las guarda: esto limpia las que había antes.
// ESCRIBE en la base, pero una sola cosa: quita el campo `password`. Nunca muestra
// una contraseña; solo los correos que la tienen guardada.
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDocsFromServer, updateDoc, deleteField } from 'firebase/firestore';
import { auth, db } from '../src/firebaseConfig';

// Igual que Login.jsx: sin arroba, se completa con el dominio fijo.
const DOMINIO_FIJO = '@kipo.com';

const $ = (id) => document.getElementById(id);
const estado = (texto) => { $('estado').textContent = texto; };

// Correos (ids de `usuarios`) que todavía tienen la contraseña guardada.
let pendientes = [];
let ultimoResultado = '';

const tieneContrasena = (datos) => Object.prototype.hasOwnProperty.call(datos, 'password');

// Siempre del servidor: la caché local podría decir que ya no hay y no ser cierto.
const revisar = async () => {
  const snap = await getDocsFromServer(collection(db, 'usuarios'));
  pendientes = snap.docs.filter(d => tieneContrasena(d.data())).map(d => d.id);
  return { total: snap.size, conContrasena: pendientes.length };
};

const mostrar = (lineas) => {
  ultimoResultado = lineas.join('\n');
  $('resultado').textContent = ultimoResultado;
  $('resultado').hidden = false;
  $('copiar').disabled = false;
};

const botones = (activos) => {
  $('revisar').disabled = !activos;
  $('borrar').disabled = !activos || pendientes.length === 0;
};

$('revisar').addEventListener('click', async () => {
  botones(false);
  estado('Revisando…');
  try {
    const r = await revisar();
    mostrar([
      `usuarios revisados: ${r.total}`,
      `con contraseña guardada: ${r.conContrasena}`,
      ...pendientes.map(correo => `  · ${correo}`),
    ]);
    estado(r.conContrasena === 0 ? 'No queda ninguna contraseña guardada.' : '');
  } catch (e) {
    estado(`Falló la revisión: ${e.code || e.message}`);
  }
  botones(true);
});

$('borrar').addEventListener('click', async () => {
  if (!pendientes.length) return;
  const n = pendientes.length;
  if (!window.confirm(`Se quitará la contraseña guardada de ${n} usuario(s). Sus cuentas no cambian: siguen entrando con su contraseña de siempre. ¿Continuar?`)) return;
  botones(false);
  const lineas = [];
  let ok = 0;
  for (const correo of pendientes) {
    estado(`Borrando ${lineas.length + 1} de ${n}…`);
    try {
      await updateDoc(doc(db, 'usuarios', correo), { password: deleteField() });
      ok++;
      lineas.push(`  ✓ ${correo}`);
    } catch (e) {
      lineas.push(`  ✗ ${correo}: ${e.code || e.message}`);
    }
  }
  // Se vuelve a leer del servidor para confirmar que de verdad no queda ninguna.
  estado('Verificando…');
  try {
    const r = await revisar();
    mostrar([
      `borradas: ${ok} de ${n}`,
      ...lineas,
      '',
      `verificación, con contraseña guardada: ${r.conContrasena}`,
      ...pendientes.map(correo => `  · ${correo}`),
    ]);
    estado(r.conContrasena === 0 ? 'Listo: no queda ninguna contraseña guardada.' : 'Quedaron algunas: revisa la lista.');
  } catch (e) {
    estado(`Falló la verificación: ${e.code || e.message}`);
  }
  botones(true);
});

$('login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  let correo = $('usuario').value.trim();
  if (!correo.includes('@')) correo += DOMINIO_FIJO;
  estado('Entrando…');
  try {
    await signInWithEmailAndPassword(auth, correo, $('clave').value);
    $('clave').value = '';
    estado('');
  } catch (e) {
    estado(`No se pudo entrar: ${e.code || e.message}`);
  }
});

$('salir').addEventListener('click', () => signOut(auth));
$('copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ultimoResultado);
    estado('Copiado. Pégalo en el chat.');
  } catch {
    estado('No se pudo copiar: selecciona el texto a mano.');
  }
});

onAuthStateChanged(auth, (usuario) => {
  $('login').hidden = !!usuario;
  $('sesion').hidden = !usuario;
  $('quien').textContent = usuario ? `Sesión: ${usuario.email}` : '';
});
