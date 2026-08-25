/* Solar System Order — three levels of putting things where they belong.

   Level 1  the eight planets, in order out from the Sun
   Level 2  the moons a child is likely to have heard of, onto their planet
   Level 3  the moons almost nobody has heard of, onto their planet

   The game asks and the child answers. Level 1 asks for one planet at a time in
   order -- the ring it is asking about blinks, the question names what it wants,
   and a single tap on the right planet sends it home. That is the owner's call
   (2026-08-20): a child should be able to play by clicking, in order, without
   first having to know that ring 4 means Mars. Dragging still works for anyone
   who prefers it, but nothing needs it.

   Sizes and positions in the data below are for a 1024px-wide stage and scale
   from there. Sound is synthesised in WebAudio; spoken lines, when they exist,
   are pre-rendered files listed in narration/clips.json. Neither is ever
   generated on the device -- see AUDIO-DIRECTION.md. */

"use strict";

/* ------------------------------------------------------------------ data --- */

/* `d` is the ball's diameter in stage pixels at scale 1. The eight are
   compressed against reality (Jupiter is really 28x Mercury, here it is 3x) so
   that Mercury stays visible and Jupiter stays on the screen, but the order of
   sizes is true, which is the part worth learning. */
const PLANETS = [
  { key: "mercury", name: "Mercury", d: 30, fact: "Closest to the Sun, and the fastest of them all." },
  { key: "venus",   name: "Venus",   d: 40, fact: "The hottest planet, wrapped in thick clouds." },
  { key: "earth",   name: "Earth",   d: 42, fact: "Our home, and the only planet with oceans of water." },
  { key: "mars",    name: "Mars",    d: 33, fact: "The red planet. Rusty iron dust makes the colour." },
  { key: "jupiter", name: "Jupiter", d: 92, fact: "The biggest planet. One storm on it is wider than Earth." },
  { key: "saturn",  name: "Saturn",  d: 82, fact: "Rings made of ice and rock, going round and round." },
  { key: "uranus",  name: "Uranus",  d: 66, fact: "It rolls along on its side, like a ball on the floor." },
  { key: "neptune", name: "Neptune", d: 64, fact: "The windiest planet, far out in the cold and the dark." },
];

/* Saturn's sprite is the ball plus the whole ring ellipse, so it is much wider
   than the ball. Both numbers are printed by tools/build-assets.py; change the
   sprite and they change with it. */
const SATURN_BALL_RATIO = 0.4390;   /* ball diameter / sprite width */
const SATURN_ASPECT = 318 / 729;    /* sprite height / sprite width */

/* `d` is the diameter once the moon is in orbit; on the deck it is drawn
   DECK_MOON_SCALE times bigger, because a 15px Phobos is not something a small
   finger can find. The level split is the owner's: 2 is the famous ones, 3 is
   the ones hardly anybody knows. `as` is how the moon is named inside a
   question, which is the only place "our Moon" reads better than "Moon". */
const MOONS = [
  { key: "moon",      name: "Moon",      as: "our Moon", of: "earth",   level: 2, d: 24, fact: "Our Moon. People have walked on it." },
  { key: "io",        name: "Io",        of: "jupiter", level: 2, d: 24, fact: "Covered in volcanoes that never stop erupting." },
  { key: "europa",    name: "Europa",    of: "jupiter", level: 2, d: 23, fact: "A shell of ice with an ocean hiding underneath." },
  { key: "ganymede",  name: "Ganymede",  of: "jupiter", level: 2, d: 26, fact: "The biggest moon in the whole Solar System." },
  { key: "callisto",  name: "Callisto",  of: "jupiter", level: 2, d: 25, fact: "So many craters that there is no room for more." },
  { key: "titan",     name: "Titan",     of: "saturn",  level: 2, d: 26, fact: "It rains there, but the rain is not water." },
  { key: "triton",    name: "Triton",    of: "neptune", level: 2, d: 23, fact: "It travels around Neptune the wrong way." },

  { key: "phobos",    name: "Phobos",    of: "mars",    level: 3, d: 15, fact: "A tiny lumpy moon racing round Mars." },
  { key: "deimos",    name: "Deimos",    of: "mars",    level: 3, d: 14, fact: "The smaller of Mars's two little moons." },
  { key: "enceladus", name: "Enceladus", of: "saturn",  level: 3, d: 17, fact: "It shoots fountains of ice out into space." },
  { key: "miranda",   name: "Miranda",   of: "uranus",  level: 3, d: 16, fact: "Cliffs so tall that a fall would last for minutes." },
  { key: "ariel",     name: "Ariel",     of: "uranus",  level: 3, d: 19, fact: "The brightest of all the moons of Uranus." },
  { key: "umbriel",   name: "Umbriel",   of: "uranus",  level: 3, d: 19, fact: "The darkest of all the moons of Uranus." },
  { key: "titania",   name: "Titania",   of: "uranus",  level: 3, d: 21, fact: "The biggest moon of Uranus." },
  { key: "oberon",    name: "Oberon",    of: "uranus",  level: 3, d: 20, fact: "Old, dark, and covered all over in craters." },
];

const NO_MOONS = {
  mercury: "Mercury has no moons at all.",
  venus: "Venus has no moons at all.",
};

const LEVELS = {
  1: {
    title: "Put the planets in order",
    open: "Listen to the question, then tap the right planet.",
    doneTitle: "Every planet is home!",
    doneText: "Eight planets, all in the right order. Now they need their moons.",
    next: "Start level 2",
  },
  2: {
    title: "The moons everybody knows",
    open: "Tap the planet this moon goes around.",
    doneTitle: "The famous moons are home!",
    doneText: "Now for the moons that hardly anybody has heard of.",
    next: "Start level 3",
  },
  3: {
    title: "The moons hardly anybody knows",
    open: "Tap the planet this moon goes around.",
    doneTitle: "You know them all!",
    doneText: "Every planet in order, and every moon at home. That is the whole family.",
    next: "Play it all again",
  },
};

/* Each planet gets a ring position `x` and an orbit radius `a`, both fractions
   of the stage width, and `up` says which side of the ecliptic the ring sits
   on. The ring's y is then solved so that it lands exactly on that orbit, which
   is the whole point: the line under a planet is the orbit it is standing on,
   not a decoration drawn nearby.

   Radius and position are set separately because tying them together does not
   work. Choosing only x and y and recovering the radius made the radii bunch
   into near-duplicate pairs, so eight orbits read as five.

   The alternating `up` also does the collision work. Saturn's sprite is 2.3x
   its ball and would lie across both neighbours on a single line; a planet and
   its neighbours being 200-odd pixels apart vertically means nothing has to be
   shrunk to fit, and a planet's moons can orbit out past the gap without ever
   crossing the planet next door. */
const ORBIT_SPOTS = [
  { x: 0.225, a: 0.225, up: true  },
  { x: 0.308, a: 0.318, up: false },
  { x: 0.392, a: 0.420, up: true  },
  { x: 0.478, a: 0.530, up: false },
  { x: 0.600, a: 0.672, up: true  },
  { x: 0.755, a: 0.830, up: false },
  { x: 0.880, a: 0.955, up: true  },
  { x: 0.940, a: 1.040, up: false },
];

