# PR #198 Review Remediation Plan

## Context

A two-axis review of PR #198 (`fix/security-audit-remediation` vs `master`) against `.claude/plans/01-codebase-audit-and-implementation-plan.md` found 7 missing/partial spec items, 5 deviations, and 2 hard standards violations (zero doc updates despite wire-contract changes; a `.ts` module importing react-native). This plan closes every actionable finding. All work lands as new commits on the same branch so PR #198 merges complete.

**User decisions (fixed):**
1. Fixes push to PR #198's branch.
2. Invalid/unknown token → **401** on `/actions` and `/events`; **keep** 404 `session_expired` on reconnect/leave (client resume flow depends on it).
3. `LobbyState.sessions` stays in game-logic; document the layering in `packages/game-logic/AGENTS.md`.

**Non-goals (explicitly out of scope):** rewriting PR commit history (commit-typing findings noted only); removing benign scope-creep (64kb json limit, `die1/die2` stripping, publish-on-create, `.env.example`); relocating the `version` bump or converting the log-cap wrapper to `appendLog` (equivalent — only the bypass in step 4 is fixed); deferred Phase 6 items; the pre-existing reanimated/worklets dependency conflict.

---

## Step 1 — Result unions + 401 auth semantics (server)

**Files:** `apps/server/src/RoomManager.ts`, `apps/server/src/routes/rooms.ts`, `apps/server/src/routes/events.ts`, `apps/server/src/routes/rooms.test.ts`, `apps/server/src/routes/events.test.ts`

`RoomManager.ts` — replace the `T | null` returns (joinRoom:85, leaveRoom:150, reconnect:219, updatePlayer:244, startGame:277) with a shared discriminated union mirroring the existing `GameActionResult` (line 33):

```ts
type RoomResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'not_found' | 'unauthorized' | 'conflict'; message: string };
```

- `joinRoom`: `not_found` (no room), `conflict` (full / in progress).
- `startGame`: `not_found`, `unauthorized` (token not in `sessions`), `conflict` (not host / <2 players / already started).
- `updatePlayer`: `not_found`, `unauthorized`.
- `leaveRoom` / `reconnect`: bad token maps to `not_found` with message `session_expired` (decision 2 exception — client depends on 404 here).
- `handleGameAction`: extend `{ ok: false }` arm with `reason: 'unauthorized' | 'rejected'` so a bad token no longer folds into the 409 path (RoomManager.ts:357-361).

`rooms.ts` — delete the re-get dances at :51-56 (join) and :67-74 (start); map `reason → status` via one small lookup (`not_found→404, unauthorized→401, conflict→409`). `handleGameAction` route: `unauthorized→401`, `rejected→409`, keep the room pre-check 404 at :96. No publish on any `ok:false` (unchanged behavior — keep the existing no-broadcast test green).

`events.ts:40-43` — bad token 403 → **401**.

**Tests:** update rooms.test.ts:275 (bogus token on actions → 401) and events.test.ts:61,68 (403 → 401, including the stolen-playerId-as-token case). The sessions-never-leak test (rooms.test.ts:48-58) must stay green untouched.

## Step 2 — DISMISS exclusion (server + client)

**Files:** `packages/game-logic/src/validate-action.ts`, new `packages/game-logic/src/validate-action.test.ts`, `apps/client/components/GameUI.tsx`

- Remove the `DISMISS_ERROR`/`DISMISS_TOAST` case (validate-action.ts:40-42); they fall through to `default: return null` like `RESET_GAME`/`JOIN_GAME`. Extend the :91-92 comment: dismissal is client-local in multiplayer.
- `GameUI.tsx` (:162-167): add local state `const [dismissedFeedback, setDismissedFeedback] = useState<string | null>(null)`. Reducer-feedback toast renders only when `gameFeedback.message !== dismissedFeedback`; `onDismiss` becomes `isMultiplayer ? () => setDismissedFeedback(gameFeedback.message) : () => onDispatch({ type: gameFeedback.dismissAction })`. Clear `dismissedFeedback` in an effect keyed on `gameFeedback.message` so a later identical toast reappears. Local hotseat dispatch path is unchanged. The Toast auto-dismiss timer (M10 fix) flows through the same `onDismiss`, so it needs no separate handling.
- **New `validate-action.test.ts`** (table-driven, per plan §1b tests): every accepted action shape; bounds (`Number.isSafeInteger`, `0..MAX_MONEY=1e9`, validate-action.ts:14,18-19); negative/string/float money and bid rejection; unknown type; `DISMISS_*`/`RESET_GAME`/`JOIN_GAME` rejected.

