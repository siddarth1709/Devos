import { Repository } from '@prisma/client';
import { prisma } from '../db.js';
import { DbClient } from './types.js';

export interface CreateRepositoryInput {
  name: string;
  path: string;
  defaultBranch?: string;
}

export interface UpdateRepositoryInput {
  name?: string;
  path?: string;
  defaultBranch?: string;
}

export async function createRepository(
  input: CreateRepositoryInput,
  client: DbClient = prisma
): Promise<Repository> {
  return client.repository.create({
    data: {
      name: input.name,
      path: input.path,
      defaultBranch: input.defaultBranch ?? 'main',
    },
  });
}

export async function getRepositoryById(
  id: string,
  client: DbClient = prisma
): Promise<Repository | null> {
  return client.repository.findUnique({
    where: { id },
  });
}

export async function getRepositoryByPath(
  path: string,
  client: DbClient = prisma
): Promise<Repository | null> {
  return client.repository.findUnique({
    where: { path },
  });
}

export async function getRepositoryByName(
  name: string,
  client: DbClient = prisma
): Promise<Repository | null> {
  return client.repository.findFirst({
    where: { name },
  });
}

export async function listRepositories(client: DbClient = prisma): Promise<Repository[]> {
  return client.repository.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateRepository(
  id: string,
  input: UpdateRepositoryInput,
  client: DbClient = prisma
): Promise<Repository> {
  return client.repository.update({
    where: { id },
    data: input,
  });
}

export async function deleteRepository(
  id: string,
  client: DbClient = prisma
): Promise<Repository> {
  const executeDelete = async (tx: DbClient): Promise<Repository> => {
    try {
      await tx.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
    } catch {
    }

    const analyses = await tx.analysis.findMany({
      where: { repositoryId: id },
      select: { id: true },
    });
    const analysisIds = analyses.map((a) => a.id);

    if (analysisIds.length > 0) {
      await tx.findingEvidence.deleteMany({
        where: {
          OR: [
            { finding: { analysisId: { in: analysisIds } } },
            { evidence: { analysisId: { in: analysisIds } } },
          ],
        },
      });
      await tx.riskTargetResult.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.guardEvaluation.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.riskAssessment.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.impactResult.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.actionExecution.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.dependencyEdge.deleteMany({
        where: {
          OR: [
            { analysisId: { in: analysisIds } },
            { repositoryId: id },
          ],
        },
      });
      await tx.dependencyNode.deleteMany({
        where: {
          OR: [
            { analysisId: { in: analysisIds } },
            { repositoryId: id },
          ],
        },
      });
      await tx.rejectedClaim.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.investigation.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.recommendation.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.hypothesis.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.finding.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.evidence.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.changedFile.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.symbol.deleteMany({
        where: { analysisId: { in: analysisIds } },
      });
      await tx.analysis.deleteMany({
        where: { id: { in: analysisIds } },
      });
    }

    await tx.symbol.deleteMany({
      where: { repositoryId: id },
    });

    return tx.repository.delete({
      where: { id },
    });
  };

  if ('$transaction' in client && typeof (client as any).$transaction === 'function') {
    return (client as any).$transaction(async (tx: DbClient) => executeDelete(tx));
  }
  return executeDelete(client);
}
