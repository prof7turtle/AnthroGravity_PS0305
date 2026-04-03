import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['user', 'merchant'],
    default: 'user',
  },
  walletAddress: {
    type: String,
    default: '',
  }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