## Step 3 — SSE lifecycle + serializer boundary (server)

**Files:** `apps/server/src/routes/events.ts`, `apps/server/src/serialize.ts`, `apps/server/src/routes/events.test.ts`, `apps/server/src/routes/rooms.test.ts`

- `events.ts`: register cleanup on **`res.on('close')`** instead of `req.on('close'/'aborted')` (:103-104) — request-side `close` fires at body completion on Node ≥16, not socket teardown. Also close the early-write gap: declare `unsubscribe`/`heartbeat` as nullable, define the real idempotent `cleanup` (guarding nullables) and register `res.on('close', cleanup)` **before** the initial snapshot writes at :73-76 (today a throw there runs the no-op `cleanup` stub from :59).
- `serialize.ts`: make `toPublicGameState` (:15-17) strip `errorMessage` by destructure, mirroring `toPublicLobbyState`; add the missing why-comment to the bare `eslint-disable` at :20 (rule: root AGENTS.md:227-228).
- **New tests:** (a) SSE write-failure → unsubscribe: events.test.ts real-server pattern (:39-49) — connect, destroy the client socket, `eventBus.publish`, assert the subscription was removed (wrap `eventBus.subscribe` with a spy capturing returned unsubscribe fns, or assert via the in-memory bus's handler count). (b) store-conflict → 503 supertest: `buildApp` variant that registers `errorHandler` (missing from rooms.test.ts:10-16) and a store whose `update` rejects with `StoreConflictError` (`vi.spyOn(store, 'update')`; 503 mapping already exists at `middleware/errors.ts:22-27`). (c) errorMessage absent from published/response game states.

## Step 4 — Log-cap bypass (game-logic)

**Files:** `packages/game-logic/src/reducer.ts`, `packages/game-logic/src/reducer.test.ts`

Extract the slice from `reduceGameAction` (:1277-1285) into a shared `capLogs(state)` helper using `MAX_LOGS` (:216); apply it in both `reduceGameAction` and `removePlayerFromGame` (:212-213 — currently uncapped, called directly by `RoomManager.leaveRoom` at RoomManager.ts:190). Test: state with 200 logs → `removePlayerFromGame` → `logs.length ≤ 200`.

## Step 5 — CAS-retry replay test (server)

**Files:** `apps/server/src/RoomManager.test.ts` (or a new focused test file)

Plan §2b's mandated test: stub a store whose `update` invokes the mutator **twice** (simulating a CAS retry) and persists the second result; dispatch `ROLL_DICE` through `handleGameAction`; assert both invocations produced identical dice (seed generated outside the mutator ⇒ replay-identical). Template: the `roomCas` spy in `RedisRoomStore.test.ts:79`.

## Step 6 — Client memoization + busy buttons (M13/M14 completion)

**Files:** `apps/client/components/Board.tsx`, `apps/client/components/GameUI.tsx`, `apps/client/components/OnlineGame.tsx`

- Wrap `Board` in `React.memo` (Board.tsx:22 — Tile.tsx:123 and PlayerToken.tsx:171 already are).
- `GameUI.tsx`: wrap the per-render handlers (:56-129) in `useCallback` and `sharedProps` (:133-152, including its inline arrows) in `useMemo`. Goal (per plan M13): a toast-only re-render passes identical prop references through the layouts so `React.memo(Board)` blocks the 40-tile re-render. Handlers that close over `state` legitimately change identity when state changes — that's fine; state changes re-render the board anyway. Don't memoize Phone/TabletGameLayout unless the Board memo demonstrably doesn't hold without it.
- `OnlineGame.tsx`: add `busy` `useState` set/cleared alongside `requestInFlightRef` (:53) in the four guarded handlers (:253, 273, 292, 308 — ref stays for synchronous double-tap safety); thread `disabled={busy}` into the create/join `IconButton` (:413-418) and `disabled={busy || …}` into start (:451-457). In-game dispatch keeps the ref guard only (buttons there are gated by game state; no visual change needed).

## Step 7 — Platform injection for online-session (standards fix)

**Files:** `apps/client/components/online-session.ts`, `apps/client/components/online-session.test.ts`, `apps/client/components/OnlineGame.tsx`

Remove the `react-native` import (online-session.ts:1 — violates client AGENTS.md:31-34). Follow the `online-platform.ts` pattern: each function takes a `platform: string` param and guards `platform !== 'web'` (:20, 40, 45); `OnlineGame.tsx` passes `Platform.OS` at the call sites. Update the tests to pass `'web'`/`'ios'` explicitly (drops the reliance on the react-native-web alias resolving `Platform.OS`).

## Step 8 — Room-sync extraction + tests (H4 completion)

**Files:** new `apps/client/components/online-sync.ts` + `online-sync.test.ts`, `apps/client/components/OnlineGame.tsx`

Extract the inline sync effect (OnlineGame.tsx:124-245) into a **framework-free engine** (repo tests are node-only, no RTL — a React hook would be untestable):

```ts
export interface RoomSyncCallbacks {
  onLobbyState(s: LobbyState): void;
  onGameState(s: GameState): void;
  onSessionExpired(): void;   // poll 404 → replaces setTransientError+onBack
}
export function startRoomSync(opts: {
  serverUrl: string; roomId: string; token: string;
  transport: 'sse' | 'poll';                    // caller decides via supportsOnlineEventStream
  callbacks: RoomSyncCallbacks;
  createEventSource?: (url: string) => EventSourceLike;   // injectable; default: new EventSource(url)
  fetchSnapshot?: typeof reconnectToRoom;                  // injectable; default: online-api's reconnectToRoom
}): { stop(): void }
```

- Poll branch keeps `MIN_POLL_MS=2000`/`MAX_POLL_MS=5000`, in-flight guard, version-skip → back off to 5s, change → reset to 2s, 404 → `onSessionExpired` + stop.
- SSE branch builds `?token=` URL, parses `lobby`/`game` events, forwards raw states; step transitions (`status==='game'` → `setStep('game')`) stay in OnlineGame's callbacks.
- OnlineGame keeps a thin `useEffect` that calls `startRoomSync` and stores the handle in a ref; `handleLeave` (:321-322) calls `handle.stop()` instead of touching `eventSourceRef` (delete the ref).
- **Tests** (fetch-mock template `online-api.test.ts:19-24`; net-new minimal `FakeEventSource` class + `vi.useFakeTimers`): poll applies snapshot; unchanged version skips callbacks and next delay is 5000; changed version resets to 2000; 404 fires `onSessionExpired`; `stop()` cancels the pending timer; SSE constructs the token URL, forwards parsed lobby/game events, `stop()` closes the source. This closes the plan's missing poll-change-detection test.

## Step 9 — game-logic type-check in CI

**Files:** `packages/game-logic/package.json`, `.github/workflows/test.yml`

Add `"type-check": "tsc --noEmit"` to game-logic scripts; add a workflow step `npm run type-check --workspace=packages/game-logic` alongside the existing client/server type-check steps (:35, :38).

## Step 10 — Documentation sweep (standards hard violation #1)

All stale passages verified; corrections must also reflect Step 1's new 401 semantics.

| File | Fix |
|---|---|
| `AGENTS.md` (root) | :158 SSE `?userId=`→`?token=`; :160-163 auth = token→session resolution (`playerId` public, `token` secret, POST bodies `{token}`); :174-192 rejection contract — ALL soft rejections now 409 + no persist/broadcast (drop "trade-auth-only exception" framing); :212-214 remove lint-staged clause; :229-233 `errorMessage` no longer broadcast — actor gets it via 409 body |
| `packages/game-logic/AGENTS.md` | :34-36 userId wording; :65-88 rejection contract (mirror root — the :106-108 mandate names both files); :12-25 scope statement — sanction transport-agnostic session data in `LobbyState` (decision 3) |
| `apps/server/AGENTS.md` | :82-88 rejection contract; token auth in the add-an-endpoint (:39-59) and SSE (:90-107) sections; mention `ALLOWED_ORIGINS` |
| `apps/client/AGENTS.md` | :112 `?token=`; :134 key `trade_tycoon_session_v2` `{roomId, playerId, token}`; :85-86 `userId`→`playerId` |
| `docs/ARCHITECTURE.md` | :62 body `{token, action}`; :64-65 token-auth wording; :69, 77 publish only on successful state change |
| `docs/SPECIFICATION.md` | :105-106 session storage/reconnect (token, v2 key); :84-86 logs capped at 200; :100-101 broadcast-on-success + align `game_update`→`game_state_update` naming |
| `docs/DEPLOY.md` | add `ALLOWED_ORIGINS` row to the server env table (format at :34-37) — mandated by root AGENTS.md:248-250 |
| `CONTRIBUTING.MD` | :137 lint-staged → husky pre-commit (`lint && lint:md && format && test`) |
| `.claude/memory/project.md` | fix stale bullet :7-10 (`errorMessage` is no longer broadcast); add durable insights per root AGENTS.md:8-13 (SSE needs `res.on('close')` not `req.on('close')`; DISMISS_* are client-local in multiplayer; sessions-in-LobbyState layering rationale; 401/404/409 mapping) |

---

## Commit plan (conventional, lowercase, one per step group)

1. `refactor(server): return discriminated results from room lifecycle, 401 on bad tokens` (Step 1)
2. `fix: exclude dismiss actions from online play, dismiss toasts locally in multiplayer` (Step 2)
3. `fix(server): harden sse teardown and strip errorMessage at the serializer boundary` (Steps 3 + 5)
4. `fix(game-logic): cap logs on the direct player-removal path` (Step 4)
5. `perf(client): memoize board and stabilize game ui props` (Step 6, M13 half)
6. `fix(client): disable lobby buttons while a request is in flight` (Step 6, M14 half)
7. `refactor(client): inject platform into session storage` (Step 7)
8. `refactor(client): extract room sync engine with tests` (Step 8)
9. `ci: type-check game-logic` (Step 9)
10. `docs: align agent docs, architecture, spec, and deploy with token auth` (Step 10)

Push to `fix/security-audit-remediation`; note the changes in a PR comment or updated PR body.

## Risks / interactions

- Step 1 touches every route: keep sessions-never-leak (rooms.test.ts:48-58) and no-broadcast-on-409 (rooms.test.ts:168-185) tests green; the client treats non-OK statuses generically via `ApiResult` (online-api.ts:15-18), so 403/409→401 is client-safe — but verify OnlineGame's 404-specific branches (resume/poll) are untouched.
- Step 2 must not change local hotseat behavior (dispatch path preserved when `!isMultiplayer`).
- Step 8 must keep `handleLeave`'s close-stream-before-POST ordering.
- Step 7 changes public signatures of `online-session.ts` — update all OnlineGame call sites in the same commit.

## Verification

```bash
npm run build:game-logic
npm run type-check --workspace=packages/game-logic     # new
npm test --workspace=packages/game-logic               # 157 + new validate-action/capLogs tests
npm test --workspace=apps/server                       # 100 + new 401/503/SSE-failure/CAS-replay tests
npm test --workspace=apps/client                       # 55 + new online-sync/session tests
npm run type-check --workspace=apps/client
npm run type-check --workspace=apps/server
npm run lint
```

Manual smoke (browser, two tabs — **if** the pre-existing reanimated conflict allows; otherwise rely on the suites as PR #198 did): create/join/start; trigger a shared toast and dismiss it in one tab → still visible in the other, no network POST for the dismiss (DevTools); invalid bid → 409 toast only on actor's screen; request with a doctored token → 401; reload mid-game → v2 session resume; leave. Confirm no `sessions`/`errorMessage` field in any network payload.
