import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";

const FindingDecisionSchema = z.object({
  decision: z.enum(["accepted", "rejected", "confirmed"]),
  actor: z.string().min(1).default("reviewer").optional(),
  rationale: z.string().min(1),
});

export const findingRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{ Params: { id: string } }>("/findings/:id", async (request, reply) => {
    const { id } = request.params;
    const finding = await prisma.finding.findUnique({
      where: { id },
      include: { evidences: true },
    });

    if (!finding) {
      reply.status(404).send({
        error: { code: "NOT_FOUND", message: `Finding "${id}" not found` },
      });
      return;
    }

    return {
      finding: {
        id: finding.id,
        analysisId: finding.analysisId,
        title: finding.title,
        severity: finding.severity,
        description: finding.description,
        origin: finding.origin,
        status: finding.status,
        confidence: finding.confidence,
        decision: finding.decision,
        decisionActor: finding.decisionActor,
        decisionAt: finding.decisionAt ? finding.decisionAt.toISOString() : null,
        decisionRationale: finding.decisionRationale,
        evidenceIds: finding.evidences.map((e) => e.evidenceId),
        createdAt: finding.createdAt.toISOString(),
      },
    };
  });

  app.get<{ Params: { id: string } }>("/findings/:id/evidence", async (request, reply) => {
    const { id } = request.params;
    const finding = await prisma.finding.findUnique({
      where: { id },
      include: {
        evidences: {
          include: {
            evidence: true,
          },
        },
      },
    });

    if (!finding) {
      reply.status(404).send({
        error: { code: "NOT_FOUND", message: `Finding "${id}" not found` },
      });
      return;
    }

    return {
      findingId: id,
      evidence: finding.evidences.map((fe) => ({
        id: fe.evidence.id,
        type: fe.evidence.type,
        sourceCommit: fe.evidence.sourceCommit,
        file: fe.evidence.file,
        lineStart: fe.evidence.lineStart,
        lineEnd: fe.evidence.lineEnd,
        symbol: fe.evidence.symbol,
        collector: fe.evidence.collector,
        collectedAt: fe.evidence.collectedAt.toISOString(),
        payload: fe.evidence.payload,
      })),
    };
  });

  app.post<{ Params: { id: string } }>("/findings/:id/decision", async (request, reply) => {
    const { id } = request.params;
    const body = FindingDecisionSchema.parse(request.body);

    const existing = await prisma.finding.findUnique({
      where: { id },
    });

    if (!existing) {
      reply.status(404).send({
        error: { code: "NOT_FOUND", message: `Finding "${id}" not found` },
      });
      return;
    }

    let newStatus = existing.status;
    if (body.decision === "accepted" || body.decision === "confirmed") {
      newStatus = "confirmed";
    } else if (body.decision === "rejected") {
      newStatus = "rejected";
    }

    const updated = await prisma.finding.update({
      where: { id },
      data: {
        status: newStatus,
        decision: body.decision,
        decisionActor: body.actor || "reviewer",
        decisionAt: new Date(),
        decisionRationale: body.rationale,
      },
      include: { evidences: true },
    });

    return {
      success: true,
      finding: {
        id: updated.id,
        analysisId: updated.analysisId,
        title: updated.title,
        severity: updated.severity,
        description: updated.description,
        origin: updated.origin,
        status: updated.status,
        confidence: updated.confidence,
        decision: updated.decision,
        decisionActor: updated.decisionActor,
        decisionAt: updated.decisionAt ? updated.decisionAt.toISOString() : null,
        decisionRationale: updated.decisionRationale,
        evidenceIds: updated.evidences.map((e) => e.evidenceId),
        createdAt: updated.createdAt.toISOString(),
      },
    };
  });
};

