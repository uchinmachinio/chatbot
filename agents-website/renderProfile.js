// profile-renderer.js
// Tailwind + Shoelace profile renderer for UserWorkoutProfile

/** Example: fully-filled object (matches your schema exactly) */
export const exampleFilledProfile = {
    // 0. Name
    name: "Luka",

    // 1. Demographics
    age: 29,
    heightCm: 183,
    weightKg: 82,

    // 2. Current fitness level
    fitnessLevel: "intermediate", // "beginner" | "intermediate" | "advanced"

    // 3. Lifestyle
    lifestyle: "mixed", // see enum

    // 4. Fitness goals
    goals: ["muscle_gain", "mobility_flexibility"], // 1..5
    targetTimelineWeeks: 16,

    // 5. Preferred workout style
    preferredStyles: ["strength_training", "hiit"], // 1..6
    equipmentAvailable: ["adjustable dumbbells", "pull-up bar", "resistance bands"], // up to 30
};

/** Utility: query single element with assert */
const $ = (sel, root = document) => {
    const el = root.querySelector(sel);
    if (!el) console.warn(`[profile-renderer] Missing element: ${sel}`);
    return el;
};

/** Ensure we have a container element for a given data-field.
 *  - If it's already a normal container, return it.
 *  - If it's an <sl-badge data-field="...">, replace it with a <div> and return the div.
 */
function resolveFieldContainer(fieldName) {
    let el = document.querySelector(`[data-field="${fieldName}"]`);
    if (!el) {
        console.warn(`[profile-renderer] data-field="${fieldName}" not found`);
        return null;
    }

    // If it's already a container (not a Shoelace badge), we're good.
    const tag = el.tagName.toLowerCase();
    const isBadge = tag === 'sl-badge';

    if (!isBadge) return el;

    // It's a badge with data-field -> replace with a div to avoid nested badges
    const div = document.createElement('div');
    // Preserve classes/inline styles so layout stays intact
    // div.className = el.className || '';
    // if (el.getAttribute('style')) div.setAttribute('style', el.getAttribute('style'));
    // Preserve dataset (data-*) except Shoelace-related attributes
    div.setAttribute('data-field', fieldName);

    // Replace in DOM
    el.replaceWith(div);
    return div;
}
/** Utility: create a Shoelace badge (<sl-badge>) */
function makeBadge({ text, variant = "neutral", missing = false }) {
    //<sl-badge pill variant="primary" class="pop-in tagged" data-field="name">Name: Luka</sl-badge>
    // console.log(variant);
    const b = document.createElement("sl-badge");
    b.setAttribute("pill", "");
    if (!missing) b.setAttribute("variant", variant);
    b.textContent = text;
    if (missing) {
        // mirrored from the CSS in your markup
        b.className = "tag-missing text-lg";
    } else {
        b.className = "pop-in tagged text-lg";
    }
    return b;
}

/** Replace children with smooth update + animation */
function replaceWithBadges(container, badges) {
    if (!container) return;
    container.replaceChildren(...badges);
}

/** Formatters */
const fmt = {
    name: (v) => (v ? `${v}` : null),
    age: (v) => (v ?? null),
    heightCm: (v) => (v ? `${v} cm` : null),
    weightKg: (v) => (v ? `${v} kg` : null),
    fitnessLevel: (v) => (v ?? null),
    lifestyle: (v) => (v ?? null),
    goals: (arr) => (Array.isArray(arr) && arr.length ? arr : null),
    targetTimelineWeeks: (v) => (v ? `${v} weeks` : null),
    preferredStyles: (arr) => (Array.isArray(arr) && arr.length ? arr : null),
    equipmentAvailable: (arr) => (Array.isArray(arr) && arr.length ? arr : null),
};

/** Render single-value tag */
function renderSingle(containerSel, label, value, variant = "neutral") {
    // console.log('containerSel', containerSel, 'value', value, 'label', label);
    const container = resolveFieldContainer(containerSel);
    // console.log('container', container);
    if (!container) return;
    // console.log('container found')
    const formatted = fmt[containerSel] ? fmt[containerSel](value) : value;
    // const formatted = value;
    const badge = formatted
        ? makeBadge({ text: label ? `${label}: ${formatted}` : `${formatted}`, variant })
        : makeBadge({ text: label ? `${label}: Not set` : `Not set`, missing: true });
    replaceWithBadges(container, [badge]);
    // console.log('badge rendered', badge);
}

