# Technical Decisions & Defaults

This document outlines all key technical decisions made for the ChainedTogether MVP.

---

## Smart Contract Decisions

### Framework Choice
**Decision**: Hardhat
**Rationale**: More common in hackathons, easier setup for beginners, better TypeScript integration for Next.js

### Contract Parameters (Defaults)
```solidity
yesThreshold: 3 votes
noThreshold: 3 votes
voteDurationSeconds: 600 (10 minutes)
```

**Rationale**: Low thresholds for demo purposes. In production, these would be configurable or percentage-based.

### Early Close Logic
**Implementation**: Vote closes immediately when either threshold is reached
**Rationale**: Better UX - no need to wait for deadline if consensus is clear

### Status Enum
```solidity
OPEN = 0
APPROVED = 1
REJECTED = 2
EXPIRED = 3
```

**Decision**: Use REJECTED for both explicit rejection and failed quorum
**Rationale**: Simplicity for MVP. In production, might separate these states.

---

## Frontend Decisions

### Framework
**Decision**: Next.js 14 with App Router
**Rationale**: Modern, server components support, better performance, industry standard

### Web3 Stack
- **wagmi v2**: Modern React hooks for Ethereum
- **viem v2**: Lightweight alternative to ethers.js
- **RainbowKit**: Best-in-class wallet connection UX

**Rationale**: Latest stable versions, excellent TypeScript support, maintained by Paradigm

### Styling Approach
**Decision**: TailwindCSS with CSS variables + design tokens
**Rationale**:
- Tailwind for utility-first rapid development
- CSS variables for runtime theming
- Design tokens in TypeScript for type safety
- Minimal component library for easy restyling

### Color System
**Default**: Blue accent (HSL: 220 90% 56%)
**Implementation**: HSL format for easy manipulation in CSS
**Rationale**: HSL allows easy lightness/darkness adjustments without changing hue

---

## Database Decisions

### Platform
**Decision**: Supabase (Postgres)
**Rationale**:
- Free tier sufficient for hackathon
- Built-in auth (though we use wallet-based auth)
- Row-level security
- Real-time subscriptions
- Easy SQL management

### RLS Strategy
**Decision**: Permissive policies with API-level gating for chat
**Rationale**:
- Profiles need to be publicly readable for matching
- Chat gating is complex (requires on-chain check)
- Easier to handle in Next.js API route than pure RLS

### Embedding Storage
**Decision**: Store as JSONB array
**Rationale**:
- Native JSON support in Postgres
- No need for specialized vector DB in MVP
- Easy to migrate to pgvector if needed

**Dimension**: 128-dimensional vectors
**Rationale**: Balance between expressiveness and storage/computation cost

---

## AI Service Decisions

### Abstraction Strategy
**Decision**: Single client class with MOCK and production modes
**Rationale**:
- Clean separation of concerns
- Easy to switch between modes
- Commented production code serves as integration template

### MOCK Implementation

#### Question Bank
**Size**: 10 base questions
**Adaptive branches**: 3 conditional questions (fitness, introvert, travel)
**Stop condition**: 8 questions default, up to 10 for short answers

**Rationale**: Enough variety for demo, simple branching logic

#### Profile Extraction
**Method**: Simple keyword matching
**Fields**:
```typescript
{
  interests: string[]
  values: string[]
  communicationStyle: string
  dealbreakers: string[]
  lifestyle: string[]
  goals: string
}
```

**Rationale**: Structured output is more useful than prose for matching

#### Embedding Generation
**Method**: Deterministic hashing of profile features
**Algorithm**:
1. Hash each interest/value/lifestyle item
2. Map to vector dimensions
3. Normalize to unit vector

**Rationale**:
- Reproducible for demo
- Similar profiles get similar embeddings
- No external API dependency

#### Matching Algorithm
**Method**: Cosine similarity
**Formula**: `dot(A, B) / (||A|| * ||B||)`

**Rationale**: Standard for high-dimensional similarity, range [0, 1] is intuitive as percentage

---

## Security Decisions

### Known Limitations (Documented)
1. **No ZK proofs**: Profile data visible in Supabase
2. **No encryption**: Chat messages are plaintext
3. **Minimal validation**: Trust frontend inputs
4. **Permissive RLS**: Chat gating via API, not database
5. **No rate limiting**: Could spam proposals/votes
6. **No spam prevention**: Could create fake profiles

**Rationale**: These are MVP shortcuts. Production would require:
- ZK proofs for profile privacy
- E2E encryption for chat
- Server-side validation
- Strict RLS policies
- Rate limiting middleware
- Reputation system

