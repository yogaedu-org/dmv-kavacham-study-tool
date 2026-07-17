"""P3 (#25): generate the i18n review board artifact from the real data.

Embeds verses + draft locales as a JSON blob; the page renders/edits them and
emits a Copy-JSON payload carrying the user's decisions AND any edits.
"""
import io
import json

verses = json.load(io.open('data/verses.json', encoding='utf-8'))['verses']
locales = {}
for loc in ('ne', 'es'):
    locales[loc] = json.load(io.open('i18n/%s.json' % loc, encoding='utf-8'))
en = json.load(io.open('i18n/en.json', encoding='utf-8'))

_flagdoc = json.load(io.open('i18n/review-flags.json', encoding='utf-8'))
_resolved = set(_flagdoc.get('resolutions', {}).keys())
# Only show flags still genuinely open (resolved ones are recorded in review-flags.json).
flags = [f for f in _flagdoc['flags'] if f['id'] not in _resolved]

DATA = {
    "repo": "yogaedu-org/dmv-kavacham-study-tool",
    "issue": 25,
    "flags": flags,
    "locales": [
        {"code": "ne", "label": "नेपाली (Nepali)", "note": locales['ne'].get('_note', '')},
        {"code": "es", "label": "Español (Spanish)", "note": locales['es'].get('_note', '')},
    ],
    "verses": [
        {
            "n": v["number"],
            "sa": v["sanskrit"],
            "iast": v["transliteration"],
            "en": v["translations"]["en"],
            "ne": v["translations"].get("ne", ""),
            "es": v["translations"].get("es", ""),
        }
        for v in verses
    ],
    "terms": {
        loc: {
            field: [
                {"key": k, "en": en["terms"][field][k], "draft": locales[loc]["terms"][field].get(k, "")}
                for k in sorted(en["terms"][field])
            ]
            for field in ("deities", "directions", "bodyParts")
        }
        for loc in ("ne", "es")
    },
}

blob = json.dumps(DATA, ensure_ascii=False, indent=None, separators=(',', ':'))

html = io.open('tools/i18n/review_board_template.html', encoding='utf-8').read()
html = html.replace('/*__DATA__*/null', blob)
io.open('reports/assets/i18n-review-board.html', 'w', encoding='utf-8', newline='').write(html)
print('wrote reports/assets/i18n-review-board.html  (%d verses, %d locales)' % (len(DATA['verses']), len(DATA['locales'])))
for loc in ('ne', 'es'):
    n_terms = sum(len(DATA['terms'][loc][f]) for f in DATA['terms'][loc])
    print('  %s: %d terms' % (loc, n_terms))
