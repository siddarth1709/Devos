import { describe, it, expect } from 'vitest';
import {
  ReadinessStateEnum,
  ConfidenceEnum,
  ErrorResponseSchema,
  RepositorySchema,
  AnalysisJobSchema,
  EvidenceSchema,
  FindingSchema,
  HypothesisSchema,
  RecommendationSchema,
  ActionRequestSchema,
  ActionResultSchema,
  AnalysisReportSchema,
  HealthResponseSchema,
  GetRepositoriesResponseSchema,
  CreateRepositoryRequestSchema,
  CreateAnalysisRequestSchema,
  GetAnalysisResponseSchema,
  ReviewAnalysisRequestSchema,
  ReviewAnalysisResponseSchema,
  ExportAnalysisResponseSchema,
  CreateActionRequestSchema,
  ApproveActionRequestSchema,
  ApproveActionResponseSchema,
} from './index.js';

describe('@devos/contracts validation tests', () => {
  describe('Enums and Error Shape', () => {
    it('validates ReadinessState values', () => {
      expect(ReadinessStateEnum.parse('safe')).toBe('safe');
      expect(ReadinessStateEnum.parse('conditional')).toBe('conditional');
      expect(ReadinessStateEnum.parse('unsafe')).toBe('unsafe');
      expect(ReadinessStateEnum.parse('unknown')).toBe('unknown');
      expect(() => ReadinessStateEnum.parse('invalid')).toThrow();
    });

    it('validates Confidence values', () => {
      expect(ConfidenceEnum.parse('Low')).toBe('Low');
      expect(ConfidenceEnum.parse('Medium')).toBe('Medium');
      expect(ConfidenceEnum.parse('High')).toBe('High');
      expect(ConfidenceEnum.parse('Very High')).toBe('Very High');
      expect(() => ConfidenceEnum.parse('extreme')).toThrow();
    });

    it('validates consistent ErrorResponse shape', () => {
      const validError = {
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'The requested repository does not exist.',
        },
      };
      expect(ErrorResponseSchema.parse(validError)).toEqual(validError);

      expect(() =>
        ErrorResponseSchema.parse({
          error: {
            code: 404, // code must be string
            message: 'not found',
          },
        })
      ).toThrow();
    });
  });

  describe('Core Entities', () => {
    it('validates Repository entity', () => {
      const repo = {
        id: 'repo_123',
        name: 'devos',
        path: '/repos/devos',
        defaultBranch: 'main',
        createdAt: '2026-10-31T00:00:00.000Z',
      };
      expect(RepositorySchema.parse(repo)).toEqual(repo);
      expect(() => RepositorySchema.parse({ ...repo, name: undefined })).toThrow();
    });

    it('validates AnalysisJob entity and rejects invalid status', () => {
      const job = {
        id: 'job_123',
        repositoryId: 'repo_123',
        baseSha: '0123456789abcdef',
        headSha: 'fedcba9876543210',
        status: 'running',
        startedAt: '2026-10-31T00:00:00.000Z',
        finishedAt: null,
        error: null,
      };
      expect(AnalysisJobSchema.parse(job)).toEqual(job);
      expect(() => AnalysisJobSchema.parse({ ...job, status: 'canceled' })).toThrow();
    });

    it('validates Evidence entity', () => {
      const evidence = {
        id: 'ev_001',
        type: 'diff',
        sourceCommit: 'head123',
        file: 'apps/api/src/server.ts',
        lineStart: 10,
        lineEnd: 25,
        symbol: 'startServer',
        collector: 'git-diff-collector',
        collectedAt: '2026-10-31T00:01:00.000Z',
      };
      expect(EvidenceSchema.parse(evidence)).toEqual(evidence);
      expect(() => EvidenceSchema.parse({ ...evidence, type: 'video' })).toThrow();
    });

    it('validates Finding entity', () => {
      const finding = {
        id: 'f_001',
        title: 'Missing input validation on POST /actions',
        severity: 'high',
        description: 'Parameters are passed unvalidated to the executor.',
        evidenceIds: ['ev_001'],
        origin: 'gemma',
        status: 'hypothesis',
        confidence: 'Medium',
      };
      expect(FindingSchema.parse(finding)).toEqual(finding);
      expect(() => FindingSchema.parse({ ...finding, origin: 'chatgpt' })).toThrow();
    });

    it('validates Hypothesis entity', () => {
      const hypothesis = {
        id: 'hyp_001',
        title: 'Potential regression in auth middleware',
        description: 'New tokens might fail expiration checks.',
        rationale: 'Diff shows changed clock check without unit tests.',
        evidenceIds: ['ev_001'],
        status: 'proposed',
        confidence: 'High',
        createdAt: '2026-10-31T00:02:00.000Z',
      };
      expect(HypothesisSchema.parse(hypothesis)).toEqual(hypothesis);
      expect(() => HypothesisSchema.parse({ ...hypothesis, status: 'abandoned' })).toThrow();
    });

    it('validates Recommendation entity', () => {
      const recommendation = {
        id: 'rec_001',
        title: 'Add boundary checks to schema',
        description: 'Enforce string limits and allowed enum values.',
        findingIds: ['f_001'],
        priority: 'high',
        suggestedAction: 'patch_schema',
        rationale: 'Avoids unhandled exceptions at runtime.',
      };
      expect(RecommendationSchema.parse(recommendation)).toEqual(recommendation);
      expect(() => RecommendationSchema.parse({ ...recommendation, priority: 'urgent' })).toThrow();
    });

    it('validates ActionRequest and ActionResult entities', () => {
      const action = {
        id: 'act_001',
        type: 'run_tests',
        target: 'apps/api',
        params: { suite: 'unit' },
        requestedBy: 'user',
        requestedAt: '2026-10-31T00:03:00.000Z',
        status: 'approved',
      };
      expect(ActionRequestSchema.parse(action)).toEqual(action);

      const result = {
        actionRequestId: 'act_001',
        success: true,
        output: { passed: 14, failed: 0 },
        error: null,
        executedAt: '2026-10-31T00:03:10.000Z',
      };
      expect(ActionResultSchema.parse(result)).toEqual(result);
    });

    it('validates AnalysisReport entity and enforces trustMeter bounds', () => {
      const report = {
        jobId: 'job_123',
        summary: 'Analysis completed with 1 high finding.',
        findings: [
          {
            id: 'f_001',
            title: 'Unbounded loop',
            severity: 'high',
            description: 'Loop counter missing boundary check.',
            evidenceIds: ['ev_001'],
            origin: 'deterministic',
            status: 'confirmed',
            confidence: 'High',
          },
        ],
        changedSymbols: ['processRecords'],
        impact: 'Affects batch processing throughput.',
        readiness: 'conditional',
        confidence: 'High',
        limitations: ['Static analysis only; no runtime telemetry available.'],
        missingEvidence: ['Production benchmark metrics'],
        trustMeter: 85,
        claimsVerified: 3,
        claimsRejected: 0,
      };
      expect(AnalysisReportSchema.parse(report)).toEqual(report);

      expect(() => AnalysisReportSchema.parse({ ...report, trustMeter: 120 })).toThrow();
      expect(() => AnalysisReportSchema.parse({ ...report, claimsVerified: -1 })).toThrow();
    });
  });

  describe('Endpoint Request & Response Schemas', () => {
    it('validates GET /api/health response', () => {
      const res = { status: 'ok', version: '0.1.0', uptime: 42.5 };
      expect(HealthResponseSchema.parse(res)).toEqual(res);
      expect(() => HealthResponseSchema.parse({ status: 'ok', uptime: '42.5' })).toThrow();
    });

    it('validates GET and POST /api/repositories', () => {
      const getRes = {
        repositories: [
          {
            id: 'repo_1',
            name: 'devos',
            path: '/repos/devos',
            defaultBranch: 'main',
            createdAt: '2026-10-31T00:00:00.000Z',
          },
        ],
      };
      expect(GetRepositoriesResponseSchema.parse(getRes)).toEqual(getRes);

      const postReq = {
        name: 'devos-backend',
        path: '/repos/devos-backend',
      };
      expect(CreateRepositoryRequestSchema.parse(postReq)).toMatchObject({
        name: 'devos-backend',
        path: '/repos/devos-backend',
      });
    });

    it('validates POST and GET /api/analyses', () => {
      const postReq = {
        repositoryId: 'repo_1',
        baseSha: 'abc1234',
        headSha: 'def5678',
      };
      expect(CreateAnalysisRequestSchema.parse(postReq)).toEqual(postReq);

      const getRes = {
        job: {
          id: 'job_1',
          repositoryId: 'repo_1',
          baseSha: 'abc1234',
          headSha: 'def5678',
          status: 'queued',
          startedAt: null,
          finishedAt: null,
          error: null,
        },
        report: null,
      };
      expect(GetAnalysisResponseSchema.parse(getRes)).toEqual(getRes);
    });

    it('validates POST /api/analyses/:id/review and GET /api/analyses/:id/export', () => {
      const reviewReq = {
        findingsReview: [
          {
            findingId: 'f_001',
            status: 'confirmed',
            notes: 'Verified against local reproduction.',
          },
        ],
        comments: 'Overall looking solid.',
      };
      expect(ReviewAnalysisRequestSchema.parse(reviewReq)).toEqual(reviewReq);

      const reviewRes = {
        jobId: 'job_1',
        reviewedAt: '2026-10-31T00:04:00.000Z',
        status: 'reviewed',
        comments: 'Approved with conditions.',
      };
      expect(ReviewAnalysisResponseSchema.parse(reviewRes)).toEqual(reviewRes);

      const exportRes = {
        jobId: 'job_1',
        format: 'markdown',
        exportedAt: '2026-10-31T00:05:00.000Z',
        content: '# Analysis Report\n\nSafe to merge.',
      };
      expect(ExportAnalysisResponseSchema.parse(exportRes)).toEqual(exportRes);
    });

    it('validates POST /api/actions and POST /api/actions/:id/approve', () => {
      const actionReq = {
        type: 'git_checkout',
        target: 'apps/api',
        params: { branch: 'builder-2/engine' },
      };
      expect(CreateActionRequestSchema.parse(actionReq)).toMatchObject({
        type: 'git_checkout',
        target: 'apps/api',
      });

      const approveReq = {
        approved: true,
        reason: 'Authorized operator action.',
      };
      expect(ApproveActionRequestSchema.parse(approveReq)).toEqual(approveReq);

      const approveRes = {
        action: {
          id: 'act_100',
          type: 'git_checkout',
          target: 'apps/api',
          params: { branch: 'builder-2/engine' },
          requestedBy: 'operator',
          requestedAt: '2026-10-31T00:06:00.000Z',
          status: 'approved',
        },
        result: {
          actionRequestId: 'act_100',
          success: true,
          output: { branch: 'builder-2/engine' },
          error: null,
          executedAt: '2026-10-31T00:06:05.000Z',
        },
      };
      expect(ApproveActionResponseSchema.parse(approveRes)).toEqual(approveRes);
    });
  });
});
