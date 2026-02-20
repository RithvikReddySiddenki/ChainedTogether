# ChainedTogether - Deployment Guide (Continuous Matching System)

## 🎉 New Architecture Complete!

Your app now has a **fully automated, continuous matching system** that:
- ✅ Always keeps 50-75 matches in the generation queue
- ✅ Maintains 10-12 active voting proposals
- ✅ Never runs out of matches for users to vote on
- ✅ Auto-expires and finalizes proposals
- ✅ Prevents duplicate pairs
- ✅ Scales cleanly

---

## 📋 Complete Setup (From Scratch)

### Step 1: Database Migration

Run the new complete schema in Supabase:

1. Open **Supabase SQL Editor**
2. Copy entire file: `supabase/migrations/001_complete_schema.sql`
3. Paste and **Run**
4. Verify tables created: `match_proposals`, `voter_assignments`, `match_votes`, `match_generation_queue`, `conversations`

**Expected output**: "Schema migration completed successfully!"

---

### Step 2: Seed Profiles (If Needed)

If you don't have profiles yet:

```bash
# Run in Supabase SQL Editor
# File: supabase/seed.sql (from earlier)
```

You need **at least 10-15 profiles** for the system to work well (10 voters + matched pairs).

---

### Step 3: Deploy Contracts (Already Done Earlier)

If you haven't redeployed with 5/10 thresholds:

```bash
# Terminal 1
npx hardhat node

# Terminal 2
npx hardhat run scripts/deploy.ts --network localhost

# Update .env with new addresses
NEXT_PUBLIC_MATCH_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_DAO_TOKEN_ADDRESS=0x...
```

---

### Step 4: Start Background Jobs

The background jobs ensure continuous match generation. You have two options:

#### Option A: Development (Simple)

Create a new file to run jobs:

```typescript
// scripts/run-jobs.ts
import { startJobs } from '../src/services/matchLifecycleJobs';

console.log('Starting ChainedTogether background jobs...');
startJobs();

// Keep process alive
process.on('SIGINT', () => {
  console.log('\nShutting down jobs...');
  process.exit(0);
});
```

Then run:
```bash
npx ts-node scripts/run-jobs.ts
```

#### Option B: Production (PM2)

```bash
# Install PM2
npm install -g pm2

# Create PM2 config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'chained-jobs',
    script: 'scripts/run-jobs.ts',
    interpreter: 'npx',
    interpreter_args: 'ts-node',
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
}
EOF

# Start jobs
pm2 start ecosystem.config.js

# Monitor
pm2 logs chained-jobs
```

---

### Step 5: Verify System Health

After starting jobs (wait 1-2 minutes), check Supabase:

```sql
-- Check queue depth (should be 50+)
SELECT COUNT(*) FROM match_generation_queue WHERE consumed_at IS NULL;

-- Check active voting (should be 10-12)
SELECT COUNT(*) FROM match_proposals WHERE status = 'voting';

-- Check voter assignments
SELECT COUNT(*) FROM voter_assignments;

-- View recent metrics
SELECT * FROM system_metrics ORDER BY recorded_at DESC LIMIT 10;
```

---

### Step 6: Start Frontend

```bash
npm run dev
```

Navigate to: **http://localhost:3000/vote**

---

## 🧪 Testing the Continuous System

### Test 1: Verify Queue Never Empties

```bash
# Watch queue in real-time
watch -n 5 'psql $DATABASE_URL -c "SELECT COUNT(*) as queue_depth FROM match_generation_queue WHERE consumed_at IS NULL"'
```

**Expected**: Queue stays between 50-75 at all times

---

### Test 2: Verify Proposals Auto-Create

```bash
# Watch active proposals
watch -n 5 'psql $DATABASE_URL -c "SELECT COUNT(*) as active_voting FROM match_proposals WHERE status = '\''voting'\''"'
```

**Expected**: Active proposals stay between 10-12

---

### Test 3: Verify Users Always Have Matches

1. Connect as any wallet
2. Go to `/vote`
3. Vote on a match
4. **Immediately** you should see another match
5. Repeat 20 times
6. Should **never** see "no matches available"

---

### Test 4: Verify Expiration Handling

1. Find a proposal in voting with expiration time
2. Wait for expiration
3. Within 1 minute, status should change to approved/rejected
4. If approved, conversation should be created

---

### Test 5: Verify No Duplicates

```bash
# Check for duplicate pairs
psql $DATABASE_URL -c "
SELECT pair_hash, COUNT(*) as count
FROM (
  SELECT pair_hash FROM match_proposals WHERE status NOT IN ('rejected', 'expired')
  UNION ALL
  SELECT pair_hash FROM match_generation_queue WHERE consumed_at IS NULL
) combined
GROUP BY pair_hash
HAVING COUNT(*) > 1
"
```

**Expected**: No results (no duplicates)

---

## 📊 Monitoring Dashboard

### Key Metrics Query

```sql
SELECT
  (SELECT COUNT(*) FROM match_generation_queue WHERE consumed_at IS NULL) as queue_depth,
  (SELECT COUNT(*) FROM match_proposals WHERE status = 'voting') as active_voting,
  (SELECT COUNT(*) FROM match_proposals WHERE status = 'approved') as total_approved,
  (SELECT COUNT(*) FROM match_proposals WHERE status = 'rejected') as total_rejected,
  (SELECT COUNT(*) FROM voter_assignments) as total_voters_assigned,
  (SELECT COUNT(*) FROM match_votes) as total_votes_cast;
```

