import { useEffect, useMemo, useState } from 'react';
import { WalletId, useWallet } from '@txnlab/use-wallet-react';

type WalletConnectButtonProps = {
  className?: string;
};

const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const WalletConnectButton = ({ className = '' }: WalletConnectButtonProps) => {
  const { wallets, activeAddress, activeWallet, isReady } = useWallet();
  const [, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const peraWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === WalletId.PERA),
    [wallets],
  );

  const handleWalletAction = async () => {
    setError('');
    if (isConnecting) return;

    try {
      setIsConnecting(true);

      if (activeAddress && activeWallet) {
        await activeWallet.disconnect();
        localStorage.removeItem('algoescrow_activeAddress');
        return;
      }

      if (!peraWallet) {
        setError('Pera wallet is not available.');
        return;
      }

      // Ensure Pera is the active wallet before triggering connect.
      peraWallet.setActive();

      const accounts = await peraWallet.connect();
      if (accounts.length > 0) {
        peraWallet.setActiveAccount(accounts[0].address);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel|reject|denied/i.test(message)) {
        setError('Connection request was cancelled. Please approve in Pera to connect.');
      } else {
        setError(`Wallet connection failed: ${message || 'Unknown error'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (activeAddress) {
      localStorage.setItem('algoescrow_activeAddress', activeAddress);
      return;
    }

    localStorage.removeItem('algoescrow_activeAddress');
  }, [activeAddress]);

  return (
    <button
      type="button"
      onClick={handleWalletAction}
      disabled={!isReady || isConnecting}
      className={className}
    >
      {!isReady
        ? 'Loading Wallet...'
        : isConnecting
          ? 'Connecting...'
          : activeAddress
            ? `Connected: ${shortenAddress(activeAddress)}`
            : 'Connect Pera'}
    </button>
  );
};

export default WalletConnectButton;
