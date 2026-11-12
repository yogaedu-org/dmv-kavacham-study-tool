// audio-source.js: one swappable audio source for the verse player (dmv #56).
//
// The player calls ONE function, `resolve(verseId)`, and plays whatever URL comes back. Where
// the audio lives (a cloud base URL, a same-origin folder, the user's own files) is decided
// only by the config object. Swapping audio = swapping the config or a base URL; the player
// code never changes. Plain ES module, no dependency, no build step; safe to import into the
// live app unchanged.
//
// Config shape (all keys shown; see README.md):
//   {
//     version: 1,
//     set:     { id: "day2", label: "Day 2, recommended by the #55 analysis" },
//     sources: [                                  // chain order is fixed by `order`, not by this list
//       { kind: "custom" },                       // files the user picked this session
//       { kind: "offline", base: "local-audio/offline/", label: "offline folder" },
//       { kind: "cloud",   base: "https://host/dir/",   label: "cloud", crossOrigin: null }
//     ],
//     order:  ["custom", "offline", "cloud"],     // optional; this is the default
//     verses: [ { id: 1, file: "day2/verse01.mp3" | { cloud: "day2__verse01.mp3", offline: "..." },
//                 sha256: "...", duration: 12.64, set: "Day 2" }, ... ]
//   }

export const KINDS = ["custom", "offline", "cloud"];
const DEFAULT_ORDER = ["custom", "offline", "cloud"];
const PROBE_TIMEOUT_MS = 10000;

/** Verse number from a file name: "verse-07.mp3" -> 7, "07.wav" -> 7, "Take2_verse14.m4a" -> 14. null if none. */
export function matchVerseNumber(fileName, maxVerse = 14) {
  const base = String(fileName).replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  let m = /verse[\s_-]*0*(\d{1,3})(?!\d)/i.exec(base);          // an explicit "verse" marker wins
  if (!m) {
    const runs = [...base.matchAll(/(\d{1,3})(?!\d)/g)];       // else the LAST digit run ("day2-07" -> 7)
    m = runs.length ? runs[runs.length - 1] : null;
  }
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= maxVerse ? n : null;
}

function joinUrl(base, file, baseHref) {
  const b = base.endsWith("/") ? base : base + "/";
  const f = String(file).split("/").map(encodeURIComponent).join("/");
  return new URL(f, new URL(b, baseHref)).href;
}

function pickFile(verse, kind) {
  const f = verse.file;
  if (f && typeof f === "object") return f[kind] ?? f.default ?? null;
  return f ?? null;
}

/** Default probe (browser): load metadata into a throwaway <audio>; resolves {duration} or rejects with a reason. */
export function probeMedia(url, { crossOrigin = null, timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    let done = false;
    const finish = (fn, v) => { if (done) return; done = true; clearTimeout(t); a.removeAttribute("src"); a.load(); fn(v); };
    const t = setTimeout(() => finish(reject, `no response in ${timeoutMs / 1000}s`), timeoutMs);
    if (crossOrigin) a.crossOrigin = crossOrigin;
    a.preload = "metadata";
    a.onloadedmetadata = () => finish(resolve, { duration: a.duration });
    a.onerror = async () => {
      let why = "could not be loaded (missing file, blocked by CORS, or unsupported format)";
      try {                                                         // best-effort: say what the server answered
        const r = await fetch(url, { method: "HEAD" });
        why = r.ok ? "answered OK but the browser could not decode it (unsupported or damaged audio)"
                   : `HTTP ${r.status} ${r.statusText || ""}`.trim();
      } catch { /* cross-origin without CORS, or offline: keep the generic reason */ }
      finish(reject, why);
    };
    a.src = url;
  });
}

