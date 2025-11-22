import { useState, useRef, useEffect } from 'react'
import { useChains } from 'wagmi'
import { getChainLogoUrl, getNativeTokenSymbol, LAYERZERO_EIDS } from '../lib/chains'

interface ChainSelectorProps {
  selectedChainId?: number
  onChainSelect: (chainId: number) => void
  disabled?: boolean
}

export function ChainSelector({ selectedChainId, onChainSelect, disabled }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const chains = useChains()
  
  // Filter chains that have LayerZero support
  const supportedChains = chains.filter(chain => LAYERZERO_EIDS[chain.id] !== undefined)
  
  const selectedChain = supportedChains.find(chain => chain.id === selectedChainId) || supportedChains[0]

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
        <div className="flex items-center gap-2">
          <img
            alt={`${selectedChain.name} logo`}
            className="h-6 w-6 rounded-full"
            src={getChainLogoUrl(selectedChain.id)}
            onError={(e) => {
              // Fallback to a default icon if image fails to load
              e.currentTarget.src = 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
            }}
          />
          <span className="text-zinc-900 dark:text-white text-base font-medium">
            {getNativeTokenSymbol(selectedChain.id)}
          </span>
        </div>
        <span className="material-symbols-outlined text-zinc-500 dark:text-gray-400 !text-xl">
          unfold_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full md:w-64 bg-background-light dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl shadow-lg max-h-64 overflow-auto">
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
              <div className="flex flex-col items-start flex-1">
                <span className="text-zinc-900 dark:text-white text-base font-medium">
                  {chain.name}
                </span>
                <span className="text-zinc-500 dark:text-gray-400 text-sm">
                  {getNativeTokenSymbol(chain.id)}
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

