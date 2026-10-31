import { useEffect, useState, type ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit'
import { wagmiConfig } from './config'

const queryClient = new QueryClient()

/**
 * RainbowKit theme follows the app theme (dark default, html[data-theme=light])
 * with the Openfund mint accent. Persian/English labels are handled by the
 * custom connect button (ConnectButton.Custom) — see RainbowConnect.tsx.
 */
function useAppTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  )
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() =>
      setTheme(el.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
    )
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const theme = useAppTheme()
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={
            theme === 'dark'
              ? darkTheme({ accentColor: '#82e7bd', accentColorForeground: '#08130d' })
              : lightTheme({ accentColor: '#12965D', accentColorForeground: '#ffffff' })
          }
          appInfo={{ appName: 'Openfund', learnMoreUrl: 'https://gains.trade' }}
          modalSize='compact'
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
