import { useState, useRef } from 'react';

export const useFormulario = () => {
  const [memoriaUltimoPunto, setMemoriaUltimoPunto] = useState(null);

  const [datosFormulario, setDatosFormulario] = useState({
    codigo: '',
    suministro: '',
    numero: '',
    codFat: '',      // Aseguramos que este exista
    codPoste: '',    // Aseguramos que este exista
    altura: null,
    fuerza: null,
    material: null,
    tipo: null,
    cables: null,

    // ARRAYS Y OBJETOS OBLIGATORIOS (Evitan el crash)
    extrasSeleccionados: [],
    armadosSeleccionados: [], // <--- ESTE FALTABA y causaba el error .some()
    ferreteriaExtra: {},      // <--- El nuevo objeto de contadores

    fotos: {},                // OBJETOS (PhotoManager - Estructurado)
    fotosGenerales: [],       // ARRAY (Cámara inferior - Legacy/General)
    observaciones: ''
  });


  const inputCamaraRef = useRef(null);

  return {
    memoriaUltimoPunto,
    setMemoriaUltimoPunto,
    datosFormulario,
    setDatosFormulario,
    inputCamaraRef
  };
};