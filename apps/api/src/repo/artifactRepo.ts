import {
  ActionExecution,
  ChangedFile,
  DependencyEdge,
  DependencyNode,
  Hypothesis,
  Investigation,
  Recommendation,
  RejectedClaim,
  Symbol,
} from '@prisma/client';
import { prisma } from '../db.js';
import { DbClient } from './types.js';

// --- ChangedFile ---
export interface CreateChangedFileInput {
  analysisId: string;
  path: string;
  changeType: string;
  oldPath?: string | null;
  baseSha: string;
  headSha: string;
  collector: string;
}

export async function createChangedFile(
  input: CreateChangedFileInput,
  client: DbClient = prisma
): Promise<ChangedFile> {
  return client.changedFile.create({ data: input });
}

export async function getChangedFileById(
  id: string,
  client: DbClient = prisma
): Promise<ChangedFile | null> {
  return client.changedFile.findUnique({ where: { id } });
}

export async function listChangedFilesByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<ChangedFile[]> {
  return client.changedFile.findMany({ where: { analysisId } });
}

export async function updateChangedFile(
  id: string,
  data: Partial<CreateChangedFileInput>,
  client: DbClient = prisma
): Promise<ChangedFile> {
  return client.changedFile.update({ where: { id }, data });
}

// --- Symbol ---
export interface CreateSymbolInput {
  repositoryId: string;
  analysisId?: string | null;
  symbolKey: string;
  name: string;
  kind: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  colStart?: number | null;
  colEnd?: number | null;
  isExported?: boolean;
  containerName?: string | null;
  signature?: string | null;
  importKind?: string | null;
  importedName?: string | null;
  localName?: string | null;
  moduleSpecifier?: string | null;
  exportKind?: string | null;
  exportAlias?: string | null;
  isReExport?: boolean;
  reExportModule?: string | null;
  metadata?: string | null;
  commitSha: string;
  collector: string;
}

export async function createSymbol(
  input: CreateSymbolInput,
  client: DbClient = prisma
): Promise<Symbol> {
  return client.symbol.create({ data: input });
}

export async function createSymbols(
  inputs: CreateSymbolInput[],
  client: DbClient = prisma
): Promise<number> {
  if (inputs.length === 0) return 0;
  const result = await client.symbol.createMany({
    data: inputs,
  });
  return result.count;
}

export async function getSymbolById(
  id: string,
  client: DbClient = prisma
): Promise<Symbol | null> {
  return client.symbol.findUnique({ where: { id } });
}

export async function listSymbolsByRepository(
  repositoryId: string,
  client: DbClient = prisma
): Promise<Symbol[]> {
  return client.symbol.findMany({ where: { repositoryId } });
}

export async function listSymbolsByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<Symbol[]> {
  return client.symbol.findMany({ where: { analysisId } });
}

export async function getSymbolByKeyAndAnalysis(
  analysisId: string,
  symbolKey: string,
  client: DbClient = prisma
): Promise<Symbol | null> {
  return client.symbol.findFirst({ where: { analysisId, symbolKey } });
}

export async function deleteSymbolsByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<number> {
  const result = await client.symbol.deleteMany({ where: { analysisId } });
  return result.count;
}

export async function updateSymbol(
  id: string,
  data: Partial<CreateSymbolInput>,
  client: DbClient = prisma
): Promise<Symbol> {
  return client.symbol.update({ where: { id }, data });
}

export interface CreateDependencyNodeInput {
  analysisId: string;
  nodeKey: string;
  nodeType: string;
  name: string;
  path?: string | null;
  symbolKey?: string | null;
  repositoryId: string;
  commitSha: string;
  collector: string;
  metadata?: string | null;
}

export async function createDependencyNode(
  input: CreateDependencyNodeInput,
  client: DbClient = prisma
): Promise<DependencyNode> {
  return client.dependencyNode.create({ data: input });
}

export async function createDependencyNodes(
  inputs: CreateDependencyNodeInput[],
  client: DbClient = prisma
): Promise<number> {
  if (inputs.length === 0) return 0;
  const result = await client.dependencyNode.createMany({ data: inputs });
  return result.count;
}

export async function listDependencyNodesByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<DependencyNode[]> {
  return client.dependencyNode.findMany({ where: { analysisId } });
}

export async function deleteDependencyNodesByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<number> {
  const result = await client.dependencyNode.deleteMany({ where: { analysisId } });
  return result.count;
}

export interface CreateDependencyEdgeInput {
  analysisId?: string | null;
  repositoryId?: string | null;
  edgeKey?: string;
  from: string;
  to: string;
  kind: string;
  sourceFile: string;
  sourceLine: number;
  sourceCol?: number | null;
  resolutionStatus?: string;
  commitSha: string;
  collector: string;
  metadata?: string | null;
}

export async function createDependencyEdge(
  input: CreateDependencyEdgeInput,
  client: DbClient = prisma
): Promise<DependencyEdge> {
  return client.dependencyEdge.create({ data: input });
}

export async function createDependencyEdges(
  inputs: CreateDependencyEdgeInput[],
  client: DbClient = prisma
): Promise<number> {
  if (inputs.length === 0) return 0;
  const result = await client.dependencyEdge.createMany({ data: inputs });
  return result.count;
}

export async function getDependencyEdgeById(
  id: string,
  client: DbClient = prisma
): Promise<DependencyEdge | null> {
  return client.dependencyEdge.findUnique({ where: { id } });
}

