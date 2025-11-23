/**
 * Component for displaying contract roles and current user permissions
 */

import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi';
import { Address } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { SecureOwnable } from '../../../../../sdk/typescript/contracts/SecureOwnable';
import { ROLES } from '../../../../../sdk/typescript/types/lib.index';
import { getContractAddress } from '../lib/contracts';
import { useMemo, useState } from 'react';

interface RoleDisplayProps {
  contractAddress?: Address;
}

interface RoleInfo {
  name: string;
  address: Address | null;
  hash: string;
  isCurrentUser: boolean;
  canRequest: boolean;
  canCancel: boolean;
  canApprove: boolean;
  canBroadcast: boolean;
}

export function RoleDisplay({ contractAddress }: RoleDisplayProps) {
  const { address: connectedAddress } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();

  // Get contract address
  const messengerAddress = contractAddress || (chainId ? getContractAddress(chainId) : undefined);

  // Get chain for SDK
  const chain = useMemo(() => {
    if (!publicClient) return undefined;
    // Get chain from publicClient
    return publicClient.chain || undefined;
  }, [publicClient]);

  // Fetch contract roles
  const { data: ownerAddress } = useQuery({
    queryKey: ['messenger-owner', messengerAddress, chainId],
    queryFn: async () => {
      if (!messengerAddress || !publicClient || !chain) return null;
      const sdk = new SecureOwnable(publicClient, walletClient || undefined, messengerAddress, chain);
      return sdk.owner();
    },
    enabled: !!messengerAddress && !!publicClient && !!chain,
    staleTime: 5 * 60 * 1000,
  });

  const { data: broadcasterAddress } = useQuery({
    queryKey: ['messenger-broadcaster', messengerAddress, chainId],
    queryFn: async () => {
      if (!messengerAddress || !publicClient || !chain) return null;
      const sdk = new SecureOwnable(publicClient, walletClient || undefined, messengerAddress, chain);
      return sdk.getBroadcaster();
    },
    enabled: !!messengerAddress && !!publicClient && !!chain,
    staleTime: 5 * 60 * 1000,
  });

  const { data: recoveryAddress } = useQuery({
    queryKey: ['messenger-recovery', messengerAddress, chainId],
    queryFn: async () => {
      if (!messengerAddress || !publicClient || !chain) return null;
      const sdk = new SecureOwnable(publicClient, walletClient || undefined, messengerAddress, chain);
      return sdk.getRecovery();
    },
    enabled: !!messengerAddress && !!publicClient && !!chain,
    staleTime: 5 * 60 * 1000,
  });

  // Build role information
  const roles: RoleInfo[] = useMemo(() => {
    if (!ownerAddress || !broadcasterAddress || !recoveryAddress) return [];

    const isOwner = connectedAddress && ownerAddress
      ? connectedAddress.toLowerCase() === ownerAddress.toLowerCase()
      : false;
    const isBroadcaster = connectedAddress && broadcasterAddress
      ? connectedAddress.toLowerCase() === broadcasterAddress.toLowerCase()
      : false;
    const isRecovery = connectedAddress && recoveryAddress
      ? connectedAddress.toLowerCase() === recoveryAddress.toLowerCase()
      : false;

    return [
      {
        name: 'Owner',
        address: ownerAddress,
        hash: ROLES.OWNER_ROLE,
        isCurrentUser: isOwner,
        canRequest: isOwner, // Owner can request messages
        canCancel: isOwner, // Owner can cancel messages
        canApprove: false, // Owner signs meta-tx, but doesn't approve directly
        canBroadcast: false, // Only broadcaster broadcasts
      },
      {
        name: 'Broadcaster',
        address: broadcasterAddress,
        hash: ROLES.BROADCASTER_ROLE,
        isCurrentUser: isBroadcaster,
        canRequest: false,
        canCancel: false,
        canApprove: isBroadcaster, // Broadcaster can approve via meta-tx
        canBroadcast: isBroadcaster, // Broadcaster broadcasts signed meta-txs
      },
      {
        name: 'Recovery',
        address: recoveryAddress,
        hash: ROLES.RECOVERY_ROLE,
        isCurrentUser: isRecovery,
        canRequest: false,
        canCancel: false,
        canApprove: false,
        canBroadcast: false,
      },
    ];
  }, [ownerAddress, broadcasterAddress, recoveryAddress, connectedAddress]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const toggleRole = (roleHash: string) => {
    setExpandedRole(expandedRole === roleHash ? null : roleHash);
  };

  if (!messengerAddress) {
    return (
      <div className="glass-panel p-3 rounded-xl">
        <p className="text-zinc-500 dark:text-gray-400 text-xs">
          Connect to a supported network to view roles
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-3 rounded-xl">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between mb-2"
      >
        <h3 className="text-zinc-900 dark:text-white text-sm font-semibold">
          Contract Roles
        </h3>
        <span className="material-symbols-outlined text-zinc-600 dark:text-gray-400 text-lg transition-transform">
          {isExpanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {!isExpanded ? (
        <div className="space-y-2">
          {/* Compact view - show only role names and current user indicator */}
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <div
                key={role.hash}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                  role.isCurrentUser
                    ? 'bg-primary/20 border-primary/50 text-primary'
                    : 'bg-zinc-100 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-gray-300'
                }`}
              >
                {role.name}
                {role.isCurrentUser && (
                  <span className="ml-1.5 text-[10px]">• You</span>
                )}
              </div>
            ))}
          </div>
          {!connectedAddress && (
            <p className="text-yellow-600 dark:text-yellow-400 text-xs mt-2">
              Connect wallet to see permissions
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2 mt-3">
          {roles.map((role) => {
            const isRoleExpanded = expandedRole === role.hash;
            return (
              <div
                key={role.hash}
                className={`rounded-lg border transition-all ${
                  role.isCurrentUser
                    ? 'bg-primary/10 border-primary/50'
                    : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <button
                  onClick={() => toggleRole(role.hash)}
                  className="w-full p-2.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900 dark:text-white">
                      {role.name}
                    </span>
                    {role.isCurrentUser && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-primary text-white rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-zinc-600 dark:text-gray-400 text-sm transition-transform">
                    {isRoleExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {isRoleExpanded && (
                  <div className="px-2.5 pb-2.5 pt-0 border-t border-zinc-200 dark:border-zinc-700 mt-2">
                    <div className="text-xs text-zinc-600 dark:text-gray-400 mt-2 mb-2">
                      <div className="font-mono break-all">{role.address || 'Not set'}</div>
                    </div>

                    {role.isCurrentUser && (
                      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <div className="text-xs text-zinc-600 dark:text-gray-400">
                          <div className="font-medium mb-1">You can:</div>
                          <ul className="list-disc list-inside space-y-0.5">
                            {role.canRequest && <li>Request messages</li>}
                            {role.canCancel && <li>Cancel messages</li>}
                            {role.canApprove && <li>Approve messages</li>}
                            {role.canBroadcast && <li>Broadcast signed meta-transactions</li>}
                            {!role.canRequest && !role.canCancel && !role.canApprove && !role.canBroadcast && (
                              <li className="text-zinc-500">No actions available</li>
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!connectedAddress && (
            <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                Connect your wallet to see your role and permissions
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

