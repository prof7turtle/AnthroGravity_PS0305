import { Router } from 'express';
import crypto from 'crypto';
import Escrow, { EscrowState, EscrowType } from '../models/Escrow';
import TxRegistry from '../models/TxRegistry';
import {
  discoverFundingTransaction,
  prepareFundingTransaction,
  toLoraAppUrl,
  toTransactionExplorerUrl,
  verifyFundingTransaction,
} from '../services/algorand.service';
import { evaluateDeliverables } from '../services/ai.service';
import { toEscrowPublicView } from '../services/indexer.service';
import { dispatchEscrowWebhook, registerWebhook } from '../services/webhook.service';
import { isValidAlgorandAddress } from '../utils/algorand';

const router = Router();

const makeEscrowId = () => `AE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const makeMockTxId = (prefix: string) => `${prefix.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const normalizeAddress = (value: string) => value.trim().toUpperCase();

const sanitizeAddress = (value: unknown) => {
  const candidate = String(value || '').trim();
  if (!candidate || /REPLACE_WITH_/i.test(candidate)) return '';
  return candidate;
};

const resolveReceiverAddress = (escrow: any) => {
  const escrowAddress = sanitizeAddress(escrow?.appAddress);
  const envAddress = sanitizeAddress(process.env.ESCROW_RECEIVER_ADDRESS);

  if (escrowAddress && isValidAlgorandAddress(escrowAddress)) return escrowAddress;
  if (envAddress && isValidAlgorandAddress(envAddress)) return envAddress;
  return '';
};

const toEscrowType = (value: unknown): EscrowType => {
  const normalized = String(value || 'FREELANCE').toUpperCase();
  if (normalized === 'MARKETPLACE' || normalized === 'P2P' || normalized === 'FREELANCE') {
    return normalized;
  }
  return 'FREELANCE';
};

const appendActivity = (
  escrow: any,
  action: string,
  fromState: EscrowState,
  toState: EscrowState,
  actor: string,
  txId: string,
  note: string,
) => {
  escrow.activityLogs.push({ action, fromState, toState, actor, txId, note });
};

const applyTransition = (
  escrow: any,
  allowedFrom: EscrowState[],
  toState: EscrowState,
  action: string,
  actor: string,
  txId: string,
  note: string,
) => {
  if (!allowedFrom.includes(escrow.state)) {
    throw new Error(`Invalid transition: ${escrow.state} -> ${toState}`);
  }

  const fromState = escrow.state as EscrowState;
  escrow.state = toState;
  appendActivity(escrow, action, fromState, toState, actor, txId, note);
};

const resolveEscrow = async (id: string) => {
  return Escrow.findOne({ $or: [{ _id: id }, { escrowId: id }] });
};

const ensureTxIds = (escrow: any) => {
  if (!escrow.txIds) {
    escrow.txIds = {
      create: '',
      fund: '',
      submit: '',
      verify: '',
      release: '',
      dispute: '',
      refund: '',
    };
  }

  return escrow.txIds;
};

const dispatchStateWebhook = async (escrow: any, txId: string) => {
  await dispatchEscrowWebhook({
    escrowId: escrow.escrowId,
    appId: escrow.appId ?? null,
    newState: escrow.state,
    txId,
    timestamp: new Date().toISOString(),
  });
};

const isSpecResponse = (req: any) => String(req.query?.format || '').toLowerCase() === 'spec';

const toSpecEscrow = (escrow: any) => {
  const publicView = toEscrowPublicView(escrow);
  return {
    appId: publicView.appId ?? null,
    escrowAddress: publicView.escrowAddress,
    buyer: escrow.buyerAddress,
    seller: escrow.sellerAddress,
    amount: Number(escrow.amount) / 1_000_000,
    state: escrow.state,
    stateName: escrow.state,
    escrowType: escrow.escrowType,
    itemName: escrow.itemName,
    deadlineRound: publicView.roundsRemaining,
    currentRound: publicView.currentRound,
    roundsRemaining: publicView.roundsRemaining,
    aiScore: escrow.aiScore,
    aiVerdictNote: escrow.aiVerdict?.verdict || '',
    loraUrl: toLoraAppUrl(escrow.appId),
    txHistory: escrow.activityLogs || [],
  };
};

const tryReconcileFunding = async (escrow: any) => {
  if (escrow.state !== 'CREATED') {
    return { reconciled: false, reason: `No reconciliation needed in ${escrow.state} state` };
  }

  if (!escrow.buyerAddress || !isValidAlgorandAddress(escrow.buyerAddress)) {
    return { reconciled: false, reason: 'Escrow buyer address is invalid for on-chain reconciliation' };
  }

  const expectedReceiver = resolveReceiverAddress(escrow);
  if (!expectedReceiver) {
    return { reconciled: false, reason: 'Escrow receiver address is invalid for on-chain reconciliation' };
  }

  const found = await discoverFundingTransaction({
    sender: escrow.buyerAddress,
    receiver: expectedReceiver,
    amount: escrow.amount,
  });

  if (!found?.txId) {
    return { reconciled: false, reason: 'No matching on-chain funding transaction found yet' };
  }

  const existingRegistry = await TxRegistry.findOne({ txId: found.txId });
  if (existingRegistry && existingRegistry.escrowId !== escrow.escrowId) {
    return { reconciled: false, reason: 'Matched txId belongs to a different escrow' };
  }

  ensureTxIds(escrow).fund = found.txId;
  applyTransition(
    escrow,
    ['CREATED'],
    'FUNDED',
    'RECONCILE_FUND',
    found.sender,
    found.txId,
    `Funding reconciled from blockchain at round ${found.confirmedRound ?? 'unknown'}`,
  );

  if (!existingRegistry) {
    await TxRegistry.create({ txId: found.txId, escrowId: escrow.escrowId, kind: 'FUND' });
  }

  await escrow.save();
  await dispatchStateWebhook(escrow, found.txId);
  return { reconciled: true, reason: 'Funding reconciliation complete' };
};

router.post('/create', async (req, res) => {
  try {
    const {
      sellerAddress,
      buyerAddress = '',
      itemName = 'Untitled Escrow',
      escrowType = 'FREELANCE',
      amount = 0,
      currency = 'USDC',
      deadlineHours = 72,
      requirements = [],
      appAddress = process.env.ESCROW_RECEIVER_ADDRESS || '',
      webhookUrl,
    } = req.body;

    if (!sellerAddress) {
      return res.status(400).json({ message: 'sellerAddress is required' });
    }

    if (!buyerAddress) {
      return res.status(400).json({ message: 'buyerAddress is required at escrow creation' });
    }

    if (!isValidAlgorandAddress(buyerAddress)) {
      return res.status(400).json({ message: 'buyerAddress must be a valid Algorand address' });
    }

    if (!isValidAlgorandAddress(sellerAddress)) {
      return res.status(400).json({ message: 'sellerAddress must be a valid Algorand address' });
    }

    const safeRequirements = Array.isArray(requirements) ? requirements.filter((item) => typeof item === 'string') : [];

    const requirementsHash = crypto
      .createHash('sha256')
      .update(safeRequirements.join('\n'))
      .digest('hex');

    const createTxId = makeMockTxId('create');
    const safeAppAddress = sanitizeAddress(appAddress);
    const escrow = new Escrow({
      escrowId: makeEscrowId(),
      appAddress: safeAppAddress,
      state: 'CREATED',
      escrowType: toEscrowType(escrowType),
      itemName,
      amount: Number(amount) || 0,
      currency,
      buyerAddress,
      sellerAddress,
      deadlineAt: new Date(Date.now() + Number(deadlineHours || 72) * 60 * 60 * 1000),
      requirements: safeRequirements,
      requirementsHash,
      txIds: { create: createTxId },
      activityLogs: [
        {
          action: 'CREATE',
          fromState: 'CREATED',
          toState: 'CREATED',
          actor: buyerAddress || 'system',
          txId: createTxId,
          note: 'Escrow created via API',
        },
      ],
    });

    await escrow.save();

    if (webhookUrl && typeof webhookUrl === 'string') {
      await registerWebhook(escrow.escrowId, webhookUrl);
    }

    if (isSpecResponse(req)) {
      return res.status(201).json({
        appId: escrow.appId ?? null,
        escrowAddress: escrow.appAddress || '',
        txId: createTxId,
        loraUrl: toLoraAppUrl(escrow.appId),
        escrowId: escrow.escrowId,
      });
    }

    return res.status(201).json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to create escrow', error: err.message });
  }
});

router.post('/:id/fund', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    if (escrow.state !== 'CREATED') {
      return res.status(400).json({ message: `Cannot fund escrow in ${escrow.state} state` });
    }

    const { buyerAddress } = req.body;
    if (!buyerAddress) {
      return res.status(400).json({ message: 'buyerAddress is required to fund escrow' });
    }

    if (!isValidAlgorandAddress(buyerAddress)) {
      return res.status(400).json({ message: 'buyerAddress must be a valid Algorand address' });
    }

    if (escrow.buyerAddress && normalizeAddress(escrow.buyerAddress) !== normalizeAddress(buyerAddress)) {
      return res.status(403).json({ message: 'buyerAddress does not match escrow buyer' });
    }

    const receiverAddress = resolveReceiverAddress(escrow);
    if (!receiverAddress) {
      return res.status(500).json({ message: 'Escrow receiver address is missing/invalid. Set a valid testnet ESCROW_RECEIVER_ADDRESS in server/.env' });
    }

    if (!Number.isInteger(escrow.amount) || escrow.amount <= 0) {
      return res.status(400).json({ message: 'Escrow amount must be a positive integer in microALGO' });
    }

    if (!escrow.buyerAddress) {
      return res.status(400).json({ message: 'Escrow buyer must be set at creation time' });
    }

    const unsigned = await prepareFundingTransaction({
      sender: buyerAddress,
      receiver: receiverAddress,
      amount: escrow.amount,
      escrowId: escrow.escrowId,
    });

    const payload = {
      escrowId: escrow.escrowId,
      receiver: receiverAddress,
      amount: escrow.amount,
      amountMicroAlgo: escrow.amount,
      network: 'testnet',
      unsignedTransaction: unsigned.unsignedTransaction,
      unsignedTxns: [unsigned.unsignedTransaction],
    };

    if (isSpecResponse(req)) {
      return res.json({
        unsignedTxns: payload.unsignedTxns,
        escrowId: payload.escrowId,
        amountMicroAlgo: payload.amountMicroAlgo,
        receiver: payload.receiver,
      });
    }

    return res.json(payload);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to prepare funding transaction', error: err.message });
  }
});

