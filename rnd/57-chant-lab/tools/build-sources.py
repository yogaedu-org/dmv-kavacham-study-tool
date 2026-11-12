"""Build sources.html: every source behind the book, with a stable anchor (sources.html#s12) so a chapter's claim links to the entry,
which shows the address and the date. Run from anywhere:  python rnd/57-chant-lab/tools/build-sources.py
Dates are the publication or last-update date where the research reports gave one; "fetched 2026-11-12" otherwise."""
import html, os, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BOOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = "fetched 2026-11-12"
GROUPS = [
    ("The research behind the whole book", [
        ("r1", "research/01-record-compare-in-browser.md", "Report 1: record and compare chanting in the browser", "2026-11-12", "Record and compare, the quick and deeper checks, measured numbers, the calibration design."),
        ("r2", "research/02-swappable-audio-sources.md", "Report 2: swappable per-verse audio", "2026-11-12", "Cloud, offline and own-file sources for the reference clips."),
        ("r3", "research/03-chant-accuracy-METHOD.md", "Method of the chant accuracy analysis (14 verses over 6 days)", "2026-11-11", "Passes, pause rule, model-habit rule, scores, confidence and the five-slip smoke test."),
        ("p1", "research/dtw_probe.json", "dtw_probe.json", "2026-11-12", "Measurements behind chapters 3 and 7 (timing accuracy, planted slips, quick check)."),
        ("p2", "research/zipa_gop_probe.json", "zipa_gop_probe.json", "2026-11-12", "Measurements behind chapters 6 and 7 (planted slips, deeper check). The scripts that made both files stay in the hub repository."),
        ("s47", "https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/56", "dmv-kavacham-study-tool issue 56", F, "The issue the audio-source report belongs to."),
    ]),
    ("Chapter 4 and Lab 1: pitch and recording", [
        ("s1", "https://github.com/ianprime0509/pitchy", "pitchy (McLeod pitch method, MIT, version 4.1.0)", "npm 2024-01-04", "A candidate pitch tracker."),
        ("s2", "https://github.com/lars76/swift-f0", "SwiftF0 (MIT, version 0.3.0)", "2026-09-25", "A candidate pitch model if pitchy jitters on low chant (a hypothesis)."),
        ("s3", "https://groups.google.com/g/discuss-webrtc/c/PDZYMzAI-_Y", "discuss-webrtc thread", F, "Reports level drops on sustained tones with automatic gain control."),
        ("s4", "https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/autoGainControl", "MDN: autoGainControl", F, "Microphone settings are best effort; a browser may ignore them."),
        ("s5", "https://bugs.webkit.org/show_bug.cgi?id=179411", "WebKit bug 179411", F, "Constraints ignored on iOS 11."),
        ("s6", "https://blog.addpipe.com/getusermedia-audio-constraints.md", "addpipe: getUserMedia audio constraints", F, "Safari 26 gives stereo despite a one-channel request (secondary source)."),
        ("s7", "https://blog.addpipe.com/record-high-quality-audio-in-safari-with-alac-and-pcm-support-via-mediarecorder/", "addpipe: Safari and MediaRecorder formats", F, "Which recording formats Safari offers (secondary source)."),
    ]),
    ("Chapter 5: how apps score pronunciation", [
        ("s8", "https://arxiv.org/abs/2507.16838", "Cao et al., arXiv 2507.16838", "July 2025", "Goodness of pronunciation without a separate alignment step."),
        ("s9", "https://arxiv.org/abs/2506.02080", "Parikh et al., arXiv 2506.02080 (Interspeech 2025)", "2025", "Goodness of pronunciation limited to plausible confusions."),
        ("s10", "https://www.isca-archive.org/interspeech_2021/xu21k_interspeech.pdf", "Xu et al., Interspeech 2021", "2021", "A wav2vec2 system reached an F1 of 0.610 on English learners' speech."),
        ("s11", "https://arxiv.org/abs/2511.20107v1", "arXiv 2511.20107", "November 2025", "A training-free method reported 69.6 % (the data splits differ, so not a leaderboard)."),
        ("s12", "https://blog.englishtest.duolingo.com/new-research-in-language-learning-a-pronunciation-scoring-model-built-around-intelligibility-not-imitation", "Duolingo English Test blog", "2025-07-30", "The test's scorer: a deep model trained on human-rated responses."),
        ("s13", "https://onlinelibrary.wiley.com/doi/full/10.1111/lang.70000", "Language Learning paper (doi 10.1111/lang.70000)", F, "Spearman 0.82 with experts, better than GOP, Whisper confidence and a Microsoft tool (the authors' comparison)."),
        ("s14", "https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment", "Azure Pronunciation Assessment", "updated 2026-07-03", "Accuracy, fluency, completeness and prosody scores; error types."),
        ("s15", "https://api-docs.speechace.com/", "Speechace API docs", F, "A 0 to 100 score per sound, syllable and word, plus fluency."),
        ("s16", "https://elsaspeak.com/en/efficacy", "ELSA efficacy page", F, "Claims 93.88 % agreement within one level; the method is unpublished."),
        ("s17", "https://tarteel.ai/blog/introducing-mistake-detection/", "Tarteel: mistake detection", "2022-01-04", "Word-level missed, wrong and extra words; closed."),
        ("s18", "https://arxiv.org/abs/2509.00094", "Quran-muaalem", "2025-08-27", "An open model for recitation, 848 hours, Tajweed F1 75.8 %."),
        ("s19", "https://github.com/Halleck45/OpenPronounce", "OpenPronounce", F, "wav2vec2 plus DTW, English."),
    ]),
    ("Chapter 6: a sound model for Sanskrit", [
        ("s20", "https://huggingface.co/anyspeech/zipa-small-crctc-500k", "ZIPA-small CR-CTC 500k", "repository updated 2026-10-06", "Size, licence and symbols of the candidate sound model."),
        ("s21", "https://arxiv.org/abs/2505.23170", "ZIPA paper, ACL 2025 (arXiv 2505.23170)", "2025", "The model's paper."),
        ("s22", "https://arxiv.org/abs/2510.24992", "POWSM", "October 2025", "Claims parity with ZIPA; its size was not checked."),
        ("s23", "https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX", "wav2vec2-lv-60-espeak (ONNX)", F, "A larger alternative, 317.7 MB."),
        ("s24", "https://huggingface.co/robg/speako-phoneme-recognizer", "speako phoneme recognizer", F, "English sounds only; rejected."),
        ("s25", "https://huggingface.co/Harveenchadha/vakyansh-wav2vec2-sanskrit-sam-60", "vakyansh Sanskrit model", F, "Trained on Sanskrit but no licence is stated; blocked."),
        ("s26", "https://www.npmjs.com/package/onnxruntime-web", "onnxruntime-web 1.31.1 (MIT)", "npm 2026-11-11", "Runs the model in the browser."),
        ("s27", "https://web.dev/blog/webgpu-supported-major-browsers", "WebGPU support, web.dev", "2025-11-25", "Which browsers and phones can use WebGPU."),
        ("s28", "https://bugs.webkit.org/show_bug.cgi?id=269777", "WebKit bug 269777", "closed 2024-02-22", "About 300 MB of memory is reliably available to a page on an iPhone."),
    ]),
    ("Chapter 8: what we do not know yet", [
        ("s29", "https://web.dev/articles/storage-for-the-web", "web.dev: storage for the web", F, "Safari deletes a site's stored data after 7 days without a visit."),
        ("s30", "https://developer.apple.com/forums/thread/710157", "Apple developer forum thread", F, "The Home Screen exemption and persistent storage are unreliable on iOS."),
    ]),
    ("Chapter 9: where the audio lives", [
        ("s31", "https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits", "GitHub Pages limits", F, "1 GB per site, a soft 100 GB per month of downloads."),
        ("s32", "https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github", "Large files on GitHub", F, "Search summary only."),
        ("s33", "https://data.jsdelivr.com/v1/spec.yaml", "jsDelivr spec", F, "Search summary only."),
        ("s34", "https://developers.cloudflare.com/r2/pricing/", "Cloudflare R2 pricing", F, "Free allowance and free downloads."),
        ("s35", "https://developers.cloudflare.com/r2/buckets/public-buckets/", "Cloudflare R2 public buckets", F, "The test address is rate-limited; a real one needs a custom domain."),
        ("s36", "https://developers.cloudflare.com/r2/buckets/cors/", "Cloudflare R2 CORS", F, "How a bucket sets the permission header."),
        ("s37", "https://developers.cloudflare.com/pages/platform/limits/", "Cloudflare Pages limits", F, "File and build limits."),
        ("s38", "https://api-docs.quran.com/docs/content_apis_versioned/4.0.0/recitation-audio-files/", "Quran.com recitation audio API", F, "The catalogue, relative key and swappable base pattern."),
        ("s39", "https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video", "Workbox: serving cached audio and video", F, "Cached media must be saved whole."),
        ("s40", "https://cloudfour.com/thinks/when-7-kb-equals-7-mb/", "Cloud Four: opaque responses and storage quota", F, "Secondary source."),
        ("s41", "https://webkit.org/blog/14403/updates-to-storage-policy/", "WebKit: storage policy", "2023-08-10", "Persistent storage on Safari 17."),
        ("s42", "https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/", "WebKit: the 7-day limit", "2020-03-24", "Stored data is deleted after 7 days of non-use unless the app is on the Home Screen."),
        ("s43", "https://caniuse.com/native-filesystem-api", "caniuse: File System Access", F, "Folder pickers exist only in Chrome and Edge 105 and later."),
        ("s44", "https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api", "Chrome: persistent permissions", F, "Why folder handles are not relied on."),
        ("s45", "https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs", "MDN: audio codecs", F, "MP3 is supported in all major browsers."),
        ("s46", "https://caniuse.com/opus", "caniuse: Opus", F, "Opus support on Apple browsers."),
    ]),
]

