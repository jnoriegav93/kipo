import { useState } from 'react';
import { TRAZO_ACERO_VACIO } from '../utils/cablesAcero';

export const useUIState = () => {
    // Estados UI
    const [vista, setVista] = useState('mapa');
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [modalCodigoAbierto, setModalCodigoAbierto] = useState(false);
    const [puntoTemporal, setPuntoTemporal] = useState(null);
    const [modoFibra, setModoFibra] = useState(false);
    const [dibujandoFibra, setDibujandoFibra] = useState(false);
    const [capacidadFibra, setCapacidadFibra] = useState(12);
    const [fibrasVisibles, setFibrasVisibles] = useState(true);
    const [puntosRecorrido, setPuntosRecorrido] = useState([]);
    const [puntoSeleccionado, setPuntoSeleccionado] = useState(null);
    const [conexionSeleccionada, setConexionSeleccionada] = useState(null);
    const [conexionesOcultas, setConexionesOcultas] = useState([]);
    // Cable de acero: se dibuja desde la misma barra que la fibra, pero es otra capa
    const [modoLinea, setModoLinea] = useState('fibra');          // 'fibra' | 'acero'
    const [trazoAcero, setTrazoAcero] = useState(TRAZO_ACERO_VACIO); // postes, fibras y medio tramo tocados
    const [cableAceroSeleccionado, setCableAceroSeleccionado] = useState(null);
    const [acerosVisibles, setAcerosVisibles] = useState(true);
    const [tipoAceroId, setTipoAceroId] = useState(null);         // último tipo usado
    const [modoEdicion, setModoEdicion] = useState(false);
    const [modoLectura, setModoLectura] = useState(false);
    const [configTab, setConfigTab] = useState('armados');
    const [selectorColorAbierto, setSelectorColorAbierto] = useState(null);
    const [acordeonAbierto, setAcordeonAbierto] = useState('armados_vis');


  // Modales
  const [modalOpen, setModalOpen] = useState(null);
  const [tempData, setTempData] = useState({});
  const [confirmData, setConfirmData] = useState(null);
  const [alertData, setAlertData] = useState(null);
  const [exportData, setExportData] = useState(null);

return {
    vista, setVista,
    menuAbierto, setMenuAbierto,
    modalCodigoAbierto, setModalCodigoAbierto,
    puntoTemporal, setPuntoTemporal,
    modoFibra, setModoFibra,
    dibujandoFibra, setDibujandoFibra,
    capacidadFibra, setCapacidadFibra,
    fibrasVisibles, setFibrasVisibles,
    puntosRecorrido, setPuntosRecorrido,
    puntoSeleccionado, setPuntoSeleccionado,
    conexionSeleccionada, setConexionSeleccionada,
    conexionesOcultas, setConexionesOcultas,
    modoLinea, setModoLinea,
    trazoAcero, setTrazoAcero,
    cableAceroSeleccionado, setCableAceroSeleccionado,
    acerosVisibles, setAcerosVisibles,
    tipoAceroId, setTipoAceroId,
    modoEdicion, setModoEdicion,
    modoLectura, setModoLectura,
    configTab, setConfigTab,
    selectorColorAbierto, setSelectorColorAbierto,
    acordeonAbierto, setAcordeonAbierto,
    modalOpen, setModalOpen,
    tempData, setTempData,
    confirmData, setConfirmData,
    alertData, setAlertData,
    exportData, setExportData
  };
};
