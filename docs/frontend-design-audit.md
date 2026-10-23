# Frontend Design Audit

Date: 2026-06-17
Project: HeartBeat Companion
Mode: redesign-preserve
Skill used: design-taste-frontend, adapted for a React Native mobile product surface

## Design Read

Reading this as: an existing companion-chat mobile app for emotionally engaged consumer users, with immersive character art and soft premium UI language, leaning toward a native mobile visual system with restrained glass, character-led identity, and utility-first product ergonomics.

Dial reading of the current app:

- DESIGN_VARIANCE: 6. The app has expressive character art, asymmetric decorative assets, and shape variation, but the screen structure is still mostly standard mobile.
- MOTION_INTENSITY: 3 to 4. Home has reduced-motion-aware idle frame rotation, but most interactions are static or simple TouchableOpacity feedback.
- VISUAL_DENSITY: 6. Chat and settings carry many controls in small vertical space; the app feels usable but visually busy.

## Evidence

Simulator: iPhone 17 Pro, iOS 26.5, Expo Go.

Screenshots:

- Chat: `docs/audit-assets/frontend-audit-chat.jpg`
- Home: `docs/audit-assets/frontend-audit-home.jpg`
- Settings: `docs/audit-assets/frontend-audit-settings.jpg`

Runtime check:

```bash
curl -s http://127.0.0.1:8081/status
# packager-status:running
```

## Executive Summary

The strongest part of the frontend is the product direction: full-screen character art, relationship state, soft glass panels, quick replies, and theme-specific decorative layers create a memorable companion-app feel. The app already has real visual assets, not placeholder UI.

The weakest part is system discipline. Individual screens look designed, but the design rules are not encoded tightly enough. The same product uses many radius styles, emoji-as-icons, text glyph buttons, high font weights, warm beige plus brass defaults, decorative overlays, and status/progress motifs all at once. This makes the product feel warmer, but also less premium and less robust.

Recommended direction: keep the immersive character-art shell, then simplify the UI language into one native design system:

- One radius scale
- One icon strategy
- One typography scale
- One glass/surface recipe
- One relationship-status pattern
- Screen-specific decoration budgets

## What Is Working

### 1. Character art is a real first-viewport signal

Home and chat both use the current character image as the primary environment. This is exactly the right product move for a companion app. The character is not just an avatar in a nav bar; it defines the screen.

Relevant code:

- `src/screens/HomeScreen.tsx`: background idle frames and status frame selection
- `src/screens/ChatScreen.tsx`: `ImageBackground` with character image and gradient overlay

### 2. Themes have actual product intent

The newer `urbanClear`, `softSweet`, and `midnight` themes are meaningfully different. They change palette, bubble colors, surfaces, and decorative assets instead of only swapping a primary color.

Relevant code:

- `src/utils/colors.ts`
- `src/components/ThemeArtworkLayer.tsx`

### 3. Chat interaction is directionally right

The input is live, quick replies are close to the composer, and queued sending is now present in `ChatScreen`. This fits a companion app better than blocking the user while the AI replies.

Relevant code:

- `src/screens/ChatScreen.tsx`
- `src/components/MessageInput.tsx`

### 4. Settings information architecture is understandable

The main settings page has a clear top-down model: service connection, visual style, companion experience. This is much cleaner than exposing every technical parameter by default.

Relevant code:

- `src/screens/SettingsScreen.tsx`

## Findings

### P1. Visual hierarchy in chat is overloaded

The chat screen currently layers: character background, gradient overlay, theme artwork, floating header, message bubbles, quick reply rail, and input bar. In the simulator, the background image remains emotionally strong, but it competes with message readability.

Evidence:

- `frontend-audit-chat.jpg`
- `src/screens/ChatScreen.tsx`: `ImageBackground`, `LinearGradient`, `ThemeArtworkLayer`, floating `chatHeader`, quick replies, composer
- `src/components/ThemeArtworkLayer.tsx`: chat decoration is always injected for `urbanClear` and `softSweet`

Recommendation:

- Give chat a stricter decoration budget than home. Keep character background, remove or heavily lower opacity for `ThemeArtworkLayer` on chat.
- Strengthen the message reading surface: use a stable scrim behind the message list, or make assistant/user bubbles less transparent and less dependent on the background.
- Separate foreground levels: header at level 3, messages at level 2, quick replies/input at level 4. Encode this as tokens, not ad hoc `zIndex`.

### P1. Shape language is not locked

