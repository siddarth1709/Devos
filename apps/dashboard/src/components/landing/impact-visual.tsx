"use client";

import { useState } from "react";

interface GraphNode {
  id: number;
  name: string;
  x: number;
  y: number;
  role: string;
  isSource?: boolean;
  isPath?: boolean;
  neighbors: number[];
}

interface GraphEdge {
  id: string;
  from: number;
  to: number;
  d: string;
  isPath?: boolean;
}

export function ImpactVisual() {
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  const nodes: GraphNode[] = [
    { id: 1, name: "auth.ts", x: 105, y: 160, isSource: true, role: "Authentication core", neighbors: [2, 4] },
    { id: 2, name: "session.ts", x: 265, y: 130, isPath: true, role: "Token & session lifecycle", neighbors: [1, 3] },
    { id: 3, name: "middleware.ts", x: 465, y: 160, isPath: true, role: "Route interception guard", neighbors: [2, 6] },
    { id: 4, name: "users.ts", x: 105, y: 300, role: "User profile service", neighbors: [1, 5, 7] },
    { id: 5, name: "permissions.ts", x: 265, y: 285, role: "RBAC authorization rules", neighbors: [4, 6] },
    { id: 6, name: "api.ts", x: 465, y: 310, isPath: true, role: "Public REST endpoint router", neighbors: [3, 5, 8] },
    { id: 7, name: "dashboard.tsx", x: 105, y: 440, role: "Admin overview client view", neighbors: [4, 9] },
    { id: 8, name: "billing.ts", x: 285, y: 455, role: "Subscription tier handler", neighbors: [6, 9] },
    { id: 9, name: "tests", x: 480, y: 450, role: "End-to-end regression suites", neighbors: [7, 8] },
  ];

  const edges: GraphEdge[] = [
    { id: "e1", from: 1, to: 2, d: "M 161 160 C 185 160, 185 130, 209 130", isPath: true },
    { id: "e2", from: 2, to: 3, d: "M 321 130 C 365 130, 365 160, 409 160", isPath: true },
    { id: "e3", from: 1, to: 4, d: "M 105 180 C 105 230, 105 230, 105 280" },
    { id: "e4", from: 4, to: 5, d: "M 161 300 C 185 300, 185 285, 209 285" },
    { id: "e5", from: 5, to: 6, d: "M 321 285 C 365 285, 365 310, 409 310" },
    { id: "e6", from: 3, to: 6, d: "M 465 180 C 465 235, 465 235, 465 290", isPath: true },
    { id: "e7", from: 4, to: 7, d: "M 105 320 C 105 370, 105 370, 105 420" },
    { id: "e8", from: 6, to: 8, d: "M 409 310 C 365 310, 365 455, 341 455" },
    { id: "e9", from: 8, to: 9, d: "M 341 455 C 382 455, 382 450, 424 450" },
    { id: "e10", from: 7, to: 9, d: "M 161 440 C 290 440, 290 450, 424 450" },
  ];

  const activeNode = hoveredNodeId ? nodes.find((n) => n.id === hoveredNodeId) : null;

  return (
    <div className="w-full max-w-[620px] mx-auto visual-graph-panel select-none overflow-hidden transition-all duration-300">
      <svg
        viewBox="0 0 620 570"
        className="w-full max-w-full h-auto block rounded-[4px] border border-[#292E2A] bg-[#101211] shadow-2xl transition-colors duration-200"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Change impact dependency graph illustration"
      >
        <defs>
          <pattern
            id="technical-grid-pattern"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="#1D221F"
              strokeWidth="1"
              strokeOpacity="0.8"
            />
          </pattern>
        </defs>

        {/* Technical grid overlay */}
        <rect
          x="0"
          y="0"
          width="620"
          height="570"
          fill="url(#technical-grid-pattern)"
          className="transition-opacity duration-700"
        />

        {/* Panel header */}
        <text
          x="30"
          y="38"
          fill="#A0A79F"
          fontFamily="var(--font-mono, monospace)"
          fontSize="10"
          letterSpacing="1.2"
          fontWeight="500"
        >
          CHANGE IMPACT MAP
        </text>

        <text
          x="590"
          y="38"
          fill="#6E776F"
          fontFamily="var(--font-mono, monospace)"
          fontSize="9"
          letterSpacing="0.8"
          textAnchor="end"
          fontWeight="500"
        >
          {hoveredNodeId ? "NODE INSPECTION ACTIVE" : "ILLUSTRATIVE"}
        </text>

        {/* Header divider */}
        <line
          x1="0"
          y1="56"
          x2="620"
          y2="56"
          stroke="#1D221F"
          strokeWidth="1"
        />

        {/* Graph Edges */}
        <g className="edges">
          {edges.map((edge) => {
            const isIncident =
              hoveredNodeId !== null && (edge.from === hoveredNodeId || edge.to === hoveredNodeId);
            const isDimmed =
              hoveredNodeId !== null && !isIncident;

            let strokeColor = "#3B443B";
            let strokeWidth = "1.2";
            let strokeOpacity = "0.85";

            if (hoveredNodeId === null) {
              if (edge.isPath) {
                strokeColor = "#C7F36B";
                strokeWidth = "1.8";
                strokeOpacity = "0.95";
              }
            } else if (isIncident) {
              strokeColor = "#C7F36B";
              strokeWidth = "2.2";
              strokeOpacity = "1";
            } else if (isDimmed) {
              strokeColor = "#222824";
              strokeWidth = "1";
              strokeOpacity = "0.2";
            }

            return (
              <path
                key={edge.id}
                d={edge.d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                className={`transition-all duration-200 ${
                  edge.isPath && hoveredNodeId === null ? "path-edge-animated" : ""
                }`}
              />
            );
          })}

          {/* Travelling Pulse Particle along the Highlighted Path (when no node is hovered) */}
          {hoveredNodeId === null && (
            <circle r="3.5" fill="#C7F36B" opacity="0.95">
              <animateMotion
                dur="4s"
                repeatCount="indefinite"
                path="M 161 160 C 185 160, 185 130, 209 130 L 321 130 C 365 130, 365 160, 409 160 L 465 180 C 465 235, 465 235, 465 290"
              />
            </circle>
          )}
        </g>

        {/* Change Indicator near auth.ts */}
        <g className="transition-opacity duration-200" opacity={hoveredNodeId && hoveredNodeId !== 1 ? 0.3 : 1}>
          <text
            x="105"
            y="114"
            fill="#C7F36B"
            fontFamily="var(--font-mono, monospace)"
            fontSize="8"
            fontWeight="600"
            letterSpacing="0.8"
            textAnchor="middle"
          >
            CHANGE DETECTED
          </text>
          <line
            x1="105"
            y1="120"
            x2="105"
            y2="138"
            stroke="#C7F36B"
            strokeWidth="1.5"
          />
          <circle cx="105" cy="139" r="4" fill="#C7F36B" className="pulse-beacon" />
        </g>

        {/* 9 Interactive Nodes */}
        {nodes.map((node, idx) => {
          const isDirectlyHovered = hoveredNodeId === node.id;
          const isNeighbor =
            hoveredNodeId !== null &&
            activeNode?.neighbors.includes(node.id);
          const isMuted =
            hoveredNodeId !== null && !isDirectlyHovered && !isNeighbor;
          const isDefaultHighlighted =
            hoveredNodeId === null && (node.isSource || node.isPath);

          let rectFill = "#151816";
          let strokeColor = "#292E2A";
          let strokeWidth = "1";
          let textColor = "#A0A79F";
          let opacity = 1;

          if (isDirectlyHovered) {
            rectFill = "#1B201C";
            strokeColor = "#C7F36B";
            strokeWidth = "2";
            textColor = "#F0F2ED";
          } else if (isNeighbor) {
            rectFill = "#181D19";
            strokeColor = "#79D69A";
            strokeWidth = "1.5";
            textColor = "#F0F2ED";
          } else if (isMuted) {
            opacity = 0.25;
            textColor = "#6E776F";
          } else if (isDefaultHighlighted) {
            strokeColor = "#44553D";
            strokeWidth = "1.5";
            textColor = "#F0F2ED";
          }

          return (
            <g
              key={node.id}
              className="cursor-pointer transition-all duration-200"
              style={{
                opacity,
                transitionDelay: `${idx * 20}ms`,
              }}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={() => setHoveredNodeId(hoveredNodeId === node.id ? null : node.id)}
            >
              <rect
                x={node.x - 56}
                y={node.y - 20}
                width="112"
                height="40"
                rx="4"
                fill={rectFill}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                className="transition-colors duration-200"
              />
              {node.isSource && (
                <circle
                  cx={node.x - 42}
                  cy={node.y}
                  r="3.5"
                  fill="#C7F36B"
                  className="transition-transform duration-200"
                />
              )}
              <text
                x={node.isSource ? node.x - 30 : node.x}
                y={node.y + 4}
                textAnchor={node.isSource ? "start" : "middle"}
                fill={textColor}
                fontFamily="var(--font-mono, monospace)"
                fontSize="10"
                fontWeight={isDirectlyHovered ? "600" : "500"}
                className="transition-colors duration-200"
              >
                {node.name}
              </text>
            </g>
          );
        })}

        {/* Impact summary panel at bottom */}
        <line
          x1="0"
          y1="496"
          x2="620"
          y2="496"
          stroke="#1D221F"
          strokeWidth="1"
        />

        {/* Dynamic bottom strip */}
        <g className="transition-all duration-200">
          {/* Column 1 */}
          <text
            x="36"
            y="520"
            fill="#6E776F"
            fontFamily="var(--font-mono, monospace)"
            fontSize="8"
            letterSpacing="0.6"
          >
            {activeNode ? "INSPECTED NODE" : "CHANGE"}
          </text>
          <text
            x="36"
            y="540"
            fill="#F0F2ED"
            fontFamily="var(--font-mono, monospace)"
            fontSize="10"
            fontWeight="600"
          >
            {activeNode ? activeNode.name : "auth.ts"}
          </text>

          {/* Separator 1 */}
          <line
            x1="190"
            y1="506"
            x2="190"
            y2="550"
            stroke="#1D221F"
            strokeWidth="1"
          />

          {/* Column 2 */}
          <text
            x="215"
            y="520"
            fill="#6E776F"
            fontFamily="var(--font-mono, monospace)"
            fontSize="8"
            letterSpacing="0.6"
          >
            {activeNode ? "CONNECTED MODULES" : "PATH"}
          </text>
          <text
            x="215"
            y="540"
            fill="#F0F2ED"
            fontFamily="var(--font-mono, monospace)"
            fontSize="10"
            fontWeight="600"
          >
            {activeNode
              ? `${activeNode.neighbors.length} directly related`
              : "4 connected nodes"}
          </text>

          {/* Separator 2 */}
          <line
            x1="395"
            y1="506"
            x2="395"
            y2="550"
            stroke="#1D221F"
            strokeWidth="1"
          />

          {/* Column 3 */}
          <text
            x="420"
            y="520"
            fill="#6E776F"
            fontFamily="var(--font-mono, monospace)"
            fontSize="8"
            letterSpacing="0.6"
          >
            {activeNode ? "ROLE" : "STATUS"}
          </text>
          <text
            x="420"
            y="540"
            fill="#C7F36B"
            fontFamily="var(--font-mono, monospace)"
            fontSize="10"
            fontWeight="600"
          >
            {activeNode ? activeNode.role : "IMPACT TRACE"}
          </text>
        </g>
      </svg>
    </div>
  );
}