router.post('/:id/confirm-fund', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const { txId } = req.body;
    if (!txId || typeof txId !== 'string') {
      return res.status(400).json({ message: 'txId is required' });
    }

    const normalizedTxId = txId.trim();

    if (escrow.state === 'FUNDED' && ensureTxIds(escrow).fund === normalizedTxId) {
      return res.json(isSpecResponse(req) ? toSpecEscrow(escrow.toObject()) : escrow);
    }

    if (escrow.state !== 'CREATED') {
      return res.status(400).json({ message: `Cannot confirm funding in ${escrow.state} state` });
    }

    if (!escrow.buyerAddress) {
      return res.status(400).json({ message: 'Escrow buyer address is not set. Request /fund first.' });
    }

    const existingRegistry = await TxRegistry.findOne({ txId: normalizedTxId });
    if (existingRegistry && existingRegistry.escrowId !== escrow.escrowId) {
      return res.status(409).json({ message: 'txId already permanently used by another escrow' });
    }

    const expectedReceiver = resolveReceiverAddress(escrow);
    if (!expectedReceiver) {
      return res.status(500).json({ message: 'Escrow receiver address is missing/invalid. Set a valid testnet ESCROW_RECEIVER_ADDRESS in server/.env' });
    }

    const onChain = await verifyFundingTransaction(normalizedTxId);

    if (normalizeAddress(onChain.sender) !== normalizeAddress(escrow.buyerAddress)) {
      return res.status(400).json({ message: 'Funding tx sender does not match escrow buyer address' });
    }

    if (normalizeAddress(onChain.receiver) !== normalizeAddress(expectedReceiver)) {
      return res.status(400).json({ message: 'Funding tx receiver does not match escrow receiver address' });
    }

    if (Number(onChain.amount) !== Number(escrow.amount)) {
      return res.status(400).json({ message: 'Funding tx amount does not match escrow amount' });
    }

    ensureTxIds(escrow).fund = normalizedTxId;
    applyTransition(
      escrow,
      ['CREATED'],
      'FUNDED',
      'CONFIRM_FUND',
      onChain.sender,
      normalizedTxId,
      `Funding verified on-chain at round ${onChain.confirmedRound ?? 'unknown'}`,
    );

    if (!existingRegistry) {
      await TxRegistry.create({ txId: normalizedTxId, escrowId: escrow.escrowId, kind: 'FUND' });
    }

    await escrow.save();
    await dispatchStateWebhook(escrow, normalizedTxId);

    return res.json(isSpecResponse(req) ? toSpecEscrow(escrow.toObject()) : escrow);
  } catch (err: any) {
    const message = err?.message || 'Failed to verify funding transaction';
    if (/not found/i.test(message)) {
      return res.status(400).json({ message: 'Transaction not found on Algorand testnet indexer' });
    }
    return res.status(500).json({ message: 'Failed to confirm escrow funding', error: message });
  }
});

