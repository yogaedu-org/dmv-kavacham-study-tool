# Daśamahāvidyā Kavacam — Text Corroboration Report

- **Date:** 2026-07-15
- **File under review:** `c:/Users/kaanchan/Projects/Yoga/Das Mahavidya artifact/dmv-kavacham-study-tool/data/verses.json`
- **Scope:** READ-ONLY corroboration of the 14-verse Devanāgarī + IAST against reputable online sources. No application files were modified.
- **Evidence discipline:** a claimed error is labelled **CONFIRMED** only when ≥2 independent sources agree; otherwise **HYPOTHESIS**.

---

## Sources consulted

| # | Source | URL | Reliability note |
|---|---|---|---|
| S1 | **Sanskrit Documents — दशमहाविद्याकवचम्** | https://sanskritdocuments.org/doc_devii/dashamahAvidyAkavacham.html | **Gold standard.** Proof-read, ITRANS-sourced scholarly repository. Full 14-verse Devanāgarī obtained verbatim. Primary reference for this report. |
| S2 | **Devshoppe — Shri Das Mahavidya Kavach (Sanskrit)** | https://www.devshoppe.com/blogs/articles/shri-das-mahavidya-kavach-in-sanskrit | Devotional commercial site, but carried the **full 14-verse Devanāgarī verbatim**. Independent of S1. Good second witness. |
| S3 | **Karmkandvidhi — Mahavidya Kavach** | https://karmkandvidhi.in/mahavidya-kavach/ | Karmakāṇḍa (ritual) site. Verses 1–4 obtained verbatim; verses 5–14 are rendered as images (not machine-readable) so only partial corroboration. |
| S4 | **Raja Thatha's Stotra Translations — Shri Mahavidya Kavach (tr. P. R. Ramachander)** | http://stotrarathna.blogspot.com/2018/06/shri-mahavidya-kavach.html | English translation only (no Sanskrit). Used to corroborate the **meaning** of the verses, not the orthography. |
| S5 | HinduNidhi — श्री दशमहाविद्या कवचम् | https://hindunidhi.com/das-mahavidya-cavacham-sanskrit/ | Listed as a source but full text could not be extracted (copyright decline on fetch). Title/existence corroborates the work only. |

Note: no source consulted carried an explicit **colophon naming the Toḍala Tantra** as the provenance — see "Uncertain" below.

---

## Overall verdict

**Our version is broadly and strongly corroborated.** The Devanāgarī of all 14 verses matches the authoritative Sanskrit Documents recension (S1) almost exactly, in the same count and order. The differences fall into three small buckets: (a) **three genuine internal mismatches** where our IAST or Devanāgarī disagrees with our own other verses and with both external sources — these are real, low-risk fixes; (b) **a few legitimate recension/orthographic variants** that should NOT be "corrected"; and (c) **cosmetic formatting/metadata** items. No verse is substantively wrong, mis-ordered, or missing. This is a clean, trustworthy text with a handful of transliteration polish items.

---

## Verse count & order

**CONFIRMED standard.** 14 verses, in the identical sequence to S1 (Sanskrit Documents) and S2 (Devshoppe): directional protection (1–4) → philosophical core + head/face (5–7) → torso/limbs (8–11) → fear-removal + Kālikā + all-covering close (12–14). No recension reordering observed.

---

## Per-verse table

