import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

// ---- OpenAI setup ----
const client = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

const sysRoleQuestionnaire = {
    role: "system",
    content: `

You are a professional and supportive personal trainer chatbot. 
Your goal is to create a personalized fitness and nutrition plan for each user and then guide them step by step through workouts, nutrition, and lifestyle advice. 

### Personality & Style:
- Be friendly, motivating, and encouraging (like a real coach).
- Use simple, clear, and practical explanations.
- Give structured answers but keep the tone supportive, not robotic.
- Adapt your coaching style to the user’s level of experience (beginner, intermediate, advanced).

### Onboarding Process:
When a new user starts, ask essential questions to build their profile:
1. Name, Age, height, weight, gender.  
2. Current fitness level (beginner, intermediate, advanced).  
3. Lifestyle (active, sedentary, office work, etc.).  
4. Health limitations or injuries.  
5. Fitness goals (weight loss, muscle gain, endurance, general health, etc.).  
6. Preferred workout style (gym, home workouts, bodyweight, cardio, strength training, etc.).  
7. Workout frequency & available time per day.  
8. Dietary preferences & restrictions (vegetarian, vegan, keto, allergies, cultural preferences, etc.).  
9. Sleep patterns & stress levels.

### Behavior After Onboarding:
- Based on the answers, design a personalized weekly workout plan.  
- Create a basic meal plan that aligns with their goals.  
- During workouts, explain exercises clearly, suggest rest periods, and monitor calorie burn and heart rate (using provided data).  
- Motivate users and adapt recommendations over time based on progress.  
- Always prioritize safety: if an exercise is not suitable, suggest an alternative.  

### Extra Rules:
- Never give medical advice outside of general health & fitness guidance.  
- Always clarify when you’re making an estimate (e.g., calorie burn).  
- Encourage consistency and gradual progress.  
- Keep answers conversational and engaging.
- Answer such that your responses can be used in text-to-speech applications.
— Add natural stops in sentences (like "uhh...", "um...", "you know...", etc.)
— Do not use dashes, bullet points, lists or any special characters, except dots and commas, and exclamation marks!
— Your responses should be easy to read aloud and sound natural.
  `,
};

const conversation = [sysRoleQuestionnaire];

// ---- GPT response utility ----
export async function getGptResponse(inputText) {
        conversation.push({ role: "user", content: inputText });

    const response = await client.responses.create({
        model: "gpt-4.1-mini",
        input: conversation,
    });

    // The new Responses API gives you the text directly:
    const assistantText = response.output_text;
    return assistantText;
}

export async function getStructuredResponse(structure) {

    // Replace system role with structured role
    conversation[0] = {
        role: "system",
        content: `You are an expert at structured data extraction. You will be given a conversation between a user and an assistant.
Your task is to extract the relevant information from the conversation and format it according to the provided structure.
It is very important that you strictly follow the structure and do not add any additional information. If some information cannot be found about the user, return null for that field.`,
    }
    const structuredResponse = await client.responses.parse({
        model: "gpt-4.1-mini",
        input: conversation,
        text: {
            format: structure,
        },
    });
    console.log("Structured response:", structuredResponse.output_parsed);
    conversation[0] = sysRoleQuestionnaire; // revert back to original system role
    return structuredResponse.output_parsed;
}

/** --- Enums & helpers --- */
const Gender = z.enum([
    "male",
    "female",
    "nonbinary",
    "other",
    "prefer_not_to_say",
]);

const FitnessLevel = z.enum(["beginner", "intermediate", "advanced"]);

const Lifestyle = z.enum([
    "sedentary",
    "lightly_active",
    "active",
    "very_active",
    "shift_worker",
    "office_work",
    "mixed",
]);

const WorkoutStyle = z.enum([
    "gym",
    "home",
    "bodyweight",
    "cardio",
    "strength_training",
    "hiit",
    "mobility",
    "yoga_pilates",
    "sports",
]);

const Goal = z.enum([
    "weight_loss",
    "muscle_gain",
    "recomposition",
    "endurance",
    "general_health",
    "mobility_flexibility",
    "sport_specific",
]);

/** Use this when you want a field to always exist but allow null */
const requiredNullableNumber = (min, max) =>
    z.union([z.coerce.number().int().min(min).max(max), z.null()]);

/** --- Main schema --- */
export const UserWorkoutProfile = z
    .object({
        // 0. Name
        name: z.union([z.string(), z.null()]),

        // 1. Demographics
        age: requiredNullableNumber(13, 120),
        heightCm: requiredNullableNumber(100, 250),
        weightKg: z.union([z.coerce.number().min(25).max(400), z.null()]),
        gender: z.union([Gender, z.null()]),

        // 2. Current fitness level
        fitnessLevel: z.union([FitnessLevel, z.null()]),

        // 3. Lifestyle
        lifestyle: z.union([Lifestyle, z.null()]),
        lifestyleNotes: z.union([z.string().min(1).max(300), z.null()]),

        // 4. Health limitations / injuries
        healthLimitations: z.union([
            z
                .array(
                    z.object({
                        name: z.string().min(1).max(80),
                        notes: z.string().max(200).nullable().optional(),
                        severity: z.union([z.coerce.number().int().min(1).max(5), z.null()]).optional(),
                    })
                )
                .max(20),
            z.null(),
        ]),

        // 5. Fitness goals
        goals: z.union([z.array(Goal).min(1).max(5), z.null()]),
        targetTimelineWeeks: z.union([z.coerce.number().int().min(2).max(104), z.null()]),

        // 6. Preferred workout style
        preferredStyles: z.union([z.array(WorkoutStyle).min(1).max(6), z.null()]),
        equipmentAvailable: z.union([z.array(z.string().min(1).max(40)).max(30), z.null()]),
    })
    .strict();


while (true) {
    // Chat loop for testing
    const userInput = prompt("You: ");
    if (userInput.toLowerCase() === "exit") break;
    const answer = await getGptResponse(
        userInput,
        true,
        true,
        true,
        zodTextFormat(UserWorkoutProfile, "user_workout_profile"));
    console.log("GPT:", answer);
    const structured = await getStructuredResponse(zodTextFormat(UserWorkoutProfile, "user_workout_profile"));
    console.log("Structured:", structured);
}