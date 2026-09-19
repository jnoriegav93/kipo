// RENUMERAR ITEMS: la cuenta, sin nada de interfaz, para poder probarla con Node.
//
// Reescribe SOLO `datos.numero` (el ITEM), siguiendo el orden de posición del proyecto
// (`datos.ordenTendido`). Tres correlativos independientes: POSTES · CÁMARAS · MEDIOS
// TRAMOS, cada uno con su prefijo, su número de arranque y su relleno de ceros.
//
// El alcance decide con qué puntos se trabaja:
//   'conPosicion' → solo los que tienen posición asignada (lo normal)
//   'todos'       → también los que no la tienen, que van al final por orden de creación
//
// Al dejar puntos fuera aparece un riesgo: los que no se renumeran CONSERVAN su item, y
// ese item puede ser el mismo que el correlativo nuevo le da a otro. Eso son los
// conflictos, y se resuelven agregando una `b` al final del item del que se queda fuera
// (`P50` → `P50b`); si esa también estuviera ocupada, se sigue agregando (`P50bb`), para
// no cambiar un duplicado por otro.

export const SUFIJO_CONFLICTO = 'b';

// Para comparar items: lo que un humano leería igual, cuenta igual
export const normalizarItem = (v) => String(v ?? '').trim().toUpperCase();

// MEDIO TRAMO manda sobre todo; CÁMARA manda sobre equipo pasivo; el resto es POSTE
export const grupoDePunto = (d) => {
  const raw = d?.tipoElemento;
  const tipos = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  if (tipos.includes('medioTramo')) return 'mediosTramos';
  if (tipos.includes('camara')) return 'camaras';
  return 'postes';
};

export const tienePosicion = (p) => p?.datos?.ordenTendido != null;

export const formatearItem = (cfg, n) => {
  const num = cfg?.ceros > 0 ? String(n).padStart(cfg.ceros, '0') : String(n);
  return `${cfg?.prefijo || ''}${num}`;
};

// Orden general: por posición y, los que no la tienen, al final por orden de creación
export const ordenarPuntos = (puntos = []) => [...puntos].sort((a, b) => {
  const oa = a.datos?.ordenTendido, ob = b.datos?.ordenTendido;
  if (oa != null && ob != null) return oa - ob;
  if (oa != null) return -1;
  if (ob != null) return 1;
  return (parseInt(a.id) || 0) - (parseInt(b.id) || 0);
});

export const contarPorGrupo = (puntos = []) => {
  const t = { postes: 0, camaras: 0, mediosTramos: 0 };
  puntos.forEach(p => { t[grupoDePunto(p.datos)] += 1; });
  return t;
};

// Todo lo que la pantalla necesita saber, de una sola pasada.
// Devuelve:
//   filas       → los que reciben item nuevo: { id, grupo, antes, despues }
//   renombres   → los que quedan fuera y chocaban: mismo formato, con la `b` agregada
//   conflictos  → cuántos son (renombres.length), para el aviso
//   totalPorGrupo → cuántos puntos toca cada grupo DENTRO del alcance elegido
//   totales     → { conPosicion, sinPosicion, todos }, para los dos botones del alcance
export const calcularRenumeracion = ({ puntos = [], cfg, alcance = 'conPosicion' }) => {
  const ordenados = ordenarPuntos(puntos);
  const conPos = ordenados.filter(tienePosicion);
  const totales = {
    conPosicion: conPos.length,
    sinPosicion: ordenados.length - conPos.length,
    todos: ordenados.length,
  };

  const enAlcance = alcance === 'todos' ? ordenados : conPos;

  // Los correlativos corren solo sobre lo que entra en el alcance
  const contadores = {
    postes: cfg?.postes?.desde ?? 1,
    camaras: cfg?.camaras?.desde ?? 1,
    mediosTramos: cfg?.mediosTramos?.desde ?? 1,
  };
  const filas = [];
  const renumerados = new Set();
  enAlcance.forEach(p => {
    const g = grupoDePunto(p.datos);
    if (!cfg?.[g]?.activo) return;
    const despues = formatearItem(cfg[g], contadores[g]);
    contadores[g] += 1;
    renumerados.add(String(p.id));
    filas.push({ id: p.id, grupo: g, antes: p.datos?.numero || '(sin item)', despues });
  });

  // Fuera quedan tanto los que el alcance dejó afuera como los de grupos sin marcar:
  // todos conservan su item, así que todos pueden chocar.
  const nuevos = new Set(filas.map(f => normalizarItem(f.despues)));
  const fuera = ordenados.filter(p => !renumerados.has(String(p.id)));

  // Dos pases: primero se apartan los items que se quedan como están (aunque no choquen),
  // para que ningún renombre aterrice encima de uno de ellos.
  const chocan = [];
  const ocupados = new Set(nuevos);
  fuera.forEach(p => {
    const actual = p.datos?.numero;
    if (!actual) return;                       // sin item no hay con qué chocar
    if (nuevos.has(normalizarItem(actual))) chocan.push(p);
    else ocupados.add(normalizarItem(actual));
  });

  const renombres = [];
  chocan.forEach(p => {
    const actual = p.datos.numero;
    let candidato = `${actual}${SUFIJO_CONFLICTO}`;
    while (ocupados.has(normalizarItem(candidato))) candidato += SUFIJO_CONFLICTO;
    ocupados.add(normalizarItem(candidato));
    renombres.push({ id: p.id, grupo: grupoDePunto(p.datos), antes: actual, despues: candidato });
  });

  return {
    filas,
    renombres,
    conflictos: renombres.length,
    totalPorGrupo: contarPorGrupo(enAlcance),
    totales,
  };
};
