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
       closing lines now spoken on every level, which changes audio-list.js. */
const CACHE_NAME = "solar-order-v8";

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
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
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