The app uses circle buttons, pill buttons, 8 px cards, 12 px cards, 14 px inputs, 16 px buttons, 18 px bubbles, 22 px cards, 24-28 px panels, 999 px pills, and theme-specific asymmetric radii. This is expressive, but currently too unconstrained.

Evidence:

- `src/components/ChatBubble.tsx`: user/assistant bubbles and theme-specific bubble radii
- `src/components/MessageInput.tsx`: icon, input, send button, theme variants
- `src/screens/HomeScreen.tsx`: dock, greeting card, status pills, progress heart, CTA
- `rg "borderRadius" src` shows broad radius drift across many screens

Recommendation:

Create a small shape system:

```ts
export const radii = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
};
```

Then define exceptions by role:

- Chat bubbles may use expressive corners.
- Primary CTAs are pill or large rounded, one choice per theme.
- Cards and panels use `lg`.
- Inputs use `md`.

### P1. Emoji and text glyphs are carrying too much UI work

Emoji are fine inside conversational content, but many controls use emoji or text glyphs as icons: quick replies, settings gear, chat send arrow, plus button, heart progress, character fallback avatars, menu icons, status marks. Computer Use accessibility output confirms these are read as visible text or generic elements.

Evidence:

- `src/screens/ChatScreen.tsx`: quick replies use `😊`, `❤️`, `😴`, `🥺`; settings uses `⚙️`
- `src/components/MessageInput.tsx`: `＋`, `↑`, `✕`
- `src/screens/HomeScreen.tsx`: `♡`, `💬`, `‹`, `›`, `⌛`
- `src/screens/SettingsScreen.tsx`: `▣`, `♡`, `⌁`, `⚙`, version footer

Recommendation:

- Pick one native icon strategy. In React Native, use a single library such as `@expo/vector-icons` or a curated SVG icon component.
- Keep emoji only where the user is expressing tone, for example quick reply labels. For navigation, settings, send, add image, close, and progress markers, use icons.
- Add `accessibilityLabel` to icon-only buttons and hide decorative glyphs from accessibility where appropriate.

### P1. The default palette reads too warm-craft for the intended premium direction

`urbanClear` is the current default. Its palette is low-saturation and coherent, but the combination of off-white background, champagne primary, warm text, and beige input background leans into a common premium-consumer beige plus brass pattern.

Evidence:

- `src/store/settingsStore.ts`: default theme is `urbanClear`
- `src/utils/colors.ts`: `UrbanClearTheme` uses `#fbfaf7`, `#c9a76b`, `#8e7652`, `#f6f1ea`, `#4b4540`

Recommendation:

Keep `urbanClear` but move it toward cold luxury:

- Neutral base: cooler off-white or pale silver
- Accent: champagne as a thin-line accent only, not broad CTA fill
- Primary CTA: muted graphite, dusty violet, or deep plum depending on character
- Character-specific accent can stay in bubbles, but system chrome should be calmer

### P2. Typography is high-weight everywhere

Many labels and controls use `fontWeight: '900'`. This creates impact, but when everything is heavy, nothing feels especially important.

Evidence:

- `src/screens/HomeScreen.tsx`: repeated `fontWeight: '900'` for CTA, labels, modal titles, status text
- `src/screens/SettingsScreen.tsx`: page title, section labels, status titles, option labels
- `src/components/ChatBubble.tsx`: sender/timestamp hierarchy could be quieter

Recommendation:

Create typography roles:

- `display`: 28-32, weight 800 or 900, used sparingly
- `title`: 18-22, weight 750 or 800
- `body`: 15-16, weight 400-500
- `caption`: 11-13, weight 500-600
- `chip`: 13-14, weight 700

Then audit every `fontWeight: '900'`. Most should become 700 or 800.

### P2. Relationship status has too many simultaneous visual motifs

On home, relationship state is represented by mood label, status selector, intimacy percentage, progress rail, moving heart, action pills, and primary CTA. This is emotionally rich, but it asks the user to parse too much.

Evidence:

- `src/screens/HomeScreen.tsx`: status selector, intimacy text, progress rail, heart marker, context action pills

Recommendation:

Make one relationship module:

- Top line: mood
- Main line: intimacy as plain text or compact ring
- One secondary affordance: “切换状态” or “查看关系”
- Remove filled progress tracks if the app wants a more premium companion feel; use a quiet inline meter or a single relationship badge.

### P2. Motion is partially thoughtful, but not centralized

Home respects Reduce Motion for idle frames. That is good. Chat waiting state uses a `setInterval` rotating text every 2400 ms without checking Reduce Motion. The decoration layer is static, and transitions between major panels are mostly abrupt.