### Health Check

```sql
-- System is healthy if:
-- 1. Queue depth > 50
-- 2. Active voting between 10-15
-- 3. No stuck proposals (voting status but expired > 5 min ago)

SELECT
  CASE
    WHEN queue_depth >= 50
      AND active_voting >= 10
      AND stuck_proposals = 0
    THEN 'HEALTHY'
    ELSE 'UNHEALTHY'
  END as system_status,
  queue_depth,
  active_voting,
  stuck_proposals
FROM (
  SELECT
    (SELECT COUNT(*) FROM match_generation_queue WHERE consumed_at IS NULL) as queue_depth,
    (SELECT COUNT(*) FROM match_proposals WHERE status = 'voting') as active_voting,
    (SELECT COUNT(*) FROM match_proposals
     WHERE status = 'voting'
     AND voting_expires_at < NOW() - INTERVAL '5 minutes') as stuck_proposals
) metrics;
```

---

## 🔧 Troubleshooting

### Issue: Queue Keeps Emptying

**Cause**: Match generator job not running or profiles insufficient

**Fix**:
```bash
# Check job is running
ps aux | grep run-jobs

# Check profile count
psql $DATABASE_URL -c "SELECT COUNT(*) FROM profiles"

# Manually trigger generation
npm run tsx scripts/generate-matches.ts
```

---

### Issue: No Active Proposals

**Cause**: Proposal creator job not running or queue empty

**Fix**:
```bash
# Check queue has matches
psql $DATABASE_URL -c "SELECT COUNT(*) FROM match_generation_queue WHERE consumed_at IS NULL"

# Manually run proposal creator
# In psql or code, call proposalCreatorJob()
```

---

### Issue: Proposals Stuck in Voting

**Cause**: Expiration handler not running

**Fix**:
```bash
# Manually finalize expired proposals
psql $DATABASE_URL -c "
UPDATE match_proposals
SET status = CASE
  WHEN yes_votes > no_votes THEN 'approved'
  ELSE 'rejected'
END,
finalized_at = NOW()
WHERE status = 'voting'
AND voting_expires_at < NOW()
"
```

---

### Issue: Duplicates Created

**Cause**: Race condition or pair_hash collision

**Fix**:
```bash
# Find duplicates
psql $DATABASE_URL -c "
SELECT user_a_address, user_b_address, COUNT(*)
FROM match_proposals
WHERE status NOT IN ('rejected', 'expired')
GROUP BY user_a_address, user_b_address
HAVING COUNT(*) > 1
"

# Manually delete extras (keep oldest)
```

---

## 🚀 Production Deployment

### 1. Environment Variables

```bash
# .env
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_MATCH_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_DAO_TOKEN_ADDRESS=0x...

# For jobs
SUPABASE_URL=https://...
SUPABASE_KEY=... # Service role key (has write access)
```

---

### 2. Deploy Jobs (Separate Service)

Option A: **Vercel Cron** (if using Vercel)
```typescript
// pages/api/cron/match-generator.ts
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  await matchGeneratorJob();
  return res.json({ success: true });
}
```

Option B: **Railway / Render** (separate worker)
- Deploy as separate Node.js service
- Run `scripts/run-jobs.ts` as main process
- Set restart policy: always

Option C: **AWS Lambda / Cloud Functions**
- Deploy each job as separate function
- Set up CloudWatch Events / Cloud Scheduler to trigger

---

### 3. Monitoring

Set up alerts for:
- Queue depth < 30 (warning)
- Active voting < 5 (critical)
- No metrics recorded in 10 minutes (job down)

---

## 📈 Scaling Considerations

### Small Scale (<1000 users)
- Single database instance
- Jobs run every 1-5 minutes
- Keep 50 queue, 10 active

### Medium Scale (1000-10000 users)
- Read replica for queries
- Jobs run every 30 seconds
- Keep 200 queue, 50 active
- Add caching (Redis)

### Large Scale (>10000 users)
- Partitioned tables
- Distributed job workers
- Keep 1000 queue, 200 active
- Message queue (RabbitMQ/SQS)

---

## ✅ Verification Checklist

Before launching:

- [ ] Schema migrated successfully
- [ ] Profiles exist (minimum 15)
- [ ] Background jobs running
- [ ] Queue depth > 50
- [ ] Active voting > 10
- [ ] Users can vote continuously
- [ ] Proposals expire and finalize
- [ ] No duplicate pairs
- [ ] Conversations unlock on approval
- [ ] Monitoring dashboard works

---

## 🎬 Demo Flow

1. **Show continuous system**:
   - Open terminal showing queue depth
   - Show it stays at 50-75 constantly

2. **Demo voting**:
   - Connect wallet
   - Vote on 10 matches back-to-back
   - Never runs out

3. **Show approval**:
   - Vote yes 5 times on same match (different wallets)
   - Auto-approves
   - Conversation unlocks

4. **Show metrics**:
   - Run health check query
   - Show "HEALTHY" status

---

You now have a **production-ready, self-sustaining matchmaking system**! 🎉