router.get('/:id/reconcile', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const reconciliation = await tryReconcileFunding(escrow);

    if (!reconciliation.reconciled) {
      let status = 404;
      if (/different escrow/i.test(reconciliation.reason)) status = 409;
      else if (/invalid/i.test(reconciliation.reason)) status = 400;
      else if (/no reconciliation needed/i.test(reconciliation.reason)) status = 200;
      return res.status(status).json({ message: reconciliation.reason, reconciled: false, escrow });
    }

    return res.json({ escrow, reconciled: true });
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to reconcile escrow funding', error: err.message });
  }
});

const submitWorkHandler = async (req: any, res: any) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    if (escrow.state !== 'FUNDED') {
      return res.status(400).json({ message: `Cannot submit deliverables in ${escrow.state} state` });
    }

    const { sellerAddress, githubUrl = '', description = '', liveUrl = '', notes = '', screenshotsUrls = [] } = req.body;
    if (!sellerAddress) {
      return res.status(400).json({ message: 'sellerAddress is required' });
    }

    if (escrow.sellerAddress && escrow.sellerAddress !== sellerAddress) {
      return res.status(403).json({ message: 'Only the escrow seller can submit deliverables' });
    }

    const payload = `${githubUrl}|${description}|${liveUrl}|${notes}|${JSON.stringify(screenshotsUrls)}`;
    const deliverablesHash = crypto.createHash('sha256').update(payload).digest('hex');
    const txId = makeMockTxId('submit');

    escrow.hasSubmission = true;
    escrow.deliverablesHash = deliverablesHash;
    ensureTxIds(escrow).submit = txId;
    appendActivity(
      escrow,
      'SUBMIT_WORK',
      'FUNDED',
      'FUNDED',
      sellerAddress,
      txId,
      'Deliverables submitted (hash recorded)',
    );

    await escrow.save();

    return res.json({
      ...(isSpecResponse(req) ? { deliverablesHash, txId, message: 'AI verification triggered' } : escrow),
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to submit deliverables', error: err.message });
  }
};

