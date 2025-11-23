import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getChainLogoUrl, LAYERZERO_CHAINS, isTestnet } from '../lib/chains'

interface ChainSelectorProps {
  selectedChainId?: number
  onChainSelect: (chainId: number) => void
  disabled?: boolean
}

export function ChainSelector({ selectedChainId, onChainSelect, disabled }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showTestnetsOnly, setShowTestnetsOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0, width: 384 })
  const [isPositionReady, setIsPositionReady] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Find the actual selected chain from the full list (not filtered) - this persists across toggles
  const selectedChain = useMemo(() => {
    if (selectedChainId) {
      return LAYERZERO_CHAINS.find(chain => chain.id === selectedChainId)
    }
    return null
  }, [selectedChainId])

  // Filter chains by testnet toggle and by search query
  const supportedChains = useMemo(() => {
    let filtered = [...LAYERZERO_CHAINS]
    
    // Filter by testnet toggle
    if (showTestnetsOnly) {
      filtered = filtered.filter(chain => isTestnet(chain.id))
    } else {
      filtered = filtered.filter(chain => !isTestnet(chain.id))
    }
    
    // Filter by search query (case-insensitive)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(chain => {
        const nameMatch = chain.name.toLowerCase().includes(query)
        const symbolMatch = chain.nativeCurrency.symbol.toLowerCase().includes(query)
        const chainIdMatch = chain.id.toString().includes(query)
        return nameMatch || symbolMatch || chainIdMatch
      })
    }
    
    return filtered
  }, [showTestnetsOnly, searchQuery])
  
  // Only auto-select first chain if there's no selection at all (initial state)
  // Don't auto-select when toggling testnet/mainnet - preserve user's selection
  useEffect(() => {
    if (!selectedChainId) {
      // Get first mainnet chain for initial selection (not filtered by toggle)
      const firstMainnetChain = LAYERZERO_CHAINS.find(chain => !isTestnet(chain.id))
      if (firstMainnetChain) {
        onChainSelect(firstMainnetChain.id)
      }
    }
  }, [selectedChainId, onChainSelect])

  // Calculate position when opening - uses viewport coordinates for fixed positioning
  const calculatePosition = (): boolean => {
    if (!buttonRef.current) {
      setIsPositionReady(false)
      return false
    }

    const rect = buttonRef.current.getBoundingClientRect()
    
    // Verify button is visible and has valid dimensions
    if (rect.width === 0 || rect.height === 0) {
      setIsPositionReady(false)
      return false
    }

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const popupWidth = Math.max(rect.width, 384) // Minimum 384px (md:w-96)
    const popupHeight = 320 // max-h-80 = 320px
    const gap = 8 // Gap between button and popup
    const margin = 16 // Minimum margin from viewport edges

    // getBoundingClientRect() returns viewport coordinates, perfect for fixed positioning
    // Calculate left position - align with button left edge
    let left = rect.left

    // Adjust if popup would go off right edge
    if (left + popupWidth > viewportWidth - margin) {
      left = Math.max(margin, viewportWidth - popupWidth - margin)
    }

    // Ensure minimum left margin
    if (left < margin) {
      left = margin
    }

    // Calculate top position - always prefer below the button
    // rect.bottom and rect.top are viewport coordinates (from getBoundingClientRect)
    const spaceBelow = viewportHeight - rect.bottom - gap
    let top: number

    // Always position below button by default
    top = rect.bottom + gap

    // Only adjust if popup would go significantly off-screen at bottom
    // Allow some overflow but clamp if it would be mostly off-screen
    if (top + popupHeight > viewportHeight - margin) {
      // Popup would go off bottom - check if we should position above instead
      const spaceAbove = rect.top - gap
      // Only position above if there's significantly more space above AND below is very limited
      if (spaceAbove > spaceBelow && spaceBelow < popupHeight * 0.3) {
        // Much more space above and very little below - position above
        top = Math.max(margin, rect.top - popupHeight - gap)
      } else {
        // Prefer to stay below, just clamp to viewport
        top = Math.max(margin, viewportHeight - popupHeight - margin)
      }
    }

    // Final bounds check - ensure popup doesn't go off top
    if (top < margin) {
      top = margin
    }
    
    // Ensure top is a reasonable viewport coordinate
    top = Math.max(0, Math.min(top, viewportHeight - popupHeight))

    // Validate coordinates are within reasonable viewport bounds
    // Allow popup to be slightly off-screen if needed (will be clamped by CSS)
    const isValid = 
      top >= -100 && // Allow some negative for positioning above
      top < viewportHeight + 100 && // Allow some overflow
      left >= -100 && 
      left < viewportWidth + 100 &&
      !isNaN(top) &&
      !isNaN(left) &&
      isFinite(top) &&
      isFinite(left)

    if (isValid) {
      // Clamp to viewport bounds for final position
      const clampedTop = Math.max(margin, Math.min(top, viewportHeight - popupHeight - margin))
      const clampedLeft = Math.max(margin, Math.min(left, viewportWidth - popupWidth - margin))
      
      // Set position - getBoundingClientRect gives viewport coords, perfect for fixed positioning
      setPosition({
        top: clampedTop,
        left: clampedLeft,
        width: popupWidth,
      })
      setIsPositionReady(true)
      return true
    } else {
      setIsPositionReady(false)
      return false
    }
  }

  // Reset position ready flag when closing and manage body scroll
  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when popup is open
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      
      return () => {
        // Restore body scroll when popup closes
        document.body.style.overflow = originalOverflow
        setIsPositionReady(false)
        setPosition({ top: 0, left: 0, width: 384 })
      }
    } else {
      setIsPositionReady(false)
      setPosition({ top: 0, left: 0, width: 384 })
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
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
    setSearchQuery('') // Clear search when selecting
  }

  // Clear search when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  if (!selectedChain) {
    return null
  }

  return (
    <>
      <div className="relative w-full">
        <button
          ref={buttonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (!disabled) {
              const newIsOpen = !isOpen
              if (newIsOpen) {
                // Calculate position synchronously before opening
                // This ensures position is ready when popup renders
                const success = calculatePosition()
                if (success) {
                  setIsOpen(true)
                }
              } else {
                setIsOpen(false)
              }
            }
          }}
          disabled={disabled}
          className="glass-input flex items-center justify-between w-full h-14 pl-3 pr-2 hover:border-primary/50 dark:hover:border-primary/50 focus:outline-0 focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
              {selectedChain.name}
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
      </div>

      {isOpen && typeof document !== 'undefined' && isPositionReady && createPortal(
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            style={{ zIndex: 2147483646 }}
            onClick={() => setIsOpen(false)}
          />
          {/* Popup */}
          <div
            ref={dropdownRef}
            className="fixed glass-card rounded-xl shadow-glass max-h-80 flex flex-col"
            style={{
              position: 'fixed',
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
              maxWidth: 'calc(100vw - 32px)',
              zIndex: 2147483647,
              isolation: 'isolate',
            }}
          >
          {/* Sticky Header with Search and Testnet Toggle */}
          <div className="sticky top-0 z-10 flex flex-col glass-panel border-b border-white/20 dark:border-white/10 shrink-0">
            {/* Search Input */}
            <div className="px-4 pt-3 pb-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Search chains..."
                  className="glass-input w-full h-10 pl-10 pr-10 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 dark:placeholder:text-gray-500 focus:outline-0 focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-gray-400 !text-lg pointer-events-none">
                  search
                </span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSearchQuery('')
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-gray-400 hover:text-zinc-700 dark:hover:text-gray-300"
                  >
                    <span className="material-symbols-outlined !text-lg">close</span>
                  </button>
                )}
              </div>
            </div>
            {/* Testnet Toggle */}
            <div className="px-4 pb-3 flex items-center justify-between gap-3 shrink-0">
              <span className="text-zinc-600 dark:text-gray-400 text-sm font-medium whitespace-nowrap">
                Testnets Only
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowTestnetsOnly(!showTestnetsOnly)
                }}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 shrink-0"
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
          </div>
          {/* Scrollable Chain List */}
          <div className="overflow-y-auto flex-1">
            {supportedChains.length > 0 ? (
              supportedChains.map((chain) => (
            <button
              key={chain.id}
              type="button"
              onClick={() => handleSelect(chain.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 dark:hover:bg-white/5 transition-colors first:rounded-t-xl last:rounded-b-xl"
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
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-zinc-500 dark:text-gray-400 text-sm">
                  No chains found
                </p>
              </div>
            )}
          </div>
        </div>
        </>,
        document.body
      )}
    </>
  )
}

