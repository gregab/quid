# Handoff: App Store Setup Tasks

**Created:** 2026-02-26
**Context:** Pre-implementation audit of 5 tasks for mobile app store readiness. The mobile app (`mobile/`) does not exist yet — only the plan (`PLAN-react-native.md`) exists.

---

## Task Status Summary

| # | Task | Status | Effort |
|---|------|--------|--------|
| 1 | Add privacy/terms screens | **Already done** on web. Need mobile WebView wrapper. | ~30 min |
| 2 | Add expo-updates to dependencies | Needs mobile scaffold first | ~10 min (after scaffold) |
| 3 | Fix app store metadata in app.json | Needs mobile scaffold first | ~30 min |
| 4 | Wire up login `?next=` param | **Already fully wired up** | 0 min |
| 5 | Add recurring expenses to mobile | Needs mobile scaffold + full screens | ~4-6 hrs |

---

## Task 1: Privacy/Terms Screens — ALREADY DONE

Web pages already exist and are production-quality:

- **Privacy Policy:** `app/(legal)/privacy/page.tsx` — 318 lines, comprehensive (CCPA, data retention, breach notification, etc.)
- **Terms of Service:** `app/(legal)/terms/page.tsx` — 400 lines, comprehensive (financial disclaimer, arbitration, indemnification, etc.)
- **Live URLs:** `https://aviary.gregbigelow.com/privacy` and `https://aviary.gregbigelow.com/terms`
- **Last updated:** February 22, 2026

**For mobile app store submission:** These URLs can be referenced directly in `app.json` and in app store metadata. No additional web pages needed.

**For in-app access from mobile:** When the mobile app is built, add a simple WebView screen or use `Linking.openURL()` to open these in the browser. The simplest approach:

```tsx
// mobile/app/privacy.tsx
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";

export default function Privacy() {
  useEffect(() => {
    Linking.openURL("https://aviary.gregbigelow.com/privacy");
    router.back();
  }, []);
  return null;
}
```

Or use `expo-web-browser` for an in-app browser experience (recommended for app store reviewers):
```tsx
import * as WebBrowser from "expo-web-browser";
```

---

## Task 2: Add expo-updates — Needs Mobile Scaffold

`expo-updates` is referenced in `PLAN-react-native.md` (Phase 11) but no `mobile/` directory exists yet. When creating the mobile scaffold:

**Add to `mobile/package.json` dependencies:**
```json
{
  "expo-updates": "~0.28.x"
}
```

**Configure in `mobile/app.json`:**
```json
{
  "expo": {
    "updates": {
      "enabled": true,
      "url": "https://u.expo.dev/<project-id>",
      "fallbackToCacheTimeout": 0,
      "checkAutomatically": "ON_LOAD"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

**Note:** The Expo project ID needs to be created via `npx expo init` or `eas init`. This generates the URL for OTA updates.

---

## Task 3: App Store Metadata in app.json — Needs Mobile Scaffold

When creating `mobile/app.json`, include complete app store metadata:

```json
{
  "expo": {
    "name": "Aviary",
    "slug": "aviary",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "aviary",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#faf9f7"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.gregbigelow.aviary",
      "buildNumber": "1",
      "infoPlist": {
        "NSCameraUsageDescription": "Aviary uses your camera to take profile pictures and group banner photos.",
        "NSPhotoLibraryUsageDescription": "Aviary accesses your photo library to set profile pictures and group banners."
      },
      "config": {
        "usesNonExemptEncryption": false
      },
      "privacyManifests": {
        "NSPrivacyAccessedAPITypes": []
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#faf9f7"
      },
      "package": "com.gregbigelow.aviary",
      "versionCode": 1,
      "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE"]
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-font",
      "expo-haptics"
    ],
    "experiments": {
      "typedRoutes": true
    },
    "updates": {
      "enabled": true,
      "fallbackToCacheTimeout": 0,
      "checkAutomatically": "ON_LOAD"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    },
    "extra": {
      "eas": {
        "projectId": "<TO_BE_GENERATED>"
      },
      "privacyPolicyUrl": "https://aviary.gregbigelow.com/privacy",
      "termsOfServiceUrl": "https://aviary.gregbigelow.com/terms"
    }
  }
}
```

**App Store Connect metadata needed (not in app.json, submitted via EAS or manually):**
- **Description:** "Aviary is a friendly expense-splitting app. Create groups, add shared expenses, and see simplified debts — so everyone knows who owes what. Split equally, by custom amounts, or by percentage. Record payments, track activity, and export to Excel. Designed to make splitting costs easy and joyful."
- **Keywords:** expense splitter, split bills, group expenses, debt tracker, IOU, shared costs, roommate expenses
- **Category:** Finance
- **Age rating:** 4+ (no objectionable content)
- **Privacy Policy URL:** `https://aviary.gregbigelow.com/privacy`
- **Support URL:** `https://groups.google.com/g/aviary-support`

