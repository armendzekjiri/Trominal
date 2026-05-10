import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { MobileApp } from './layouts/mobile/MobileApp'
import { isMobile } from './lib/platform'
import './styles.css'

const Root = isMobile ? MobileApp : App

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
