#!/usr/bin/env node
/**
 * Query 0G Compute Network to find service URLs for providers.
 * Run with: npx tsx scripts/list-0g-services.ts
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../.env') });

import { Wallet, JsonRpcProvider } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.OG_PRIVATE_KEY || '';
const RPC_URL = process.env.OG_RPC_URL || 'https://evmrpc-testnet.0g.ai';
const TARGET_PROVIDER = process.env.OG_PROVIDER_ADDRESS || '';

async function main() {
  if (!PRIVATE_KEY) {
    console.error('No PRIVATE_KEY set in .env');
    process.exit(1);
  }

  console.log('Connecting to 0G network at', RPC_URL, '...\n');

  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(PRIVATE_KEY, provider);

  console.log('Wallet:', signer.address);
  console.log('Creating broker...\n');

  const broker = await createZGComputeNetworkBroker(signer);

  console.log('Fetching service list...\n');
  const services = await broker.inference.listService();

  if (!services || services.length === 0) {
    console.log('No services found on the network.');
    return;
  }

  console.log(`Found ${services.length} service(s):\n`);
  console.log('─'.repeat(80));

  for (const svc of services) {
    const isTarget = TARGET_PROVIDER &&
      svc.provider?.toLowerCase() === TARGET_PROVIDER.toLowerCase();

    console.log(`${isTarget ? '>>> ' : '    '}Provider: ${svc.provider}`);
    console.log(`    Model:    ${svc.model}`);
    console.log(`    URL:      ${svc.url}`);
    console.log(`    Type:     ${svc.serviceType}`);
    console.log('─'.repeat(80));
  }

  // If we have a target provider, try to get its metadata directly
  if (TARGET_PROVIDER) {
    console.log(`\nLooking up metadata for target provider: ${TARGET_PROVIDER}`);
    try {
      const meta = await broker.inference.getServiceMetadata(TARGET_PROVIDER);
      console.log('Endpoint:', meta.endpoint);
      console.log('Model:', meta.model);
    } catch (err) {
      console.log('Could not fetch metadata:', (err as Error).message);
    }
  }
}

main().catch(console.error);
