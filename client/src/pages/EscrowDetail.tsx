import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';

type EscrowStateResponse = {
  appId: number;
  appAddress: string;
  buyer: string | null;
  seller: string | null;
  amount: number;
  state: number;
  escrowType: number;
  itemName: string;
  currentRound?: number;
  roundsRemaining?: number;
  stateName?: string;
  isExpired?: boolean;
};

const API_BASE = 'http://localhost:5000/api/escrow';

const stateColor = (stateName: string) => {
  if (stateName === 'COMPLETED') return 'bg-green-500/10 text-green-400 border-green-500/20';
  if (stateName === 'DISPUTED') return 'bg-red-500/10 text-red-400 border-red-500/20';
  if (stateName === 'FUNDED') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
};

export default function EscrowDetail() {
  const { appId } = useParams();
  const { activeAddress } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [state, setState] = useState<EscrowStateResponse | null>(null);
  const [txMessage, setTxMessage] = useState('');

  const escrowId = useMemo(() => Number(appId || 0), [appId]);

  const fetchEscrow = useCallback(async () => {
    if (!escrowId || Number.isNaN(escrowId)) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE}/${escrowId}`);
      setState(response.data.data as EscrowStateResponse);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to fetch escrow');
    } finally {
      setLoading(false);
    }
  }, [escrowId]);

  useEffect(() => {
    void fetchEscrow();
  }, [fetchEscrow]);

  const handleBuildFund = async () => {
    if (!activeAddress || !state) {
      setTxMessage('Connect wallet first.');
      return;
    }
    try {
      const response = await axios.post(`${API_BASE}/${escrowId}/build-fund-txns`, {
        buyerAddress: activeAddress,
        amountMicroAlgo: state.amount > 0 ? state.amount : 1_000_000,
      });
      setTxMessage(
        `Unsigned group prepared (${response.data.data.unsignedTransactions.length} txns). Sign with wallet via /submit-signed-txns flow.`,
      );
    } catch (err: any) {
      setTxMessage(err?.response?.data?.error || err?.message || 'Failed to build fund transaction');
    }
  };

  const handleConfirmDelivery = async () => {
    try {
      const response = await axios.post(`${API_BASE}/${escrowId}/confirm-delivery`, {
        secret: 'algoescrow_oracle_secret_2026',
      });
      setTxMessage(`Delivery confirmed: ${response.data?.data?.txId || ''}`);
      await fetchEscrow();
    } catch (err: any) {
      setTxMessage(err?.response?.data?.error || err?.message || 'Failed to confirm delivery');
    }
  };

  const handleDispute = async () => {
    if (!activeAddress) {
      setTxMessage('Connect wallet first.');
      return;
    }
    try {
      const response = await axios.post(`${API_BASE}/${escrowId}/build-dispute-txn`, {
        disputerAddress: activeAddress,
      });
      setTxMessage(`Unsigned dispute txn prepared. Submit via /submit-signed-txns. ${response.data?.data?.note || ''}`);
    } catch (err: any) {
      setTxMessage(err?.response?.data?.error || err?.message || 'Failed to prepare dispute transaction');
    }
  };

  if (!escrowId || Number.isNaN(escrowId)) {
    return <div className="text-white p-8">Invalid escrow id.</div>;
  }

  return (
    <div className="w-full min-h-screen bg-[#0a0a0c] text-white px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-[#141418] border border-white/10 rounded-xl p-6">
          <h1 className="text-2xl font-bold">Escrow #{escrowId}</h1>
          <p className="text-[#8a8a98] text-sm mt-1">Live on-chain escrow detail and actions.</p>
        </div>

        {loading && <div className="text-[#8a8a98]">Loading escrow...</div>}
        {error && <div className="text-red-400">{error}</div>}

        {state && (
          <>
            <div className="bg-[#141418] border border-white/10 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#8a8a98]">State</span>
                <span className={`px-3 py-1 rounded-full border text-xs font-bold ${stateColor(state.stateName || 'CREATED')}`}>
                  {state.stateName || 'UNKNOWN'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-[#8a8a98]">Item:</span> {state.itemName || 'N/A'}</div>
                <div><span className="text-[#8a8a98]">Amount:</span> {state.amount}</div>
                <div><span className="text-[#8a8a98]">Buyer:</span> {state.buyer || 'Not funded yet'}</div>
                <div><span className="text-[#8a8a98]">Seller:</span> {state.seller || 'N/A'}</div>
                <div><span className="text-[#8a8a98]">Current round:</span> {state.currentRound ?? 'N/A'}</div>
                <div><span className="text-[#8a8a98]">Rounds remaining:</span> {state.roundsRemaining ?? 'N/A'}</div>
              </div>
              <a
                href={`https://lora.algokit.io/testnet/application/${escrowId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-purple-400 hover:text-purple-300 text-sm"
              >
                View on LORA
              </a>
            </div>

            <div className="bg-[#141418] border border-white/10 rounded-xl p-6">
              <h2 className="font-semibold mb-4">Actions</h2>
              <div className="flex flex-wrap gap-3">
                <button onClick={handleBuildFund} className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded">
                  Fund (build unsigned txns)
                </button>
                <button onClick={handleConfirmDelivery} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded">
                  Confirm Delivery
                </button>
                <button onClick={handleDispute} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded">
                  Raise Dispute
                </button>
                <button onClick={() => void fetchEscrow()} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded">
                  Refresh
                </button>
              </div>
              {txMessage && <p className="mt-4 text-sm text-[#c7c7d1]">{txMessage}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
