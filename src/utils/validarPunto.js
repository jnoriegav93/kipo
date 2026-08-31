// Validación de datos mínimos de un punto al guardar (formulario principal y Revisión).
// Devuelve un string con el mensaje de error, o null si está todo OK.
import { equiposDePunto, EQUIPOS_CON_SERIE, LABEL_EQUIPO } from './equiposPasivos';

export const validarPunto = (datos) => {
  const d = datos || {};
  const numero = (d.numero || '').toString().trim();
  const pasivo = (d.pasivo || '').toString().trim();
  const raw = d.tipoElemento;
  const tipos = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const esMedioTramo = tipos.includes('medioTramo');
  const tieneEqPasivo = EQUIPOS_CON_SERIE.some(x => tipos.includes(x));

  if (!numero) return 'Falta el ITEM: escribe su valor.';
  if (!esMedioTramo && !d.tipoPoste) return 'Falta el PROPIETARIO: marca EMP. TELECO, EMP. ELÉCTRICA o PROPIO.';
  // Cada equipo pasivo marcado exige SU propio código de pasivo
  const sinCodigo = equiposDePunto(d).filter(e => !String(e.pasivo || '').trim());
  if (sinCodigo.length) {
    const nombres = sinCodigo.map(e => LABEL_EQUIPO[e.tipo] || e.tipo).join(', ');
    return `Falta el EQ. PASIVO de: ${nombres}.`;
  }
  if (pasivo && !tieneEqPasivo) return 'Escribiste el EQ. PASIVO: marca uno de los equipos (MUFA/XBOX/HBOX/FAT).';
  return null;
};
