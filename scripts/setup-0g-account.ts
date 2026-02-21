#!/usr/bin/env node
/**
 * Set up a 0G Compute Network account for inference.
 *
 * Steps performed:
 *   1. Create broker from wallet
 *   2. Add a ledger (on-chain account) with initial deposit
 *   3. Acknowledge the provider's signer
 *   4. Transfer funds to the provider for inference usage
 *
 * Run with:  npx tsx scripts/setup-0g-account.ts
 *
 * Requires 0G testnet A0GI in the wallet. Get testnet tokens from the faucet:
 *   https://faucet.0g.ai
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../.env') });

import { Wallet, JsonRpcProvider, parseEther } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.OG_PRIVATE_KEY || '';
const RPC_URL = process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai';
const PROVIDER_ADDRESS = process.env.OG_PROVIDER_ADDRESS || '';

// Amount of A0GI to deposit into the ledger (on-chain balance)
// Contract minimum is 0.1 A0GI (100000000000000000 neuron)
const LEDGER_DEPOSIT = 0.1;
// Amount to allocate to the provider for inference
const PROVIDER_FUND = parseEther('0.01');

async function main() {
  if (!PRIVATE_KEY) {
    console.error('No PRIVATE_KEY set in .env');
    process.exit(1);
  }
  if (!PROVIDER_ADDRESS) {
    console.error('No OG_PROVIDER_ADDRESS set in .env');
    process.exit(1);
  }

  console.log('Connecting to 0G network at', RPC_URL, '...\n');

  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PRIVATE_KEY, provider);

  console.log('Wallet address:', signer.address);

  // Check balance
  const balance = await provider.getBalance(signer.address);
  console.log('Wallet balance:', (Number(balance) / 1e18).toFixed(4), 'A0GI\n');

  if (balance === 0n) {
    console.error('Wallet has no A0GI. Get testnet tokens from: https://faucet.0g.ai');
    process.exit(1);
  }

  console.log('Creating broker...\n');
  const broker = await createZGComputeNetworkBroker(signer);

  // Step 1: Check if ledger already exists
  console.log('--- Step 1: Ledger Setup ---');
  try {
    const existingLedger = await broker.ledger.getLedger();
    console.log('Ledger already exists. Balance:', existingLedger?.totalBalance?.toString() || 'unknown');
    console.log('Skipping ledger creation.\n');
  } catch {
    console.log('No ledger found. Creating with', LEDGER_DEPOSIT, 'A0GI deposit...');
    try {
      await broker.ledger.addLedger(LEDGER_DEPOSIT);
      console.log('Ledger created successfully!\n');
    } catch (err) {
      console.error('Failed to create ledger:', (err as Error).message);
      console.error('\nMake sure your wallet has enough A0GI (at least 0.1 + gas, so ~0.11 total)');
      console.error('Get testnet tokens from the faucet: https://faucet.0g.ai');
      process.exit(1);
    }
  }

  // Step 2: Acknowledge provider
  console.log('--- Step 2: Acknowledge Provider ---');
  console.log('Provider:', PROVIDER_ADDRESS);
  try {
    await broker.inference.acknowledgeProviderSigner(PROVIDER_ADDRESS);
    console.log('Provider acknowledged!\n');
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('already') || msg.includes('exists')) {
      console.log('Provider already acknowledged.\n');
    } else {
      console.error('Failed to acknowledge provider:', msg);
      console.error('Continuing anyway...\n');
    }
  }

  // Step 3: Transfer funds to provider
  console.log('--- Step 3: Transfer Funds to Provider ---');
  console.log('Transferring 0.01 A0GI for inference usage...');
  try {
    await broker.ledger.transferFund(PROVIDER_ADDRESS, 'inference', PROVIDER_FUND);
    console.log('Funds transferred successfully!\n');
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('insufficient') || msg.includes('balance')) {
      console.error('Insufficient ledger balance. You may need to add more A0GI.');
    } else {
      console.error('Failed to transfer funds:', msg);
    }
    console.error('Continuing to test...\n');
  }

  // Step 4: Verify by listing services
  console.log('--- Step 4: Verification ---');
  try {
    const meta = await broker.inference.getServiceMetadata(PROVIDER_ADDRESS);
    console.log('Provider service found:');
    console.log('  Endpoint:', meta.endpoint);
    console.log('  Model:', meta.model);
  } catch (err) {
    console.log('Could not fetch service metadata:', (err as Error).message);
  }

  console.log('\n=== Setup Complete ===');
  console.log('You can now run: npm run jobs');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
