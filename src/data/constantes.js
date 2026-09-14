
// --- CONFIGURACIÓN ---
export const APP_VERSION = "v19.0-BBDD-Ready";

// --- FERRETERÍA BASE (global, gestionada por el admin en Firestore sistema/ferreteriaBase) ---
// Solo se MUESTRA el nombre; codigo y detalle se guardan internos (uso en reportes = después).
// Esta lista es la SEMILLA inicial que el admin carga desde su panel. Cada usuario puede
// AGREGAR sus propias ferreterías (solo nombre, locales, id 'f_...').
export const FERRETERIA_BASE_DEFAULT = [
  { id: 'b1',  nombre: 'AISLADOR',                          codigo: '1000079', detalle: 'AISLADOR' },
  { id: 'b2',  nombre: 'CLEVIS',                            codigo: '1000014', detalle: 'CLEVIS' },
  { id: 'b3',  nombre: 'FLEJE DE ACERO 3/4',                codigo: '1000046', detalle: 'FLEJE DE ACERO 3/4' },
  { id: 'b4',  nombre: 'HEBILLAS 3/4',                      codigo: '1000206', detalle: 'HEBILLA 3/4 (100 UND)' },
  { id: 'b5',  nombre: 'TREBOL',                            codigo: '1000131', detalle: 'TREBOL' },
  { id: 'b6',  nombre: 'TROMPO PLATINO',                    codigo: '',        detalle: 'TROMPO PLATINO' },
  { id: 'b7',  nombre: 'TEMPLADOR',                         codigo: '1000132', detalle: 'TEMPLADOR' },
  { id: 'b8',  nombre: 'BRAZO 40CM',                        codigo: '',        detalle: 'BRAZOS EXTENSOR DE 40CM' },
  { id: 'b9',  nombre: 'BRAZO 60CM',                        codigo: '1000058', detalle: 'BRAZOS EXTENSOR DE 60CM CP 1/2' },
  { id: 'b10', nombre: 'BRAZO 80CM',                        codigo: '',        detalle: 'BRAZOS EXTENSOR DE 80CM' },
  { id: 'b11', nombre: 'BRAZO 1M',                          codigo: '',        detalle: 'BRAZOS EXTENSOR DE 1M' },
  { id: 'b12', nombre: 'GRLLETE',                           codigo: '1000022', detalle: 'GRILLETE TIPO CANDADO (100 UND)' },
  { id: 'b13', nombre: 'CABLE MENSAJERO 1/8',               codigo: '1000012', detalle: 'CABLE MENSAJERO 1/8 (200 MTS)', porMetro: true },
  { id: 'b14', nombre: 'CHAPA Q',                           codigo: '1000145', detalle: 'SUJETADOR DE TRAMO-CHAPA Q' },
  { id: 'b15', nombre: 'CHAPA BRAQUELITA',                  codigo: '1000146', detalle: 'CHAPA SUSPENSIÓN DIELECTRICA-BRAQUELITA' },
  { id: 'b16', nombre: 'FAT11',                             codigo: '1056892', detalle: 'CIERRE DE EMPALME FAT SSC2816-SM-11U' },
  { id: 'b17', nombre: 'FAT9',                              codigo: '1056893', detalle: 'CIERRE DE EMPALME FAT  SSC2816-SM-9' },
  { id: 'b18', nombre: 'XBOX',                              codigo: '1056470', detalle: 'CIERRE DE EMPALME XBOX SSC2807-FX-12-B' },
  { id: 'b19', nombre: 'HBOX',                              codigo: '1056469', detalle: 'CIERRE DE EMPALMETE HUBBOX SSC2823-SH-16' },
  { id: 'b20', nombre: 'HERRAJE ITC',                       codigo: '1061542', detalle: 'HERRAJE ITC2102-P2 14261388 HW' },
  { id: 'b21', nombre: 'BRAZO CRUCETA',                     codigo: '1046852', detalle: 'HERRAJE DE MONTAJE POSTE FAT HUB BOX' },
  { id: 'b22', nombre: 'SUJETADOR PARA FAT',                codigo: '1000020', detalle: 'SUJETADOR PARA FAT' },
  { id: 'b23', nombre: 'CINTILLO METALICO',                codigo: '1000015', detalle: 'CINTILLO METÁLICO 16PULG (100 UND)' },
  { id: 'b24', nombre: 'CINTILLO PVC 10CM',                codigo: '1000044', detalle: 'CINTILLO PVC NEGRO 10CM (100 UND)' },
  { id: 'b25', nombre: 'CINTILLO PVC 30CM',                codigo: '1000041', detalle: 'CINTILLO PVC NEGRO 30CM (100 UND)' },
  { id: 'b26', nombre: 'CRUCETA 80CM',                     codigo: '1000019', detalle: 'CRUCETA DE 80CM' },
  { id: 'b27', nombre: 'CRUCETA 60CM',                     codigo: '',        detalle: 'CRUCETA DE 60CM' },
  { id: 'b28', nombre: 'ETIQUETA ROJA',                    codigo: '1000024', detalle: 'ETIQUETA CLARO (ROJA)' },
  { id: 'b29', nombre: 'CABLE PRECO 100M',                 codigo: '1046846', detalle: 'CABLE PRECONECTORIZADO DISTRIBUCION 100M' },
  { id: 'b30', nombre: 'CABLE PRECO 150M',                 codigo: '1046847', detalle: 'CABLE PRECONECTORIZADO DISTRIBUCION 150M' },
  { id: 'b31', nombre: 'CABLE PRECO 250M',                 codigo: '1046848', detalle: 'CABLE PRECONECTORIZADO DISTRIBUCION 250M' },
  { id: 'b32', nombre: 'CABLE PRECO 300M',                 codigo: '1056899', detalle: 'CABLE FO MPO PRECO EOCPAPC43 MPO 300M' },
  { id: 'b33', nombre: 'SPLITTER 90/10',                   codigo: '',        detalle: 'SPLITTER DESBALANCEADO 90/10' },
  { id: 'b34', nombre: 'SPLITTER 80/20',                   codigo: '',        detalle: 'SPLITTER DESBALANCEADO 80/20' },
  { id: 'b35', nombre: 'SPLITTER 70/30',                   codigo: '',        detalle: 'SPLITTER DESBALANCEADO 70/30' },
  { id: 'b36', nombre: 'SPLITTER 60/40',                   codigo: '',        detalle: 'SPLITTER DESBALANCEADO 60/40' },
  { id: 'b37', nombre: 'CHAPA 3 HUECOS',                   codigo: '1000030', detalle: 'CHAPA 3 HUECOS' },
  { id: 'b38', nombre: 'CABLE MENSAJERO 3/16',             codigo: '1000198', detalle: 'CABLE MENSAJERO 3/16', porMetro: true },
  { id: 'b39', nombre: 'PREFORMADO AZUL',                  codigo: '1000008', detalle: 'PREFORMADO AZUL 24H SPAN 250 (12.5MM)' },
  { id: 'b40', nombre: 'PREFORMADO ROJO 3/16',             codigo: '1000034', detalle: 'PREFORMADO ROJO 3/16' },
  { id: 'b41', nombre: 'PREFORMADO NEGRO',                 codigo: '',        detalle: 'PREFORMADO NEGRO' },
  { id: 'b42', nombre: 'PREFORMADO NARANJA',               codigo: '',        detalle: 'PREFORMADO NARANJA' },
  { id: 'b43', nombre: 'PREFORMADO VERDE',                 codigo: '',        detalle: 'PREFORMADO VERDE' },
  { id: 'b44', nombre: 'FLEJE DE ACERO BAND-IT 1/2',       codigo: '',        detalle: 'FLEJE DE ACERO BAND-IT 1/2' },
  { id: 'b45', nombre: 'HEBILLA BANDIT 1/2',               codigo: '',        detalle: 'HEBILLA BANDIT 1/2' },
  { id: 'b46', nombre: 'CHAPA DE SUSPENSION ESPECIAL ADSS', codigo: '',       detalle: 'CHAPA DE SUSPENSION ESPECIAL ADSS' },
  { id: 'b47', nombre: 'CAJA NAP 8P',                      codigo: '',        detalle: 'CAJA NAP 8P' },
  { id: 'b48', nombre: 'CAJA NAP 16P',                     codigo: '',        detalle: 'CAJA NAP 16P' },
  { id: 'b49', nombre: 'CAJA NAP 32P',                     codigo: '',        detalle: 'CAJA NAP 32P' },
  { id: 'b50', nombre: 'SPLITTER 1X2',                     codigo: '',        detalle: 'SPLITTER 1X2' },
  { id: 'b51', nombre: 'SPLITTER 1X4',                     codigo: '',        detalle: 'SPLITTER 1X4' },
  { id: 'b52', nombre: 'SPLITTER 1X8',                     codigo: '',        detalle: 'SPLITTER 1X8' },
  { id: 'b53', nombre: 'SPLITTER 1X16',                    codigo: '',        detalle: 'SPLITTER 1X16' },
  { id: 'b54', nombre: 'SPLITTER 1X32',                    codigo: '',        detalle: 'SPLITTER 1X32' },
  { id: 'b55', nombre: 'MUFA TIPO DOMO DE 48H',            codigo: '',        detalle: 'MUFA TIPO DOMO DE 48H' },
  { id: 'b56', nombre: 'MUFA TIPO DOMO DE 96H',            codigo: '',        detalle: 'MUFA TIPO DOMO DE 96H' },
  { id: 'b57', nombre: 'MUFA TIPO DOMO DE 144H',           codigo: '',        detalle: 'MUFA TIPO DOMO DE 144H' },
];

