import { describe, it, expect, afterAll } from 'vitest';
import { prisma, checkDatabaseHealth } from './db.js';

describe('Database Module', () => {
  afterAll(async () => {
    // Clean up test records
    await prisma.repository.deleteMany({
      where: { name: { startsWith: 'test-repo-' } },
    });
    await prisma.$disconnect();
  });

  it('reports database health as true when connected', async () => {
    const isHealthy = await checkDatabaseHealth();
    expect(isHealthy).toBe(true);
  });

  it('can create and query repository records with Prisma and SQLite', async () => {
    const testName = `test-repo-${Date.now()}`;
    const repo = await prisma.repository.create({
      data: {
        name: testName,
        path: '/tmp/test-repo',
        defaultBranch: 'main',
      },
    });

    expect(repo.id).toBeDefined();
    expect(repo.name).toBe(testName);
    expect(repo.path).toBe('/tmp/test-repo');
    expect(repo.defaultBranch).toBe('main');
    expect(repo.createdAt).toBeInstanceOf(Date);

    const found = await prisma.repository.findUnique({
      where: { id: repo.id },
    });

    expect(found).not.toBeNull();
    expect(found?.name).toBe(testName);
  });
});

