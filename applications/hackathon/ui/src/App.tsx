import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import './App.css'

function App() {

  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({
    address: address,
  })

  return (
    <>
      <div>
        <h1>Hackathon UI</h1>
        <div className="card">
          <div style={{ marginBottom: '1rem' }}>
            <ConnectButton />
          </div>
          {isConnected && (
            <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}>
              <p><strong>Connected:</strong> {address}</p>
              {balance && (
                <p><strong>Balance:</strong> {balance.formatted} {balance.symbol}</p>
              )}
            </div>
          )}
      
        
        </div>
        <p className="read-the-docs">
          Connect your wallet to get started
        </p>
      </div>
    </>
  )
}

export default App

