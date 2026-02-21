#!/usr/bin/env node
/**
 * Deposit additional funds into the 0G ledger and transfer to provider.
 * Run with: npx tsx scripts/fund-0g-provider.ts
 */
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../.env') });

import { Wallet, JsonRpcProvider, formatEther, parseEther } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

async function main() {
  const rpcProvider = new JsonRpcProvider(process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai');
  const signer = new Wallet(process.env.PRIVATE_KEY || '', rpcProvider);
  const providerAddr = process.env.OG_PROVIDER_ADDRESS || '';

  const balance = await rpcProvider.getBalance(signer.address);
  console.log('Wallet balance:', formatEther(balance), 'A0GI');

  const broker = await createZGComputeNetworkBroker(signer);

  // Check current ledger
  try {
    const ledger = await broker.ledger.getLedger();
    console.log('Current ledger balance:', formatEther(ledger?.totalBalance || 0n), 'A0GI');
  } catch {
    console.log('No ledger found');
  }

  // Deposit 0.02 more into ledger
  console.log('\nDepositing 0.02 A0GI into ledger...');
  try {
    await broker.ledger.depositFund(0.02);
    console.log('Deposit successful!');
  } catch (e: any) {
    console.log('Deposit failed:', e.message?.slice(0, 200));
  }

  // Transfer 0.01 more to provider (needs > 0.100091, currently has 0.1)
  console.log('\nTransferring 0.01 A0GI to provider...');
  try {
    await broker.ledger.transferFund(providerAddr, 'inference', parseEther('0.01'));
    console.log('Transfer successful!');
  } catch (e: any) {
    console.log('Transfer failed:', e.message?.slice(0, 200));
  }

  const finalBalance = await rpcProvider.getBalance(signer.address);
  console.log('\nFinal wallet balance:', formatEther(finalBalance), 'A0GI');
  console.log('Done! Run: npm run jobs');
}

main().catch(console.error);
