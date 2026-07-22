"""#35 singable-editor build. Merges verses_dump.json with the singable drafts +
version history into singable.json, then injects that into editor.template.html ->
editor.html (the publishable artifact). Re-run after every accepted edit round."""
import io, json, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

verses = json.load(io.open("verses_dump.json", encoding="utf-8"))

# First-draft singable lines — 4 per verse, ~8 syllables, meaning preserved, names kept.
SINGABLE = {
 1: ["In the east, may Tārā keep me,", "she of Kāmarūpa's dwelling;",
     "southeast, Ṣoḍaśī will guard me,", "in the south, Dhūmāvatī reigns."],
 2: ["Southwest, Bhairavī protects me,", "in the west, Bhuvaneśvarī;",
     "northwest, mighty Chinnamastā", "shields me ever, Maheśvarī."],
 3: ["North, may Bagalāmukhī guard,", "Śrīvidyā, in Kubera's realm;",
     "northeast, Tripurasundarī,", "the Great One, guards me always."],
 4: ["Above, may Mātaṅgī protect,", "Vidyā at her sacred seat;",
     "all around, forever guarding,", "Kālikā of Kāmākhyā."],
 5: ["Brahman's form, the Great Vidyā,", "essence of all knowing, she;",
     "Durgā, guard my head; my brow,", "Śrī-Bhavagehinī, keep."],
 6: ["Tripurā, guard my two brows;", "Śarvāṇī, protect my nose;",
     "Caṇḍikā, keep watch my eyes;", "Nīla-Sarasvatī, my ears."],
 7: ["Gentle-faced One, guard my face;", "Pārvatī, protect my neck;",
     "she of the terrible tongue,", "guard, O goddess, this my tongue."],
 8: ["Vāgdevī, keep speech and mouth;", "Maheśvarī, guard my chest;",
     "Mighty-Armed, protect my arms;", "Sureśvarī, my fingers."],
 9: ["From behind, may Bhīmāsyā guard;", "at the hips, Digambarī;",
     "and my belly, evermore,", "Mahodari, Great Vidyā."],
 10:["Ugratārā, Great Goddess,", "guard my shanks and both my thighs;",
     "Surasundarī, protect", "groin and navel, all below."],
 11:["Bhavānī, queen of the gods,", "ever guard my very toes;",
     "corpse-throned goddess, keep my blood,", "flesh and bone and marrow too."],
 12:["In great terrors, dire and vast,", "she who ends the greatest fear—",
     "Mahāmāyā, guard me well,", "seated at Kāmākhyā's seat."],
 13:["On the mount of ash enthroned,", "on the divine lion-seat,",
     "Śrī-Kālikā, guard me still", "from all calamity, always."],
 14:["Whatever place is left bare,", "missed even by this armor,",
     "all of it, forever guard,", "All-Protecting Goddess, keep."],
}

data_verses = [{"n": v["n"], "sa": v["sa"], "it": v["it"], "en": v["en"],
                "singable": SINGABLE[v["n"]]} for v in verses]

# Seed version history (v0.1 snapshot = the first draft above).
history = [{
    "version": "v0.1",
    "ts": "2026-07-22",
    "note": "Claude first draft — all 14 verses, ~8-syllable lines.",
    "by": "Claude",
    "verses": [{"n": v["n"], "lines": SINGABLE[v["n"]]} for v in verses],
}]

DATA = {"repo": "yogaedu-org/dmv-kavacham-study-tool", "issue": 35,
        "verses": data_verses, "history": history}

io.open("singable.json", "w", encoding="utf-8", newline="").write(json.dumps(DATA, ensure_ascii=False, indent=2))

blob = json.dumps(DATA, ensure_ascii=False)
html = io.open("editor.template.html", encoding="utf-8").read().replace("/*__DATA__*/null", blob)
io.open("editor.html", "w", encoding="utf-8", newline="").write(html)
print("wrote singable.json + editor.html (%d verses, %d lines)" % (len(data_verses), 4*len(data_verses)))
