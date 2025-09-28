import { sensors } from './sensors.js';
import { workout } from '../workout_data.js';

let progressSec = 0;

export function initHIITChart(containerId) {
    const Plotly = window.Plotly;

    sensors.addEventListener("workout:tick", e => {
        // update any global timer / progress ring here
        // e.detail = { elapsed_ms, remaining_ms, progress }
        progressSec = e.detail.elapsed_ms / 1000;
        if (progressSec > e.detail.p) {
            clearInterval(sim);
            return;
        }
        const { data } = tracesFor(segs, progressSec);
        Plotly.react(chartEl, data, layoutFor(totalSec, progressSec, workout.title));
    });

    // Build flattened segments (repeat the block for N rounds, then cooldown) =====
    function buildSegments(w) {
        const colors = {
            work: '#EE4266',
            rest: '#FFD23F',
            cooldown: '#3BCEAC'
        };
        const isWork = (name, intensity) =>
            intensity === 'high' && name.toLowerCase() !== 'rest';

        const baseBlock = w.intervals[0].block;
        let t = 0;
        const segs = [];

        for (let r = 1; r <= w.rounds; r++) {
            for (const b of baseBlock) {
                const type = b.exercise.toLowerCase() === 'rest' ? 'rest' : (isWork(b.exercise, b.intensity) ? 'work' : 'rest');
                segs.push({
                    start: t,
                    end: t + b.duration_sec,
                    dur: b.duration_sec,
                    label: `${b.exercise} (R${r})`,
                    kind: type,
                    color: type === 'work' ? colors.work : colors.rest
                });
                t += b.duration_sec;
            }
        }

        for (const cd of (w.cooldown || [])) {
            segs.push({
                start: t,
                end: t + cd.duration_sec,
                dur: cd.duration_sec,
                label: cd.exercise,
                kind: 'cooldown',
                color: colors.cooldown
            });
            t += cd.duration_sec;
        }

        return { segs, totalSec: t };
    }

    // Make Plotly traces from segments (bar with 'base' for start offsets) =====
    function tracesFor(segs, progressSec) {
        // Split into completed / current / upcoming for fading + highlight
        const completed = [], upcoming = [];
        let current = null;

        for (const s of segs) {
            if (progressSec >= s.end) {
                completed.push(s);
            } else if (progressSec >= s.start && progressSec < s.end) {
                current = s;
            } else {
                upcoming.push(s);
            }
        }

        // Helper to convert to a bar trace
        const toBar = (arr, opacity) => ({
            type: 'bar',
            orientation: 'h',           // horizontal bars: x = duration, base = start
            y: new Array(arr.length).fill('Progress '),
            x: arr.map(s => s.dur),
            base: arr.map(s => s.start),
            marker: {
                color: arr.map(s => s.color),
                line: { width: arr.map(s => 0) },
                opacity
            },
            hovertemplate: arr.map(s => `${s.label}<br>%{base} → %{customdata} s<br>%{x}`),
            customdata: arr.map(s => s.end),
            name: '',
            showlegend: false
        });

        const data = [];
        if (completed.length) data.push(toBar(completed, 0.25));
        if (upcoming.length) data.push(toBar(upcoming, 0.7));
        if (current) data.push(toBar([current], 1.0));

        return { data, current };
    }

    // Layout with a clean timeline axis + a moving cursor line =====
    function layoutFor(totalSec, progressSec, title) {
        // const tick = niceTick(totalSec);
        return {
            // title: { text: `Current Workout: ${title}`, x: 0, font: { color: '#e5e7eb', size: 16 } },
            barmode: 'stack',
            xaxis: {
                title: 'Time (s)',
                range: [0, totalSec],
                ticksuffix: " s",
                tick0: 0,
                dtick: 60,
                gridcolor: 'rgba(255,255,255,0.06)',
                tickfont: { color: '#9ca3af' },
                zeroline: false
            },
            yaxis: {
                categoryorder: 'array',
                categoryarray: ['Progress '],
                tickfont: { color: '#9ca3af' },
                showline: false,
                // tickson: 'boundaries',
                // tickpadding: 200
            },
            margin: { l: 60, r: 12, t: 8, b: 24 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            shapes: [
                // Cursor line at current time
                {
                    type: 'line',
                    x0: progressSec, x1: progressSec,
                    y0: -0.5, y1: 0.5,
                    line: { width: 3, dash: '-', color: '#e5e7eb' }
                }
            ],
            // annotations: [
            //     {
            //         x: progressSec, y: 'Intensity',
            //         text: 'now',
            //         xanchor: 'left', yanchor: 'bottom',
            //         showarrow: true, arrowhead: 2, ax: 12, ay: -18,
            //         font: { color: '#e5e7eb' }
            //     }
            // ]
        };
    }

    function niceTick(total) {
        // choose a human-ish tick interval
        const candidates = [10, 15, 20, 30, 60, 120];
        for (const c of candidates) if (total / c <= 12) return c;
        return Math.ceil(total / 12);
    }

    const { segs, totalSec } = buildSegments(workout);
    const chartEl = document.getElementById(containerId);

    // Initial render
    const { data } = tracesFor(segs, 0);
    Plotly.newPlot(chartEl, data, layoutFor(totalSec, 0, workout.title), {
        displayModeBar: false,
        responsive: true,
    });
}