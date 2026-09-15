/* Solar System Order — offline cache.

   Bump CACHE_NAME whenever any app file or sprite changes, or an installed copy
   keeps serving the old one. A cache-first worker handing back stale code is
   the failure that looks like "my edit did nothing".

   The sprite list is generated: tools/build-assets.py writes cache-list.js from
   the files it actually produced, so the offline set cannot fall behind the art. */

/* v1  the first build, never published
   v2  the 59 narration clips, never published
   v3  2026-08-21  first public version. The runtime narration manifest became
       narration/clips.json, so v2's cached lines.json would 404 the voice.
   v4  the voice disclosure on the sound button
   v5  the drag fix -- retaking the pointer capture lift() throws away
   v6  the back-to-the-hub button every app now carries
   v7  2026-08-28  level 4, the dwarf planets: six new sprites, a rewritten
       app.js, and level 3's closing line, which now points at level 4.
   v8  2026-08-28  the voice for level 4 -- 18 new clips -- and the openers and
       closing lines now spoken on every level, which changes audio-list.js.
   v9  2026-08-29  Makemake re-rendered to say "mah-kee mah-kee" rather than
       "make make" -- one clip, 069, re-rendered through the pronunciation
       override in the render manifest.
   v10 2026-08-29  Full moon parity with the storybook: fourteen new moons (ten
       Uranian minors plus Styx, Nix, Kerberos, Hydra), a new level 4 for
       Uranus's family, the dwarf level now 5 with Pluto's five moons, 33 new
       clips and two reworded closers, 14 new sprites.
   v11 2026-09-06  Thirty-nine more named moons, 30 -> 69, and the moon levels
       re-cut by whether anyone has ever SEEN the moon: levels 3-4 are bodies a
       spacecraft resolved, 5-7 are points of light, 8 is the dwarf planets and
       now eight moons. 39 new sprites, twelve of them carrying cited markings.
       The narration manifest now ships only the lines that have clips, so the
       95 new lines are shown rather than spoken until they are rendered.
   v12 2026-09-06  Those 95 lines rendered and transcoded, so all 69 moons are
       now spoken: 194 clips in audio-list.js, up from 107, and audioReady is
       true again for the whole game. Nothing about the app changed -- this is
       the voice catching up with the moons v11 added.
   v13 2026-09-06  Storybook parity closed, 69 -> 77 moons: the eight the Moon
       Explorer names that this game did not carry -- Saturn's Janus, Epimetheus,
       Prometheus, Pandora, Pan, Atlas and Daphnis, plus Jupiter's Himalia.
       check-moons.py had been printing them by name on every run since it started
       reading the storybook's own table instead of a transcribed list of thirty.
       8 new sprites: seven resolved by Cassini and marked accordingly, Himalia a
       plain lump because nobody has seen its surface. Pan, Atlas and Daphnis are
       the first bodies drawn with `flange` -- their equatorial skirt of ring ice
       changes the OUTLINE, which is what "shaped like a ravioli" actually means.
       Their 16 narration lines are not rendered yet, so they are shown rather
       than spoken and clips.json says so.
   v14 2026-09-06  Those 16 lines rendered and transcoded, so all 77 moons now
       speak: 210 clips in audio-list.js, up from 194, and clips.json is complete
       again with pending back to 0. Nothing about the app changed -- this is the
       voice catching up with the eight moons v13 added.
   v15 2026-09-06  Eight orphaned clips retired. They were superseded level
       titles and closers from the v11 re-cut and no manifest had referenced them
       since -- audio-list.js held 210 while 218 .m4a sat on disk, so they were
       published and downloaded by nothing. Proof they were dead: removing them
       left audio-list.js, cache-list.js and both narration manifests
       byte-identical. Archived to the sidecar first, because five of the eight
       had no surviving .mp3 master. app.js's header also stopped claiming the
       game has four levels. */
// v15 also carries (added 2026-09-13, never published under any version): #519, Umbriel is "The darkest of the
//   five big moons of Uranus." rather than "of all the moons of Uranus", re-rendered as clip 224; clip 044 retired.
const CACHE_NAME = "solar-order-v16";

/* Both lists are generated -- cache-list.js by tools/build-assets.py from the
   sprites it produced, audio-list.js by tools/build-audio.py from the clips it
   encoded -- so the offline set cannot fall behind what the game actually has.

   audio-list.js is committed containing an empty array rather than being created
   by the first render. importScripts on a missing file throws, and a throw while
   the worker script is being evaluated fails the whole registration -- so "no
   voice rendered yet" would have meant "no offline sprites either". Wrapping it
   in a try/catch is not a dependable rescue for that, and an always-present file
   needs no rescue. Keep it committed even while it is empty. */
importScripts("./cache-list.js");
importScripts("./audio-list.js");

const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./fonts.css",
  "./fonts/FredokaOne-latin.woff2",
  "./fonts/Nunito-latin.woff2",
  "./cache-list.js",
  "./audio-list.js",
  "./manifest.webmanifest",
  "./narration/clips.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_FILES);
      /* Sprites and clips are added one at a time and failures are swallowed: a
         single missing file must never leave the app uninstallable. */
      await Promise.all(
        [].concat(self.SPRITES || [], self.NARRATION || [])
          .map((url) => cache.add(url).catch(() => undefined))
      );
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        /* Evict only this app's old versions (solar-order-v*). Several repo apps
           share one origin when published, each with its own worker — deleting
           every cache that is not ours would evict the neighbours' offline caches.
           Foreign cache names are not ours to touch. */
        keys.filter((k) => /^solar-order-v/.test(k) && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  /* Navigations go to the network first so a published update is picked up on
     the next load, and fall back to the cached shell when there is none. */
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
