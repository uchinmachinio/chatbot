// heartbeat.js
export function initHeartBeat(hrNowId = "hrNow", heartIconId = "heartIcon") {
  const hrNowEl = document.getElementById(hrNowId);
  const heartEl = document.getElementById(heartIconId);

  function updateHeartBeat() {
    const bpm = Number(hrNowEl.textContent.trim()) || 60;
    const interval = 60000 / bpm; // ms per beat
    heartEl.style.animation = "none";
    void heartEl.offsetWidth;
    // Apply the beat animation with correct timing
    heartEl.style.animation = `heartBeat ${interval}ms infinite ease-in-out`;
  }

  // Inject keyframes once
  if (!document.getElementById("heartbeat-anim-style")) {
    const style = document.createElement("style");
    style.id = "heartbeat-anim-style";
    style.textContent = `
      @keyframes heartBeat {
        0%   { transform: scale(1); }
        10%  { transform: scale(1.3); }
        20%  { transform: scale(1); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  updateHeartBeat();

  // Return updater so caller can re-run when HR changes dynamically
  return updateHeartBeat;
}