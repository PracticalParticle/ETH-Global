import { ReactNode } from 'react';
import { WagmiProvider, http, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { injected } from 'wagmi/connectors';
import { LAYERZERO_CHAINS } from '../lib/chains';
import type { Chain } from 'wagmi/chains';

// Create transport with retry logic and timeout
function createTransportWithRetry() {
  return http(undefined, {
    timeout: 30_000, // 30 second timeout
    retryCount: 3,
    retryDelay: 1000,
    fetchOptions: {
      signal: AbortSignal.timeout(30_000),
    },
  });
}

// Create a new QueryClient instance with retry logic
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // cache results for 1 minute
      gcTime: 5 * 60_000, // keep in cache for 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: 3, // Retry failed requests
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 2, // Retry failed mutations
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

// Use LayerZero chains directly - TypeScript requires at least one chain
const supportedChains = LAYERZERO_CHAINS as readonly [Chain, ...Chain[]];

// Create transports for all supported chains with retry logic
const transports = Object.fromEntries(
  supportedChains.map((chain) => [chain.id, createTransportWithRetry()])
);

// Configure wagmi with supported chains
const wagmiConfig = createConfig({
  chains: supportedChains,
  transports,
  ssr: false,
  connectors: [injected()],
});

interface WagmiProviderProps {
  children: ReactNode;
}

export function CustomWagmiProvider({ children }: WagmiProviderProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize="compact"
          appInfo={{
            appName: 'Hackathon UI',
            learnMoreUrl: 'https://ethereum.org/',
          }}
          theme={{
            lightMode: lightTheme(),
            darkMode: darkTheme(),
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

