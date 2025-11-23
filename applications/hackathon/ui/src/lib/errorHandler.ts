/**
 * Error handling utilities for RPC and contract errors
 */

import { BaseError } from 'viem';

export interface ErrorInfo {
  message: string;
  code?: string;
  retryable: boolean;
  userMessage: string;
}

/**
 * Handle RPC errors with user-friendly messages
 */
export function handleRpcError(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    // Check for common RPC error patterns
    if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
      return {
        message: error.message,
        code: 'RPC_FETCH_ERROR',
        retryable: true,
        userMessage: 'Network error: Unable to connect to blockchain. Please check your internet connection and try again.',
      };
    }

    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      return {
        message: error.message,
        code: 'RPC_TIMEOUT',
        retryable: true,
        userMessage: 'Request timed out. The network may be slow. Please try again.',
      };
    }

    if (error.message.includes('network') || error.message.includes('Network')) {
      return {
        message: error.message,
        code: 'RPC_NETWORK_ERROR',
        retryable: true,
        userMessage: 'Network error occurred. Please try again.',
      };
    }

    // Viem BaseError handling
    if (error instanceof BaseError) {
      return {
        message: error.message,
        code: error.name,
        retryable: false,
        userMessage: error.shortMessage || error.message,
      };
    }
  }

  // Generic error
  return {
    message: String(error),
    retryable: false,
    userMessage: 'An unexpected error occurred. Please try again.',
  };
}

/**
 * Recursively check for RPC errors in error object and nested properties
 */
function checkForRpcError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  
  const errorObj = error as Record<string, unknown>;
  const errorMessage = String(errorObj.message || '').toLowerCase();
  const errorName = String(errorObj.name || '').toLowerCase();
  
  // Check main error message
  if (errorMessage.includes('failed to fetch') || 
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('network error') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      errorMessage.includes('signal timed out') ||
      errorMessage.includes('http request failed') ||
      errorMessage.includes('connection')) {
    return true;
  }
  
  // Check originalError if it exists
  if (errorObj.originalError) {
    if (checkForRpcError(errorObj.originalError)) {
      return true;
    }
  }
  
  // Check cause if it exists
  if (errorObj.cause) {
    if (checkForRpcError(errorObj.cause)) {
      return true;
    }
  }
  
  // Check if ContractFunctionExecutionError with RPC error in message
  if (errorName.includes('contractfunctionexecutionerror') && errorMessage.includes('failed to fetch')) {
    return true;
  }
  
  return false;
}

/**
 * Handle contract errors with user-friendly messages
 */
export function handleContractError(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    // Check for RPC errors recursively (including nested originalError)
    const isRpcError = checkForRpcError(error);
    
    if (isRpcError) {
      return {
        message: error.message,
        code: 'RPC_FETCH_ERROR',
        retryable: true,
        userMessage: 'Network error: Unable to connect to blockchain. The RPC endpoint may be temporarily unavailable. Please try again.',
      };
    }

    // Permission errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('onlyowner') || errorMessage.includes('onlybroadcaster')) {
      return {
        message: error.message,
        code: 'PERMISSION_DENIED',
        retryable: false,
        userMessage: 'You do not have permission to perform this action. Please check your role.',
      };
    }

    // Transaction reverted
    if (errorMessage.includes('revert') || errorMessage.includes('execution reverted')) {
      // Extract revert reason with better pattern matching
      // Look for "reverted with the following reason:" or "reverted:" patterns
      let reason = '';
      const revertPatterns = [
        /revert[^:]*:\s*(.+?)(?:\n|Contract Call:|$)/is,
        /reverted with the following reason:\s*(.+?)(?:\n|Contract Call:|$)/is,
        /execution reverted:\s*(.+?)(?:\n|Contract Call:|$)/is,
      ];
      
      for (const pattern of revertPatterns) {
        const match = error.message.match(pattern);
        if (match && match[1]) {
          reason = match[1].trim();
          break;
        }
      }
      
      // Also check originalError for revert reasons
      const errorObj = error as unknown as Record<string, unknown>;
      if (!reason && errorObj.originalError && typeof errorObj.originalError === 'object') {
        const originalErrorObj = errorObj.originalError as Record<string, unknown>;
        const originalMsg = String(originalErrorObj.message || '');
        for (const pattern of revertPatterns) {
          const match = originalMsg.match(pattern);
          if (match && match[1]) {
            reason = match[1].trim();
            break;
          }
        }
      }
      
      const reasonLower = reason.toLowerCase();
      
      // If revert reason is "Failed to fetch" or similar RPC errors, treat as RPC error
      if (reasonLower.includes('failed to fetch') || 
          reasonLower.includes('fetch failed') ||
          reasonLower.includes('network error') ||
          reasonLower.includes('timeout') ||
          reasonLower.includes('http request failed')) {
        return {
          message: error.message,
          code: 'RPC_FETCH_ERROR',
          retryable: true,
          userMessage: 'Network error: Unable to connect to blockchain. The RPC endpoint may be temporarily unavailable. Please try again.',
        };
      }
      
      // Return the actual revert reason if we found one
      return {
        message: error.message,
        code: 'TRANSACTION_REVERTED',
        retryable: false,
        userMessage: reason ? `Transaction failed: ${reason}` : 'Transaction reverted. Please check the transaction parameters.',
      };
    }

    // Insufficient funds
    if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
      return {
        message: error.message,
        code: 'INSUFFICIENT_FUNDS',
        retryable: false,
        userMessage: 'Insufficient funds. Please ensure you have enough ETH to cover gas fees.',
      };
    }

    // Gas errors
    if (errorMessage.includes('gas') || errorMessage.includes('out of gas')) {
      return {
        message: error.message,
        code: 'GAS_ERROR',
        retryable: true,
        userMessage: 'Gas estimation failed. Please try again or increase gas limit.',
      };
    }

    // Time lock errors
    if (errorMessage.includes('time') || errorMessage.includes('expired') || errorMessage.includes('delay')) {
      return {
        message: error.message,
        code: 'TIME_LOCK_ERROR',
        retryable: false,
        userMessage: 'Time lock error. The transaction may have expired or the time lock period has not passed.',
      };
    }

    // Viem BaseError handling
    if (error instanceof BaseError) {
      return {
        message: error.message,
        code: error.name,
        retryable: false,
        userMessage: error.shortMessage || error.message,
      };
    }
  }

  return {
    message: String(error),
    retryable: false,
    userMessage: 'Contract interaction failed. Please try again.',
  };
}

/**
 * Check if error is retryable
 * Checks both RPC errors and contract errors (which may be RPC errors in disguise)
 */
export function isRetryableError(error: unknown): boolean {
  // First check as RPC error
  const rpcErrorInfo = handleRpcError(error);
  if (rpcErrorInfo.retryable) {
    return true;
  }
  
  // Then check as contract error (which may detect RPC errors)
  const contractErrorInfo = handleContractError(error);
  return contractErrorInfo.retryable;
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw lastError;
}

