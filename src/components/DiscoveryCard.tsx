'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Profile } from '@/types';

interface DiscoveryCardProps {
  profile: Pick<Profile, 'name' | 'age' | 'location' | 'image_url'>;
  compatibility: string[];
  onVote: (support: boolean) => void;
}

export function DiscoveryCard({ profile, compatibility, onVote }: DiscoveryCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Generate interests from compatibility (take first 3 words from each reason)
  const interests = compatibility
    .flatMap(reason => reason.split(':')[0].split(' '))
    .filter(word => word.length > 4)
    .slice(0, 3);

  return (
    <motion.div
      className="relative w-[320px] h-[480px] rounded-[28px] overflow-hidden cursor-pointer"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{
        scale: 0.98,
        transition: { duration: 0.25, ease: 'easeOut' },
      }}
      style={{
        background: 'rgba(255, 255, 255, 0.18)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        boxShadow: isHovered
          ? '0 25px 70px rgba(0, 0, 0, 0.2)'
          : '0 20px 60px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* Portrait image */}
      <motion.div
        className="absolute inset-0 w-full h-full"
        animate={{
          scale: isHovered ? 0.92 : 1,
        }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <img
          src={profile.image_url}
          alt={profile.name}
          className="w-full h-full object-cover"
        />

        {/* Gradient overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)',
          }}
        />
      </motion.div>

      {/* Basic info (always visible at bottom) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 z-10 pointer-events-none">
        <motion.div
          animate={{
            y: isHovered ? -280 : 0,
          }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <h3 className="text-white text-2xl font-bold mb-1">{profile.name}</h3>
          <p className="text-white/90 text-sm">
            {profile.age} • {profile.location}
          </p>
        </motion.div>
      </div>

      {/* Description panel (slides up on hover) */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 p-6 z-20"
        initial={{ y: '100%' }}
        animate={{
          y: isHovered ? '0%' : '100%',
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        style={{
          background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: isHovered ? 'blur(36px)' : 'blur(30px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        {/* Bio */}
        <div className="mb-4">
          <p className="text-white text-sm leading-relaxed">
            Looking for genuine connection. Love exploring new places and trying new things.
          </p>
        </div>

        {/* Interest tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {interests.map((interest, idx) => (
            <span
              key={idx}
              className="px-3 py-1 rounded-full text-xs font-medium text-white"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(10px)',
              }}
            >
              {interest}
            </span>
          ))}
        </div>

        {/* Vote buttons */}
        <div className="flex gap-3 pointer-events-auto">
          <motion.button
            onClick={() => onVote(false)}
            className="flex-1 py-3 rounded-full text-white font-medium"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Pass
          </motion.button>
          <motion.button
            onClick={() => onVote(true)}
            className="flex-1 py-3 rounded-full text-white font-semibold"
            style={{
              background: 'rgba(255, 255, 255, 0.35)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Match
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
