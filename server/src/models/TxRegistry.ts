import mongoose from 'mongoose';

const txRegistrySchema = new mongoose.Schema(
  {
    txId: { type: String, required: true, unique: true, index: true },
    escrowId: { type: String, required: true, index: true },
    kind: { type: String, enum: ['FUND'], required: true },
  },
  { timestamps: true },
);

export default mongoose.model('TxRegistry', txRegistrySchema);
