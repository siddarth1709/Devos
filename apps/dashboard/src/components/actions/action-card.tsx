"use client";

import { memo } from "react";
import type { ActionDefinition, ActionAvailability } from "@/types/actions";
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  Settings,
} from "lucide-react";

interface ActionCardProps {
  action: ActionDefinition;
  availability?: ActionAvailability;
  onSelect: (action: ActionDefinition) => void;
  isExecuting?: boolean;
}

export const ActionCard = memo(function ActionCard({
  action,
  availability = "available",
  onSelect,
  isExecuting = false,
}: ActionCardProps) {
  const isAvailable = availability === "available" || availability === "requires_approval";
  const needsApproval = action.requiresApproval || action.modifiesState;

  return (
    <div className="flex flex-col justify-between p-5 rounded-lg border border-[#292E2A] bg-[#101211] hover:border-[#383F3A] transition-colors group">
      <div className="space-y-3">
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-[#1D221F] text-[#A0A79F] border border-[#292E2A]">
              {action.category.replace("_", " ")}
            </span>
            {needsApproval ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-[#E9B96E]/15 text-[#E9B96E] border border-[#E9B96E]/30">
                <ShieldAlert className="h-3 w-3" />
                Requires Approval
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-[#79D69A]/15 text-[#79D69A] border border-[#79D69A]/30">
                <ShieldCheck className="h-3 w-3" />
                Read-Only
              </span>
            )}
          </div>

          <span
            className={`font-mono text-[10px] ${
              action.isReversible ? "text-[#79D69A]" : "text-[#E9B96E]"
            }`}
          >
            {action.isReversible ? "Reversible" : "Stateful Mutation"}
          </span>
        </div>

        {/* Action Title & Description */}
        <div>
          <h4 className="font-mono text-[14px] font-semibold text-[#F0F2ED] group-hover:text-[#C7F36B] transition-colors">
            {action.name}
          </h4>
          <p className="font-body text-[12px] text-[#A0A79F] mt-1 leading-[1.5]">
            {action.description}
          </p>
        </div>

        {/* Potential Impact Callout */}
        <div className="p-2.5 rounded bg-[#151816] border border-[#1D221F] text-[11px] font-mono text-[#6E776F]">
          <span className="text-[#A0A79F]">Impact: </span>
          {action.potentialImpact}
        </div>
      </div>

      {/* Footer: Required Permissions & Run CTA */}
      <div className="mt-5 pt-3 border-t border-[#1D221F] flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {action.requiredPermissions.map((perm) => (
            <span
              key={perm}
              className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-[#191D1A] text-[#80887F] border border-[#222724]"
            >
              {perm}
            </span>
          ))}
        </div>

        <button
          onClick={() => onSelect(action)}
          disabled={!isAvailable || isExecuting}
          className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-3 py-1.5 rounded transition-all shrink-0 ${
            !isAvailable
              ? "bg-[#1D221F] text-[#6E776F] cursor-not-allowed border border-[#292E2A]"
              : needsApproval
              ? "bg-[#E9B96E]/20 text-[#E9B96E] hover:bg-[#E9B96E]/30 border border-[#E9B96E]/40"
              : "bg-[#C7F36B] text-[#0A0C0B] hover:bg-[#D4F685]"
          }`}
        >
          {isExecuting ? (
            <>
              <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              <span>Queuing...</span>
            </>
          ) : needsApproval ? (
            <>
              <Settings className="h-3.5 w-3.5" />
              <span>Configure & Run...</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Run Now</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
});