export function createAudioSource(initialConfig, { probe = probeMedia, baseHref = (typeof document !== "undefined" ? document.baseURI : "http://localhost/") } = {}) {
  let config = null;
  let custom = new Map();          // verse id -> { url, name }

  function setConfig(next) {
    if (!next || !Array.isArray(next.verses) || !Array.isArray(next.sources)) throw new Error("audio config needs `verses` and `sources` arrays");
    config = next;
  }
  setConfig(initialConfig);

  const order = () => (config.order || DEFAULT_ORDER).filter((k) => KINDS.includes(k));
  const sourceOf = (kind) => config.sources.find((s) => s.kind === kind) || null;
  const verseOf = (id) => config.verses.find((v) => Number(v.id) === Number(id)) || null;

  /** Candidate list for a verse in chain order, no network. mode "auto" = whole chain, or one kind. */
  function candidates(verseId, mode = "auto", kinds = null) {
    const verse = verseOf(verseId);
    kinds = kinds || (mode === "auto" ? order() : [mode]);
    const out = [];
    for (const kind of kinds) {
      const src = sourceOf(kind);
      const label = (src && src.label) || kind;
      if (kind === "custom") {
        const c = custom.get(Number(verseId));
        out.push(c ? { kind, label: `your file ${c.name}`, url: c.url } : { kind, label, url: null, skip: custom.size ? `no custom file for verse ${verseId} (have: ${[...custom.keys()].sort((a, b) => a - b).join(", ")})` : "no custom files chosen" });
      } else if (!src) {
        out.push({ kind, label, url: null, skip: `no ${kind} source in the config` });
      } else if (!verse) {
        out.push({ kind, label, url: null, skip: `verse ${verseId} is not in the config` });
      } else {
        const file = pickFile(verse, kind);
        out.push(file ? { kind, label, url: joinUrl(src.base, file, baseHref), crossOrigin: src.crossOrigin ?? null } : { kind, label, url: null, skip: `verse ${verseId} has no ${kind} file name` });
      }
    }
    return out;
  }

  /** The one call the player makes. Never throws for a missing file: returns {missing:true, tried:[...]}.
   * mode: "auto" (whole chain) or one kind; `kinds` (e.g. ["offline","cloud"]) overrides it with an explicit chain. */
  async function resolve(verseId, { mode = "auto", kinds = null } = {}) {
    const tried = [];
    const verse = verseOf(verseId);
    for (const c of candidates(verseId, mode, kinds)) {
      if (!c.url) { tried.push({ kind: c.kind, label: c.label, ok: false, reason: c.skip }); continue; }
      try {
        const info = c.kind === "custom" ? { duration: null } : await probe(c.url, { crossOrigin: c.crossOrigin });
        return {
          url: c.url, source: c.kind, label: c.label, duration: info.duration ?? (verse && verse.duration) ?? null,
          setLabel: (verse && verse.set) || (config.set && config.set.label) || "", sha256: (verse && verse.sha256) || null, tried,
        };
      } catch (e) {
        tried.push({ kind: c.kind, label: c.label, url: c.url, ok: false, reason: String(e && e.message || e) });
      }
    }
    return { missing: true, verseId: Number(verseId), tried };
  }

  /** Register the user's own files; matched to verses by the number in the file name. Replaces earlier custom files. */
  function setCustomFiles(files) {
    for (const c of custom.values()) URL.revokeObjectURL(c.url);
    custom = new Map();
    const matched = {}, rejected = [];
    const max = config.verses.length || 14;
    for (const f of Array.from(files || [])) {
      const n = matchVerseNumber(f.name, max);
      if (n == null) { rejected.push({ name: f.name, reason: `no verse number 1-${max} in the file name` }); continue; }
      if (custom.has(n)) { rejected.push({ name: custom.get(n).name, reason: `replaced by ${f.name} (same verse ${n})` }); URL.revokeObjectURL(custom.get(n).url); }
      custom.set(n, { url: URL.createObjectURL(f), name: f.name });
      matched[n] = f.name;
    }
    return { matched, rejected };
  }
  function clearCustom() { for (const c of custom.values()) URL.revokeObjectURL(c.url); custom = new Map(); }
  const customIds = () => [...custom.keys()].sort((a, b) => a - b);

  return { resolve, candidates, setConfig, getConfig: () => config, setCustomFiles, clearCustom, customIds, verseOf };
}
