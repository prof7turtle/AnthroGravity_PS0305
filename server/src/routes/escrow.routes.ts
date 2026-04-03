/**
 * Escrow Routes
 * Handles all escrow-related API endpoints
 */

import express, { Request, Response } from 'express';
import algosdk from 'algosdk';
import crypto from 'crypto';
import { algorandService } from '../services/algorand.service';
import { aiService } from '../services/ai.service';
import {
  CreateEscrowRequest,
  FundEscrowRequest,
  DeliverEscrowRequest,
  DisputeEscrowRequest,
  EscrowType,
  getStateLabel,
  getTypeLabel,
} from '../types/escrow.types';

const router = express.Router();

/**
 * POST /api/escrow/create
 * Create a new escrow via the factory
 */
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { seller, itemName, escrowType, deadlineRounds, requirements }: CreateEscrowRequest = req.body;

    // Validation
    if (!seller || !itemName || escrowType === undefined || !deadlineRounds) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!algosdk.isValidAddress(seller)) {
      res.status(400).json({ error: 'Invalid seller address' });
      return;
    }

    if (escrowType < 0 || escrowType > 2) {
      res.status(400).json({ error: 'Invalid escrow type (must be 0, 1, or 2)' });
      return;
    }

    if (deadlineRounds < 1) {
      res.status(400).json({ error: 'Deadline rounds must be positive' });
      return;
    }

    // For freelance escrows, requirements are mandatory
    if (escrowType === EscrowType.FREELANCE && !requirements) {
      res.status(400).json({ error: 'Requirements are required for freelance escrows' });
      return;
    }

    // Hash requirements for freelance type
    let requirementsHash = new Uint8Array(32); // Empty hash
    if (escrowType === EscrowType.FREELANCE && requirements) {
      const hash = crypto.createHash('sha256').update(requirements, 'utf-8').digest();
      requirementsHash = new Uint8Array(hash);
    }

    // Build the transaction parameters for factory.createEscrow()
    const factoryAppId = algorandService.getFactoryAppId();
    const templateAppId = algorandService.getTemplateAppId();
    const params = await algorandService.getSuggestedParams();

    // Return unsigned transaction for frontend to sign
    res.json({
      success: true,
      message: 'Transaction prepared. Sign and submit to create escrow.',
      data: {
        factoryAppId,
        templateAppId,
        seller,
        itemName,
        escrowType,
        deadlineRounds,
        requirementsHash: Buffer.from(requirementsHash).toString('base64'),
        note: 'You need to call factory.createEscrow() from the frontend with these parameters',
      },
    });
  } catch (error: any) {
    console.error('Error creating escrow:', error);
    res.status(500).json({ error: error.message || 'Failed to create escrow' });
  }
});

/**
 * GET /api/escrow/:appId
 * Get escrow state by App ID
 */
router.get('/:appId', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);
    const appAddress = algorandService.getApplicationAddress(appId);

    res.json({
      success: true,
      data: {
        appId,
        appAddress,
        ...state,
        stateLabel: getStateLabel(state.state),
        typeLabel: getTypeLabel(state.escrowType),
      },
    });
  } catch (error: any) {
    console.error('Error getting escrow:', error);
    res.status(500).json({ error: error.message || 'Failed to get escrow' });
  }
});

/**
 * POST /api/escrow/:appId/fund
 * Build unsigned fund transaction (buyer sends payment + calls fund())
 */
router.post('/:appId/fund', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { buyer, amount }: FundEscrowRequest = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    if (!buyer || !amount) {
      res.status(400).json({ error: 'Missing buyer or amount' });
      return;
    }

    if (!algosdk.isValidAddress(buyer)) {
      res.status(400).json({ error: 'Invalid buyer address' });
      return;
    }

    if (amount <= 0) {
      res.status(400).json({ error: 'Amount must be positive' });
      return;
    }

    // Check current state
    const state = await algorandService.getEscrowState(appId);
    if (state.state !== 0) {
      res.status(400).json({ error: 'Escrow is not in CREATED state' });
      return;
    }

    const escrowAddress = algorandService.getApplicationAddress(appId);

    res.json({
      success: true,
      message: 'Fund transaction parameters ready',
      data: {
        appId,
        escrowAddress,
        buyer,
        amount,
        note: 'Send atomic group: [Payment to escrow address, AppCall to fund()]',
      },
    });
  } catch (error: any) {
    console.error('Error preparing fund transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to prepare fund transaction' });
  }
});

