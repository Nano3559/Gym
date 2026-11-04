import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import ApplicationEntry from './ApplicationEntry.jsx'
import { registerServiceWorker } from './lib/pwa.js'

registerServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ApplicationEntry />
  </StrictMode>,
)
