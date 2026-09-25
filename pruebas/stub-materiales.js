// La función copiarMateriales de mentira: anota cada llamada y responde lo que diga
// globalThis.__responderMateriales (una función de los argumentos).
export const copiarMateriales = async (args) => {
  (globalThis.__materiales ||= []).push(JSON.parse(JSON.stringify(args)));
  return globalThis.__responderMateriales(args);
};