// Ítem del catálogo de un usuario a partir de uno de la base. Los que se tienden como
// cable (porMetro) van en metros: se liquidan por lo trazado en el mapa, no por poste.
export const itemDesdeBase = (b) => ({
  id: b.id, nombre: b.nombre, unidad: b.porMetro ? 'mts' : 'und', visible: true,
  codigo: b.codigo || '', detalle: b.detalle || '',
  ...(b.porMetro ? { porMetro: true } : {}),
});

// Ferreterías que "van juntas" (sugerencia interna, por nombre). Al ponerle cantidad a una
// en el punto, las demás del grupo salen resaltadas como sugerencia (sin forzar cantidad).
// Definido interno según los pares indicados (no editable por el usuario).
export const VINCULOS_FERRETERIA = [
  ['aislador', 'clevis'],
  ['fleje de acero 3/4', 'hebillas 3/4'],
  ['trebol', 'templador'],
  ['chapa q', 'chapa braquelita'],
  ['fat11', 'fat9', 'herraje itc'],
];

// --- DATOS INICIALES ---
export const DATA_INICIAL = {
  // La base ya NO va aquí (es global en Firestore). Aquí solo quedan las locales del usuario.
  catalogoFerreteria: [],
  armados: [],
  botonesPoste: {
    alturas: [{ v: 8, visible: true }, { v: 9, visible: true }, { v: 11, visible: true }, { v: 13, visible: true }, { v: 15, visible: true }],
    fuerzas: [{ v: 200, visible: true }, { v: 300, visible: true }, { v: 400, visible: true }, { v: 500, visible: true }],
    materiales: [{ v: 'Concreto', visible: true }, { v: 'Madera', visible: true }, { v: 'Fierro', visible: true }, { v: 'Fibra', visible: true }],
    tipos: [{ v: 'MT', visible: true }, { v: 'BT', visible: true }, { v: 'AT', visible: true }, { v: 'TEL', visible: true }],
    extras: [{ v: 'Saturado', visible: true }, { v: 'Transformador', visible: true }, { v: 'Brazo', visible: true }],
    cables: [{ v: '1', visible: true }, { v: '2', visible: true }, { v: '3', visible: true }, { v: '4', visible: true }, { v: '5', visible: true }],
    ferreteriaExtra: [{ v: '1 Pref', visible: true }, { v: '2 Pref', visible: true }, { v: '3 Pref', visible: true }, { v: 'Br 1m', visible: true }, { v: 'Br 80cm', visible: true }]
  }
};

export const COLORES_DIA = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ef4444'];
export const COLORES_PROYECTO = ['#f97316', '#3b82f6'];

// Paleta amplia para el color aleatorio inicial de cada proyecto (evita empezar
// siempre en naranja). Se excluyen tonos que chocan con símbolos especiales
// (amarillo = medio tramo, rojo puro = caja/equipo).
export const COLORES_DIA_POOL = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#14b8a6', '#8b5cf6', '#0ea5e9', '#22c55e', '#d946ef', '#f59e0b', '#06b6d4'];
export const colorDiaAleatorio = () => COLORES_DIA_POOL[Math.floor(Math.random() * COLORES_DIA_POOL.length)];
// Color para un día nuevo: hereda el del último día existente; si no hay, aleatorio.
export const colorParaNuevoDia = (dias) => {
  if (Array.isArray(dias) && dias.length > 0) {
    const ult = dias[dias.length - 1];
    if (ult && ult.color) return ult.color;
  }
  return colorDiaAleatorio();
};