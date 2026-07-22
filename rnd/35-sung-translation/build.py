"""#35 singable-editor build. Merges verses_dump.json with the singable drafts +
version history into singable.json, then injects that into editor.template.html ->
editor.html (the publishable artifact). Re-run after every accepted edit round."""
import io, json, re, sys
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

# Word-by-word (padaccheda): verse order preserved. Each written word is [surface-Devanāgarī,
# [[IAST-token, direct-gloss], ...]] — compounds split into tokens so the gloss sits ONE-TO-ONE
# under each part, in Sanskrit order. Claude's analysis, cross-checked vs the verse text.
WORDS = {
 1: [["ॐ",[["oṃ","Om"]]],["प्राच्यां",[["prācyāṃ","in-the-east"]]],["रक्षतु",[["rakṣatu","may-guard"]]],
     ["मे",[["me","me"]]],["तारा",[["tārā","Tārā"]]],
     ["कामरूपनिवासिनी",[["kāmarūpa","Kāmarūpa"],["nivāsinī","dwelling-in"]]],
     ["आग्नेय्यां",[["āgneyyāṃ","in-the-southeast"]]],["षोडशी",[["ṣoḍaśī","Ṣoḍaśī"]]],["पातु",[["pātu","may-guard"]]],
     ["याम्यां",[["yāmyāṃ","in-the-south"]]],["धूमावती",[["dhūmāvatī","Dhūmāvatī"]]],["स्वयम्",[["svayam","herself"]]]],
 2: [["नैरृत्यां",[["nairṛtyāṃ","in-the-southwest"]]],["भैरवी",[["bhairavī","Bhairavī"]]],["पातु",[["pātu","may-guard"]]],
     ["वारुण्यां",[["vāruṇyāṃ","in-the-west"]]],["भुवनेश्वरी",[["bhuvaneśvarī","Bhuvaneśvarī"]]],
     ["वायव्यां",[["vāyavyāṃ","in-the-northwest"]]],["सततं",[["satataṃ","always"]]],["पातु",[["pātu","may-guard"]]],
     ["छिन्नमस्ता",[["chinnamastā","Chinnamastā"]]],["महेश्वरी",[["maheśvarī","great-goddess"]]]],
 3: [["कौबेर्यां",[["kauberyāṃ","in-the-north"]]],["पातु",[["pātu","may-guard"]]],["मे",[["me","me"]]],
     ["देवी",[["devī","goddess"]]],["श्रीविद्या",[["śrīvidyā","Śrīvidyā"]]],["बगलामुखी",[["bagalāmukhī","Bagalāmukhī"]]],
     ["ऐशान्यां",[["aiśānyāṃ","in-the-northeast"]]],["पातु",[["pātu","may-guard"]]],["मे",[["me","me"]]],
     ["नित्यं",[["nityaṃ","always"]]],["महात्रिपुरसुन्दरी",[["mahā","great"],["tripurasundarī","Tripurasundarī"]]]],
 4: [["ऊर्ध्वं",[["ūrdhvaṃ","above"]]],["रक्षतु",[["rakṣatu","may-guard"]]],["मे",[["me","me"]]],["विद्या",[["vidyā","the-Vidyā"]]],
     ["मातङ्गीपीठवासिनी",[["mātaṅgī","Mātaṅgī"],["pīṭha","seat"],["vāsinī","dwelling-at"]]],
     ["सर्वतः",[["sarvataḥ","on-all-sides"]]],["पातु",[["pātu","may-guard"]]],["मे",[["me","me"]]],["नित्यं",[["nityaṃ","always"]]],
     ["कामाख्या",[["kāmākhyā","of-Kāmākhyā"]]],["कालिका",[["kālikā","Kālikā"]]],["स्वयम्",[["svayam","herself"]]]],
 5: [["ब्रह्मरूपा",[["brahma","Brahman"],["rūpā","formed-as"]]],["महाविद्या",[["mahā","great"],["vidyā","Vidyā"]]],
     ["सर्वविद्यामयी",[["sarva","all"],["vidyā","knowledge"],["mayī","made-of"]]],["स्वयम्",[["svayam","herself"]]],
     ["शीर्षे",[["śīrṣe","on-the-head"]]],["रक्षतु",[["rakṣatu","may-guard"]]],["मे",[["me","me"]]],["दुर्गा",[["durgā","Durgā"]]],
     ["भालं",[["bhālaṃ","the-forehead"]]],["श्रीभवगेहिनी",[["śrī","holy"],["bhava","Bhava's"],["gehinī","consort"]]]],
 6: [["त्रिपुरा",[["tripurā","Tripurā"]]],["भ्रुयुगे",[["bhru","brows"],["yuge","on-the-pair"]]],["पातु",[["pātu","may-guard"]]],
     ["शर्वाणी",[["śarvāṇī","Śarvāṇī"]]],["पातु",[["pātu","may-guard"]]],["नासिकाम्",[["nāsikām","the-nose"]]],
     ["चक्षुषी",[["cakṣuṣī","the-two-eyes"]]],["चण्डिका",[["caṇḍikā","Caṇḍikā"]]],["पातु",[["pātu","may-guard"]]],
     ["श्रोत्रे",[["śrotre","the-two-ears"]]],["निलसरस्वती",[["nila","blue"],["sarasvatī","Sarasvatī"]]]],
 7: [["मुखं",[["mukhaṃ","the-face"]]],["सौम्यमुखी",[["saumya","gentle"],["mukhī","faced"]]],["पातु",[["pātu","may-guard"]]],
     ["ग्रीवां",[["grīvāṃ","the-neck"]]],["रक्षतु",[["rakṣatu","may-guard"]]],["पार्वती",[["pārvatī","Pārvatī"]]],
     ["जिह्वां",[["jihvāṃ","the-tongue"]]],["रक्षतु",[["rakṣatu","may-guard"]]],["मे",[["me","me"]]],["देवी",[["devī","goddess"]]],
     ["जिह्वाललनभीषणा",[["jihvā","tongue"],["lalana","lolling"],["bhīṣaṇā","terrifying"]]]],
 8: [["वाग्देवी",[["vāc","speech"],["devī","goddess"]]],["वदनं",[["vadanaṃ","the-mouth"]]],["पातु",[["pātu","may-guard"]]],
     ["वक्षः",[["vakṣaḥ","the-chest"]]],["पातु",[["pātu","may-guard"]]],["महेश्वरी",[["maheśvarī","Maheśvarī"]]],
     ["बाहू",[["bāhū","the-two-arms"]]],["महाभुजा",[["mahā","mighty"],["bhujā","armed"]]],["पातु",[["pātu","may-guard"]]],
     ["कराङ्गुलीः",[["kara","hand"],["aṅgulīḥ","fingers"]]],["सुरेश्वरी",[["sura","gods'"],["īśvarī","queen"]]]],
 9: [["पृष्ठतः",[["pṛṣṭhataḥ","from-behind"]]],["पातु",[["pātu","may-guard"]]],["भीमास्या",[["bhīma","fearsome"],["āsyā","faced"]]],
     ["कट्यां",[["kaṭyāṃ","at-the-hips"]]],["देवी",[["devī","goddess"]]],["दिगम्बरी",[["dik","sky"],["ambarī","clad"]]],
     ["उदरं",[["udaraṃ","the-belly"]]],["पातु",[["pātu","may-guard"]]],["मे",[["me","me"]]],["नित्यं",[["nityaṃ","always"]]],
     ["महाविद्या",[["mahā","great"],["vidyā","Vidyā"]]],["महोदरी",[["mahā","large"],["udarī","bellied"]]]],
 10:[["उग्रतारा",[["ugra","fierce"],["tārā","Tārā"]]],["महादेवी",[["mahā","great"],["devī","goddess"]]],
     ["जङ्घोरू",[["jaṅghā","shanks"],["ūru","thighs"]]],["परिरक्षतु",[["pari","all-around"],["rakṣatu","may-guard"]]],
     ["गुदं",[["gudaṃ","the-anus"]]],["मुष्कं",[["muṣkaṃ","the-scrotum"]]],["च",[["ca","and"]]],
     ["मेढ्रं",[["meḍhraṃ","the-phallus"]]],["च",[["ca","and"]]],["नाभिं",[["nābhiṃ","the-navel"]]],["च",[["ca","and"]]],
     ["सुरसुन्दरी",[["sura","gods'"],["sundarī","beauty"]]]],
 11:[["पादाङ्गुलीः",[["pāda","foot"],["aṅgulīḥ","toes"]]],["सदा",[["sadā","always"]]],["पातु",[["pātu","may-guard"]]],
     ["भवानी",[["bhavānī","Bhavānī"]]],["त्रिदशेश्वरी",[["tridaśa","gods'"],["īśvarī","queen"]]],
     ["रक्तमांसास्थिमज्जादीन्",[["rakta","blood"],["māṃsa","flesh"],["asthi","bone"],["majjā","marrow"],["ādīn","etc."]]],
     ["पातु",[["pātu","may-guard"]]],["देवी",[["devī","goddess"]]],["शवासना",[["śava","corpse"],["āsanā","seated-on"]]]],
 12:[["महाभयेषु",[["mahā","great"],["bhayeṣu","in-dangers"]]],["घोरेषु",[["ghoreṣu","terrible"]]],
     ["महाभयनिवारिणी",[["mahā","great"],["bhaya","fear"],["nivāriṇī","remover-of"]]],["पातु",[["pātu","may-guard"]]],
     ["देवी",[["devī","goddess"]]],["महामाया",[["mahā","great"],["māyā","Māyā"]]],
     ["कामाख्यापीठवासिनी",[["kāmākhyā","Kāmākhyā"],["pīṭha","seat"],["vāsinī","dwelling-at"]]]],
 13:[["भस्माचलगता",[["bhasma","ash"],["acala","mountain"],["gatā","seated-on"]]],
     ["दिव्यसिंहासनकृताश्रया",[["divya","divine"],["siṃhāsana","lion-throne"],["kṛta","made"],["āśrayā","abode"]]],
     ["पातु",[["pātu","may-guard"]]],["श्रीकालिकादेवी",[["śrī","holy"],["kālikā","Kālikā"],["devī","goddess"]]],
     ["सर्वोत्पातेषु",[["sarva","all"],["utpāteṣu","in-calamities"]]],["सर्वदा",[["sarvadā","always"]]]],
 14:[["रक्षाहीनं",[["rakṣā","protection"],["hīnaṃ","lacking"]]],["तु",[["tu","but"]]],
     ["यत्स्थानं",[["yat","whatever"],["sthānaṃ","place"]]],["कवचेन",[["kavacena","by-the-armor"]]],["अपि",[["api","even"]]],
     ["वर्जितम्",[["varjitam","left-out"]]],["तत्सर्वं",[["tat","that"],["sarvaṃ","all"]]],["सर्वदा",[["sarvadā","always"]]],
     ["पातु",[["pātu","may-guard"]]],["सर्वरक्षणकारिणी",[["sarva","all"],["rakṣaṇa","protection"],["kāriṇī","giver-of"]]]],
}

