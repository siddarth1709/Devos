"use client";

import Image from "next/image";

interface DevosLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showMark?: boolean;
  showWordmark?: boolean;
  priority?: boolean;
}

export function DevosLogo({
  className = "",
  size = "md",
  showMark = true,
  showWordmark = true,
  priority = false,
}: DevosLogoProps) {
  // Dimensions tailored to industrial proportions
  const dimensions = {
    sm: { mark: 22, wordmarkHeight: 16, wordmarkWidth: 83, gap: "gap-2" },
    md: { mark: 26, wordmarkHeight: 19, wordmarkWidth: 98, gap: "gap-2.5" },
    lg: { mark: 32, wordmarkHeight: 23, wordmarkWidth: 119, gap: "gap-3" },
  }[size];

  return (
    <span className={`inline-flex items-center ${dimensions.gap} select-none ${className}`}>
      {showMark && (
        <Image
          src="/brand/devos-mark.png"
          alt="DEVOS icon"
          width={dimensions.mark}
          height={dimensions.mark}
          className="object-contain shrink-0 transition-transform duration-300 group-hover:scale-105"
          priority={priority}
        />
      )}
      {showWordmark && (
        <Image
          src="/brand/devos-wordmark.png"
          alt="DEVOS"
          width={dimensions.wordmarkWidth}
          height={dimensions.wordmarkHeight}
          style={{ height: `${dimensions.wordmarkHeight}px`, width: "auto" }}
          className="object-contain shrink-0"
          priority={priority}
        />
      )}
    </span>
  );
}

