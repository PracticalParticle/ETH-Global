/**
 * React hook for managing message transactions
 */

import { useState, useCallback } from 'react'
import { useAccount, usePublicClient, useChainId } from 'wagmi'
import { Address, PublicClient } from 'viem'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { 
  TransactionRecord, 
  TransactionStatus, 
  PendingTransaction 
} from '../types/transaction'
import { getContractAddress, ENTERPRISE_MESSENGER_ABI } from '../lib/contracts'
import { 
  isTransactionExpired, 
  getTimeRemaining, 
  getTimeLockProgress 
} from '../lib/messengerContract'

const TIME_LOCK_PERIOD = 300 // 5 minutes in seconds

/**
 * Fetch a single transaction from contract
 */
async function fetchTransaction(
  publicClient: PublicClient,
  contractAddress: Address,
  txId: bigint
): Promise<TransactionRecord | null> {
  try {
    const result = await publicClient.readContract({
      address: contractAddress,
      abi: ENTERPRISE_MESSENGER_ABI,
      functionName: 'getTransaction',
      args: [txId],
    }) as {
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
 * Get contract owner address
 */
async function getContractOwner(
  publicClient: PublicClient,
  contractAddress: Address
): Promise<Address | null> {
  try {
    return await publicClient.readContract({
      address: contractAddress,
      abi: ENTERPRISE_MESSENGER_ABI,
      functionName: 'owner',
    })
  } catch (error) {
    console.error('Error fetching owner:', error)
    return null
  }
}

/**
 * Get contract broadcaster address
 */
async function getContractBroadcaster(
  publicClient: PublicClient,
  contractAddress: Address
): Promise<Address | null> {
  try {
    return await publicClient.readContract({
      address: contractAddress,
      abi: ENTERPRISE_MESSENGER_ABI,
      functionName: 'getBroadcaster',
    })
  } catch (error) {
    console.error('Error fetching broadcaster:', error)
    return null
  }
}

/**
 * Hook for fetching and monitoring message transactions
 */
export function useMessageTransactions(contractAddress?: Address) {
  const { address: connectedAddress } = useAccount()
  const publicClient = usePublicClient()
  const chainId = useChainId()
  const queryClient = useQueryClient()

  const [pendingTxIds, setPendingTxIds] = useState<bigint[]>([])

  // Get contract address
  const messengerAddress = contractAddress || (chainId ? getContractAddress(chainId) : undefined)

  // Fetch contract roles
  const { data: contractOwner } = useQuery({
    queryKey: ['messenger-owner', messengerAddress, chainId],
    queryFn: () => 
      messengerAddress && publicClient 
        ? getContractOwner(publicClient, messengerAddress)
        : null,
    enabled: !!messengerAddress && !!publicClient,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: contractBroadcaster } = useQuery({
    queryKey: ['messenger-broadcaster', messengerAddress, chainId],
    queryFn: () => 
      messengerAddress && publicClient 
        ? getContractBroadcaster(publicClient, messengerAddress)
        : null,
    enabled: !!messengerAddress && !!publicClient,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Check user roles
  const isOwner = connectedAddress && contractOwner 
    ? connectedAddress.toLowerCase() === contractOwner.toLowerCase()
    : false

  const isBroadcaster = connectedAddress && contractBroadcaster
    ? connectedAddress.toLowerCase() === contractBroadcaster.toLowerCase()
    : false

  // Fetch individual transactions
  const transactionsQuery = useQuery({
    queryKey: ['messenger-transactions', pendingTxIds, messengerAddress, chainId],
    queryFn: async () => {
      if (!messengerAddress || !publicClient || pendingTxIds.length === 0) {
        return []
      }

      const transactions = await Promise.all(
        pendingTxIds.map(txId => 
          fetchTransaction(publicClient, messengerAddress, txId)
        )
      )

      return transactions.filter((tx): tx is TransactionRecord => tx !== null)
    },
    enabled: !!messengerAddress && !!publicClient && pendingTxIds.length > 0,
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

    // Determine status
    let status = tx.status
    if (expired && tx.status === TransactionStatus.PENDING) {
      status = TransactionStatus.EXPIRED
    }

    // Determine permissions
    const canCancel = isOwner && status === TransactionStatus.PENDING && !expired
    const canApprove = isBroadcaster && status === TransactionStatus.PENDING && !expired

    return {
      ...tx,
      status,
      timeRemaining,
      progress,
      isExpired: expired,
      canCancel,
      canApprove,
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
    contractOwner,
    contractBroadcaster,
    refreshTransactions,
    addTransaction,
    removeTransaction,
  }
}

