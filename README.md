# TypeStorm — Interactive Typing Speed & Accuracy Tester

An enhanced build of **Project 1**. Pure HTML + CSS + vanilla JS, no frameworks, no CDNs, no build step.
Double-click `index.html` and it runs.

```
typing-tester/
├── index.html   ← semantic markup, no inline styles, no onclick
├── style.css    ← Material 3 design tokens + all motion
├── script.js    ← the whole engine (one IIFE, strict mode)
├── README.md
└── tests/
    └── harness.js   ← dev-only verification suite (not needed to run the app)
```

---

## Run it

1. Unzip.
2. Double-click **`index.html`**.

That's it. No server, no install. (GIFs load from Tenor over the network; if you are offline the app
falls back to emoji badges and keeps working.)

---

## What's inside

### Core mechanics (per the brief)
| Step | Implementation |
|---|---|
| Quote injection | Random quote → `.split("")` equivalent → one `<span class="char">` per character via `textContent` (never `innerHTML`) |
| First-key countdown | `isTyping = false` → first keystroke flips it and starts a 60 s `setInterval` |
| Real-time audit | Every `input` event re-audits all spans in one O(n) pass, toggling `.correct` / `.incorrect` / `.current` |
| Live telemetry | 4 cards refreshed on every keystroke **and** every 1000 ms tick |
| Teardown | `finishRun()` clears the interval (guarded, idempotent), disables the input, opens the results modal |

### Formulas (exactly as specified, hardened at the edges)

```js
timeElapsedInMinutes = (MAX_TIME - timeLeft) / 60;
netWpm    = Math.round(((totalTyped - mistakes) / 5) / timeElapsedInMinutes);
accuracy  = Math.round(((totalKeystrokes - firstPassErrors) / totalKeystrokes) * 100);
```

* **Guards:** `totalKeystrokes === 0` → `100%`; `netWpm` clamped to `0` when negative, `NaN` or `Infinity`;
  accuracy clamped to `0–100`.
* **Why two error counters?** `mistakes` is *live* (wrong characters currently in the text — it drops when you
  backspace). `firstPassErrors` is *monotonic* (every wrong character you ever typed). Using the live count as
  the accuracy penalty — the literal reading of the brief — lets a user fix all their typos and land on 100 %.
  The results screen shows **both**: first-pass accuracy (the honest score) and corrected accuracy (the live one).
* **Timer:** `setInterval(tick, 1000)` drives the UI, but `timeLeft` is always **derived from `Date.now()`**, so
  browser background-tab throttling cannot pause or drift the clock.
* **Sub-second finishes:** a run finished inside the first second is scored against a 1-second floor, so a clean
  run never reports `0 WPM`.

### Features you approved

| # | Feature | Notes |
|---|---|---|
| A | **Ambient mascot GIF** | 6 states (idle / warming / cruising / flying / combo / struggling). `src` only changes when the *state* changes, so the GIF never restarts mid-animation. |
| B | **Tier roast GIFs** | 6 WPM tiers + 3 overrides (Flawless / Sniper / Butterfingers), each with a savage one-liner and its own GIF. |
| F1 | **Combo streak + multiplier** | Streak resets on error; tiers at 10 / 25 / 50 / 100 → ×1.02 → ×1.08. The multiplier is a **score bonus only — the headline WPM stays honest.** |
| F2 | **Synthesised keyclicks** | Web Audio API: filtered noise transient + triangle "thock", pitch varies on errors. No audio files. `AudioContext` is created on the first user gesture (autoplay policy) and there is a mute toggle. |
| F3 | **Difficulty modes** | Easy (lowercase, no punctuation) · Normal · Hard (punctuation/numbers/caps) · Chaos (randomised case). |
| F4 | **Screen shake + confetti** | Shake on error runs, canvas confetti on ≥70 WPM or 100 % accuracy. Both fully disabled by `prefers-reduced-motion` **and** by Calm mode. |
| F5 | **Accuracy health bar + rank** | Live bar (green/amber/red) and a rank chip: Beginner → Intermediate → Pro → Master → Legend. |
| F6 | **Personal best** | `localStorage`, per difficulty, with a "+N WPM on your best" banner. Wrapped in try/catch for Safari private mode. |
| F7 | **WPM-over-time graph** | Inline SVG polyline + area fill + 60 WPM reference line. No chart library. Final point always equals the headline WPM. |
| F8 | **Per-key heatmap + drill** | Tracks hits/misses per key, renders a QWERTY heat map, and generates a drill from your 5 worst keys. |

### Polish
Paste & drop blocking (anti-cheat) · first-run coach marks · print-friendly score sheet (`Ctrl/Cmd+P`) ·
Calm mode toggle · full keyboard support (`Esc` restart, `Tab` focus trap in the modal, arrow keys on the
difficulty control) · skip link · `aria-live` on the fields that need it.

---

## Accessibility

* **axe-core (WCAG 2.1 A + AA): 0 violations**, both on the idle screen and inside the results modal.
* The quote is `aria-hidden` with a hidden, described input — screen readers get a normal text field, not 300 spans.
* `.incorrect` is never colour-only: it also gets a wavy underline and heavier weight (WCAG 1.4.1).
* `@media (prefers-reduced-motion: reduce)` neutralises all motion (WCAG 2.3.3 is AAA, but honouring it is cheap).
* Contrast note: your locked palette `#16a34a` on white is **3.3:1** and `#dc2626` on `#fee2e2` is **3.95:1** —
  both pass AA for *large* text only, which is why the quote renders at ≥ 21 px.

---

## Verification

`tests/harness.js` runs the real `index.html` + `script.js` inside jsdom and simulates keystrokes.
**123 checks, all passing** — covering WPM/accuracy maths, the ÷0 / NaN / negative guards, corrected-vs-first-pass
accuracy, length clamping, timeout, background-tab drift recovery, 25× restart spam (zero leaked intervals),
tier selection, difficulty pools, personal best, reduced motion, paste blocking and static ground-rule checks.

```bash
npm install jsdom      # dev only
node tests/harness.js
```

Browser checks were also run with Chromium via Playwright: no console/page errors, modal opens on both desktop
and a 390 px mobile viewport, GIFs load (with emoji fallback), print stylesheet renders.

---

## Known caveats

1. **GIF URLs are third-party.** Every URL was fetched and visually verified during the build, but Tenor can remove
   a GIF at any time. `onerror` falls back to an emoji badge so nothing ever looks broken. To self-host, drop files
   in an `assets/` folder and swap the URLs in `MASCOT_GIFS` / the `TIERS` array at the top of the script state.
2. **Keyclicks need one click first.** Browsers require a user gesture before audio can start — the first click or
   keystroke arms it. This is by design, not a bug.
3. **Chaos mode is deliberately unfair.** It rewrites capitalisation on every new quote, including mixed case inside
   words, which inflates the mistake count. That is the joke.
4. **The 1-second scoring floor** only matters for automated typists; a human run is always scored on real elapsed time.