**Also create `mobile/eas.json`:**
```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "<APPLE_ID>",
        "ascAppId": "<ASC_APP_ID>",
        "appleTeamId": "<TEAM_ID>"
      }
    }
  }
}
```

---

## Task 4: Wire Up Login `?next=` Param — ALREADY DONE

The `?next=` parameter is **fully wired up** across the entire auth flow. Here's the complete chain:

### Flow: Unauthenticated user clicks invite link

1. **Invite page** (`app/invite/[token]/page.tsx:80-104`) — If user is not authenticated, shows "Sign in to join" link:
   ```tsx
   <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>
   ```

2. **Login page** (`app/(auth)/login/page.tsx:13,31`) — Reads `?next=` and redirects after successful auth:
   ```tsx
   const next = searchParams.get("next");
   // ... after successful login:
   router.push(next ?? "/dashboard");
   ```

3. **Signup page** (`app/(auth)/signup/page.tsx:12,40-42`) — Passes `?next=` through the email confirmation callback URL:
   ```tsx
   const callbackUrl = next
     ? `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`
     : `${siteUrl}/auth/callback`;
   ```

4. **Auth callback** (`app/auth/callback/route.ts:8,59-82`) — Handles `?next=` after email confirmation, including auto-joining invite groups:
   ```tsx
   const next = searchParams.get("next");
   // If next is an invite URL, auto-join the group
   const inviteMatch = next.match(/^\/invite\/([^/?#]+)/);
   if (inviteMatch) {
     const { data: joinData } = await supabase.rpc("join_group_by_token", { _token: token });
     // Redirect directly to the group page
   }
   ```

5. **Open redirect protection** (`app/auth/callback/route.ts:14-15`):
   ```tsx
   const isSafePath = (p: string) =>
     p.startsWith("/") && !p.startsWith("//") && !p.includes("://");
   ```

**Verdict:** No work needed. The invite → login → redirect flow is complete and secure.

---

## Task 5: Add Recurring Expenses to Mobile — Needs Full Mobile App

### What exists on the web

The recurring expenses feature is fully implemented on web:

**Database schema:**
```
RecurringExpense
  id, groupId, createdById, description, amountCents, paidById,
  participantIds (text[]), splitType, frequency ('weekly'|'monthly'|'yearly'),
  nextOccurrence (date), lastProcessed (timestamp), active (boolean), createdAt
```

**API routes:**
- `PUT /api/groups/[id]/recurring/[recurringId]` — Update recurring template
- `DELETE /api/groups/[id]/recurring/[recurringId]` — Deactivate recurring template
- `POST /api/cron/process-recurring` — Cron: auto-create expenses from templates

**RPC:** `create_expense` handles linking to recurring templates via `_recurring_expense_id` param.

**UI components:** The web AddExpenseForm has a "Make recurring" toggle with frequency selector. Group detail shows recurring expenses with edit/cancel.

### What's needed for mobile

Since the mobile app talks directly to Supabase (no API intermediary), the mobile needs to:

1. **Read recurring expenses:**
   ```ts
   const { data } = await supabase
     .from("RecurringExpense")
     .select("*")
     .eq("groupId", groupId)
     .eq("active", true);
   ```

2. **Create recurring expense:** Use the same `create_expense` RPC with `_recurring_expense_id` param, plus insert into `RecurringExpense` table directly (or create a new RPC).

3. **Update recurring expense:**
   ```ts
   await supabase
     .from("RecurringExpense")
     .update({ description, amountCents, frequency, ... })
     .eq("id", recurringId);
   ```

4. **Cancel recurring expense:**
   ```ts
   await supabase
     .from("RecurringExpense")
     .update({ active: false })
     .eq("id", recurringId);
   ```

