"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ContextSelectorHeader } from "@/components/app-shell/context-selector-header";
import { ActionCard } from "@/components/actions/action-card";
import { ActionDetailsModal } from "@/components/actions/action-details-modal";
import { ActionHistory } from "@/components/actions/action-history";
import {
  ACTION_CATALOGUE,
  FIXTURE_ACTION_HISTORY,
} from "@/lib/fixture-data";
import { useActions, useCreateAction } from "@/hooks/use-devos-api";
import type {
  ActionDefinition,
  ActionRecord,
} from "@/types/actions";
import {
  ShieldAlert,
  PlayCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

function ActionsPageContent() {
  const searchParams = useSearchParams();
  const repoParam = searchParams.get("repo") || "siddarth1709-Devos";
  const prParam = searchParams.get("pr") || "2";
  const initialFixture = searchParams.get("fixture") === "1";

  const [useFixtureMode, setUseFixtureMode] = useState<boolean>(initialFixture);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeModalAction, setActiveModalAction] =
    useState<ActionDefinition | null>(null);
  const [notification, setNotification] = useState<{
    type: "info" | "error" | "warning";
    message: string;
  } | null>(null);

  // TanStack Query for live actions
  const {
    data: liveActionRecords = [],
    isLoading: actionsLoading,
    refetch,
  } = useActions(repoParam);

  const createActionMutation = useCreateAction();

  // Active catalogue filtered by category
  const filteredActions = useMemo(() => {
    return ACTION_CATALOGUE.filter((act) => {
      if (selectedCategory !== "all" && act.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [selectedCategory]);

  const activeRecords: ActionRecord[] = useMemo(() => {
    if (useFixtureMode) return FIXTURE_ACTION_HISTORY;
    return (liveActionRecords as ActionRecord[]) || [];
  }, [useFixtureMode, liveActionRecords]);

  const isBackendConnected = liveActionRecords.length > 0;

  const handleSelectAction = (action: ActionDefinition) => {
    setNotification(null);
    setActiveModalAction(action);
  };

  const handleExecuteAction = async (
    action: ActionDefinition,
    params: Record<string, unknown>
  ) => {
    try {
      await createActionMutation.mutateAsync({
        type: action.type,
        target: `${repoParam}#${prParam}`,
        params,
      });

      setNotification({
        type: "info",
        message: `Action '${action.name}' submitted to backend engine. Tracking execution status in audit trail.`,
      });
      setActiveModalAction(null);
    } catch {
      // Truthful error handling
      setNotification({
        type: "warning",
        message: `Backend action execution endpoint returned unavailable or offline. DEVOS does not simulate unverified executions. Inspect audit logs or connect Builder 2 backend.`,
      });
      setActiveModalAction(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0E131F] text-neutral-100">
      <ContextSelectorHeader currentRepoId={repoParam} currentPrId={prParam} />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Offline / Preview Mode Banner */}
        {useFixtureMode ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <strong>SPECIFICATION PREVIEW:</strong> Displaying sample action executions for UI inspection. This view does not represent live repository mutations.
              </span>
            </div>
            <button
              onClick={() => setUseFixtureMode(false)}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium transition-colors shrink-0"
            >
              Exit Preview Mode
            </button>
          </div>
        ) : !isBackendConnected ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-neutral-800 bg-neutral-900/80 text-neutral-300 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-neutral-400" />
              <span>
                <strong>Backend Service Offline:</strong> Action execution and audit logging require connected services from Builder 2. Arbitrary shell execution is strictly prohibited.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => refetch()}
                disabled={actionsLoading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors"
              >
                <RefreshCw
                  className={`h-3 w-3 ${actionsLoading ? "animate-spin" : ""}`}
                />
                Retry Connection
              </button>
              <button
                onClick={() => setUseFixtureMode(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                Inspect Specification Preview
              </button>
            </div>
          </div>
        ) : null}

        {/* Temporary Notification Banner */}
        {notification && (
          <div
            className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
              notification.type === "warning"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "warning" ? (
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-neutral-400 hover:text-neutral-200 text-[11px] font-mono"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Section Header */}
        <div className="p-6 rounded-xl border border-[#292E2A] bg-[#101211] space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-md bg-[#C7F36B]/10 text-[#C7F36B]">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-mono text-[16px] font-semibold text-[#F0F2ED]">
                Secure Action Automation Catalogue
              </h2>
              <p className="font-body text-[13px] text-[#A0A79F] mt-0.5">
                Deterministic, bounded engineering workflows. Actions requiring state mutation enforce explicit two-step approval gates with audit verification.
              </p>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#1D221F]">
            {[
              { id: "all", label: "All Actions" },
              { id: "code_quality", label: "Code Quality" },
              { id: "change_management", label: "Change Management" },
              { id: "repository_maintenance", label: "Repository Maintenance" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`font-mono text-[11px] px-3 py-1.5 rounded transition-all ${
                  selectedCategory === tab.id
                    ? "bg-[#C7F36B] text-[#0A0C0B] font-semibold"
                    : "bg-[#151816] text-[#A0A79F] hover:text-[#F0F2ED] border border-[#292E2A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Catalogue Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              availability={isBackendConnected || useFixtureMode ? "available" : "requires_approval"}
              onSelect={handleSelectAction}
              isExecuting={createActionMutation.isPending}
            />
          ))}
        </div>

        {/* Execution Audit Trail / History */}
        <ActionHistory
          records={activeRecords}
          isBackendConnected={isBackendConnected}
          isFixturePreview={useFixtureMode}
        />

        {/* Action Detail & Approval Modal */}
        {activeModalAction && (
          <ActionDetailsModal
            action={activeModalAction}
            targetRepo={repoParam}
            targetPr={prParam}
            onClose={() => setActiveModalAction(null)}
            onConfirm={handleExecuteAction}
            isExecuting={createActionMutation.isPending}
          />
        )}
      </main>
    </div>
  );
}

export default function ActionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0E131F] text-neutral-400">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
            <span className="text-sm font-mono">Initializing Actions Interface...</span>
          </div>
        </div>
      }
    >
      <ActionsPageContent />
    </Suspense>
  );
}
