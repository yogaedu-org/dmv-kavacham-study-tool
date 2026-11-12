// Unit tests for audio-source.js, run with: node --test rnd/56-audio-sources/tests/audio-source.test.mjs
// Each test is named for the failure it catches.
import test from "node:test";
import assert from "node:assert/strict";
import { createAudioSource, matchVerseNumber } from "../../../js/audio-source.js";

const cfg = (over = {}) => ({
  version: 1, set: { id: "d", label: "Day 2" },
  sources: [{ kind: "custom" }, { kind: "offline", base: "local/", label: "off" }, { kind: "cloud", base: "https://cdn.example/a/", label: "cl" }],
  verses: [{ id: 1, file: "v01.mp3", duration: 12 }, { id: 7, file: { cloud: "d__v07.mp3", offline: "v07.mp3" } }, { id: 14, file: "v14.mp3" }],
  ...over,
});
// fake network: `ok(url)` says whether the URL exists; cloud clips are fetched whole, so `fetchFn` serves bytes (status 200, ignoring Range)
const BYTES = new TextEncoder().encode("not really audio").buffer;
const fakeFetch = (ok, log = []) => async (url, init) => { log.push({ url, init }); return ok(url) ? { ok: true, status: 200, headers: new Map(), arrayBuffer: async () => BYTES } : { ok: false, status: 404, statusText: "Not Found" }; };
const make = (c, ok, extra = {}) => createAudioSource(c, { baseHref: "http://host:1/app/", probe: async (url) => { if (!url.startsWith("blob:") && !ok(url)) throw new Error("HTTP 404"); return { duration: 3 }; }, fetchFn: fakeFetch(ok), sha256: async () => null, ...extra });

test("file name 'verse-07.mp3' / '07.wav' / 'Take2_verse14.m4a' map to verses 7 / 7 / 14, a name without a number or out of range maps to nothing", () => {
  assert.equal(matchVerseNumber("verse-07.mp3"), 7);
  assert.equal(matchVerseNumber("07.wav"), 7);
  assert.equal(matchVerseNumber("Take2_verse14.m4a"), 14);
  assert.equal(matchVerseNumber("day2-07.mp3"), 7);
  assert.equal(matchVerseNumber("intro.mp3"), null);
  assert.equal(matchVerseNumber("verse-15.mp3"), null);
  assert.equal(matchVerseNumber("C:\\x\\verse3.mp3"), 3);
});

test("relative offline base resolves against the page, cloud base is used as given, per-kind file names are honoured", () => {
  const s = make(cfg(), () => true);
  const c = s.candidates(7, "auto");
  assert.deepEqual(c.map((x) => x.kind), ["custom", "offline", "cloud"]);
  assert.equal(c[1].url, "http://host:1/app/local/v07.mp3");
  assert.equal(c[2].url, "https://cdn.example/a/d__v07.mp3");
});

test("chain order is custom, then offline, then cloud: a missing offline file falls through to cloud and says what it skipped", async () => {
  const s = make(cfg(), (u) => u.startsWith("https://"));
  const r = await s.resolve(1);
  assert.equal(r.source, "cloud");
  assert.ok(r.url.startsWith("blob:"), "cloud audio is delivered as a blob: URL");
  assert.ok(r.tried.some((t) => t.kind === "offline" && /404/.test(t.reason)));
  assert.ok(r.tried.some((t) => t.kind === "custom"));
});

test("swapping only the base URL in the config changes where the same verse resolves, with no other change", async () => {
  const a = await make(cfg(), () => true).resolve(1, { mode: "cloud" });
  const b = cfg(); b.sources[2].base = "https://other.example/set5/";
  const r = await make(b, () => true).resolve(1, { mode: "cloud" });
  assert.equal(a.sourceUrl, "https://cdn.example/a/v01.mp3");
  assert.equal(r.sourceUrl, "https://other.example/set5/v01.mp3");
});

