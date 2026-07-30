import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { initTelemetry } from '@/lib/telemetry'
import { initVersionCheck } from '@/lib/versionCheck'
import '@/index.css'

initTelemetry()
initVersionCheck()

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)