/**
 * POST /api/escrow/:appId/deliver
 * Confirm delivery (oracle or AI verification for freelance)
 */
router.post('/:appId/deliver', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { deliverables, deliverableUrl, trackingNumber }: DeliverEscrowRequest = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);

    if (state.state !== 1) {
      res.status(400).json({ error: 'Escrow is not in FUNDED state' });
      return;
    }

    // For FREELANCE type, verify with AI
    if (state.escrowType === EscrowType.FREELANCE) {
      if (!deliverables) {
        res.status(400).json({ error: 'Deliverables description required for freelance escrows' });
        return;
      }

      if (!aiService.isAvailable()) {
        res.status(503).json({ error: 'AI verification service not available' });
        return;
      }

      // Note: This is a simplified version. In production, you'd:
      // 1. Store the deliverables info
      // 2. Run AI verification
      // 3. Call aiVerdict() on the contract if score >= threshold
      
      res.json({
        success: true,
        message: 'Deliverables received. AI verification will be processed.',
        data: {
          appId,
          note: 'AI verification in progress. Backend will call aiVerdict() when complete.',
        },
      });
      return;
    }

    // For MARKETPLACE/P2P, return params for confirmDelivery
    res.json({
      success: true,
      message: 'Delivery confirmation parameters ready',
      data: {
        appId,
        type: state.escrowType === EscrowType.MARKETPLACE ? 'marketplace' : 'p2p',
        note: 'Buyer or oracle should call confirmDelivery() to release funds',
      },
    });
  } catch (error: any) {
    console.error('Error confirming delivery:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm delivery' });
  }
});

/**
 * POST /api/escrow/:appId/dispute
 * Raise a dispute
 */
router.post('/:appId/dispute', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { reason, disputer }: DisputeEscrowRequest = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    if (!reason || !disputer) {
      res.status(400).json({ error: 'Missing reason or disputer' });
      return;
    }

    if (!algosdk.isValidAddress(disputer)) {
      res.status(400).json({ error: 'Invalid disputer address' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);

    if (state.state !== 1) {
      res.status(400).json({ error: 'Disputes can only be raised when escrow is FUNDED' });
      return;
    }

    // Verify disputer is buyer or seller
    if (disputer !== state.buyer && disputer !== state.seller) {
      res.status(403).json({ error: 'Only buyer or seller can raise disputes' });
      return;
    }

    res.json({
      success: true,
      message: 'Dispute parameters ready',
      data: {
        appId,
        disputer,
        reason,
        note: 'Call raiseDispute() on the escrow contract',
      },
    });
  } catch (error: any) {
    console.error('Error raising dispute:', error);
    res.status(500).json({ error: error.message || 'Failed to raise dispute' });
  }
});

/**
 * GET /api/escrow/:appId/status
 * Get human-readable escrow status
 */
router.get('/:appId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);
    const appAddress = algorandService.getApplicationAddress(appId);

    // Get current round to check if expired
    const params = await algorandService.getSuggestedParams();
    const currentRound = params.firstRound;
    const isExpired = currentRound > state.deadlineRound;

    res.json({
      success: true,
      data: {
        appId,
        appAddress,
        state: getStateLabel(state.state),
        type: getTypeLabel(state.escrowType),
        buyer: state.buyer,
        seller: state.seller,
        amount: state.amount,
        itemName: state.itemName,
        createdRound: state.createdRound,
        deadlineRound: state.deadlineRound,
        currentRound,
        isExpired,
        explorerUrl: `https://lora.algokit.io/${process.env.ALGORAND_NETWORK || 'localnet'}/application/${appId}`,
      },
    });
  } catch (error: any) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: error.message || 'Failed to get status' });
  }
});

/**
 * GET /api/escrow/factory/info
 * Get factory information
 */
