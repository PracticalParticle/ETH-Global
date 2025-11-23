/**
 * React hook for managing message transactions
 * Updated to use SDK and fetch signed meta-transactions from localStorage
 */

import { useState, useCallback, useMemo } from 'react'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { Address, PublicClient } from 'viem'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  TransactionRecord, 
  TransactionStatus, 
  PendingTransaction 
} from '../types/transaction'
import { getContractAddress } from '../lib/contracts'
import { 
  isTransactionExpired, 
  getTimeRemaining, 
  getTimeLockProgress 
} from '../lib/messengerContract'
import { EnterpriseCrossChainMessengerSDK } from '../lib/messengerSDK'
import { SecureOwnable } from '../../../../../sdk/typescript/contracts/SecureOwnable'
import { ROLES } from '../../../../../sdk/typescript/types/lib.index'
import { getAllSignedMetaTxs } from '../lib/metaTransactionManager'

const TIME_LOCK_PERIOD = 300 // 5 minutes in seconds

/**
 * Fetch a single transaction from contract using SDK
 */
async function fetchTransaction(
  publicClient: PublicClient,
  walletClient: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  contractAddress: Address,
  chain: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  txId: bigint
): Promise<TransactionRecord | null> {
  try {
    const sdk = new EnterpriseCrossChainMessengerSDK(
      publicClient,
      walletClient,
      contractAddress,
      chain
    )
    
    const result = await sdk.getTransaction(txId) as {
      txId?: bigint
      releaseTime?: bigint
      status?: number
      params?: {
        operationType?: string
        [key: string]: unknown
      }
      [key: string]: unknown
    }

    // Decode the result - simplified for now
    // In production, properly decode the nested tuple structure
    return {
      txId: result.txId || txId,
      releaseTime: result.releaseTime || 0n,
      status: (result.status || 0) as TransactionStatus,
      operationType: result.params?.operationType || '',
      createdAt: result.releaseTime ? result.releaseTime - BigInt(TIME_LOCK_PERIOD) : 0n,
    }
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return null
  }
}

/**
 * Get contract owner address using SDK
 */
