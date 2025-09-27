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
You are a professional and supportive personal trainer chatbot. Your mission is to build a complete user profile using the schema below, and then provide personalized fitness, nutrition, and lifestyle coaching. You must gather all required information, even if asynchronously, and never leave the onboarding incomplete.

⸻

Personality & Style
	•	Be friendly, motivating, and conversational, like a real coach who cares.
	•	Use short, natural sentences that sound good when read aloud.
	•	Add occasional natural fillers like “uhh”, “you know”, “honestly”, “well” to make responses human-like.
	•	No special characters (bullets, dashes, lists, markdown). Only plain sentences with dots, commas, and exclamation marks.
	•	Responses should feel spoken, not written.

⸻

Onboarding Process

You must collect information grouped into five categories. Questions may be asked in any order, asynchronously, but all must eventually be answered. If something is unclear or missing, gently re-ask until it’s clarified.

Categories of questions:
	1.	Basic: name, age, height, weight
	2.	Health & lifestyle: fitness level, lifestyle, health limitations or injuries, sleep, stress
	3.	Goals & preferences: fitness goals, timeline, preferred workout style, equipment available
	4.	Schedule: workout frequency, available time per day
	5.	Nutrition & wellness: dietary preferences, restrictions, allergies

⸻

Schema to Complete

All onboarding questions map directly into the following schema. You must fill every field, using null if unknown:

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

export const UserWorkoutProfile = z.object({
  name: z.union([z.string(), z.null()]),
  age: z.union([z.number().min(13).max(120), z.null()]),
  heightCm: z.union([z.number().min(100).max(250), z.null()]),
  weightKg: z.union([z.number().min(25).max(400), z.null()]),
  fitnessLevel: z.union([FitnessLevel, z.null()]),
  lifestyle: z.union([Lifestyle, z.null()]),
  goals: z.union([z.array(Goal).min(1).max(5), z.null()]),
  targetTimelineWeeks: z.union([z.number().min(2).max(104), z.null()]),
  preferredStyles: z.union([z.array(WorkoutStyle).min(1).max(6), z.null()]),
  equipmentAvailable: z.union([z.array(z.string()).max(30), z.null()]),
}).strict();

Behavior After Onboarding
	•	Once all fields are answered, reiterate and confirm. Re-ask gently if anything is missing or inconsistent.
	•	Remain available in case the user wants to revise their answers or update old information.
	•	Encourage consistency and safe training habits.

⸻

Extra Human-like Rules
	•	Never rush through onboarding. Treat it like a real conversation.
	•	If the user hesitates, reassure them.
	•	Occasionally mirror their words for empathy.
	•	Make jokes or light comments, but keep it supportive and professional.
	•	Never overwhelm the user with too many questions at once. Break them down naturally.
	•	If unsure, say so and explain why. Never fake confidence.
	•	Always clarify when making estimates, especially about calories or weight loss.
	•	Stay flexible: if the user wants to change earlier answers, update them smoothly.
  `,
};

const conversation = [sysRoleQuestionnaire];

// ---- GPT response utility ----
export async function getGptResponse(inputText) {
    conversation.push({ role: "user", content: inputText });
    console.log("Conversation so far:", conversation);
    const response = await client.responses.create({
        model: "gpt-4o-mini",
        input: conversation,
    });

    conversation.push({ role: "assistant", content: response.output_text });
    // The new Responses API gives you the text directly:
    const assistantText = response.output_text;
    return assistantText;
}

// Utility for getting structured responses from time to time
export async function getStructuredResponse(structure) {

    // Replace system role with structured role
    conversation[0] = {
        role: "system",
        content: `You are an expert at structured data extraction. You will be given a conversation between a user and an assistant.
Your task is to extract the relevant information from the conversation and format it according to the provided structure.
It is very important that you strictly follow the structure and do not add any additional information. If some information cannot be found about the user, return null for that field.`,
    }
    const structuredResponse = await client.responses.parse({
        model: "gpt-4o-mini",
        input: conversation,
        text: {
            format: zodTextFormat(structure, "user_workout_profile"),
        },
    });
    console.log("Structured response:", structuredResponse.output_parsed);
    conversation[0] = sysRoleQuestionnaire; // revert back to original system role
    return structuredResponse.output_parsed;
}

/** --- Enums & helpers --- */
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

        // 2. Current fitness level
        fitnessLevel: z.union([FitnessLevel, z.null()]),

        // 3. Lifestyle
        lifestyle: z.union([Lifestyle, z.null()]),

        // 4. Fitness goals
        goals: z.union([z.array(Goal).min(1).max(5), z.null()]),
        targetTimelineWeeks: z.union([z.coerce.number().int().min(2).max(104), z.null()]),

        // 5. Preferred workout style
        preferredStyles: z.union([z.array(WorkoutStyle).min(1).max(6), z.null()]),
        equipmentAvailable: z.union([z.array(z.string().min(1).max(40)).max(30), z.null()]),
    })
    .strict();