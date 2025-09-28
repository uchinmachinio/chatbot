// keep global registry of active loops
const _keyframeLoops = new Map();

export function initKeyframeLoop(imgSelector, frames, options = {}) {
  const loop     = options.loop     ?? true;  // repeat forever
  const autoplay = options.autoplay ?? true;  // start immediately

  const imgEl = document.querySelector(imgSelector);
  if (!imgEl) throw new Error(`No element matches ${imgSelector}`);

  // clear any old loop for this selector
  if (_keyframeLoops.has(imgSelector)) {
    clearTimeout(_keyframeLoops.get(imgSelector));
    _keyframeLoops.delete(imgSelector);
  }

  let idx = 0;

  function showFrame(i) {
    const frame = frames[i % frames.length];
    imgEl.src = frame.src;
  }

  function playLoop() {
    const frame = frames[idx % frames.length];
    showFrame(idx);
    idx++;

    const t = setTimeout(() => {
      if (loop || idx < frames.length) {
        playLoop();
      }
    }, frame.holdMs);

    // save timer so it can be cleared next time
    _keyframeLoops.set(imgSelector, t);
  }

  // preload all images
  frames.forEach(f => {
    const preload = new Image();
    preload.src = f.src;
  });

  if (autoplay) playLoop();
}