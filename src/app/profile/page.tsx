'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Divider';
import { WalletConnect } from '@/components/WalletConnect';
import { generateBioSummary, zeroGClient } from '@/services/0gComputeClient';
import { supabase } from '@/lib/supabase';
import type { ExtractedProfile } from '@/types';

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<'form' | 'review' | 'complete'>('form');

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [job, setJob] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [fun, setFun] = useState('');

  // AI-generated bio
  const [bio, setBio] = useState('');
  const [generating, setGenerating] = useState(false);
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

  const handleGenerateBio = async () => {
    if (!name || !age || !location || !job || !hobbies || !fun) {
      alert('Please fill in all fields');
      return;
    }

    setGenerating(true);
    try {
      const generatedBio = await generateBioSummary({
        name,
        age: parseInt(age),
        location,
        job,
        hobbies,
        fun,
      });
      setBio(generatedBio);
      setStep('review');
    } catch (error) {
      console.error('Bio generation failed:', error);
      // Build a simple fallback
      setBio(`${job} based in ${location}. Into ${hobbies.toLowerCase()} and loves ${fun.toLowerCase()}.`);
      setStep('review');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build structured answers from form data
      const hobbiesList = hobbies.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
      const funList = fun.split(',').map((f) => f.trim().toLowerCase()).filter(Boolean);

      const extracted: ExtractedProfile = {
        interests: [...new Set([...hobbiesList, ...funList])].slice(0, 6),
        values: ['honesty', 'respect'],
        communicationStyle: 'balanced',
        dealbreakers: [],
        lifestyle: [],
        goals: 'seeking meaningful connection',
        job,
        hobbies,
        fun,
      };

      // Generate embedding from structured data
      const embedding = await zeroGClient.embedProfile({
        imageUrl,
        extractedProfile: extracted,
      });

      // Save to Supabase (bio field may not exist yet — handle gracefully)
      const profileData: Record<string, any> = {
        wallet_address: address!.toLowerCase(),
        name,
        age: parseInt(age),
        location,
        image_url: imageUrl,
        answers_json: extracted,
        embedding,
      };

      // Try with bio first
      let { error } = await supabase.from('profiles').upsert(
        { ...profileData, bio },
        { onConflict: 'wallet_address' }
      );

      // If bio column doesn't exist, retry without it
      if (error && error.message?.includes('bio')) {
        console.warn('bio column not found, saving without it');
        const retry = await supabase.from('profiles').upsert(
          profileData,
          { onConflict: 'wallet_address' }
        );
        error = retry.error;
      }

      if (error) throw error;

      setStep('complete');
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Failed to save profile. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Complete State ─────────────────────────────────────
  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto mt-20">
          <Card>
            <CardContent className="text-center space-y-4 py-8">
              <div className="text-5xl">&#10003;</div>
              <h2 className="text-2xl font-bold">Profile Created!</h2>
              <p className="text-[hsl(var(--muted-foreground))]">
                Your profile has been saved. The community can now see your bio when voting on matches.
              </p>
              <div className="bg-[hsl(var(--muted))] rounded-lg p-4 text-left">
                <p className="text-sm font-medium mb-1">Your AI-generated bio:</p>
                <p className="text-sm text-[hsl(var(--muted-foreground))] italic">"{bio}"</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => (window.location.href = '/vote')} className="flex-1">
                  Start Voting
                </Button>
                <Button onClick={() => (window.location.href = '/matches')} variant="outline" className="flex-1">
                  Browse Matches
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Review Bio State ──────────────────────────────────
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Review Your Bio</CardTitle>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Our AI wrote this summary based on your answers. This is what other users
                will see when voting on your matches.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview card */}
              <div className="rounded-xl overflow-hidden border border-[hsl(var(--border))]">
                <div
                  className="h-24 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #a78bfa, #c084fc)',
                  }}
                >
                  <span className="text-white/40 text-4xl font-extralight">
                    {name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </span>
                </div>
                <div className="p-4 bg-white">
                  <h3 className="font-bold text-lg" style={{ color: '#1C1C1E' }}>
                    {name}, {age}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: '#6E6E73' }}>
                    {location}
                  </p>
                  <p className="text-sm mt-3 leading-relaxed" style={{ color: '#3a3a3c' }}>
                    {bio}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {hobbies
                      .split(',')
                      .map((h) => h.trim())
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ background: '#F2F2F7', color: '#1C1C1E' }}
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              {/* Editable bio */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Edit bio (optional)
                </label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full"
                />
              </div>

              <Divider />

              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
                <Button onClick={() => setStep('form')} variant="outline" className="flex-1">
                  Back to Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Form State ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-lg mx-auto mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Create Your Profile</CardTitle>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Tell us about yourself. Our AI will create a short bio that other
              members see when voting on your matches.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder="24"
                  min="18"
                />
              </div>
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
              <label className="block text-sm font-medium mb-1">Profile Image URL</label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://i.pravatar.cc/300?img=1"
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Tip: use https://i.pravatar.cc/300?img=1 for a placeholder
              </p>
            </div>

            <Divider />

            <div>
              <label className="block text-sm font-medium mb-1">
                What do you do? (job, studies, etc.)
              </label>
              <Input
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="CS student at Purdue / Software engineer at Google"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                What are your hobbies?
              </label>
              <Textarea
                value={hobbies}
                onChange={(e) => setHobbies(e.target.value)}
                placeholder="Rock climbing, playing guitar, cooking Italian food, reading sci-fi"
                rows={2}
              />
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Separate with commas for best results
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                What do you like to do for fun?
              </label>
              <Textarea
                value={fun}
                onChange={(e) => setFun(e.target.value)}
                placeholder="Weekend road trips, trying new restaurants, game nights with friends"
                rows={2}
              />
            </div>

            <Button
              onClick={handleGenerateBio}
              disabled={generating}
              className="w-full"
            >
              {generating ? 'Generating your bio...' : 'Generate My Bio'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
