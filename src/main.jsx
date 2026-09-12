import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import UpdateBanner from './components/UpdateBanner'
import InstalarApp from './components/InstalarApp'
// Se importa antes de renderizar: el evento de instalación llega muy temprano
import './utils/instalacion'
// CORRECCIÓN AQUÍ: Agregamos '/context' a la ruta
import { SyncProvider } from './context/SyncContext' 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SyncProvider>
      <App />
      <UpdateBanner />
      <InstalarApp />
    </SyncProvider>
  </StrictMode>,
)