router.post('/:id/submit', submitWorkHandler);
router.post('/:id/submit-work', submitWorkHandler);

const aiVerifyHandler = async (req: any, res: any) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    if (escrow.state !== 'FUNDED') {
      return res.status(400).json({ message: `Cannot verify escrow in ${escrow.state} state` });
    }

    if (!escrow.hasSubmission) {
      return res.status(400).json({ message: 'Deliverables must be submitted before verification' });
    }

    const aiResult = await evaluateDeliverables({
      requirements: escrow.requirements || [],
      githubUrl: req.body.githubUrl,
      description: req.body.description,
      screenshotsUrls: req.body.screenshotsUrls,
    });

    const verifyTxId = makeMockTxId('verify');
    escrow.isAiRunning = false;
    escrow.aiScore = aiResult.score;
    ensureTxIds(escrow).verify = verifyTxId;

    const approved = aiResult.recommendation === 'RELEASE';
    escrow.aiVerdict = {
      score: aiResult.score,
      matched: aiResult.matched_criteria,
      gaps: aiResult.missing_criteria,
      verdict: aiResult.verdict,
      recommendation: aiResult.recommendation,
    };

    if (approved) {
      const releaseTxId = makeMockTxId('release');
      ensureTxIds(escrow).release = releaseTxId;
      applyTransition(
        escrow,
        ['FUNDED'],
        'COMPLETED',
        'AI_VERIFY_APPROVED',
        'ai-oracle',
        releaseTxId,
        `AI score ${aiResult.score} approved; funds released`,
      );
      await dispatchStateWebhook(escrow, releaseTxId);
    } else {
      const disputeTxId = makeMockTxId('dispute');
      ensureTxIds(escrow).dispute = disputeTxId;
      applyTransition(
        escrow,
        ['FUNDED'],
        'DISPUTED',
        'AI_VERIFY_REJECTED',
        'ai-oracle',
        disputeTxId,
        `AI score ${aiResult.score} below threshold; moved to dispute`,
      );
      await dispatchStateWebhook(escrow, disputeTxId);
    }

    await escrow.save();

    if (isSpecResponse(req)) {
      return res.json({
        score: aiResult.score,
        matched_criteria: aiResult.matched_criteria,
        missing_criteria: aiResult.missing_criteria,
        verdict: aiResult.verdict,
        recommendation: aiResult.recommendation,
        escrow: toSpecEscrow(escrow.toObject()),
      });
    }

    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to verify escrow', error: err.message });
  }
};

