"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  threshold?: number;
}

export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
  threshold = 0.12,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.classList.add("revealed");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delayMs > 0) {
            const timer = setTimeout(() => {
              element.classList.add("revealed");
            }, delayMs);
            return () => clearTimeout(timer);
          } else {
            element.classList.add("revealed");
          }
          observer.unobserve(element);
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [delayMs, threshold]);

  return (
    <div
      ref={ref}
      className={`reveal-init ${className}`}
      style={{
        transitionDelay: delayMs > 0 ? `${delayMs}ms` : undefined,
      }}
    >
      {children}
    </div>
  );
}
