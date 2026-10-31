"use client";

import { useState, useEffect, useRef } from "react";

interface NodeData {
  id: string;
  name: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isOrigin?: boolean;
  tier: number;
  description: string;
  badge?: string;
}

interface EdgeData {
  id: string;
  from: string;
  to: string;
  path: string;
  isActivePath?: boolean;
  length: number;
}

export function ChangePropagationGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [pulsePos, setPulsePos] = useState<number>(0);

  // Nodes definition
  const nodes: NodeData[] = [
    {
      id: "auth",
      name: "auth.ts",
      label: "ORIGIN",
      x: 170,
      y: 250,
      width: 136,
      height: 54,
      isOrigin: true,
      tier: 0,
      badge: "MODIFIED",
      description: "Root modification: token hashing & session authentication logic",
    },
    {
      id: "session",
      name: "session.ts",
      x: 360,
      y: 160,
      width: 124,
      height: 44,
      tier: 1,
      description: "Direct consumer: session persistence & cookie serialisation",
    },
    {
      id: "permissions",
      name: "permissions.ts",
      x: 360,
      y: 290,
      width: 136,
      height: 44,
      tier: 1,
      description: "Access policy validator & role checking pipeline",
    },
    {
      id: "tests",
      name: "tests/auth.test.ts",
      x: 170,
      y: 430,
      width: 154,
      height: 44,
      tier: 1,
      description: "Security test suite verifying session replay protection",
    },
    {
      id: "middleware",
      name: "middleware.ts",
      x: 535,
      y: 110,
      width: 130,
      height: 44,
      tier: 2,
      description: "Edge request guard validating HTTP credentials & cookies",
    },
    {
      id: "billing",
      name: "billing.ts",
      x: 535,
      y: 225,
      width: 112,
      height: 44,
      tier: 2,
      description: "Customer invoice & billing portal authentication hook",
    },
    {
      id: "dashboard",
      name: "dashboard.tsx",
      x: 535,
      y: 350,
      width: 132,
      height: 44,
      tier: 2,
      description: "Client application shell & user account provider",
    },
    {
      id: "api",
      name: "api.ts",
      x: 648,
      y: 110,
      width: 90,
      height: 44,
      tier: 3,
      description: "Fastify route registry & JSON payload handler",
    },
  ];

  // 11 Edges with explicit cubic bezier curves for balanced layout
  const edges: EdgeData[] = [
    // Active Propagation Path: auth -> session -> middleware -> api
    {
      id: "e-auth-session",
      from: "auth",
      to: "session",
      path: "M 238 230 C 275 200, 290 175, 298 165",
      isActivePath: true,
      length: 120,
    },
    {
      id: "e-session-middleware",
      from: "session",
      to: "middleware",
      path: "M 422 145 C 450 130, 460 120, 470 115",
      isActivePath: true,
      length: 85,
    },
    {
      id: "e-middleware-api",
      from: "middleware",
      to: "api",
      path: "M 600 110 L 603 110",
      isActivePath: true,
      length: 50,
    },

    // Secondary Downstream Paths
    {
      id: "e-auth-permissions",
      from: "auth",
      to: "permissions",
      path: "M 238 265 C 265 275, 280 285, 292 290",
      isActivePath: false,
      length: 95,
    },
    {
      id: "e-auth-tests",
      from: "auth",
      to: "tests",
      path: "M 170 277 L 170 408",
      isActivePath: false,
      length: 131,
    },
    {
      id: "e-session-billing",
      from: "session",
      to: "billing",
      path: "M 422 175 C 455 195, 465 210, 479 225",
      isActivePath: false,
      length: 105,
    },
    {
      id: "e-session-dashboard",
      from: "session",
      to: "dashboard",
      path: "M 410 182 C 435 230, 455 300, 469 340",
      isActivePath: false,
      length: 180,
    },
    {
      id: "e-permissions-dashboard",
      from: "permissions",
      to: "dashboard",
      path: "M 428 305 C 450 320, 458 335, 469 350",
      isActivePath: false,
      length: 85,
    },
    {
      id: "e-permissions-billing",
      from: "permissions",
      to: "billing",
      path: "M 428 275 C 450 260, 460 245, 479 235",
      isActivePath: false,
      length: 80,
    },
    {
      id: "e-middleware-billing",
      from: "middleware",
      to: "billing",
      path: "M 535 132 L 535 203",
      isActivePath: false,
      length: 71,
    },
    {
      id: "e-permissions-api",
      from: "permissions",
      to: "api",
      path: "M 428 290 C 510 280, 590 200, 640 132",
      isActivePath: false,
      length: 260,
    },
  ];

  // IntersectionObserver entrance
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Subtle continuous signal pulse along active path (only when inView)
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let animId: number;
    let startTime: number | null = null;
    const duration = 2800; // 2.8s loop

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = (elapsed % duration) / duration;
      setPulsePos(progress);
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [inView]);

  // Determine connected nodes for hover highlighting
  const activeEdgeIds = hoveredNode
    ? edges
        .filter((e) => e.from === hoveredNode || e.to === hoveredNode)
        .map((e) => e.id)
    : [];

  const connectedNodeIds = hoveredNode
    ? [
        hoveredNode,
        ...edges
          .filter((e) => e.from === hoveredNode)
          .map((e) => e.to),
        ...edges
          .filter((e) => e.to === hoveredNode)
          .map((e) => e.from),
      ]
    : [];

  // Active path polyline coordinate estimation for traveling pulse
  // Path: auth (170,250) -> session (360,160) -> middleware (535,110) -> api (648,110)
  const getPulseCoords = (t: number) => {
    if (t < 0.45) {
      // auth -> session
      const segT = t / 0.45;
      const x = 238 + (360 - 238) * segT;
      const y = 240 + (160 - 240) * Math.sin((segT * Math.PI) / 2);
      return { x, y, visible: true };
    } else if (t < 0.8) {
      // session -> middleware
      const segT = (t - 0.45) / 0.35;
      const x = 360 + (535 - 360) * segT;
      const y = 160 + (110 - 160) * segT;
      return { x, y, visible: true };
    } else {
      // middleware -> api
      const segT = (t - 0.8) / 0.2;
      const x = 535 + (648 - 535) * segT;
      const y = 110;
      return { x, y, visible: true };
    }
  };

  const pulse = getPulseCoords(pulsePos);
  const activeHoveredNodeData = nodes.find((n) => n.id === hoveredNode);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[720px] mx-auto select-none rounded-[10px] p-2 sm:p-4 transition-all duration-300"
      aria-label="Engineering change propagation visualization"
    >
      {/* Interactive Tooltip Card at top */}
      <div className="absolute top-2 left-4 right-4 z-20 flex items-center justify-between pointer-events-none min-h-[30px]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#090A0A] animate-ping" />
          <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.14em] font-bold text-[#090A0A]/90 uppercase">
            {activeHoveredNodeData
              ? `INSPECTING: ${activeHoveredNodeData.name}`
              : "ILLUSTRATIVE CHANGE MAP"}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 font-mono text-[9px] text-[#090A0A]/70 uppercase">
          <span>Active blast radius</span>
          <span className="inline-block w-2 h-0.5 bg-[#090A0A]" />
          <span className="font-bold text-[#090A0A]">4 tiers</span>
        </div>
      </div>

      <svg
        viewBox="0 0 720 540"
        className="w-full h-auto overflow-visible block drop-shadow-sm"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <defs>
          {/* Subtle grid pattern */}
          <pattern
            id="eng-grid-cta"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="#090A0A"
              strokeWidth="0.5"
              strokeOpacity="0.08"
            />
            <circle cx="0" cy="0" r="0.8" fill="#090A0A" fillOpacity="0.2" />
          </pattern>

          {/* Active path pulse glow filter */}
          <filter id="glow-pulse" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Background Grid Texture */}
        <rect
          x="20"
          y="20"
          width="680"
          height="490"
          fill="url(#eng-grid-cta)"
          rx="8"
          className={`transition-opacity duration-700 ${inView ? "opacity-100" : "opacity-0"}`}
        />

        {/* Coordinate tick marks */}
        <g
          stroke="#090A0A"
          strokeOpacity="0.18"
          strokeWidth="1"
          className={`transition-opacity duration-700 ${inView ? "opacity-100" : "opacity-0"}`}
        >
          <line x1="20" y1="20" x2="32" y2="20" />
          <line x1="20" y1="20" x2="20" y2="32" />
          <line x1="700" y1="20" x2="688" y2="20" />
          <line x1="700" y1="20" x2="700" y2="32" />
          <line x1="20" y1="510" x2="32" y2="510" />
          <line x1="20" y1="510" x2="20" y2="498" />
          <line x1="700" y1="510" x2="688" y2="510" />
          <line x1="700" y1="510" x2="700" y2="498" />
        </g>

        {/* 2. Edges Layer */}
        <g className="edges-layer">
          {edges.map((edge, idx) => {
            const isHovered = activeEdgeIds.includes(edge.id);
            const isDimmed =
              hoveredNode !== null && !activeEdgeIds.includes(edge.id);

            // Progressive drawing delay
            const delayMs = 250 + idx * 60;

            return (
              <g key={edge.id}>
                {/* Secondary background shadow for readability */}
                <path
                  d={edge.path}
                  fill="none"
                  stroke="#C7F36B"
                  strokeWidth={edge.isActivePath ? "5" : "3"}
                  strokeLinecap="round"
                  opacity={inView ? 0.9 : 0}
                />

                {/* Primary connection path */}
                <path
                  d={edge.path}
                  fill="none"
                  stroke={
                    edge.isActivePath
                      ? "#090A0A"
                      : isHovered
                      ? "#090A0A"
                      : "#090A0A"
                  }
                  strokeWidth={
                    edge.isActivePath ? "2.5" : isHovered ? "2" : "1.2"
                  }
                  strokeDasharray={edge.isActivePath ? undefined : "3 3"}
                  strokeOpacity={
                    isDimmed
                      ? 0.15
                      : edge.isActivePath
                      ? 0.95
                      : isHovered
                      ? 0.85
                      : 0.35
                  }
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: edge.length,
                    strokeDashoffset: inView ? 0 : edge.length,
                    transition: `stroke-dashoffset 850ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms, stroke-opacity 200ms ease`,
                  }}
                />
              </g>
            );
          })}
        </g>

        {/* 3. Traveling Signal Pulse along Active Path */}
        {inView && (
          <g
            transform={`translate(${pulse.x}, ${pulse.y})`}
            filter="url(#glow-pulse)"
            className="transition-transform duration-75 pointer-events-none"
          >
            <circle r="5" fill="#090A0A" />
            <circle r="2" fill="#C7F36B" />
          </g>
        )}

        {/* 4. Nodes Layer */}
        <g className="nodes-layer">
          {nodes.map((node) => {
            const isHovered = hoveredNode === node.id;
            const isConnected =
              hoveredNode !== null && connectedNodeIds.includes(node.id);
            const isDimmed = hoveredNode !== null && !isConnected;

            // Compute delay based on tier
            const delayMs = node.isOrigin
              ? 180
              : 350 + node.tier * 140;

            const halfW = node.width / 2;
            const halfH = node.height / 2;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                tabIndex={0}
                role="button"
                aria-label={`${node.name}: ${node.description}`}
                className="cursor-pointer focus:outline-none"
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView
                    ? `translate(${node.x}px, ${node.y}px) scale(${isHovered ? 1.05 : 1})`
                    : `translate(${node.x}px, ${node.y + 12}px) scale(0.92)`,
                  transition: `opacity 500ms ease ${delayMs}ms, transform 250ms cubic-bezier(0.22, 1, 0.36, 1)`,
                }}
              >
                {/* Node Outer Drop / Contrast Backdrop */}
                <rect
                  x={-halfW - 2}
                  y={-halfH - 2}
                  width={node.width + 4}
                  height={node.height + 4}
                  rx="6"
                  fill="#C7F36B"
                  opacity={node.isOrigin ? 0.9 : 0.6}
                />

                {/* Node Main Surface */}
                <rect
                  x={-halfW}
                  y={-halfH}
                  width={node.width}
                  height={node.height}
                  rx="4"
                  fill={node.isOrigin ? "#090A0A" : "#101211"}
                  stroke={
                    node.isOrigin
                      ? "#C7F36B"
                      : isHovered
                      ? "#090A0A"
                      : "#292E2A"
                  }
                  strokeWidth={node.isOrigin ? "2" : isHovered ? "1.5" : "1"}
                  className="transition-colors duration-200"
                  opacity={isDimmed ? 0.4 : 1}
                />

                {/* Origin MODIFIED Badge */}
                {node.isOrigin && (
                  <g transform={`translate(${-halfW + 10}, ${-halfH - 8})`}>
                    <rect
                      x="0"
                      y="0"
                      width="54"
                      height="14"
                      rx="2"
                      fill="#C7F36B"
                    />
                    <text
                      x="27"
                      y="10"
                      textAnchor="middle"
                      fill="#090A0A"
                      fontSize="8"
                      fontWeight="700"
                      fontFamily="monospace"
                      letterSpacing="0.06em"
                    >
                      MODIFIED
                    </text>
                  </g>
                )}

                {/* Node Status Dot */}
                <circle
                  cx={-halfW + 14}
                  cy="0"
                  r={node.isOrigin ? 3.5 : 2.5}
                  fill={node.isOrigin ? "#C7F36B" : isConnected ? "#79D69A" : "#A0A79F"}
                  className={node.isOrigin ? "animate-pulse" : ""}
                />

                {/* Node Label Text */}
                <text
                  x={-halfW + 24}
                  y="4"
                  fill={node.isOrigin ? "#F0F2ED" : "#E2E8F0"}
                  fontSize={node.isOrigin ? "12" : "10.5"}
                  fontWeight={node.isOrigin ? "700" : "500"}
                  fontFamily="monospace"
                  letterSpacing="-0.02em"
                  opacity={isDimmed ? 0.4 : 1}
                >
                  {node.name}
                </text>
              </g>
            );
          })}
        </g>

        {/* 5. Metrics & Impact Callout Labels (Bottom) */}
        <g
          className={`transition-opacity duration-700 delay-700 ${inView ? "opacity-100" : "opacity-0"}`}
        >
          {/* Direct dependencies metric */}
          <g transform="translate(48, 492)">
            <rect
              x="-6"
              y="-14"
              width="144"
              height="22"
              rx="3"
              fill="#090A0A"
              fillOpacity="0.08"
            />
            <circle cx="2" cy="-3" r="2.5" fill="#090A0A" />
            <text
              x="12"
              y="0"
              fill="#090A0A"
              fontSize="9"
              fontWeight="700"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              4 DIRECT DEPENDENCIES
            </text>
          </g>

          {/* Downstream metric */}
          <g transform="translate(260, 492)">
            <rect
              x="-6"
              y="-14"
              width="114"
              height="22"
              rx="3"
              fill="#090A0A"
              fillOpacity="0.08"
            />
            <circle cx="2" cy="-3" r="2.5" fill="#090A0A" />
            <text
              x="12"
              y="0"
              fill="#090A0A"
              fontSize="9"
              fontWeight="700"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              7 DOWNSTREAM
            </text>
          </g>

          {/* Test areas metric */}
          <g transform="translate(430, 492)">
            <rect
              x="-6"
              y="-14"
              width="110"
              height="22"
              rx="3"
              fill="#090A0A"
              fillOpacity="0.08"
            />
            <circle cx="2" cy="-3" r="2.5" fill="#090A0A" />
            <text
              x="12"
              y="0"
              fill="#090A0A"
              fontSize="9"
              fontWeight="700"
              fontFamily="monospace"
              letterSpacing="0.08em"
            >
              2 TEST AREAS
            </text>
          </g>

          {/* Active Path Legend Indicator */}
          <g transform="translate(585, 492)">
            <line x1="0" y1="-3" x2="20" y2="-3" stroke="#090A0A" strokeWidth="2" />
            <text
              x="26"
              y="0"
              fill="#090A0A"
              fontSize="8.5"
              fontWeight="700"
              fontFamily="monospace"
              letterSpacing="0.06em"
            >
              ACTIVE PATH
            </text>
          </g>
        </g>
      </svg>

      {/* Description caption below diagram */}
      <div className="mt-2 px-3 flex items-center justify-between text-[10px] font-mono text-[#090A0A]/75">
        <span className="truncate max-w-[420px]">
          {activeHoveredNodeData
            ? activeHoveredNodeData.description
            : "Hover nodes to inspect downstream impact & dependency relationships"}
        </span>
        <span className="shrink-0 text-[9px] uppercase tracking-wider font-semibold">
          Deterministic AST Graph
        </span>
      </div>
    </div>
  );
}