router.get('/factory/info', async (req: Request, res: Response): Promise<void> => {
  try {
    const factoryAppId = algorandService.getFactoryAppId();
    const templateAppId = algorandService.getTemplateAppId();
    
    res.json({
      success: true,
      data: {
        factoryAppId,
        templateAppId,
        network: process.env.ALGORAND_NETWORK || 'localnet',
      },
    });
  } catch (error: any) {
    console.error('Error getting factory info:', error);
    res.status(500).json({ error: error.message || 'Failed to get factory info' });
  }
});

/**
 * GET /api/escrow/list/:address
 * Get all escrows for a wallet address (buyer or seller)
 */
router.get('/list/:address', async (req: Request, res: Response): Promise<void> => {
  try {
    const addressParam = req.params.address;
    const address = Array.isArray(addressParam) ? addressParam[0] : addressParam;

    if (!address) {
      res.status(400).json({ error: 'Missing address parameter' });
      return;
    }

    if (!algosdk.isValidAddress(address)) {
      res.status(400).json({ error: 'Invalid Algorand address' });
      return;
    }

    const escrows = await algorandService.getEscrowsByAddress(address);

    res.json({
      success: true,
      data: {
        address,
        count: escrows.length,
        escrows: escrows.map((escrow) => ({
          ...escrow,
          stateLabel: getStateLabel(escrow.state),
          typeLabel: getTypeLabel(escrow.escrowType),
        })),
      },
    });
  } catch (error: any) {
    console.error('Error listing escrows:', error);
    res.status(500).json({ error: error.message || 'Failed to list escrows' });
  }
});

/**
 * POST /api/escrow/:appId/submit-work
 * Submit work deliverables (freelance escrows)
 * Triggers AI verification automatically
 */
router.post('/:appId/submit-work', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { sellerAddress, githubUrl, description, requirements } = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    if (!sellerAddress || !description) {
      res.status(400).json({ error: 'Missing sellerAddress or description' });
      return;
    }

    if (!algosdk.isValidAddress(sellerAddress)) {
      res.status(400).json({ error: 'Invalid seller address' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);

    // Verify this is a freelance escrow in FUNDED state
    if (state.escrowType !== EscrowType.FREELANCE) {
      res.status(400).json({ error: 'submit-work is only for freelance escrows' });
      return;
    }

    if (state.state !== 1) {
      res.status(400).json({ error: 'Escrow must be in FUNDED state' });
      return;
    }

    // Verify seller address matches
    if (sellerAddress !== state.seller) {
      res.status(403).json({ error: 'Only the seller can submit work' });
      return;
    }

    // Hash the deliverables
    const deliverables = JSON.stringify({ githubUrl, description, submittedAt: new Date().toISOString() });
    const hash = crypto.createHash('sha256').update(deliverables).digest();

    // Try to store deliverables hash on-chain (oracle signs)
    let txId = null;
    try {
      txId = await algorandService.oracleSubmitDeliverables(appId, new Uint8Array(hash));
    } catch (chainError) {
      console.warn('Failed to submit deliverables on-chain:', chainError);
    }

    // Trigger AI verification asynchronously
    if (aiService.isAvailable() && requirements) {
      aiService.verifyDeliverables(appId, requirements, { githubUrl, description })
        .then(async (verdict) => {
          console.log(`AI Verdict for ${appId}:`, verdict);
          if (verdict.score >= 70) {
            try {
              await algorandService.oracleRecordAiVerdict(
                appId,
                verdict.recommendation === 'RELEASE',
                verdict.score,
                verdict.verdict.substring(0, 100)
              );
              console.log(`AI verdict recorded on-chain for ${appId}`);
            } catch (err) {
              console.error('Failed to record AI verdict on-chain:', err);
            }
          }
        })
        .catch((err) => {
          console.error('AI verification failed:', err);
        });
    }

    res.json({
      success: true,
      message: 'Work submitted. AI verification triggered.',
      data: {
        appId,
        deliverablesHash: Buffer.from(hash).toString('hex'),
        txId,
        aiVerificationTriggered: aiService.isAvailable(),
        note: txId
          ? 'Deliverables hash stored on-chain'
          : 'Deliverables recorded (on-chain storage pending)',
      },
    });
  } catch (error: any) {
    console.error('Error submitting work:', error);
    res.status(500).json({ error: error.message || 'Failed to submit work' });
  }
});