const SUN_AT = { x: 0.028, y: 0.50, d: 0.27 }; /* fractions of stage width/height */
/* Flat enough that a whole orbit fits on the stage instead of being cropped to
   a stub. An earlier version drew a short arc around each planet at its own
   ellipse angle: on the steep part of an ellipse those arcs come out near
   vertical, so eight of them read as eight tally marks, not as orbits. */
const ORBIT_SQUASH = 0.28;   /* an orbit's height against its width, at most */
/* The flattest the orrery is allowed to get. Below this the eight rings stop
   reading as a zigzag -- and the zigzag is doing collision work, not just
   looking pretty: Saturn's sprite is 2.3x its ball and clears its neighbours
   horizontally by single pixels, so the vertical separation is what keeps them
   apart. A window short enough to need less than this gets a clipped planet
   instead, which is the lesser wrong. */
const SQUASH_FLOOR = 0.10;
/* A planet's name hangs under its ball and `#stage` is overflow:hidden, so the
   label is part of the body as far as fitting is concerned: 4px of gap, one line
   at the largest the label ever gets, and a little clear air under it. Fitting to
   the label's exact height instead left it 4px off the stage edge -- inside, but
   reading as if it had been cut. */
const NAME_ROOM = 28;
const DECK_MOON_SCALE = 3.2; /* levels 2 and 3 show one moon, so it is drawn big */
/* Help arrives on the fourth attempt at the same question, not the second. The
   owner's number (2026-08-20): three tries is long enough to be thinking about
   it and short enough not to be stuck. */
const MISSES_BEFORE_HINT = 3;
const SNAP = 52;             /* extra pixels of slack around a drop target */
/* The least time a fact gets before the next question, for when there is no
   spoken line to wait for. With one, nextBeat() waits for the line to finish
   instead -- the facts are three to five seconds read aloud, so this was never
   long enough on its own. */
const READ_FACT = 2000;

/* -------------------------------------------------------------- elements --- */

const $ = (id) => document.getElementById(id);
const sky = $("sky");
const stage = $("stage");
const orbitSvg = $("orbits");
const sunEl = $("sun");
const slotsEl = $("slots");
const placedEl = $("placed");
const sparksEl = $("sparks");
const trayRow = $("trayRow");
const captionEl = $("caption");
const titleEl = $("title");
const curtain = $("curtain");
const cardArt = $("cardArt");
const cardTitle = $("cardTitle");
const cardText = $("cardText");
const cardGo = $("cardGo");
const soundBtn = $("sound");
const againBtn = $("again");

const reduced = matchMedia("(prefers-reduced-motion: reduce)");

/* ----------------------------------------------------------------- state --- */

const state = {
  level: 1,
  unlocked: 1,
  step: 0,          /* level 1: which planet is being asked for */
  scale: 1,
  layout: null,
  home: new Map(),  /* planet key -> { slot } once it has landed */
  orbiting: [],     /* moons in orbit around their planet */
  pieces: new Map(),/* every planet and moon this level knows about, by key */
  queue: [],        /* levels 2 and 3: the moons still to come, one at a time */
  current: null,    /* the moon spec on the deck right now */
  picked: null,
  drag: null,
  misses: 0,        /* wrong answers to the question being asked now */
  sound: true,
  raf: 0,
  beat: null,       /* what the game does next, once the voice has finished */
  beatTimer: 0,
  celebrating: false,
};

/* ----------------------------------------------------------------- sound --- */

/* Synthesised, never a file: generated sound effects carry a redistribution
   restriction that generated speech does not, and each one would need its own
   provenance entry. Decided 2026-08-20, see AUDIO-DIRECTION.md. */
let audio = null;

function ac() {
  if (!state.sound) return null;
  if (!audio) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audio = new Ctx();
  }
  if (audio.state === "suspended") audio.resume();
  return audio;
}

function tone(freq, when, dur, gain, type) {
  const ctx = ac();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function shimmer(when) {
  const ctx = ac();
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const len = Math.floor(ctx.sampleRate * 0.28);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 4200;
  band.Q.value = 1.4;
  const amp = ctx.createGain();
  amp.gain.value = 0.16;
  src.connect(band).connect(amp).connect(ctx.destination);
  src.start(t);
}

const sfx = {
  /* A rising fourth, which is what a question sounds like. It plays whether or
     not the spoken line exists, so the moment is never silent. */
  ask:  () => { tone(523, 0, 0.16, 0.09); tone(698, 0.14, 0.26, 0.09); },
  pick: () => tone(560, 0, 0.09, 0.1, "triangle"),
  drop: () => { tone(660, 0, 0.14, 0.13); tone(990, 0.07, 0.2, 0.1); shimmer(0.05); },
  moon: () => { tone(1180, 0, 0.1, 0.09); tone(1560, 0.06, 0.16, 0.07); shimmer(0.02); },
  no:   () => { tone(210, 0, 0.13, 0.1); tone(170, 0.09, 0.16, 0.08); },
  win:  () => [523, 659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.11, 0.42, 0.11)),
};

/* Spoken lines are pre-rendered files named in narration/clips.json, never
   synthesised here: every built-in browser and OS voice is an adult, and this
   game is read to five-year-olds. Until the files are rendered the manifest is
   simply empty and the game plays its chime and shows the words -- it never
   falls back to speechSynthesis, which is the thing the audio policy exists to
   refuse. See AUDIO-DIRECTION.md and narration/README.md. */
const voice = { lines: null, el: null, dead: false };

/* `audioReady` is set by tools/build-narration.py only when every clip named in
   the manifest is actually on disk. Without it the game would 404 its first line
   on every load before switching itself off -- harmless, but a shipped app should
   not ask for files it knows are not there.

   This file is generated, and holds only what the game needs: whether the clips
   are there, and which file says which line. Everything about how the audio was
   made is kept out of it deliberately -- see tools/build-narration.py. */
fetch("./narration/clips.json")
  .then((r) => (r.ok ? r.json() : null))
  .then((data) => { voice.lines = (data && data.audioReady && data.lines) || {}; })
  .catch(() => { voice.lines = {}; });

function speak(text) {
  if (!state.sound || voice.dead || !voice.lines) return;
  const file = voice.lines[String(text).trim()];
  if (!file) return;
  try {
    if (!voice.el) voice.el = new Audio();
    voice.el.pause();
    voice.el.src = "./assets/audio/" + file;
    /* One missing file means the set was never rendered; stop asking. */
    voice.el.onerror = () => { voice.dead = true; };
    const played = voice.el.play();
    if (played && played.catch) played.catch(() => {});
  } catch (e) { voice.dead = true; }
}

/* ------------------------------------------------------------- the beat --- */

