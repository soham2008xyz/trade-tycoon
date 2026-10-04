<!-- markdownlint-disable MD041 -->
<!-- Bodies start at H2, matching our merged PRs; an H1 here is noise. Needed
     only if you lint this file directly — `npm run lint:md` globs **/*.md,
     which skips dot-directories like .github, so it never sees this file. -->

<!--
Keep this short and factual. Reviewers read the Summary, then check off Evidence.

Conventions in this repo: conventional-commit PR titles, `Fixes #NNN` on the
first line, one issue per PR. Delete a section that genuinely does not apply,
but do not delete checkboxes silently — an unticked box tells the reviewer what
was skipped.
-->

## Summary

<!-- What changed and why, in 2-4 sentences. If the change is logic, show the
     key control flow as pseudocode or a diff sketch. -->

Fixes #

Related: <!-- optional, e.g. #275 (game-over screen), #269 -->

## Type

- [ ] Feature
- [ ] Bug fix
- [ ] Refactor / cleanup
- [ ] Chore / CI / config
- [ ] Docs only

## Workspaces touched

<!-- Same split as AGENTS.md. Most PRs touch one. -->

- [ ] `packages/game-logic` — types, reducer, rules
- [ ] `apps/server` — REST, SSE, multiplayer
- [ ] `apps/client` — UI, screens, components
- [ ] Cross-cutting — docs, CI, config

## Evidence

**Before:** <!-- the failing test, the wrong output, the screenshot -->

**After:** <!-- the passing test, the correct output, the screenshot -->

<!-- Real numbers, not "tests pass". If you checked behaviour by hand, name the
     device and what you saw. -->

## Verification

- [ ] Tests pass — game-logic `<n>`, server `<n>`, client `<n>`
- [ ] `npm run lint` (client changes)
- [ ] `npm run lint:md`
- [ ] `npm run format`
- [ ] `npm run build --workspace=apps/server` (entry points / wiring only)

<!-- Per-workspace commands, from AGENTS.md section 8:

     npm test --workspace=packages/game-logic   # rules / reducer
     npm test --workspace=apps/server           # routes, RoomManager
     npm test --workspace=apps/client           # gating predicates

     If you touched REST or SSE shapes, the 409 rejection contract, resume
     behaviour, or RoomStore, note it below — see AGENTS.md section 5.
-->

## Merge Danger

**Door:** <!-- two-way | one-way -->

**Blast Radius:** <!-- one word, e.g. "game rules", "online leave flow" -->

<!-- One-way means destructive or hard to reverse. Name what a reviewer should
     know: new persisted fields, changed behaviour on an existing path, anything
     already-deployed code will not understand. -->

## Not verified / out of scope

- **Out of scope:** <!-- related issue number, or "nothing" -->
- **Not verified:** <!-- "two clients online", "iPad simulator",
                        "VoiceOver on a device", or "nothing" -->

## Docs and memory

- [ ] `docs/SPECIFICATION.md` updated (feature shipped)
- [ ] The relevant `AGENTS.md` updated (a convention changed)
- [ ] `.claude/memory/*.md` updated **and committed with this change**
- [ ] Nothing needed
