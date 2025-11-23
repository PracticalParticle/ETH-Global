import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import './App.css'
import { formatEther } from 'viem'
import { CrossChainMessage } from './components/CrossChainMessage'

const ETHGLOBAL_IMAGE_URL = 'https://wrpcd.net/cdn-cgi/image/anim=false,fit=contain,f=auto,w=576/https%3A%2F%2Fi.imgur.com%2FQSXTrzX.jpg'

function App() {
  const { isConnected } = useAccount()
  const { data: balance } = useBalance()

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark font-display">
      <div className="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header with ETHGlobal Logo */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src={ETHGLOBAL_IMAGE_URL} 
            alt="ETHGlobal" 
            className="h-16 sm:h-20 mb-4 object-contain glass-card p-3 rounded-xl"
          />
          <h1 className="text-3xl sm:text-4xl font-bold text-center text-zinc-900 dark:text-white">
            ETHGlobal Hackathon
          </h1>
        </div>

        {/* Connection & Balance Card - Redesigned */}
        <div className="glass-card p-6 sm:p-8 mb-6 max-w-lg mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Connect Button */}
            <div className="w-full sm:w-auto connect-button-wrapper">
              <ConnectButton />
            </div>

            {/* Balance Display - Prominent */}
            {isConnected && balance && (
              <div className="flex flex-col items-center sm:items-end text-center sm:text-right bg-white/20 dark:bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/30 dark:border-white/15">
                <p className="text-xs sm:text-sm text-zinc-700 dark:text-gray-300 mb-1.5 font-semibold uppercase tracking-wide">
                  Wallet Balance
                </p>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-zinc-900 dark:text-white leading-tight">
                  {formatEther(balance.value)}
                </p>
                <p className="text-base sm:text-lg text-zinc-700 dark:text-gray-300 font-semibold mt-1">
                  {balance.symbol}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cross Chain Message Component - Always visible */}
        <div className="mt-6">
          <CrossChainMessage />
        </div>
      </div>
    </div>
  )
}

export default App