/* One thing at a time is scheduled -- ask again, put the next moon on the deck,
   finish the level -- and it waits for the voice before it happens.

   What was here before hung a fixed 2000ms timer off the fact and let the next
   question land on top of it. speak() begins by pausing the audio element, so the
   question did not overlap the fact, it silenced it: "Titania, a moon of Uranus.
   The biggest moon of Uranus." is over four seconds long and had two to say it.
   The owner heard it on the moons (2026-08-21). Level 1's planet facts, the
   poke-a-body fact, and the last fact of every level -- cut off by "Every planet
   is home!" -- all had the same defect.

   Polling rather than the element's `ended` event, deliberately: a clip that
   404s, a device that refused to start playback, and a backgrounded tab all
   leave `ended` unfired, and the game must never sit waiting for audio that is
   not coming. Waiting on whatever is speaking now rather than on one particular
   utterance is what lets a child tap the caption for a repeat without stranding
   the level -- the repeat extends the wait instead of cancelling what follows.

   `floor` is what the words need on the caption when there is no clip to wait
   for -- sound off, or nothing rendered yet -- and in that case this behaves
   exactly as the old timer did. */
const QUIET = 700;        /* silence between a line ending and the next thing */
const SPEAK_CAP = 15000;  /* a stalled clip must not hold the game up forever */

function cancelBeat() {
  clearTimeout(state.beatTimer);
  state.beat = null;
}

function nextBeat(floor, fn) {
  cancelBeat();
  state.beat = fn;
  const from = performance.now();
  const tick = () => {
    const el = voice.el;
    const waited = performance.now() - from;
    if (el && el.src && !el.paused && !el.ended && waited < SPEAK_CAP) {
      state.beatTimer = setTimeout(tick, 150);
      return;
    }
    state.beatTimer = setTimeout(() => { state.beat = null; fn(); },
                                Math.max(QUIET, floor - waited));
  };
  tick();
}

/* --------------------------------------------------------------- helpers --- */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const planetOf = (key) => PLANETS.find((p) => p.key === key);
const moonsFor = (level) => MOONS.filter((m) => m.level === level);
const askName = (spec) => spec.as || spec.name;

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* Names a four-year-old cannot separate by ear. Titan and Triton differ by one
   consonant -- TIE-tun against TRY-tun -- and Ariel and Umbriel rhyme. No amount
   of diction fixes that, so the schedule has to: a plain shuffle of level 2's six
   moons puts Titan next to Triton one run in three, and back to back is the one
   arrangement guaranteed to confuse. Written names are the real discriminator, and
   they are already on the deck. */
const CONFUSABLE = [["titan", "triton"], ["ariel", "umbriel"]];

const tooClose = (a, b) =>
  CONFUSABLE.some((pair) => pair.includes(a) && pair.includes(b));

/* Re-draw rather than repair. With six or eight items a clean draw arrives within
   a couple of tries, and swapping an offender into place biases which moon opens
   the level. The fallback returns a plain shuffle so a future roster that cannot
   satisfy the constraint still plays. */
function shuffleApart(list) {
  for (let tries = 0; tries < 40; tries++) {
    const out = shuffle(list);
    if (out.every((m, i) => i === 0 || !tooClose(out[i - 1].key, m.key))) return out;
  }
  return shuffle(list);
}

/* A piece's drawn box. Saturn is the only one that is not a circle. */
function boxOf(spec, d) {
  if (spec.key !== "saturn") return { w: d, h: d };
  const w = d / SATURN_BALL_RATIO;
  return { w, h: w * SATURN_ASPECT };
}

function say(text, cheer) {
  captionEl.textContent = text || "";
  captionEl.classList.toggle("cheer", !!cheer);
  captionEl.classList.remove("pop");
  void captionEl.offsetWidth;
  if (text) captionEl.classList.add("pop");
}

/* ---------------------------------------------------------------- layout --- */

/* How far above or below the Sun a ring sits, so that a ring `dx` to the right
   of the Sun lands on the orbit of radius `a`. The orbits are level rather than
   leaning: with an outer radius near a thousand pixels, even a few degrees of
   lean swings the far planets hundreds of pixels off the ecliptic and the neat
   zigzag turns into a lopsided slide. */
function offEcliptic(dx, a, squash) {
  const inside = a * a - dx * dx;
  return inside <= 0 ? 0 : squash * Math.sqrt(inside);
}

/* How flat the orbits have to be for every planet -- ball, ring, and printed
   name -- to sit inside the stage.

   Squash is the knob to turn, not the orbit radius. A ring's y is solved against
   its own orbit and the ellipse drawn under it uses the same number, so squashing
   both together keeps the invariant that the line under a planet is the orbit it
   is standing on. Shrinking the radii instead would take the inner orbits below
   their own planet's x, and those rings would drop flat onto the ecliptic.

   This is the fitting that `clamp(..., 1, 1.6)` on `slack` could not do: slack
   widens the zigzag on a tall stage but bottoms out at 1, so a stage half as tall
   as the one this was drawn for swung its rings exactly as far. Neptune is
   outermost and below the ecliptic, so it went off the bottom first and its name
   went with it -- measured at 1366x600, 58px below the stage and cut off
   completely by overflow:hidden. The owner found it before any test did. */
function fitSquash(w, h, sun, scale, slack) {
  let fit = ORBIT_SQUASH;
  ORBIT_SPOTS.forEach((spot, i) => {
    const spec = PLANETS[i];
    const a = w * spot.a * slack;
    const dx = w * spot.x - sun.x;
    const reach = Math.sqrt(Math.max(a * a - dx * dx, 0));
    if (reach < 1) return;              /* this ring already sits on the ecliptic */
    const half = boxOf(spec, spec.d * scale).h / 2;
    /* Above the ecliptic it is the ball that runs out of room; below it, the
       name hanging underneath. */
    const room = spot.up ? sun.y - half : h - sun.y - half - NAME_ROOM;
    fit = Math.min(fit, room / reach);
  });
  return clamp(fit, SQUASH_FLOOR, ORBIT_SQUASH);
}

function measure() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (!w || !h) return;

  const scale = clamp(w / 1024, 0.52, 1.3);
  const sun = { x: w * SUN_AT.x, y: h * SUN_AT.y, d: w * SUN_AT.d };

  /* A taller stage wants a taller zigzag, and the only way to get one is wider
     orbits: how far a ring can sit off the ecliptic is set by how much room its
     orbit has left over at that x. Landscape, the shape this was drawn for,
     comes out at 1. A stage SHORTER than that is fitSquash()'s job, not this
     one's -- slack widens the zigzag and must not be the thing that narrows it,
     because narrowing a radius moves a ring off its own orbit. */
  const slack = clamp(1 + 0.9 * (h / w - 0.55), 1, 1.6);
  const squash = fitSquash(w, h, sun, scale, slack);

  const slots = ORBIT_SPOTS.map((spot, i) => {
    const x = w * spot.x;
    const a = w * spot.a * slack;
    const off = offEcliptic(x - sun.x, a, squash);
    return { i, x, y: sun.y + (spot.up ? -off : off), a };
  });

  state.scale = scale;
  state.layout = { w, h, sun, slots, squash, ring: Math.round(clamp(64 * scale, 44, 78)) };

  sunEl.style.width = sun.d + "px";
  sunEl.style.height = sun.d + "px";
  sunEl.style.left = sun.x + "px";
  sunEl.style.top = sun.y + "px";

  drawOrbits();
  paintSky();
  placeEverything();
}

