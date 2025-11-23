import { useState, useEffect, useMemo } from 'react'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { isAddress } from 'viem'
import { ChainSelector } from './ChainSelector'
import { AddressInput } from './AddressInput'
import { PresetSelector, PRESETS } from './PresetSelector'
import { RequirementsModal } from './RequirementsModal'
import { RouterSelectionDisplay } from './RouterSelectionDisplay'
import { TransactionLifecycle } from './TransactionLifecycle'
import { getNativeTokenSymbol, LAYERZERO_EIDS } from '../lib/chains'
import { MessageRequirements, SecurityLevel } from '../types/transaction'
import { getRouterSelection } from '../lib/routerSelection'
import { prepareSendMessageRequest, prepareCancelMessage } from '../lib/messengerContract'
import { getContractAddress } from '../lib/contracts'
import { useMessageTransactions } from '../hooks/useMessageTransactions'

// Default native bridge chains (should be fetched from contract in production)
const DEFAULT_NATIVE_BRIDGE_CHAINS = [1, 42161, 10, 8453] // Ethereum, Arbitrum, Optimism, Base

export function CrossChainMessage() {
  const { address, chainId } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const currentChainId = useChainId()
  
  const [destinationChainId, setDestinationChainId] = useState<number | undefined>()
  const [receiverAddress, setReceiverAddress] = useState('')
  const [message, setMessage] = useState('')
  const [ensName, setEnsName] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isRequirementsModalOpen, setIsRequirementsModalOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<'cost-optimized' | 'speed-optimized' | 'security-focused' | 'balanced' | 'custom'>('balanced')

  // Message requirements state - initialize with balanced preset
  const balancedPreset = PRESETS.find(p => p.id === 'balanced')
  const [requirements, setRequirements] = useState<MessageRequirements>(
    balancedPreset?.requirements || {
      requiresFastFinality: false,
      requiresGuaranteedDelivery: false,
      isCostSensitive: false,
      isMultiChain: false,
      maxDelay: BigInt(86400), // 1 day default
      amount: 0n,
      requiresNativeSecurity: false,
      requiresDisputeResolution: false,
      securityLevel: SecurityLevel.MEDIUM,
    }
  )

  // Handle preset selection
  const handlePresetSelect = (preset: typeof PRESETS[0]) => {
    setRequirements(preset.requirements)
    setSelectedPreset(preset.id)
  }

  // Handle requirements change (from modal)
  const handleRequirementsChange = (newRequirements: MessageRequirements) => {
    setRequirements(newRequirements)
    // Check if it matches a preset
    const matchingPreset = PRESETS.find(p => {
      return Object.keys(p.requirements).every((key) => {
        const k = key as keyof MessageRequirements
        return p.requirements[k] === newRequirements[k]
      })
    })
    setSelectedPreset(matchingPreset?.id || 'custom')
  }

  // Get contract address
  const contractAddress = useMemo(() => {
    const chain = chainId || currentChainId
    return chain ? getContractAddress(chain) : undefined
  }, [chainId, currentChainId])

  // Get router selection
  const routerSelection = useMemo(() => {
    if (!destinationChainId) return null
    return getRouterSelection(
      destinationChainId,
      requirements,
      DEFAULT_NATIVE_BRIDGE_CHAINS
    )
  }, [destinationChainId, requirements])

  // Transaction management
  const { refreshTransactions } = useMessageTransactions(contractAddress)

  // Set default destination chain
  useEffect(() => {
    if (!destinationChainId) {
      if (chainId) {
        const defaultDest = chainId === 1 ? 11155111 : chainId === 11155111 ? 1 : undefined
        if (defaultDest && LAYERZERO_EIDS[defaultDest]) {
          setDestinationChainId(defaultDest)
        }
      } else {
        if (LAYERZERO_EIDS[1]) {
          setDestinationChainId(1)
        }
      }
    }
  }, [chainId, destinationChainId])

  // Resolve ENS name
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

  // Clear messages after timeout
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null)
        setSuccessMessage(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [error, successMessage])

  const handleSend = async () => {
    if (!destinationChainId || !receiverAddress || !message || !contractAddress) {
      setError('Please fill in all fields')
      return
    }

    if (!isAddress(receiverAddress)) {
      setError('Please enter a valid address')
      return
    }

    if (!walletClient) {
      setError('Wallet not connected')
      return
    }

    try {
      setIsPending(true)
      setError(null)

      // Prepare transaction
      const tx = prepareSendMessageRequest(contractAddress, {
        targetChainId: destinationChainId,
        payload: message,
        requirements,
      })

      // Send transaction
      const hash = await walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      })

      // Wait for transaction receipt
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
        
        // Decode transaction ID from receipt logs (simplified - in production, decode properly)
        // For now, we'll need to fetch the transaction from events or use a different approach
        setSuccessMessage(`Transaction submitted! Hash: ${hash.slice(0, 10)}...`)
        
        // Refresh transactions
        refreshTransactions()
      }
    } catch (err: unknown) {
      console.error('Error sending message:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsPending(false)
    }
  }

  const handleCancel = async (txId: bigint) => {
    if (!contractAddress || !walletClient) {
      setError('Wallet not connected')
      return
    }

    try {
      setIsPending(true)
      setError(null)

      const tx = prepareCancelMessage(contractAddress, { txId })
      const hash = await walletClient.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      })

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash })
        setSuccessMessage('Transaction cancelled successfully')
        refreshTransactions()
      }
    } catch (err: unknown) {
      console.error('Error cancelling transaction:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel transaction')
    } finally {
      setIsPending(false)
    }
  }

  const handleApprove = async (_txId: bigint) => {
    // Meta-transaction approval is complex and requires:
    // 1. Owner to sign the meta-transaction
    // 2. Broadcaster to execute with routing fees
    // This is a placeholder - full implementation would require meta-transaction signing flow
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    void _txId
    setError('Meta-transaction approval not yet implemented. Please use direct approval.')
  }

  const isValid = !!address && 
    !!destinationChainId && 
    !!receiverAddress && 
    isAddress(receiverAddress) && 
    !!message &&
    !!contractAddress &&
    !isPending

  const getIdenticonUrl = (addr: string) => {
    return `https://api.dicebear.com/7.x/identicon/svg?seed=${addr}`
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className="space-y-6">
      {/* Main Message Form */}
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
            {/* Error/Success Messages */}
            {error && (
              <div className="glass-panel p-3 rounded-xl border border-red-500/50 bg-red-500/10">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}
            {successMessage && (
              <div className="glass-panel p-3 rounded-xl border border-green-500/50 bg-green-500/10">
                <p className="text-green-600 dark:text-green-400 text-sm">{successMessage}</p>
              </div>
            )}

            {/* From Section */}
            <div>
              <p className="text-zinc-600 dark:text-gray-400 text-sm font-medium leading-normal pb-2 px-1">
                From
              </p>
              <div className="flex items-center gap-4 glass-panel p-4 min-h-[72px] justify-between rounded-xl">
                <div className="flex items-center gap-4">
                  <div
                    className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-12 w-12 bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center"
                    style={{
                      backgroundImage: address ? `url(${getIdenticonUrl(address)})` : undefined,
                    }}
                  >
                    {!address && (
                      <span className="material-symbols-outlined text-zinc-500 dark:text-zinc-400 !text-2xl">
                        account_circle
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-zinc-900 dark:text-white text-base font-medium leading-normal line-clamp-1">
                      {address ? formatAddress(address) : 'Not connected'}
                    </p>
                    <p className="text-zinc-500 dark:text-gray-400 text-sm font-normal leading-normal line-clamp-2">
                      {address ? (ensName || 'My Main Wallet') : 'Connect wallet to send messages'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (address) {
                      navigator.clipboard.writeText(address)
                    }
                  }}
                  disabled={!address}
                  className="shrink-0 text-zinc-600 dark:text-gray-300 flex size-7 items-center justify-center hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
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
                placeholder="Write your message..."
                className="glass-input flex w-full min-w-0 flex-1 resize-none overflow-hidden text-zinc-900 dark:text-white min-h-36 placeholder:text-zinc-500 dark:placeholder:text-gray-500 p-4 text-base font-normal leading-normal"
              />
            </label>

            {/* Message Requirements */}
            <div>
              <div className="flex items-center justify-between pb-2 px-1">
                <p className="text-zinc-600 dark:text-gray-400 text-sm font-medium leading-normal">
                  Requirements
                </p>
                <button
                  type="button"
                  onClick={() => setIsRequirementsModalOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                  aria-label="Open requirements settings"
                  title="Configure detailed requirements"
                >
                  <span className="material-symbols-outlined !text-lg text-zinc-600 dark:text-gray-400">
                    settings
                  </span>
                </button>
              </div>
              
              {/* Quick Presets */}
              <PresetSelector
                selectedPreset={selectedPreset}
                onSelectPreset={handlePresetSelect}
                currentRequirements={requirements}
              />

              {/* Compact Active Requirements Summary */}
              {(() => {
                const active: string[] = []
                if (requirements.isCostSensitive) active.push('Cost Sensitive')
                if (requirements.requiresFastFinality) active.push('Fast Finality')
                if (requirements.requiresGuaranteedDelivery) active.push('Guaranteed Delivery')
                if (requirements.isMultiChain) active.push('Multi-Chain')
                if (requirements.requiresNativeSecurity) active.push('Native Security')
                if (requirements.requiresDisputeResolution) active.push('Dispute Resolution')
                
                if (active.length > 0) {
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-2 px-1">
                      {active.map((req) => (
                        <span
                          key={req}
                          className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full"
                        >
                          {req}
                        </span>
                      ))}
                    </div>
                  )
                }
                return null
              })()}
            </div>

            {/* Router Selection Display */}
            <div>
              <p className="text-zinc-600 dark:text-gray-400 text-sm font-medium leading-normal pb-2 px-1">
                Router Selection
              </p>
              <RouterSelectionDisplay selection={routerSelection} />
            </div>

            {/* Fee Estimation */}
            <div className="glass-panel rounded-xl p-4">
              <div className="flex justify-between gap-x-6 py-1">
                <p className="text-zinc-600 dark:text-gray-400 text-sm font-normal leading-normal">
                  Estimated Network Fee
                </p>
                <p className="text-zinc-900 dark:text-white text-sm font-medium leading-normal text-right">
                  {routerSelection?.estimatedCost || `~0.001 ${chainId ? getNativeTokenSymbol(chainId) : destinationChainId ? getNativeTokenSymbol(destinationChainId) : 'ETH'}`}
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
            className="w-full bg-primary text-white font-bold py-4 px-5 rounded-xl shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all duration-200 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:text-zinc-500 dark:disabled:text-zinc-400 disabled:cursor-not-allowed disabled:shadow-none font-display backdrop-blur-sm flex items-center justify-center gap-2"
          >
            {isPending && (
              <span className="material-symbols-outlined animate-spin !text-xl">
                refresh
              </span>
            )}
            {!address ? 'Connect Wallet to Send' : isPending ? 'Sending...' : 'Request Message'}
          </button>
        </div>
      </div>

      {/* Transaction Lifecycle */}
      {contractAddress && (
        <div className="w-full max-w-lg mx-auto">
          <TransactionLifecycle
            contractAddress={contractAddress}
            onCancel={handleCancel}
            onApprove={handleApprove}
          />
        </div>
      )}

      {/* Requirements Modal */}
      <RequirementsModal
        isOpen={isRequirementsModalOpen}
        onClose={() => setIsRequirementsModalOpen(false)}
        requirements={requirements}
        onChange={handleRequirementsChange}
      />
    </div>
  )
}
