import { workout } from '../workout_data.js';
import { sensors } from './sensors.js';

export function initTrainingInfoChart(containerId) {
    let exerciseEl = document.getElementById("exercise");
    let titleEl = document.getElementById("title");
    let typeEl = document.getElementById("type");
    let roundsEl = document.getElementById("rounds");
    let durationEl = document.getElementById("duration");
    let intensityEl = document.getElementById("intensityBadge");
    let timeLeftEl = document.getElementById("timeLeft");
    let timeLeftProgress = document.getElementById("timeLeftProgress");

    sensors.addEventListener("workout:init", e => {
        let workoutType = e.detail.workout_type || "HIIT";
        let workoutTitle = e.detail.title || "Workout Session";
        let durationMin = e.detail.duration_min || 20;
        let totalSec = Math.round((e.detail.total_ms || (durationMin * 60 * 1000)) / 1000);
        let rounds = e.detail.rounds || 1;

        exerciseEl.textContent = workout.intervals[0]?.block[0]?.exercise || "Exercise";
        titleEl.textContent = workoutTitle;
        typeEl.textContent = workoutType;
        roundsEl.textContent = rounds;
        durationEl.textContent = durationMin + " min";
    });
    sensors.addEventListener("workout:meta", e => {
        let data = e.detail;
        document.getElementById("equip").textContent = `${data.equipment || 'bodyweight'}`
        document.getElementById("zones").textContent = `${(data.target_zones || []).join(' • ')}`;
        document.getElementById("goal").textContent = `goal: ${data.goal || 'general fitness'}`;
    });
    sensors.addEventListener("workout:round", e => {
        // e.detail = { round, total_rounds }
        document.getElementById("roundProgress").textContent = `${e.detail.round} / ${e.detail.total_rounds}`;
    }
    );
    sensors.addEventListener("workout:segment", e => {
        // e.detail = { phase, round, indexInRound, exercise, intensity, seg_duration_ms, seg_start_ms, seg_end_ms }
        let seg = e.detail;
        exerciseEl.textContent = seg.exercise || "Exercise";
        intensityEl.textContent = seg.intensity ? `Intensity: ${seg.intensity.toUpperCase()}` : "";

        if (seg.intensity === 'high') {
            intensityEl.className = "chip bg-red-600/20 text-red-400";
        } else if (seg.intensity === 'medium') {
            intensityEl.className = "chip bg-yellow-600/20 text-yellow-400";
        } else if (seg.intensity === 'low') {
            intensityEl.className = "chip bg-green-600/20 text-green-400";
        } else {
            intensityEl.className = "hidden";
        }

        sensors.addEventListener("workout:tick", e => {
            // e.detail = { elapsed_ms, remaining_ms, progress }
            let elapsedSec = Math.round(e.detail.elapsed_ms / 1000);
            let startSec = Math.round(seg.seg_start_ms / 1000);
            let endSec = Math.round(seg.seg_end_ms / 1000);
            let segDurationSec = endSec - startSec;
            let remainingSec = endSec - elapsedSec;
            const mins = Math.floor(remainingSec / 60);
            const secs = remainingSec % 60;
            timeLeftEl.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
            let progressPercent = Math.round((elapsedSec / segDurationSec) * 100);
            timeLeftProgress.value = progressPercent;
        });
    });
}