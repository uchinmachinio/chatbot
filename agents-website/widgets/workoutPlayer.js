// workout_player.js
// Drive a workout JSON as a single timeline and emit to the Sensors bus.
// Example: listen to player events for UI panels
// + sensors.addEventListener("workout:init",  e => console.log("INIT", e.detail));
// + sensors.addEventListener("workout:meta",  e => console.log("META", e.detail));
// sensors.addEventListener("workout:round", e => console.log("ROUND", e.detail));
// sensors.addEventListener("workout:segment", e => console.log("SEG", e.detail));
// + sensors.addEventListener("workout:tick", e => {
// update any global timer / progress ring here
// e.detail = { elapsed_ms, remaining_ms, progress }
// });
// sensors.addEventListener("workout:cue", e => console.log("CUE", e.detail));
// sensors.addEventListener("workout:done", e => console.log("DONE", e.detail));
import { sensors } from './sensors.js';

function compileTimeline(workout) {
    // Expand rounds if only one "intervals[0]" is provided and rounds>1
    const base = workout.intervals?.[0]?.block ?? [];
    const rounds = Math.max(1, workout.rounds || 1);

    const segments = [];
    let cursorMs = 0;
    for (let r = 1; r <= rounds; r++) {
        for (let i = 0; i < base.length; i++) {
            const item = base[i];
            const durationMs = Math.max(0, (item.duration_sec || 0) * 1000);
            const phase = (item.exercise?.toLowerCase() === "rest") ? "rest" : "work";
            const seg = {
                phase,                         // "work" | "rest"
                round: r,
                indexInRound: i + 1,
                exercise: item.exercise,
                intensity: item.intensity || null,
                durationMs,
                startMs: cursorMs,
                endMs: cursorMs + durationMs
            };
            segments.push(seg);
            cursorMs += durationMs;
        }
    }

    // Cooldown appended as phase "cooldown"
    const cooldown = Array.isArray(workout.cooldown) ? workout.cooldown : [];
    for (let i = 0; i < cooldown.length; i++) {
        const cd = cooldown[i];
        const durationMs = Math.max(0, (cd.duration_sec || 0) * 1000);
        const seg = {
            phase: "cooldown",
            round: rounds + 1,
            indexInRound: i + 1,
            exercise: cd.exercise,
            intensity: "low",
            durationMs,
            startMs: cursorMs,
            endMs: cursorMs + durationMs
        };
        segments.push(seg);
        cursorMs += durationMs;
    }

    return {
        totalMs: cursorMs,
        segments
    };
}

export class WorkoutPlayer {
    constructor(sensorsBus, workoutJson, opts = {}) {
        this.sensors = sensorsBus;
        this.workout = workoutJson;
        this.speed = opts.speed || 1.0;   // playback speed
        this.loop = !!opts.loop;          // loop whole routine
        this.tickMs = opts.tickMs || 200; // UI cadence

        this.timeline = compileTimeline(workoutJson);
        this._timer = null;
        this._running = false;
        this._paused = false;

        this._t0Perf = 0;     // performance.now() when started
        this._baseElapsed = 0;// accumulated elapsed before current start
        this._lastSegIdx = -1;

        // Emit once
        this.sensors.dispatchEvent(new CustomEvent("workout:init", {
            detail: {
                workout_type: workoutJson.workout_type,
                title: workoutJson.title,
                duration_min: workoutJson.duration_min,
                total_ms: this.timeline.totalMs,
                rounds: workoutJson.rounds
            }
        }));
        this.sensors.dispatchEvent(new CustomEvent("workout:meta", {
            detail: { ...(workoutJson.metadata || {}) }
        }));
    }

    get running() { return this._running; }
    get paused() { return this._paused; }
    get totalMs() { return this.timeline.totalMs; }

    // ---- Controls ----------------------------------------------------------

    start() {
        if (this._running && !this._paused) return;
        const now = performance.now();
        if (!this._running) {
            // fresh start or after stop
            this._baseElapsed = 0;
            this._lastSegIdx = -1;
        }
        this._t0Perf = now;
        this._running = true;
        this._paused = false;
        this._arm();
    }

    pause() {
        if (!this._running || this._paused) return;
        this._baseElapsed = this._elapsedPerf();
        this._paused = true;
        this._disarm();
    }

    stop() {
        this._disarm();
        this._running = false;
        this._paused = false;
        this._baseElapsed = 0;
        this._lastSegIdx = -1;
        // Optional: emit a reset?
    }

