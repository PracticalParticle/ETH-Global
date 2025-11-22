import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import './App.css'
import { formatEther } from 'viem'
import { CrossChainMessage } from './components/CrossChainMessage'

function App() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({
    address: address,
  })

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <div className="max-w-4xl w-full mx-auto p-4">
        <h1 className="text-4xl font-bold text-center mb-8 text-zinc-900 dark:text-white">ETHGlobal Hackathon</h1>
        <div className="bg-gray-200/50 dark:bg-zinc-800/50 rounded-xl p-6 shadow-lg mb-6">
          <div className="mb-4 w-full connect-button-wrapper">
            <ConnectButton />
          </div>
          {isConnected && (
            <div className="mb-4 p-4 bg-gray-200/50 dark:bg-zinc-700/50 rounded-lg">
              <p className="mb-2 text-zinc-900 dark:text-white">
                <strong>Connected:</strong> {address}
              </p>
              {balance && (
                <p className="text-zinc-900 dark:text-white">
                  <strong>Balance:</strong> {formatEther(balance.value)} {balance.symbol}
                </p>
              )}
            </div>
          )}
        </div>
        {!isConnected && (
          <p className="text-center text-zinc-600 dark:text-gray-400 mb-6">
            Connect your wallet to get started
          </p>
        )}
        {isConnected && (
          <div className="mt-6">
            <CrossChainMessage />
          </div>
        )}
      </div>
    </div>
  )
}

export default App

