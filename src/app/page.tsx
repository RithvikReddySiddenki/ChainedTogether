'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { WalletConnect } from '@/components/WalletConnect';
import { tokens } from '@/styles/tokens';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-[hsl(var(--border))] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">ChainedTogether</h1>
          <WalletConnect />
        </div>
      </nav>

      {/* Hero */}
      <main className="px-6 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-5xl font-bold leading-tight">
            AI-Powered Matchmaking
            <br />
            <span className="text-[hsl(var(--accent))]">Approved by DAO</span>
          </h2>

          <p className="text-xl text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
            Privacy-first dating where AI finds your perfect match and the community decides
            if it's meant to be. Your profile stays private until both sides are approved.
          </p>

          <div className="flex gap-4 justify-center pt-6">
            <Link href="/profile">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/matches">
              <Button size="lg" variant="outline">
                Browse Matches
              </Button>
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 pt-16 text-left">
            <div className="p-6 border border-[hsl(var(--border))] rounded-lg">
              <h3 className="font-semibold mb-2">AI Intake Chat</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Answer adaptive questions from our AI agent. No static forms.
              </p>
            </div>
            <div className="p-6 border border-[hsl(var(--border))] rounded-lg">
              <h3 className="font-semibold mb-2">DAO Voting</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Community votes on match proposals. Token-gated for fairness.
              </p>
            </div>
            <div className="p-6 border border-[hsl(var(--border))] rounded-lg">
              <h3 className="font-semibold mb-2">Privacy First</h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Profile details never shared. Chat unlocks only after approval.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[hsl(var(--border))] px-6 py-8 mt-20">
        <div className="max-w-3xl mx-auto text-center text-sm text-[hsl(var(--muted-foreground))]">
          <p>Built with 0g Labs • Nouns Builder • Supabase</p>
          <p className="mt-2">
            <Link href="/proposals" className="hover:text-[hsl(var(--accent))]">
              View Proposals
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
