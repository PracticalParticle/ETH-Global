import { Chain } from 'wagmi/chains'

// LayerZero Endpoint IDs (EIDs) mapping
// Common LayerZero endpoint IDs
export const LAYERZERO_EIDS: Record<number, number> = {
  // Ethereum Mainnet
  1: 30101,
  // Sepolia
  11155111: 40161,
  // Arbitrum
  42161: 30110,
  // Optimism
  10: 30111,
  // Base
  8453: 30184,
  // Polygon
  137: 30109,
  // Avalanche
  43114: 30106,
  // BSC
  56: 30102,
}

export interface ChainInfo {
  chain: Chain
  eid: number
  logoUrl?: string
  nativeToken: string
}

// Get chain info with LayerZero EID
export function getChainInfo(chainId: number): ChainInfo | null {
  const eid = LAYERZERO_EIDS[chainId]
  if (!eid) return null

  // This will be populated from wagmi chains
  return {
    chain: {} as Chain,
    eid,
    nativeToken: 'ETH', // Default, will be overridden
  }
}

// Get chain logo URL (using common CDN)
export function getChainLogoUrl(chainId: number): string {
  const logos: Record<number, string> = {
    1: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    11155111: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    42161: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png',
    10: 'https://cryptologos.cc/logos/optimism-op-logo.png',
    8453: 'https://cryptologos.cc/logos/base-base-logo.png',
    137: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    43114: 'https://cryptologos.cc/logos/avalanche-avax-logo.png',
    56: 'https://cryptologos.cc/logos/bnb-bnb-logo.png',
  }
  return logos[chainId] || 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
}

// Get native token symbol
export function getNativeTokenSymbol(chainId: number): string {
  const tokens: Record<number, string> = {
    1: 'ETH',
    11155111: 'ETH',
    42161: 'ETH',
    10: 'ETH',
    8453: 'ETH',
    137: 'MATIC',
    43114: 'AVAX',
    56: 'BNB',
  }
  return tokens[chainId] || 'ETH'
}

