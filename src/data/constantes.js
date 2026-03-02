
// --- CONFIGURACIÓN ---
export const APP_VERSION = "v19.0-BBDD-Ready";

// --- DATOS INICIALES ---
export const DATA_INICIAL = {
  catalogoFerreteria: [
    { id: 'f1', nombre: 'Clevis Tipo D', unidad: 'und' },
    { id: 'f2', nombre: 'Aislador Carrete', unidad: 'und' },
    { id: 'f3', nombre: 'Fleje Acero 1/2', unidad: 'mts' },
    { id: 'f4', nombre: 'Hebilla Bandit 1/2', unidad: 'und' },
    { id: 'f5', nombre: 'Chapa Susp. ADSS', unidad: 'und' },
    { id: 'f6', nombre: 'Preformado Rojo', unidad: 'und' },
    { id: 'f7', nombre: 'Clamp 3 Bolt', unidad: 'und' },
    { id: 'f8', nombre: 'Cruceta 80cm', unidad: 'und' },
    { id: 'f9', nombre: 'Cruceta 60cm', unidad: 'und' },
    { id: 'f10', nombre: 'Mufa 48', unidad: 'und' },
    { id: 'f11', nombre: 'Mufa 96', unidad: 'und' },
    { id: 'f12', nombre: 'Cintillo 30cm', unidad: 'und' },
    { id: 'f13', nombre: 'Caja NAP x8', unidad: 'und' },
    { id: 'f14', nombre: 'Caja NAP x16', unidad: 'und' },
  ],
  armados: [
    { id: 'a1', nombre: 'Retención', items: [{ idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f3', cant: 1.8 }, { idRef: 'f4', cant: 2 }] },
    { id: 'a2', nombre: 'Suspensión', items: [{ idRef: 'f5', cant: 1 }, { idRef: 'f1', cant: 1 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a3', nombre: 'Medio Tramo', items: [{ idRef: 'f1', cant: 1 }, { idRef: 'f2', cant: 1 }, { idRef: 'f3', cant: 1.8 }, { idRef: 'f4', cant: 2 }, { idRef: 'f6', cant: 2 }, { idRef: 'f7', cant: 1 }] },
    { id: 'a4', nombre: 'Reserva', items: [{ idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f8', cant: 1 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a5', nombre: 'Mufa 48', items: [{ idRef: 'f10', cant: 1 }, { idRef: 'f8', cant: 1 }, { idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f12', cant: 5 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a6', nombre: 'Mufa 96', items: [{ idRef: 'f11', cant: 1 }, { idRef: 'f8', cant: 1 }, { idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f12', cant: 5 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a7', nombre: 'NAP x8', items: [{ idRef: 'f13', cant: 1 }, { idRef: 'f9', cant: 1 }, { idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f12', cant: 5 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] },
    { id: 'a8', nombre: 'NAP x16', items: [{ idRef: 'f14', cant: 1 }, { idRef: 'f9', cant: 1 }, { idRef: 'f1', cant: 2 }, { idRef: 'f2', cant: 2 }, { idRef: 'f12', cant: 5 }, { idRef: 'f3', cant: 3.6 }, { idRef: 'f4', cant: 4 }] }
  ],
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