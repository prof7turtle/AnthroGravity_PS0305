import mongoose from 'mongoose';

export type EscrowType = 'MARKETPLACE' | 'P2P' | 'FREELANCE';
export type EscrowState =
  | 'CREATED'
  | 'FUNDED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'REFUNDED'
  | 'EXPIRED';

const activityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    fromState: { type: String, required: true },
    toState: { type: String, required: true },
    actor: { type: String, default: '' },
    txId: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } },
);

const escrowSchema = new mongoose.Schema(
  {
    escrowId: { type: String, required: true, unique: true, index: true },
    appId: { type: Number, default: null },
    appAddress: { type: String, default: '' },

    state: {
      type: String,
      enum: ['CREATED', 'FUNDED', 'COMPLETED', 'DISPUTED', 'REFUNDED', 'EXPIRED'],
      default: 'CREATED',
      required: true,
    },
    escrowType: {
      type: String,
      enum: ['MARKETPLACE', 'P2P', 'FREELANCE'],
      default: 'FREELANCE',
      required: true,
    },

    itemName: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USDC' },

    buyerAddress: { type: String, default: '' },
    sellerAddress: { type: String, required: true },

    deadlineAt: { type: Date, required: true },

    requirements: [{ type: String }],
    requirementsHash: { type: String, default: '' },
    deliverablesHash: { type: String, default: '' },

    hasSubmission: { type: Boolean, default: false },
    isAiRunning: { type: Boolean, default: false },
    aiScore: { type: Number, default: null },
    aiVerdict: {
      score: { type: Number, default: null },
      matched: [{ type: String }],
      gaps: [{ type: String }],
      verdict: { type: String, default: '' },
      recommendation: { type: String, enum: ['RELEASE', 'DISPUTE', ''], default: '' },
    },

    txIds: {
      create: { type: String, default: '' },
      fund: { type: String, default: '' },
      submit: { type: String, default: '' },
      verify: { type: String, default: '' },
      release: { type: String, default: '' },
      dispute: { type: String, default: '' },
      refund: { type: String, default: '' },
    },

    activityLogs: [activityLogSchema],
  },
  { timestamps: true },
);

export default mongoose.model('Escrow', escrowSchema);
