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

export default router;
