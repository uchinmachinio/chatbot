const HR_UPDATE_MS = 2000;
const Plotly = window.Plotly;
const chartEl = document.getElementById("hrChart");
const hrNowEl = document.getElementById("hrNow");
const hrMarkerEl = document.getElementById("hrMarker");
const windowSec = 30, tickSec = 30, maxPoints = 2000;
let t0 = Date.now(), lastX = 0, lastBpm = 72, raf = 0, q = [];

export function initHRChart() {
    const layout = {
        paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 20, r: 16, t: 8, b: 28 },
        xaxis: { type: "linear", range: [0, windowSec], autorange: false, tickmode: "linear", dtick: tickSec, tick0: 0, ticksuffix: " s", gridcolor: "rgba(255,255,255,0.06)", tickfont: { color: "#9ca3af" } },
        yaxis: { title: "BPM", range: [lastBpm - 10, lastBpm + 10], gridcolor: "rgba(255,255,255,0.06)", ticksuffix: " ", tickfont: { color: "#9ca3af" }, titlefont: { color: "#9ca3af" } },
        font: { color: "#e5e7eb" }, uirevision: "stream", showlegend: false,
        // title: { text: "", font: { color: "#9ca3af" }, xref: "paper", x: 0.05, y: 0.95 }
    };
    const trace = {
        x: [-2, -1, 0], y: [70, 70, 70],
        mode: "lines+markers",
        line: { width: 2, color: "#38bdf8", shape: "spline"},
        marker: { size: 4, color: "#38bdf8" },
        fill: "tozeroy", fillcolor: "rgba(56,189,248,0.15)",
        type: "scatter"
    };
    Plotly.newPlot(chartEl, [trace], layout, { displaylogo: false, responsive: false, displayModeBar: false, scrollZoom: false});
    const ro = new ResizeObserver(() => Plotly.Plots.resize(chartEl)); ro.observe(chartEl);
}

export function pushHR(ts, bpm) { q.push([ts, bpm]); if (!raf) raf = requestAnimationFrame(flush); }

export function flush() {
    if (!q.length) { raf = 0; return; }
    const xs = [], ys = [];
    while (q.length) {
        const [t, v] = q.shift();
        const x = t > 1e6 ? (t - t0) / 1000 : t; // supports ms or s
        xs.push(x); ys.push(v); lastX = x; lastBpm = v;
    }
    Plotly.extendTraces(chartEl, { x: [xs], y: [ys] }, [0], maxPoints);

    const right = Math.max(lastX, windowSec);
    const left = right < windowSec ? 0 : right - windowSec; // fixed window from start; scroll only after edge
    Plotly.relayout(chartEl, {
        "xaxis.range": [left, right],
        "yaxis.range": [lastBpm - 10, lastBpm + 10]
    });
    raf = 0;
}

// sensors wiring unchanged; feed ms or seconds; both work
// NEW: simple hook into the sensor manager
export function wireSensors(sensors) {
  sensors.addEventListener("hr", (e) => {
    const d = e.detail || {};
    pushHR(d.ts || Date.now(), d.bpm);
    hrNowEl.innerHTML = d.bpm;
    let minHeartRate = 40;
    let maxHeartRate = 180;
    hrMarkerEl.style.left = Math.min(100, Math.max(0, (d.bpm - minHeartRate) / maxHeartRate * 100)) + "%";
  });
}