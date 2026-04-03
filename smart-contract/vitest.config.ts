import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run tests sequentially (Algorand LocalNet is stateful)
    sequence: { concurrent: false },
    // Generous timeout for blockchain transactions
    testTimeout: 60_000,
    hookTimeout: 30_000,
    reporters: ['verbose'],
  },
})
