export const workout = {
    "workout_type": "HIIT",
    "title": "Full Body HIIT Blast",
    "duration_min": 20,
    "rounds": 2,
    "intervals": [
        {
            "round": 1,
            "block": [
                { "exercise": "Burpees", "duration_sec": 40, "intensity": "high" },
                { "exercise": "Rest", "duration_sec": 20, "intensity": "low" },
                { "exercise": "Jump Squats", "duration_sec": 40, "intensity": "high" },
                { "exercise": "Rest", "duration_sec": 20, "intensity": "low" },
                { "exercise": "Mountain Climbers", "duration_sec": 40, "intensity": "high" },
                { "exercise": "Rest", "duration_sec": 20, "intensity": "low" }
            ]
        }
    ],
    "cooldown": [
        { "exercise": "Stretch - Hamstrings", "duration_sec": 30 },
        { "exercise": "Stretch - Shoulders", "duration_sec": 30 }
    ],
    "metadata": {
        "equipment": "bodyweight",
        "target_zones": ["cardio", "legs", "core"],
        "goal": "fat_burn"
    }
};