// PASO 2 del rediseño de equipos: corre la función `migrarMiembros` (solo admin).
// Página SOLO LOCAL, fuera de la app (ver el comentario de migrar-miembros.html).
// SIMULAR no escribe nada. MIGRAR escribe los miembros de cada proyecto. VERIFICAR
// vuelve a simular: después de migrar tiene que decir "con cambios: 0".
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../src/firebaseConfig';

// Igual que Login.jsx: sin arroba, se completa con el dominio fijo.
const DOMINIO_FIJO = '@kipo.com';
const migrarMiembros = httpsCallable(getFunctions(app, 'us-central1'), 'migrarMiembros', { timeout: 300000 });

const $ = (id) => document.getElementById(id);
const estado = (texto) => { $('estado').textContent = texto; };
const ROL = { dueno: 'dueño', editor: 'editor' };

let ultimoResultado = '';
let pendientes = 0; // proyectos con cambios en la última simulación

// Solo agregar al dueño es lo que le pasa a casi todos los proyectos: eso se cuenta en
// una línea. Se detalla lo que conviene revisar: editores, supervisores y avisos.
const soloDueno = (f) => {
  const roles = Object.values(f.agregar);
  return roles.length === 1 && roles[0] === 'dueno' && !f.omitidos.length && !f.avisos.length;
};

const resumen = (r) => {
  const nom = (u) => r.nombres[u] || u;
  const lineas = [
    r.simulacro ? 'SIMULACRO: no se escribió nada' : `MIGRACIÓN: se escribieron ${r.escritos} proyecto(s)`,
    `proyectos: ${r.total} · con cambios: ${r.conCambios}`,
  ];
  const conCambios = r.filas.filter(f => Object.keys(f.agregar).length || f.omitidos.length || f.avisos.length);
  const simples = conCambios.filter(soloDueno);
  const aRevisar = conCambios.filter(f => !soloDueno(f));
  if (simples.length) lineas.push(`${simples.length} proyecto(s) solo suman a su dueño`);
  lineas.push('');
  for (const f of aRevisar) {
    const marcas = [f.archivado ? 'archivado' : '', f.equipo ? 'de equipo' : ''].filter(Boolean).join(', ');
    lineas.push(`${f.nombre || '(sin nombre)'}${marcas ? ` [${marcas}]` : ''}`);
    for (const [u, rol] of Object.entries(f.agregar)) lineas.push(`  + ${nom(u)}: ${ROL[rol] || rol}`);
    for (const o of f.omitidos) lineas.push(`  · ${nom(o.uid)}: NO se migra (permiso ${o.permiso || 'ninguno'}), hay que reinvitarlo`);
    for (const a of f.avisos) lineas.push(`  ⚠ ${a}`);
  }
  return lineas.join('\n');
};

const mostrar = (texto) => {
  ultimoResultado = texto;
  $('resultado').textContent = texto;
  $('resultado').hidden = false;
  $('copiar').disabled = false;
};

const botones = (activos) => {
  $('simular').disabled = !activos;
  $('verificar').disabled = !activos;
  $('migrar').disabled = !activos || pendientes === 0;
};

const correr = async (simulacro, textoEspera) => {
  botones(false);
  estado(textoEspera);
  try {
    const { data } = await migrarMiembros({ simulacro });
    pendientes = data.simulacro ? data.conCambios : 0;
    mostrar(resumen(data));
    estado(data.simulacro && data.conCambios === 0 ? 'Nada que migrar: todos los proyectos ya tienen sus miembros.' : '');
  } catch (e) {
    estado(`Falló: ${e.code || ''} ${e.message || ''}`.trim());
  }
  botones(true);
};

$('simular').addEventListener('click', () => correr(true, 'Simulando…'));
$('verificar').addEventListener('click', () => correr(true, 'Verificando…'));
$('migrar').addEventListener('click', () => {
  if (!pendientes) return;
  if (!window.confirm(`Se escribirán los miembros en ${pendientes} proyecto(s). Solo se agrega: no se borra ni se cambia nada de lo que hay. ¿Continuar?`)) return;
  correr(false, 'Migrando…');
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