def words_for(n):
    return [{"sa": w[0], "toks": [{"it": t[0], "g": t[1]} for t in w[1]]} for w in WORDS[n]]

# Pāda (half-line) split: how many padaccheda words fall in the FIRST line of each verse.
# Can't be re-derived by matching WORDS against `sa` — padaccheda un-does sandhi (v14 कवचेनापि
# → कवचेन + अपि) and a codepoint variant (v2 नैरृ vs नैर्ऋ), so the boundary is stored, not guessed.
# Verified against the surface half-lines of every verse (see verses_dump.json `sa`).
PADA1 = {1: 6, 2: 5, 3: 6, 4: 5, 5: 4, 6: 6, 7: 6, 8: 6, 9: 6, 10: 4, 11: 5, 12: 3, 13: 2, 14: 6}

def dandas_for(sa):
    """Trailing daṇḍa punctuation of each line, e.g. ['।', '॥१॥']."""
    out = []
    for line in sa.split("\n"):
        m = re.search(r"[।॥][०-९।॥\s]*$", line.strip())
        out.append(m.group(0).strip() if m else "")
    return out

def padas_for(n, sa):
    """Group the flat word list into two pādas, each carrying its closing daṇḍa."""
    ws, ds, cut = words_for(n), dandas_for(sa), PADA1[n]
    groups = [ws[:cut], ws[cut:]]
    return [{"words": g, "danda": ds[i] if i < len(ds) else ""} for i, g in enumerate(groups)]

data_verses = [{"n": v["n"], "sa": v["sa"], "it": v["it"], "en": v["en"],
                "padas": padas_for(v["n"], v["sa"]), "singable": SINGABLE[v["n"]]} for v in verses]

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
