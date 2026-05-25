import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App' // Extension එක සහ අර ! ලකුණ අයින් කරා

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)