import { PrismaClient } from '@prisma/client';
import { prisma } from '../db.js';
import { DbClient } from './types.js';
import { createAnalysis, CreateAnalysisInput } from './analysisRepo.js';
import { createChangedFile, CreateChangedFileInput } from './artifactRepo.js';
import { createEvidence, CreateEvidenceInput } from './evidenceRepo.js';
import { createFinding, CreateFindingInput } from './findingRepo.js';
import { createHypothesis, CreateHypothesisInput } from './artifactRepo.js';
import { createRecommendation, CreateRecommendationInput } from './artifactRepo.js';

export interface SaveAnalysisBatchInput {
  analysis: CreateAnalysisInput;
  changedFiles?: Omit<CreateChangedFileInput, 'analysisId'>[];
  evidences?: Omit<CreateEvidenceInput, 'analysisId'>[];
  findings?: Array<
    Omit<CreateFindingInput, 'analysisId' | 'evidenceIds'> & {
      evidenceIndices?: number[];
    }
  >;
  hypotheses?: Omit<CreateHypothesisInput, 'analysisId'>[];
  recommendations?: Omit<CreateRecommendationInput, 'analysisId'>[];
}

export async function runInTransaction<T>(
  fn: (tx: DbClient) => Promise<T>,
  client: PrismaClient = prisma
): Promise<T> {
  return client.$transaction(async (tx) => {
    return fn(tx);
  });
}

export async function saveAnalysisBatch(
  input: SaveAnalysisBatchInput,
  client: PrismaClient = prisma
): Promise<{
  analysisId: string;
  evidenceIds: string[];
  findingIds: string[];
}> {
  return client.$transaction(async (tx) => {
    // 1. Create Analysis
    const analysis = await createAnalysis(input.analysis, tx);

    // 2. Create Changed Files
    if (input.changedFiles) {
      for (const cf of input.changedFiles) {
        await createChangedFile({ ...cf, analysisId: analysis.id }, tx);
      }
    }

    // 3. Create Evidences
    const createdEvidenceIds: string[] = [];
    if (input.evidences) {
      for (const ev of input.evidences) {
        const created = await createEvidence({ ...ev, analysisId: analysis.id }, tx);
        createdEvidenceIds.push(created.id);
      }
    }

    // 4. Create Findings with Evidence Links
    const createdFindingIds: string[] = [];
    if (input.findings) {
      for (const f of input.findings) {
        const { evidenceIndices, ...findingProps } = f;
        const linkedEvidenceIds = evidenceIndices
          ? evidenceIndices.map((idx) => createdEvidenceIds[idx]).filter(Boolean)
          : [];

        const createdFinding = await createFinding(
          {
            ...findingProps,
            analysisId: analysis.id,
            evidenceIds: linkedEvidenceIds,
          },
          tx
        );
        createdFindingIds.push(createdFinding.id);
      }
    }

    // 5. Create Hypotheses
    if (input.hypotheses) {
      for (const hyp of input.hypotheses) {
        await createHypothesis({ ...hyp, analysisId: analysis.id }, tx);
      }
    }

    // 6. Create Recommendations
    if (input.recommendations) {
      for (const rec of input.recommendations) {
        await createRecommendation({ ...rec, analysisId: analysis.id }, tx);
      }
    }

    return {
      analysisId: analysis.id,
      evidenceIds: createdEvidenceIds,
      findingIds: createdFindingIds,
    };
  });
}
