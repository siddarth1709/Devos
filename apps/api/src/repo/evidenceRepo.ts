import { Evidence } from '@prisma/client';
import { prisma } from '../db.js';
import { DbClient } from './types.js';

export interface CreateEvidenceInput {
  analysisId?: string | null;
  type: string;
  sourceCommit: string;
  file: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  symbol?: string | null;
  collector: string;
  collectedAt?: Date;
  payload: string;
}

export interface UpdateEvidenceInput {
  type?: string;
  file?: string;
  lineStart?: number | null;
  lineEnd?: number | null;
  symbol?: string | null;
  payload?: string;
}

export async function createEvidence(
  input: CreateEvidenceInput,
  client: DbClient = prisma
): Promise<Evidence> {
  return client.evidence.create({
    data: {
      analysisId: input.analysisId,
      type: input.type,
      sourceCommit: input.sourceCommit,
      file: input.file,
      lineStart: input.lineStart,
      lineEnd: input.lineEnd,
      symbol: input.symbol,
      collector: input.collector,
      collectedAt: input.collectedAt ?? new Date(),
      payload: input.payload,
    },
  });
}

export async function getEvidenceById(
  id: string,
  client: DbClient = prisma
): Promise<Evidence | null> {
  return client.evidence.findUnique({
    where: { id },
  });
}

export async function listEvidenceByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<Evidence[]> {
  return client.evidence.findMany({
    where: { analysisId },
    orderBy: { collectedAt: 'desc' },
  });
}

export async function updateEvidence(
  id: string,
  input: UpdateEvidenceInput,
  client: DbClient = prisma
): Promise<Evidence> {
  return client.evidence.update({
    where: { id },
    data: input,
  });
}

export async function deleteEvidence(
  id: string,
  client: DbClient = prisma
): Promise<Evidence> {
  return client.evidence.delete({
    where: { id },
  });
}
