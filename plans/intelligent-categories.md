# Intelligent Category System — Implementation Plan

## Context

Currently, QuickBooks categories (expense accounts) are fetched live from the QB API every time a user opens a receipt for review. There's no local cache, no memory of past categorization choices, and no automation. Every receipt requires manual category selection.

This plan introduces a 3-phase system that:
1. Caches QB categories locally and displays them in a new Account page
2. Adds vendor-to-category rules that learn from bookkeeper behavior
3. Auto-applies rules to incoming receipts so categorization is hands-free

---

## Phase 1: Category Caching + Account Page

**Goal:** Cache QB categories in the database, sync on login, and add an "Account" tab with a Categories view.

### Database

**New table: `qb_categories`** — Local cache of QB Chart of Accounts

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `uuid_generate_v4()` |
| `user_id` | UUID FK → users | ON DELETE CASCADE |
| `qb_account_id` | TEXT | The QB account ID |
| `name` | TEXT | Account name from QB |
| `account_type` | TEXT | e.g. "Expense" |
| `account_sub_type` | TEXT | e.g. "SuppliesMaterials", nullable |
| `active` | BOOLEAN | `true` = exists in QB, `false` = deleted/deactivated |
| `last_synced_at` | TIMESTAMP | When this row was last confirmed from QB |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | Auto-updated via trigger |

- `UNIQUE(user_id, qb_account_id)` — Enables upsert during sync
- Reuses existing `update_updated_at_column()` trigger function

**File:** `server/src/db/schema.sql` (append new table)

### Backend

**New service:** `server/src/services/categorySyncService.ts`
- `syncCategories(userId)` — Fetches from QB via existing `fetchExpenseAccounts()`, upserts into `qb_categories`, deactivates categories no longer in QB
- `getCachedCategories(userId)` — Returns all active cached categories for user

**New controller:** `server/src/controllers/categoryController.ts`
- `GET /api/categories` — Returns cached categories
- `POST /api/categories/sync` — Triggers a QB sync, returns stats (synced/added/deactivated)

**New routes:** `server/src/routes/categories.ts`
- Register in `server/src/index.ts`

### Frontend

**New component:** `src/components/AccountPage.tsx`
- Displays all cached QB categories grouped by `subType`
- "Sync now" button to manually trigger re-sync
- Shows last synced timestamp
- Empty state when QB not connected
- Follows design system (CSS custom properties, no Tailwind)

**Modified:** `src/App.tsx`
- Extend `activeTab` type to include `'account'`
- Add "Account" tab on the far right of the tab bar (using `margin-left: auto`)
- Add `cachedCategories` state + `isSyncingCategories` state
- Trigger `POST /api/categories/sync` on login when QB is connected (background, non-blocking)
- Render `AccountPage` when account tab is active

**Modified:** `src/services/apiService.ts`
- Add `categoryApi` with `getAll()` and `sync()` methods

**Modified:** `src/components/ReceiptReview.tsx`
- Accept optional `cachedCategories` prop
- Use cached categories for the expense account dropdown when available (fall back to live fetch)
- Fix existing bug: `accounts` → `expenseAccounts` on line 297

### Key files to modify
- `server/src/db/schema.sql`
- `server/src/index.ts` (register new route)
- `src/App.tsx`
- `src/services/apiService.ts`
- `src/components/ReceiptReview.tsx`

### Key files to create
- `server/src/services/categorySyncService.ts`
- `server/src/controllers/categoryController.ts`
- `server/src/routes/categories.ts`
- `src/components/AccountPage.tsx`

### Verification
1. Connect QB account → categories sync automatically in background
2. Open Account tab → categories displayed grouped by sub-type
3. Click "Sync now" → stats shown (X synced, X new, X deactivated)
4. Open a receipt for review → category dropdown populated from cache (no QB API call)
5. Add/remove a category in QB, re-sync → local cache updates correctly

---

## Phase 2: Category Rules + Bookkeeper Learning

**Goal:** When a bookkeeper changes a receipt's category, prompt them to create a rule. Display and manage rules in the Account page.

### Database

**New table: `category_rules`** — Vendor-to-category mappings

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `vendor_pattern` | TEXT | Vendor name or pattern to match |
| `qb_category_id` | UUID FK → qb_categories | Target category |
| `match_type` | TEXT | `'exact'` or `'contains'` |
| `created_from_receipt_id` | UUID FK → receipts | Nullable — which receipt triggered rule creation |
| `is_active` | BOOLEAN | Default `true` |
| `times_applied` | INTEGER | Default `0` — tracks how often the rule fires |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

