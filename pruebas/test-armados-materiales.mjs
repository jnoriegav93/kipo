// Prueba de src/utils/armadosMateriales.js: qué falta, qué se puede llevar y el flujo
// completo con un servidor, una confirmación y un aviso de mentira. Cada mutante TIENE
// que fallar algún caso.
import * as real from '../src/utils/armadosMateriales.js';

const CAT_OLGA = [{ id: 'b1', nombre: 'AISLADOR' }, { id: 'b2', nombre: 'CLEVIS' }];
const arm = (id, nombre, ...refs) => ({ id, nombre, items: refs.map(r => ({ idRef: r, cant: 1 })) });
const A1 = arm('a1', 'POSTE SIMPLE', 'b1', 'f_e1');   // usa un material de Eva
const A2 = arm('a2', 'RETENIDA', 'b2');               // todo lo tiene Olga
const A3 = arm('a3', 'EMPALME', 'f_x');               // usa un material que no existe
const A4 = arm('a4', 'CRUCE', 'f_e1', 'f_e2');

// Un servidor de mentira: Eva tiene f_e1 y f_e2; f_x no está en ninguna parte
const servidor = (registro, { pierde = [] } = {}) => async ({ ids, simular }) => {
  registro.push({ ids: [...ids], simular: !!simular });
  const de = { f_e1: 'CINTA EVA', f_e2: 'GRAPA EVA' };
  const quita = simular ? [] : pierde;
  return {
    agregados: ids.filter(i => de[i] && !quita.includes(i)).map(i => ({ id: i, nombre: de[i] })),
    sinOrigen: ids.filter(i => !de[i] || quita.includes(i)),
  };
};

const casos = async (m) => {
  const fallas = [];
  const igual = (nombre, obtenido, esperado) => {
    if (JSON.stringify(obtenido) !== JSON.stringify(esperado)) fallas.push(`${nombre}\n      esperaba ${JSON.stringify(esperado)}\n      salió    ${JSON.stringify(obtenido)}`);
  };
  const ids = (lista) => lista.map(a => a.id);

  igual('faltan: solo lo que el destino no tiene, sin repetir y ordenado', m.idsQueFaltan([A1, A4, A2], CAT_OLGA), ['f_e1', 'f_e2']);
  igual('faltan: nada', m.idsQueFaltan([A2], CAT_OLGA), []);
  igual('separar: el que usa algo sin origen no va', (({ sePueden, noSePueden }) => [ids(sePueden), ids(noSePueden)])(m.separarPorOrigen([A1, A3, A2], ['f_x'])), [['a1', 'a2'], ['a3']]);

  // Flujo
  const correr = async ({ armados, mismoCatalogo = false, responde = true, pierde } = {}) => {
    const llamadas = [], confirmaciones = [], avisos = [];
    const lista = await m.llevarArmados({
      armados, desde: 'mi', hacia: { proyectoId: 'P' }, catalogoDestino: CAT_OLGA, mismoCatalogo,
      destinoTexto: 'El catálogo de Olga',
      copiar: servidor(llamadas, { pierde }),
      confirmar: async (c) => { confirmaciones.push(c); return responde; },
      avisar: (a) => avisos.push(a),
    });
    return { lista: ids(lista), llamadas, confirmaciones, avisos };
  };

  {
    const r = await correr({ armados: [A2] });
    igual('sin faltantes: pasa directo, sin servidor ni confirmar', [r.lista, r.llamadas.length, r.confirmaciones.length], [['a2'], 0, 0]);
  }
  {
    const r = await correr({ armados: [A1, A2] });
    igual('con faltantes: simula, confirma y copia', r.llamadas.map(l => [l.ids, l.simular]), [[['f_e1'], true], [['f_e1'], false]]);
    igual('con faltantes: se llevan los dos', r.lista, ['a1', 'a2']);
    igual('la confirmación nombra el material y el destino', r.confirmaciones.length === 1
      && r.confirmaciones[0].mensaje.includes('El catálogo de Olga no tiene este material: CINTA EVA')
      && r.confirmaciones[0].accion === 'AGREGAR', true);
  }
  {
    const r = await correr({ armados: [A1, A2], responde: false });
    igual('si cancela: no copia y no lleva nada', [r.lista, r.llamadas.filter(l => !l.simular).length], [[], 0]);
  }
  {
    const r = await correr({ armados: [A1, A3, A4] });
    igual('sin origen: ese no va; los otros sí', r.lista, ['a1', 'a4']);
    igual('sin origen: solo copia lo de los que van', r.llamadas.filter(l => !l.simular).map(l => l.ids), [['f_e1', 'f_e2']]);
    igual('sin origen: se cuenta en la misma confirmación, sin otro aviso', [(r.confirmaciones[0]?.mensaje || '').includes('"EMPALME" no se lleva'), r.avisos.length], [true, 0]);
    igual('dos materiales: "estos 2 materiales"', (r.confirmaciones[0]?.mensaje || '').includes('estos 2 materiales: CINTA EVA, GRAPA EVA'), true);
  }
  {
    const r = await correr({ armados: [A3] });
    igual('solo sin origen: aviso, nada que confirmar ni copiar', [r.lista, r.confirmaciones.length, r.llamadas.filter(l => !l.simular).length, r.avisos.length], [[], 0, 0, 1]);
  }
  {
    const r = await correr({ armados: [A1, A3, A2], mismoCatalogo: true });
    igual('mismo catálogo: sin servidor; va lo que no tiene faltantes', [r.lista, r.llamadas.length], [['a2'], 0]);
    igual('mismo catálogo: avisa los que no van', r.avisos.length === 1 && r.avisos[0].mensaje.includes('"POSTE SIMPLE", "EMPALME" no se llevan'), true);
  }
  {
    const r = await correr({ armados: [A1, A4], pierde: ['f_e2'] });
    igual('si al copiar el origen perdió un material: ese armado no va, y se avisa', [r.lista, r.avisos.length], [['a1'], 1]);
  }
  return fallas;
};

const mutantes = {
  'cuenta lo que el destino ya tiene': { ...real, idsQueFaltan: (a) => real.idsQueFaltan(a, []) },
  'lleva también los sin origen': { ...real, separarPorOrigen: (a) => ({ sePueden: a, noSePueden: [] }) },
  'copia sin confirmar': { ...real, llevarArmados: (o) => real.llevarArmados({ ...o, confirmar: async () => true }) },
  'no simula antes': { ...real, llevarArmados: (o) => real.llevarArmados({ ...o, copiar: (x) => o.copiar({ ...x, simular: false }) }) },
  'mismo catálogo lo ignora': { ...real, llevarArmados: (o) => real.llevarArmados({ ...o, mismoCatalogo: false }) },
};

const fr = await casos(real);
console.log(`real: ${fr.length} falla(s)`); fr.forEach(f => console.log('  ✗ ' + f));
let todos = true;
for (const [n, m] of Object.entries(mutantes)) {
  let k; try { k = (await casos(m)).length; } catch (e) { k = 1; }
  console.log(`mutante «${n}» (TIENE que fallar): ${k} falla(s)`);
  if (!k) todos = false;
}
const ok = !fr.length && todos;
console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: MAL');
process.exit(ok ? 0 : 1);
