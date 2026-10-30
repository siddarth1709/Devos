"use client";

import { useState, memo } from "react";
import type { ActionDefinition } from "@/types/actions";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  X,
  Play,
  Lock,
} from "lucide-react";

interface ActionDetailsModalProps {
  action: ActionDefinition | null;
  targetRepo: string;
  targetPr?: string;
  onClose: () => void;
  onConfirm: (action: ActionDefinition, params: Record<string, unknown>) => void;
  isExecuting?: boolean;
}

export const ActionDetailsModal = memo(function ActionDetailsModal({
  action,
  targetRepo,
  targetPr = "2",
  onClose,
  onConfirm,
  isExecuting = false,
}: ActionDetailsModalProps) {
  const [params] = useState<Record<string, unknown>>(
    action ? { ...action.defaultParams } : {}
  );

  if (!action) return null;

  const needsApproval = action.requiresApproval || action.modifiesState;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-xl border border-[#292E2A] bg-[#101211] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-action-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-[#1D221F] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-md ${
                needsApproval
                  ? "bg-[#E9B96E]/15 text-[#E9B96E]"
                  : "bg-[#79D69A]/15 text-[#79D69A]"
              }`}
            >
              {needsApproval ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3
                id="modal-action-title"
                className="font-mono text-[15px] font-semibold text-[#F0F2ED]"
              >
                {action.name}
              </h3>
              <p className="font-mono text-[11px] text-[#A0A79F]">
                Operation ID: {action.type}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#1D221F] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
          {/* Description */}
          <div className="font-body text-[13px] text-[#C0C7BF] leading-[1.6]">
            {action.description}
          </div>

          {/* Target & Scope */}
          <div className="p-3 rounded-lg bg-[#151816] border border-[#1D221F] space-y-2">
            <div className="flex justify-between items-center text-[#A0A79F]">
              <span>Target Repository:</span>
              <span className="text-[#F0F2ED] font-semibold">{targetRepo}</span>
            </div>
            {targetPr && (
              <div className="flex justify-between items-center text-[#A0A79F]">
                <span>Pull Request Scope:</span>
                <span className="text-[#C7F36B]">PR #{targetPr}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-[#A0A79F]">
              <span>State Mutation:</span>
              <span
                className={
                  action.modifiesState ? "text-[#E9B96E]" : "text-[#79D69A]"
                }
              >
                {action.modifiesState ? "Yes (Modifies Repository)" : "No (Read-Only)"}
              </span>
            </div>
            <div className="flex justify-between items-center text-[#A0A79F]">
              <span>Reversibility:</span>
              <span
                className={
                  action.isReversible ? "text-[#79D69A]" : "text-[#F07878]"
                }
              >
                {action.isReversible ? "Fully Reversible" : "Irreversible Mutation"}
              </span>
            </div>
          </div>

          {/* Blast Radius & Potential Impact */}
          <div className="p-3 rounded-lg bg-[#191D1A] border border-[#292E2A] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#E9B96E] font-semibold text-[11px]">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Blast Radius & Execution Guardrails</span>
            </div>
            <p className="font-body text-[12px] text-[#A0A79F] leading-[1.5]">
              {action.potentialImpact}
            </p>
          </div>

          {/* Structured Parameters Specification (No arbitrary shell input allowed) */}
          <div className="space-y-1.5">
            <span className="text-[#A0A79F]">Structured Execution Parameters:</span>
            <pre className="p-3 rounded bg-[#0A0C0B] border border-[#1D221F] text-[#79D69A] overflow-x-auto text-[11px]">
              {JSON.stringify(params, null, 2)}
            </pre>
          </div>

          {/* Audit Logging Notice */}
          <div className="p-2.5 rounded bg-[#101211] border border-[#1D221F] text-[11px] text-[#6E776F] flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>
              This operation will be recorded in the persistent security audit log with actor ID and cryptographic checksum.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#1D221F] bg-[#0E100F] flex items-center justify-end gap-3 font-mono text-[12px]">
          <button
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 rounded border border-[#292E2A] text-[#A0A79F] hover:text-[#F0F2ED] hover:bg-[#151816] transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={() => onConfirm(action, params)}
            disabled={isExecuting}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded font-semibold transition-all ${
              needsApproval
                ? "bg-[#E9B96E] text-[#0A0C0B] hover:bg-[#F3C783]"
                : "bg-[#C7F36B] text-[#0A0C0B] hover:bg-[#D4F685]"
            }`}
          >
            {isExecuting ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                <span>Submitting to Backend...</span>
              </>
            ) : needsApproval ? (
              <>
                <ShieldAlert className="h-4 w-4" />
                <span>Approve and Execute</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                <span>Execute Action</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});
