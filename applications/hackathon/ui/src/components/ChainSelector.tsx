import { useState, useRef, useEffect, useMemo } from 'react'
import { useChains } from 'wagmi'
import { getChainLogoUrl, LAYERZERO_EIDS, isTestnet } from '../lib/chains'

interface ChainSelectorProps {
  selectedChainId?: number
  onChainSelect: (chainId: number) => void
  disabled?: boolean
}

export function ChainSelector({ selectedChainId, onChainSelect, disabled }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showTestnetsOnly, setShowTestnetsOnly] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const chains = useChains()
  
  // Filter chains that have LayerZero support and by testnet toggle
  const supportedChains = useMemo(() => {
    let filtered = chains.filter(chain => LAYERZERO_EIDS[chain.id] !== undefined)
    
    // Filter by testnet toggle
    if (showTestnetsOnly) {
      filtered = filtered.filter(chain => isTestnet(chain.id))
    } else {
      filtered = filtered.filter(chain => !isTestnet(chain.id))
    }
    
    return filtered
  }, [chains, showTestnetsOnly])
  
  // Find selected chain - if not in filtered list, use first available
  const selectedChain = supportedChains.find(chain => chain.id === selectedChainId) || supportedChains[0]
  
  // Auto-select first chain if current selection is not in filtered list
  useEffect(() => {
    if (selectedChainId && supportedChains.length > 0) {
      const isSelectedInList = supportedChains.some(chain => chain.id === selectedChainId)
      if (!isSelectedInList && supportedChains[0]) {
        onChainSelect(supportedChains[0].id)
      }
    }
  }, [showTestnetsOnly, selectedChainId, supportedChains, onChainSelect])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (chainId: number) => {
    onChainSelect(chainId)
    setIsOpen(false)
  }

  if (!selectedChain) {
    return null
  }

  return (
    <div className="relative w-full md:w-auto" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center justify-between w-full h-14 pl-3 pr-2 rounded-xl border border-gray-300 dark:border-zinc-700 bg-background-light dark:bg-zinc-900/50 hover:border-primary/50 dark:hover:border-primary/50 focus:outline-0 focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img
            alt={`${selectedChain.name} logo`}
            className="h-6 w-6 rounded-full shrink-0"
            src={getChainLogoUrl(selectedChain.id)}
            onError={(e) => {
              // Fallback to a default icon if image fails to load
              e.currentTarget.src = 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
            }}
          />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-zinc-900 dark:text-white text-base font-medium truncate">
              {selectedChain.nativeCurrency.symbol}
            </span>
            {isTestnet(selectedChain.id) ? (
              <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full shrink-0">
                Testnet
              </span>
            ) : (
              <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full shrink-0">
                Mainnet
              </span>
            )}
          </div>
        </div>
        <span className="material-symbols-outlined text-zinc-500 dark:text-gray-400 !text-xl">
          unfold_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full md:w-96 bg-background-light dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl shadow-lg max-h-64 overflow-auto">
          {/* Testnet Toggle */}
          <div className="sticky top-0 bg-background-light dark:bg-zinc-900 border-b border-gray-300 dark:border-zinc-700 px-4 py-3 flex items-center justify-between z-10">
            <span className="text-zinc-600 dark:text-gray-400 text-sm font-medium">
              Testnets Only
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowTestnetsOnly(!showTestnetsOnly)
              }}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
              style={{
                backgroundColor: showTestnetsOnly ? 'rgb(59, 130, 246)' : 'rgb(156, 163, 175)',
              }}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                style={{
                  transform: showTestnetsOnly ? 'translateX(1.25rem)' : 'translateX(0.25rem)',
                }}
              />
            </button>
          </div>
          {supportedChains.map((chain) => (
            <button
              key={chain.id}
              type="button"
              onClick={() => handleSelect(chain.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-200 dark:hover:bg-zinc-800 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <img
                alt={`${chain.name} logo`}
                className="h-6 w-6 rounded-full"
                src={getChainLogoUrl(chain.id)}
                onError={(e) => {
                  e.currentTarget.src = 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
                }}
              />
              <div className="flex flex-col items-start flex-1 min-w-0">
                <div className="flex items-center gap-2 w-full">
                  <span className="text-zinc-900 dark:text-white text-base font-medium truncate">
                    {chain.name}
                  </span>
                  {isTestnet(chain.id) ? (
                    <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full shrink-0">
                      Testnet
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full shrink-0">
                      Mainnet
                    </span>
                  )}
                </div>
                <span className="text-zinc-500 dark:text-gray-400 text-sm">
                  {chain.nativeCurrency.symbol}
                </span>
              </div>
              {selectedChainId === chain.id && (
                <span className="material-symbols-outlined text-primary !text-xl">
                  check
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

