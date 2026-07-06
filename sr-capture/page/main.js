/**
 * Страница захвата SpatialReal: init avatarkit → аватар на прозрачном фоне.
 *  window.driveAudio(pcmB64) — драйв губ нашим PCM16 (mono s16le 16кГц, чанки ~100мс).
 *  window.startCapture(fps)  — rAF-захват canvas.toDataURL (PNG с альфой) в буфер
 *                              window.__frames (для new-headless; сервер дренит пачками).
 * Схема и константы 1:1 с проверенным смоуком Фазы-0 (scratchpad/sr-smoke).
 */
import { AvatarSDK, AvatarManager, AvatarView, Environment, DrivingServiceMode } from '@spatialwalk/avatarkit';

const p = new URLSearchParams(location.search);
const appId = p.get('appId'), token = p.get('token'), avatarId = p.get('avatarId');

window.__log = []; window.__rendered = false; window.__error = null; window.__connected = false; window.__audioDone = false;
window.__frames = [];
const log = (m) => { const s = String(m); window.__log.push(s); console.log('[sr]', s); };
const b64ToU8 = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

window.driveAudio = async (pcmB64) => {
  const ctrl = window.__view.controller;
  try {
    await ctrl.initializeAudioContext();
    ctrl.onConnectionState = (s) => { if (String(s).includes('connected')) window.__connected = true; log('conn=' + s); };
    await ctrl.start();
    for (let i = 0; i < 150 && !window.__connected; i++) await new Promise((r) => setTimeout(r, 100));
    if (!window.__connected) { log('NOT CONNECTED'); window.__audioDone = true; return; }
    const pcm = b64ToU8(pcmB64); const CH = 3200; // 100мс @16кГц s16le mono
    window.__speaking = true; // сигнал захвату: речь пошла — кадры с ЭТОГО момента (синхрон губ/дорожки)
    for (let off = 0; off < pcm.length; off += CH) { ctrl.send(pcm.slice(off, off + CH), off + CH >= pcm.length); await new Promise((r) => setTimeout(r, 95)); }
    log('audio streamed');
  } catch (e) { log('driveAudio EXC ' + ((e && (e.stack || e.message)) || e)); }
  window.__audioDone = true;
};

// rAF-захват для new-headless (rAF не тротлится): PNG с альфой прямо из WebGL-канваса
// (preserveDrawingBuffer патчится сервером через addInitScript).
window.startCapture = (fps) => {
  const cv = document.querySelector('canvas');
  if (!cv) { log('no canvas for capture'); return false; }
  const interval = 1000 / Math.max(1, fps);
  let last = 0;
  const tick = (t) => {
    if (window.__capStop) return;
    if (!window.__speaking) { requestAnimationFrame(tick); return; } // ждём первого аудио-чанка
    if (t - last >= interval - 4) {
      last = t;
      try {
        window.__frames.push(cv.toDataURL('image/png'));
        if (!window.__capT0) window.__capT0 = t; window.__capLast = t; // для честного fps на сервере
      } catch (e) { window.__frames.push('ERR:' + e.message); }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return true;
};

(async () => {
  try {
    await AvatarSDK.initialize(appId, { environment: Environment.intl, drivingServiceMode: DrivingServiceMode.sdk });
    AvatarSDK.setSessionToken(token);
    log('loading avatar ' + avatarId);
    const avatar = await AvatarManager.shared.load(avatarId, (pr) => log('load=' + (pr && pr.progress != null ? pr.progress : '?')));
    const view = new AvatarView(avatar, document.getElementById('c'));
    view.onFirstRendering = () => { log('*** onFirstRendering ***'); window.__rendered = true; };
    window.__view = view; log('AvatarView created');
  } catch (e) { const m = String((e && (e.stack || e.message)) || e); window.__error = m; log('EXCEPTION ' + m); }
})();
