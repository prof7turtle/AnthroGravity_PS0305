import { useMemo, useState } from 'react';

type Endpoint = {
  key: string;
  method: 'GET' | 'POST';
  path: string;
  purpose: string;
  request: string;
  response: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    key: 'create',
    method: 'POST',
    path: '/api/escrow/create',
    purpose: 'Deploy a new escrow contract through the factory and return the App ID + vault address.',
    request: `{
  "seller": "ALGORAND_ADDRESS",
  "itemName": "SaaS Codebase Transfer",
  "escrowType": 0,
  "deadlineHours": 72,
  "amount": 50000,
  "requirements": "Optional for freelance",
  "webhookUrl": "https://shopdemo.com/webhooks/escrow"
}`,
    response: `{
  "appId": 758224999,
  "escrowAddress": "APP_ESCROW_ADDRESS",
  "txId": "CREATE_TX_ID",
  "loraUrl": "https://lora.algokit.io/testnet/application/758224999"
}`,
  },
  {
    key: 'fund',
    method: 'POST',
    path: '/api/escrow/:id/fund',
    purpose: 'Build unsigned funding transactions for wallet signing (atomic safety).',
    request: `{
  "buyerAddress": "BUYER_ALGORAND_ADDRESS",
  "amountMicroAlgo": 50000000
}`,
    response: `{
  "unsignedTxns": ["base64_txn_1", "base64_txn_2"],
  "escrowId": "AE-XXXXXX",
  "amountMicroAlgo": 50000000,
  "receiver": "ESCROW_VAULT_ADDRESS"
}`,
  },
  {
    key: 'deliver',
    method: 'POST',
    path: '/api/escrow/:id/deliver',
    purpose: 'Delivery confirmation endpoint for buyer/oracle release flow.',
    request: `{
  "secret": "ORACLE_API_SECRET"
}`,
    response: `{
  "txId": "DELIVER_TX_ID",
  "loraUrl": "https://lora.algokit.io/testnet/application/758224999"
}`,
  },
  {
    key: 'submit',
    method: 'POST',
    path: '/api/escrow/:id/submit-work',
    purpose: 'Freelancer submits deliverables package for AI verification.',
    request: `{
  "sellerAddress": "SELLER_ALGORAND_ADDRESS",
  "githubUrl": "https://github.com/org/project",
  "description": "Implemented all milestone requirements",
  "screenshotsUrls": ["https://.../screen1.png"]
}`,
    response: `{
  "deliverablesHash": "SHA256_HASH",
  "txId": "SUBMIT_TX_ID",
  "message": "AI verification triggered"
}`,
  },
  {
    key: 'aiverify',
    method: 'POST',
    path: '/api/escrow/:id/ai-verify',
    purpose: 'Runs AI scoring against escrow requirements and records verdict flow.',
    request: `{
  "githubUrl": "https://github.com/org/project",
  "description": "Evidence summary",
  "screenshotsUrls": ["https://.../screen1.png"]
}`,
    response: `{
  "score": 82,
  "matched_criteria": ["AlgoKit setup", "Escrow flow complete"],
  "missing_criteria": ["Coverage evidence"],
  "recommendation": "RELEASE"
}`,
  },
  {
    key: 'status',
    method: 'GET',
    path: '/api/escrow/:id',
    purpose: 'Fetch current escrow state, parties, AI verdict, and tx history for dashboards.',
    request: '{}',
    response: `{
  "appId": 758224999,
  "state": "FUNDED",
  "stateName": "FUNDED",
  "escrowType": "FREELANCE",
  "amount": 50,
  "loraUrl": "https://lora.algokit.io/testnet/application/758224999",
  "txHistory": []
}`,
  },
];

const SDK_SNIPPET = `import { AlgoEscrow } from '@algoescrow/sdk'

const escrow = await AlgoEscrow.create({
  apiUrl: 'https://api.algoescrow.com',
  seller: sellerAddress,
  itemName: product.name,
  amount: product.price,
  deadlineHours: 72,
  escrowType: 'marketplace',
  webhookUrl: 'https://shopdemo.com/webhooks/escrow',
})

// escrow => { appId, escrowAddress, fundingUrl }
window.location.href = escrow.fundingUrl`;

const WEBHOOK_PAYLOAD = `{
  "escrowId": "AE-9J4M2R",
  "appId": 758224999,
  "newState": "COMPLETED",
  "txId": "6OJJ...G7UQ",
  "timestamp": "2026-04-04T10:12:23.911Z"
}`;

const AI_OUTPUT = `{
  "score": 84,
  "matched_criteria": [
    "Escrow API endpoints implemented",
    "Algorand state transitions demonstrated"
  ],
  "missing_criteria": [
    "No evidence for complete test coverage"
  ],
  "verdict": "Deliverables satisfy most requirements with minor documentation gaps.",
  "recommendation": "RELEASE"
}`;

const methodClass = (method: 'GET' | 'POST') =>
  method === 'GET'
    ? 'bg-violet-500/15 text-violet-200 border-violet-300/25'
    : 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-300/25';

