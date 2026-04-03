import { Router } from 'express';
import { listWebhooks, registerWebhook } from '../services/webhook.service';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { escrowId, webhookUrl } = req.body;
    if (!escrowId || !webhookUrl) {
      return res.status(400).json({ message: 'escrowId and webhookUrl are required' });
    }

    const record = await registerWebhook(String(escrowId), String(webhookUrl));
    return res.status(201).json({
      id: record._id,
      escrowId: record.escrowId,
      webhookUrl: record.webhookUrl,
      active: record.active,
    });
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to register webhook', error: err.message });
  }
});

router.get('/:escrowId', async (req, res) => {
  try {
    const list = await listWebhooks(req.params.escrowId);
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ message: 'Failed to fetch webhooks', error: err.message });
  }
});

export default router;
