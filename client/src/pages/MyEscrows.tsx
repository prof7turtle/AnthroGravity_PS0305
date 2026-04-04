import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '@txnlab/use-wallet-react';
import { listEscrowsByAddress, type EscrowRecord } from '../lib/escrowApi';

const stateStyles: Record<EscrowRecord['state'], string> = {
  CREATED: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  FUNDED: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
  COMPLETED: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  DISPUTED: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
  REFUNDED: 'bg-slate-400/20 text-slate-100 border-slate-300/40',
  EXPIRED: 'bg-zinc-500/20 text-zinc-200 border-zinc-300/40',
};

const truncateAddress = (value: string) => {
  if (!value) return '-';
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
};

const formatAmount = (escrow: EscrowRecord) => {
  if (escrow.currency === 'ALGO') {
    const algo = Number(escrow.amount || 0) / 1_000_000;
    return `${algo.toLocaleString(undefined, { maximumFractionDigits: 6 })} ALGO`;
  }
  return `${Number(escrow.amount || 0).toLocaleString()} ${escrow.currency}`;
};

const MyEscrows = () => {
  const { activeAddress } = useWallet();
  const [escrows, setEscrows] = useState<EscrowRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const address = useMemo(() => String(activeAddress || '').trim(), [activeAddress]);

  const loadEscrows = async () => {
    if (!address) {
      setEscrows([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const list = await listEscrowsByAddress(address);
      setEscrows(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your escrows');
      setEscrows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEscrows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <section className="min-h-screen bg-[#0a0a0c] px-6 pb-20 pt-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 rounded-2xl border border-white/10 bg-linear-to-br from-[#171720] via-[#121219] to-[#0d0d12] p-6 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-white/50">Escrow History</p>
          <h1 className="mt-2 font-['Outfit'] text-3xl font-extrabold">My Escrows</h1>
          <p className="mt-2 text-sm text-white/60">Reopen any escrow you created or participated in.</p>
        </header>

        {!address && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-100">
            Connect your wallet to view your escrows.
          </div>
        )}

        {address && (
          <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-widest text-white/50">Active Wallet</p>
            <p className="mt-1 text-sm font-mono text-white">{address}</p>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/75">Loading escrows...</div>
        )}

        {!loading && !!error && (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-6 text-rose-100">
            {error}
          </div>
        )}

        {!loading && !error && address && escrows.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            No escrows found for this wallet yet.
          </div>
        )}

        {!loading && !error && escrows.length > 0 && (
          <div className="space-y-4">
            {escrows.map((escrow) => (
              <article key={escrow._id || escrow.escrowId} className="rounded-2xl border border-white/10 bg-[#11111a] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/60">{escrow.itemName || 'Untitled Escrow'}</p>
                    <p className="mt-1 text-lg font-bold text-white">{escrow.escrowId}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${stateStyles[escrow.state]}`}>
                    {escrow.state}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-white/80 md:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50">Type</p>
                    <p className="mt-1">{escrow.escrowType}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50">Amount</p>
                    <p className="mt-1">{formatAmount(escrow)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50">Buyer</p>
                    <p className="mt-1">{truncateAddress(escrow.buyerAddress)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/50">Seller</p>
                    <p className="mt-1">{truncateAddress(escrow.sellerAddress)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/escrow/${escrow.escrowId}`}
                    className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-cyan-400"
                  >
                    Open Escrow
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default MyEscrows;
