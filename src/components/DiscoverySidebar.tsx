'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface DiscoverySidebarProps {
  activeSection: number;
  totalSections: number;
}

export function DiscoverySidebar({ activeSection, totalSections }: DiscoverySidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { icon: 'home', label: 'Home', href: '/' },
    { icon: 'compass', label: 'Discover', href: '/discover' },
    { icon: 'grid', label: 'Vote', href: '/vote' },
    { icon: 'message', label: 'Chat', href: '/chat/0' },
  ];

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed left-6 top-1/2 -translate-y-1/2 z-50"
      style={{
        width: '90px',
        background: 'rgba(255, 255, 255, 0.12)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '28px',
        padding: '24px 0',
      }}
    >
      <nav className="flex flex-col items-center gap-8">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href || (item.href === '/discover' && pathname.includes('discover'));

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center gap-2 group"
            >
              {/* Icon */}
              <motion.div
                className="relative"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {item.icon === 'home' && (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.6)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
                {item.icon === 'compass' && (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.6)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                )}
                {item.icon === 'grid' && (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.6)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                )}
                {item.icon === 'message' && (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.6)'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                )}

                {/* Active indicator glow */}
                {isActive && (
                  <motion.div
                    layoutId="activeGlow"
                    className="absolute -inset-2 rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
              </motion.div>

              {/* Label on hover */}
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                whileHover={{ opacity: 1, x: 0 }}
                className="absolute left-full ml-4 px-3 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap pointer-events-none"
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {item.label}
              </motion.span>
            </Link>
          );
        })}

        {/* Section progress indicator */}
        <div className="mt-8 pt-8 border-t border-white/20">
          <div className="flex flex-col items-center gap-2">
            {Array.from({ length: Math.min(totalSections, 5) }).map((_, index) => (
              <motion.div
                key={index}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background:
                    index === activeSection % 5
                      ? 'rgba(255,255,255,1)'
                      : 'rgba(255,255,255,0.3)',
                }}
                animate={{
                  scale: index === activeSection % 5 ? 1.5 : 1,
                }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>
        </div>
      </nav>
    </motion.div>
  );
}
