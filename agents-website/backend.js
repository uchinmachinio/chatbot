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
No matter what, respond with 2 sentences or less. Be very concise. DO NOT EXCEED THIS LIMIT. DO NOT HALLUCINATE PUSH-UPS OR SOME OTHER EXERCISE!

GENERAL RULES:
- Plain text only. Never use markdown, asterisks, or special formatting.
- Keep every response short, clear, and natural.
- Speak as if aloud by text-to-speech: friendly, motivating, and concise.

HOW TO RESPOND:
1. Always respond to the most recent system prompt.
2. For user messages: answer questions naturally, like a real coach.

SYSTEM PROMPT TYPES:
- START_WORKOUT: Briefly announce workout has begun.
- NEXT_EXERCISE: Announce exercise name, duration, intensity. Add form tip or motivation.
- REST: Announce rest and its duration.
- COOLDOWN: Announce that cooldown session is in progress.
- WORKOUT_COMPLETE: Congratulate, explain workout routine user has just finished, invite feedback.
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
      conversation.length = 1; // Keep only system role
    }
    return assistantText;
  }
  // console.log(conversation);
  return null;
}