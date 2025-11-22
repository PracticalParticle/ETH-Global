import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import './App.css'
import { formatEther } from 'viem'

function App() {

  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({
    address: address,
  })

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-center mb-8">ETHGlobal Hackathon</h1>
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <div className="mb-4 w-full connect-button-wrapper">
            <ConnectButton />
          </div>
          {isConnected && (
            <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
              <p className="mb-2"><strong>Connected:</strong> {address}</p>
              {balance && (
                <p><strong>Balance:</strong> {formatEther(balance.value)} {balance.symbol}</p>
              )}
            </div>
          )}
          
          
        </div>
        {!isConnected && (
          <p className="text-center text-gray-400 mt-4">
            Connect your wallet to get started
          </p>
        )}
      </div>
    </div>
  )
}

export default App

