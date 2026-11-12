// Module worker: keeps the page responsive while the DTW and pitch tracker run (a few seconds per verse).
import * as tasks from './tasks.js';
self.onmessage = (e) => {
  const { id, cmd, args } = e.data;
  try { self.postMessage({ id, ok: true, res: tasks[cmd](args) }); }
  catch (err) { self.postMessage({ id, ok: false, err: String(err && err.message || err) }); }
};
