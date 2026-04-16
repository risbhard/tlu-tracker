import React from 'react'
import ReactDOM from 'react-dom/client'
import MiniTimer from './components/MiniTimer'
import './mini-timer.css'

ReactDOM.createRoot(document.getElementById('mini-timer-root')).render(
  <React.StrictMode>
    <MiniTimer />
  </React.StrictMode>,
)