- `UNIQUE(user_id, vendor_pattern, qb_category_id)` — Prevents duplicate rules

### Backend

**New controller:** `server/src/controllers/categoryRulesController.ts`
- `GET /api/category-rules` — List all rules for user
- `POST /api/category-rules` — Create a new rule
- `PATCH /api/category-rules/:id` — Update (e.g. change category, toggle active)
- `DELETE /api/category-rules/:id` — Delete a rule
- `POST /api/category-rules/match` — Given a `vendorName`, return the best matching rule + category

**New routes:** `server/src/routes/categoryRules.ts`

### Frontend

**Modified:** `src/components/AccountPage.tsx`
- Add "Rules" section below Categories
- Each rule shows: vendor pattern → category name, match type, times applied
- Add/edit/delete rule controls
- Under each category in the Categories section, show associated vendor rules

**Modified:** `src/components/ReceiptReview.tsx`
- After publishing: if vendor has no existing rule, show a prompt:
  > "Always categorize **[vendor]** as **[category]**? Create rule?"
- If vendor has an existing rule but the user overrode it, show:
  > "Update the rule for **[vendor]** to **[new category]**?"
- Non-blocking — the prompt appears as a toast/banner, not a modal

**Modified:** `src/services/apiService.ts`
- Add `categoryRulesApi` with CRUD methods + `match(vendorName)`

### Verification
1. Publish a receipt for "Starbucks" under "Meals" → prompt appears to create rule
2. Accept → rule created, visible in Account page under Rules section
3. Next "Starbucks" receipt → category auto-suggested (Phase 3 applies it)
4. Override the category → prompt to update rule
5. Manage rules in Account page (edit, delete, toggle active)

---

## Phase 3: Auto-Apply Rules + Intelligence

**Goal:** Automatically apply matching rules to incoming receipts so the bookkeeper doesn't have to manually categorize known vendors.

### Backend

**New service logic in:** `server/src/services/categoryRulesService.ts`
- `findMatchingRule(userId, vendorName)` — Checks rules in priority order:
  1. Exact match on vendor name
  2. Contains match
- Returns the matched rule + category, or null
- Increments `times_applied` counter when a rule fires

**Modified:** Receipt creation flow
- After OCR extraction sets `vendor_name`, call `findMatchingRule()`
- If match found, auto-set `qb_account_id` on the receipt
- Set a new field `auto_categorized` (BOOLEAN) so the UI knows it was auto-applied

### Database

**Modified:** `receipts` table
- Add `auto_categorized BOOLEAN DEFAULT false` — Flags receipts that were auto-categorized by a rule

### Frontend

**Modified:** `src/components/ReceiptReview.tsx`
- If `auto_categorized` is true, show an indicator next to the category:
  > "Auto-categorized by rule: [vendor] → [category]"
- User can still override (which triggers the Phase 2 rule update prompt)

**Modified:** `src/components/AccountPage.tsx`
- Add analytics section showing:
  - Total rules, total times rules fired
  - Most active rules
  - Categories with no rules (opportunities for new rules)

**Modified:** `src/components/ReceiptUpload.tsx` (or the OCR processing flow)
- After Gemini OCR extracts data, call backend to check for matching rule
- If match found, pre-populate `qb_account_id` before saving receipt

### Verification
1. Create rule: "Apple" → "Assets"
2. Upload Apple receipt → OCR extracts vendor "Apple" → rule matches → `qb_account_id` auto-set to Assets
3. Open receipt for review → see "Auto-categorized" indicator, category already selected
4. Override if needed → prompted to update rule
5. Account page shows rule analytics (times applied counter incremented)

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Soft-deactivate categories (not hard-delete) | Future rules may reference deactivated categories; prevents FK violations |
| Sync on login (not real-time webhook) | QB doesn't offer reliable webhooks for chart of accounts changes; login sync is sufficient |
| Background sync (non-blocking) | Doesn't slow down initial page load; categories appear shortly after |
| Cache in DB (not localStorage) | Shared across devices, available for server-side rule matching |
| Rules use vendor patterns (not receipt IDs) | Rules apply to future receipts from the same vendor, not just the one that created the rule |
| `match_type` field for flexible matching | Supports both exact "Apple Inc." and contains "apple" matching |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Neon SQL `IN` clause syntax | Test with `ANY(array)` PostgreSQL syntax as fallback |
| QB API rate limits on sync | Single query per sync; very lightweight |
| Stale cache after QB changes | Sync on every login + manual "Sync now" button |
| Rule conflicts (multiple rules match) | Exact match takes priority over contains; first match wins |
| Large number of categories | Grouped by sub-type for scannability; pagination if needed later |
