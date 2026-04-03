import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/auth';
import escrowRoutes from './routes/escrow';
import { algorandService } from './services/algorand.service';

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/algoescrow';

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Initialize Algorand oracle
algorandService.initializeOracle().catch(console.error);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/escrow', escrowRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AlgoEscrow API is running',
    network: process.env.ALGORAND_NETWORK || 'localnet',
    factoryAppId: process.env.ESCROW_FACTORY_APP_ID,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Database connection
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🚀 AlgoEscrow API Server Running`);
      console.log(`${'='.repeat(50)}`);
      console.log(`   Port: ${PORT}`);
      console.log(`   Network: ${process.env.ALGORAND_NETWORK || 'localnet'}`);
      console.log(`   Factory App ID: ${process.env.ESCROW_FACTORY_APP_ID}`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`${'='.repeat(50)}\n`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  });