/* Eight whole orbits, nested. Each one genuinely passes through its planet's
   ring -- the ring's position is solved against the orbit, not eyeballed near
   it -- so a child can trace the line their planet travels on. The outer ones
   run off the edges, which is what an orrery looks like. */
function drawOrbits() {
  const { w, h, sun, slots, squash } = state.layout;
  orbitSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  orbitSvg.innerHTML = slots.map((s) => (
    `<ellipse class="orbit" data-orbit="${s.i}" cx="${sun.x.toFixed(1)}" cy="${sun.y.toFixed(1)}" rx="${s.a.toFixed(1)}" ry="${(s.a * squash).toFixed(1)}"/>`
  )).join("");
}

/* ---------------------------------------------------------------- starfield */

/* Seeded, so the same sky comes back after a resize instead of reshuffling
   under the child mid-game. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function paintSky() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = innerWidth;
  const h = innerHeight;
  sky.width = Math.round(w * dpr);
  sky.height = Math.round(h * dpr);
  const g = sky.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);

  const back = g.createLinearGradient(0, 0, w * 0.4, h);
  back.addColorStop(0, "#0b1030");
  back.addColorStop(0.55, "#070a20");
  back.addColorStop(1, "#04060f");
  g.fillStyle = back;
  g.fillRect(0, 0, w, h);

  const clouds = [
    [0.14, 0.30, "rgba(96,64,168,.20)"],
    [0.62, 0.16, "rgba(46,86,168,.16)"],
    [0.82, 0.78, "rgba(120,54,132,.15)"],
    [0.38, 0.86, "rgba(38,96,140,.13)"],
  ];
  for (const [fx, fy, colour] of clouds) {
    const r = Math.max(w, h) * 0.42;
    const blob = g.createRadialGradient(w * fx, h * fy, 0, w * fx, h * fy, r);
    blob.addColorStop(0, colour);
    blob.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = blob;
    g.fillRect(0, 0, w, h);
  }

  const rand = rng(20260820);
  const count = Math.round((w * h) / 3400);
  for (let i = 0; i < count; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 0.35 + rand() * 1.25;
    g.globalAlpha = 0.28 + rand() * 0.66;
    g.fillStyle = rand() < 0.14 ? "#cfe2ff" : rand() < 0.3 ? "#ffe9c4" : "#ffffff";
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  /* A handful of bright ones get a cross glint, which is what makes a flat
     field of dots read as a night sky. */
  g.globalAlpha = 1;
  for (let i = 0; i < 16; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 4 + rand() * 7;
    g.strokeStyle = "rgba(255,255,255,.42)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x - len, y);
    g.lineTo(x + len, y);
    g.moveTo(x, y - len);
    g.lineTo(x, y + len);
    g.stroke();
  }
}

/* ----------------------------------------------------------------- pieces --- */

function makePiece(spec, kind) {
  const el = document.createElement("div");
  el.className = "body" + (kind === "moon" ? " moon" : "");
  el.dataset.key = spec.key;
  el.dataset.kind = kind;
  const img = document.createElement("img");
  img.src = `./assets/${kind === "moon" ? "moons" : "planets"}/${spec.key}.webp`;
  img.alt = "";
  el.appendChild(img);
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = spec.name;
  el.appendChild(name);
  el.addEventListener("pointerdown", onGrab);
  el.addEventListener("pointerup", onTapPlaced);
  return el;
}

function sizePiece(el, spec, d) {
  const box = boxOf(spec, d);
  el.style.width = box.w + "px";
  el.style.height = box.h + "px";
}

/* The level-1 planet row: eight pieces, each parked in an equal-width cell so a
   tap lands where the eye expects even though the pieces are wildly different
   sizes. Keeping one element for the whole journey means a drag never has to
   hand the piece over to a different node halfway.

   Levels 2 and 3 do not use this -- they show one moon at a time, on the deck
   built by presentNext(). */
function buildTray(specs) {
  trayRow.innerHTML = "";
  const cellW = clamp((trayRow.clientWidth - 24) / Math.max(specs.length, 1), 64, 148);
  for (const spec of specs) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.width = cellW + "px";
    cell.dataset.key = spec.key;

    /* Cap by how wide the piece's whole box may be, not by its ball. Saturn's
       box is 2.3x its ball, so capping the ball let it grow to 228px inside a
       125px cell and lie across Uranus. */
    const room = spec.key === "saturn" ? (cellW - 6) * SATURN_BALL_RATIO : cellW - 6;
    const el = makePiece(spec, "planet");
    el.style.position = "relative";
    el.style.transform = "none";
    sizePiece(el, spec, Math.min(spec.d * state.scale, room));
    cell.appendChild(el);
    trayRow.appendChild(cell);

    state.pieces.set(spec.key, { spec, kind: "planet", el, cell, placed: false });
  }
}

/* --------------------------------------------------------------- placing --- */

function placeEverything() {
  if (!state.layout) return;
  const { slots } = state.layout;

  for (const [key, at] of state.home) {
    const piece = state.pieces.get(key);
    if (!piece) continue;
    const slot = slots[at.slot];
    piece.el.style.left = slot.x + "px";
    piece.el.style.top = slot.y + "px";
    sizePiece(piece.el, piece.spec, piece.spec.d * state.scale);
  }

  for (const moon of state.orbiting) {
    sizePiece(moon.el, moon.spec, moon.spec.d * state.scale);
    setMoonOrbit(moon);
  }

  layoutSlots();
  if (state.orbiting.length) tick();
}

function layoutSlots() {
  if (!state.layout) return;
  const { slots, ring } = state.layout;
  slotsEl.querySelectorAll(".slot").forEach((el) => {
    const slot = slots[Number(el.dataset.slot)];
    el.style.left = slot.x + "px";
    el.style.top = slot.y + "px";
    el.style.width = Math.max(ring, 62) + "px";
    el.style.height = Math.max(ring, 62) + "px";
    el.style.setProperty("--ring", ring + "px");
  });
}

function setMoonOrbit(moon) {
  const at = state.home.get(moon.of);
  if (!at) return;
  const slot = state.layout.slots[at.slot];
  const hostR = (planetOf(moon.of).d * state.scale) / 2;
  moon.cx = slot.x;
  moon.cy = slot.y;
  moon.rx = hostR + (11 + moon.ring * 8.5) * state.scale;
  moon.ry = moon.rx * 0.42;
}

/* --------------------------------------------------------------- the game --- */

