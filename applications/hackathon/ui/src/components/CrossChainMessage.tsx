import { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { isAddress } from 'viem'
import { ChainSelector } from './ChainSelector'
import { AddressInput } from './AddressInput'
import { getNativeTokenSymbol, LAYERZERO_EIDS } from '../lib/chains'

export function CrossChainMessage() {
  const { address, chainId } = useAccount()
  const publicClient = usePublicClient()
  
  const [destinationChainId, setDestinationChainId] = useState<number | undefined>()
  const [receiverAddress, setReceiverAddress] = useState('')
  const [message, setMessage] = useState('')
  const [ensName, setEnsName] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  // Set default destination chain (different from source chain)
  useEffect(() => {
    if (!destinationChainId && chainId) {
      // Default to sepolia if on mainnet, mainnet if on sepolia
      const defaultDest = chainId === 1 ? 11155111 : chainId === 11155111 ? 1 : undefined
      if (defaultDest && LAYERZERO_EIDS[defaultDest]) {
        setDestinationChainId(defaultDest)
      }
    }
  }, [chainId, destinationChainId])

  // Resolve ENS name for connected wallet
  useEffect(() => {
    async function resolveWalletENS() {
      if (address && publicClient) {
        try {
          const name = await publicClient.getEnsName({ address: address as `0x${string}` })
          setEnsName(name)
        } catch {
          setEnsName(null)
        }
      }
    }
    resolveWalletENS()
  }, [address, publicClient])

  const handleSend = async () => {
    if (!destinationChainId || !receiverAddress || !message) {
      return
    }

    if (!isAddress(receiverAddress)) {
      alert('Please enter a valid address')
      return
    }

    // Mock sending - just show loading state briefly
    setIsPending(true)
    setTimeout(() => {
      setIsPending(false)
      console.log('Message would be sent:', {
        destinationChainId,
        receiverAddress,
        message,
      })
    }, 2000)
  }

  const isValid = !!destinationChainId && 
    !!receiverAddress && 
    isAddress(receiverAddress) && 
    !!message &&
    !isPending

  // Get wallet identicon (using a simple service)
  const getIdenticonUrl = (addr: string) => {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${addr}`
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className="relative flex h-auto w-full max-w-lg mx-auto flex-col group/design-root overflow-x-hidden glass-card">
      {/* Header */}
      <div className="flex items-center p-4 pb-2 justify-between border-b border-white/20 dark:border-white/10">
        <div className="flex size-10 shrink-0 items-center justify-start"></div>
        <h2 className="text-zinc-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center font-display">
          New Message
        </h2>
        <div className="flex w-10 items-center justify-end"></div>
      </div>

      <main className="flex-grow px-4 pt-6 pb-6">
        <div className="space-y-6">
          {/* From Section */}
          <div>
            <p className="text-zinc-600 dark:text-gray-400 text-sm font-medium leading-normal pb-2 px-1">
              From
            </p>
            <div className="flex items-center gap-4 glass-panel p-4 min-h-[72px] justify-between rounded-xl">
              <div className="flex items-center gap-4">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-12 w-12"
                  style={{
                    backgroundImage: address ? `url(${getIdenticonUrl(address)})` : undefined,
                  }}
                />
                <div className="flex flex-col justify-center">
                  <p className="text-zinc-900 dark:text-white text-base font-medium leading-normal line-clamp-1">
                    {address ? formatAddress(address) : 'Not connected'}
                  </p>
                  <p className="text-zinc-500 dark:text-gray-400 text-sm font-normal leading-normal line-clamp-2">
                    {ensName || 'My Main Wallet'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (address) {
                    navigator.clipboard.writeText(address)
                  }
                }}
                className="shrink-0 text-zinc-600 dark:text-gray-300 flex size-7 items-center justify-center hover:opacity-80"
              >
                <span className="material-symbols-outlined">content_copy</span>
              </button>
            </div>
          </div>

          {/* To Section */}
          <div>
            <p className="text-zinc-600 dark:text-gray-400 text-sm font-medium leading-normal pb-2 px-1">
              To
            </p>
            <div className="flex flex-col gap-2">
              <div className="w-full">
                <ChainSelector
                  selectedChainId={destinationChainId}
                  onChainSelect={setDestinationChainId}
                />
              </div>
              <AddressInput
                value={receiverAddress}
                onChange={setReceiverAddress}
                placeholder="Enter address, ENS name..."
              />
            </div>
          </div>

          {/* Message Section */}
          <label className="flex flex-col min-w-40 flex-1">
            <p className="text-zinc-600 dark:text-gray-400 text-sm font-medium leading-normal pb-2 px-1">
              Message
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your encrypted message..."
              className="glass-input flex w-full min-w-0 flex-1 resize-none overflow-hidden text-zinc-900 dark:text-white min-h-36 placeholder:text-zinc-500 dark:placeholder:text-gray-500 p-4 text-base font-normal leading-normal"
            />
          </label>

          {/* Fee Estimation */}
          <div className="glass-panel rounded-xl p-4">
            <div className="flex justify-between gap-x-6 py-1">
              <p className="text-zinc-600 dark:text-gray-400 text-sm font-normal leading-normal">
                Estimated Network Fee
              </p>
              <p className="text-zinc-900 dark:text-white text-sm font-medium leading-normal text-right">
                ~0.001 {chainId ? getNativeTokenSymbol(chainId) : 'ETH'}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Send Button */}
      <div className="px-4 pb-4 pt-2">
        <button
          onClick={handleSend}
          disabled={!isValid || isPending}
          className="w-full bg-primary text-white font-bold py-4 px-5 rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all duration-200 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 dark:disabled:text-zinc-400 disabled:cursor-not-allowed disabled:shadow-none font-display backdrop-blur-sm"
        >
          {isPending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

