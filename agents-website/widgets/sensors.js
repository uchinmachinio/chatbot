// sensors.js
/**
 * A tiny sensor runtime.
 * - start(): activate all sources
 * - pause(): suspend interval/replay sources; drop events from callbacks
 * - stop(): pause + clear buffered state
 * 
 * Sources:
 *  - addIntervalSource(type, intervalMs, fn, { id, autoStart, jitter })
 *      fn => payload OR null. Emitted as { type, detail: { ...payload, ts } }
 *  - addCallbackSource(type, subscribe, unsubscribe, { id, autoStart })
 *      subscribe(emit) -> teardown?; unsubscribe(teardown?)
 *  - addReplaySource(type, frames, rateMs, { id, autoStart, loop })
 *      frames: array of payloads; will emit at rateMs; loops if configured
 * 
 * Manual emit: sensors.emit("hr", { bpm, ts })
 */

class Sensors extends EventTarget {
    constructor() {
        super();
        this._sources = new Map(); // id -> source
        this._running = false;
        this._paused = false;
        this._idSeq = 0;
    }

    get running() { return this._running; }
    get paused() { return this._paused; }

    start() {
        if (this._running && !this._paused) return;
        this._paused = false;
        this._running = true;
        for (const src of this._sources.values()) {
            if (src.mode === "interval" || src.mode === "replay") this._armTimer(src);
            if (src.mode === "callback" && !src._teardown) {
                src._teardown = src.subscribe((payload) => this._handleIncoming(src, payload));
            }
        }
    }

    pause() {
        if (!this._running || this._paused) return;
        this._paused = true;
        for (const src of this._sources.values()) {
            this._disarmTimer(src);
            // keep callback subscriptions but drop events while paused
        }
    }

    stop() {
        this._paused = false;
        this._running = false;
        for (const src of this._sources.values()) {
            this._disarmTimer(src);
            if (src.mode === "callback" && src._teardown && src.unsubscribe) {
                try { src.unsubscribe(src._teardown); } catch { }
                src._teardown = null;
            }
            if (src.mode === "replay") src._cursor = 0;
        }
    }

    emit(type, detail) {
        const ts = detail?.ts ?? Date.now();
        if (!this._running || this._paused) return; // drop while paused
        this.dispatchEvent(new CustomEvent(type, { detail: { ...detail, ts } }));
    }

    on(type, handler, options) { this.addEventListener(type, handler, options); }
    off(type, handler, options) { this.removeEventListener(type, handler, options); }

    removeSource(id) {
        const src = this._sources.get(id);
        if (!src) return false;
        this._disarmTimer(src);
        if (src.mode === "callback" && src._teardown && src.unsubscribe) {
            try { src.unsubscribe(src._teardown); } catch { }
        }
        this._sources.delete(id);
        return true;
    }

    // ---- Sources -------------------------------------------------------------

    addIntervalSource(type, intervalMs, fn, opts = {}) {
        const id = opts.id ?? `interval:${type}:${++this._idSeq}`;
        const src = {
            id, type, mode: "interval",
            intervalMs: intervalMs | 0,
            fn, jitter: !!opts.jitter,
            _timer: null
        };
        this._sources.set(id, src);
        if (opts.autoStart) this._armTimer(src);
        return id;
    }

    addCallbackSource(type, subscribe, unsubscribe, opts = {}) {
        const id = opts.id ?? `callback:${type}:${++this._idSeq}`;
        const src = {
            id, type, mode: "callback",
            subscribe, unsubscribe,
            _teardown: null
        };
        this._sources.set(id, src);
        if (opts.autoStart && this._running) {
            src._teardown = subscribe((payload) => this._handleIncoming(src, payload));
        }
        return id;
    }

    addReplaySource(type, frames, rateMs, opts = {}) {
        const id = opts.id ?? `replay:${type}:${++this._idSeq}`;
        const src = {
            id, type, mode: "replay",
            frames: Array.isArray(frames) ? frames : [],
            rateMs: rateMs | 0,
            loop: !!opts.loop,
            _cursor: 0,
            _timer: null
        };
        this._sources.set(id, src);
        if (opts.autoStart) this._armTimer(src);
        return id;
    }

    // ---- Internals -----------------------------------------------------------

    _armTimer(src) {
        this._disarmTimer(src);
        if (!this._running || this._paused) return;

        const tick = () => {
            if (!this._running || this._paused) return;
            if (src.mode === "interval") {
                try {
                    const payload = src.fn?.();
                    if (payload) this._handleIncoming(src, payload);
                } catch (e) { /* swallow */ }
            } else if (src.mode === "replay") {
                if (src._cursor >= src.frames.length) {
                    if (src.loop) src._cursor = 0; else { this._disarmTimer(src); return; }
                }
                const frame = src.frames[src._cursor++];
                if (frame) this._handleIncoming(src, frame);
            }
            const ms = (src.mode === "interval" ? src.intervalMs : src.rateMs) || 0;
            const next = src.jitter ? ms * (0.8 + Math.random() * 0.4) : ms;
            src._timer = setTimeout(tick, next);
        };

        const ms0 = (src.mode === "interval" ? src.intervalMs : src.rateMs) || 0;
        src._timer = setTimeout(tick, ms0);
    }

    _disarmTimer(src) {
        if (src?._timer) { clearTimeout(src._timer); src._timer = null; }
    }

    _handleIncoming(src, payload) {
        if (!this._running || this._paused) return; // drop while paused
        const ts = payload?.ts ?? Date.now();
        this.dispatchEvent(new CustomEvent(src.type, { detail: { ...payload, ts } }));
    }
};

// Singleton export + window compat for your older checks
export const sensors = new Sensors();
if (typeof window !== "undefined") window.sensors = sensors;

/* ---------------------- EXTRAS / EXAMPLES ---------------------------------

// 1) Demo HR source (interval) — simple sinus + noise (loop not needed here):
//    Call this once at app bootstrap if you don’t have a real HR feed yet.
let _demoBpm = 72, _t = 0;
sensors.addIntervalSource("hr", 2000, () => {
  _t += 2000;
  _demoBpm += Math.sin(_t / 1500) * 0.6 + (Math.random() - 0.5) * 1.2;
  return { bpm: Math.round(_demoBpm) };
}, { autoStart: false, jitter: false });

// 2) Callback source (e.g., WebSocket):
// sensors.addCallbackSource("hr",
//   (emit) => { socket.onmessage = (m)=> emit(JSON.parse(m.data)); return () => socket.close(); },
//   (teardown) => { try { teardown(); } catch {} },
//   { autoStart: false }
// );

// 3) Replay source (looping) — useful for canned demos:
// sensors.addReplaySource("hr", recordedFramesArray, 200, { loop: true, autoStart: false });

// Controls you can wire to UI:
// sensors.start(); sensors.pause(); sensors.stop();

--------------------------------------------------------------------------- */

let _demoBpm = 72, _t = 0;
sensors.addIntervalSource("hr", 1000, () => {
  _t += 1000;
  _demoBpm += Math.sin(_t / 1500) * 0.6 + (Math.random() - 0.5) * 1.2;
  return { bpm: Math.round(_demoBpm) };
}, { autoStart: false, jitter: false });