function startLevel(level) {
  cancelBeat();
  state.level = level;
  state.unlocked = Math.max(state.unlocked, level);
  save();

  titleEl.textContent = LEVELS[level].title;
  syncLevelButtons();

  state.picked = null;
  state.drag = null;
  state.misses = 0;
  state.step = 0;
  state.celebrating = false;

  if (level === 1) {
    state.home.clear();
    state.orbiting.length = 0;
    placedEl.innerHTML = "";
    state.pieces.clear();
    buildSlots();
    /* measure() before buildTray(), because the tray sizes its pieces from the
       scale measure() works out. */
    measure();
    buildTray(shuffle(PLANETS));
  } else {
    /* Levels 2 and 3 inherit the planets. If a child jumps straight to level 3
       we still need them on the board, so seat them in order first. */
    if (state.home.size !== PLANETS.length) seatAllPlanets();
    if (level === 2) {
      state.orbiting.length = 0;
      placedEl.querySelectorAll(".body.moon").forEach((el) => el.remove());
    }
    /* Level 3 keeps level 2's moons in orbit; only the tray changes. */
    for (const [key, piece] of [...state.pieces]) {
      if (piece.kind === "moon" && !piece.placed) state.pieces.delete(key);
    }
    buildSlots();
    measure();
    /* One moon at a time, in a shuffled order. The owner's call (2026-08-20):
       a row of eight little grey moons is a search puzzle before it is an
       astronomy question, and the search is not the thing being taught. */
    state.queue = shuffleApart(moonsFor(level));
    presentNext();
    return;
  }

  ask();
}

/* Put the next moon on the deck and ask about it. The deck is the tray band with
   one big moon in it, its name, and how far through the level the child is. */
function presentNext() {
  trayRow.innerHTML = "";
  state.picked = null;
  state.current = state.queue.shift() || null;

  if (!state.current) {
    finishLevel();
    return;
  }

  const total = moonsFor(state.level).length;
  const count = document.createElement("p");
  count.className = "deckCount";
  count.textContent = `${total - state.queue.length} of ${total}`;
  trayRow.appendChild(count);

  const cell = document.createElement("div");
  cell.className = "cell deck";
  cell.dataset.key = state.current.key;

  const el = makePiece(state.current, "moon");
  el.style.position = "relative";
  el.style.transform = "none";
  /* Leave room under the ball for the name: the deck's label is bigger than a
     tray label and ran off the bottom of the band at -34. */
  const room = clamp(trayRow.clientHeight - 58, 52, 124);
  sizePiece(el, state.current, Math.min(state.current.d * DECK_MOON_SCALE * state.scale, room));
  cell.appendChild(el);
  trayRow.appendChild(cell);

  const piece = { spec: state.current, kind: "moon", el, cell, placed: false };
  state.pieces.set(state.current.key, piece);
  state.picked = piece;
  el.classList.add("picked");
  ask();
}

/* The question. Level 1 walks the order and blinks the ring it wants; levels 2
   and 3 name the moon in hand and wait for a planet. */
/* Asking does not cancel the pending beat. A child tapping to hear the question
   again, in the gap while a fact is still being read, must not be able to stop
   the next moon from ever arriving. */
function ask() {
  state.misses = 0;
  if (state.celebrating) return;

  if (state.level === 1) {
    slotsEl.querySelectorAll(".slot").forEach((el) => {
      el.classList.toggle("asking", Number(el.dataset.slot) === state.step);
    });
    const line = questionFor(state.step);
    say(line);
    sfx.ask();
    speak(line);
    return;
  }

  if (!state.picked) {
    say(LEVELS[state.level].open);
    return;
  }
  /* The name is inside the question, which is how the child learns what the moon
     on the deck is called without a separate clip to chain in front. */
  const line = `Which planet does ${askName(state.picked.spec)} go around?`;
  say(line);
  sfx.ask();
  speak(line);
}

function questionFor(step) {
  if (step === 0) return "Which planet is closest to the Sun?";
  if (step === PLANETS.length - 1) return "Which planet is the furthest from the Sun?";
  return `Which planet comes next, after ${PLANETS[step - 1].name}?`;
}

function buildSlots() {
  slotsEl.innerHTML = "";
  if (state.level !== 1) return;
  PLANETS.forEach((_, i) => {
    const el = document.createElement("div");
    el.className = "slot";
    el.dataset.slot = String(i);
    el.innerHTML = `<b>${i + 1}</b>`;
    slotsEl.appendChild(el);
  });
  layoutSlots();
}

/* Used when a level is entered out of order. No animation, no sound: this is
   scene-setting, not an achievement. */
function seatAllPlanets() {
  state.home.clear();
  placedEl.innerHTML = "";
  state.pieces.clear();
  PLANETS.forEach((spec, i) => {
    const el = makePiece(spec, "planet");
    el.classList.add("locked");
    placedEl.appendChild(el);
    state.pieces.set(spec.key, { spec, kind: "planet", el, cell: null, placed: true });
    state.home.set(spec.key, { slot: i });
  });
}

function landPlanet(piece, slotIndex) {
  const slot = state.layout.slots[slotIndex];
  const el = piece.el;
  const box = boxOf(piece.spec, piece.spec.d * state.scale);

  el.classList.remove("lift", "picked");
  el.classList.add("settling");
  el.style.position = "absolute";
  el.style.transform = "";
  placedEl.appendChild(el);
  el.style.left = slot.x + "px";
  el.style.top = slot.y + "px";
  el.style.width = box.w + "px";
  el.style.height = box.h + "px";
  setTimeout(() => {
    el.classList.remove("settling");
    el.classList.add("locked");
  }, 380);

  if (piece.cell) piece.cell.classList.add("gone");
  piece.placed = true;
  state.home.set(piece.spec.key, { slot: slotIndex });

  const ring = slotsEl.querySelector(`.slot[data-slot="${slotIndex}"]`);
  ring.classList.add("filled");
  ring.classList.remove("asking");
  burst(slot.x, slot.y, 14);
  sfx.drop();

  const line = `${piece.spec.name}. ${piece.spec.fact}`;
  say(line, true);
  speak(line);

  state.step = slotIndex + 1;
  /* Whichever comes next waits for the fact to be finished being said. */
  if (state.step >= PLANETS.length) nextBeat(700, finishLevel);
  else nextBeat(READ_FACT, ask);
}

function landMoon(piece, hostKey) {
  const host = planetOf(hostKey);
  const el = piece.el;
  const ring = state.orbiting.filter((m) => m.of === hostKey).length;

  el.classList.remove("lift", "picked");
  el.classList.add("locked");
  el.style.position = "absolute";
  el.style.transform = "";
  placedEl.appendChild(el);
  sizePiece(el, piece.spec, piece.spec.d * state.scale);

  const moon = {
    key: piece.spec.key,
    spec: piece.spec,
    of: hostKey,
    ring,
    el,
    angle: Math.random() * Math.PI * 2,
    /* Inner moons run faster, which is true and also stops a stack of moons
       moving as one rigid ring. Triton runs backwards, because it does. */
    speed: (0.42 - ring * 0.06) * (piece.spec.key === "triton" ? -1 : 1),
  };
  state.orbiting.push(moon);
  setMoonOrbit(moon);
  drawMoon(moon);

  if (piece.cell) piece.cell.classList.add("gone");
  piece.placed = true;
  if (state.picked === piece) state.picked = null;

  const slot = state.layout.slots[state.home.get(hostKey).slot];
  burst(slot.x, slot.y, 10);
  sfx.moon();

  const line = `${piece.spec.name}, a moon of ${host.name}. ${piece.spec.fact}`;
  say(line, true);
  speak(line);
  tell(piece);
  tick();

  state.current = null;
  if (!state.queue.length) {
    nextBeat(900, finishLevel);
    return;
  }
  nextBeat(READ_FACT, presentNext);
}

