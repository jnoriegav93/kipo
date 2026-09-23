import { useEffect, useMemo, useState } from 'react';
import { escucharAmistades, escucharAvisos } from '../services/amigos';
import { clasificarAmistades } from '../utils/amigos';

const SIN_AMIGOS = { amigos: [], recibidas: [], enviadas: [] };

// Las amistades del usuario, ya repartidas en amigos, recibidas y enviadas
// (paso 3b del rediseño de equipos).
export const useAmigos = (uid) => {
  const [docs, setDocs] = useState([]);
  useEffect(() => (uid ? escucharAmistades(uid, setDocs) : undefined), [uid]);
  return useMemo(() => (uid ? clasificarAmistades(docs, uid) : SIN_AMIGOS), [docs, uid]);
};

// Los avisos que el usuario todavía no vio: por ejemplo, que lo agregaron a un proyecto.
export const useAvisos = (uid) => {
  const [avisos, setAvisos] = useState([]);
  useEffect(() => (uid ? escucharAvisos(uid, setAvisos) : undefined), [uid]);
  return uid ? avisos : [];
};
