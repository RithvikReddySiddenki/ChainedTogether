'use client';

import { useState, useRef, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { WalletConnect } from '@/components/WalletConnect';
import { generateBioSummary, zeroGClient } from '@/services/0gComputeClient';
import { supabase } from '@/lib/supabase';
import type { ExtractedProfile } from '@/types';

// ─── Styled input (dark glass theme) ────────────────────
function GlassInput({
  label,
  hint,
  ...props
}: {
  label: string;
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
      </label>
      <input
        className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 focus:ring-2 focus:ring-[#00ffd5]/30"
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        {...props}
      />
      {hint && (
        <p className="text-xs text-slate-500 mt-1">{hint}</p>
      )}
    </div>
  );
}

function GlassTextarea({
  label,
  hint,
  ...props
}: {
  label: string;
  hint?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
      </label>
      <textarea
        className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 resize-none focus:ring-2 focus:ring-[#00ffd5]/30"
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        {...props}
      />
      {hint && (
        <p className="text-xs text-slate-500 mt-1">{hint}</p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<'form' | 'review' | 'complete'>('form');

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [location, setLocation] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [job, setJob] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [fun, setFun] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI-generated bio
  const [bio, setBio] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Process uploaded image: resize to max 400px and convert to JPEG data URI
  const processImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * (MAX / w)); w = MAX; }
          else { w = Math.round(w * (MAX / h)); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUri = canvas.toDataURL('image/jpeg', 0.8);
        setImageUrl(dataUri);
        setImagePreview(dataUri);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  }, [processImage]);

  // ─── Not connected ──────────────────────────────────────
  if (!isConnected) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#070b14' }}
      >
        <motion.div
          className="text-center space-y-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2
            className="text-3xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #00ffd5, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Connect Your Wallet
          </h2>
          <p className="text-slate-400 max-w-sm">
            Connect your wallet to create your profile.
          </p>
          <WalletConnect />
        </motion.div>
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
      setBio(`${job} based in ${location}. Into ${hobbies.toLowerCase()} and loves ${fun.toLowerCase()}.`);
      setStep('review');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
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

      const embedding = await zeroGClient.embedProfile({
        imageUrl,
        extractedProfile: extracted,
      });

      const profileData: Record<string, any> = {
        wallet_address: address!.toLowerCase(),
        name,
        age: parseInt(age),
        location,
        image_url: imageUrl,
        answers_json: extracted,
        embedding,
      };

      let { error } = await supabase.from('profiles').upsert(
        { ...profileData, bio },
        { onConflict: 'wallet_address' }
      );

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

  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '';

  // ─── Complete State ─────────────────────────────────────
  if (step === 'complete') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: 'linear-gradient(135deg, #070b14 0%, #0a1128 50%, #1a0a3e 100%)',
        }}
      >
        <motion.div
          className="w-full max-w-lg glass rounded-3xl p-8"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center space-y-5">
            <motion.div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,213,0.2), rgba(34,211,238,0.1))',
                border: '1px solid rgba(0,255,213,0.3)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00ffd5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </motion.div>

            <h2
              className="text-2xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #00ffd5, #22d3ee)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Profile Created!
            </h2>
            <p className="text-slate-400 text-sm">
              Your profile has been saved. The community can now see your bio when voting on matches.
            </p>

            <div
              className="rounded-xl p-4 text-left"
              style={{
                background: 'rgba(0, 255, 213, 0.05)',
                border: '1px solid rgba(0, 255, 213, 0.15)',
              }}
            >
              <p className="text-xs font-medium text-[#00ffd5] mb-1.5">Your AI-generated bio:</p>
              <p className="text-sm text-slate-300 italic leading-relaxed">&ldquo;{bio}&rdquo;</p>
            </div>

            <div className="flex gap-3 pt-2">
              <motion.button
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,255,213,0.15), rgba(34,211,238,0.1))',
                  border: '1px solid rgba(0,255,213,0.4)',
                  color: '#00ffd5',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => (window.location.href = '/vote')}
              >
                Start Voting
              </motion.button>
              <motion.button
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => (window.location.href = '/matches')}
              >
                Browse Matches
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Review Bio State ──────────────────────────────────
  if (step === 'review') {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: 'linear-gradient(135deg, #070b14 0%, #0a1128 50%, #1a0a3e 100%)',
        }}
      >
        <motion.div
          className="w-full max-w-lg glass rounded-3xl p-8"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2
            className="text-xl font-bold mb-1"
            style={{
              background: 'linear-gradient(135deg, #00ffd5, #22d3ee)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Review Your Bio
          </h2>
          <p className="text-sm text-slate-500 mb-6">
            Our AI wrote this summary. This is what voters will see on your profile card.
          </p>

          {/* Preview card (mimics the vote page's ProfileCard style) */}
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div
              className="h-20 flex items-center justify-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(160deg, #a78bfa, #c084fc)',
              }}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <span className="text-white/30 text-4xl font-extralight">
                  {initials}
                </span>
              )}
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg text-white">
                {name}, {age}
              </h3>
              <p className="text-sm mt-0.5 text-slate-400">
                {location}
              </p>
              <p className="text-sm mt-3 leading-relaxed text-slate-300">
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
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#e2e8f0',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            </div>
          </div>

          {/* Editable bio */}
          <GlassTextarea
            label="Edit bio (optional)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
          />

          <div
            className="my-6"
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            }}
          />

          <div className="flex gap-3">
            <motion.button
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,213,0.15), rgba(34,211,238,0.1))',
                border: '1px solid rgba(0,255,213,0.4)',
                color: '#00ffd5',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </motion.button>
            <motion.button
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#e2e8f0',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep('form')}
            >
              Back to Edit
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── Form State ────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #070b14 0%, #0a1128 50%, #1a0a3e 100%)',
      }}
    >
      <motion.div
        className="w-full max-w-lg glass rounded-3xl p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2
          className="text-2xl font-bold mb-1"
          style={{
            background: 'linear-gradient(135deg, #00ffd5, #22d3ee, #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Create Your Profile
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Tell us about yourself. Our AI will create a short bio that other
          members see when voting on your matches.
        </p>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <GlassInput
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex"
            />
            <GlassInput
              label="Age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="24"
              min="18"
            />
          </div>

          <GlassInput
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="San Francisco, CA"
          />

          {/* Profile Image Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Profile Photo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <motion.button
              type="button"
              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200"
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                </div>
              )}
              <div className="text-left">
                <p className="text-sm text-slate-300">
                  {imagePreview ? 'Change photo' : 'Upload a photo'}
                </p>
                <p className="text-xs text-slate-500">
                  JPG, PNG, or WebP
                </p>
              </div>
            </motion.button>
          </div>

          <div
            className="my-2"
            style={{
              height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            }}
          />

          <GlassInput
            label="What do you do? (job, studies, etc.)"
            value={job}
            onChange={(e) => setJob(e.target.value)}
            placeholder="CS student at Purdue / Software engineer at Google"
          />

          <GlassTextarea
            label="What are your hobbies?"
            value={hobbies}
            onChange={(e) => setHobbies(e.target.value)}
            placeholder="Rock climbing, playing guitar, cooking Italian food, reading sci-fi"
            rows={2}
            hint="Separate with commas for best results"
          />

          <GlassTextarea
            label="What do you like to do for fun?"
            value={fun}
            onChange={(e) => setFun(e.target.value)}
            placeholder="Weekend road trips, trying new restaurants, game nights with friends"
            rows={2}
          />

          <motion.button
            className="w-full py-3 rounded-xl text-sm font-semibold tracking-wide relative group mt-2"
            style={{
              background: 'linear-gradient(135deg, rgba(0,255,213,0.15), rgba(34,211,238,0.1))',
              border: '1px solid rgba(0,255,213,0.4)',
              color: '#00ffd5',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleGenerateBio}
            disabled={generating}
          >
            <span
              className="absolute -inset-0.5 rounded-xl opacity-0 group-hover:opacity-40 blur-lg transition-opacity duration-300"
              style={{
                background: 'linear-gradient(135deg, #00ffd5, #22d3ee)',
              }}
            />
            <span className="relative">
              {generating ? 'Generating your bio...' : 'Generate My Bio'}
            </span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
