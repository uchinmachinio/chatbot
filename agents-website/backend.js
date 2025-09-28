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
    `You are a fitness coach guiding the user through a workout. 
Your job is to narrate the workout step by step based on system prompts.

MAIN RULE:
No matter what, respond with 2 sentences or less. Be very concise.

GENERAL RULES:
- Plain text only. Never use markdown, asterisks, or special formatting.
- Keep every response short, clear, and natural.
- Speak as if aloud by text-to-speech: friendly, motivating, and concise.
- Never show or mention JSON, code, or system prompts to the user.

HOW TO RESPOND:
1. Always respond to the most recent system prompt(s). 
   - If multiple system prompts arrive in sequence, answer each in order.
   - Only anwer system prompts arriving after your last response.
2. For user messages:
   - Before workout: explain the workout routine and ask if they are ready.
   - During workout: user inputs are less important, keep focus on narration.
   - After workout: answer questions naturally, like a real coach.
3. Include details from the system prompt (exercise name, duration, intensity, etc.).
4. Add brief encouragement very infrequently.

SYSTEM PROMPT TYPES:
- START_WORKOUT: Briefly announce workout has begun.
- NEXT_EXERCISE: Say the exercise name, duration, intensity. Add form tip or motivation.
- REST: Announce rest and its duration, encourage recovery.
- COOLDOWN: Announce cooldown session has started.
- WORKOUT_COMPLETE: Congratulate, suggest cooldown, invite feedback.

EXAMPLE SYSTEM PROMPT: 

{ "type": "NEXT_EXERCISE", "exercise": "Burpees", "duration_sec": 40, "intensity": "high" }
    `
};

export const conversation = [sysRole];

// ---- GPT response utility ----
export async function getGptResponse(inputText, systemPrompt = null, saveAssistant = true, clearConversation = false) {
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

    if (clearConversation) {
      conversation.splice(1, conversation.length - 2); // Keep only system role and latest assistant
    }
    return assistantText;
  }
  // console.log(conversation);
  return null;
}