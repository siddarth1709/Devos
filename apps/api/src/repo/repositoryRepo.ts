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
  return client.repository.delete({
    where: { id },
  });
}