def entry(e):
    i, url, title, date, note = e
    local = not url.startswith("http")
    return (f'<li id="{i}"><b>{html.escape(title)}</b> <span class="mute">{html.escape(date)}</span><br>'
            f'<a href="{html.escape(url)}">{html.escape(url)}</a><br><span class="small">{html.escape(note)}</span></li>')

out = ['''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<link rel="icon" href="data:,">
<title>Sources</title>
<script>try{var t=JSON.parse(localStorage.getItem('chantlab57:theme'));if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<link rel="stylesheet" href="css/lab.css">
</head>
<body data-page="sources">
<main>
<div class="col">
<h1>Sources</h1>
<p class="lede">Every claim in the chapters links to an entry here. Each entry shows the address and a date: the publication or last-update date where the research reports gave one, otherwise the day the page was fetched.</p>
<p>A claim with a link was read or measured by the research reports. A claim marked <a class="term" href="glossary.html#hypothesis">hypothesis</a> is the reports' own label for something not checked, and it is called that here too.</p>''']
for title, items in GROUPS:
    out.append(f"<h2>{html.escape(title)}</h2>\n<ul class=\"sources\">")
    out.extend(entry(e) for e in items)
    out.append("</ul>")
out.append('<p class="srcnote">Report 2 notes two things it did not verify: whether the browser cache accepts a partial (206) response, and whether jsDelivr refuses this repository.</p>\n<nav data-pager></nav>\n</div>\n</main>\n<script type="module" src="js/p-static.js"></script>\n</body>\n</html>\n')
open(os.path.join(BOOK, "sources.html"), "w", encoding="utf-8", newline="\n").write("\n".join(out))
print("wrote sources.html with", sum(len(i) for _, i in GROUPS), "entries")