| V | Status | Detail (source) |
|---|---|---|
| 1 | ⚠️ / ❌ | Devanāgarī **आग्नेय्यां** (double-y) is correct and matches S1+S2+S3. Our **IAST `āgneyāṃ` (single y) is a transliteration error** → should be `āgneyyāṃ`. Rest of verse ✅. |
| 2 | ✅ (formatting note) | Text corroborated (S1, S3). Our Devanāgarī runs the two half-lines together (`...भुवनेश्वरी ।वायव्यां...`) with no newline — daṇḍa placement is **correct**, only the line break is missing (cosmetic). S3 spells `नैर्ऋत्यां` vs our `नैरृत्यां` — orthographic variant, both valid. |
| 3 | ✅ (formatting note) | Identical to S1+S2. Same half-lines-run-together layout as V2 (cosmetic only). |
| 4 | ✅ | Identical to S1+S2, incl. `स्वयम्` (with म्). |
| 5 | ❌ | Devanāgarī **`स्वयं` (anusvāra)** disagrees with S1+S2 which read **`स्वयम्` (म् / halant)**, and disagrees with our OWN verses 1 & 4 (`स्वयम्`). Our IAST already reads `svayam`, matching the sources — so the Devanāgarī is the outlier. Fix → `स्वयम्`. Rest ✅. |
| 6 | ⚠️ / ❌ | Devanāgarī `शर्वाणी` correct (S1+S2), but our **IAST `śarvaṇī` drops the long ā → should be `śarvāṇī`** (transliteration error). Separately: our `नीलसरस्वती` (long ī) vs sources' `निलसरस्वती` (short i) — **our reading is etymologically correct** (Nīla = "blue") and internally consistent with our IAST `nīlasarasvatī`; do NOT "fix" to short i (see Variants). |
| 7 | ✅ | Identical to S1+S2. |
| 8 | ✅ | Identical to S1+S2. |
| 9 | ✅ | Identical to S1+S2. |
| 10 | ⚠️ | Enumeration `जङ्घोरू ... गुदं मुष्कं च मेढ्रं च नाभिं च` is **standard** (S1+S2). But our 2nd line **repeats `उग्रतारा`** (`...परिरक्षतु । उग्रतारा गुदं मुष्कं...`); the authoritative S1 has **no** repeat, S2 has it as a typo-variant `उग्रातारा`. The repeat makes the line hypermetric — recension variant, see Variants. |
| 11 | ✅ | Identical to S1+S2. |
| 12 | ✅ | Identical to S1+S2. |
| 13 | ✅ (metadata typo) | Devanāgarī `श्रीकालिकादेवी` correct (S1+S2). Only the `deities` metadata field reads `Shrikalikadevii` (doubled trailing i) — cosmetic typo in JSON metadata, not in the text. |
| 14 | ✅ | Identical to S1+S2. |

---

## Confirmed likely errors (actionable fixes)

Each cites the corroborating source(s). These are the items safe to fix.

1. **Verse 1 — IAST `āgneyāṃ` → `āgneyyāṃ`** — **CONFIRMED.**
   Devanāgarī reads `आग्नेय्यां` (य्य, double-y) in our file AND in S1, S2, S3. The IAST must reflect the double y (`āgneyyāṃ`, locative of āgneyī). Our single-y IAST does not match its own Devanāgarī.
   Sources: S1 https://sanskritdocuments.org/doc_devii/dashamahAvidyAkavacham.html ; S2 https://www.devshoppe.com/blogs/articles/shri-das-mahavidya-kavach-in-sanskrit

2. **Verse 5 — Devanāgarī `स्वयं` → `स्वयम्`** — **CONFIRMED.**
   Both S1 and S2 read `सर्वविद्यामयी स्वयम्` (म् / halant). Our own verses 1 and 4 use `स्वयम्`. Our IAST already reads `svayam`. Our verse-5 anusvāra `स्वयं` is the lone outlier. (Anusvāra before a pause is a defensible orthographic style in general, but here it is internally inconsistent AND both external witnesses use म्.)
   Sources: S1 ; S2 (both above).

3. **Verse 6 — IAST `śarvaṇī` → `śarvāṇī`** — **CONFIRMED.**
   Devanāgarī `शर्वाणी` (long ā) in our file AND in S1, S2. Our IAST dropped the long ā. Fix the IAST only.
   Sources: S1 ; S2 (both above).

4. **Verse 13 — metadata `"Shrikalikadevii"` → `"Shrikalikadevi"`** — **CONFIRMED (cosmetic).**
   The doubled trailing `ii` is a clear typo in the `deities` array. The verse text `श्रीकालिकादेवी` / `śrīkālikādevī` is correct. Metadata-only fix; does not touch the recited text.

---

## Legitimate variants (do NOT "fix" these — recension / orthographic differences)

