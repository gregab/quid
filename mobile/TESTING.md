# Mobile App — Testing Guide

## Running the App Locally

### Expo Go (quickest start)
```bash
cd mobile
npx expo start
```
Scan the QR code with Expo Go (iOS/Android). Limitations:
- **expo-secure-store** works in Expo Go on physical devices, NOT in web mode
- Deep links (`aviary://`) don't work in Expo Go — use a dev build for those

### iOS Simulator
```bash
npx expo start --ios
```
Requires Xcode installed. Full native module support.

### Android Emulator
```bash
npx expo start --android
```
Requires Android Studio + an AVD configured.

### Dev Build (full native modules)
```bash
npx expo prebuild
npx expo run:ios   # or run:android
```
Needed for: SecureStore on simulator, deep links, push notifications.

### Environment Variables
Copy `.env.example` → `.env` and fill in your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Running Unit/Component Tests

### Quick run (all tests)
```bash
cd mobile
npm test
```

### Watch mode (re-runs on file change)
```bash
npm run test:watch
```

### Run a specific test file
```bash
npx vitest run components/ui/Button.test.tsx --config vitest.config.ts
```

### Test stack
- **Vitest 4** — test runner (same as web app)
- **happy-dom** — lightweight DOM implementation
- **@testing-library/react** — component rendering + queries
- **Custom mocks** — React Native primitives mapped to HTML elements

---

## How the Testing Infrastructure Works

### Mock Architecture

React Native components don't render in a browser DOM, so we mock them:

| RN Component | Maps to | Notes |
|---|---|---|
| `View` | `<div>` | |
| `Text` | `<span>` | |
| `TextInput` | `<input>` | `onChangeText` wired to `onChange` |
| `Pressable` | `<button>` | `onPress` wired to `onClick` |
| `Image` | `<img>` | `source.uri` → `src` |
| `FlatList` | `<div>` | Renders items inline via `renderItem` |
| `ScrollView` | `<div>` | |
| `ActivityIndicator` | `<div role="progressbar">` | |
| `Switch` | `<input type="checkbox">` | |

Mock files live in `mobile/__mocks__/`:
- `react-native.tsx` — all core RN components
- `react-native-reanimated.tsx` — passthrough shared values, no-op animations
- `react-native-gesture-handler.tsx` — no-op gesture wrappers
- `react-native-safe-area-context.tsx` — zero insets

### Global Mocks (vitest.setup.ts)

The setup file auto-mocks these Expo/native modules:
- `expo-secure-store` — in-memory Map-backed storage
- `expo-haptics` — no-op functions
- `expo-font` — `useFonts` always returns `[true, null]`
- `expo-splash-screen` — no-op
- `expo-clipboard` — no-op
- `expo-router` — `useRouter()` returns mock `push/replace/back`
- `expo-status-bar` — renders nothing
- `expo-linking` — returns `aviary://` URLs
- `expo-constants` — minimal config
- `@gorhom/bottom-sheet` — passthrough wrappers
- `@react-native-community/datetimepicker` — renders nothing
- `lucide-react-native` — all icons render as `<span data-testid="icon-Name">`
- `./lib/supabase` — full mock with chainable query builder

### React Version Note

The mobile app declares React 18 for React Native compatibility, but tests use React 19 + react-dom 19 (from root `node_modules`). The `vitest.config.ts` aliases `react` and `react-dom` to the root versions to prevent version mismatch errors.

### Console Warnings

You'll see warnings like "React does not recognize the `onPressIn` prop on a DOM element." These are **expected and harmless** — they're React Native props being passed to HTML mock elements. They don't affect test correctness.

---

## Writing Tests

### Component test template
```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MyComponent } from "./MyComponent";

afterEach(cleanup); // Required — DOM persists across tests

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("expected text")).toBeTruthy();
  });
});
```

### Key patterns

