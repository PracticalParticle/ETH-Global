import { ReactNode } from 'react';
import { WagmiProvider, http, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme, darkTheme } from '@rainbow-me/rainbowkit';
import { injected } from 'wagmi/connectors';
import { sepolia, mainnet } from 'wagmi/chains';

// Create a new QueryClient instance with conservative defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // cache results for 1 minute
      gcTime: 5 * 60_000, // keep in cache for 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

// Configure wagmi with supported chains
const wagmiConfig = createConfig({
  chains: [sepolia, mainnet],
  transports: {
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
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