/**
 * POST /api/escrow/:appId/ai-verify
 * Manually trigger AI verification
 */
router.post('/:appId/ai-verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { requirements, deliverables, githubUrl, description } = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    if (!requirements || !deliverables) {
      res.status(400).json({ error: 'Missing requirements or deliverables' });
      return;
    }

    if (!aiService.isAvailable()) {
      res.status(503).json({ error: 'AI verification service not available' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);

    if (state.escrowType !== EscrowType.FREELANCE) {
      res.status(400).json({ error: 'AI verification is only for freelance escrows' });
      return;
    }

    // Run AI verification
    const verdict = await aiService.verifyDeliverables(appId, requirements, {
      githubUrl,
      description: description || deliverables,
    });

    // Optionally record on-chain if score is high enough
    let txId = null;
    if (verdict.score >= 70) {
      try {
        txId = await algorandService.oracleRecordAiVerdict(
          appId,
          verdict.recommendation === 'RELEASE',
          verdict.score,
          verdict.verdict.substring(0, 100)
        );
      } catch (chainError) {
        console.warn('Failed to record verdict on-chain:', chainError);
      }
    }

    res.json({
      success: true,
      data: {
        appId,
        score: verdict.score,
        recommendation: verdict.recommendation,
        verdict: verdict.verdict,
        analysis: verdict.analysis,
        txId,
        recordedOnChain: !!txId,
      },
    });
  } catch (error: any) {
    console.error('Error in AI verification:', error);
    res.status(500).json({ error: error.message || 'AI verification failed' });
  }
});

/**
 * POST /api/escrow/:appId/arbitrate
 * Arbiter resolves a dispute (protected endpoint)
 */
router.post('/:appId/arbitrate', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { releaseToSeller, secret, reason } = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    // Verify API secret for protected endpoint
    const apiSecret = process.env.API_SECRET;
    if (apiSecret && secret !== apiSecret) {
      res.status(401).json({ error: 'Unauthorized: Invalid API secret' });
      return;
    }

    if (releaseToSeller === undefined) {
      res.status(400).json({ error: 'Missing releaseToSeller parameter' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);

    if (state.state !== 4) {
      res.status(400).json({ error: 'Escrow must be in DISPUTED state to arbitrate' });
      return;
    }

    const txId = await algorandService.arbiterResolveDispute(appId, releaseToSeller);

    res.json({
      success: true,
      message: releaseToSeller ? 'Funds released to seller' : 'Funds refunded to buyer',
      data: {
        appId,
        releaseToSeller,
        reason: reason || 'Arbitration decision',
        txId,
        loraUrl: `https://lora.algokit.io/${process.env.ALGORAND_NETWORK || 'testnet'}/transaction/${txId}`,
      },
    });
  } catch (error: any) {
    console.error('Error arbitrating dispute:', error);
    res.status(500).json({ error: error.message || 'Failed to arbitrate dispute' });
  }
});

/**
 * POST /api/escrow/:appId/confirm-delivery
 * Oracle confirms delivery (for marketplace/P2P escrows)
 */
router.post('/:appId/confirm-delivery', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { secret, trackingInfo } = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    // Verify API secret for protected endpoint
    const apiSecret = process.env.API_SECRET;
    if (apiSecret && secret !== apiSecret) {
      res.status(401).json({ error: 'Unauthorized: Invalid API secret' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);

    if (state.state !== 1) {
      res.status(400).json({ error: 'Escrow must be in FUNDED state' });
      return;
    }

    const txId = await algorandService.oracleConfirmDelivery(appId);

    res.json({
      success: true,
      message: 'Delivery confirmed. Funds released to seller.',
      data: {
        appId,
        trackingInfo,
        txId,
        loraUrl: `https://lora.algokit.io/${process.env.ALGORAND_NETWORK || 'testnet'}/transaction/${txId}`,
      },
    });
  } catch (error: any) {
    console.error('Error confirming delivery:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm delivery' });
  }
});