/* Names on the board. A planet keeps its label because it is the anchor a child
   navigates by; a moon shows its name as it arrives and then goes quiet, and any
   body says its name and its fact again when tapped. Five labels orbiting Uranus
   permanently was unreadable, and hiding them for good would have thrown away
   the naming, which is most of what there is to learn here. */
function tell(piece) {
  const el = piece.el;
  clearTimeout(piece.tellTimer);
  el.classList.add("telling");
  piece.tellTimer = setTimeout(() => el.classList.remove("telling"), 3600);
}

/* A wrong answer. Nothing is taken away and nothing turns red; the piece goes
   back where it was and the question is asked again, with help the second time. */
function refuse(piece, targetEl, message) {
  state.misses += 1;
  if (targetEl) {
    targetEl.classList.add("nope", "shake");
    setTimeout(() => targetEl.classList.remove("nope", "shake"), 460);
  }
  sfx.no();
  if (piece && !piece.placed) sendHome(piece);

  if (state.misses < MISSES_BEFORE_HINT) {
    say(message);
    return;
  }

  /* Enough tries on one question: point at the answer. Repeating "try again" is
     not help, it is the same wall again. */
  if (state.level === 1) {
    const want = state.pieces.get(PLANETS[state.step].key);
    if (want && !want.placed) {
      want.el.classList.add("blink");
      setTimeout(() => want.el.classList.remove("blink"), 4200);
    }
    say(`It is ${PLANETS[state.step].name}. Look for the glowing one.`);
  } else if (state.picked) {
    const hostPiece = state.pieces.get(state.picked.spec.of);
    if (hostPiece) {
      hostPiece.el.classList.add("blink");
      setTimeout(() => hostPiece.el.classList.remove("blink"), 4200);
    }
    say(`${state.picked.spec.name} belongs to ${planetOf(state.picked.spec.of).name}.`);
  }
  state.misses = 0;
}

function finishLevel() {
  cancelBeat();
  const info = LEVELS[state.level];
  state.celebrating = true;
  state.picked = null;
  state.current = null;
  /* Clear the band, or a finished level sits under a stale "8 of 8". */
  trayRow.innerHTML = "";
  slotsEl.querySelectorAll(".slot").forEach((el) => el.classList.remove("asking"));
  sfx.win();
  say(info.doneTitle, true);
  speak(info.doneTitle);

  orbitSvg.querySelectorAll(".orbit").forEach((p, i) => {
    setTimeout(() => {
      p.classList.add("lit");
      setTimeout(() => p.classList.remove("lit"), 1100);
    }, i * 90);
  });

  state.layout.slots.forEach((s, i) => setTimeout(() => burst(s.x, s.y, 12), 120 + i * 90));
  setTimeout(() => showCard(info), 1500);
}

function showCard(info) {
  const next = state.level < 3 ? state.level + 1 : 1;
  cardTitle.textContent = info.doneTitle;
  cardText.textContent = info.doneText;
  cardGo.textContent = info.next;

  cardArt.innerHTML = "";
  const show = state.level === 1
    ? ["earth", "jupiter", "saturn"]
    : state.level === 2
      ? ["ganymede", "titan", "moon"]
      : ["titania", "enceladus", "miranda"];
  const dir = state.level === 1 ? "planets" : "moons";
  for (const key of show) {
    const img = document.createElement("img");
    img.src = `./assets/${dir}/${key}.webp`;
    img.alt = "";
    cardArt.appendChild(img);
  }

  curtain.hidden = false;
  cardGo.focus();
  cardGo.onclick = () => {
    curtain.hidden = true;
    startLevel(next);
  };
}

/* ------------------------------------------------------------ interaction --- */

function onGrab(event) {
  const el = event.currentTarget;
  const piece = state.pieces.get(el.dataset.key);
  if (!piece || piece.placed || state.celebrating) return;
  if (event.button !== undefined && event.button !== 0) return;

  event.preventDefault();
  /* Capture keeps the moves coming to this element once the finger leaves it.
     It throws for a pointer id the browser is not tracking, which is only ever
     a synthetic event, and the game plays fine without it. */
  try { el.setPointerCapture(event.pointerId); } catch (e) { /* not fatal */ }

  const rect = el.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();

  state.drag = {
    piece,
    id: event.pointerId,
    moved: false,
    startX: event.clientX,
    startY: event.clientY,
    /* keep the grab point under the finger */
    offX: event.clientX - (rect.left + rect.width / 2),
    offY: event.clientY - (rect.top + rect.height / 2),
    home: {
      x: rect.left + rect.width / 2 - stageBox.left,
      y: rect.top + rect.height / 2 - stageBox.top,
    },
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onRelease);
  el.addEventListener("pointercancel", onRelease);
  el.addEventListener("lostpointercapture", onLostCapture);
}

/* The safety net behind the fix in lift(). If the capture is ever lost for a reason
   we did not cause -- and it is a real loss, not the momentary one lift() repairs --
   the piece would otherwise sit abandoned in mid-air with no way to get it back. A
   child cannot recover from that; the only exit is reloading the game. Put it back in
   the tray instead and let them try again. */
function onLostCapture(event) {
  const drag = state.drag;
  if (!drag || event.pointerId !== drag.id) return;
  const el = drag.piece.el;
  if (el.hasPointerCapture(drag.id)) return;   /* lift() already took it back */
  releaseListeners(el);
  state.drag = null;
  clearHighlight();
  if (drag.moved) {
    drag.piece.homeAt = drag.home;
    sendHome(drag.piece);
  }
}

function releaseListeners(el) {
  el.removeEventListener("pointermove", onMove);
  el.removeEventListener("pointerup", onRelease);
  el.removeEventListener("pointercancel", onRelease);
  el.removeEventListener("lostpointercapture", onLostCapture);
}

function lift(drag) {
  const el = drag.piece.el;
  el.classList.add("lift");
  el.classList.remove("picked", "home");
  el.style.position = "absolute";
  el.style.transform = "translate(-50%,-50%)";
  el.style.left = drag.home.x + "px";
  el.style.top = drag.home.y + "px";
  placedEl.appendChild(el);
  /* appendChild moves the node, and moving a node implicitly releases pointer
     capture -- so the capture taken in onGrab dies right here, on the first move of
     every drag. What is left still looks like it works, because the listeners are on
     the element and the element sits under the finger: slow drags keep hitting it.
     A quick one does not. Events then go to whatever is under the cursor instead,
     no pointerup ever reaches the piece, and it is abandoned mid-drag -- still
     absolutely positioned, and invisible if it was left above the stage, which
     `#stage{overflow:hidden}` clips. Reported from the live game as "drag the
     planets upward and they vanish"; upward is simply where the header is and where
     the cursor most easily outruns the piece. Retaking it is the whole fix. */
  try { el.setPointerCapture(drag.id); } catch (e) { /* not fatal */ }
}

