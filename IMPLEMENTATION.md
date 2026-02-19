# ChainedTogether - 3-Day Implementation Guide

Detailed day-by-day checklist for building the hackathon MVP.

---

## 📅 Day 1: Foundation (Contracts + Database)

**Goal**: Deploy working smart contracts and setup off-chain infrastructure

### Morning (4 hours)
- [ ] **Setup Project** (30 min)
  - [ ] Run `npm install`
  - [ ] Create `.env` from `.env.example`
  - [ ] Create Supabase project
  - [ ] Get WalletConnect project ID (optional for Day 1)

- [ ] **Smart Contracts** (2 hours)
  - [ ] Review `MatchRegistry.sol` - understand voting logic
  - [ ] Review `DemoDAOToken.sol` - understand token gating
  - [ ] Start Hardhat node: `npm run node`
  - [ ] Run deployment script: `npm run deploy`
  - [ ] Copy contract addresses to `.env`
  - [ ] Test deployment:
    ```bash
    # In Hardhat console
    npx hardhat console --network localhost
    const registry = await ethers.getContractAt("MatchRegistry", "0x...")
    await registry.proposalCount() // Should be 0
    ```

- [ ] **Database Setup** (1.5 hours)
  - [ ] Open Supabase SQL Editor
  - [ ] Run `supabase/schema.sql` - create all tables
  - [ ] Run `supabase/seed.sql` - populate 5 demo profiles
  - [ ] Verify data: `SELECT * FROM profiles;`
  - [ ] Copy Supabase URL and anon key to `.env`
  - [ ] (Optional) Disable RLS for easier demo testing

### Afternoon (4 hours)
- [ ] **Contract Testing** (2 hours)
  - [ ] Write basic test in `test/MatchRegistry.test.ts`:
    - [ ] Test propose match
    - [ ] Test voting (yes/no)
    - [ ] Test early close on threshold
    - [ ] Test finalization after deadline
  - [ ] Run tests: `npm test`
  - [ ] Fix any issues

- [ ] **AI Service Testing** (1 hour)
  - [ ] Review `src/services/0gComputeClient.ts`
  - [ ] Test MOCK implementation locally:
    ```typescript
    import { zeroGClient } from './0gComputeClient';
    const start = await zeroGClient.startIntake();
    console.log(start.agentMessage);
    ```
  - [ ] Verify deterministic question flow
  - [ ] Verify embedding generation works

- [ ] **Frontend Scaffolding** (1 hour)
  - [ ] Create Next.js app structure (if not exists):
    - [ ] `src/app/layout.tsx` - root layout with providers
    - [ ] `src/app/page.tsx` - landing page
  - [ ] Install dependencies: `npm install`
  - [ ] Test dev server: `npm run dev`

**End of Day 1 Deliverable**: Working contracts on localhost + Supabase with seed data

---

## 📅 Day 2: Frontend Core (UI + AI Intake)

**Goal**: Build profile creation, AI intake chat, and match browsing

### Morning (4 hours)
- [ ] **Web3 Setup** (1.5 hours)
  - [ ] Configure wagmi: review `src/lib/wagmi.ts`
  - [ ] Setup RainbowKit providers in root layout
  - [ ] Create `WalletConnect` component
  - [ ] Test wallet connection on landing page

- [ ] **Landing Page** (30 min)
  - [ ] Simple hero section
  - [ ] "Get Started" button → `/profile`
  - [ ] Wallet connect button in nav

- [ ] **Profile Page - Part 1: Form** (2 hours)
  - [ ] Create `src/app/profile/page.tsx`
  - [ ] Basic form fields:
    - [ ] Name (text input)
    - [ ] Age (number input, min 18)
    - [ ] Location (text input)
    - [ ] Image URL (text input for now, or file upload if time)
  - [ ] "Start AI Intake" button (disabled until form valid)
  - [ ] Form validation

### Afternoon (4 hours)
- [ ] **Profile Page - Part 2: AI Intake** (3 hours)
  - [ ] Implement `IntakeChat` component:
    - [ ] Chat UI with agent/user message bubbles
    - [ ] Input field + send button
    - [ ] Integration with `zeroGClient.startIntake()`
    - [ ] Integration with `zeroGClient.nextQuestion()`
    - [ ] Show confirmation screen with summary bullets
    - [ ] "Looks Great" saves to Supabase
    - [ ] "Let Me Edit" continues chat
  - [ ] Store intake messages in Supabase (optional for Day 2)
  - [ ] Generate embedding via `zeroGClient.embedProfile()`
  - [ ] Save complete profile to Supabase:
    ```typescript
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        wallet_address,
        name,
        age,
        location,
        image_url,
        answers_json: extracted,
        embedding: embedding,
      });
    ```

- [ ] **Test Profile Creation** (1 hour)
  - [ ] Connect wallet
  - [ ] Fill form
  - [ ] Complete AI intake (answer 6-8 questions)
  - [ ] Confirm summary
  - [ ] Verify profile saved in Supabase
  - [ ] Test "edit" flow

**End of Day 2 Deliverable**: Working profile creation with AI intake chat

---

## 📅 Day 3: Integration + Polish

**Goal**: Connect everything - matching, proposals, voting, chat

### Morning (4 hours)
- [ ] **Matches Page** (2.5 hours)
  - [ ] Create `src/app/matches/page.tsx`
  - [ ] Fetch current user's profile + embedding
  - [ ] Fetch all other profiles from Supabase
  - [ ] Rank matches via `zeroGClient.rankMatches()`
  - [ ] Display top 5 matches using `MatchCard`
  - [ ] "Propose Match" button:
    - [ ] Generate `aiScoreHash` and `metadataHash`
    - [ ] Call `matchRegistry.proposeMatch()` via wagmi
    - [ ] Show transaction status
    - [ ] Redirect to `/proposals` on success

