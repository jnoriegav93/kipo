import { useState } from 'react';

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
