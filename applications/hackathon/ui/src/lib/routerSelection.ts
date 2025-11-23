/**
 * Client-side router selection logic matching contract behavior
 */

import { MessageRequirements, RouterType, RouterSelection, SecurityLevel } from '../types/transaction'

const NATIVE_BRIDGE_DELAY = 7 * 24 * 60 * 60 // 7 days in seconds

/**
 * Check if a chain supports native bridge
 */
export function isNativeBridgeChain(
  chainId: number,
  nativeBridgeChains: number[]
): boolean {
  return nativeBridgeChains.includes(chainId)
}

/**
 * Determine if native bridge should be used (matching contract logic)
 */
export function shouldUseNativeBridge(
  chainId: number,
  req: MessageRequirements,
  nativeBridgeChains: number[]
): boolean {
  // Must be a native bridge chain
  const isNativeBridgeChainSupported = isNativeBridgeChain(chainId, nativeBridgeChains)
  
  if (!isNativeBridgeChainSupported) {
    return false // Must use LayerZero for non-native chains
  }
  
  // Security requirements take precedence (checked BEFORE fast finality/guaranteed delivery)
  // If native security required, prefer EIL native (if available)
  if (req.requiresNativeSecurity && isNativeBridgeChainSupported) {
    // Only use native if we can tolerate the delay
    // Contract: if (req.maxDelay >= 7 days || !req.requiresFastFinality)
    if (req.maxDelay >= BigInt(NATIVE_BRIDGE_DELAY) || !req.requiresFastFinality) {
      return true
    }
  }
  
  // If dispute resolution required, prefer EIL native
  if (req.requiresDisputeResolution && isNativeBridgeChainSupported) {
    // Only use native if we can tolerate the delay
    // Contract: if (req.maxDelay >= 7 days || !req.requiresFastFinality)
    if (req.maxDelay >= BigInt(NATIVE_BRIDGE_DELAY) || !req.requiresFastFinality) {
      return true
    }
  }
  
  // Critical security level may require native security even with delay
  if (req.securityLevel === SecurityLevel.CRITICAL && isNativeBridgeChainSupported) {
    // For critical operations, prefer native security if delay is acceptable
    // Contract: if (req.maxDelay >= 7 days || !req.requiresFastFinality)
    if (req.maxDelay >= BigInt(NATIVE_BRIDGE_DELAY) || !req.requiresFastFinality) {
      return true
    }
  }
  
  // If fast finality required, use LayerZero
  if (req.requiresFastFinality) {
    return false
  }
  
  // If guaranteed delivery required, use LayerZero executor
  if (req.requiresGuaranteedDelivery) {
    return false
  }
  
  // If multi-chain, use LayerZero
  if (req.isMultiChain) {
    return false
  }
  
  // If can tolerate delay and cost-sensitive, use native bridge
  if (req.isCostSensitive && req.maxDelay >= BigInt(NATIVE_BRIDGE_DELAY)) {
    return true
  }
  
  // Default: use LayerZero for better UX
  return false
}

/**
 * Get router selection with reasoning
 */
export function getRouterSelection(
  chainId: number,
  req: MessageRequirements,
  nativeBridgeChains: number[]
): RouterSelection {
  const useNative = shouldUseNativeBridge(chainId, req, nativeBridgeChains)
  const router: RouterType = useNative ? 'EIL' : 'LAYERZERO'
  
  let reasoning = ''
  let estimatedCost = ''
  let estimatedTime = ''
  
  if (useNative) {
    reasoning = 'Selected EIL native bridge: '
    const reasons: string[] = []
    
    if (req.requiresNativeSecurity) {
      reasons.push('native security required')
    }
    if (req.requiresDisputeResolution) {
      reasons.push('dispute resolution required')
    }
    if (req.securityLevel === SecurityLevel.CRITICAL) {
      reasons.push('critical security level')
    }
    if (req.isCostSensitive && req.maxDelay >= BigInt(NATIVE_BRIDGE_DELAY)) {
      reasons.push('cost-sensitive operation')
    }
    
    reasoning += reasons.length > 0 ? reasons.join(', ') : 'optimal for this chain'
    estimatedCost = '~0.0001 ETH'
    estimatedTime = '7 days'
  } else {
    reasoning = 'Selected LayerZero: '
    const reasons: string[] = []
    
    if (req.requiresFastFinality) {
      reasons.push('fast finality required')
    }
    if (req.requiresGuaranteedDelivery) {
      reasons.push('guaranteed delivery required')
    }
    if (req.isMultiChain) {
      reasons.push('multi-chain operation')
    }
    if (!isNativeBridgeChain(chainId, nativeBridgeChains)) {
      reasons.push('chain not supported by native bridge')
    }
    
    reasoning += reasons.length > 0 ? reasons.join(', ') : 'optimal for this operation'
    estimatedCost = '~0.001 ETH'
    estimatedTime = '1-2 minutes'
  }
  
  return {
    router,
    reasoning,
    estimatedCost,
    estimatedTime,
  }
}

