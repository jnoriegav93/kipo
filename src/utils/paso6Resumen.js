// Texto que muestra el panel del paso 6 (Admin) con la respuesta de la función `paso6`,
// para leerlo en el teléfono y pegarlo en el chat. Lógica pura: se prueba con Node.

const ACCIONES = {
  simular: 'SIMULACRO: no se escribió nada',
  completar: 'COMPLETAR: se agregaron miembros y nombres (no se borró nada)',
  limpiar: 'LIMPIAR: se guardó un respaldo y se borraron los campos viejos',
};

export const resumenPaso6 = (r) => {
  const nom = (u) => (r.nombres && r.nombres[u]) || u;
  const lineas = [
    ACCIONES[r.accion] || r.accion,
    `proyectos: ${r.total} · por completar: ${r.porCompletar} · con campos viejos: ${r.conViejos} · equipos: ${r.equipos}`,
  ];
  if (r.accion !== 'simular') lineas.push(`escritos: ${r.escritos}${r.accion === 'limpiar' ? ` · equipos borrados: ${r.equiposBorrados}` : ''}`);
  const soloViejos = (r.filas || []).filter(f => !f.porCompletar && !f.hecho);
  if (soloViejos.length) lineas.push(`${soloViejos.length} proyecto(s) solo tienen campos viejos: listos para limpiar`);
  lineas.push('');
  for (const f of (r.filas || [])) {
    if (!f.porCompletar && !f.hecho) continue;
    lineas.push(`${f.nombre || '(sin nombre)'}${f.archivado ? ' [archivado]' : ''}`);
    if (f.agregarDueno) lineas.push('  + el dueño, como miembro');
    for (const [u, rol] of Object.entries(f.agregar || {})) lineas.push(`  + ${nom(u)}: ${rol}`);
    if ((f.nombres || []).length) lineas.push(`  · nombres a pasar a miembros: ${f.nombres.map(nom).join(', ')}`);
    if ((f.faltanEnUids || []).length) lineas.push(`  · miembrosUids por completar: ${f.faltanEnUids.map(nom).join(', ')}`);
    if (f.hecho) lineas.push(`  → ${f.hecho}`);
  }
  return lineas.join('\n');
};
