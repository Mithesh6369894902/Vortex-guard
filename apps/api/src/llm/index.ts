import type { QueryEngine } from '../db/engine';
import { planQuestion as planWithAgent, type QuestionAnswer as AgentQA, type Plan as AgentPlan } from './agent';
import { planQuestion as planWithMock, type QuestionAnswer as MockQA, type Plan as MockPlan } from './mock';

export type Plan = AgentPlan;
export type QuestionAnswer = AgentQA;

export async function planQuestion(db: QueryEngine, question: string, role: string): Promise<QuestionAnswer> {
  const engine = process.env.LLM_ENGINE?.toLowerCase() ?? 'agent';
  if (engine === 'mock_syndromes') {
    return planWithMock(db, question, role) as unknown as QuestionAnswer;
  }
  return planWithAgent(db, question, role);
}

export { planWithAgent, planWithMock };
