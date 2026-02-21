'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Scale, Loader2, Clock } from 'lucide-react';

const APPROVAL_THRESHOLD = 5;
const REJECTION_THRESHOLD = 5;

function getConsensusStatus(approves: number, rejects: number) {
  if (approves >= APPROVAL_THRESHOLD) return 'approved' as const;
  if (rejects >= REJECTION_THRESHOLD) return 'rejected' as const;
  if (approves + rejects > 0) return 'pending' as const;
  return 'pending' as const;
}

const STATUS_CONFIG = {
  approved: {
    label: 'Approved',
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.3)',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: '#f87171',
    bgColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
    Icon: XCircle,
  },
  tied: {
    label: 'Tied',
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.3)',
    Icon: Scale,
  },
  pending: {
    label: 'Voting',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.15)',
    borderColor: 'rgba(96, 165, 250, 0.3)',
    Icon: Clock,
  },
};

interface ConsensusBannerProps {
  matchId?: number | null;
  approves?: number;
  rejects?: number;
  loading?: boolean;
  visible?: boolean;
}

export default function ConsensusBanner({
  matchId,
  approves = 0,
  rejects = 0,
  loading = false,
  visible = true,
}: ConsensusBannerProps) {
  const total = approves + rejects;
  const status = getConsensusStatus(approves, rejects);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.Icon;
  const approvePercent = total > 0 ? Math.round((approves / total) * 100) : 0;
  const rejectPercent = total > 0 ? Math.round((rejects / total) * 100) : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-40 flex items-center justify-center"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ paddingTop: '16px', pointerEvents: 'none' }}
        >
          <div
            className="flex items-center gap-6 px-8 py-3.5 pointer-events-auto"
            style={{
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.14)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            }}
          >
            {/* Match ID */}
            <div className="flex flex-col items-center">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                Match
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: 'rgba(255, 255, 255, 0.95)' }}
              >
                #{matchId ?? '\u2014'}
              </span>
            </div>

            <div
              className="w-px h-8"
              style={{ background: 'rgba(255, 255, 255, 0.15)' }}
            />

            {/* Approves */}
            <div className="flex flex-col items-center min-w-[52px]">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(52, 211, 153, 0.8)' }}
              >
                Yes
              </span>
              <span className="text-lg font-bold" style={{ color: '#34d399' }}>
                {loading ? '\u2014' : approves}
              </span>
              {total > 0 && !loading && (
                <span
                  className="text-[10px]"
                  style={{ color: 'rgba(255, 255, 255, 0.45)' }}
                >
                  {approvePercent}%
                </span>
              )}
            </div>

            {/* Rejects */}
            <div className="flex flex-col items-center min-w-[52px]">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(248, 113, 113, 0.8)' }}
              >
                No
              </span>
              <span className="text-lg font-bold" style={{ color: '#f87171' }}>
                {loading ? '\u2014' : rejects}
              </span>
              {total > 0 && !loading && (
                <span
                  className="text-[10px]"
                  style={{ color: 'rgba(255, 255, 255, 0.45)' }}
                >
                  {rejectPercent}%
                </span>
              )}
            </div>

            {/* Total */}
            <div className="flex flex-col items-center min-w-[52px]">
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                Total
              </span>
              <span
                className="text-lg font-bold"
                style={{ color: 'rgba(255, 255, 255, 0.9)' }}
              >
                {loading ? '\u2014' : total}
              </span>
            </div>

            <div
              className="w-px h-8"
              style={{ background: 'rgba(255, 255, 255, 0.15)' }}
            />

            {/* Status badge */}
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{
                background: loading
                  ? 'rgba(255, 255, 255, 0.08)'
                  : config.bgColor,
                border: `1px solid ${loading ? 'rgba(255, 255, 255, 0.12)' : config.borderColor}`,
              }}
            >
              {loading ? (
                <Loader2
                  size={16}
                  color="rgba(255, 255, 255, 0.6)"
                  className="animate-spin"
                />
              ) : (
                <StatusIcon size={16} color={config.color} strokeWidth={2.5} />
              )}
              <span
                className="text-sm font-bold tracking-wide"
                style={{
                  color: loading ? 'rgba(255, 255, 255, 0.5)' : config.color,
                }}
              >
                {loading
                  ? 'Loading'
                  : status === 'pending'
                    ? `Voting (${approves}/${APPROVAL_THRESHOLD} yesses)`
                    : config.label}
              </span>
            </div>

            {/* Progress bar — shows progress toward threshold */}
            {total > 0 && !loading && (
              <div
                className="w-24 h-1.5 rounded-full overflow-hidden"
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: status === 'pending'
                      ? `${Math.min(100, Math.round((Math.max(approves, rejects) / APPROVAL_THRESHOLD) * 100))}%`
                      : '100%',
                    background: status === 'approved'
                      ? 'linear-gradient(90deg, #34d399, #22d3ee)'
                      : status === 'rejected'
                        ? 'linear-gradient(90deg, #f87171, #fb923c)'
                        : approves >= rejects
                          ? 'linear-gradient(90deg, #34d399, #22d3ee)'
                          : 'linear-gradient(90deg, #f87171, #fb923c)',
                  }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
