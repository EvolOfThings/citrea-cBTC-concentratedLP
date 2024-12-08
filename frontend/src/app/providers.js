'use client'

import * as React from 'react'
import {
  RainbowKitProvider,
  getDefaultWallets,
  connectorsForWallets,
} from '@rainbow-me/rainbowkit'
import { configureChains, createConfig, WagmiConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [sepolia],
  [publicProvider()]
)

const projectId = '9fb1fbf98137b44db088d046f872b03b'

const { wallets } = getDefaultWallets({
  appName: 'cBTC Liquidity Booster',
  projectId,
  chains,
});

const connectors = connectorsForWallets(wallets);

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})

export function Providers({ children }) {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider 
        chains={chains} 
        modalSize="compact"
        appInfo={{
          appName: 'cBTC Liquidity Booster',
          learnMoreUrl: 'https://docs.uniswap.org/contracts/v4/overview',
        }}
      >
        {mounted && children}
      </RainbowKitProvider>
    </WagmiConfig>
  )
}
