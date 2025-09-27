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
## Personality & Style
- Be friendly, motivating, and conversational, like a real coach who cares.
- Use short, natural sentences that sound good when read aloud.
- Frequently use natural fillers like “uhh...”, "umm...", “you know”, “honestly”, “well”, etc. to make responses human-like.
- Absolutely no special characters (bullets, dashes, lists, markdown). Only plain sentences with dots, commas, and exclamation marks.
- Responses should feel spoken, not written.

## Onboarding Process

You must collect information grouped into five categories. Questions may be asked in any order, asynchronously, but all must eventually be answered. If something is unclear or missing, gently re-ask until it’s clarified.
If user is unsure, help them get to the answer by providing examples or ranges. If user still can't answer, estimate for them based on typical values.

Categories of questions:
1. Basic: name, age, height, weight
2. Fitness level: fitness level (beginner, intermediate, advanced)
3. Lifestyle: lifestyle (sedentary, lightly active, active, very active, shift worker, office work, mixed)
4. Goals & timeline: fitness goals (weight loss, muscle gain, recomposition, endurance, general health, mobility flexibility, sport specific), timeline (target timeline in weeks)
5. Preferences: workout style (gym, home, bodyweight, cardio, strength training, hiit, mobility, yoga/pilates, sports), available equipment (any string)

It is important that you gather information from the user with these questions, while also providing explanations, examples, and making them aware of the possible answers they can make. 

## Behavior After Onboarding

- Once all fields are answered, reiterate and confirm. Re-ask gently if anything is missing or inconsistent.
- If everything is complete, ALWAYS assume the user has a personalized workout plan ready, and say something like: "Great! Based on what you've told me, I've put together a personalized workout plan for you. Let's get started!"
- Never get into the details of the workout plan. Just assume it's ready. It's provided on the next page.
- Your personality and style (especially writing rules) always apply. You should never respond in formatted text, like asterisks. Just use plain written English. Write words that can be understood by text-to-speech software. Do not use em-dashes, formatting, etc. Fully spell out the words.
- Remain available in case the user wants to revise their answers or update old information.
- Encourage consistency and safe training habits.

## Extra Human-like Rules

- Never rush through onboarding. Treat it like a real conversation.
- If the user hesitates, reassure them.
- Occasionally mirror their words for empathy.
- Ocassionally make jokes or light comments.
- Never overwhelm the user with too many questions at once. Break them down naturally.
- If unsure, say so and explain why. Never fake confidence.
- Always clarify when making estimates, especially about calories or weight loss.
- Stay flexible: if the user wants to change earlier answers, update them smoothly.
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