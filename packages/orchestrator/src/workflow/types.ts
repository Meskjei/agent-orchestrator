import { z } from 'zod';

export const SubtaskSchema = z.object({
  id: z.number(),
  task: z.string(),
  agent: z.string(),
  files: z.array(z.string()).optional(),
  dependsOn: z.array(z.number()).optional(),
});

export const SubtaskListSchema = z.object({
  subtasks: z.array(SubtaskSchema),
});

export const ReviewReportSchema = z.object({
  passed: z.boolean(),
  reason: z.string(),
  retrySubtasks: z.array(z.number()).optional(),
});

export type Subtask = z.infer<typeof SubtaskSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;

export interface WorkflowInput {
  task: string;
  cwd: string;
}

export interface WorkflowOutput {
  passed: boolean;
  reason: string;
  subtasks: Subtask[];
  results: Array<{ workerId: string; output: string; error?: string }>;
}