export async function listDependencyEdgesByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<DependencyEdge[]> {
  return client.dependencyEdge.findMany({ where: { analysisId } });
}

export async function deleteDependencyEdgesByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<number> {
  const result = await client.dependencyEdge.deleteMany({ where: { analysisId } });
  return result.count;
}

export async function updateDependencyEdge(
  id: string,
  data: Partial<CreateDependencyEdgeInput>,
  client: DbClient = prisma
): Promise<DependencyEdge> {
  return client.dependencyEdge.update({ where: { id }, data });
}

// --- Hypothesis ---
export interface CreateHypothesisInput {
  analysisId: string;
  title: string;
  description: string;
  rationale: string;
  status: string;
  confidence: string;
  baseSha: string;
  headSha: string;
  collector: string;
}

export async function createHypothesis(
  input: CreateHypothesisInput,
  client: DbClient = prisma
): Promise<Hypothesis> {
  return client.hypothesis.create({ data: input });
}

export async function getHypothesisById(
  id: string,
  client: DbClient = prisma
): Promise<Hypothesis | null> {
  return client.hypothesis.findUnique({ where: { id } });
}

export async function listHypothesesByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<Hypothesis[]> {
  return client.hypothesis.findMany({ where: { analysisId } });
}

export async function updateHypothesis(
  id: string,
  data: Partial<CreateHypothesisInput>,
  client: DbClient = prisma
): Promise<Hypothesis> {
  return client.hypothesis.update({ where: { id }, data });
}

// --- Recommendation ---
export interface CreateRecommendationInput {
  analysisId: string;
  title: string;
  description: string;
  priority: string;
  suggestedAction?: string | null;
  rationale?: string | null;
  baseSha: string;
  headSha: string;
  collector: string;
}

export async function createRecommendation(
  input: CreateRecommendationInput,
  client: DbClient = prisma
): Promise<Recommendation> {
  return client.recommendation.create({ data: input });
}

export async function getRecommendationById(
  id: string,
  client: DbClient = prisma
): Promise<Recommendation | null> {
  return client.recommendation.findUnique({ where: { id } });
}

export async function listRecommendationsByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<Recommendation[]> {
  return client.recommendation.findMany({ where: { analysisId } });
}

export async function updateRecommendation(
  id: string,
  data: Partial<CreateRecommendationInput>,
  client: DbClient = prisma
): Promise<Recommendation> {
  return client.recommendation.update({ where: { id }, data });
}

// --- ActionExecution ---
export interface CreateActionExecutionInput {
  analysisId?: string | null;
  actionName: string;
  params: string;
  status: string;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  output?: string | null;
  error?: string | null;
  commitSha: string;
  collector: string;
}

export async function createActionExecution(
  input: CreateActionExecutionInput,
  client: DbClient = prisma
): Promise<ActionExecution> {
  return client.actionExecution.create({ data: input });
}

export async function getActionExecutionById(
  id: string,
  client: DbClient = prisma
): Promise<ActionExecution | null> {
  return client.actionExecution.findUnique({ where: { id } });
}

export async function listActionExecutions(
  client: DbClient = prisma
): Promise<ActionExecution[]> {
  return client.actionExecution.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function updateActionExecution(
  id: string,
  data: Partial<CreateActionExecutionInput>,
  client: DbClient = prisma
): Promise<ActionExecution> {
  return client.actionExecution.update({ where: { id }, data });
}

// --- Investigation ---
export interface CreateInvestigationInput {
  analysisId: string;
  status: string;
  stage: string;
  startedAt?: Date;
  finishedAt?: Date | null;
  error?: string | null;
  baseSha: string;
  headSha: string;
  collector: string;
}

export async function createInvestigation(
  input: CreateInvestigationInput,
  client: DbClient = prisma
): Promise<Investigation> {
  return client.investigation.create({
    data: {
      ...input,
      startedAt: input.startedAt ?? new Date(),
    },
  });
}

export async function getInvestigationByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<Investigation | null> {
  return client.investigation.findFirst({ where: { analysisId } });
}

export async function updateInvestigation(
  id: string,
  data: Partial<CreateInvestigationInput>,
  client: DbClient = prisma
): Promise<Investigation> {
  return client.investigation.update({ where: { id }, data });
}

// --- RejectedClaim ---
export interface CreateRejectedClaimInput {
  analysisId: string;
  findingRef?: string | null;
  reason: string;
  claimText: string;
  baseSha: string;
  headSha: string;
  collector: string;
}

export async function createRejectedClaim(
  input: CreateRejectedClaimInput,
  client: DbClient = prisma
): Promise<RejectedClaim> {
  return client.rejectedClaim.create({ data: input });
}

export async function getRejectedClaimById(
  id: string,
  client: DbClient = prisma
): Promise<RejectedClaim | null> {
  return client.rejectedClaim.findUnique({ where: { id } });
}

export async function listRejectedClaimsByAnalysis(
  analysisId: string,
  client: DbClient = prisma
): Promise<RejectedClaim[]> {
  return client.rejectedClaim.findMany({ where: { analysisId } });
}

export async function updateRejectedClaim(
  id: string,
  data: Partial<CreateRejectedClaimInput>,
  client: DbClient = prisma
): Promise<RejectedClaim> {
  return client.rejectedClaim.update({ where: { id }, data });
}
