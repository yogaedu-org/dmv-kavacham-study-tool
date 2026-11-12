import { ready } from './chrome.js';
import { initStage } from './verse-view.js';
const chant = await ready;
if (chant) await initStage(chant, { defaultVerse: 1 });
