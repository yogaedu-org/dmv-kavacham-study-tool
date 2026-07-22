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

# Word-by-word (padaccheda): verse order preserved, sandhi/compounds split with hyphens.
# [devanagari, IAST(split), gloss]. Claude's analysis — cross-checked vs the verse text;
# flag anything off during editing.
WORDS = {
 1: [["ॐ","oṃ","the sacred syllable Om"],["प्राच्यां","prācyāṃ","in the east (loc.)"],
     ["रक्षतु","rakṣatu","may (she) protect"],["मे","me","me"],["तारा","tārā","Tārā"],
     ["कामरूपनिवासिनी","kāmarūpa-nivāsinī","dwelling in Kāmarūpa"],
     ["आग्नेय्यां","āgneyyāṃ","in the SE / Agni's quarter (loc.)"],["षोडशी","ṣoḍaśī","Ṣoḍaśī"],
     ["पातु","pātu","may (she) protect"],["याम्यां","yāmyāṃ","in the S / Yama's quarter (loc.)"],
     ["धूमावती","dhūmāvatī","Dhūmāvatī"],["स्वयम्","svayam","herself"]],
 2: [["नैर्ऋत्यां","nairṛtyāṃ","in the SW / Nirṛti's quarter"],["भैरवी","bhairavī","Bhairavī"],
     ["पातु","pātu","may protect"],["वारुण्यां","vāruṇyāṃ","in the W / Varuṇa's quarter"],
     ["भुवनेश्वरी","bhuvaneśvarī","Bhuvaneśvarī"],["वायव्यां","vāyavyāṃ","in the NW / Vāyu's quarter"],
     ["सततं","satataṃ","constantly, always"],["पातु","pātu","may protect"],
     ["छिन्नमस्ता","chinnamastā","Chinnamastā (the severed-headed)"],["महेश्वरी","maheśvarī","the great goddess"]],
 3: [["कौबेर्यां","kauberyāṃ","in the N / Kubera's quarter"],["पातु","pātu","may protect"],["मे","me","me"],
     ["देवी","devī","goddess"],["श्रीविद्या","śrī-vidyā","the auspicious Vidyā"],["बगलामुखी","bagalāmukhī","Bagalāmukhī"],
     ["ऐशान्यां","aiśānyāṃ","in the NE / Īśāna's quarter"],["पातु","pātu","may protect"],["मे","me","me"],
     ["नित्यं","nityaṃ","always"],["महात्रिपुरसुन्दरी","mahā-tripura-sundarī","great Tripurasundarī"]],
 4: [["ऊर्ध्वं","ūrdhvaṃ","above, upward"],["रक्षतु","rakṣatu","may protect"],["मे","me","me"],["विद्या","vidyā","the Vidyā"],
     ["मातङ्गीपीठवासिनी","mātaṅgī-pīṭha-vāsinī","dwelling at Mātaṅgī's seat"],["सर्वतः","sarvataḥ","on all sides"],
     ["पातु","pātu","may protect"],["मे","me","me"],["नित्यं","nityaṃ","always"],
     ["कामाख्या","kāmākhyā","of Kāmākhyā"],["कालिका","kālikā","Kālikā"],["स्वयम्","svayam","herself"]],
 5: [["ब्रह्मरूपा","brahma-rūpā","of the form of Brahman"],["महाविद्या","mahā-vidyā","the Great Vidyā"],
     ["सर्वविद्यामयी","sarva-vidyā-mayī","made of all knowledge"],["स्वयम्","svayam","herself"],
     ["शीर्षे","śīrṣe","on the head (loc.)"],["रक्षतु","rakṣatu","may protect"],["मे","me","me"],["दुर्गा","durgā","Durgā"],
     ["भालं","bhālaṃ","the forehead (acc.)"],["श्रीभवगेहिनी","śrī-bhava-gehinī","Śrī-Bhavagehinī (consort of Bhava)"]],
 6: [["त्रिपुरा","tripurā","Tripurā"],["भ्रुयुगे","bhru-yuge","on the pair of brows (loc.)"],["पातु","pātu","may protect"],
     ["शर्वाणी","śarvāṇī","Śarvāṇī (Pārvatī)"],["पातु","pātu","may protect"],["नासिकाम्","nāsikām","the nose (acc.)"],
     ["चक्षुषी","cakṣuṣī","the two eyes (acc. du.)"],["चण्डिका","caṇḍikā","Caṇḍikā"],["पातु","pātu","may protect"],
     ["श्रोत्रे","śrotre","the two ears (du.)"],["निलसरस्वती","nila-sarasvatī","Nīla-Sarasvatī"]],
 7: [["मुखं","mukhaṃ","the face (acc.)"],["सौम्यमुखी","saumya-mukhī","the gentle-faced one"],["पातु","pātu","may protect"],
     ["ग्रीवां","grīvāṃ","the neck (acc.)"],["रक्षतु","rakṣatu","may protect"],["पार्वती","pārvatī","Pārvatī"],
     ["जिह्वां","jihvāṃ","the tongue (acc.)"],["रक्षतु","rakṣatu","may protect"],["मे","me","me"],["देवी","devī","goddess"],
     ["जिह्वाललनभीषणा","jihvā-lalana-bhīṣaṇā","terrifying with lolling tongue"]],
 8: [["वाग्देवी","vāg-devī","goddess of speech"],["वदनं","vadanaṃ","the mouth (acc.)"],["पातु","pātu","may protect"],
     ["वक्षः","vakṣaḥ","the chest (acc.)"],["पातु","pātu","may protect"],["महेश्वरी","maheśvarī","Maheśvarī"],
     ["बाहू","bāhū","the two arms (acc. du.)"],["महाभुजा","mahā-bhujā","the mighty-armed one"],["पातु","pātu","may protect"],
     ["कराङ्गुलीः","kara-aṅgulīḥ","the fingers (acc. pl.)"],["सुरेश्वरी","sureśvarī","queen of the gods"]],
 9: [["पृष्ठतः","pṛṣṭhataḥ","from behind, at the back"],["पातु","pātu","may protect"],["भीमास्या","bhīm-āsyā","the fearsome-faced one"],
     ["कट्यां","kaṭyāṃ","at the hips/waist (loc.)"],["देवी","devī","goddess"],["दिगम्बरी","dig-ambarī","the sky-clad (Digambarī)"],
     ["उदरं","udaraṃ","the belly (acc.)"],["पातु","pātu","may protect"],["मे","me","me"],["नित्यं","nityaṃ","always"],
     ["महाविद्या","mahā-vidyā","the Great Vidyā"],["महोदरी","mah-odarī","the large-bellied (Mahodari)"]],
 10:[["उग्रतारा","ugra-tārā","Ugra-Tārā (fierce Tārā)"],["महादेवी","mahā-devī","the great goddess"],
     ["जङ्घोरू","jaṅghā-ūru","shanks and thighs (sandhi ā+ū→o)"],["परिरक्षतु","pari-rakṣatu","may protect all around"],
     ["गुदं","gudaṃ","the anus (acc.)"],["मुष्कं","muṣkaṃ","the scrotum (acc.)"],["च","ca","and"],
     ["मेढ्रं","meḍhraṃ","the phallus (acc.)"],["च","ca","and"],["नाभिं","nābhiṃ","the navel (acc.)"],["च","ca","and"],
     ["सुरसुन्दरी","sura-sundarī","Surasundarī"]],
 11:[["पादाङ्गुलीः","pāda-aṅgulīḥ","the toes (acc. pl.)"],["सदा","sadā","always"],["पातु","pātu","may protect"],
     ["भवानी","bhavānī","Bhavānī"],["त्रिदशेश्वरी","tridaśa-īśvarī","queen of the gods"],
     ["रक्तमांसास्थिमज्जादीन्","rakta-māṃsa-asthi-majjā-ādīn","blood, flesh, bone, marrow, etc. (acc. pl.)"],
     ["पातु","pātu","may protect"],["देवी","devī","goddess"],["शवासना","śava-āsanā","she seated on a corpse"]],
 12:[["महाभयेषु","mahā-bhayeṣu","in great dangers (loc. pl.)"],["घोरेषु","ghoreṣu","terrible (loc. pl.)"],
     ["महाभयनिवारिणी","mahā-bhaya-nivāriṇī","remover of great fear"],["पातु","pātu","may protect"],["देवी","devī","goddess"],
     ["महामाया","mahā-māyā","Mahāmāyā"],["कामाख्यापीठवासिनी","kāmākhyā-pīṭha-vāsinī","dwelling at Kāmākhyā's seat"]],
 13:[["भस्माचलगता","bhasma-acala-gatā","seated on the mountain of ash"],
     ["दिव्यसिंहासनकृताश्रया","divya-siṃhāsana-kṛta-āśrayā","who has taken abode on the divine lion-throne"],
     ["पातु","pātu","may protect"],["श्रीकालिकादेवी","śrī-kālikā-devī","Śrī Kālikā-devī"],
     ["सर्वोत्पातेषु","sarva-utpāteṣu","in all calamities (loc. pl.)"],["सर्वदा","sarvadā","always"]],
 14:[["रक्षाहीनं","rakṣā-hīnaṃ","devoid of protection"],["तु","tu","but/and"],["यत्स्थानं","yat-sthānaṃ","whatever place"],
     ["कवचेन","kavacena","by the armor (instr.)"],["अपि","api","even (kavacena+api→kavacenāpi)"],
     ["वर्जितम्","varjitam","left out, omitted"],["तत्सर्वं","tat-sarvaṃ","all that"],["सर्वदा","sarvadā","always"],
     ["पातु","pātu","may protect"],["सर्वरक्षणकारिणी","sarva-rakṣaṇa-kāriṇī","she who gives all protection"]],
}

def words_for(n):
    return [{"sa": w[0], "it": w[1], "gloss": w[2]} for w in WORDS[n]]

data_verses = [{"n": v["n"], "sa": v["sa"], "it": v["it"], "en": v["en"],
                "words": words_for(v["n"]), "singable": SINGABLE[v["n"]]} for v in verses]

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
