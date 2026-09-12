// ── PERFILES = NIVELES de capacidad del usuario ───────────────────────────────
// BÁSICO   → solo proyectos de LEVANTAMIENTO.
// ESTÁNDAR → + tipos de red (DESB. PRECO / DESB. MECÁNICA / BALANCEADA) e
//            INSTALACIÓN; exporta solo formatos base (Excel detallado, ZIP, KMZ).
// AVANZADO → todo + listados y reportes fotográficos (plantillas personalizadas).
//
// Ids LEGACY en la BBDD (no se migran, se normalizan al leer):
//   'base'  → basico   (el antiguo perfil base)
//   'claro' → avanzado (los usuarios actuales conservan todo)

export const PERFILES = [
  { id: 'basico',   label: 'BÁSICO' },
  { id: 'estandar', label: 'ESTÁNDAR' },
  { id: 'avanzado', label: 'AVANZADO' },
];

export const normalizarPerfil = (p) => {
  if (p === 'base' || p === 'basico') return 'basico';
  if (p === 'estandar') return 'estandar';
  return 'avanzado'; // 'claro', vacío o desconocido → avanzado
};

export const etiquetaPerfil = (p) =>
  PERFILES.find(x => x.id === normalizarPerfil(p))?.label || 'AVANZADO';

// ── TIPOS de proyecto ─────────────────────────────────────────────────────────
// LEVANTAMIENTO (formulario reducido, sin eq. pasivo) · DESB. PRECO (id legacy
// 'liquidacion', la config completa actual) · DESB. MECÁNICA y BALANCEADA
// (CASCARONES: heredan la conducta de preco; balanceada suma el botón NAP) ·
// INSTALACIÓN DE POSTES.
export const TIPOS_RED = ['liquidacion', 'desbMecanica', 'balanceada'];
export const esTipoRed = (t) => TIPOS_RED.includes(t);
// Conducta que hereda un tipo (los switches viejos por 'liquidacion' usan esto)
export const tipoBase = (t) => (t === 'desbMecanica' || t === 'balanceada') ? 'liquidacion' : (t || 'levantamiento');
