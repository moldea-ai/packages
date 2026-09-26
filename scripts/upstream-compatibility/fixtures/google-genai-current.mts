import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: 'test-only' });
const request = {
  model: 'gemini-test',
  contents: 'test',
  config: { systemInstruction: 'Follow the canonical instruction.' },
};

void client.models.generateContent(request);
void client.models.generateContentStream(request);
