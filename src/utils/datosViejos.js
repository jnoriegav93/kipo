// PASO 0 del rediseño de equipos (ver CONTEXTO.md): ¿cuántos postes, fibras y cables
// tienen el `proyectoId` escrito como NÚMERO? La escucha nueva va a pedir "todo lo del
// proyecto X" comparando texto, así que esos dejarían de aparecer aunque existan.
//
// Solo lógica pura, sin Firebase, para poder probarla con Node. Las consultas viven en
// herramientas/medir-paso0.js, que es una página aparte: no forma parte de la app.

export const COLECCIONES_OBRA = ['puntos', 'conexiones', 'cablesAcero'];

// Qué guarda `proyectoId` en un documento.
export const tipoProyectoId = (valor) => {
  if (valor === undefined) return 'ausente';
  if (valor === null) return 'nulo';
  if (typeof valor === 'string') return 'texto';
  if (typeof valor === 'number') return 'numero';
  return 'otro';
};

// Los cuatro conteos de una colección y lo que queda sin contar: documentos sin el
// campo o con un tipo raro. Si la suma pasa del total, alguna consulta contó de más y
// la medición NO sirve: se marca, en vez de mostrar un número falso.
export const cuadrarConteos = ({ total, texto, numero, nulo }) => {
  const resto = total - texto - numero - nulo;
  return { total, texto, numero, nulo, resto, cuadra: resto >= 0 };
};

// Los documentos con proyecto numérico, agrupados por proyecto. Los que no son de
// verdad números se cuentan aparte como `intrusos`: si aparece uno, la consulta por
// rango trajo algo que no debía, y tampoco hay que creerle al conteo.
export const agruparPorProyecto = (docs) => {
  const grupos = new Map();
  let intrusos = 0;
  for (const d of docs) {
    if (tipoProyectoId(d?.proyectoId) !== 'numero') { intrusos++; continue; }
    grupos.set(d.proyectoId, (grupos.get(d.proyectoId) || 0) + 1);
  }
  const lista = [...grupos]
    .map(([proyectoId, n]) => ({ proyectoId, n }))
    .sort((a, b) => b.n - a.n || a.proyectoId - b.proyectoId);
  return { grupos: lista, intrusos };
};

// Qué hacer con lo medido.
//  - 'no-confiable': los conteos no cuadran o la consulta trajo intrusos.
//  - 'limpio': nada tiene el proyecto como número.
//  - 'solo-borrados': lo numérico es de proyectos que ya no existen; hoy tampoco se ve.
//  - 'hay-que-normalizar': hay documentos de proyectos vivos que desaparecerían.
// Un proyecto que no se pudo verificar cuenta como vivo: ante la duda, se normaliza.
// Lo mismo si la lista salió recortada, porque ahí no se sabe de quién es el resto.
export const veredicto = (colecciones, proyectos = []) => {
  if (colecciones.some(c => !c.cuadra || c.intrusos > 0)) return 'no-confiable';
  if (colecciones.some(c => c.recortado)) return 'hay-que-normalizar';
  const numericos = colecciones.flatMap(c => c.grupos);
  if (!numericos.length) return 'limpio';
  const existe = new Map(proyectos.map(p => [p.proyectoId, p.existe]));
  const algunoVivo = numericos.some(g => existe.get(g.proyectoId) !== false);
  return algunoVivo ? 'hay-que-normalizar' : 'solo-borrados';
};

const EXPLICACION = {
  'no-confiable': 'NO CONFIABLE: los conteos no cuadran. No decidir nada con esta medición.',
  'limpio': 'LIMPIO: nada tiene el proyecto como número. Se sigue directo.',
  'solo-borrados': 'SOLO DE PROYECTOS BORRADOS: ya hoy no se ven. No hace falta normalizar.',
  'hay-que-normalizar': 'HAY QUE NORMALIZAR antes de cambiar la escucha.',
};

// Resumen en texto plano, para leerlo en pantalla y pegarlo en el chat.
export const textoResumen = ({ colecciones, proyectos = [], medidoEn }) => {
  const porId = new Map(proyectos.map(p => [p.proyectoId, p]));
  const lineas = [
    'PASO 0: proyectoId guardado como número',
    `medido: ${medidoEn}`,
    EXPLICACION[veredicto(colecciones, proyectos)],
    '',
  ];
  for (const c of colecciones) {
    lineas.push(`${c.coleccion}: total ${c.total} · texto ${c.texto} · número ${c.numero}`
      + ` · nulo ${c.nulo} · sin campo u otro ${c.resto}${c.cuadra ? '' : '  ⚠ NO CUADRA'}`);
    if (c.intrusos) lineas.push(`  ⚠ ${c.intrusos} documento(s) traídos como número sin serlo`);
    if (c.recortado) lineas.push('  ⚠ hay más documentos de los que se listan abajo');
    for (const g of c.grupos) {
      const p = porId.get(g.proyectoId);
      const estado = p?.existe === true ? `vivo: ${p.nombre || 'sin nombre'}`
        : p?.existe === false ? 'proyecto borrado'
        : `sin verificar${p?.error ? ` (${p.error})` : ''}`;
      lineas.push(`  · proyecto ${g.proyectoId}: ${g.n} (${estado})`);
    }
  }
  return lineas.join('\n');
};