- [ ] **Test Matching Flow** (1.5 hours)
  - [ ] Create profile A
  - [ ] Browse matches
  - [ ] Propose match to profile B (from seed data)
  - [ ] Check transaction on Hardhat console
  - [ ] Verify proposal exists: `matchRegistry.getProposal(0)`

### Afternoon (4 hours)
- [ ] **Proposals Page** (2 hours)
  - [ ] Create `src/app/proposals/page.tsx`
  - [ ] Fetch proposals involving user:
    - [ ] Listen to `MatchProposed` events
    - [ ] Or iterate `proposalCount` and filter
  - [ ] Display using `ProposalCard` component
  - [ ] Implement voting:
    - [ ] Check `canVote()` contract method
    - [ ] Call `vote(matchId, support)` via wagmi
    - [ ] Show live vote counts
  - [ ] Implement finalize:
    - [ ] Check if deadline passed
    - [ ] Call `finalize(matchId)`
    - [ ] Update status display

- [ ] **Chat Page** (1.5 hours)
  - [ ] Create `src/app/chat/[matchId]/page.tsx`
  - [ ] Check on-chain approval:
    ```typescript
    const isApproved = await matchRegistry.isMatchApproved(matchId);
    if (!isApproved) return <div>Match not approved</div>;
    ```
  - [ ] Get proposal to find userA and userB
  - [ ] Verify current user is participant
  - [ ] Fetch profiles for ONLY name/age/location/image
  - [ ] Build chat UI:
    - [ ] Display other person's basic info (card at top)
    - [ ] Chat messages from Supabase
    - [ ] Input field to send messages
    - [ ] Save messages to Supabase:
      ```typescript
      await supabase.from('chats').insert({
        match_id: matchId,
        sender: walletAddress,
        message: text,
      });
      ```
  - [ ] Real-time updates (use Supabase subscriptions or polling)

- [ ] **End-to-End Testing** (30 min)
  - [ ] Full flow test:
    1. Create profile with wallet A
    2. Propose match to seed profile
    3. Switch to voter wallet (with DAO tokens)
    4. Vote Yes until threshold hit
    5. Verify early close (status = APPROVED)
    6. Go to `/chat/0`
    7. Send messages back and forth

**End of Day 3 Deliverable**: Working end-to-end MVP

---

## 🔧 Optional Enhancements (if time permits)

### Polish (pick 1-2)
- [ ] Add loading states and spinners
- [ ] Add error toasts (react-hot-toast)
- [ ] Add profile page indicator (if user has profile, show "Edit Profile")
- [ ] Add proposal countdown timer
- [ ] Add "My Matches" tab (approved matches only)
- [ ] Style landing page with hero + features
- [ ] Add 404 page
- [ ] Add SEO meta tags

### Advanced Features (Day 4+)
- [ ] Image upload to IPFS or Supabase Storage
- [ ] Real-time chat via Supabase subscriptions
- [ ] Notification system (proposal status changes)
- [ ] "Mutual interest" indicator (both proposed each other)
- [ ] Stake mechanism (require ETH stake to propose)
- [ ] Analytics dashboard (total matches, vote participation)

---

## 🚀 Pre-Demo Checklist

Before presenting:
- [ ] Deploy to testnet (Sepolia)
- [ ] Update `.env` with testnet addresses
- [ ] Seed testnet Supabase with demo profiles
- [ ] Test entire flow on testnet
- [ ] Prepare 3-5 demo wallets with DAO tokens
- [ ] Clear browser cache/localStorage
- [ ] Record 2-3 min demo video
- [ ] Write pitch (1 min verbal intro)
- [ ] Deploy frontend to Vercel
- [ ] Test live site

---

## ⚠️ Common Issues & Solutions

### Contract Issues
- **"Transaction reverted"**: Check if you have DAO tokens for voting
- **"Proposal not found"**: Verify `proposalCount` and use valid ID
- **Can't finalize**: Must wait until deadline passes

### Frontend Issues
- **Wallet won't connect**: Check network (must be localhost or Sepolia)
- **"Missing environment variables"**: Verify all `.env` vars are set
- **Supabase RLS blocking**: Disable RLS for demo or fix policies

### AI Issues
- **Questions repeat**: Check `questionIndex` increment in mock
- **No embedding generated**: Verify profile extraction logic
- **All matches have same score**: Check embedding normalization

---

## 📝 Demo Script Template

**Intro (30 sec)**
"ChainedTogether is an AI-powered matchmaking dApp where community votes decide which matches happen. Privacy-first: your full profile is never shared publicly."

**Demo (2 min)**
1. Connect wallet → Create profile
2. AI asks adaptive questions → Confirm summary
3. Browse AI-ranked matches → Propose match
4. Switch to voter wallet → Vote yes
5. Watch early close when threshold hit
6. Open chat → Send message

**Tech highlights (30 sec)**
"Built with Solidity for on-chain voting, 0g compute for AI matching, Supabase for off-chain data, and wagmi for Web3 UX. Fully working MVP in 3 days."

**Q&A**
- Privacy: "Profile JSON never shown to matches, only basic info after approval"
- Scalability: "DAO voting could be replaced with ZK proofs for production"
- Revenue: "Could add proposal fees or premium features"

---

Good luck! 🚀