router.post('/:id/verify', aiVerifyHandler);
router.post('/:id/ai-verify', aiVerifyHandler);

router.post('/:id/deliver', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const { actor = 'oracle' } = req.body;
    const txId = makeMockTxId('release');

    applyTransition(
      escrow,
      ['FUNDED'],
      'COMPLETED',
      'CONFIRM_DELIVERY',
      actor,
      txId,
      'Delivery confirmed and funds released',
    );
    ensureTxIds(escrow).release = txId;

    await escrow.save();
    await dispatchStateWebhook(escrow, txId);

    if (isSpecResponse(req)) {
      return res.json({ txId, loraUrl: toLoraAppUrl(escrow.appId), explorerUrl: toTransactionExplorerUrl(txId) });
    }

    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to confirm delivery', error: err.message });
  }
});

router.post('/:id/dispute', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const { actor = '' } = req.body;
    const txId = makeMockTxId('dispute');
    applyTransition(escrow, ['FUNDED'], 'DISPUTED', 'RAISE_DISPUTE', actor, txId, 'Dispute raised by user');
    ensureTxIds(escrow).dispute = txId;

    await escrow.save();
    await dispatchStateWebhook(escrow, txId);
    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to raise dispute', error: err.message });
  }
});

router.post('/:id/refund', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const { actor = '' } = req.body;
    const txId = makeMockTxId('refund');
    applyTransition(
      escrow,
      ['FUNDED', 'DISPUTED', 'EXPIRED'],
      'REFUNDED',
      'REFUND',
      actor,
      txId,
      'Funds refunded to buyer',
    );
    ensureTxIds(escrow).refund = txId;

    await escrow.save();
    await dispatchStateWebhook(escrow, txId);
    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to refund escrow', error: err.message });
  }
});

const arbitrateHandler = async (req: any, res: any) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const { releaseToSeller = false, actor = 'arbiter' } = req.body;
    if (escrow.state !== 'DISPUTED') {
      return res.status(400).json({ message: `Cannot resolve escrow in ${escrow.state} state` });
    }

    if (releaseToSeller) {
      const txId = makeMockTxId('release');
      ensureTxIds(escrow).release = txId;
      applyTransition(escrow, ['DISPUTED'], 'COMPLETED', 'ARBITRATE_RELEASE', actor, txId, 'Arbiter released funds to seller');
      await dispatchStateWebhook(escrow, txId);
    } else {
      const txId = makeMockTxId('refund');
      ensureTxIds(escrow).refund = txId;
      applyTransition(escrow, ['DISPUTED'], 'REFUNDED', 'ARBITRATE_REFUND', actor, txId, 'Arbiter refunded funds to buyer');
      await dispatchStateWebhook(escrow, txId);
    }

    await escrow.save();
    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to resolve escrow', error: err.message });
  }
};

router.post('/:id/resolve', arbitrateHandler);
router.post('/:id/arbitrate', arbitrateHandler);

router.get('/list/:address', async (req, res) => {
  try {
    const address = String(req.params.address || '').trim();
    if (!address) return res.status(400).json({ message: 'address is required' });

    const escrows = await Escrow.find({
      $or: [{ buyerAddress: address }, { sellerAddress: address }],
    }).sort({ createdAt: -1 });

    if (isSpecResponse(req)) {
      return res.json(escrows.map((escrow) => toSpecEscrow(escrow.toObject())));
    }

    return res.json(escrows);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to list escrows', error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    try {
      await tryReconcileFunding(escrow);
    } catch {
      // Keep read endpoint resilient.
    }

    if (isSpecResponse(req)) {
      return res.json(toSpecEscrow(escrow.toObject()));
    }

    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to fetch escrow', error: err.message });
  }
});

export default router;
