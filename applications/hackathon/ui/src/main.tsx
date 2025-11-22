import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import '@rainbow-me/rainbowkit/styles.css'
import { CustomWagmiProvider } from './components/WagmiProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CustomWagmiProvider>
      <App />
    </CustomWagmiProvider>
  </React.StrictMode>,
)