### aiScoreHash Design
**Formula**: `keccak256(abi.encodePacked(score, userA, userB, createdAt))`

**Purpose**:
- Proof that AI suggested this match
- Prevents gaming the system by proposing obviously bad matches
- In production, would be verified by oracle

**Limitation**: Not actually verified on-chain in MVP

---

## Testing Strategy

### Contract Testing
**Framework**: Hardhat's built-in tooling
**Coverage**:
- Propose match
- Vote (yes/no)
- Early close
- Finalize after deadline

**Rationale**: Core voting logic is critical, needs automated tests

### Frontend Testing
**Decision**: Manual testing only for MVP
**Test scenarios**:
1. Profile creation flow
2. Match browsing + proposal
3. Voting flow
4. Chat access gating

**Rationale**: E2E tests take time, manual testing sufficient for hackathon

---

## Deployment Strategy

### Development
**Network**: Hardhat local node (chainId: 1337)
**RPC**: http://127.0.0.1:8545
**Accounts**: 20 pre-funded accounts with 10000 ETH each

### Testnet
**Network**: Sepolia
**Rationale**: Most reliable testnet, good faucet availability

### Frontend Hosting
**Recommendation**: Vercel
**Rationale**:
- Zero-config for Next.js
- Free tier
- Automatic HTTPS
- Environment variable management

---

## Gas Optimization Notes

### Not Prioritized for MVP
**Rationale**: Hackathon focuses on functionality, not gas efficiency

### Potential Optimizations (Future)
1. Pack struct fields (currently using uint64/uint32 for packing)
2. Use events instead of storing all data on-chain
3. Batch vote counting
4. Use bitmap for hasVoted mapping

---

## Accessibility

### Current State
**Level**: Basic keyboard navigation
**Screen reader**: Semantic HTML only

### Future Improvements
- ARIA labels
- Focus management
- Color contrast adjustments
- Reduced motion support

---

## Internationalization

**Current**: English only
**Future**: i18n with next-intl

---

## Default Values Summary

Quick reference for all configurable defaults:

```typescript
// Contract
yesThreshold: 3
noThreshold: 3
voteDuration: 600 seconds (10 min)

// AI
questionCount: 8-10
embeddingDimension: 128
topMatchesShown: 5

// UI
maxWidth: 48rem (768px)
accentColor: hsl(220, 90%, 56%) // Blue
borderRadius: 0.5rem (md)

// Database
profilesPublic: true
chatPollingInterval: 3000ms
```

---

## Files Created & Their Purpose

### Smart Contracts
- `contracts/MatchRegistry.sol`: Main voting contract
- `contracts/DemoDAOToken.sol`: ERC20 for token gating

### Frontend Core
- `src/app/layout.tsx`: Root layout with providers
- `src/app/providers.tsx`: Wagmi + RainbowKit setup
- `src/app/page.tsx`: Landing page
- `src/app/profile/page.tsx`: Profile creation + AI intake
- `src/app/matches/page.tsx`: Browse & propose matches
- `src/app/proposals/page.tsx`: Vote & finalize
- `src/app/chat/[matchId]/page.tsx`: Gated chat

### Components
- `src/components/ui/*.tsx`: Base UI components
- `src/components/IntakeChat.tsx`: AI conversation UI
- `src/components/MatchCard.tsx`: Match display
- `src/components/ProposalCard.tsx`: Proposal + voting
- `src/components/WalletConnect.tsx`: RainbowKit wrapper

### Services & Utils
- `src/services/0gComputeClient.ts`: AI abstraction
- `src/lib/wagmi.ts`: Web3 config
- `src/lib/supabase.ts`: Database client
- `src/lib/contracts.ts`: ABIs + addresses

### Styles
- `src/styles/globals.css`: CSS variables + Tailwind
- `src/styles/tokens.ts`: Design tokens

### Config
- `hardhat.config.ts`: Contract compilation
- `next.config.js`: Next.js setup
- `tailwind.config.ts`: Tailwind theme
- `tsconfig.json`: TypeScript config
- `package.json`: Dependencies

### Database
- `supabase/schema.sql`: Table definitions + RLS
- `supabase/seed.sql`: Demo data

### Scripts
- `scripts/deploy.ts`: Deploy contracts + mint tokens

### Documentation
- `README.md`: Setup + usage
- `IMPLEMENTATION.md`: 3-day checklist
- `TECHNICAL_DECISIONS.md`: This file

---

Last updated: 2026-02-19
