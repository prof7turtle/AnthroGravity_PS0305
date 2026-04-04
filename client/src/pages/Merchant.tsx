import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { deliverEscrow, getEscrow, type EscrowRecord } from '../lib/escrowApi';

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
            <span className="bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] text-white text-[0.65rem] px-2 py-0.5 rounded-full font-bold">1</span>
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
                <p className="text-[#8a8a98] text-sm mb-8">Manage disputed escrows and submit evidence for arbitration.</p>

                <div className="bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/20 rounded-xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-red-500 text-white text-[0.65rem] font-bold px-2 py-0.5 rounded tracking-wider uppercase shadow-[0_0_10px_rgba(239,68,68,0.5)]">Disputed</span>
                        <span className="text-[#8a8a98] font-mono text-xs bg-black/30 px-2 py-0.5 rounded">APP-37912</span>
                      </div>
                      <h3 className="text-xl font-bold text-white">Bespoke Mobile App</h3>
                    </div>
                    <div className="text-left md:text-right bg-black/30 p-3 rounded-lg border border-white/5">
                      <div className="text-white font-mono font-bold text-lg">32,000 ALGO</div>
                      <div className="text-red-400 text-xs font-semibold mt-1 flex items-center gap-1"> Awaiting Evidence</div>
                    </div>
                  </div>

                  <div className="bg-[#0a0a0c] border border-white/5 p-5 rounded-lg mb-6 shadow-inner">
                    <p className="text-sm text-[#8a8a98] mb-3 leading-relaxed">
                      <strong className="text-white block mb-1">Buyer Claim Transcript:</strong>
                      "The application crashes immediately upon opening on iOS 17 devices. I cannot release funds until this compatibility issue is fundamentally resolved per our agreement."
                    </p>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                      <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
                        Time remaining to respond: 48 hours
                      </span>
                    </div>
                  </div>

                  <button className="bg-white text-black font-bold py-3 px-8 rounded-lg hover:bg-gray-200 transition-colors shadow-lg hover:shadow-white/20 w-full sm:w-auto">
                    Submit Arbitration Evidence
                  </button>
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

