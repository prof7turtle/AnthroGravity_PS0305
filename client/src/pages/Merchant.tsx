import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  deliverEscrow,
  disputeEscrow,
  getEscrow,
  refundEscrow,
  resolveEscrow,
  withdrawDisputeEscrow,
  type EscrowRecord,
} from '../lib/escrowApi';

type MerchantTab = 'transactions' | 'disputes' | 'api';

type ShipmentStage = {
  key: 'LABEL_CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  label: string;
  detail: string;
};

type TrackedShipment = {
  escrowId: string;
  trackingId: string;
  itemName: string;
  amount: number;
  currency: string;
  escrowState: EscrowRecord['state'];
  currentStageIndex: number;
  status: 'TRACKING' | 'DELIVERED' | 'RELEASED' | 'ERROR';
  releaseTxId: string;
  error: string;
  lastUpdate: string;
};

type DisputeCase = {
  escrowId: string;
  actor: string;
  escrow: EscrowRecord;
  busy: boolean;
  message: string;
  error: string;
  lastUpdate: string;
};

const SHIPMENT_STAGES: ShipmentStage[] = [
  { key: 'LABEL_CREATED', label: 'Label Created', detail: 'Carrier generated shipment label' },
  { key: 'PICKED_UP', label: 'Picked Up', detail: 'Package received by logistics partner' },
  { key: 'IN_TRANSIT', label: 'In Transit', detail: 'Shipment moving through distribution hubs' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', detail: 'Assigned to delivery rider' },
  { key: 'DELIVERED', label: 'Delivered', detail: 'Delivery confirmed at destination' },
];

const getProgressPercent = (index: number) => {
  const maxIndex = Math.max(1, SHIPMENT_STAGES.length - 1);
  return Math.round((index / maxIndex) * 100);
};

const formatTimestamp = (iso: string) => {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString();
};

const normalizeError = (err: unknown) => {
  if (err instanceof Error) return err.message;
  return 'Unexpected error occurred';
};

const Merchant = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MerchantTab>('transactions');
  const [escrowIdInput, setEscrowIdInput] = useState('');
  const [trackingIdInput, setTrackingIdInput] = useState('');
  const [trackingError, setTrackingError] = useState('');
  const [trackingStatus, setTrackingStatus] = useState('');
  const [isCreatingTracker, setIsCreatingTracker] = useState(false);
  const [busyTrackingIds, setBusyTrackingIds] = useState<string[]>([]);
  const [trackedShipments, setTrackedShipments] = useState<TrackedShipment[]>([]);
  const [disputeEscrowIdInput, setDisputeEscrowIdInput] = useState('');
  const [disputeActorInput, setDisputeActorInput] = useState('merchant-dashboard');
  const [isLoadingDispute, setIsLoadingDispute] = useState(false);
  const [disputeCases, setDisputeCases] = useState<DisputeCase[]>([]);
  const [disputeStatus, setDisputeStatus] = useState('');
  const [disputeError, setDisputeError] = useState('');

  const updateShipment = (trackingId: string, updater: (shipment: TrackedShipment) => TrackedShipment) => {
    setTrackedShipments((prev) => prev.map((shipment) => (shipment.trackingId === trackingId ? updater(shipment) : shipment)));
  };

  const markShipmentBusy = (trackingId: string, busy: boolean) => {
    setBusyTrackingIds((prev) => {
      if (busy && !prev.includes(trackingId)) return [...prev, trackingId];
      if (!busy) return prev.filter((value) => value !== trackingId);
      return prev;
    });
  };

  const addShipmentTracker = async () => {
    const escrowId = escrowIdInput.trim();
    const trackingId = trackingIdInput.trim().toUpperCase();

    setTrackingError('');
    setTrackingStatus('');

    if (!escrowId) {
      setTrackingError('Escrow ID is required');
      return;
    }

    if (!trackingId) {
      setTrackingError('Tracking ID from shipment company is required');
      return;
    }

    setIsCreatingTracker(true);

    try {
      const escrow = await getEscrow(escrowId);

      if (escrow.state !== 'FUNDED' && escrow.state !== 'COMPLETED') {
        throw new Error(`Escrow must be FUNDED/COMPLETED to track shipment. Current state: ${escrow.state}`);
      }

      const alreadyReleased = escrow.state === 'COMPLETED';
      const shipment: TrackedShipment = {
        escrowId,
        trackingId,
        itemName: escrow.itemName,
        amount: escrow.amount,
        currency: escrow.currency,
        escrowState: escrow.state,
        currentStageIndex: alreadyReleased ? SHIPMENT_STAGES.length - 1 : 0,
        status: alreadyReleased ? 'RELEASED' : 'TRACKING',
        releaseTxId: alreadyReleased ? escrow.txIds.release || 'ALREADY_RELEASED' : '',
        error: '',
        lastUpdate: new Date().toISOString(),
      };

      setTrackedShipments((prev) => {
        const withoutExisting = prev.filter((entry) => entry.trackingId !== trackingId);
        return [shipment, ...withoutExisting];
      });

      setTrackingStatus(`Tracking started for ${trackingId}. Shipment progress is now visible.`);
      setEscrowIdInput('');
      setTrackingIdInput('');
    } catch (err) {
      setTrackingError(normalizeError(err));
    } finally {
      setIsCreatingTracker(false);
    }
  };

  const advanceShipmentStatus = async (trackingId: string) => {
    const shipment = trackedShipments.find((entry) => entry.trackingId === trackingId);
    if (!shipment) return;

    if (shipment.status === 'RELEASED') {
      setTrackingStatus(`Escrow ${shipment.escrowId} already released.`);
      return;
    }

    if (shipment.currentStageIndex >= SHIPMENT_STAGES.length - 1 && shipment.status === 'DELIVERED') {
      setTrackingStatus(`Shipment ${shipment.trackingId} has reached destination. Processing release status...`);
    }

    markShipmentBusy(trackingId, true);
    setTrackingError('');

    try {
      const nextStageIndex = Math.min(shipment.currentStageIndex + 1, SHIPMENT_STAGES.length - 1);
      const isDelivered = nextStageIndex === SHIPMENT_STAGES.length - 1;

      updateShipment(trackingId, (current) => ({
        ...current,
        currentStageIndex: nextStageIndex,
        status: isDelivered ? 'DELIVERED' : 'TRACKING',
        error: '',
        lastUpdate: new Date().toISOString(),
      }));

      if (!isDelivered) {
        setTrackingStatus(`Tracking updated: ${trackingId} is now ${SHIPMENT_STAGES[nextStageIndex].label}.`);
        return;
      }

      const latestEscrow = await getEscrow(shipment.escrowId);
      if (latestEscrow.state === 'COMPLETED') {
        updateShipment(trackingId, (current) => ({
          ...current,
          status: 'RELEASED',
          escrowState: latestEscrow.state,
          releaseTxId: latestEscrow.txIds.release || 'ALREADY_RELEASED',
          lastUpdate: new Date().toISOString(),
        }));
        setTrackingStatus(`Shipment delivered. Escrow ${shipment.escrowId} was already released.`);
        return;
      }

      if (latestEscrow.state !== 'FUNDED') {
        throw new Error(`Escrow is ${latestEscrow.state}; funds can only release from FUNDED state.`);
      }

      const releasedEscrow = await deliverEscrow(shipment.escrowId, {
        actor: `shipment-oracle:${shipment.trackingId}`,
      });

      updateShipment(trackingId, (current) => ({
        ...current,
        status: 'RELEASED',
        escrowState: releasedEscrow.state,
        releaseTxId: releasedEscrow.txIds.release || 'RELEASED',
        lastUpdate: new Date().toISOString(),
      }));

      setTrackingStatus(`Delivery reached destination. Escrow released for ${shipment.escrowId}.`);
    } catch (err) {
      const message = normalizeError(err);
      updateShipment(trackingId, (current) => ({
        ...current,
        status: 'ERROR',
        error: message,
        lastUpdate: new Date().toISOString(),
      }));
      setTrackingError(message);
    } finally {
      markShipmentBusy(trackingId, false);
    }
  };

  const activeTrackingCount = trackedShipments.filter((shipment) => shipment.status === 'TRACKING').length;
  const releasedCount = trackedShipments.filter((shipment) => shipment.status === 'RELEASED').length;
  const avgProgress = trackedShipments.length
    ? Math.round(
        trackedShipments.reduce((sum, shipment) => sum + getProgressPercent(shipment.currentStageIndex), 0) /
          trackedShipments.length,
      )
    : 0;

  const upsertDisputeCase = (escrow: EscrowRecord, actor: string, patch?: Partial<DisputeCase>) => {
    setDisputeCases((prev) => {
      const existing = prev.find((entry) => entry.escrowId === escrow.escrowId);
      const nextCase: DisputeCase = {
        escrowId: escrow.escrowId,
        actor,
        escrow,
        busy: patch?.busy ?? existing?.busy ?? false,
        message: patch?.message ?? existing?.message ?? '',
        error: patch?.error ?? existing?.error ?? '',
        lastUpdate: patch?.lastUpdate ?? new Date().toISOString(),
      };

      if (!existing) return [nextCase, ...prev];
      return prev.map((entry) => (entry.escrowId === escrow.escrowId ? nextCase : entry));
    });
  };

  const updateDisputeCase = (escrowId: string, updater: (entry: DisputeCase) => DisputeCase) => {
    setDisputeCases((prev) => prev.map((entry) => (entry.escrowId === escrowId ? updater(entry) : entry)));
  };

  const loadDisputeCase = async (explicitEscrowId?: string) => {
    const escrowId = (explicitEscrowId || disputeEscrowIdInput).trim();
    const actor = disputeActorInput.trim() || 'merchant-dashboard';

    setDisputeStatus('');
    setDisputeError('');

    if (!escrowId) {
      setDisputeError('Escrow ID is required to load dispute controls.');
      return;
    }

    setIsLoadingDispute(true);
    try {
      const escrow = await getEscrow(escrowId);
      upsertDisputeCase(escrow, actor, {
        message: `Escrow ${escrow.escrowId} loaded. Current state: ${escrow.state}`,
        error: '',
      });
      setDisputeStatus(`Dispute console loaded for ${escrow.escrowId}.`);
    } catch (err) {
      setDisputeError(normalizeError(err));
    } finally {
      setIsLoadingDispute(false);
    }
  };

  const runDisputeAction = async (
    escrowId: string,
    actor: string,
    action: 'raise' | 'withdraw' | 'refund' | 'arb-release' | 'arb-refund',
  ) => {
    setDisputeStatus('');
    setDisputeError('');
    updateDisputeCase(escrowId, (entry) => ({ ...entry, busy: true, error: '' }));

    try {
      let updated: EscrowRecord;
      if (action === 'raise') {
        updated = await disputeEscrow(escrowId, { actor });
      } else if (action === 'withdraw') {
        updated = await withdrawDisputeEscrow(escrowId, { actor });
      } else if (action === 'refund') {
        updated = await refundEscrow(escrowId, { actor });
      } else if (action === 'arb-release') {
        updated = await resolveEscrow(escrowId, { releaseToSeller: true, actor });
      } else {
        updated = await resolveEscrow(escrowId, { releaseToSeller: false, actor });
      }

      const actionName =
        action === 'raise'
          ? 'Dispute raised'
          : action === 'withdraw'
            ? 'Dispute withdrawn'
            : action === 'refund'
              ? 'Refund executed'
              : action === 'arb-release'
                ? 'Arbiter released funds to seller'
                : 'Arbiter refunded buyer';

      const txRef = updated.txIds.dispute || updated.txIds.release || updated.txIds.refund || '';
      const message = txRef ? `${actionName}. Tx: ${txRef}` : `${actionName}.`;

      upsertDisputeCase(updated, actor, {
        busy: false,
        message,
        error: '',
      });
      setDisputeStatus(message);
    } catch (err) {
      const message = normalizeError(err);
      updateDisputeCase(escrowId, (entry) => ({ ...entry, busy: false, error: message }));
      setDisputeError(message);
    }
  };

  const openDisputeCount = disputeCases.filter((entry) => entry.escrow.state === 'DISPUTED').length;


  return (
    <div className="w-full bg-[#0a0a0c] min-h-screen text-white font-['Inter']">

      {/* Merchant Header */}
      <div className="bg-[#141418] border-b border-white/5 pt-8 pb-8 px-6 relative overflow-hidden">
        {/* subtle background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#a855f7]/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <h1 className="text-3xl font-extrabold font-['Outfit'] mb-2">Merchant Dashboard</h1>
            <p className="text-[#8a8a98] text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#a855f7] animate-pulse"></span>
              Logged in successfully as <strong className="text-white">{user?.email}</strong>
            </p>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row gap-8">

        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`text-left px-5 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-3 ${activeTab === 'transactions' ? 'bg-gradient-to-r from-[#a855f7]/10 to-transparent text-[#a855f7] border border-[#a855f7]/20' : 'text-[#8a8a98] hover:bg-white/5 border border-transparent'}`}
          >

            Transaction Track
          </button>
          <button
            onClick={() => setActiveTab('disputes')}
            className={`text-left px-5 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-between ${activeTab === 'disputes' ? 'bg-gradient-to-r from-[#c084fc]/10 to-transparent text-[#c084fc] border border-[#c084fc]/20' : 'text-[#8a8a98] hover:bg-white/5 border border-transparent'}`}
          >
            <div className="flex items-center gap-3">

              Disputes
            </div>
            <span className="bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] text-white text-[0.65rem] px-2 py-0.5 rounded-full font-bold">{openDisputeCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`text-left px-5 py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-3 ${activeTab === 'api' ? 'bg-gradient-to-r from-purple-500/10 to-transparent text-purple-400 border border-purple-500/20' : 'text-[#8a8a98] hover:bg-white/5 border border-transparent'}`}
          >

            API Setup
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-[600px]">

          {/* TAB: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-[#141418] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-[#a855f7]/10 flex items-center justify-center text-[#a855f7]">

                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-['Outfit']">{activeTrackingCount}</div>
                    <div className="text-xs text-[#8a8a98] uppercase tracking-wider font-semibold">Shipments In Progress</div>
                  </div>
                </div>
                <div className="bg-[#141418] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-[#c084fc]/10 flex items-center justify-center text-[#c084fc]">

                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-['Outfit']">{releasedCount}</div>
                    <div className="text-xs text-[#8a8a98] uppercase tracking-wider font-semibold">Funds Auto-Released</div>
                  </div>
                </div>
                <div className="bg-[#141418] border border-white/5 rounded-xl p-5 flex items-center gap-4 hover:border-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">

                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white font-['Outfit']">{avgProgress}%</div>
                    <div className="text-xs text-[#8a8a98] uppercase tracking-wider font-semibold">Avg Shipment Progress</div>
                  </div>
                </div>
              </div>

              <div className="bg-[#141418] border border-white/5 rounded-xl overflow-hidden shadow-xl mb-6">
                <div className="p-6 border-b border-white/5 bg-black/20">
                  <h2 className="text-lg font-bold font-['Outfit'] text-white">Track Shipment</h2>
                  <p className="mt-1 text-xs text-[#8a8a98]">
                    Enter escrow ID and carrier tracking ID. When shipment reaches Delivered, funds are automatically released.
                  </p>
                </div>

                <div className="p-6 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-widest text-white/60">Escrow ID</label>
                    <input
                      value={escrowIdInput}
                      onChange={(event) => setEscrowIdInput(event.target.value)}
                      placeholder="AE-XXXX or appId"
                      className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white outline-none focus:border-[#a855f7]/70"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-widest text-white/60">Tracking ID</label>
                    <input
                      value={trackingIdInput}
                      onChange={(event) => setTrackingIdInput(event.target.value)}
                      placeholder="e.g. DHL78493210"
                      className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white outline-none focus:border-[#a855f7]/70"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => void addShipmentTracker()}
                      disabled={isCreatingTracker}
                      className="w-full rounded-lg bg-[#a855f7] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#9333ea] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingTracker ? 'Adding...' : 'Start Tracking'}
                    </button>
                  </div>
                </div>

                {trackingError && (
                  <p className="px-6 pb-1 text-sm text-rose-300">{trackingError}</p>
                )}
                {trackingStatus && (
                  <p className="px-6 pb-4 text-sm text-emerald-300">{trackingStatus}</p>
                )}
              </div>

              <div className="space-y-4">
                {trackedShipments.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-[#141418] p-6 text-sm text-white/60">
                    No shipment being tracked yet. Add a tracking ID to visualize shipment progress and auto-release escrow.
                  </div>
                ) : (
                  trackedShipments.map((shipment) => {
                    const isBusy = busyTrackingIds.includes(shipment.trackingId);
                    const progress = getProgressPercent(shipment.currentStageIndex);

                    return (
                      <article key={shipment.trackingId} className="rounded-xl border border-white/10 bg-[#141418] p-5 shadow-lg">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-widest text-white/50">Tracking ID</p>
                            <p className="mt-1 font-mono text-sm text-[#c084fc]">{shipment.trackingId}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-widest text-white/50">Escrow</p>
                            <p className="mt-1 font-mono text-xs text-white/80">{shipment.escrowId}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-3">
                          <p className="text-sm text-white">Shipment linked to escrow</p>
                          <p className="text-sm text-white/80">
                            {shipment.amount.toLocaleString()} {shipment.currency}
                          </p>
                          <p className="text-sm text-white/70">Last update: {formatTimestamp(shipment.lastUpdate)}</p>
                        </div>

                        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-[#a855f7] via-[#c084fc] to-[#f0abfc] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-5">
                          {SHIPMENT_STAGES.map((stage, index) => {
                            const reached = index < shipment.currentStageIndex;
                            const current = index === shipment.currentStageIndex;
                            const isFinal = index === SHIPMENT_STAGES.length - 1;

                            return (
                              <div key={stage.key} className="rounded-lg border border-white/10 bg-black/25 p-3">
                                <div
                                  className={`mb-2 h-2.5 w-2.5 rounded-full ${
                                    reached || (isFinal && shipment.status === 'RELEASED')
                                      ? 'bg-emerald-400'
                                      : current
                                        ? 'bg-[#c084fc]'
                                        : 'bg-white/25'
                                  }`}
                                />
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/85">{stage.label}</p>
                                <p className="mt-1 text-[11px] text-white/55">{stage.detail}</p>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider ${
                              shipment.status === 'RELEASED'
                                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                                : shipment.status === 'ERROR'
                                  ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                                  : shipment.status === 'DELIVERED'
                                    ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                                    : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                            }`}
                          >
                            {shipment.status}
                          </span>

                          {shipment.releaseTxId && (
                            <span className="text-xs text-white/70">
                              Release Tx: <span className="font-mono text-white/90">{shipment.releaseTxId}</span>
                            </span>
                          )}

                          {shipment.error && (
                            <span className="text-xs text-rose-300">{shipment.error}</span>
                          )}
                        </div>

                        <div className="mt-4">
                          <button
                            onClick={() => void advanceShipmentStatus(shipment.trackingId)}
                            disabled={isBusy || shipment.status === 'RELEASED'}
                            className="rounded-lg bg-[#a855f7] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#9333ea] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isBusy
                              ? 'Updating...'
                              : shipment.status === 'RELEASED'
                                ? 'Escrow Released'
                                : 'Simulate Next Shipment Update'}
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB: DISPUTES */}
          {activeTab === 'disputes' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#141418] border border-white/5 p-8 rounded-xl shadow-xl">
                <h2 className="text-2xl font-bold mb-2 font-['Outfit'] flex items-center gap-2">
                  Dispute Resolution
                </h2>
                <p className="text-[#8a8a98] text-sm mb-6">
                  Plan flow implemented: FUNDED -&gt; DISPUTED -&gt; (ARBITER RELEASE -&gt; COMPLETED) or (ARBITER REFUND -&gt; REFUNDED).
                </p>

                <div className="rounded-xl border border-white/10 bg-black/25 p-5 mb-6">
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-widest text-white/60">Escrow ID</label>
                      <input
                        value={disputeEscrowIdInput}
                        onChange={(event) => setDisputeEscrowIdInput(event.target.value)}
                        placeholder="AE-XXXX or appId"
                        className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white outline-none focus:border-[#c084fc]/70"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs uppercase tracking-widest text-white/60">Actor</label>
                      <input
                        value={disputeActorInput}
                        onChange={(event) => setDisputeActorInput(event.target.value)}
                        placeholder="arbiter-dashboard"
                        className="w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2.5 text-sm text-white outline-none focus:border-[#c084fc]/70"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => void loadDisputeCase()}
                        disabled={isLoadingDispute}
                        className="w-full rounded-lg bg-[#c084fc] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#d8b4fe] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isLoadingDispute ? 'Loading...' : 'Load Escrow'}
                      </button>
                    </div>
                  </div>

                  {disputeError && <p className="mt-3 text-sm text-rose-300">{disputeError}</p>}
                  {disputeStatus && <p className="mt-3 text-sm text-emerald-300">{disputeStatus}</p>}
                </div>

                <div className="space-y-4">
                  {disputeCases.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/25 p-6 text-sm text-white/60">
                      No dispute case loaded. Add an escrow ID to manage full dispute resolution.
                    </div>
                  ) : (
                    disputeCases.map((entry) => {
                      const escrow = entry.escrow;
                      const state = escrow.state;

                      return (
                        <article key={entry.escrowId} className="rounded-xl border border-white/10 bg-black/25 p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-widest text-white/50">Escrow</p>
                              <p className="mt-1 font-mono text-sm text-white">{escrow.escrowId}</p>
                              <p className="mt-1 text-sm text-white/70">{escrow.itemName || 'Untitled Escrow'}</p>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider ${
                                  state === 'DISPUTED'
                                    ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                                    : state === 'COMPLETED'
                                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                                      : state === 'REFUNDED'
                                        ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                                        : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                                }`}
                              >
                                {state}
                              </span>
                              <p className="mt-2 text-xs text-white/65">
                                {escrow.amount.toLocaleString()} {escrow.currency}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <p className="text-xs text-white/60">Buyer: <span className="font-mono text-white/75">{escrow.buyerAddress || '-'}</span></p>
                            <p className="text-xs text-white/60">Seller: <span className="font-mono text-white/75">{escrow.sellerAddress || '-'}</span></p>
                            <p className="text-xs text-white/60">Actor: <span className="font-mono text-white/75">{entry.actor}</span></p>
                            <p className="text-xs text-white/60">Last update: {formatTimestamp(entry.lastUpdate)}</p>
                          </div>

                          {entry.error && <p className="mt-3 text-sm text-rose-300">{entry.error}</p>}
                          {entry.message && <p className="mt-3 text-sm text-emerald-300">{entry.message}</p>}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => void loadDisputeCase(entry.escrowId)}
                              disabled={entry.busy}
                              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Refresh
                            </button>

                            {state === 'FUNDED' && (
                              <button
                                onClick={() => void runDisputeAction(entry.escrowId, entry.actor, 'raise')}
                                disabled={entry.busy}
                                className="rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-100 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Raise Dispute
                              </button>
                            )}

                            {(state === 'FUNDED' || state === 'DISPUTED' || state === 'EXPIRED') && (
                              <button
                                onClick={() => void runDisputeAction(entry.escrowId, entry.actor, 'refund')}
                                disabled={entry.busy}
                                className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Refund Buyer
                              </button>
                            )}

                            {state === 'DISPUTED' && (
                              <>
                                <button
                                  onClick={() => void runDisputeAction(entry.escrowId, entry.actor, 'arb-release')}
                                  disabled={entry.busy}
                                  className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Arbiter: Release Seller
                                </button>
                                <button
                                  onClick={() => void runDisputeAction(entry.escrowId, entry.actor, 'arb-refund')}
                                  disabled={entry.busy}
                                  className="rounded-lg border border-orange-400/30 bg-orange-500/15 px-3 py-2 text-xs font-bold text-orange-100 hover:bg-orange-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Arbiter: Refund Buyer
                                </button>
                                <button
                                  onClick={() => void runDisputeAction(entry.escrowId, entry.actor, 'withdraw')}
                                  disabled={entry.busy}
                                  className="rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Withdraw Dispute
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: API SETUP */}
          {activeTab === 'api' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-[#141418] border border-white/5 p-8 rounded-xl shadow-xl max-w-3xl">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">

                  </div>
                  <h2 className="text-2xl font-bold font-['Outfit']">Developer Setup</h2>
                </div>
                <p className="text-[#8a8a98] text-sm mb-10 pl-14">Configure your automated marketplace routing via the REST SDK.</p>

                <div className="space-y-8">
                  <div className="bg-[#0a0a0c] border border-transparent hover:border-white/5 p-5 rounded-xl transition-colors">
                    <label className="text-sm font-semibold text-white mb-3 block">Your Merchant API Key</label>
                    <div className="flex bg-[#141418] border border-white/10 rounded-lg p-1.5 focus-within:border-purple-500/50 transition-colors">
                      <input type="text" readOnly value="sk_test_51Nx...8v3K2" className="bg-transparent text-[#a855f7] font-mono text-sm px-4 py-2 outline-none flex-1" />
                      <button className="bg-white/5 hover:bg-white/10 text-white font-semibold px-5 py-2 rounded-md text-sm transition-colors">
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-red-400/80 mt-2 font-medium">Keep this key secret. Never expose it in client-side code.</p>
                  </div>

                  <div className="bg-[#0a0a0c] border border-transparent hover:border-white/5 p-5 rounded-xl transition-colors">
                    <label className="text-sm font-semibold text-white mb-3 block">Webhook Signing Secret</label>
                    <div className="flex bg-[#141418] border border-white/10 rounded-lg p-1.5 focus-within:border-purple-500/50 transition-colors">
                      <input type="text" readOnly value="whsec_92fj3...o92kl" className="bg-transparent text-purple-400 font-mono text-sm px-4 py-2 outline-none flex-1" />
                      <button className="bg-white/5 hover:bg-white/10 text-white font-semibold px-5 py-2 rounded-md text-sm transition-colors">
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-[#8a8a98] mt-2">Used to verify that webhook payloads are originating from AlgoEscrow.</p>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <label className="text-sm font-semibold text-white mb-3 block">Delivery Oracle Webhook URL</label>
                    <div className="flex gap-3">
                      <input type="text" placeholder="https://api.yourmarketplace.com/algoescrow/webhook" className="flex-1 bg-[#0a0a0c] border border-white/10 rounded-lg text-white text-sm px-5 py-3.5 outline-none focus:border-purple-500/50 transition-colors font-mono" />
                      <button className="bg-purple-500 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-600 transition-colors shadow-lg hover:shadow-purple-500/25 whitespace-nowrap">
                        Save Webhook
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Merchant;

