import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import UpdateBanner from './components/UpdateBanner'
// CORRECCIÓN AQUÍ: Agregamos '/context' a la ruta
import { SyncProvider } from './context/SyncContext' 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SyncProvider>
      <App />
      <UpdateBanner />
    </SyncProvider>
  </StrictMode>,
)