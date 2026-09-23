// PASO 0 del rediseño de equipos: página SOLO LOCAL, fuera de la app (ver el comentario
// de medir-paso0.html). Cuenta en las colecciones de obra cuántos documentos tienen el
// `proyectoId` como número. Solo LEE: no hay una sola escritura en este archivo.
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection, query, where, limit, doc,
  getCountFromServer, getDocsFromServer, getDocFromServer,
} from 'firebase/firestore';
import { auth, db } from '../src/firebaseConfig';
import { COLECCIONES_OBRA, cuadrarConteos, agruparPorProyecto, textoResumen } from '../src/utils/datosViejos';

// Igual que Login.jsx: sin arroba, se completa con el dominio fijo.
const DOMINIO_FIJO = '@kipo.com';

// En Firestore un filtro de rango no cruza de un tipo a otro: `>= -MAX_VALUE` trae solo
// números y `>= ''` solo textos. Si esa suposición fallara, se delata sola: la suma pasa
// del total (`cuadra: false`) o aparecen `intrusos` que no son números.
const DESDE_NUMERO = -Number.MAX_VALUE;
const TOPE_DOCS = 5000;

const $ = (id) => document.getElementById(id);
const estado = (texto) => { $('estado').textContent = texto; };

const contar = async (q) => (await getCountFromServer(q)).data().count;

const medirColeccion = async (nombre) => {
  const col = collection(db, nombre);
  const [total, texto, numero, nulo] = await Promise.all([
    contar(col),
    contar(query(col, where('proyectoId', '>=', ''))),
    contar(query(col, where('proyectoId', '>=', DESDE_NUMERO))),
    contar(query(col, where('proyectoId', '==', null))),
  ]);
  let detalle = { grupos: [], intrusos: 0 };
  if (numero > 0) {
    const snap = await getDocsFromServer(query(col, where('proyectoId', '>=', DESDE_NUMERO), limit(TOPE_DOCS)));
    detalle = agruparPorProyecto(snap.docs.map(d => d.data()));
  }
  return {
    coleccion: nombre,
    ...cuadrarConteos({ total, texto, numero, nulo }),
    ...detalle,
    recortado: numero > TOPE_DOCS,
  };
};

// ¿El proyecto de cada número sigue existiendo? Solo importan los vivos: los de
// proyectos borrados ya hoy no se ven en ningún lado.
const resolverProyectos = async (ids) => {
  const salida = [];
  for (const id of ids) {
    try {
      const s = await getDocFromServer(doc(db, 'proyectos', String(id)));
      salida.push({ proyectoId: id, existe: s.exists(), nombre: s.exists() ? (s.data().nombre || '') : '' });
    } catch (e) {
      salida.push({ proyectoId: id, existe: null, nombre: '', error: e.code || e.message });
    }
  }
  return salida;
};

let ultimoResumen = '';

const medir = async () => {
  $('medir').disabled = true;
  $('copiar').disabled = true;
  $('resultado').hidden = true;
  try {
    const colecciones = [];
    for (const nombre of COLECCIONES_OBRA) {
      estado(`Contando ${nombre}…`);
      colecciones.push(await medirColeccion(nombre));
    }
    estado('Verificando si esos proyectos existen…');
    const ids = [...new Set(colecciones.flatMap(c => c.grupos.map(g => g.proyectoId)))];
    const proyectos = await resolverProyectos(ids);
    ultimoResumen = textoResumen({ colecciones, proyectos, medidoEn: new Date().toISOString() });
    $('resultado').textContent = ultimoResumen;
    $('resultado').hidden = false;
    $('copiar').disabled = false;
    estado('');
  } catch (e) {
    console.error(e);
    estado(`Falló la medición: ${e.code || e.message}`);
  }
  $('medir').disabled = false;
};

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

$('medir').addEventListener('click', medir);
$('salir').addEventListener('click', () => signOut(auth));
$('copiar').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ultimoResumen);
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
