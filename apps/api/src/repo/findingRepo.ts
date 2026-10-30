import { Finding, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { DbClient } from './types.js';

export interface CreateFindingInput {
  analysisId: string;
  title: string;
  severity: string;
  description: string;
  origin: string;
  status: string;
  confidence: string;
  baseSha: string;
  headSha: string;
  collector: string;
  evidenceIds?: string[];
}

export interface UpdateFindingInput {
  title?: string;
  severity?: string;
  description?: string;
  status?: string;
  confidence?: string;
}

export type FindingWithEvidences = Prisma.FindingGetPayload<{
  include: {
    evidences: {
      include: {
        evidence: true;
      };
    };
  };
}>;

export async function createFinding(
  input: CreateFindingInput,
  client: DbClient = prisma
): Promise<Finding> {
  const { evidenceIds, ...findingData } = input;

  return client.finding.create({
    data: {
      ...findingData,
      evidences: evidenceIds && evidenceIds.length > 0
        ? {
            create: evidenceIds.map((evidenceId) => ({
              evidence: { connect: { id: evidenceId } },
            })),
          }
        : undefined,
    },
  });
}

export async function getFindingById(
  id: string,
  client: DbClient = prisma
): Promise<FindingWithEvidences | null> {
  return client.finding.findUnique({
    where: { id },
    include: {
      evidences: {
        include: {
          evidence: true,
        },
      },
    },
  });
}

export async function listFindingsByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<FindingWithEvidences[]> {
  return client.finding.findMany({
    where: { analysisId },
    include: {
      evidences: {
        include: {
          evidence: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function linkFindingToEvidence(
  findingId: string,
  evidenceId: string,
  client: DbClient = prisma
): Promise<void> {
  await client.findingEvidence.create({
    data: {
      findingId,
      evidenceId,
    },
  });
}

export async function updateFinding(
  id: string,
  input: UpdateFindingInput,
  client: DbClient = prisma
): Promise<Finding> {
  return client.finding.update({
    where: { id },
    data: input,
  });
}

export async function deleteFinding(
  id: string,
  client: DbClient = prisma
): Promise<Finding> {
  return client.finding.delete({
    where: { id },
  });
}
