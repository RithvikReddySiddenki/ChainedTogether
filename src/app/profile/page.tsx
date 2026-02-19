'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IntakeChat } from '@/components/IntakeChat';
import { WalletConnect } from '@/components/WalletConnect';
import { zeroGClient } from '@/services/0gComputeClient';
import { supabase } from '@/lib/supabase';
import type { ExtractedProfile } from '@/types';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<'form' | 'intake' | 'complete'>('form');

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // Intake state
  const [sessionId, setSessionId] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="text-center space-y-4">
            <h2 className="text-2xl font-bold">Connect Your Wallet</h2>
            <p className="text-[hsl(var(--muted-foreground))]">
              You need to connect your wallet to create a profile.
            </p>
            <WalletConnect />
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleStartIntake = () => {
    if (!name || !age || !location || !imageUrl) {
      alert('Please fill all fields');
      return;
    }
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    setStep('intake');
  };

  const handleIntakeComplete = async (extracted: ExtractedProfile, summary: string[]) => {
    setSaving(true);
    try {
      // Generate embedding
      const embedding = await zeroGClient.embedProfile({
        imageUrl,
        extractedProfile: extracted,
      });

      // Save to Supabase
      const { error } = await supabase.from('profiles').upsert({
        wallet_address: address!.toLowerCase(),
        name,
        age: parseInt(age),
        location,
        image_url: imageUrl,
        answers_json: extracted,
        embedding,
      });

      if (error) throw error;

      setStep('complete');
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h2 className="text-2xl font-bold">Profile Created!</h2>
              <p className="text-[hsl(var(--muted-foreground))]">
                Your profile has been saved. You can now browse matches.
              </p>
              <Button onClick={() => (window.location.href = '/matches')}>
                Browse Matches
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'intake') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Button variant="ghost" onClick={() => setStep('form')}>
              ← Back to Form
            </Button>
          </div>
          <IntakeChat
            sessionId={sessionId}
            imageUrl={imageUrl}
            walletAddress={address!}
            onComplete={handleIntakeComplete}
          />
          {saving && (
            <div className="mt-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
              Saving profile...
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create Your Profile</CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Fill in basic info, then chat with our AI agent to complete your profile.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Age</label>
              <Input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="28"
                min="18"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco, CA"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Image URL</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://i.pravatar.cc/300?img=1"
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Use a placeholder like https://i.pravatar.cc/300?img=1
              </p>
            </div>

            <Button onClick={handleStartIntake} className="w-full">
              Start AI Intake Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
