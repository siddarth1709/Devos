"use client";

import { Network } from "lucide-react";
import { PhasePlaceholderView } from "@/components/app-shell/phase-placeholder-view";

export default function DependencyGraphPlaceholderPage() {
  return (
    <PhasePlaceholderView
      title="Interactive Architecture & Blast-Radius Graph"
      icon={Network}
      phaseNumber="PHASE 2"
      description="Interactive node-link visualizer showing downstream blast radius, affected call sites, and database schema mutations across your repository."
      prerequisite="Requires completed pull request analysis. Navigate to Repositories to select a pull request."
    />
  );
}