**Querying elements:**
- `screen.getByText("Login")` — find by visible text
- `screen.getByPlaceholderText("Email")` — find TextInput by placeholder
- `screen.getByRole("progressbar")` — find ActivityIndicator
- `screen.getByTestId("icon-ChevronLeft")` — find Lucide icon

**Interactions:**
- `fireEvent.click(element)` — press a Pressable/Button (maps to onClick)
- `fireEvent.change(input, { target: { value: "new text" } })` — type in TextInput

**Async operations:**
```tsx
await act(async () => {
  fireEvent.click(screen.getByText("Submit"));
});
```

**Overriding Supabase mock per-test:**
```tsx
import { supabase } from "../../lib/supabase";

vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
  data: { session: null, user: null },
  error: { message: "Invalid credentials" },
} as never);
```

**Overriding expo-router per-test:**
```tsx
import { useRouter, useLocalSearchParams } from "expo-router";

vi.mocked(useLocalSearchParams).mockReturnValue({ id: "group-123" });

const push = vi.fn();
vi.mocked(useRouter).mockReturnValue({
  push, replace: vi.fn(), back: vi.fn(), canGoBack: vi.fn(() => true),
} as never);
```

---

## Manual Testing Flows

### Auth Flow
1. Open the app → should see login screen
2. Enter email + password → tap "Log In" → should redirect to dashboard
3. Tap "Sign up" → enter name + email + password → should show "Check your email"
4. Log out from Settings → should return to login

### Create Group
1. Dashboard → tap "New group" button
2. Enter group name → tap "Create group"
3. Should navigate to the new group detail screen
4. Group should appear in dashboard list on back

### Add Expense
1. Group detail → tap "Add" button
2. Fill description, amount, select payer, select participants
3. Toggle split type (Equal / Custom / %)
4. Tap "Add expense" → should return to group
5. Expense should appear in list, balances should update

### Record Payment
1. Group detail → tap "Settle up"
2. Select who to pay (or "Record other payment")
3. Enter amount → tap "Record payment"
4. Balances should update accordingly

### Invite Flow
1. Group settings → tap "Share invite link"
2. Should open native share sheet with invite URL
3. Other user opens invite URL → should see group preview + "Join" button

### Settings
1. Dashboard → tap gear icon
2. Should show email (read-only) and display name
3. Tap "Edit" on display name → change and save
4. "Log out" button should work
5. "Delete account" should show confirmation dialogs

---

## Monorepo Testing Considerations

### Shared package
- Business logic lives in `packages/shared/` (balances, formatting, constants)
- Tests for shared code run from the **root** workspace: `SKIP_SMOKE_TESTS=1 npm test`
- Mobile tests import from shared via the `@aviary/shared` alias

### Running all tests
```bash
# Root: web app + shared package tests
SKIP_SMOKE_TESTS=1 npm test

# Mobile: component + screen tests
cd mobile && npm test
```

### Web app tests are not affected
- Root `tsconfig.json` excludes `mobile/` and `packages/`
- Web vitest config only picks up root-level test files
- Mobile has its own `vitest.config.ts`

---

## Expo-Specific Gotchas

1. **SecureStore doesn't work in web mode** — use a physical device or simulator for auth testing
2. **Deep links require a dev build** — `aviary://` scheme doesn't work in Expo Go
3. **NativeWind className** — in tests, `className` is just a string prop on the HTML mock. Don't test specific Tailwind classes; test behavior and content instead.
4. **Haptics are no-op** — `expo-haptics` is mocked to resolve immediately. If you need to verify haptic feedback was triggered, check the mock: `expect(Haptics.impactAsync).toHaveBeenCalled()`
5. **DateTimePicker renders nothing** — it's mocked as a null component. Test date selection by setting state directly, not by interacting with the picker.
6. **Alert.alert auto-confirms** — the mock presses the last button automatically. Override `Alert.alert` in specific tests if you need different behavior.
