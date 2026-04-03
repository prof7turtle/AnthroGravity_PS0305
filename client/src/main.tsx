import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NetworkId, WalletId, WalletManager, WalletProvider } from '@txnlab/use-wallet-react'
import './index.css'
import App from './App.tsx'

if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis
}

const walletManager = new WalletManager({
  wallets: [WalletId.PERA],
  defaultNetwork: NetworkId.TESTNET,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider manager={walletManager}>
      <App />
    </WalletProvider>
  </StrictMode>,
)