- **Verse 10 — repeated `उग्रतारा` at the start of line 2.** Our reading (`... परिरक्षतु । उग्रतारा गुदं मुष्कं ...`) is a **recension variant**: the authoritative S1 omits the second `उग्रतारा` (metrically cleaner anuṣṭubh), while S2 includes it (as the typo-form `उग्रातारा`). Because at least one witness carries the repetition and our IAST is internally consistent with it, treat this as a variant, not an error. *If a cleaner metre is desired, the S1 reading (drop the second `उग्रतारा`) is the more authoritative one* — but this is an editorial choice, not a correction.
- **Verse 6 — `नीलसरस्वती` (our long ī) vs `निलसरस्वती` (S1, S2 short i).** Our reading is **etymologically correct** ("Nīla-Sarasvatī", the Blue Sarasvatī) and internally consistent with our IAST `nīlasarasvatī`. The online sources' short-i form is the common laxity. **Keep our reading.**
- **Verse 2 — `नैरृत्यां` (ours, S1) vs `नैर्ऋत्यां` (S3).** Two accepted ways of writing the nairṛti locative. No change needed.
- **Verses 2 & 3 — half-lines run together on one line with no newline.** The daṇḍa (`।`) placement is correct; only the visual line break between the two pādas is absent (verses 1, 4–14 have it). Purely cosmetic layout — see fix #5 in summary if display consistency is wanted; not a textual error.

---

## Uncertain / could-not-corroborate

- **Toḍala Tantra provenance.** None of the machine-readable sources (S1–S3) carried a colophon attributing the kavacam to the **Toḍala Tantra**. The 14-verse kavacam itself is well-attested across sources, and the Toḍala-Tantra attribution is widely repeated in secondary/devotional descriptions, but I could not independently confirm it against a primary scan of the Toḍala Tantra in this pass. **Attribution: plausible but unverified here.** (An archive.org scan of the Toḍala Tantra would settle it.)
- **HinduNidhi (S5)** full text could not be extracted (fetch declined on copyright grounds); it corroborates the work's existence/title only, not orthography.
- **Verse 5 deity `श्रीभवगेहिनी` (Śrī-Bhavagehinī).** Meaning ("she of Bhava's/Śiva's household" = Pārvatī) is corroborated by the Ramachander translation S4 ("she who attracts Shiva"); spelling matches S1+S2. Noted only because the name is uncommon — no issue found.

---

## Update — third-source cross-check (2026-07-15)

**Prompted:** cross-check the four confirmed fixes against `drikpanchang.com`.

**Finding on drikpanchang:** drikpanchang does **not** host the Daśamahāvidyā Kavacam.
The linked page (`.../mahavidya/mahavidya-mantras.html`) is the *ten individual*
Mahāvidyā mantras (Kālī, Tārā, Ṣoḍaśī …), and drikpanchang's full Kavacham collection
(`/lyrics/kavacham/kavacham-collection.html`) lists only Narasimha, Narayana, Bhairava,
Durga, Lakṣmī, Sītā, and Śītalā kavachams — no Mahāvidyā kavacam. So it could not serve
as a witness.

**Substitute third witness — S6 (independent of S1/S2):**
| # | Source | URL |
|---|---|---|
| S6 | Vishwamatha — Sri Dasa Mahavidya Kavacham | https://www.vishwamatha.com/sri-dasa-mahavidya-kavacham.html |

S6 reads verbatim: `आग्नेय्यां` (double-य), `सर्वविद्यामयी स्वयम्` (halant म्),
`शर्वाणी` (long ā), `पातु श्रीकालिकादेवी सर्वोत्पातेषु सर्वदा`.

**Result — all four fixes now stand on THREE independent sources (S1 + S2 + S6):**
| Fix | S1 | S2 | S6 | Verdict |
|---|---|---|---|---|
| V1 IAST `āgneyāṃ` → `āgneyyāṃ` | ✅ | ✅ | ✅ | CONFIRMED ×3 |
| V5 Devanāgarī `स्वयं` → `स्वयम्` | ✅ | ✅ | ✅ | CONFIRMED ×3 |
| V6 IAST `śarvaṇī` → `śarvāṇī` | ✅ | ✅ | ✅ | CONFIRMED ×3 |
| V13 metadata `Shrikalikadevii` → `Shrikalikadevi` | ✅ | ✅ | ✅ | CONFIRMED ×3 |
