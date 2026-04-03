import mongoose from 'mongoose';

const webhookSubscriptionSchema = new mongoose.Schema(
  {
    escrowId: { type: String, required: true, index: true },
    webhookUrl: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

webhookSubscriptionSchema.index({ escrowId: 1, webhookUrl: 1 }, { unique: true });

export default mongoose.model('WebhookSubscription', webhookSubscriptionSchema);
