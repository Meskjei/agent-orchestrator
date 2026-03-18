import { TaskNode } from '@agent-orchestrator/core';

export interface TaskOutput {
  summary: string;
  files: string[];
  artifacts: string[];
}

export interface ReviewInput {
  task: TaskNode;
  output: TaskOutput;
  reviewType: 'spec' | 'quality' | 'both';
}

export interface SpecReviewResult {
  compliant: boolean;
  missingRequirements: string[];
  extraWork: string[];
}

export interface QualityReviewResult {
  approved: boolean;
  strengths: string[];
  issues: string[];
}

export interface ReviewReport {
  passed: boolean;
  specReview: SpecReviewResult;
  qualityReview?: QualityReviewResult;
  requiresHumanReview: boolean;
}

export class TaskReviewSkill {
  async execute(input: ReviewInput): Promise<ReviewReport> {
    const specReview = this.reviewSpecCompliance(input.task, input.output);
    
    let qualityReview: QualityReviewResult | undefined;
    if (input.reviewType === 'quality' || input.reviewType === 'both') {
      qualityReview = this.reviewQuality(input.task, input.output);
    }

    const passed = specReview.compliant && (!qualityReview || qualityReview.approved);
    const requiresHumanReview = this.determineHumanReviewRequired(specReview, qualityReview);

    return {
      passed,
      specReview,
      qualityReview,
      requiresHumanReview
    };
  }

  private reviewSpecCompliance(task: TaskNode, output: TaskOutput): SpecReviewResult {
    const acceptanceCriteria = task.expectedOutput.acceptanceCriteria || [];
    const missingRequirements: string[] = [];
    const extraWork: string[] = [];

    const summaryLower = output.summary.toLowerCase();
    const filesLower = output.files.map(f => f.toLowerCase());
    const artifactsLower = output.artifacts.map(a => a.toLowerCase());

    for (const criterion of acceptanceCriteria) {
      const criterionLower = criterion.toLowerCase();
      const keyTerms = this.extractKeyTerms(criterionLower);
      
      const found = keyTerms.some(term => 
        summaryLower.includes(term) ||
        filesLower.some(f => f.includes(term)) ||
        artifactsLower.some(a => a.includes(term))
      );

      if (!found) {
        missingRequirements.push(criterion);
      }
    }

    const estimatedFiles = task.estimatedFiles || [];
    for (const outputFile of output.files) {
      const wasExpected = estimatedFiles.some(expected => 
        expected.toLowerCase() === outputFile.toLowerCase()
      );
      if (!wasExpected) {
        extraWork.push(`Unexpected file: ${outputFile}`);
      }
    }

    return {
      compliant: missingRequirements.length === 0,
      missingRequirements,
      extraWork
    };
  }

  private reviewQuality(task: TaskNode, output: TaskOutput): QualityReviewResult {
    const strengths: string[] = [];
    const issues: string[] = [];

    if (output.summary.length >= 20) {
      strengths.push('Summary provides adequate detail');
    } else if (output.summary.length < 10) {
      issues.push('Summary is too brief');
    }

    if (output.files.length > 0) {
      strengths.push(`Produced ${output.files.length} file(s)`);
    } else if (task.expectedOutput.type === 'code') {
      issues.push('No files produced for code task');
    }

    if (output.artifacts.length > 0) {
      strengths.push(`Generated ${output.artifacts.length} artifact(s)`);
    }

    const estimatedFiles = task.estimatedFiles || [];
    if (output.files.length >= estimatedFiles.length && estimatedFiles.length > 0) {
      strengths.push('All estimated files produced');
    }

    const approved = issues.length === 0;

    return {
      approved,
      strengths,
      issues
    };
  }

  private determineHumanReviewRequired(
    specReview: SpecReviewResult,
    qualityReview?: QualityReviewResult
  ): boolean {
    if (specReview.missingRequirements.length > 0) {
      return true;
    }

    if (specReview.extraWork.length > 0) {
      return true;
    }

    if (qualityReview && qualityReview.issues.length > 0) {
      return true;
    }

    return false;
  }

  private extractKeyTerms(criterion: string): string[] {
    const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with',
      'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'and', 'or',
      'but', 'if', 'then', 'else', 'when', 'up', 'out', 'so', 'than', 'too', 'very', 'just',
      'works', 'work', 'working', 'should', 'properly']);
    
    const criterionLower = criterion.toLowerCase();
    const hasNumber = /\d/.test(criterionLower);
    
    if (hasNumber) {
      const numberWithContext = criterionLower.match(/\S+\s+\d+|\d+\s+\S+/g);
      if (numberWithContext && numberWithContext.length > 0) {
        return numberWithContext.map(t => t.trim()).filter(t => t.length > 0);
      }
    }
    
    const terms = criterionLower
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.has(word));

    if (terms.length === 0) {
      return [criterionLower.trim()];
    }

    return terms;
  }
}