function onMove(event) {
  const drag = state.drag;
  if (!drag || event.pointerId !== drag.id) return;
  if (!drag.moved) {
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 9) return;
    drag.moved = true;
    lift(drag);
    sfx.pick();
  }
  const box = stage.getBoundingClientRect();
  /* Kept inside the stage on purpose. `#stage{overflow:hidden}` clips anything past
     its edge, so a planet dragged up into the header is simply not drawn -- the child
     is holding something they cannot see, which is the other half of what was reported
     as "they vanish". The piece now stops at the edge and stays under the finger's
     direction of travel instead. Nothing is lost by clamping: a drop outside a target
     sends the piece home anyway, so the clamped position answers exactly as the
     unclamped one did. */
  const el = drag.piece.el;
  const half = { w: el.offsetWidth / 2, h: el.offsetHeight / 2 };
  const x = clamp(event.clientX - box.left - drag.offX, half.w, box.width - half.w);
  const y = clamp(event.clientY - box.top - drag.offY, half.h, box.height - half.h);
  el.style.left = x + "px";
  el.style.top = y + "px";
  highlight(x, y);
}

function onRelease(event) {
  const drag = state.drag;
  if (!drag || event.pointerId !== drag.id) return;
  /* A drop is already an answer. Without this the same pointerup would bubble to
     onStageTap and answer a second time. */
  event.stopPropagation();
  const el = drag.piece.el;
  releaseListeners(el);
  state.drag = null;
  clearHighlight();

  if (!drag.moved) {
    onTapPiece(drag.piece);
    return;
  }

  const box = stage.getBoundingClientRect();
  drag.piece.homeAt = drag.home;
  dropAt(drag.piece, {
    x: event.clientX - box.left - drag.offX,
    y: event.clientY - box.top - drag.offY,
  });
}

/* A tap on a piece in the tray. In level 1 that is the whole answer: the right
   planet goes home on one tap, no ring to find afterwards. In levels 2 and 3 it
   picks the moon up and the question changes to name it. */
function onTapPiece(piece) {
  if (state.celebrating || piece.placed) return;

  if (state.level === 1) {
    if (piece.spec.key === PLANETS[state.step].key) landPlanet(piece, state.step);
    else refuse(piece, piece.el, `Not that one. ${questionFor(state.step)}`);
    return;
  }

  /* There is only ever one moon on the deck, so a tap on it repeats the
     question rather than putting it down. */
  ask();
}

/* How near a tap has to be to count as "at this planet".

   A planet's ball is small and its moons orbit OUTSIDE it, so aiming at Jupiter
   and landing on Io was the ordinary miss: the moon was on top, it swallowed the
   tap, and it read out its own fact instead of answering the question. The owner
   hit this and asked for anywhere near the planet to count.

   The reach is built from the same rx that setMoonOrbit() draws with, so it
   always covers the moons actually in orbit right now and grows as they land.
   The floor keeps a bare planet a comfortable target: Mercury's ball is 22px
   across on a 9.7" iPad, which is smaller than a fingertip. */
const CATCH_MARGIN = 14;
const CATCH_FLOOR = 44;

function catchmentOf(key) {
  const spec = planetOf(key);
  const r = (spec.d * state.scale) / 2;
  const rings = state.orbiting.filter((m) => m.of === key).map((m) => m.ring);
  const outer = rings.length
    ? r + (11 + Math.max(...rings) * 8.5) * state.scale
    : r;
  return Math.max(outer + CATCH_MARGIN * state.scale, CATCH_FLOOR * state.scale);
}

/* The nearest planet whose reach contains the point, or null. Nearest-wins means
   two planets can never both claim a tap -- the boundary between them is the
   midpoint -- and the reach means a tap out in empty space still answers
   nothing, rather than becoming a wrong answer the child did not give. */
function planetNear(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const [key, at] of state.home) {
    const slot = state.layout.slots[at.slot];
    const dist = Math.hypot(x - slot.x, y - slot.y);
    if (dist < bestDist && dist <= catchmentOf(key)) {
      bestDist = dist;
      best = key;
    }
  }
  return best;
}

/* With a moon in hand, every tap on the board is an answer and it is resolved by
   proximity, so this runs only for taps that are not answering anything: level 1,
   and the finished board. */
function onStageTap(event) {
  if (state.level === 1 || !state.picked || state.celebrating) return;
  const box = stage.getBoundingClientRect();
  const key = planetNear(event.clientX - box.left, event.clientY - box.top);
  if (key) answerWith(state.picked, key);
}

stage.addEventListener("pointerup", onStageTap);

/* A tap on something already on the board. A tap is a child asking "what is
   this?", and it gets the name and the fact back. Answering is not done here --
   see onStageTap. */
function onTapPlaced(event) {
  const piece = state.pieces.get(event.currentTarget.dataset.key);
  if (!piece || !piece.placed || state.celebrating) return;

  /* Whatever the game was already going to do next still happens. A poke while a
     fact is being read must not replace the next moon with a repeated question
     and leave the level with nothing to come. */
  const next = state.beat || ask;

  /* The question is live, so this tap is an answer and onStageTap has it. Doing
     nothing here is what stops a moon in orbit from stealing it. */
  if (state.level > 1 && state.picked) return;

  const line = piece.kind === "moon"
    ? `${piece.spec.name}, a moon of ${planetOf(piece.spec.of).name}. ${piece.spec.fact}`
    : `${piece.spec.name}. ${piece.spec.fact}`;
  say(line);
  speak(line);
  tell(piece);
  /* Put the question back after the answer has been read, so a child poking at
     the board does not lose the thread of what was being asked. */
  nextBeat(READ_FACT + 1200, next);
}

function answerWith(moonPiece, hostKey) {
  if (hostKey === moonPiece.spec.of) {
    landMoon(moonPiece, hostKey);
    return;
  }
  const hostPiece = state.pieces.get(hostKey);
  refuse(
    null,
    hostPiece ? hostPiece.el : null,
    NO_MOONS[hostKey] || `${planetOf(hostKey).name} is not where ${moonPiece.spec.name} lives.`
  );
}

/* Where a dragged piece was let go. One decision point for the drag, so it can
   never disagree with the tap about what counts as a hit. */
function dropAt(piece, at) {
  if (state.level === 1) {
    /* Only the ring being asked about accepts anything, and only from the
       planet it is asking for. Anything else slides back to the tray. */
    const slot = state.layout.slots[state.step];
    const reach = state.layout.ring / 2 + SNAP;
    const onTarget = Math.hypot(at.x - slot.x, at.y - slot.y) < reach;

    if (piece.spec.key === PLANETS[state.step].key) {
      if (onTarget) landPlanet(piece, state.step);
      else { sendHome(piece); say(questionFor(state.step)); }
      return;
    }
    refuse(
      piece,
      onTarget ? slotsEl.querySelector(`.slot[data-slot="${state.step}"]`) : piece.el,
      `Not that one. ${questionFor(state.step)}`
    );
    return;
  }

  const hostKey = nearestPlanet(at);
  if (!hostKey) {
    sendHome(piece);
    return;
  }
  answerWith(piece, hostKey);
  if (!piece.placed) sendHome(piece);
}

