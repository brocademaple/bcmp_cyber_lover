# Project Agent Instructions

## Non-Negotiable: Preserve Local User Data

This app is a companion/chat product. User chat history, memories, diaries,
anniversaries, relationship state, service settings, and selected character data
are product-critical local data. Code changes must not make existing local data
disappear, become unreadable, or get silently overwritten.

Before changing any code that touches chat, characters, storage, onboarding,
settings, message ordering, archives, or app initialization:

- Treat existing user data as production data, even in local development.
- Do not change storage keys, character ids, message schema, or persistence
  format without an explicit migration path.
- Do not clear `AsyncStorage`, file-system backups, or local app data as a fix.
- Do not replace persisted default characters in a way that loses user edits,
  memories, diaries, anniversaries, or emotional state.
- Do not make UI changes that only hide missing history. Trace the load path and
  persistence layer first.

The current chat persistence boundary is:

- `src/services/chatPersistence.ts`
- `src/store/chatStore.ts`
- `src/utils/chatHistory.ts`

Chat records must continue to be recoverable from all supported sources:

- primary indexed records: `@bcmp_chat_db_v1_${characterId}`
- legacy records: `@bcmp_messages_${characterId}`
- file backups under `FileSystem.documentDirectory/bcmp-chat-backups/`

If storage behavior changes, update the persistence layer and keep backward
compatibility. Loading should migrate old data forward instead of returning an
empty conversation.

## Required Verification For Chat Or Storage Changes

Run these checks after any change that may affect chat history, message order,
archives, character data, settings, or AI message flow:

```bash
npx tsc --noEmit
node scripts/verify-chat-history-ordering.js
npm run verify:debug-now
```

If a check cannot be run, state the exact reason in the final response. Do not
claim a chat/storage change is safe without either running these checks or
explaining the verification gap.

## Expected Fix Pattern

When a user reports that chat records disappeared after an update:

1. Inspect the real load and save path before changing UI.
2. Check whether records still exist under legacy keys or file backups.
3. Add a migration or fallback read path if records are present but unreadable.
4. Keep the old key readable for at least one full migration cycle.
5. Verify with the commands above.

Assumption for future agents: preserving the user's existing interaction history
has higher priority than visual polish, refactors, or cleanup.

## Non-Negotiable: Preserve Visual Assets

Character artwork, avatars, memory comics, theme decorations, icons, and all
files under `assets/**` are product-critical UI assets. Code or feature changes
must not make existing assets disappear, become unreadable, render nearly
transparent, get cropped into unusable fragments, or become hidden behind
overlays.

Assumption for future agents: every project change can accidentally affect
visual assets through bundling, persisted character data, theme overlays,
layout stacking, or image-loading behavior. Treat image/material preservation as
a required regression point for every update, even when the requested change
does not sound visual at first.

Before changing any code that touches screens, themes, character rendering,
image loading, navigation chrome, onboarding, memory views, chat bubbles, or
layout layers:

- Keep existing `require(...)` asset references working unless there is an
  explicit replacement and fallback path.
- Do not delete, rename, move, or regenerate assets without updating every
  import/reference and checking the rendered screen.
- Treat `opacity`, `zIndex`, `position`, `resizeMode`, gradients, masks, and
  background overlays as asset-risk changes. Avoid values that make artwork look
  blank or washed out.
- Prefer visible fallbacks for failed image loading instead of silently showing
  an empty white area.
- Do not fix a visual issue by hiding the image container. Trace the render path,
  asset reference, layer order, and persisted character fallback first.

## Required Verification For Visual Assets

Run these checks after any change that may affect app screens, themes, layout,
navigation, character data, image loading, asset imports, Expo bundling, or
rendering behavior:

```bash
npx tsc --noEmit
npm run verify:visual-assets
```

For changes touching a visible screen, also verify the affected screen in the
simulator, a screenshot, or an Expo export/build output that lists bundled
assets. A blank/white area where character artwork or materials should appear is
a release blocker, not an acceptable cosmetic issue.

The visual definition of done is actual rendered pixels, not just successful
compilation. Do not mark a visual or screen-affecting change complete only
because TypeScript passes, the asset file exists, or Expo export lists the asset.
At least one rendered proof is required:

- a fresh simulator screenshot after reloading or rebuilding the current bundle;
- a browser/simulator screenshot for web or Expo previews;
- an automated visual smoke test that inspects the screenshot and fails when the
  expected artwork area is blank, all-white, all-black, or only a gradient.

If the simulator is showing an old static bundle, start the current dev server
or rebuild/reinstall before taking the screenshot. If that is blocked, say so
explicitly and do not claim the visible-screen fix is complete.

Prefer stable asset architecture over per-screen patches:

- Keep default character asset mapping centralized in `src/store/chatStore.ts`
  or a dedicated asset registry module. Do not duplicate incompatible mappings
  across screens.
- Preserve old default character ids and aliases when ids are renamed. If an id
  changes, add a migration or alias map so persisted settings and characters
  still hydrate the correct assets.
- Each default character must have a bundled local fallback for main image,
  avatar/headshot, idle frames, and memory scene. Remote/custom images may add to
  this, but must not replace the bundled fallback.
- Image containers must reserve stable dimensions and render a visible fallback
  while the preferred image loads. Avoid relying on a single absolute background
  layer with no foreground fallback.
- Any change to `opacity`, `zIndex`, absolute positioning, gradients, masks,
  `resizeMode`, SafeArea layout, or animation timing must be treated as an image
  visibility risk and checked on the actual screen.

If visual verification cannot be run, state the exact reason in the final
response and name the remaining risk. Do not claim an update preserved images or
materials without either running the checks above or explaining the verification
gap.

When a user reports that images or materials disappeared after an update:

1. Check that the asset files still exist under `assets/**`.
2. Inspect the real `require(...)` or URI path used by the screen.
3. Check whether persisted character/settings data is missing new asset fields
   and needs a non-destructive fallback merge.
4. Check layout and theme overlays for opacity, z-index, clipping, and
   `resizeMode` regressions.
5. Run `npx tsc --noEmit` and, when possible, verify the affected screen in the
   simulator or with a screenshot before claiming the fix is complete.