Evidence:

- `src/screens/HomeScreen.tsx`: `AccessibilityInfo.isReduceMotionEnabled`
- `src/components/ChatBubble.tsx`: `WaitingIndicator` interval

Recommendation:

- Add a reusable `useReduceMotion` hook.
- Apply it to waiting hints, idle frame animation, and any future decorative motion.
- Use motion only for state transitions: status change, panel collapse, message arrival, and send feedback.

### P2. Settings page mixes user settings and internal/debug affordances

The five-tap version unlock is useful for development, but visually and conceptually it makes the normal settings screen carry hidden product modes, time travel, debug parameters, and version text.

Evidence:

- `src/screens/SettingsScreen.tsx`: `advancedTapCount`, `showAdvancedControls`, version tap footer
- `src/store/settingsStore.ts`: admin mode is reset on load

Recommendation:

- Move internal tools into an explicit dev-only screen or compile-time flag.
- Remove version text from the visible consumer settings footer, or place app version in an “About” row.
- Keep `debugNowTs` UI out of consumer IA.

### P3. Decorative text separators and middle dots appear in product copy

The skill flags middle-dot metadata as a common AI-tell when overused. This app uses it in diary titles, memory subtitles, version footer, failed state, and character metadata. Some are functional, but the pattern appears often.

Evidence:

- `src/services/diaryService.ts`
- `src/utils/memoryVisuals.ts`
- `src/screens/SettingsScreen.tsx`
- `src/components/ChatBubble.tsx`

Recommendation:

Keep separators only in compact metadata. Use line breaks or quiet columns elsewhere.

## Proposed Redesign Direction

Preserve:

- Full-screen character art
- Bottom dock home model
- Quick replies near composer
- Theme-specific character identity
- Memory/relationship as core product concepts

Retire or reduce:

- Broad emoji-as-icon usage
- Excessive radius variation
- Warm beige plus brass as default shell
- Filled progress rail plus decorative heart marker
- Chat decorative overlays competing with text
- Hidden debug controls in consumer settings

Target visual system:

- “Native soft premium companion”: immersive art, quiet surfaces, one accent, tactile controls, fewer decorative tokens.
- Radius: card 24, input 18, pill 999, expressive bubble corners only inside chat.
- Iconography: one icon family, no text glyph controls.
- Typography: fewer 900 weights, stronger body readability.
- Theme: character art drives emotion; system chrome stays restrained.

## 2-Week Execution Plan

Week 1:

1. Add `src/utils/designTokens.ts` with `radii`, typography roles, spacing, z layers, and surface alpha recipes.
2. Refactor `MessageInput`, `ChatBubble`, and chat header to use tokens.
3. Replace text glyph controls with one icon system.
4. Reduce chat decoration opacity or disable `ThemeArtworkLayer` for chat by default.
5. Add `useReduceMotion` and apply it to `WaitingIndicator`.

Week 2:

1. Refactor `HomeScreen` relationship module into a smaller `RelationshipStatusCard`.
2. Replace progress rail heart with a quieter status badge or compact meter.
3. Cool down `urbanClear` palette while preserving brand intent.
4. Move hidden admin/debug controls to a dev-only screen.
5. Run simulator snapshots for home, chat, settings, memory, service settings, and dark mode.

## Verification Steps

Run the app:

```bash
npx expo start --localhost --port 8081 --clear
```

Open in iOS simulator:

```text
Press i in the Expo terminal
```

Check Metro:

```bash
curl -s http://127.0.0.1:8081/status
```

Manual visual checklist:

- Home first viewport: character remains dominant, dock does not cover face or key art.
- Chat: every message remains readable over the character background.
- Composer: add, input, send use consistent icon style and hit targets.
- Quick replies: chips fit one line and do not crowd the input.
- Settings: user settings and internal tools are visually separated.
- Accessibility: icon-only buttons have labels, decorative glyphs are hidden.
- Reduce Motion: waiting indicator and idle frame changes do not auto-cycle when Reduce Motion is enabled.

## Key Assumptions

- This report is an audit only; no product UI code was changed.
- Simulator state was preserved; no app uninstall or simulator erase was performed.
- `design-taste-frontend` was applied contextually. The skill is primarily for web landing/redesign work, so web-specific checks such as SEO and Core Web Vitals were translated into native-mobile equivalents where useful.
- Current screenshots reflect Expo Go on iPhone 17 Pro, not a production development build.
