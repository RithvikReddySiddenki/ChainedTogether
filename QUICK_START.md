# ChainedTogether - Quick Start Guide (UPDATED FLOW)

## 🎉 Major Changes Complete!

I've redesigned the app to match your **crowdsourced matchmaking DAO** model where users vote on OTHER people's potential matches.

---

## ✅ What Changed

### OLD Flow (WRONG):
- User browses matches FOR THEMSELVES
- User proposes match with someone THEY want to date
- DAO votes on whether user can date that person

### NEW Flow (CORRECT):
- AI generates match PAIRS from all users
- Users vote on whether OTHER people make a good match
- Need 5/10 yes votes to approve a match
- Both matched users get notified and can chat

---

## 🚀 Next Steps to Test

### Step 1: Redeploy Contracts (Required!)

The contracts now need 5 yes votes instead of 3. **You must redeploy:**

**Terminal 1** (if not still running):
```bash
npx hardhat node
```

**Terminal 2**:
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

**IMPORTANT**: Copy the NEW contract addresses and update your `.env` file!

```bash
# Update these in .env
NEXT_PUBLIC_MATCH_REGISTRY_ADDRESS=0x... (new address)
NEXT_PUBLIC_DAO_TOKEN_ADDRESS=0x... (new address)
```

---

### Step 2: Setup Voter Assignment Table

Run this in **Supabase SQL Editor**:

```bash
# File location: supabase/voter_assignment.sql
```

Open the file, copy all contents, paste into Supabase SQL Editor, and run it.

---

### Step 3: Restart Frontend

**Terminal 3** (or wherever your frontend is running):

Press `Ctrl+C` to stop, then:
```bash
npm run dev
```

---

### Step 4: Generate Match Proposals (Admin)

Now you need to generate some match proposals. Run this script:

```bash
npx hardhat run scripts/generate-matches.ts --network localhost
```

This will:
- Fetch all profiles from Supabase
- Generate top 3 match pairs based on AI compatibility
- Create proposals on-chain
- Assign 10 random voters to each match

---

### Step 5: Test the New Flow!

#### A. Create More Profiles (Optional)

To get better matches, create 2-3 more profiles:
1. Go to http://localhost:3000
2. Connect with different Hardhat wallets (use accounts #1, #2, #3)
3. Create profiles with different interests
4. Then re-run `generate-matches.ts`

#### B. Vote on Matches

1. Go to http://localhost:3000/vote
2. Connect wallet (use any of the first 10 Hardhat accounts)
3. You'll see matches assigned to you
4. Vote YES or NO on each match
5. See Tinder-style cards with two profiles side by side

#### C. Test Approval

To approve a match, you need 5/10 yes votes:
1. Generate a match (script assigns 10 voters)
2. Connect as 5 different voter wallets
3. Each votes YES
4. After 5th yes vote, match auto-approves (early close)
5. Both matched users can now chat

---

## 📱 New UI Pages

### `/profile` - Create Profile (unchanged)
- Upload image
- AI intake chat
- Confirm and save

### `/vote` - NEW! Vote on Matches
- Tinder-style cards
- Shows two profiles side by side
- Vote YES or NO
- Can't vote on your own matches
- Progress indicator

### `/chat/[matchId]` - Chat (updated)
- Only accessible if match is APPROVED
- Only for users involved in the match
- Shows basic info (name/age/location/image)

### `/matches` and `/proposals` - DEPRECATED
- Old pages, no longer used in new flow
- Can delete or repurpose later

---

## 🎯 Complete Test Flow

### Scenario: Approve a Match

1. **Setup** (one time):
   - Redeploy contracts ✅
   - Add voter table to Supabase ✅
   - Restart frontend ✅

2. **Create profiles**:
   - Connect as Account #0, create profile A
   - Connect as Account #1, create profile B
   - Connect as Account #2, create profile C
   - (Use seed data for others if needed)

3. **Generate matches**:
   ```bash
   npx hardhat run scripts/generate-matches.ts --network localhost
   ```
   - Creates match between A & B (example)
   - Assigns voters: Accounts #3-12

4. **Vote** (need 5 yes votes):
   - Connect as Account #3, go to /vote, vote YES
   - Connect as Account #4, go to /vote, vote YES
   - Connect as Account #5, go to /vote, vote YES
   - Connect as Account #6, go to /vote, vote YES
   - Connect as Account #7, go to /vote, vote YES
   - **Match auto-approves!** (early close)

5. **Chat**:
   - Connect as Account #0 (user A)
   - Go to /chat/0
   - See profile B's basic info
   - Send messages
   - Switch to Account #1 (user B), reply

---

## 🔧 Key Files Changed

### Smart Contracts:
- `scripts/deploy.ts` - Changed thresholds to 5/5
- `scripts/generate-matches.ts` - NEW admin script

### Database:
- `supabase/voter_assignment.sql` - NEW table for voter tracking

### AI Service:
- `src/services/0gComputeClient.ts` - Added `generateMatchPairs()` function

### Frontend:
- `src/components/VotingCard.tsx` - NEW Tinder-style card
- `src/app/vote/page.tsx` - NEW voting feed
- `src/app/page.tsx` - Updated links

---

## 🐛 Troubleshooting

### "No matches assigned to you"
- Run `generate-matches.ts` first to create proposals
- Make sure you have profiles in Supabase
- Check `match_voters` table to see assignments

### "Contract address not found"
- Did you redeploy and update .env?
- Restart frontend after updating .env

### "Not enough voters"
- Need at least 10 profiles total to assign 10 voters
- Generate more profiles or adjust script to use fewer voters

### Votes not registering
- Check you have DAO tokens (first 10 accounts should)
- Make sure you're not voting on your own match
- Check Hardhat node is still running

---

## 📊 Current State

- ✅ Smart contracts updated (5/10 threshold)
- ✅ Voter assignment system created
- ✅ AI pair generation implemented
- ✅ Match generation script created
- ✅ Voting feed UI built
- ✅ Navigation updated

---

## 🎬 Demo for Hackathon

1. Show profile creation with AI chat
2. Run match generation script (show terminal)
3. Demo voting feed (swipe through matches)
4. Show approval happening live
5. Show chat unlocking for matched users

---

Need help? Check the terminal output or Supabase tables to debug!
