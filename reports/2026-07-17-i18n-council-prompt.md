# Council prompt — paste into ChatGPT / Gemini / DeepSeek

**Context for the human:** the Antigravity/Gemini (`agy`) lane was quota-capped
("resets in ~3h40m"), so run this manually in one or two other models and paste their
answers back. These are the four points neither KA nor Claude could settle, plus one
verification of a correction Claude is fairly sure about. Cross-compare the answers.

---

## Prompt (copy everything below)

You are helping translate the **Daśamahāvidyā Kavacam** (a Sanskrit protective hymn to
the ten Mahāvidyā goddesses) into **colloquial standard Nepali** and **Spanish**. A
native Nepali reader has said Sanskritic/tatsama vocabulary reads "too intellectual" —
so **colloquial Nepali is the target register**. Answer each point in 1–3 sentences and
**state your confidence**; if you don't know, say so rather than guessing.

1. **Intercardinal directions, devotional register.** The Sanskrit names the quarters
   आग्नेय्यां (SE), नैरृत्यां (SW), वायव्यां (NW), ऐशान्यां (NE). For a Nepali *devotional*
   audience reading a kavacam, is it better to label the filter tags with the classical
   Sanskrit-derived **आग्नेय / नैर्ऋत्य / वायव्य / ईशान**, or the plain everyday
   **उत्तरपूर्व / उत्तरपश्चिम / दक्षिणपूर्व / दक्षिणपश्चिम**? Recommend one for a *colloquial*
   register and say why.

2. **Verse 7 epithet — is the English wrong?** The line is
   "जिह्वां रक्षतु मे देवी जिह्वाललनभीषणा". An older English translation renders the
   epithet जिह्वाललनभीषणा as **"the goddess fearsome to foes."** I believe it actually
   means **"[the goddess] terrifying with her lolling/lapping tongue"** (जिह्वा-ललन-भीषणा,
   the classic Kālī लोलजिह्वा image). Which reading is correct? Give a literal morpheme
   breakdown of जिह्वाललनभीषणा, and a clean English rendering. Then give **colloquial
   Nepali** and **Spanish** renderings of the correct reading.

3. **Spanish quality pass.** Here are the Spanish body-part / direction terms I drafted;
   flag any that a native Spanish speaker would find wrong or unnatural, and for the
   count label "{n} seleccionadas": Ano, Brazos, Sangre, Huesos, Cejas, Pecho, Orejas,
   Ojos, Rostro (face), Dedos (fingers), Carne, Frente, Cabeza, Caderas (hips), Rodillas,
   Piernas, Médula, Boca, Ombligo, Cuello, Nariz, Falo, Escroto, Pantorrillas (shanks),
   Habla (speech), Muslos (thighs), "Dedos de los pies" (toes), Lengua. Directions: Este,
   Norte, Noreste, Noroeste, Sur, Sureste, Suroeste, Oeste, Arriba, "Todos los lados"
   (all sides), Detrás (behind).

---

## What to do with the answers
Paste each model's reply back into the Claude chat. Claude will cross-compare them with
its own findings (Sanskrit dictionaries already confirm जङ्घा=shank, ऊरु=thigh; and web
sources support the "lolling tongue" reading of #3), apply the agreed answers to
`i18n/*.json` + `verses.json`, and drop the `status: draft` flag on what's settled.