    seek(ms) {
        const clamped = Math.max(0, Math.min(ms, this.timeline.totalMs));
        this._baseElapsed = clamped;
        this._t0Perf = performance.now();
        this._lastSegIdx = -1; // force segment re-emit on next tick
        if (this._running && !this._paused) {
            this._disarm();
            this._arm();
        }
    }

    setSpeed(mult) {
        this.speed = Math.max(0.25, Math.min(mult, 4.0));
    }

    setLoop(loop) {
        this.loop = !!loop;
    }

    // ---- Internals ---------------------------------------------------------

    _elapsedPerf() {
        if (!this._running) return this._baseElapsed;
        if (this._paused) return this._baseElapsed;
        const delta = (performance.now() - this._t0Perf) * this.speed;
        return this._baseElapsed + delta;
    }

    _arm() {
        if (this._timer) clearInterval(this._timer);
        this._timer = setInterval(() => this._tick(), this.tickMs);
        // do an immediate tick so UI updates right away
        this._tick();
    }

    _disarm() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    _tick() {
        let t = this._elapsedPerf();

        // Handle end/loop
        if (t >= this.timeline.totalMs) {
            if (this.loop) {
                t = t % this.timeline.totalMs;
                this._baseElapsed = t;
                this._t0Perf = performance.now();
            } else {
                // Final tick at end, then done
                this._emitTick(this.timeline.totalMs);
                this.sensors.dispatchEvent(new CustomEvent("workout:done", {
                    detail: { title: this.workout.title }
                }));
                this.stop();
                return;
            }
        }

        // Find current segment (binary search is overkill; linear is fine for short lists)
        const segIdx = findSegmentIndex(this.timeline.segments, t);
        if (segIdx !== this._lastSegIdx) {
            this._lastSegIdx = segIdx;
            const seg = this.timeline.segments[segIdx];
            const inRound = seg.phase !== "cooldown";
            const roundChanged = segIdx === 0 || this.timeline.segments[segIdx - 1].round !== seg.round;

            if (roundChanged && inRound) {
                this.sensors.dispatchEvent(new CustomEvent("workout:round", {
                    detail: { round: seg.round, total_rounds: this.workout.rounds }
                }));
            }

            this.sensors.dispatchEvent(new CustomEvent("workout:segment", {
                detail: {
                    phase: seg.phase, // "work" | "rest" | "cooldown"
                    round: seg.round,
                    index_in_round: seg.indexInRound,
                    exercise: seg.exercise,
                    intensity: seg.intensity,
                    seg_start_ms: seg.startMs,
                    seg_end_ms: seg.endMs,
                    seg_duration_ms: seg.durationMs
                }
            }));
        }

        // Emit cues (10s / 5s left) only during work/cooldown segments
        const seg = this.timeline.segments[segIdx];
        const segElapsed = t - seg.startMs;
        const segRemain = Math.max(0, seg.endMs - t);
        if (seg.phase !== "rest") {
            maybeCue(this.sensors, seg, segRemain, 10000, "10s left");
            maybeCue(this.sensors, seg, segRemain, 5000, "5s left");
        }

        // Regular time tick
        this._emitTick(t);
    }

    _emitTick(t) {
        const total = this.timeline.totalMs;
        this.sensors.dispatchEvent(new CustomEvent("workout:tick", {
            detail: {
                elapsed_ms: t,
                remaining_ms: Math.max(0, total - t),
                progress: total ? t / total : 0
            }
        }));
    }
}

function findSegmentIndex(segments, tMs) {
    // Assume non-empty and contiguous
    let lo = 0, hi = segments.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const s = segments[mid];
        if (tMs < s.startMs) hi = mid - 1;
        else if (tMs >= s.endMs) lo = mid + 1;
        else return mid;
    }
    return Math.max(0, Math.min(segments.length - 1, lo));
}

// Simple edge-triggered cue emitter with per-segment memory
const _cueSent = new WeakMap(); // seg -> Set(msThreshold)
function maybeCue(sensors, seg, remainingMs, thresholdMs, label) {
    let sent = _cueSent.get(seg);
    if (!sent) { sent = new Set(); _cueSent.set(seg, sent); }
    if (remainingMs <= thresholdMs && !sent.has(thresholdMs)) {
        sent.add(thresholdMs);
        sensors.dispatchEvent(new CustomEvent("workout:cue", {
            detail: {
                phase: seg.phase,
                exercise: seg.exercise,
                round: seg.round,
                label, threshold_ms: thresholdMs
            }
        }));
    }
}