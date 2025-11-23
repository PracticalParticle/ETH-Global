/**
 * EnterpriseCrossChainMessenger SDK wrapper
 * Extends SecureOwnable SDK to add messenger-specific methods
 */

import { Address, PublicClient, WalletClient, Chain, Hex } from 'viem';
import { SecureOwnable } from '../../../../../sdk/typescript/contracts/SecureOwnable';
import { TransactionOptions, TransactionResult } from '../../../../../sdk/typescript/interfaces/base.index';
import { MetaTransaction } from '../../../../../sdk/typescript/interfaces/lib.index';
import SecureOwnableABIJson from '../../../../../abi/SecureOwnable.abi.json';
import { ENTERPRISE_MESSENGER_ABI } from './contracts';

// Combine SecureOwnable ABI with messenger-specific functions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MESSENGER_ABI: any[] = [
  ...(SecureOwnableABIJson as unknown as any[]), // eslint-disable-line @typescript-eslint/no-explicit-any
  ...(ENTERPRISE_MESSENGER_ABI as unknown as any[]), // eslint-disable-line @typescript-eslint/no-explicit-any
];

/**
 * Message requirements structure matching the contract
 */
export interface MessageRequirements {
  requiresFastFinality: boolean;
  requiresGuaranteedDelivery: boolean;
  isCostSensitive: boolean;
  isMultiChain: boolean;
  maxDelay: bigint;
  amount: bigint;
  requiresNativeSecurity: boolean;
  requiresDisputeResolution: boolean;
  securityLevel: number;
}

/**
 * EnterpriseCrossChainMessenger SDK
 * Extends SecureOwnable to add messenger-specific functionality
 */
export class EnterpriseCrossChainMessengerSDK extends SecureOwnable {
  constructor(
    client: PublicClient,
    walletClient: WalletClient | undefined,
    contractAddress: Address,
    chain: Chain
  ) {
    // Use combined ABI for messenger contract
    super(client, walletClient, contractAddress, chain);
    // Override ABI to include messenger functions
    // Access protected abi property through type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).abi = MESSENGER_ABI;
  }

  /**
   * Request to send a cross-chain message (time-delayed operation)
   * Only owner can request. Creates a time-locked transaction.
   */
  async sendMessageRequest(
    targetChainId: bigint,
    payload: Hex,
    requirements: MessageRequirements,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    // Access protected method through type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).executeWriteContract(
      'sendMessageRequest',
      [targetChainId, payload, requirements],
      options
    );
  }

  /**
   * Cancel a pending message request
   * Only owner can cancel.
   */
  async cancelMessage(
    txId: bigint,
    options: TransactionOptions
  ): Promise<TransactionResult> {
    // Access protected method through type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).executeWriteContract(
      'cancelMessage',
      [txId],
      options
    );
  }

  /**
   * Approve a pending message with meta-transaction
   * Only broadcaster can execute. Must send ETH to cover routing fees.
   */
  async approveMessageWithMetaTx(
    metaTx: MetaTransaction,
    value: bigint, // ETH value for routing fees
    options: TransactionOptions
  ): Promise<TransactionResult> {
    // Access protected methods through type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).validateWalletClient();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = (this as any).walletClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain = (this as any).chain;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contractAddress = (this as any).contractAddress;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (this as any).client;
    
    if (!walletClient) {
      throw new Error('Wallet client is required');
    }
    
    const walletClientAccount = walletClient.account?.address;
    const requestedAccount = options.from.toLowerCase();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writeContractParams: any = {
      chain: chain,
      address: contractAddress,
      abi: MESSENGER_ABI,
      functionName: 'approveMessageWithMetaTx',
      args: [metaTx],
      value, // Include ETH value for routing fees
    };
    
    if (!walletClientAccount || walletClientAccount.toLowerCase() !== requestedAccount) {
      writeContractParams.account = options.from;
    }
    
    try {
      const hash = await walletClient.writeContract(writeContractParams);
      return {
        hash,
        wait: () => client.waitForTransactionReceipt({ hash })
      };
    } catch (error: unknown) {
      const { handleViemError } = await import('../../../../../sdk/typescript/utils/viem-error-handler');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw await handleViemError(error as any, MESSENGER_ABI);
    }
  }

  /**
   * Get transaction record
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getTransaction(txId: bigint): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).executeReadContract('getTransaction', [txId]);
  }

  /**
   * Get router address
   */
  async getRouter(): Promise<Address> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).executeReadContract('router', []) as Promise<Address>;
  }

  /**
   * Get chain registry address
   */
  async getChainRegistry(): Promise<Address> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).executeReadContract('chainRegistry', []) as Promise<Address>;
  }

  /**
   * Get signer nonce (exposed from SecureOwnable)
   */
  async getSignerNonce(signer: Address): Promise<bigint> {
    return super.getSignerNonce(signer);
  }

  /**
   * Get all pending transaction IDs
   * Returns array of transaction IDs that are currently pending
   * Requires caller to have at least one role (owner, broadcaster, or recovery)
   * Uses executeReadContractAs to call with connected wallet address for permission checks
   */
  async getPendingTransactions(): Promise<bigint[]> {
    // Access protected methods through type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = (this as any).walletClient;
    
    // Get the connected wallet address
    const fromAddress = walletClient?.account?.address;
    
    if (!fromAddress) {
      throw new Error('Wallet client with account is required for getPendingTransactions (permissioned view function)');
    }

    // Use executeReadContractAs to call with the connected wallet address
    // This allows the contract to check msg.sender permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).executeReadContractAs('getPendingTransactions', [], fromAddress) as Promise<bigint[]>;
  }

  /**
   * Get all transaction history
   * Returns all transactions from the contract (up to a large limit)
   * The contract will automatically cap the range at the current txCounter
   * Requires caller to have at least one role (owner, broadcaster, or recovery)
   * Uses executeReadContractAs to call with connected wallet address for permission checks
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getAllTransactionHistory(): Promise<any[]> {
    // Access protected methods through type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = (this as any).walletClient;
    
    // Get the connected wallet address
    const fromAddress = walletClient?.account?.address;
    
    if (!fromAddress) {
      throw new Error('Wallet client with account is required for getAllTransactionHistory (permissioned view function)');
    }

    // Use a large number for toTxId - the contract will cap it at txCounter
    // Start from 1 to get all transactions
    const MAX_TX_ID = BigInt(1000000); // Large number, contract will cap at actual txCounter
    
    // Use executeReadContractAs to call with the connected wallet address
    // This allows the contract to check msg.sender permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).executeReadContractAs('getTransactionHistory', [1n, MAX_TX_ID], fromAddress) as Promise<any[]>;
  }
}

