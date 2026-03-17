import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import Results from './Results.jsx'
import './index.css'

// Vite sets import.meta.env.BASE_URL from the `base` config
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

// GitHub Pages 404 redirect: pick up ?route= param and navigate
const params = new URLSearchParams(window.location.search)
const redirectRoute = params.get('route')
if (redirectRoute) {
  params.delete('route')
  const remaining = params.toString()
  const newUrl = basename + redirectRoute + (remaining ? '?' + remaining : '') + window.location.hash
  window.history.replaceState(null, '', newUrl)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/results" element={<Results />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
