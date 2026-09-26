import { Annotation, END, START, StateGraph, entrypoint, interrupt } from '@langchain/langgraph';
import { z } from 'zod';

const GraphState = Annotation.Root({ answer: Annotation<string>() });
const ResumeSchema = z.object({ approved: z.boolean() });

export const supportGraph = new StateGraph({ state: GraphState })
  .addNode('respond', async (state) => ({ answer: state.answer }))
  .addEdge(START, 'respond')
  .addEdge('respond', END)
  .compile({ name: 'support_graph' });

export const supportWorkflow = entrypoint('support_workflow', async (question: string) =>
  interrupt({ question }, { responseSchema: ResumeSchema }),
);
