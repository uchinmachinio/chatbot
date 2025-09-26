export function initKeyframeLoop(imgSelector, frames, options = {}) {
  const loop     = options.loop     ?? true;  // repeat forever
  const autoplay = options.autoplay ?? true;  // start immediately

  const imgEl = document.querySelector(imgSelector);
  if (!imgEl) throw new Error(`No element matches ${imgSelector}`);

  let idx = 0;

  function showFrame(i) {
    const frame = frames[i % frames.length];
    imgEl.src = frame.src;
  }

  function playLoop() {
    const frame = frames[idx % frames.length];
    showFrame(idx);
    idx++;

    setTimeout(() => {
      if (loop || idx < frames.length) {
        playLoop();
      }
    }, frame.holdMs);
  }

  // preload all images
  frames.forEach(f => {
    const preload = new Image();
    preload.src = f.src;
  });

  if (autoplay) playLoop();
}