function nearestPlanet(at) {
  let best = null;
  let bestDist = Infinity;
  for (const [key, home] of state.home) {
    const slot = state.layout.slots[home.slot];
    const reach = (planetOf(key).d * state.scale) / 2 + SNAP;
    const d = Math.hypot(at.x - slot.x, at.y - slot.y);
    if (d < reach && d < bestDist) {
      bestDist = d;
      best = key;
    }
  }
  return best;
}

function highlight(x, y) {
  clearHighlight();
  if (state.level === 1) {
    const slot = state.layout.slots[state.step];
    if (Math.hypot(x - slot.x, y - slot.y) < state.layout.ring / 2 + SNAP) {
      slotsEl.querySelector(`.slot[data-slot="${state.step}"]`).classList.add("near");
    }
    return;
  }
  const key = nearestPlanet({ x, y });
  if (key) {
    const piece = state.pieces.get(key);
    if (piece) piece.el.classList.add("hot");
  }
}

function clearHighlight() {
  slotsEl.querySelectorAll(".slot.near").forEach((el) => el.classList.remove("near"));
  placedEl.querySelectorAll(".body.hot").forEach((el) => el.classList.remove("hot"));
}

/* Back to its cell in the tray. The piece slides home rather than teleporting,
   so a wrong answer looks like "not there" and not like "gone". */
function sendHome(piece) {
  const el = piece.el;
  el.classList.remove("lift");
  if (!piece.cell) return;

  const cellBox = piece.cell.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();
  el.classList.add("home");
  el.style.left = cellBox.left + cellBox.width / 2 - stageBox.left + "px";
  el.style.top = cellBox.top + cellBox.height / 2 - stageBox.top + "px";

  setTimeout(() => {
    el.classList.remove("home");
    el.style.position = "relative";
    el.style.transform = "none";
    el.style.left = "";
    el.style.top = "";
    piece.cell.appendChild(el);
  }, reduced.matches ? 0 : 300);
}

/* -------------------------------------------------------------- animation --- */

function drawMoon(moon) {
  moon.el.style.left = moon.cx + Math.cos(moon.angle) * moon.rx + "px";
  moon.el.style.top = moon.cy + Math.sin(moon.angle) * moon.ry + "px";
  /* In front of its planet on the near half of the orbit, behind on the far
     half. Without this the moons look pasted on. */
  moon.el.style.zIndex = Math.sin(moon.angle) >= 0 ? "6" : "3";
}

let last = 0;

function tick(now) {
  cancelAnimationFrame(state.raf);
  if (!state.orbiting.length) return;

  if (reduced.matches) {
    state.orbiting.forEach(drawMoon);
    return;
  }

  const t = now || performance.now();
  const dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
  last = t;
  for (const moon of state.orbiting) {
    moon.angle += moon.speed * dt;
    drawMoon(moon);
  }
  state.raf = requestAnimationFrame(tick);
}

function burst(x, y, count) {
  if (reduced.matches) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("i");
    s.className = "spark";
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const far = 30 + Math.random() * 52;
    s.style.left = x + "px";
    s.style.top = y + "px";
    s.style.setProperty("--dx", Math.cos(angle) * far + "px");
    s.style.setProperty("--dy", Math.sin(angle) * far + "px");
    s.style.setProperty("--dur", 480 + Math.random() * 380 + "ms");
    sparksEl.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}

/* The Sun swaps between four painted frames. That technique reads as flicker on
   a planet, because a reinvented Great Red Spot is a lie, but it is right here:
   granulation genuinely dissolves and re-forms, so a Sun redrawn every frame is
   telling the truth. (MOTION-DIRECTION.md.) */
function animateSun() {
  if (reduced.matches) return;
  const frames = [...sunEl.querySelectorAll("img")];
  let at = 0;
  setInterval(() => {
    frames[at].classList.remove("on");
    at = (at + 1) % frames.length;
    frames[at].classList.add("on");
  }, 760);
}

/* ------------------------------------------------------------------ chrome --- */

function syncLevelButtons() {
  document.querySelectorAll(".lvl").forEach((btn) => {
    const level = Number(btn.dataset.level);
    btn.classList.toggle("now", level === state.level);
    btn.classList.toggle("done", level < state.level);
    btn.disabled = level > state.unlocked;
  });
}

function save() {
  try {
    localStorage.setItem("solar-order", JSON.stringify({
      unlocked: state.unlocked,
      sound: state.sound,
    }));
  } catch (e) { /* private browsing: the game simply starts fresh next time */ }
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem("solar-order") || "{}");
    state.unlocked = clamp(Number(raw.unlocked) || 1, 1, 3);
    state.sound = raw.sound !== false;
  } catch (e) { /* same */ }
}

soundBtn.onclick = () => {
  state.sound = !state.sound;
  soundBtn.setAttribute("aria-pressed", String(state.sound));
  soundBtn.setAttribute("aria-label", state.sound ? "Sound on" : "Sound off");
  if (state.sound) sfx.pick();
  save();
};

againBtn.onclick = () => startLevel(state.level);

document.querySelectorAll(".lvl").forEach((btn) => {
  btn.onclick = () => {
    const level = Number(btn.dataset.level);
    if (level <= state.unlocked) startLevel(level);
  };
});

/* Repeat the question. Tapping the caption is the obvious thing a child does
   when they did not catch it. */
captionEl.addEventListener("click", () => {
  if (state.celebrating) return;
  const next = state.beat;
  ask();
  /* Re-arm what was coming so it lands after the repeat instead of on top of it.
     If a repeat was all that was pending, the tap has just done it. */
  if (next && next !== ask) nextBeat(READ_FACT, next);
  else cancelBeat();
});

/* Sizes the two fixed bands. The tray has to hold Jupiter, which is the tallest
   thing that ever sits in it. */
function sizeBands() {
  const h = innerHeight;
  document.documentElement.style.setProperty("--bar-h", Math.round(clamp(h * 0.085, 48, 66)) + "px");
  document.documentElement.style.setProperty("--tray-h", Math.round(clamp(h * 0.2, 108, 168)) + "px");
}

let resizeTimer = 0;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    sizeBands();
    measure();
    /* The tray's cell widths depend on the stage width, so it is rebuilt with
       whatever has not been placed yet, in the order it is showing now. */
    if (state.level === 1) {
      const order = [...trayRow.children].map((c) => c.dataset.key);
      const specs = PLANETS
        .filter((p) => !(state.pieces.get(p.key) || {}).placed)
        .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
      if (specs.length) buildTray(specs);
      else trayRow.innerHTML = "";
    } else if (state.current) {
      /* Put the same moon back on a freshly measured deck: the queue must not
         advance just because the iPad was turned round. */
      state.queue.unshift(state.current);
      cancelBeat();
      presentNext();
    }
    if (state.level === 1) {
      slotsEl.querySelectorAll(".slot").forEach((el) => {
        el.classList.toggle("asking", Number(el.dataset.slot) === state.step && !state.celebrating);
      });
    }
  }, 120);
}

addEventListener("resize", onResize);
addEventListener("orientationchange", onResize);
reduced.addEventListener("change", () => { last = 0; tick(); });

/* ------------------------------------------------------------------- boot --- */

load();
soundBtn.setAttribute("aria-pressed", String(state.sound));
sizeBands();
startLevel(1);
animateSun();

if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
