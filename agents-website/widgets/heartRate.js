import { HR_UPDATE_MS } from './sensors.js';

const Plotly = window.Plotly;
const chartEl = document.getElementById("hrChart");
const windowSec = 60, tickSec = 30, maxPoints = 2000;
let t0 = Date.now(), lastX = 0, lastBpm = 72, raf = 0, q = [];

export function initHRChart() {
    const layout = {
        paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)",
        margin: { l: 40, r: 16, t: 8, b: 28 },
        xaxis: { type: "linear", range: [0, windowSec], autorange: false, tickmode: "linear", dtick: tickSec, tick0: 0, ticksuffix: " s", gridcolor: "rgba(255,255,255,0.06)", tickfont: { color: "#9ca3af" } },
        yaxis: { title: "BPM", range: [lastBpm - 10, lastBpm + 10], gridcolor: "rgba(255,255,255,0.06)", ticksuffix: " ", tickfont: { color: "#9ca3af" }, titlefont: { color: "#9ca3af" } },
        font: { color: "#e5e7eb" }, uirevision: "stream", showlegend: false,
        title: { text: "HR ♡", font: { color: "#9ca3af" }, xref: "paper", x: 0.05, y: 0.95 }
    };
    const trace = {
        x: [-2, -1, 0], y: [70, 70, 70],
        mode: "lines+markers",
        line: { width: 2, color: "#38bdf8", shape: "spline"},
        marker: { size: 4, color: "#38bdf8" },
        fill: "tozeroy", fillcolor: "rgba(56,189,248,0.15)",
        type: "scatter"
    };
    Plotly.newPlot(chartEl, [trace], layout, { displaylogo: false, responsive: true, displayModeBar: false, });
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

// sensors wiring unchanged; feed ms or seconds—both work
export function wireSensors(cb) {
    if (window.sensors?.addEventListener) { window.sensors.addEventListener("hr", e => cb(e.detail?.ts || Date.now(), e.detail?.bpm)); return; }
    if (window.sensors?.on) { window.sensors.on("hr", d => cb(d.ts || Date.now(), d.bpm)); return; }
    if (typeof window.subscribeHR === "function") { window.subscribeHR((bpm, ts) => cb(ts || Date.now(), bpm)); return; }
    let bpm = 72, t = 0;
    setInterval(() => {
        t += HR_UPDATE_MS; bpm += Math.sin(t / 1500) * 0.6 + (Math.random() - 0.5) * 1.2;
        cb(Date.now(), Math.round(bpm));
    }, HR_UPDATE_MS);
}