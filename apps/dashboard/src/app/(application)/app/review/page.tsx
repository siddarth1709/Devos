"use client";

import { FileSearch } from "lucide-react";
import { PhasePlaceholderView } from "@/components/app-shell/phase-placeholder-view";

export default function CodeReviewPlaceholderPage() {
  return (
    <PhasePlaceholderView
      title="Evidence-Backed AI Code Review"
      icon={FileSearch}
      phaseNumber="PHASE 2"
      description="Contextual review findings generated with Gemma, strictly anchored to AST diff symbols, references, and regression evidence."
      prerequisite="Requires completed pull request analysis. Navigate to Repositories to select a pull request."
    />
  );
}
