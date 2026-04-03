import axios from 'axios';
import WebhookSubscription from '../models/WebhookSubscription';

export const registerWebhook = async (escrowId: string, webhookUrl: string) => {
  const existing = await WebhookSubscription.findOne({ escrowId, webhookUrl });
  if (existing) {
    existing.active = true;
    await existing.save();
    return existing;
  }

  const record = new WebhookSubscription({ escrowId, webhookUrl, active: true });
  await record.save();
  return record;
};

export const listWebhooks = async (escrowId: string) => {
  return WebhookSubscription.find({ escrowId, active: true }).sort({ createdAt: -1 });
};

export const dispatchEscrowWebhook = async (payload: {
  escrowId: string;
  appId: number | null;
  newState: string;
  txId: string;
  timestamp: string;
}) => {
  const targets = await listWebhooks(payload.escrowId);
  await Promise.all(
    targets.map(async (target) => {
      try {
        await axios.post(target.webhookUrl, payload, { timeout: 5000 });
      } catch {
        // Do not fail core escrow flow because webhook consumer is down.
      }
    }),
  );
};
