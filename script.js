/* ==========================================================================
   TypeStorm — Interactive Typing Speed & Accuracy Tester
   script.js — pure vanilla ECMAScript (ES2020). No frameworks, no CDNs.
   --------------------------------------------------------------------------
   Architecture
   1.  Config & quote pools
   2.  DOM references
   3.  State
   4.  Small utilities (storage, toast, DOM)
   5.  Audio engine (Web Audio API, synthesised keyclicks)
   6.  Quote injection  (Step 1)
   7.  Run lifecycle: reset / first key / timer  (Step 2, Step 5)
   8.  Audit loop  (Step 3)
   9.  Telemetry maths  (Step 4)
   10. Renderers: metrics, combo, accuracy, mascot
   11. Finish, results modal, graph, heatmap
   12. Mascot GIF state machine
   13. Confetti
   14. Event wiring & boot
   ========================================================================== */

(function () {
  "use strict";

  /* ========================================================================
     1. CONFIG & QUOTE POOLS
     ===================================================================== */

  var MAX_TIME = 60;            // seconds per run
  var CHARS_PER_WORD = 5;       // international standard: 1 word = 5 keystrokes
  var WPM_TARGET = 60;          // reference line on the results graph
  var LOW_TIME = 10;            // seconds remaining when the clock turns red
  var EARLY_RUN_SECONDS = 2;    // suppress the unreliable first-2s WPM spike

  var STORAGE = {
    best: "typestorm.best.v1",
    sound: "typestorm.sound.v1",
    calm: "typestorm.calm.v1",
    coach: "typestorm.coach.v1"
  };

  /* Hero quote for the Easy pool. Lowercase only, no punctuation. */
  var QUOTE_POOLS = {
    easy: [
      "the only way to do great work is to love what you do and to keep showing up every single day",
      "small daily improvements are the secret to lasting results over time and nobody sees the work",
      "a smooth sea never made a skilled sailor so welcome the rough water and learn from it",
      "you do not have to be great to start but you have to start before you can ever be great",
      "the best time to plant a tree was twenty years ago the second best time is right now",
      "practice does not make perfect only perfect practice makes perfect so slow down and aim",
      "good code is its own best documentation and clear names will always beat clever little tricks",
      "the quieter you become the more you are able to hear the world around you and inside you",
      "focus on being productive instead of being busy and the results will quietly follow you",
      "every expert was once a beginner who refused to give up on the boring days of practice"
    ],
    normal: [
      "The only way to do great work is to love what you do. If you have not found it yet, keep looking.",
      "Simplicity is the soul of efficiency, and clarity is the kindness you show to the next reader.",
      "A ship in harbor is safe, but that is not what ships are built for. Sail out and take the risk.",
      "Talk is cheap. Show me the code, then show me the tests that prove the code actually works.",
      "The best way to predict the future is to invent it, one small commit at a time, every day.",
      "Programs must be written for people to read, and only incidentally for machines to execute.",
      "It always seems impossible until somebody rolls up their sleeves and does it anyway.",
      "Good design is as little design as possible: less, but better, and always on purpose.",
      "You cannot build a reputation on what you are going to do, only on what you actually ship.",
      "First, solve the problem. Then, write the code, and finally delete half of what you wrote."
    ],
    hard: [
      "Version 2.4.1 shipped on 03/09 at 17:30: 1,284 tests passed (99.7%) in 41s.",
      "Could you email the Q3 report to priya.raman@example.com before 9:00 AM, please?",
      "\"Ship it,\" said the lead. \"But first: run the linter, fix the 12 warnings, and update CHANGELOG.md.\"",
      "Pay invoice #A-4471 (INR 12,500.00) within 30 days, or a 2.5% late fee applies.",
      "The shortcut is Ctrl + Shift + P; the terminal command is npm run build -- --watch.",
      "On 2026-03-14 at 08:15, the server hit 92% CPU, 1.8 GB RAM, and 47 open sockets.",
      "Add the dependency: yarn add react@18.2.0 --save-exact, then restart the dev server.",
      "Fact check: 3 of 4 engineers prefer tabs over spaces (n=1,204, p<0.05).",
      "Type git commit -m \"fix: handle null user\" and then push the branch to origin/main.",
      "Battery: 12%. Wi-Fi: off. Coffee: cold. Deadline: 14:00. Morale: questionable."
    ]
  };

  /* Used by the weakest-keys drill. */
  var DRILL_QUOTE = "The quick brown fox jumps over the lazy dog while the sun sets behind the hills.";

  var MASCOT_GIFS = {
    idle: "https://media.tenor.com/gQfcDIc-LuUAAAAM/black-cat-sleep.gif",
    warming: "https://media.tenor.com/wQ6WUugvqYkAAAAM/omw-slow.gif",
    cruising: "https://media.tenor.com/EHvSWYJ5hDcAAAAM/typing-gif.gif",
    flying: "https://media.tenor.com/pBw2aSHw-3gAAAAM/hamster-hamster-wheel.gif",
    combo: "https://media.tenor.com/jlsPtnbFvzEAAAAM/fireworks-firework.gif",
    struggling: "https://media.tenor.com/lckUW9rwPk0AAAAM/olliesblog-this-is-fine-this-is-fine.gif"
  };

  var MASCOT_EMOJI = {
    idle: "😴", warming: "🐌", cruising: "🐱", flying: "🐹", combo: "🔥", struggling: "🙃"
  };

  var MASCOT_CAPTION = {
    idle: "waiting for you…",
    warming: "warming up. slowly. very slowly.",
    cruising: "cruising. respectable.",
    flying: "flying. someone stop them.",
    combo: "COMBO. do not blink.",
    struggling: "this is fine. everything is fine."
  };

  /* ========================================================================
     2. DOM REFERENCES
     ===================================================================== */

  function $(id) { return document.getElementById(id); }

  var dom = {
    app: $("app"),
    card: $("typing-card"),
    quoteDisplay: $("quote-display"),
    input: $("quote-input"),
    difficultyGroup: $("difficulty-group"),
    chipDifficulty: $("chip-difficulty"),
    chipSource: $("chip-source"),

    statTime: $("stat-time"),
    timeBar: $("time-bar"),
    cardTime: $("card-time"),
    statMistakes: $("stat-mistakes"),
    mistakesFoot: $("stat-mistakes-foot"),
    cardMistakes: $("card-mistakes"),
    statWpm: $("stat-wpm"),
    wpmFoot: $("stat-wpm-foot"),
    statAcc: $("stat-acc"),
    accFoot: $("stat-acc-foot"),

    combo: $("combo"),
    comboCount: $("combo-count"),
    comboMult: $("combo-mult"),
    accBar: $("acc-bar"),
    rankChip: $("rank-chip"),

    mascot: $("mascot"),
    mascotImg: $("mascot-img"),
    mascotEmoji: $("mascot-emoji"),
    mascotCaption: $("mascot-caption"),

    hintLine: $("hint-line"),
    hintText: $("hint-text"),
    btnRestart: $("btn-restart"),
    btnNew: $("btn-new"),
    soundToggle: $("sound-toggle"),
    calmToggle: $("calm-toggle"),
    coach: $("coach"),
    coachDismiss: $("coach-dismiss"),

    backdrop: $("modal-backdrop"),
    modal: $("modal"),
    modalClose: $("modal-close"),
    modalKicker: $("modal-kicker"),
    modalTitle: $("modal-title"),
    modalRoast: $("modal-roast"),
    resultGif: $("result-gif"),
    resultGifFallback: $("result-gif-fallback"),
    heroTier: $("hero-tier"),
    heroWpm: $("hero-wpm"),
    heroSub: $("hero-sub"),
    heroPb: $("hero-pb"),
    pbDelta: $("pb-delta"),

    resGross: $("res-gross"),
    resAcc: $("res-acc"),
    resAccLive: $("res-acc-live"),
    resMistakes: $("res-mistakes"),
    resKeys: $("res-keys"),
    resFixed: $("res-fixed"),
    resConsistency: $("res-consistency"),
    resCombo: $("res-combo"),

    graph: $("wpm-graph"),
    heatmap: $("heatmap"),
    heatNote: $("heat-note"),
    btnDrill: $("btn-drill"),
    btnAgain: $("btn-again"),
    btnNext: $("btn-next"),

    toast: $("toast"),
    confetti: $("confetti")
  };

  /* ========================================================================
     3. STATE
     ===================================================================== */

  var state = {
    difficulty: "easy",
    quote: "",
    charCodes: null,
    quoteLength: 0,
    quoteNumber: 1,
    poolSize: 10,

    isActive: false,       // a run is in progress (or finished, before restart)
    isTyping: false,       // first key has been pressed
    isComposing: false,    // IME composition in flight
    startTime: 0,
    timerId: null,
    timeLeft: MAX_TIME,

    totalTyped: 0,         // committed characters (progress through the quote)
    totalKeystrokes: 0,    // monotonic: every inserted character, never decreases
    mistakes: 0,           // live: wrong characters currently in the text
    firstPassErrors: 0,    // monotonic: every wrong character ever typed (accuracy penalty)

    streak: 0,
    bestCombo: 0,
    perKey: Object.create(null),
    samples: [],           // { t, wpm } once per second
    lastKeyAt: 0,
    lastWpm: 0,
    lastMascotState: "",

    soundEnabled: true,
    calmMode: false,
    drillText: null,       // pending drill string, consumed by the next reset
    drillActive: false,
    finishedReason: ""
  };

  /* ========================================================================
     4. UTILITIES
     ===================================================================== */

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function readStore(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) { return fallback; }
  }

  function writeStore(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* private mode */ }
  }

  var toastTimer = null;
  function toast(message) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      dom.toast.classList.remove("is-visible");
    }, 2200);
  }

  function formatClock(totalSeconds) {
    var s = Math.max(0, totalSeconds);
    var m = Math.floor(s / 60);
    var rest = s % 60;
    return m + ":" + (rest < 10 ? "0" : "") + rest;
  }

  function displayKey(key) { return key === " " ? "space" : key; }

  /* ========================================================================
     5. AUDIO ENGINE — synthesised mechanical keyclicks (no audio files)
     ===================================================================== */

  var audio = { ctx: null, noise: null };

  function ensureAudioContext() {
    if (!state.soundEnabled) return null;
    if (!audio.ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      try { audio.ctx = new Ctor(); } catch (err) { return null; }
    }
    if (audio.ctx.state === "suspended" && audio.ctx.resume) {
      audio.ctx.resume().catch(function () { /* ignore */ });
    }
    return audio.ctx;
  }

  function noiseBuffer(ctx) {
    if (audio.noise) return audio.noise;
    var frames = Math.floor(ctx.sampleRate * 0.06);
    var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i++) {
      /* decaying white noise — a key cap hitting a plate */
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.4);
    }
    audio.noise = buffer;
    return buffer;
  }

  function playClick(isError) {
    var ctx = ensureAudioContext();
    if (!ctx || ctx.state !== "running") return;
    var t = ctx.currentTime;

    /* click transient */
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    var band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = isError ? 1500 : 3300;
    band.Q.value = 1.2;
    var g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t);
    g1.gain.exponentialRampToValueAtTime(isError ? 0.16 : 0.10, t + 0.002);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(band).connect(g1).connect(ctx.destination);
    src.start(t);
    src.stop(t + 0.07);

    /* body thock */
    var osc = ctx.createOscillator();
    var g2 = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(isError ? 130 : 190, t);
    osc.frequency.exponentialRampToValueAtTime(isError ? 72 : 108, t + 0.05);
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.07, t + 0.003);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    osc.connect(g2).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  function playFanfare() {
    var ctx = ensureAudioContext();
    if (!ctx || ctx.state !== "running") return;
    var notes = [523.25, 659.25, 783.99];
    notes.forEach(function (freq, index) {
      var t = ctx.currentTime + index * 0.11;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.13, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  /* ========================================================================
     6. QUOTE INJECTION (Step 1)
     ===================================================================== */

  function applyChaos(text) {
    var out = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      out += Math.random() < 0.42 ? ch.toUpperCase() : ch.toLowerCase();
    }
    return out;
  }

  function pickQuote() {
    if (state.drillText) {
      var drill = state.drillText;
      state.drillText = null;
      state.drillActive = true;
      return drill;
    }
    state.drillActive = false;
    var pool;
    if (state.difficulty === "chaos") {
      pool = QUOTE_POOLS.normal.concat(QUOTE_POOLS.hard);
    } else {
      pool = QUOTE_POOLS[state.difficulty] || QUOTE_POOLS.easy;
    }
    var index = Math.floor(Math.random() * pool.length);
    state.poolSize = pool.length;
    state.quoteNumber = index + 1;
    var text = pool[index];
    return state.difficulty === "chaos" ? applyChaos(text) : text;
  }

  /**
   * Splits the quote into one <span> per character and injects it.
   * Uses textContent (never innerHTML) so apostrophes and angle brackets are safe.
   */
  function injectQuote(text) {
    state.quote = text;
    state.quoteLength = text.length;
    state.charCodes = new Uint16Array(text.length);
    for (var i = 0; i < text.length; i++) state.charCodes[i] = text.charCodeAt(i);

    var fragment = document.createDocumentFragment();
    var spans = new Array(text.length);

    for (var j = 0; j < text.length; j++) {
      var ch = text.charAt(j);
      var span = document.createElement("span");
      span.className = "char" + (j === 0 ? " current" : "") + (ch === " " ? " space" : "");
      span.dataset.char = ch;
      span.dataset.index = String(j);
      span.textContent = ch;
      fragment.appendChild(span);
      spans[j] = span;
    }

    dom.quoteDisplay.textContent = "";
    dom.quoteDisplay.appendChild(fragment);
    dom.quoteDisplay.classList.remove("is-empty", "is-done");
    state.spans = spans;
  }

  /* ========================================================================
     7. RUN LIFECYCLE (Step 2, Step 5)
     ===================================================================== */

  function teardownTimer() {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function resetRun(text) {
    teardownTimer();

    state.isActive = true;
    state.isTyping = false;
    state.isComposing = false;
    state.startTime = 0;
    state.timeLeft = MAX_TIME;
    state.totalTyped = 0;
    state.totalKeystrokes = 0;
    state.mistakes = 0;
    state.firstPassErrors = 0;
    state.streak = 0;
    state.bestCombo = 0;
    state.perKey = Object.create(null);
    state.samples = [];
    state.lastKeyAt = 0;
    state.lastWpm = 0;
    state.finishedReason = "";

    dom.input.value = "";
    dom.input.disabled = false;
    dom.card.classList.remove("is-done", "is-low", "is-shaking");
    dom.modalCleanupFocus = null;

    var label = { easy: "Easy", normal: "Normal", hard: "Hard", chaos: "Chaos" }[state.difficulty];
    dom.chipDifficulty.textContent = state.drillActive ? "Drill" : label;   // "drill" overrides the mode chip
    dom.chipSource.textContent = state.drillActive
      ? "weak-key drill"
      : "Quote " + state.quoteNumber + " of " + state.poolSize;

    injectQuote(text);
    renderTime();
    renderMetrics();
    renderCombo();
    setMascot("idle");
    setHint("Start typing to begin the clock", "idle");
    dom.statWpm.textContent = "0";
    dom.wpmFoot.textContent = "type to start";
    dom.statMistakes.textContent = "0";
    dom.mistakesFoot.textContent = "live in text";
    dom.cardMistakes.classList.remove("is-hurt");

    dom.input.focus({ preventScroll: true });
  }

  function startClock() {
    state.startTime = Date.now();
    state.isTyping = true;
    state.samples.push({ t: 0, wpm: 0 });
    teardownTimer(); // never allow two clocks
    state.timerId = window.setInterval(tick, 1000);
    setHint("Live. Do not look at the clock.", "live");
  }

  /** Absolute-clock tick: timeLeft is derived from Date.now(), never decremented. */
  function tick() {
    if (!state.isTyping || !state.isActive) return;

    var elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    state.timeLeft = Math.max(0, MAX_TIME - elapsed);

    renderTime();
    renderMetrics();
    renderAccuracy();                 // keep the health bar + rank chip in sync with the clock
    setMascot(chooseMascotState());   // mascot reacts to the smoothed WPM, not only to keys

    /* one WPM sample per second, for the results graph */
    if (state.samples.length < MAX_TIME + 2) {
      state.samples.push({ t: elapsed, wpm: state.lastWpm });
    }

    if (state.timeLeft <= 0) finishRun("timeout");
  }

  /* ========================================================================
     8. AUDIT LOOP (Step 3)
     ===================================================================== */

  function onInput(event) {
    if (!state.isActive) {
      /* a finished run must never mutate results */
      event.target.value = event.target.value.slice(0, state.totalTyped);
      return;
    }
    if (state.isComposing || (event && event.isComposing)) return;

    var value = dom.input.value;

    /* length clamp: you cannot type past the end of the quote */
    if (value.length > state.quoteLength) {
      value = value.slice(0, state.quoteLength);
      dom.input.value = value;
    }

    var inputType = event && event.inputType ? event.inputType : "insertText";
    var inserted = event && typeof event.data === "string" ? event.data : "";
    var isInsert = inputType.indexOf("insert") === 0 && inserted.length > 0;

    if (isInsert) {
      /* ---- keystroke accounting (monotonic denominator) + per-key stats ---- */
      var startIndex = value.length - inserted.length;
      for (var k = 0; k < inserted.length; k++) {
        var index = startIndex + k;
        state.totalKeystrokes++;
        if (index < 0 || index >= state.quoteLength) continue;
        var expected = state.quote.charAt(index);
        var actual = inserted.charAt(k);
        var key = expected === " " ? " " : expected.toLowerCase();
        var entry = state.perKey[key] || (state.perKey[key] = { hits: 0, misses: 0 });

        if (actual === expected) {
          entry.hits++;
          state.streak++;
          if (state.streak > state.bestCombo) state.bestCombo = state.streak;
        } else {
          entry.misses++;
          state.firstPassErrors++;
          state.streak = 0;
        }
      }
      playClick(state.streak === 0 && inserted.length > 0);
    } else if (inputType.indexOf("delete") === 0) {
      /* backspace/delete: not a new keystroke; it fixes the live error count only */
      if (state.streak > 0) state.streak = Math.max(0, state.streak - 1);
    }

    /* first key starts the clock */
    if (!state.isTyping && value.length > 0) startClock();

    state.totalTyped = value.length;
    auditSpans(value);
    renderMetrics();
    renderCombo();
    setMascot(chooseMascotState());
    renderAccuracy();

    if (value.length === state.quoteLength) {
      if (state.mistakes === 0) {
        finishRun("completed");
      } else {
        setHint("Full length reached — backspace the red letters to finish.", "warn");
      }
    } else if (value.length > 0) {
      setHint("Live. Do not look at the clock.", "live");
    }
  }

  /** Compares the whole committed value against the span array in one pass. */
  function auditSpans(value) {
    var spans = state.spans;
    var liveMistakes = 0;
    var cursor = value.length;

    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var next;

      if (i < cursor) {
        if (value.charCodeAt(i) === state.charCodes[i]) {
          next = "char correct";
        } else {
          next = "char incorrect";
          liveMistakes++;
        }
      } else if (i === cursor) {
        next = "char current";
      } else {
        next = "char";
      }

      if (span.className !== next) span.className = next;
    }

    state.mistakes = liveMistakes;
  }

  /* ========================================================================
     9. TELEMETRY MATHS (Step 4)
     ===================================================================== */

  /**
   * Net WPM (brief formula):
   *   timeElapsedInMinutes = (MAX_TIME - timeLeft) / 60
   *   netWpm = round(((totalTyped - mistakes) / 5) / timeElapsedInMinutes)
   * Guards: zero/negative time, negative result, NaN, Infinity.
   *
   * Accuracy (brief formula) hardened:
   *   accuracy = round(((totalKeystrokes - firstPassErrors) / totalKeystrokes) * 100)
   *   Both counters are monotonic, so fixing a typo can never erase it from the
   *   score, and 100% is shown when nothing has been typed yet.
   *   A second, live figure ("corrected accuracy") uses the live mistakes count
   *   so the user can watch their text become clean in real time.
   */
  var MIN_SAMPLE_SECONDS = 1;   // minimum scoring window, prevents ÷0 and absurd infinities

  function computeMetrics() {
    var elapsedSeconds = MAX_TIME - state.timeLeft;
    /* A run finished inside the first second (only reachable with an automated
       typist) would otherwise divide by zero and report 0 WPM for a clean run.
       The clock still DISPLAYS the true time; only the score uses the floor. */
    var scoringSeconds = Math.max(elapsedSeconds, MIN_SAMPLE_SECONDS);
    var timeElapsedInMinutes = scoringSeconds / 60;
    var totalTyped = state.totalTyped;

    var netWpm = 0;
    if (timeElapsedInMinutes > 0) {
      netWpm = Math.round(((totalTyped - state.mistakes) / CHARS_PER_WORD) / timeElapsedInMinutes);
    }
    if (!Number.isFinite(netWpm) || netWpm < 0) netWpm = 0;

    var grossWpm = 0;
    if (timeElapsedInMinutes > 0) {
      grossWpm = Math.round((totalTyped / CHARS_PER_WORD) / timeElapsedInMinutes);
    }
    if (!Number.isFinite(grossWpm) || grossWpm < 0) grossWpm = 0;

    var accuracy;
    if (state.totalKeystrokes === 0) {
      accuracy = 100;
    } else {
      accuracy = Math.round(((state.totalKeystrokes - state.firstPassErrors) / state.totalKeystrokes) * 100);
    }
    accuracy = clamp(Number.isFinite(accuracy) ? accuracy : 100, 0, 100);

    var accuracyLive;
    if (totalTyped === 0) {
      accuracyLive = 100;
    } else {
      accuracyLive = clamp(Math.round(((totalTyped - state.mistakes) / totalTyped) * 100), 0, 100);
    }

    return {
      netWpm: netWpm,
      grossWpm: grossWpm,
      accuracy: accuracy,
      accuracyLive: accuracyLive,
      elapsedMinutes: timeElapsedInMinutes,
      elapsedSeconds: elapsedSeconds,
      scoringSeconds: scoringSeconds
    };
  }

  /* ========================================================================
     10. RENDERERS
     ===================================================================== */

  function renderTime() {
    dom.statTime.textContent = formatClock(state.timeLeft);
    var ratio = clamp(state.timeLeft / MAX_TIME, 0, 1);
    dom.timeBar.style.transform = "scaleX(" + ratio + ")";
    dom.timeBar.style.background = ratio > 0.5
      ? "var(--state-good)"
      : ratio > 0.17 ? "var(--state-warn)" : "var(--state-bad)";
    dom.cardTime.classList.toggle("is-low", state.timeLeft <= LOW_TIME && state.isTyping);
    dom.card.classList.toggle("is-low", state.timeLeft <= LOW_TIME && state.isTyping);
  }

  function renderMetrics() {
    var m = computeMetrics();

    /* early-run inflation guard: the first 2 seconds are statistically noise */
    var shownWpm = m.netWpm;
    var early = state.isTyping && m.elapsedSeconds < EARLY_RUN_SECONDS;
    if (early) shownWpm = 0;
    state.lastWpm = shownWpm;

    dom.statWpm.textContent = String(shownWpm);
    if (!state.isTyping) {
      dom.wpmFoot.textContent = "type to start";
    } else if (early) {
      dom.wpmFoot.textContent = "settling…";
    } else {
      dom.wpmFoot.textContent = "net of errors";
    }

    dom.statMistakes.textContent = String(state.mistakes);
    dom.mistakesFoot.textContent = state.mistakes === 1 ? "live in text" : "live in text";
    dom.cardMistakes.classList.toggle("is-hurt", state.mistakes > 0);

    dom.statAcc.textContent = m.accuracy + "%";
    dom.accFoot.textContent = m.accuracy >= 98 ? "surgical" : m.accuracy >= 90 ? "first pass" : "bleeding";
  }

  function renderAccuracy() {
    var m = computeMetrics();
    dom.accBar.style.transform = "scaleX(" + clamp(m.accuracy / 100, 0, 1) + ")";
    dom.accBar.style.background = m.accuracy >= 97
      ? "linear-gradient(90deg, #22c55e, var(--state-good))"
      : m.accuracy >= 90
        ? "linear-gradient(90deg, #fbbf24, var(--state-warn))"
        : "linear-gradient(90deg, #f87171, var(--state-bad))";

    var rank = "Unranked";
    if (state.isTyping) {
      var wpm = m.netWpm;
      if (wpm >= 100) rank = "Legend";
      else if (wpm >= 80) rank = "Master";
      else if (wpm >= 60) rank = "Pro";
      else if (wpm >= 40) rank = "Intermediate";
      else rank = "Beginner";
    }
    dom.rankChip.textContent = rank;
    dom.rankChip.dataset.rank = rank;
  }

  function comboMultiplier(streak) {
    if (streak >= 100) return 1.08;
    if (streak >= 50) return 1.06;
    if (streak >= 25) return 1.04;
    if (streak >= 10) return 1.02;
    return 1;
  }

  function comboMultiplierText(streak) {
    if (streak >= 100) return "×1.08";
    if (streak >= 50) return "×1.06";
    if (streak >= 25) return "×1.04";
    if (streak >= 10) return "×1.02";
    return "×1.00";
  }

  function renderCombo() {
    var streak = state.streak;
    dom.comboCount.textContent = String(streak);
    dom.comboMult.textContent = comboMultiplierText(streak);
    dom.combo.dataset.active = streak >= 10 ? "true" : "false";
    dom.combo.dataset.tier = streak >= 100 ? "4" : streak >= 50 ? "3" : streak >= 25 ? "2" : streak >= 10 ? "1" : "0";

    if (streak >= 10 && dom.combo.dataset.bumped !== "true") {
      dom.combo.dataset.bumped = "true";
      dom.combo.classList.remove("is-bumped");
      /* force restart of the bump animation */
      void dom.combo.offsetWidth;
      dom.combo.classList.add("is-bumped");
    } else if (streak < 10) {
      dom.combo.dataset.bumped = "false";
      dom.combo.classList.remove("is-bumped");
    }
  }

  function setHint(text, mode) {
    dom.hintText.textContent = text;
    dom.hintLine.classList.remove("is-live", "is-warn");
    if (mode === "live") dom.hintLine.classList.add("is-live");
    if (mode === "warn") dom.hintLine.classList.add("is-warn");
  }

  function chooseMascotState() {
    if (!state.isActive) return "idle";
    if (!state.isTyping) return "idle";
    if (state.mistakes >= 8) return "struggling";
    if (state.streak >= 25) return "combo";
    var wpm = state.lastWpm;
    if (wpm >= 70) return "flying";
    if (wpm >= 35) return "cruising";
    return "warming";
  }

  /* ========================================================================
     12. MASCOT GIF STATE MACHINE
     ===================================================================== */

  function setMascot(nextState) {
    if (state.lastMascotState === nextState) return; // never restart the GIF per keystroke
    state.lastMascotState = nextState;
    dom.mascot.dataset.state = nextState;
    dom.mascotCaption.textContent = MASCOT_CAPTION[nextState] || "";
    dom.mascotEmoji.textContent = MASCOT_EMOJI[nextState] || "⌨️";

    if (state.calmMode) return;

    var src = MASCOT_GIFS[nextState];
    if (!src) return;
    dom.mascotImg.classList.remove("is-loaded");
    dom.mascotImg.onload = function () { dom.mascotImg.classList.add("is-loaded"); };
    dom.mascotImg.onerror = function () { dom.mascotImg.classList.remove("is-loaded"); };
    dom.mascotImg.src = src;
  }

  /* ========================================================================
     11. FINISH, RESULTS MODAL, GRAPH, HEATMAP
     ===================================================================== */

  var TIERS = [
    {
      key: "snail", min: 0,
      kicker: "Run complete",
      title: "The keyboard won.",
      tier: "Tier — Snail With A Keyboard",
      roast: "You type like the keyboard owes you money and you are afraid to collect. Fewer fingers, more letters — this is not a negotiation.",
      gif: "https://media.tenor.com/jE6V0Uha3FgAAAAM/snail.gif",
      emoji: "🐌"
    },
    {
      key: "sloth", min: 25,
      kicker: "Run complete",
      title: "Technically typing.",
      tier: "Tier — Glacial",
      roast: "Somewhere a sloth just checked your WPM and felt good about itself. Your accuracy is fine; your speed needs a stern talking to.",
      gif: "https://media.tenor.com/-9K-f7qX0d4AAAAM/sloth-walking-slow.gif",
      emoji: "🦥"
    },
    {
      key: "average", min: 40,
      kicker: "Run complete",
      title: "Perfectly average.",
      tier: "Tier — Average Human",
      roast: "Statistically, you are the control group of this website. Nothing wrong with that — but the group chat expects more.",
      gif: "https://media.tenor.com/80uhqkNjzb0AAAAM/thumbs-up.gif",
      emoji: "👍"
    },
    {
      key: "fast", min: 60,
      kicker: "Run complete",
      title: "Okay, actually fast.",
      tier: "Tier — Actually Fast",
      roast: "Your Slack replies now arrive before the question finishes. Coworkers are intimidated and that is a compliment.",
      gif: "https://media.tenor.com/bzgA19vMhWkAAAAM/rocket.gif",
      emoji: "🚀"
    },
    {
      key: "elite", min: 80,
      kicker: "Run complete",
      title: "Unnecessarily fast.",
      tier: "Tier — Scary Fast",
      roast: "Nobody needs to type this fast, which is exactly why we respect it. Please stop typing; you are making the keyboard nervous.",
      gif: "https://media.tenor.com/yw7lR4A6vBAAAAAM/fireworks-firework.gif",
      emoji: "🎆"
    },
    {
      key: "machine", min: 100,
      kicker: "Run complete",
      title: "Are you a machine?",
      tier: "Tier — Machine",
      roast: "You are not typing anymore, you are leaking text onto the screen. Blink twice if you are human. We will wait.",
      gif: "https://media.tenor.com/sunJiHipGScAAAAM/boom-cat.gif",
      emoji: "🤖"
    }
  ];

  var OVERRIDES = {
    flawless: {
      key: "flawless",
      kicker: "Flawless run",
      title: "Zero mistakes. Unsettling.",
      tier: "Tier — Flawless",
      roast: "A perfect run with nothing to correct. You were never in danger, and honestly it is a little unsettling. Weirdo. Respectfully.",
      gif: "https://media.tenor.com/a1IwtdXx0RMAAAAM/confetti-purple.gif",
      emoji: "💯"
    },
    sniper: {
      key: "sniper",
      kicker: "Sniper run",
      title: "Well, that was grim.",
      tier: "Tier — Sniper",
      roast: "Slow and deadly. Your WPM is unimpressive and your accuracy is offensive — nobody can use this against you. Sickening discipline.",
      gif: "https://media.tenor.com/JsS1AQuKxxcAAAAM/drawify-goal.gif",
      emoji: "🎯"
    },
    butterfingers: {
      key: "butterfingers",
      kicker: "Accuracy incident",
      title: "You have invented new words.",
      tier: "Tier — Butterfingers",
      roast: "Somewhere a dictionary is crying. Speed means nothing when the output looks like a captcha. Slow down, hero.",
      gif: "https://media.tenor.com/hl4H1KOXEMcAAAAM/bongo-cat-keyboard-smash.gif",
      emoji: "🫠"
    }
  };

  function selectTier(metrics, reason) {
    if (reason === "completed" && metrics.accuracy === 100) return OVERRIDES.flawless;
    /* Sniper = genuinely slow-but-deadly. A near-empty run is not "disciplined",
       it is just a snail, so require at least 20 WPM before awarding it. */
    if (metrics.accuracy >= 98 && metrics.netWpm >= 20 && metrics.netWpm < 40) return OVERRIDES.sniper;
    if (metrics.accuracy < 85 && metrics.netWpm > 0) return OVERRIDES.butterfingers;

    var tier = TIERS[0];
    for (var i = 0; i < TIERS.length; i++) {
      if (metrics.netWpm >= TIERS[i].min) tier = TIERS[i];
    }
    return tier;
  }

  function consistencyScore(samples) {
    var values = samples
      .filter(function (s) { return s.t > 0; })
      .map(function (s) { return s.wpm; });
    if (values.length < 3) return null;
    var mean = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
    if (mean <= 0) return null;
    var variance = values.reduce(function (acc, v) { return acc + Math.pow(v - mean, 2); }, 0) / values.length;
    return clamp(Math.round(100 - (Math.sqrt(variance) / mean) * 100), 0, 100);
  }

  function finishRun(reason) {
    if (!state.isActive) return;

    state.isActive = false;
    state.isTyping = false;
    state.finishedReason = reason;
    teardownTimer();

    dom.input.disabled = true;
    dom.card.classList.add("is-done");
    dom.quoteDisplay.classList.add("is-done");
    dom.cardTime.classList.remove("is-low");
    dom.card.classList.remove("is-low");
    setHint("Run locked. Restart to go again.", "idle");

    /* final metrics are computed from the frozen clock */
    renderTime();
    renderMetrics();
    renderAccuracy();
    setMascot("idle");

    /* record one last sample so the graph's final point equals the headline WPM */
    var preMetrics = computeMetrics();
    state.samples.push({ t: preMetrics.elapsedSeconds, wpm: preMetrics.netWpm });

    var metrics = computeMetrics();
    if (reason === "timeout" && metrics.elapsedSeconds < MAX_TIME) {
      /* safety: a late tick must not freeze a shorter clock */
      state.timeLeft = 0;
      renderTime();
      metrics = computeMetrics();
    }

    buildResults(metrics, reason);
    openModal(metrics);
  }

  function buildResults(metrics, reason) {
    var tier = selectTier(metrics, reason);

    dom.modalKicker.textContent = tier.kicker;
    dom.modalTitle.textContent = tier.title;
    dom.modalRoast.textContent = tier.roast;
    dom.heroTier.textContent = tier.tier;
    dom.heroWpm.textContent = String(metrics.netWpm);
    dom.heroSub.textContent = metrics.accuracy + "% accuracy · " + state.mistakes +
      (state.mistakes === 1 ? " mistake" : " mistakes") + " · " +
      formatClock(metrics.elapsedSeconds) + " elapsed";

    dom.resGross.textContent = String(metrics.grossWpm);
    dom.resAcc.textContent = metrics.accuracy + "%";
    dom.resAccLive.textContent = metrics.accuracyLive + "%";
    dom.resMistakes.textContent = String(state.mistakes);
    dom.resKeys.textContent = String(state.totalKeystrokes);
    dom.resFixed.textContent = String(Math.max(0, state.totalKeystrokes - state.totalTyped));

    var consistency = consistencyScore(state.samples);
    dom.resConsistency.textContent = consistency === null ? "—" : consistency + "%";
    dom.resCombo.textContent = String(state.bestCombo);

    /* GIF + emoji fallback */
    dom.resultGif.classList.remove("is-loaded");
    dom.resultGif.onload = function () { dom.resultGif.classList.add("is-loaded"); };
    dom.resultGif.onerror = function () { dom.resultGif.classList.remove("is-loaded"); };
    dom.resultGif.alt = tier.title;
    dom.resultGifFallback.textContent = tier.emoji;
    dom.resultGif.src = tier.gif;

    buildGraph(state.samples, metrics);
    buildHeatmap();

    /* personal best (skip drills) */
    if (!state.drillActive && state.totalTyped > 0) {
      var best = readStore(STORAGE.best, {}) || {};
      var prev = best[state.difficulty];
      if (!prev || metrics.netWpm > prev.wpm) {
        best[state.difficulty] = { wpm: metrics.netWpm, accuracy: metrics.accuracy, at: Date.now() };
        writeStore(STORAGE.best, best);
        dom.heroPb.hidden = false;
        dom.pbDelta.textContent = prev ? "+" + (metrics.netWpm - prev.wpm) + " WPM on your best" : "first run in this mode";
      } else {
        dom.heroPb.hidden = true;
      }
    } else {
      dom.heroPb.hidden = true;
    }
  }

  /** Builds the WPM-over-time polyline as inline SVG (no chart library). */
  function buildGraph(samples, metrics) {
    var width = 600;
    var height = 160;
    var padX = 26;
    var padTop = 14;
    var padBottom = 22;

    var data = samples.slice();
    if (data.length === 0) data = [{ t: 0, wpm: 0 }];
    if (data.length === 1) data.push({ t: 1, wpm: data[0].wpm });

    var maxWpm = Math.max(WPM_TARGET + 10, 20);
    data.forEach(function (d) { maxWpm = Math.max(maxWpm, d.wpm); });
    maxWpm = Math.ceil(maxWpm / 20) * 20;

    var lastT = Math.max(1, data[data.length - 1].t);
    var plotW = width - padX - 8;
    var plotH = height - padTop - padBottom;

    function x(t) { return padX + (t / lastT) * plotW; }
    function y(wpm) { return padTop + plotH - (clamp(wpm, 0, maxWpm) / maxWpm) * plotH; }

    var svg = [];
    svg.push('<defs>');
    svg.push('<linearGradient id="wpmFill" x1="0" y1="0" x2="0" y2="1">');
    svg.push('<stop offset="0%" stop-color="#4f46e5" stop-opacity=".26"/>');
    svg.push('<stop offset="100%" stop-color="#4f46e5" stop-opacity="0"/>');
    svg.push('</linearGradient>');
    svg.push('</defs>');

    /* horizontal grid at 25/50/75/100% of the scale */
    [0, 0.25, 0.5, 0.75, 1].forEach(function (fraction) {
      var gy = padTop + plotH - fraction * plotH;
      svg.push('<line class="grid-line" x1="' + padX + '" y1="' + gy + '" x2="' + (width - 8) + '" y2="' + gy + '"/>');
    });

    /* 60 WPM reference */
    if (WPM_TARGET <= maxWpm) {
      var ty = y(WPM_TARGET);
      svg.push('<line class="target-line" x1="' + padX + '" y1="' + ty + '" x2="' + (width - 8) + '" y2="' + ty + '"/>');
      svg.push('<text class="axis-text" x="' + (padX + 3) + '" y="' + (ty - 4) + '">' + WPM_TARGET + ' wpm</text>');
    }

    var line = data.map(function (d, i) {
      return (i === 0 ? "M" : "L") + x(d.t).toFixed(1) + " " + y(d.wpm).toFixed(1);
    }).join(" ");

    svg.push('<path class="area" d="' + line + " L" + x(lastT).toFixed(1) + " " + (padTop + plotH) +
      " L" + x(data[0].t).toFixed(1) + " " + (padTop + plotH) + ' Z"/>');
    svg.push('<path class="line" d="' + line + '"/>');

    var last = data[data.length - 1];
    svg.push('<circle class="dot" cx="' + x(last.t).toFixed(1) + '" cy="' + y(last.wpm).toFixed(1) + '" r="3.4"/>');
    svg.push('<text class="axis-text" x="' + (width - 8) + '" y="' + (height - 6) + '" text-anchor="end">' +
      formatClock(lastT) + ' · peak ' + Math.max.apply(null, data.map(function (d) { return d.wpm; })) + ' wpm</text>');

    dom.graph.textContent = "";
    dom.graph.setAttribute("viewBox", "0 0 " + width + " " + height);
    dom.graph.insertAdjacentHTML("afterbegin", svg.join(""));

    var title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = "Net words per minute over " + formatClock(lastT) + ", ending at " +
      metrics.netWpm + " WPM.";
    dom.graph.appendChild(title);
  }

  var KEY_ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"]
  ];

  function heatLevel(count) {
    if (count <= 0) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    return 3;
  }

  function buildHeatmap() {
    var totals = [];
    var worst = [];

    Object.keys(state.perKey).forEach(function (key) {
      var entry = state.perKey[key];
      totals.push({ key: key, misses: entry.misses, hits: entry.hits });
      if (entry.misses > 0) worst.push({ key: key, misses: entry.misses });
    });

    worst.sort(function (a, b) { return b.misses - a.misses; });
    var byKey = Object.create(null);
    totals.forEach(function (t) { byKey[t.key] = t; });

    dom.heatmap.textContent = "";

    KEY_ROWS.forEach(function (row, rowIndex) {
      row.forEach(function (key) {
        var stats = byKey[key] || { misses: 0, hits: 0 };
        var level = heatLevel(stats.misses);
        var cell = document.createElement("span");
        cell.className = "key" + (rowIndex === 3 && key === "m" ? " key--ghost-none" : "");
        cell.textContent = key.toUpperCase();
        cell.dataset.heat = String(level);
        if (level === 3) cell.dataset.count = String(stats.misses);
        if (state.totalKeystrokes === 0) cell.classList.add("key--ghost");
        cell.title = key.toUpperCase() + ": " + stats.misses + " missed, " + stats.hits + " correct";
        dom.heatmap.appendChild(cell);
      });
      /* pad the short rows so the grid stays aligned */
      var pad = 10 - row.length;
      for (var p = 0; p < pad; p++) {
        var spacer = document.createElement("span");
        spacer.className = "key key--ghost";
        spacer.setAttribute("aria-hidden", "true");
        dom.heatmap.appendChild(spacer);
      }
    });

    var spaceStats = byKey[" "] || { misses: 0, hits: 0 };
    var spaceCell = document.createElement("span");
    spaceCell.className = "key key--space";
    spaceCell.textContent = "SPACE";
    spaceCell.dataset.heat = String(heatLevel(spaceStats.misses));
    if (spaceStats.misses > 3) spaceCell.dataset.count = String(spaceStats.misses);
    spaceCell.title = "Space: " + spaceStats.misses + " missed, " + spaceStats.hits + " correct";
    dom.heatmap.appendChild(spaceCell);

    if (worst.length === 0) {
      dom.heatNote.textContent = state.totalKeystrokes === 0
        ? "You did not type anything. Bold strategy."
        : "No missed keys. Suspicious. We are watching you.";
      dom.btnDrill.hidden = true;
      return;
    }

    var names = worst.slice(0, 3).map(function (w) { return displayKey(w.key).toUpperCase(); });
    dom.heatNote.textContent = "Worst keys: " + names.join(", ") +
      " · " + worst[0].misses + (worst[0].misses === 1 ? " miss" : " misses") + " on " + displayKey(worst[0].key).toUpperCase() + ".";
    dom.btnDrill.hidden = false;
    dom.btnDrill.dataset.keys = JSON.stringify(worst.slice(0, 5).map(function (w) { return w.key; }));
  }

  /* ========================================================================
     MODAL
     ===================================================================== */

  var modalReturnFocus = null;

  function focusableInModal() {
    return Array.prototype.slice.call(
      dom.modal.querySelectorAll("button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
    ).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }

  function openModal(metrics) {
    modalReturnFocus = document.activeElement;
    dom.backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    dom.modal.scrollTop = 0;

    var first = focusableInModal()[0];
    if (first) first.focus({ preventScroll: true });

    if (metrics.netWpm >= 60) playFanfare();
    if (metrics.netWpm >= 70 || metrics.accuracy === 100) burstConfetti();
  }

  function closeModal() {
    if (dom.backdrop.hidden) return;
    dom.backdrop.hidden = true;
    document.body.style.overflow = "";
    if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus({ preventScroll: true });
  }

  /* ========================================================================
     13. CONFETTI
     ===================================================================== */

  var confettiState = { raf: null, particles: [], startedAt: 0 };

  function reducedMotion() {
    return state.calmMode ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function burstConfetti() {
    if (reducedMotion() || !dom.confetti) return;

    var canvas = dom.confetti;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var colors = ["#4f46e5", "#22c55e", "#f97316", "#eab308", "#ec4899", "#0ea5e9"];
    var count = w < 520 ? 70 : 130;

    confettiState.particles = [];
    for (var i = 0; i < count; i++) {
      confettiState.particles.push({
        x: w / 2 + (Math.random() - 0.5) * w * 0.5,
        y: h * 0.34 + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 7,
        vy: -Math.random() * 8 - 2,
        size: 3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3
      });
    }

    confettiState.startedAt = Date.now();
    canvas.classList.add("is-active");

    function frame() {
      var elapsed = Date.now() - confettiState.startedAt;
      ctx.clearRect(0, 0, w, h);

      confettiState.particles.forEach(function (p) {
        p.vy += 0.16;          // gravity
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = clamp(1 - elapsed / 2600, 0, 1);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      });

      if (elapsed < 2600) {
        confettiState.raf = window.requestAnimationFrame(frame);
      } else {
        stopConfetti();
      }
    }

    stopConfetti();
    confettiState.raf = window.requestAnimationFrame(frame);
  }

  function stopConfetti() {
    if (confettiState.raf) {
      window.cancelAnimationFrame(confettiState.raf);
      confettiState.raf = null;
    }
    if (dom.confetti) {
      dom.confetti.classList.remove("is-active");
      var ctx = dom.confetti.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, dom.confetti.width, dom.confetti.height);
    }
    confettiState.particles = [];
  }

  /* ========================================================================
     14. EVENT WIRING & BOOT
     ===================================================================== */

  function restartRun() {
    stopConfetti();
    closeModal();
    resetRun(state.quote || pickQuote());
  }

  function newQuote() {
    stopConfetti();
    closeModal();
    resetRun(pickQuote());
  }

  function setDifficulty(level) {
    if (!QUOTE_POOLS[level] && level !== "chaos") return;
    if (state.difficulty === level && state.isActive) {
      dom.input.focus({ preventScroll: true });
      return;
    }
    state.difficulty = level;
    state.drillText = null;

    Array.prototype.forEach.call(dom.difficultyGroup.querySelectorAll(".seg-btn"), function (button) {
      var active = button.dataset.difficulty === level;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-checked", active ? "true" : "false");
    });

    resetRun(pickQuote());
  }

  function startDrill(keysJson) {
    var keys = [];
    try { keys = JSON.parse(keysJson); } catch (err) { keys = []; }
    if (!keys.length) { toast("No weak keys recorded yet."); return; }

    /* Wrap each weak key in real words so the drill trains the key inside
       natural finger movement instead of mashing the same letter. */
    var LETTER_WORDS = {
      q: "quick", w: "work", e: "every", r: "great", t: "start", y: "you",
      u: "just", i: "right", o: "only", p: "keep", a: "able", s: "secret",
      d: "today", f: "focus", g: "great", h: "hear", j: "just", k: "keep",
      l: "small", z: "size", x: "next", c: "code", v: "every", b: "about",
      n: "never", m: "small"
    };
    var DIGIT_WORDS = {
      "0": "30", "1": "17", "2": "12", "3": "13", "4": "24", "5": "45",
      "6": "16", "7": "17", "8": "8", "9": "9"
    };
    var drills = keys.map(function (key) {
      if (key === " ") return "spacing practice";
      if (DIGIT_WORDS[key]) return DIGIT_WORDS[key];
      return LETTER_WORDS[key] || key + " " + key;
    });
    var text = drills.join(" ") + " " + DRILL_QUOTE;
    text = text.slice(0, 150);
    /* never end on a half word */
    var lastSpace = text.lastIndexOf(" ");
    if (lastSpace > 60) text = text.slice(0, lastSpace);
    /* mark the drill BEFORE resetRun so the mode chip and header reflect it;
       resetRun() receives the text directly and never calls pickQuote(). */
    state.drillActive = true;
    state.drillText = null;
    stopConfetti();
    closeModal();
    resetRun(text);
    toast("Drilling your worst keys. Good luck.");
  }

  function applyCalmMode(on) {
    state.calmMode = on;
    document.body.classList.toggle("calm", on);
    dom.calmToggle.setAttribute("aria-pressed", on ? "true" : "false");
    dom.calmToggle.setAttribute("aria-label", "Calm mode: " + (on ? "on" : "off"));
    writeStore(STORAGE.calm, on);
    if (on) {
      stopConfetti();
      dom.mascotImg.classList.remove("is-loaded");
      dom.mascotImg.removeAttribute("src");
    } else {
      state.lastMascotState = "";
      setMascot(chooseMascotState());
    }
  }

  function applySound(on) {
    state.soundEnabled = on;
    dom.soundToggle.setAttribute("aria-pressed", on ? "true" : "false");
    dom.soundToggle.setAttribute("aria-label", "Mechanical keyclick sounds: " + (on ? "on" : "off"));
    writeStore(STORAGE.sound, on);
    if (on) { ensureAudioContext(); playClick(false); }
  }

  function showCoachIfFirstRun() {
    var seen = readStore(STORAGE.coach, false);
    if (!seen) dom.coach.hidden = false;
  }

  function dismissCoach() {
    dom.coach.hidden = true;
    writeStore(STORAGE.coach, true);
  }

  function bindEvents() {
    /* --- capture layer --- */
    dom.input.addEventListener("input", onInput);

    dom.input.addEventListener("beforeinput", function (event) {
      if (!state.isActive) { event.preventDefault(); return; }
      var type = event.inputType || "";
      if (type.indexOf("paste") === 0 || type.indexOf("drop") === 0) {
        event.preventDefault();
        toast("Pasting is cheating. Type it like a human.");
        return;
      }
      if (type.indexOf("insert") === 0 && dom.input.value.length >= state.quoteLength) {
        var selected = Math.abs(dom.input.selectionEnd - dom.input.selectionStart);
        var incoming = (event.data || "").length;
        if (selected < incoming) {
          event.preventDefault();
          toast("End of quote — backspace a red letter instead.");
        }
      }
    });

    dom.input.addEventListener("paste", function (event) {
      event.preventDefault();
      toast("Pasting is cheating. Type it like a human.");
    });
    dom.input.addEventListener("drop", function (event) { event.preventDefault(); });

    dom.input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); return; }
      if (event.key === " " && !state.isActive) { event.preventDefault(); }
    });

    dom.input.addEventListener("compositionstart", function () { state.isComposing = true; });
    dom.input.addEventListener("compositionend", function () {
      state.isComposing = false;
      onInput({ inputType: "insertText", data: "", isComposing: false, target: dom.input });
    });

    dom.input.addEventListener("select", function () {
      /* keep the caret glued to the end: the span cursor is the source of truth */
      var end = dom.input.value.length;
      try { dom.input.setSelectionRange(end, end); } catch (err) { /* ignore */ }
    });

    dom.input.addEventListener("click", function () {
      var end = dom.input.value.length;
      try { dom.input.setSelectionRange(end, end); } catch (err) { /* ignore */ }
    });

    /* --- typing card focus trap --- */
    dom.card.addEventListener("click", function (event) {
      if (event.target.closest("button")) return;
      dom.input.focus({ preventScroll: true });
    });

    /* --- buttons --- */
    dom.btnRestart.addEventListener("click", restartRun);
    dom.btnNew.addEventListener("click", newQuote);
    dom.btnAgain.addEventListener("click", restartRun);
    dom.btnNext.addEventListener("click", newQuote);
    dom.modalClose.addEventListener("click", closeModal);
    dom.coachDismiss.addEventListener("click", dismissCoach);

    dom.soundToggle.addEventListener("click", function () { applySound(!state.soundEnabled); });
    dom.calmToggle.addEventListener("click", function () { applyCalmMode(!state.calmMode); });

    dom.btnDrill.addEventListener("click", function () {
      startDrill(dom.btnDrill.dataset.keys || "[]");
    });

    /* --- difficulty --- */
    dom.difficultyGroup.addEventListener("click", function (event) {
      var button = event.target.closest(".seg-btn");
      if (!button) return;
      setDifficulty(button.dataset.difficulty);
    });

    dom.difficultyGroup.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      var buttons = Array.prototype.slice.call(dom.difficultyGroup.querySelectorAll(".seg-btn"));
      var index = buttons.indexOf(document.activeElement);
      if (index === -1) return;
      event.preventDefault();
      var next = event.key === "ArrowRight"
        ? (index + 1) % buttons.length
        : (index - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
      setDifficulty(buttons[next].dataset.difficulty);
    });

    /* --- modal keyboard behaviour --- */
    dom.backdrop.addEventListener("mousedown", function (event) {
      if (event.target === dom.backdrop) closeModal();
    });

    document.addEventListener("keydown", function (event) {
      var modalOpen = !dom.backdrop.hidden;

      if (event.key === "Escape") {
        if (modalOpen) { event.preventDefault(); closeModal(); return; }
        if (state.isActive) { event.preventDefault(); restartRun(); toast("Run restarted."); }
        return;
      }

      if (event.key === "Tab" && modalOpen) {
        var items = focusableInModal();
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    /* --- tab visibility: re-sync the absolute clock --- */
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state.isTyping && state.isActive) tick();
    });

    window.addEventListener("resize", function () {
      if (!dom.backdrop.hidden) return;
      stopConfetti();
    });
  }

  var hasBooted = false;

  function boot() {
    if (hasBooted) return;   // idempotent: never bind listeners twice
    hasBooted = true;

    /* preferences */
    state.soundEnabled = readStore(STORAGE.sound, true) !== false;
    dom.soundToggle.setAttribute("aria-pressed", state.soundEnabled ? "true" : "false");
    dom.soundToggle.setAttribute("aria-label", "Mechanical keyclick sounds: " + (state.soundEnabled ? "on" : "off"));

    if (readStore(STORAGE.calm, false) === true) {
      state.calmMode = true;
      document.body.classList.add("calm");
      dom.calmToggle.setAttribute("aria-pressed", "true");
      dom.calmToggle.setAttribute("aria-label", "Calm mode: on");
    }

    bindEvents();

    var firstQuote = pickQuote();
    resetRun(firstQuote);
    showCoachIfFirstRun();
    renderAccuracy();

    /* tiny debug hook, only when explicitly requested: index.html?debug */
    if (window.location.search.indexOf("debug") !== -1) {
      window.TypeStormDebug = {
        state: state,
        getTimerId: function () { return state.timerId; },
        metrics: computeMetrics,
        selectTier: selectTier,
        tiers: TIERS,
        overrides: OVERRIDES
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
