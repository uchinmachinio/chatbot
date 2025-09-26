import OpenAI from "openai";
import dotenv from "dotenv";
import { ElevenLabsClient } from "elevenlabs";
import fs from "fs";

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

// ---- ElevenLabs setup ----
const elevenlabs = new ElevenLabsClient({
  apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
  baseUrl: "https://api.elevenlabs.io",
});

// ---- Audio playback utility ----
async function playResponseAsAudio(text) {
//   const response = await elevenlabs.textToSpeech.convert({
//     text,
//     voice_id: "1SM7GgM6IMuvQlz2BwM3",
//     model_id: "eleven_flash_v2",
//     output_format: "mp3_44100_32",
//   });

//   // Save to temp file
//   const filename = `response_${Date.now()}.mp3`;
//   const audioBuffer = Buffer.from(await response.arrayBuffer());
//   fs.writeFileSync(filename, audioBuffer);
}

// ---- GPT response utility ----
export async function getGptResponse(inputText) {
  conversation.push({ role: "user", content: inputText });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: conversation,
  });

  const assistantText = response.choices[0].message.content;
  conversation.push({ role: "assistant", content: assistantText || "" });

  return assistantText;
}