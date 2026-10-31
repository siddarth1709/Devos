import { Analysis, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { DbClient } from './types.js';

export interface CreateAnalysisInput {
  repositoryId: string;
  baseSha: string;
  headSha: string;
  status?: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  error?: string | null;
}

export interface UpdateAnalysisInput {
  status?: string;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  error?: string | null;
}

export type AnalysisWithRelations = Prisma.AnalysisGetPayload<{
  include: {
    changedFiles: true;
    findings: { include: { evidences: { include: { evidence: true } } } };
    hypotheses: true;
    recommendations: true;
    investigations: true;
    rejectedClaims: true;
    evidences: true;
    dependencyEdges: true;
    actionExecutions: true;
  };
}>;

export async function createAnalysis(
  input: CreateAnalysisInput,
  client: DbClient = prisma
): Promise<Analysis> {
  return client.analysis.create({
    data: {
      repositoryId: input.repositoryId,
      baseSha: input.baseSha,
      headSha: input.headSha,
      status: input.status ?? 'queued',
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      error: input.error,
    },
  });
}

export async function getAnalysisById(
  id: string,
  client: DbClient = prisma
): Promise<Analysis | null> {
  return client.analysis.findUnique({
    where: { id },
  });
}

export async function getAnalysisWithRelations(
  id: string,
  client: DbClient = prisma
): Promise<AnalysisWithRelations | null> {
  return client.analysis.findUnique({
    where: { id },
    include: {
      changedFiles: true,
      findings: {
        include: {
          evidences: {
            include: {
              evidence: true,
            },
          },
        },
      },
      hypotheses: true,
      recommendations: true,
      investigations: true,
      rejectedClaims: true,
      evidences: true,
      dependencyEdges: true,
      actionExecutions: true,
    },
  });
}

export async function listAnalysesByRepository(
  repositoryId: string,
  client: DbClient = prisma
): Promise<Analysis[]> {
  return client.analysis.findMany({
    where: { repositoryId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateAnalysis(
  id: string,
  input: UpdateAnalysisInput,
  client: DbClient = prisma
): Promise<Analysis> {
  return client.analysis.update({
    where: { id },
    data: input,
  });
}

export async function deleteAnalysis(
  id: string,
  client: DbClient = prisma
): Promise<Analysis> {
  const executeDelete = async (tx: DbClient): Promise<Analysis> => {
    try {
      await tx.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    } catch {
    }

    await tx.findingEvidence.deleteMany({
      where: {
        OR: [
          { finding: { analysisId: id } },
          { evidence: { analysisId: id } },
        ],
      },
    });
    await tx.riskTargetResult.deleteMany({
      where: { analysisId: id },
    });
    await tx.riskAssessment.deleteMany({
      where: { analysisId: id },
    });
    await tx.impactResult.deleteMany({
      where: { analysisId: id },
    });
    await tx.actionExecution.deleteMany({
      where: { analysisId: id },
    });
    await tx.dependencyEdge.deleteMany({
      where: { analysisId: id },
    });
    await tx.dependencyNode.deleteMany({
      where: { analysisId: id },
    });
    await tx.rejectedClaim.deleteMany({
      where: { analysisId: id },
    });
    await tx.investigation.deleteMany({
      where: { analysisId: id },
    });
    await tx.recommendation.deleteMany({
      where: { analysisId: id },
    });
    await tx.hypothesis.deleteMany({
      where: { analysisId: id },
    });
    await tx.finding.deleteMany({
      where: { analysisId: id },
    });
    await tx.evidence.deleteMany({
      where: { analysisId: id },
    });
    await tx.changedFile.deleteMany({
      where: { analysisId: id },
    });
    await tx.symbol.deleteMany({
      where: { analysisId: id },
    });

    return tx.analysis.delete({
      where: { id },
    });
  };

  if ('$transaction' in client && typeof (client as any).$transaction === 'function') {
    return (client as any).$transaction(async (tx: DbClient) => executeDelete(tx));
  }
  return executeDelete(client);
}

