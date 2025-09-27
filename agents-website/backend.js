import OpenAI from "openai";

// ---- OpenAI setup ----
const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

const sysRole = {
  role: "system",
  content:
    "You are a friendly fitness coach. Answer in a concise and informative manner. Use maximum of two sentences.",
};

const conversation = [sysRole];

const STATES = {
  QUESTIONNAIRE: "questionnaire",
  PLAN: "plan",
  WORKOUT: "workout",
  REFLECTION: "reflection",
};

let currentState = STATES.QUESTIONNAIRE;
let userProfile = {};
let workoutPlan = null;


// ---- GPT response utility ----
export async function getGptResponse(inputText) {
  conversation.push({ role: "user", content: inputText });

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: conversation,
  });

  // The new Responses API gives you the text directly:
  const assistantText = response.output_text;

  conversation.push({ role: "assistant", content: assistantText || "" });

  return assistantText;
}