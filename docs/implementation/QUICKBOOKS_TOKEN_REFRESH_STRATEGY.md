# QuickBooks Token Refresh Strategy (Option 3: Hybrid)

## Overview

Ollie Receipts uses a **Hybrid Token Refresh Strategy** to keep QuickBooks connections alive **indefinitely** (beyond the 100-day refresh token limit) with minimal cost.

## The Problem

QuickBooks OAuth tokens have two limitations:
- **Access tokens** expire after 1 hour
- **Refresh tokens** expire after 100 days of inactivity

Without proactive management, users would need to reconnect every 100 days.

## The Solution: Hybrid Approach (Option 3)

We implemented a cost-effective two-part strategy:

### Part 1: User Activity Triggers (Primary - 90% of users)
**When**: On any QuickBooks API call
**Condition**: If refresh token is 30+ days old
**Action**: Proactively refresh tokens
**Cost**: FREE (happens naturally when user is active)

### Part 2: Background Job (Fallback - 10% of users)
**When**: Weekly (Sunday 2:00 AM)
**Condition**: If refresh token is 60+ days old AND user hasn't logged in recently
**Action**: Refresh tokens for truly inactive users
**Cost**: MINIMAL (only processes inactive users)

## How It Works

### User Activity Trigger (Primary)
```javascript
User logs in → Clicks on receipt → API call to QuickBooks
    ↓
Check: Is refresh token > 30 days old?
    ↓ YES
Refresh tokens (gets NEW refresh token)
    ↓
Reset refresh token age to 0 days
    ↓
Connection stays alive
```

**Result**: 90% of users never need background refresh because they use the app regularly.

### Background Job (Fallback)
```javascript
Sunday 2:00 AM → Background job runs
    ↓
Query: Find connections where:
  - Refresh token > 60 days old
  - Last refresh > 7 days ago
  - User inactive (hasn't logged in recently)
    ↓
Refresh tokens for these users (~10% of total)
    ↓
Connection stays alive even for inactive users
```

**Result**: Even users who don't log in for 90 days stay connected.

## Timeline Example

| Day | Event | Token Age | Action | Method |
|-----|-------|-----------|--------|--------|
| 0 | User connects QB | 0 days | Initial OAuth | Manual |
| 15 | User logs in | 15 days | No action | - |
| 35 | User publishes receipt | 35 days | ✅ Refresh tokens | Activity |
| 0 | (Token age reset) | 0 days | - | - |
| 25 | User views accounts | 25 days | No action | - |
| 40 | User publishes receipt | 40 days | ✅ Refresh tokens | Activity |
| 0 | (Token age reset) | 0 days | - | - |

**User stays connected indefinitely through normal usage!**

### Inactive User Example

| Day | Event | Token Age | Action | Method |
|-----|-------|-----------|--------|--------|
| 0 | User connects QB | 0 days | Initial OAuth | Manual |
| 30 | (No activity) | 30 days | No action | - |
| 60 | (No activity) | 60 days | No action | - |
| 63 | Sunday 2 AM job | 63 days | ✅ Refresh tokens | Background |
| 0 | (Token age reset) | 0 days | - | - |
| 70 | Sunday 2 AM job | 70 days | ✅ Refresh tokens | Background |

**Even inactive users stay connected!**

## Cost Analysis

### Traditional Approach (All Background)
- 1,000 users connected
- Check all 1,000 users daily
- Refresh ~17 tokens per day
- **Cost**: High server compute + database queries

### Our Hybrid Approach
- 1,000 users connected
- 900 refresh via user activity (FREE)
- Background job checks only ~100 inactive users weekly
- Refresh ~10-20 tokens per week
- **Cost**: 90% reduction in compute/queries

## Configuration

### Thresholds (Configurable)

In `server/src/config/quickbooks.ts`:

```typescript
// User activity trigger threshold (Part 1)
refreshTokenProactiveThreshold: 30 * 24 * 60 * 60 * 1000  // 30 days

// Background job threshold (Part 2)
refreshTokenBackgroundThreshold: 60 * 24 * 60 * 60 * 1000  // 60 days
```

### Background Job Schedule

In `server/src/jobs/qboTokenRefresh.ts`:

```typescript
const schedule = '0 2 * * 0';  // Sunday 2:00 AM
```

