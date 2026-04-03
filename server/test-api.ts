/**
 * Simple test script to verify backend is working
 * Run with: npx ts-node test-api.ts
 */

async function testAPI() {
  const BASE_URL = 'http://localhost:5000';

  console.log('🧪 Testing AlgoEscrow Backend API\n');

  // Test 1: Health Check
  console.log('1️⃣  Testing Health Check...');
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    console.log('✅ Health Check:', data);
  } catch (error) {
    console.error('❌ Health Check failed:', error);
  }

  // Test 2: Factory Info
  console.log('\n2️⃣  Testing Factory Info...');
  try {
    const response = await fetch(`${BASE_URL}/api/escrow/factory/info`);
    const data = await response.json();
    console.log('✅ Factory Info:', data);
  } catch (error) {
    console.error('❌ Factory Info failed:', error);
  }

  // Test 3: Create Escrow
  console.log('\n3️⃣  Testing Create Escrow...');
  try {
    const response = await fetch(`${BASE_URL}/api/escrow/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seller: 'CE2OO7ENA7O5STYUFUTENFPPSLWBWL3NVKVIKFRCX3BYYSWKH753HJ5GV4',
        itemName: 'Test Product',
        escrowType: 0,
        deadlineRounds: 1000,
      }),
    });
    const data = await response.json();
    console.log('✅ Create Escrow:', data);
  } catch (error) {
    console.error('❌ Create Escrow failed:', error);
  }

  // Test 4: Get Escrow State (using template app as example)
  console.log('\n4️⃣  Testing Get Escrow State...');
  try {
    const response = await fetch(`${BASE_URL}/api/escrow/1197`);
    const data = await response.json();
    console.log('✅ Get Escrow State:');
    console.log('   State:', data.data.stateLabel);
    console.log('   Type:', data.data.typeLabel);
    console.log('   Seller:', data.data.seller);
  } catch (error) {
    console.error('❌ Get Escrow State failed:', error);
  }

  console.log('\n✅ All tests completed!');
}

testAPI().catch(console.error);
