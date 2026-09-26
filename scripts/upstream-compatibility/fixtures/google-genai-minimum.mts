import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: 'test-only' });

void client.models.generateContent({
  model: 'gemini-test',
  contents: 'test',
  config: { systemInstruction: 'Follow the canonical instruction.' },
});

void client.models.generateContentStream({
  model: 'gemini-test',
  contents: 'test',
  config: { systemInstruction: 'Follow the canonical instruction.' },
});