5. **UI screens needed:**
   - Add "Make recurring" toggle to AddExpense bottom sheet
   - Frequency selector (weekly/monthly/yearly)
   - Recurring expenses list/section in group detail
   - Edit recurring expense screen
   - Cancel recurring confirmation

**Estimated effort:** 4-6 hours (requires mobile scaffold to exist first).

---

## Prerequisites: Mobile App Scaffold

All tasks except #1 and #4 require the mobile app to exist. The scaffold should follow `PLAN-react-native.md`:

### Monorepo setup (root changes)

1. Add workspaces to root `package.json`:
   ```json
   { "workspaces": ["packages/*", "mobile"] }
   ```

2. Add `@aviary/shared` path to root `tsconfig.json`

3. Add `transpilePackages` to `next.config.ts`:
   ```ts
   transpilePackages: ["@aviary/shared"]
   ```

### Shared package (`packages/shared/`)

Move pure TS files from `lib/` → `packages/shared/src/`:
- `lib/balances/*.ts` (buildRawDebts, simplify, getUserDebt, splitAmount)
- `lib/format.ts` (formatCents)
- `lib/formatDisplayName.ts`
- `lib/constants.ts`
- `lib/amount.ts`
- `lib/percentageSplit.ts`
- `lib/groupPattern.ts`

Keep re-export barrels in `lib/` so web imports don't break.

### Mobile app (`mobile/`)

Key dependencies from `PLAN-react-native.md`:
```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-font": "~13.0.0",
    "expo-haptics": "~14.0.0",
    "expo-updates": "~0.28.0",
    "expo-web-browser": "~14.0.0",
    "expo-clipboard": "~7.0.0",
    "@supabase/supabase-js": "^2.97.0",
    "@tanstack/react-query": "^5.0.0",
    "@gorhom/bottom-sheet": "^5.0.0",
    "@react-native-community/datetimepicker": "^8.0.0",
    "nativewind": "^4.0.0",
    "react-native-svg": "^15.0.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.0",
    "lucide-react-native": "^0.450.0"
  }
}
```

**Supabase client** uses SecureStore for session persistence (see `PLAN-react-native.md` § 5 for the full implementation).

**Auth flow:** Uses `supabase.auth.onAuthStateChange` → context provider → root layout redirects based on session.

---

## Key Files Reference

| File | Relevance |
|------|-----------|
| `PLAN-react-native.md` | Full mobile architecture plan (783 lines) — screen map, data architecture, auth flow, implementation phases |
| `app/(legal)/privacy/page.tsx` | Privacy policy web page (318 lines) |
| `app/(legal)/terms/page.tsx` | Terms of service web page (400 lines) |
| `app/(auth)/login/page.tsx` | Login page — already reads `?next=` (line 13) and redirects (line 31) |
| `app/(auth)/signup/page.tsx` | Signup page — passes `?next=` through email callback (lines 40-42) |
| `app/auth/callback/route.ts` | Auth callback — handles `?next=` including invite auto-join (lines 59-82) |
| `app/invite/[token]/page.tsx` | Invite page — server component, calls RPC, upserts User |
| `app/invite/[token]/InviteJoinForm.tsx` | Invite join form — passes `?next=/invite/TOKEN` to login/signup (lines 91, 99) |
| `ARCHITECTURE.md` | Full codebase architecture (read this first in every session) |
| `DESIGN.md` | Visual design language (colors, typography, motion) |
| `CLAUDE.md` | Workflow, gotchas, commands, conventions |
| `package.json` | Current web dependencies (no workspaces yet) |
| `tsconfig.json` | TypeScript config (no shared package paths yet) |
| `next.config.ts` | Minimal turbopack config (no transpilePackages yet) |

---

## Recommended Execution Order

1. **Skip tasks 1 & 4** — already done
2. **Create monorepo workspace** — add `workspaces` to root `package.json`, create `packages/shared/`
3. **Create mobile scaffold** — `mobile/` with Expo Router, NativeWind, Supabase client
4. **Configure app.json** (task 3) — full app store metadata, privacy/terms URLs
5. **Add expo-updates** (task 2) — add dependency + configure in app.json
6. **Add recurring expenses** (task 5) — screens + direct Supabase queries
7. **Run `npm run build`** to verify web app still works after monorepo changes
8. **Run `SKIP_SMOKE_TESTS=1 npm test`** to verify all existing tests pass
