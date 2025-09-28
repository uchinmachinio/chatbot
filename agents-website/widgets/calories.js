import {sensors} from './sensors.js';

export function initCaloriesWidget() {
    sensors.addEventListener('calories', (event) => {
        const caloriesBurnedEl = document.getElementById('caloriesBurned');
        const caloriesProgressEl = document.getElementById('caloriesProgress');
        if (caloriesBurnedEl && caloriesProgressEl) {
            const calories = event.detail.calories ?? 0;
            caloriesBurnedEl.textContent = `${calories}`;
            const progress = Math.min((calories / 500) * 100, 100); // assuming 500 kcal goal
            caloriesProgressEl.value = progress;
        }
    }, { once: false });
}