/** Render array tags */
function renderArray(containerSel, values, { missingText, variant = "primary" } = {}) {
    const container = resolveFieldContainer(containerSel);
    if (!container) return;
    const formatted = fmt[containerSel] ? fmt[containerSel](values) : values;
    if (!formatted) {
        replaceWithBadges(container, [makeBadge({ text: missingText || "Not set", missing: true })]);
        return;
    }
    const badges = formatted.map((t) => makeBadge({ text: `${t}`, variant }));
    replaceWithBadges(container, badges);
}

function setStepState(profile) {
    const steps = [
        { id: "basics", fields: ["name", "age", "heightCm", "weightKg"] },
        { id: "fitness", fields: ["fitnessLevel"] },
        { id: "lifestyle", fields: ["lifestyle"] },
        { id: "goals", fields: ["goals", "targetTimelineWeeks"] },
        { id: "preferences", fields: ["preferredStyles", "equipmentAvailable"] },
    ];

    const isFilled = (v) =>
        Array.isArray(v) ? v.length > 0 :
            typeof v === "string" ? v.trim().length > 0 :
                v !== null && v !== undefined;

    steps.forEach(({ id, fields }) => {
        const el = document.getElementById(id);
        if (!el) return;

        const complete = fields.every((f) => isFilled(profile?.[f]));

        if (complete) {
            // Blue via Shoelace token; keeps your existing classes intact.
            el.style.setProperty("color", "var(--sl-color-blue-600)");
        } else {
            // Fall back to whatever your classes already define (e.g., text-neutral-400).
            el.style.removeProperty("color");
        }
    });

    // If all steps are complete, show the button
    const allComplete = steps.every(({ fields }) => fields.every((f) => isFilled(profile?.[f])));
    if (allComplete) {
        showWorkoutReadyButton();
    } else {
        const btn = document.getElementById("workoutReady");
        if (btn) btn.hidden = true;
    }
}

function showWorkoutReadyButton() {
    const btn = document.getElementById("workoutReady");
    // Remove hidden attribute
    if (btn) btn.hidden = false;
}

/** Main public API */
export function renderUserWorkoutProfile(profile) {
    if (!profile || typeof profile !== "object") {
        console.warn("[profile-renderer] Invalid profile payload");
        return;
    }

    // 0. Name
    renderSingle("name", "Name", profile.name);

    // 1. Demographics
    renderSingle("age", "Age", profile.age);
    renderSingle("heightCm", "Height", profile.heightCm);
    renderSingle("weightKg", "Weight", profile.weightKg);

    // 2. Fitness level
    renderSingle("fitnessLevel", "Level", profile.fitnessLevel);

    // 3. Lifestyle (single enum)
    renderSingle("lifestyle", "Lifestyle", profile.lifestyle);

    // 4. Goals + timeline
    renderArray("goals", profile.goals, { missingText: "Goals: Not set" });
    renderSingle("targetTimelineWeeks", "Target Timeline", profile.targetTimelineWeeks);

    // 5. Preferred styles + equipment
    renderArray("preferredStyles", profile.preferredStyles, {
        missingText: "No styles selected",
    });
    renderArray("equipmentAvailable", profile.equipmentAvailable, {
        missingText: "No equipment listed",
    });

    // Steps
    setStepState(profile);
}

/** Convenience: demo hook for quick testing in console
 *   import { renderUserWorkoutProfile, exampleFilledProfile, demo } from './profile-renderer.js';
 *   demo(); // renders example, then after 1.5s shows the sparse object you posted
 */
export function demo() {
    const sparse = {
        name: null,
        age: null,
        heightCm: null,
        weightKg: null,
        fitnessLevel: null,
        lifestyle: null,
        goals: null,
        targetTimelineWeeks: null,
        preferredStyles: null,
        equipmentAvailable: null,
    };
    renderUserWorkoutProfile(sparse);
    // showWorkoutReadyButton();
}