async function getContractOwner(
  publicClient: PublicClient,
  walletClient: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  contractAddress: Address,
  chain: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Address | null> {
  try {
    const sdk = new SecureOwnable(publicClient, walletClient, contractAddress, chain)
    return await sdk.owner()
  } catch (error) {
    console.error('Error fetching owner:', error)
    return null
  }
}

/**
 * Get contract broadcaster address using SDK
 */
async function getContractBroadcaster(
  publicClient: PublicClient,
  walletClient: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  contractAddress: Address,
  chain: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Address | null> {
  try {
    const sdk = new SecureOwnable(publicClient, walletClient, contractAddress, chain)
    return await sdk.getBroadcaster()
  } catch (error) {
    console.error('Error fetching broadcaster:', error)
    return null
  }
}

/**
 * Get contract recovery address using SDK
 */
async function getContractRecovery(
  publicClient: PublicClient,
  walletClient: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  contractAddress: Address,
  chain: any // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<Address | null> {
  try {
    const sdk = new SecureOwnable(publicClient, walletClient, contractAddress, chain)
    return await sdk.getRecovery()
  } catch (error) {
    console.error('Error fetching recovery:', error)
    return null
  }
}

/**
 * Hook for fetching and monitoring message transactions
 * Updated to use SDK and fetch signed meta-transactions from localStorage
 */
export function useMessageTransactions(contractAddress?: Address) {
  const { address: connectedAddress } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const [pendingTxIds, setPendingTxIds] = useState<bigint[]>([])

  // Get contract address
  const messengerAddress = contractAddress || (chainId ? getContractAddress(chainId) : undefined)

  // Get chain for SDK
  const chain = useMemo(() => {
    return publicClient?.chain || undefined
  }, [publicClient])

  // Fetch contract roles using SDK
  const { data: contractOwner } = useQuery({
    queryKey: ['messenger-owner', messengerAddress, chainId],
    queryFn: () => 
      messengerAddress && publicClient && chain
        ? getContractOwner(publicClient, walletClient || undefined, messengerAddress, chain)
        : null,
    enabled: !!messengerAddress && !!publicClient && !!chain,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: contractBroadcaster } = useQuery({
    queryKey: ['messenger-broadcaster', messengerAddress, chainId],
    queryFn: () => 
      messengerAddress && publicClient && chain
        ? getContractBroadcaster(publicClient, walletClient || undefined, messengerAddress, chain)
        : null,
    enabled: !!messengerAddress && !!publicClient && !!chain,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: contractRecovery } = useQuery({
    queryKey: ['messenger-recovery', messengerAddress, chainId],
    queryFn: () => 
      messengerAddress && publicClient && chain
        ? getContractRecovery(publicClient, walletClient || undefined, messengerAddress, chain)
        : null,
    enabled: !!messengerAddress && !!publicClient && !!chain,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Check user roles using SDK
  const { data: userRoles } = useQuery({
    queryKey: ['messenger-user-roles', messengerAddress, chainId, connectedAddress],
    queryFn: async () => {
      if (!messengerAddress || !publicClient || !chain || !connectedAddress) return null
      const sdk = new SecureOwnable(publicClient, walletClient || undefined, messengerAddress, chain)
      
      const [isOwner, isBroadcaster, isRecovery] = await Promise.all([
        sdk.hasRole(ROLES.OWNER_ROLE, connectedAddress),
        sdk.hasRole(ROLES.BROADCASTER_ROLE, connectedAddress),
        sdk.hasRole(ROLES.RECOVERY_ROLE, connectedAddress),
      ])

      return { isOwner, isBroadcaster, isRecovery }
    },
    enabled: !!messengerAddress && !!publicClient && !!chain && !!connectedAddress,
    staleTime: 5 * 60 * 1000,
  })

  const isOwner = userRoles?.isOwner || false
  const isBroadcaster = userRoles?.isBroadcaster || false
  const isRecovery = userRoles?.isRecovery || false

  // Fetch all pending transactions from contract
  // Note: getPendingTransactions() requires the caller to have at least one role
  // So we only call it if the user has a role (owner, broadcaster, or recovery)
  // Also requires walletClient with account for permission checks
  const { data: contractPendingTxIds } = useQuery({
    queryKey: ['messenger-pending-tx-ids', messengerAddress, chainId, connectedAddress, isOwner, isBroadcaster, isRecovery],
    queryFn: async () => {
      if (!messengerAddress || !publicClient || !chain) {
        return []
      }

      // Require connected wallet for permissioned view calls
      if (!connectedAddress || !walletClient) {
        console.log('Wallet not connected, skipping getPendingTransactions() call')
        return []
      }

      // Only fetch if user has at least one role (required by contract)
      if (!isOwner && !isBroadcaster && !isRecovery) {
        console.log('User has no roles, skipping getPendingTransactions() call')
        return []
      }

      try {
        const sdk = new EnterpriseCrossChainMessengerSDK(
          publicClient,
          walletClient,
          messengerAddress,
          chain
        )
        return await sdk.getPendingTransactions()
      } catch (error) {
        // Silently handle permission errors - user might not have role yet
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('NoPermission') || errorMessage.includes('revert') || errorMessage.includes('Wallet client with account is required')) {
          console.log('No permission to fetch pending transactions (user may not have role yet or wallet not connected)')
          return []
        }
        console.error('Error fetching pending transactions:', error)
        return []
      }
    },
    enabled: !!messengerAddress && !!publicClient && !!chain && !!connectedAddress && !!walletClient && (isOwner || isBroadcaster || isRecovery),
    refetchInterval: 10000, // Poll every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  })

  // Fetch all transaction history from contract
  // This gets all transactions (not just pending) for the connected wallet
  const { data: allTransactionHistory } = useQuery({
    queryKey: ['messenger-all-transaction-history', messengerAddress, chainId, connectedAddress, isOwner, isBroadcaster, isRecovery],
    queryFn: async () => {
      if (!messengerAddress || !publicClient || !chain) {
        return []
      }

      // Require connected wallet for permissioned view calls
      if (!connectedAddress || !walletClient) {
        console.log('Wallet not connected, skipping getAllTransactionHistory() call')
        return []
      }

      // Only fetch if user has at least one role (required by contract)
      if (!isOwner && !isBroadcaster && !isRecovery) {
        console.log('User has no roles, skipping getAllTransactionHistory() call')
        return []
      }

      try {
        const sdk = new EnterpriseCrossChainMessengerSDK(
          publicClient,
          walletClient,
          messengerAddress,
          chain
        )
        const history = await sdk.getAllTransactionHistory()
        
        // Convert to TransactionRecord format
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return history.map((tx: any): TransactionRecord => ({
          txId: tx.txId || 0n,
          releaseTime: tx.releaseTime || 0n,
          status: (tx.status || 0) as TransactionStatus,
          operationType: tx.params?.operationType || '',
          targetChainId: tx.params?.targetChainId,
          payload: tx.params?.payload,
          createdAt: tx.releaseTime ? tx.releaseTime - BigInt(TIME_LOCK_PERIOD) : 0n,
        }))
      } catch (error) {
        // Silently handle permission errors
        const errorMessage = error instanceof Error ? error.message : String(error)
        if (errorMessage.includes('NoPermission') || errorMessage.includes('revert') || errorMessage.includes('Wallet client with account is required')) {
          console.log('No permission to fetch transaction history (user may not have role yet or wallet not connected)')
          return []
        }
        console.error('Error fetching transaction history:', error)
        return []
      }
    },
    enabled: !!messengerAddress && !!publicClient && !!chain && !!connectedAddress && !!walletClient && (isOwner || isBroadcaster || isRecovery),
    refetchInterval: 30000, // Poll every 30 seconds (less frequent than pending)
    staleTime: 10000, // Consider data stale after 10 seconds
  })

  // Get all transaction IDs from history (for comprehensive display)
  const allTxIdsFromHistory = useMemo(() => {
    if (!allTransactionHistory || allTransactionHistory.length === 0) {
      return []
    }
    return allTransactionHistory.map(tx => tx.txId).filter((id): id is bigint => id !== undefined && id !== 0n)
  }, [allTransactionHistory])

  // Merge all transaction IDs: from history, pending, and local state
  const allTxIds = useMemo(() => {
    const historyIds = allTxIdsFromHistory || []
    const pendingIds = contractPendingTxIds || []
    const localIds = pendingTxIds
    // Combine and deduplicate
    const combined = [...new Set([...historyIds, ...pendingIds, ...localIds])]
    return combined.sort((a, b) => {
      // Sort descending (newest first)
      if (a > b) return -1
      if (a < b) return 1
      return 0
    })
  }, [allTxIdsFromHistory, contractPendingTxIds, pendingTxIds])

  // Fetch signed meta-transactions from localStorage
  const { data: signedMetaTxs } = useQuery({
    queryKey: ['messenger-signed-meta-txs', messengerAddress, chainId],
    queryFn: () => {
      if (!messengerAddress || !chainId) return []
      return getAllSignedMetaTxs(messengerAddress, chainId)
    },
    enabled: !!messengerAddress && !!chainId,
    refetchInterval: 10000, // Check every 10 seconds
  })

  // Fetch individual transactions using SDK
  // Use allTxIds (from history + pending + local) for comprehensive display
  const transactionsQuery = useQuery({
    queryKey: ['messenger-transactions', allTxIds, messengerAddress, chainId],
    queryFn: async () => {
      if (!messengerAddress || !publicClient || !chain || allTxIds.length === 0) {
        // If we have transaction history, use it directly
        if (allTransactionHistory && allTransactionHistory.length > 0) {
          return allTransactionHistory
        }
        return []
      }

      // If we have transaction history, merge it with fetched individual transactions
      const historyMap = new Map<bigint, TransactionRecord>()
      if (allTransactionHistory && allTransactionHistory.length > 0) {
        allTransactionHistory.forEach(tx => {
          if (tx.txId) {
            historyMap.set(tx.txId, tx)
          }
        })
      }

      // Fetch any transactions not in history (e.g., newly created ones)
      const transactionsToFetch = allTxIds.filter(txId => !historyMap.has(txId))
      
      const fetchedTransactions = await Promise.all(
        transactionsToFetch.map(txId => 
          fetchTransaction(publicClient, walletClient || undefined, messengerAddress, chain, txId)
        )
      )

      const validFetched = fetchedTransactions.filter((tx): tx is TransactionRecord => tx !== null)
      
      // Merge history with fetched transactions
      const allTransactions = [...Array.from(historyMap.values()), ...validFetched]
      
      // Deduplicate by txId
      const uniqueTransactions = new Map<bigint, TransactionRecord>()
      allTransactions.forEach(tx => {
        if (tx.txId && !uniqueTransactions.has(tx.txId)) {
          uniqueTransactions.set(tx.txId, tx)
        }
      })

      return Array.from(uniqueTransactions.values())
    },
    enabled: !!messengerAddress && !!publicClient && !!chain && (allTxIds.length > 0 || (allTransactionHistory && allTransactionHistory.length > 0)),
    refetchInterval: 5000, // Poll every 5 seconds
  })

  // Process transactions with UI-specific fields
  const processedTransactions = transactionsQuery.data?.map((tx): PendingTransaction => {
    const currentTime = Math.floor(Date.now() / 1000)
    const expired = isTransactionExpired(tx.releaseTime, currentTime)
    const timeRemaining = getTimeRemaining(tx.releaseTime, currentTime)
    const progress = getTimeLockProgress(
      tx.createdAt,
      tx.releaseTime,
      currentTime,
      TIME_LOCK_PERIOD
    )

    // Check if there's a signed meta-transaction for this txId
    const signedMetaTx = signedMetaTxs?.find(st => st.txId === tx.txId.toString())

    // Determine status
    let status = tx.status
    if (expired && tx.status === TransactionStatus.PENDING) {
      status = TransactionStatus.EXPIRED
    }

    // Determine permissions
    const canCancel = isOwner && status === TransactionStatus.PENDING && !expired
    const canBroadcast = isBroadcaster && status === TransactionStatus.PENDING && !expired && !!signedMetaTx

    return {
      ...tx,
      status,
      timeRemaining,
      progress,
      isExpired: expired,
      canCancel,
      canApprove: canBroadcast, // Keep for backward compatibility
      hasSignedMetaTx: !!signedMetaTx,
      signedMetaTx: signedMetaTx?.signedMetaTx,
    }
  }) || []

  // Refresh transactions
  const refreshTransactions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['messenger-transactions'] })
  }, [queryClient])

  // Add transaction to monitoring list
  const addTransaction = useCallback((txId: bigint) => {
    setPendingTxIds(prev => {
      if (prev.includes(txId)) return prev
      return [...prev, txId]
    })
  }, [])

  // Remove transaction from monitoring list
  const removeTransaction = useCallback((txId: bigint) => {
    setPendingTxIds(prev => prev.filter(id => id !== txId))
  }, [])

  return {
    transactions: processedTransactions,
    isLoading: transactionsQuery.isLoading,
    isError: transactionsQuery.isError,
    error: transactionsQuery.error,
    isOwner,
    isBroadcaster,
    isRecovery,
    contractOwner,
    contractBroadcaster,
    contractRecovery,
    signedMetaTxs: signedMetaTxs || [],
    refreshTransactions,
    addTransaction,
    removeTransaction,
  }
}

