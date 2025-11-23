/**
 * Component for managing transaction lifecycle
 */

import { useState, useEffect } from 'react'
import { TransactionStatus } from '../types/transaction'
import { useMessageTransactions } from '../hooks/useMessageTransactions'

interface TransactionLifecycleProps {
  contractAddress?: string
  onCancel?: (txId: bigint) => void
  onApprove?: (txId: bigint) => void
}

export function TransactionLifecycle({
  contractAddress,
  onCancel,
  onApprove,
}: TransactionLifecycleProps) {
  const {
    transactions,
    isLoading,
    isError,
    isOwner,
    isBroadcaster,
    refreshTransactions,
  } = useMessageTransactions(contractAddress as `0x${string}` | undefined)

  // Real-time countdown state
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000))

  // Update current time every second for real-time countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-refresh transactions every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refreshTransactions()
    }, 10000)
    return () => clearInterval(interval)
  }, [refreshTransactions])

  const formatTimeRemaining = (releaseTime: bigint): string => {
    const remaining = Number(releaseTime) - currentTime
    if (remaining <= 0) return 'Expired'
    
    const days = Math.floor(remaining / 86400)
    const hours = Math.floor((remaining % 86400) / 3600)
    const minutes = Math.floor((remaining % 3600) / 60)
    const secs = remaining % 60
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`
    }
    return `${secs}s`
  }

  const getStatusBadge = (status: TransactionStatus, isExpired: boolean) => {
    if (isExpired && status === TransactionStatus.PENDING) {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full">
          Expired
        </span>
      )
    }

    switch (status) {
      case TransactionStatus.PENDING:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full">
            Pending
          </span>
        )
      case TransactionStatus.APPROVED:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full">
            Approved
          </span>
        )
      case TransactionStatus.EXECUTED:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full">
            Executed
          </span>
        )
      case TransactionStatus.CANCELLED:
        return (
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300 rounded-full">
            Cancelled
          </span>
        )
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="glass-panel p-6 rounded-xl">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-zinc-300 dark:bg-zinc-600 rounded w-1/4" />
          <div className="h-20 bg-zinc-300 dark:bg-zinc-600 rounded" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="glass-panel p-6 rounded-xl border border-red-500/50">
        <p className="text-red-600 dark:text-red-400 text-sm">
          Error loading transactions
        </p>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-xl">
        <p className="text-zinc-500 dark:text-gray-400 text-sm text-center">
          No pending transactions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-zinc-900 dark:text-white text-lg font-bold">
        Transaction Lifecycle
      </h3>

      {transactions.map((tx) => (
        <div key={tx.txId.toString()} className="glass-panel p-4 rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-zinc-900 dark:text-white text-sm font-medium">
                Transaction #{tx.txId.toString()}
              </span>
              {getStatusBadge(tx.status, tx.isExpired)}
            </div>
          </div>

          {/* Time Lock Progress */}
          {tx.status === TransactionStatus.PENDING && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-gray-400 mb-1">
                <span>Time Lock Progress</span>
                <span className={tx.isExpired ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                  {formatTimeRemaining(tx.releaseTime)}
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    tx.isExpired 
                      ? 'bg-red-500' 
                      : tx.progress > 80 
                        ? 'bg-yellow-500' 
                        : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, tx.progress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Expiration Warning */}
          {tx.isExpired && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/50 rounded text-red-600 dark:text-red-400 text-xs">
              ⚠️ This transaction has expired and cannot be approved
            </div>
          )}

          {/* Transaction Details */}
          <div className="space-y-1 text-xs text-zinc-600 dark:text-gray-400 mb-3">
            <div>
              Release Time: {new Date(Number(tx.releaseTime) * 1000).toLocaleString()}
            </div>
            {tx.targetChainId !== undefined && tx.targetChainId !== 0n && (
              <div>Target Chain: {tx.targetChainId.toString()}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {tx.canCancel && (
              <button
                onClick={() => onCancel?.(tx.txId)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            )}
            {tx.canApprove && (
              <button
                onClick={() => onApprove?.(tx.txId)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-primary/20 hover:bg-primary/30 text-primary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve
              </button>
            )}
            {!tx.canCancel && !tx.canApprove && (
              <p className="text-xs text-zinc-500 dark:text-gray-400">
                {isOwner ? 'Waiting for broadcaster approval' : isBroadcaster ? 'Waiting for time lock' : 'No actions available'}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

