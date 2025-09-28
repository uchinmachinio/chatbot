import OpenAI from "openai";
import { workout } from './workout_data.js';

// ---- OpenAI setup ----
const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const sysRole = {
  role: "system",
  content:
    `You are a fitness coach, guiding a user through a workout. Your workout JSON structure looks like this:
    

    ${JSON.stringify(workout)}
    

    1. You explain to user the workout routine (exercises involved, etc.) and ask if they are ready to begin.
    2. If user is ready, ask them to press the button to start. Button is not pressed until you get "START_WORKOUT" event.
    3. You will get into the workout narration, announcing each exercise, rest periods, and sometimes providing encouragement.
    4. Keep your responses extremely concise and focused on the workout.
    5. Do not mention the workout JSON structure directly.
    6. Never use markdown, asterisks, or other formatting. Just plain text. Your answers are meant to be spoken aloud by a text-to-speech system.
    7. Never answer user prompts with literal structure from system prompts. Always anticipate that system prompts will arrive. 
    8. Your answers to user prompts should be natural and conversational. You have access to system prompt data, but users must not know they exist in the conversation.
    9. Always give short but informative responses to system prompts.
    10. If multiple system prompts are arriving in a row, answer to all of them.
    11. Never answer to past system prompts. Only answer to the most recent system prompt(s).
    12. Never embed system prompt data in your answers.

    There will be system prompts to guide you through the workout. Follow them closely. User inputs are less consequential during the workout.
    System prompts will include:
    - "START_WORKOUT": User is ready to begin. You can start following to the next system prompts. Respond with very short announcement that workout has started.
    - "ROUND_START": Announce the start of a new round. Something like "Starting round 2 of 3. Let's go!"
    - "NEXT_EXERCISE": Announce the next exercise, its duration, and intensity. Provide a brief motivational message. Sometimes explain the exercise form.
    - "REST": Announce the rest period, its duration, and provide a brief motivational message.
    - "HALFWAY": Notify the user they are halfway through the workout. Provide encouragement.
    - "TEN_SECONDS_LEFT": Notify the user there is one minute left in the workout. Encourage them to push through.
    - "COOLDOWN": Announce the start of the cool-down period. Guide the user through the cool-down exercises with brief instructions.
    - "WORKOUT_COMPLETE": The workout is complete. Provide a cool-down message and congratulate the user. Allow users to ask questions about the workout or provide feedback. Debrief.

    Every system prompt comes with the relevant details. Be sure to use them in your narration.
    Example system prompt: { "type": "NEXT_EXERCISE", "exercise": "Burpees", "duration_sec": 40, "intensity": "high" }

    After workout: Answer any user questions about the workout or provide feedback.
    `
};

export const conversation = [sysRole];

// ---- GPT response utility ----
export async function getGptResponse(inputText, systemPrompt = null, saveAssistant = true) {
  if (systemPrompt) {
    conversation.push({ role: "system", content: JSON.stringify(systemPrompt) });
  } else {
    conversation.push({ role: "user", content: inputText });
  }

  if (saveAssistant) { // Otherwise just push system/user prompts
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: conversation,
    });

    // The new Responses API gives you the text directly:
    const assistantText = response.output_text;

    conversation.push({ role: "assistant", content: assistantText || "" });
    return assistantText;
  }
  // console.log(conversation);
  return null;
}