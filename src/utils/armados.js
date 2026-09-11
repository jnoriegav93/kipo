// Materiales que se guardan de un armado, en el orden elegido.
// Entra una ferretería si tiene cantidad, o si tiene tipo aunque su cantidad sea 0:
// así es como se marcan las SECUNDARIAS.
export const construirItems = (tempData = {}, catalogo = []) => {
  const { itemsSeleccion = {}, listaOrden } = tempData;
  const orden = listaOrden || catalogo.map(f => f.id);
  return orden
    .filter(id => {
      const s = itemsSeleccion[id];
      if (!s) return false;
      return (s.cant || 0) > 0 || (s.tipo && s.tipo !== 'none');
    })
    .map(id => ({ idRef: id, cant: itemsSeleccion[id].cant || 0, tipo: itemsSeleccion[id].tipo || 'primaria' }));
};
