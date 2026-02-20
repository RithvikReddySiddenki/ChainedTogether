'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia, localhost } from 'wagmi/chains';

// Define localhost with correct chain ID for Hardhat
const hardhatLocal = {
  ...localhost,
  id: 1337,
  name: 'Localhost',
};

export const wagmiConfig = getDefaultConfig({
  appName: 'ChainedTogether',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [
    hardhatLocal as any,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [sepolia] : []),
  ],
  ssr: true,
});
