import { Router } from 'express';
import crypto from 'crypto';
import Escrow, { EscrowState, EscrowType } from '../models/Escrow';

const router = Router();

const makeEscrowId = () => `AE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const makeMockTxId = (prefix: string) => `${prefix.toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
    } = req.body;

    if (!sellerAddress) {
      return res.status(400).json({ message: 'sellerAddress is required' });
    }

    const safeRequirements = Array.isArray(requirements) ? requirements.filter((item) => typeof item === 'string') : [];

    const requirementsHash = crypto
      .createHash('sha256')
      .update(safeRequirements.join('\n'))
      .digest('hex');

    const createTxId = makeMockTxId('create');
    const escrow = new Escrow({
      escrowId: makeEscrowId(),
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
      txIds: {
        create: createTxId,
      },
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

    const { buyerAddress, amount } = req.body;
    if (!buyerAddress) {
      return res.status(400).json({ message: 'buyerAddress is required to fund escrow' });
    }

    if (amount && Number(amount) > 0) {
      escrow.amount = Number(amount);
    }

    const txId = makeMockTxId('fund');
    escrow.buyerAddress = buyerAddress;
    ensureTxIds(escrow).fund = txId;
    applyTransition(escrow, ['CREATED'], 'FUNDED', 'FUND', buyerAddress, txId, 'Escrow funded');

    await escrow.save();
    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to fund escrow', error: err.message });
  }
});

router.post('/:id/submit', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    if (escrow.state !== 'FUNDED') {
      return res.status(400).json({ message: `Cannot submit deliverables in ${escrow.state} state` });
    }

    const { sellerAddress, githubUrl = '', description = '', liveUrl = '', notes = '' } = req.body;
    if (!sellerAddress) {
      return res.status(400).json({ message: 'sellerAddress is required' });
    }

    if (escrow.sellerAddress && escrow.sellerAddress !== sellerAddress) {
      return res.status(403).json({ message: 'Only the escrow seller can submit deliverables' });
    }

    const payload = `${githubUrl}|${description}|${liveUrl}|${notes}`;
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
    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to submit deliverables', error: err.message });
  }
});

router.post('/:id/verify', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    if (escrow.state !== 'FUNDED') {
      return res.status(400).json({ message: `Cannot verify escrow in ${escrow.state} state` });
    }

    if (!escrow.hasSubmission) {
      return res.status(400).json({ message: 'Deliverables must be submitted before verification' });
    }

    const { score: requestedScore } = req.body;
    const score = Number.isFinite(Number(requestedScore)) ? Number(requestedScore) : 80;
    const verifyTxId = makeMockTxId('verify');

    escrow.isAiRunning = false;
    escrow.aiScore = score;
    ensureTxIds(escrow).verify = verifyTxId;

    const approved = score >= 75;
    escrow.aiVerdict = {
      score,
      matched: approved
        ? ['Core requirements covered', 'Submission structure valid', 'Escrow conditions met']
        : ['Partial implementation found'],
      gaps: approved ? [] : ['Acceptance threshold not met'],
      verdict: approved ? 'AI mock approved submission' : 'AI mock rejected submission',
      recommendation: approved ? 'RELEASE' : 'DISPUTE',
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
        `AI score ${score} approved; funds released`,
      );
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
        `AI score ${score} below threshold; moved to dispute`,
      );
    }

    await escrow.save();
    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to verify escrow', error: err.message });
  }
});

router.post('/:id/deliver', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    const { actor = '' } = req.body;
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
    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to refund escrow', error: err.message });
  }
});

router.post('/:id/resolve', async (req, res) => {
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
    } else {
      const txId = makeMockTxId('refund');
      ensureTxIds(escrow).refund = txId;
      applyTransition(escrow, ['DISPUTED'], 'REFUNDED', 'ARBITRATE_REFUND', actor, txId, 'Arbiter refunded funds to buyer');
    }

    await escrow.save();
    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to resolve escrow', error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const escrow = await resolveEscrow(req.params.id);
    if (!escrow) return res.status(404).json({ message: 'Escrow not found' });

    return res.json(escrow);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to fetch escrow', error: err.message });
  }
});

export default router;