const ApiIntegration = () => {
  const [activeKey, setActiveKey] = useState(ENDPOINTS[0].key);

  const activeEndpoint = useMemo(
    () => ENDPOINTS.find((endpoint) => endpoint.key === activeKey) || ENDPOINTS[0],
    [activeKey],
  );

  return (
    <div className="min-h-screen bg-black px-6 pb-20 pt-8 text-white">
      <div className="mx-auto max-w-7xl">
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:auto-rows-[minmax(120px,auto)]">
          <article className="rounded-xl border border-white/20 bg-black p-6 shadow-xl lg:col-span-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200/75">API Service Layer</p>
            <h1 className="mt-3 font-['Outfit'] text-3xl font-extrabold leading-tight md:text-4xl">
              Professional Escrow API for Marketplace Integration
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-white/70 md:text-base">
              Use this API service to create escrow contracts, prepare funding transactions, sync lifecycle updates, and automate
              freelance verification. This bento board mirrors the production integration flow used by partner platforms.
            </p>
          </article>

          <article className="rounded-xl border border-white/20 bg-fuchsia-500/10 p-5 lg:col-span-2">
            <p className="text-[11px] uppercase tracking-wider text-fuchsia-100/85">Platform Fee</p>
            <p className="mt-1 text-2xl font-bold text-white">0.5%</p>
          </article>

          <article className="rounded-xl border border-white/20 bg-violet-500/10 p-5 lg:col-span-2">
            <p className="text-[11px] uppercase tracking-wider text-violet-100/85">Finality</p>
            <p className="mt-1 text-2xl font-bold text-white">2.8s</p>
          </article>

          <aside className="rounded-xl border border-white/20 bg-black p-4 lg:col-span-4 lg:row-span-2">
            <p className="mb-3 text-sm font-semibold text-white/75">Core Endpoints</p>
            <div className="space-y-2">
              {ENDPOINTS.map((endpoint) => (
                <button
                  key={endpoint.key}
                  onClick={() => setActiveKey(endpoint.key)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                    activeKey === endpoint.key
                      ? 'border-fuchsia-300/35 bg-fuchsia-500/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-widest ${methodClass(endpoint.method)}`}>
                      {endpoint.method}
                    </span>
                    <span className="truncate font-mono text-xs text-white/85">{endpoint.path}</span>
                  </div>
                  <p className="mt-2 text-xs text-white/60">{endpoint.purpose}</p>
                </button>
              ))}
            </div>
          </aside>

          <article className="rounded-xl border border-white/20 bg-black p-6 lg:col-span-8 lg:row-span-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-widest ${methodClass(activeEndpoint.method)}`}>
                {activeEndpoint.method}
              </span>
              <h2 className="font-mono text-lg font-semibold text-white">{activeEndpoint.path}</h2>
            </div>

            <p className="mt-3 text-sm text-white/70">{activeEndpoint.purpose}</p>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-white/20 bg-black/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/55">Request Body</p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-[#090b10] p-3 text-xs text-fuchsia-100">
                  <code>{activeEndpoint.request}</code>
                </pre>
              </div>

              <div className="rounded-lg border border-white/20 bg-black/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/55">Response Shape</p>
                <pre className="mt-3 overflow-x-auto rounded-md bg-[#090b10] p-3 text-xs text-violet-100">
                  <code>{activeEndpoint.response}</code>
                </pre>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-white/20 bg-black p-6 lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">SDK Integration</p>
            <h3 className="mt-2 font-['Outfit'] text-2xl font-bold">Marketplace SDK Example</h3>
            <p className="mt-2 text-sm text-white/70">
              The same backend powers direct REST calls and SDK-based integration. This is what partner marketplaces use in
              checkout.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-[#090b10] p-4 text-xs text-white/90">
              <code>{SDK_SNIPPET}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-white/20 bg-black p-6 lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Webhook Contract</p>
            <h3 className="mt-2 font-['Outfit'] text-2xl font-bold">State Change Callback Payload</h3>
            <p className="mt-2 text-sm text-white/70">
              On each state transition, AlgoEscrow dispatches a webhook so external systems can update orders without polling.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-[#090b10] p-4 text-xs text-fuchsia-100">
              <code>{WEBHOOK_PAYLOAD}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-white/20 bg-black p-6 lg:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Freelance AI Verification</p>
            <h3 className="mt-2 font-['Outfit'] text-2xl font-bold">Deterministic JSON Verdict Flow</h3>
            <p className="mt-2 text-sm text-white/70">
              For freelance escrows, the backend compares submitted deliverables against original requirements and returns a
              structured JSON verdict. RELEASE if score is at least 75, otherwise DISPUTE.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-lg border border-white/10 bg-[#090b10] p-4 text-xs text-violet-100">
              <code>{AI_OUTPUT}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-white/20 bg-black p-6 lg:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Integration Checklist</p>
            <ol className="mt-3 space-y-3 text-sm text-white/75">
              <li className="rounded-lg border border-white/10 bg-white/5 p-3">
                <span className="font-semibold text-white">1. Create Escrow:</span> call <span className="font-mono text-fuchsia-200">POST /api/escrow/create</span>.
              </li>
              <li className="rounded-lg border border-white/10 bg-white/5 p-3">
                <span className="font-semibold text-white">2. Fund Atomically:</span> get unsigned txn group from <span className="font-mono text-fuchsia-200">/fund</span> and sign in wallet.
              </li>
              <li className="rounded-lg border border-white/10 bg-white/5 p-3">
                <span className="font-semibold text-white">3. Track Lifecycle:</span> read <span className="font-mono text-fuchsia-200">GET /api/escrow/:id</span> and consume webhooks.
              </li>
              <li className="rounded-lg border border-white/10 bg-white/5 p-3">
                <span className="font-semibold text-white">4. Resolve:</span> delivery, dispute, arbitration, or AI verdict drives release/refund final state.
              </li>
            </ol>

            <div className="mt-5 rounded-lg border border-violet-400/25 bg-violet-500/10 p-3 text-xs text-violet-100">
              Demo tip: show create response with appId, then open the corresponding LORA application URL as proof.
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default ApiIntegration;
