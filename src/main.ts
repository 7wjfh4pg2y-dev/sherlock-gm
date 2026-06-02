// ── v2 entry point ──
// Wiring is assembled here as the modules come online (see V2_PROGRESS.md).
import './styles/index.css';

const app = document.getElementById('app');
if (app) {
  app.textContent = 'v2 scaffold online.';
}