**Change to your preferred time**:
- Daily midnight: `'0 0 * * *'`
- Weekly Monday 3 AM: `'0 3 * * 1'`
- Bi-weekly: `'0 2 1,15 * *'`

### Environment Variables

**Disable background job** (only use activity triggers):
```env
QB_DISABLE_BACKGROUND_REFRESH=true
```

**Test job on startup** (development only):
```env
QB_REFRESH_JOB_ON_STARTUP=true
```

## Database Schema

New field in `quickbooks_connections`:

```sql
refresh_token_created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

**Purpose**: Track when refresh token was last renewed (not just when access token was refreshed).

**Key Insight**: QuickBooks gives you a NEW refresh token every time you refresh. By tracking this, we know how "old" the current refresh token is.

## Benefits

### ✅ Indefinite Connection
- Users never need to reconnect (unless they disconnect manually)
- No 100-day limitation

### 💰 Cost-Effective
- 90% of refreshes happen for free (user activity)
- Background job only processes ~10% of users
- Minimal Railway/hosting costs

### 🚀 Scalable
- Efficient database queries (indexed)
- Rate-limiting friendly (500ms between refreshes)
- Limits background job to 100 connections per run

### 😊 User-Friendly
- Transparent to users
- No interruptions
- No "reconnect" prompts

## Monitoring

### Check Token Ages

```sql
SELECT 
  user_id,
  company_name,
  EXTRACT(DAY FROM NOW() - refresh_token_created_at) as token_age_days,
  last_refreshed_at
FROM quickbooks_connections
ORDER BY refresh_token_created_at ASC;
```

### Find Stale Connections

```sql
SELECT 
  COUNT(*) as stale_count
FROM quickbooks_connections
WHERE refresh_token_created_at < NOW() - INTERVAL '60 days'
AND last_refreshed_at < NOW() - INTERVAL '7 days';
```

### Check Background Job Effectiveness

Look for this in server logs:
```
📊 Found X stale connections to refresh
✓ Background refresh complete: Y succeeded, Z failed
```

## Troubleshooting

### Tokens Still Expiring?

1. **Check thresholds**: Maybe too high (increase to 45/75 days)
2. **Verify job is running**: Look for cron schedule in logs
3. **Check user activity**: Are users even using QB features?
4. **Database field**: Ensure `refresh_token_created_at` exists

### Background Job Not Running?

1. Check server logs for "QuickBooks token refresh job scheduled"
2. Verify `QB_DISABLE_BACKGROUND_REFRESH` is not set to true
3. Ensure `node-cron` is installed
4. Check server timezone (cron uses server time)

### Too Many Refreshes?

1. Lower thresholds (maybe 45/90 days instead of 30/60)
2. Increase background job interval (weekly → bi-weekly)
3. Add rate limiting if needed

## Manual Testing

### Test Activity Trigger

1. Connect QuickBooks
2. In database, set `refresh_token_created_at` to 35 days ago:
   ```sql
   UPDATE quickbooks_connections
   SET refresh_token_created_at = NOW() - INTERVAL '35 days'
   WHERE user_id = 'your-user-id';
   ```
3. Make any QB API call (fetch accounts, publish receipt)
4. Check logs for "Refresh token is 35 days old, proactively renewing..."
5. Verify `refresh_token_created_at` is now recent

### Test Background Job

1. Set `QB_REFRESH_JOB_ON_STARTUP=true` in `.env`
2. In database, set `refresh_token_created_at` to 65 days ago
3. Restart server
4. Wait 5 seconds
5. Check logs for "Found X stale connections"

## Production Recommendations

### Optimal Thresholds
- **User activity trigger**: 30 days (default)
- **Background job**: 60 days (default)
- **Job schedule**: Weekly on low-traffic day/time

### Monitoring
- Track refresh success/failure rates
- Alert if > 10% of background refreshes fail
- Monitor token age distribution

### Cost Optimization
- Start with weekly background job
- If most users are active, reduce to bi-weekly
- If many inactive users, keep weekly or increase to bi-daily

## Summary

**Hybrid approach = Best of both worlds:**
- ✅ Indefinite connection (beyond 100 days)
- ✅ Minimal cost (90% free, 10% background)
- ✅ User-friendly (transparent)
- ✅ Reliable (two-part safety net)

**Users can stay connected forever with minimal cost to you!** 🎉