test("a verse with no audio anywhere returns {missing:true} naming every source tried, never a silent result", async () => {
  const r = await make(cfg(), () => false).resolve(14);
  assert.equal(r.missing, true);
  assert.deepEqual(r.tried.map((t) => t.kind), ["custom", "offline", "cloud"]);
  assert.ok(r.tried.every((t) => t.reason));
});

test("a verse that is not in the manifest is reported as missing, not as an exception", async () => {
  const r = await make(cfg(), () => true).resolve(9);
  assert.equal(r.missing, true);
  assert.ok(r.tried.some((t) => /not in the config/.test(t.reason)));
});

test("a mode restricts the chain to one kind", async () => {
  const r = await make(cfg(), () => true).resolve(1, { mode: "offline" });
  assert.equal(r.source, "offline");
  const m = await make(cfg(), () => true).resolve(1, { mode: "custom" });
  assert.equal(m.missing, true);
});

test("an incomplete config is rejected loudly", () => {
  assert.throws(() => createAudioSource({ verses: [] }), /verses.*sources/);
});

test("cloud audio is fetched whole and returned as a blob: URL, so a host that ignores Range still plays and seeks", async () => {
  const log = [];
  const s = make(cfg(), () => true, { fetchFn: fakeFetch(() => true, log) });
  const r = await s.resolve(1, { mode: "cloud" });
  assert.equal(r.delivery, "blob");
  assert.ok(r.url.startsWith("blob:"));
  assert.equal(r.sourceUrl, "https://cdn.example/a/v01.mp3");
  assert.equal(log.length, 1);
  assert.equal(log[0].init, undefined, "a plain GET: no Range header is sent or needed");
});

test("a sha256 mismatch is an error naming the file and the clip is never returned for playback", async () => {
  const c = cfg(); c.verses[0].sha256 = "a".repeat(64);
  const s = make(c, () => true, { sha256: async () => "b".repeat(64) });
  const r = await s.resolve(1, { mode: "cloud" });
  assert.equal(r.missing, true);
  assert.match(r.tried[0].reason, /sha256 mismatch for v01\.mp3/);
});

test("a matching sha256 is reported as verified; a context that cannot hash reports verified:false rather than pretending", async () => {
  const c = cfg(); c.verses[0].sha256 = "c".repeat(64);
  assert.equal((await make(c, () => true, { sha256: async () => "c".repeat(64) }).resolve(1, { mode: "cloud" })).verified, true);
  assert.equal((await make(c, () => true, { sha256: async () => null }).resolve(1, { mode: "cloud" })).verified, false);
});

test("a clip is fetched once per set and its object URL is revoked when the set is switched", async () => {
  const log = [];
  const s = make(cfg(), () => true, { fetchFn: fakeFetch(() => true, log) });
  const a = await s.resolve(1, { mode: "cloud" }), b = await s.resolve(1, { mode: "cloud" });
  assert.equal(a.url, b.url); assert.equal(log.length, 1);
  s.setConfig(cfg());                                                     // set switch
  const c = await s.resolve(1, { mode: "cloud" });
  assert.notEqual(c.url, a.url); assert.equal(log.length, 2);
});

test("a cloud fetch error is reported with the HTTP status or as a CORS/unreachable problem", async () => {
  const r404 = await make(cfg(), () => false).resolve(1, { mode: "cloud" });
  assert.match(r404.tried[0].reason, /HTTP 404/);
  const boom = make(cfg(), () => true, { fetchFn: async () => { throw new TypeError("Failed to fetch"); } });
  assert.match((await boom.resolve(1, { mode: "cloud" })).tried[0].reason, /CORS/);
});

test("offline audio still streams as a plain URL (no download) unless the source asks for blob delivery", async () => {
  const r = await make(cfg(), () => true).resolve(1, { mode: "offline" });
  assert.equal(r.delivery, "stream");
  assert.equal(r.url, "http://host:1/app/local/v01.mp3");
});
