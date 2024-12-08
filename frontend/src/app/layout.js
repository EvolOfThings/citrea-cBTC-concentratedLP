import '@rainbow-me/rainbowkit/styles.css'
import { Providers } from './providers'
import '../styles/globals.css'

export const metadata = {
  title: 'cBTC Liquidity Booster',
  description: 'Incentivized Liquidity Provision for cBTC',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