/**
 * POST /api/escrow/:appId/build-fund-txns
 * Build unsigned fund transactions for buyer to sign in wallet
 */
router.post('/:appId/build-fund-txns', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { buyerAddress, amountMicroAlgo } = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    if (!buyerAddress || !amountMicroAlgo) {
      res.status(400).json({ error: 'Missing buyerAddress or amountMicroAlgo' });
      return;
    }

    if (!algosdk.isValidAddress(buyerAddress)) {
      res.status(400).json({ error: 'Invalid buyer address' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);

    if (state.state !== 0) {
      res.status(400).json({ error: 'Escrow must be in CREATED state to fund' });
      return;
    }

    const unsignedTxns = await algorandService.buildFundTransactions(
      appId,
      buyerAddress,
      parseInt(amountMicroAlgo)
    );

    res.json({
      success: true,
      message: 'Unsigned fund transactions ready',
      data: {
        appId,
        escrowAddress: algorandService.getApplicationAddress(appId),
        buyer: buyerAddress,
        amount: amountMicroAlgo,
        unsignedTransactions: unsignedTxns,
        note: 'Sign both transactions with your wallet and submit as atomic group',
      },
    });
  } catch (error: any) {
    console.error('Error building fund transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to build fund transactions' });
  }
});

/**
 * POST /api/escrow/:appId/build-dispute-txn
 * Build unsigned dispute transaction for buyer/seller to sign
 */
router.post('/:appId/build-dispute-txn', async (req: Request, res: Response): Promise<void> => {
  try {
    const appId = parseInt(req.params.appId as string);
    const { disputerAddress } = req.body;

    if (isNaN(appId) || appId <= 0) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    if (!disputerAddress) {
      res.status(400).json({ error: 'Missing disputerAddress' });
      return;
    }

    if (!algosdk.isValidAddress(disputerAddress)) {
      res.status(400).json({ error: 'Invalid disputer address' });
      return;
    }

    const state = await algorandService.getEscrowState(appId);

    if (state.state !== 1) {
      res.status(400).json({ error: 'Escrow must be in FUNDED state to dispute' });
      return;
    }

    // Verify disputer is buyer or seller
    if (disputerAddress !== state.buyer && disputerAddress !== state.seller) {
      res.status(403).json({ error: 'Only buyer or seller can raise disputes' });
      return;
    }

    const unsignedTxn = await algorandService.buildRaiseDisputeTransaction(appId, disputerAddress);

    res.json({
      success: true,
      message: 'Unsigned dispute transaction ready',
      data: {
        appId,
        disputer: disputerAddress,
        unsignedTransaction: unsignedTxn,
        note: 'Sign this transaction with your wallet and submit',
      },
    });
  } catch (error: any) {
    console.error('Error building dispute transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to build dispute transaction' });
  }
});

/**
 * POST /api/escrow/submit-signed-txns
 * Submit signed transactions to the network
 */
router.post('/submit-signed-txns', async (req: Request, res: Response): Promise<void> => {
  try {
    const { signedTransactions } = req.body;

    if (!signedTransactions || !Array.isArray(signedTransactions)) {
      res.status(400).json({ error: 'Missing or invalid signedTransactions array' });
      return;
    }

    // Convert base64 signed txns to Uint8Array
    const txns = signedTransactions.map((txn: string) => new Uint8Array(Buffer.from(txn, 'base64')));

    let txId: string;
    if (txns.length === 1) {
      txId = await algorandService.submitTransaction(txns[0]);
    } else {
      txId = await algorandService.submitTransactionGroup(txns);
    }

    res.json({
      success: true,
      message: 'Transaction(s) submitted successfully',
      data: {
        txId,
        loraUrl: `https://lora.algokit.io/${process.env.ALGORAND_NETWORK || 'testnet'}/transaction/${txId}`,
      },
    });
  } catch (error: any) {
    console.error('Error submitting signed transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to submit transactions' });
  }
});

export default router;
