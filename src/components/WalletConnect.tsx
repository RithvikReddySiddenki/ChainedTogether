'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from './ui/Button';

/**
 * Wrapper around RainbowKit ConnectButton with custom styling
 */
export function WalletConnect() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} variant="primary">
                    Connect Wallet
                  </Button>
                );
              }

              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} variant="outline">
                    Wrong network
                  </Button>
                );
              }

              return (
                <div className="flex gap-2">
                  <Button onClick={openChainModal} variant="ghost" size="sm">
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain icon'}
                        src={chain.iconUrl}
                        className="w-4 h-4 mr-1"
                      />
                    )}
                    {chain.name}
                  </Button>

                  <Button onClick={openAccountModal} variant="secondary" size="sm">
                    {account.displayName}
                  </Button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
