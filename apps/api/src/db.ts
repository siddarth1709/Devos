import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

// Ensure DATABASE_URL is populated from config default if not in process.env
process.env.DATABASE_URL = process.env.DATABASE_URL || config.DATABASE_URL;

declare global {
  // eslint-disable-next-line no-var
  var __devos_prisma: PrismaClient | undefined;
}

export const prisma =
  global.__devos_prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.__devos_prisma = prisma;
}

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

