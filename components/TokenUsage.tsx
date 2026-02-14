"use client";

import { Coins } from "lucide-react";

interface TokenUsageProps {
  inputTokens: number;
  outputTokens: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function calculateCost(inputTokens: number, outputTokens: number): string {
  // Claude Sonnet 4: Input $3/1M, Output $15/1M
  const cost = (inputTokens * 3 + outputTokens * 15) / 1_000_000;
  if (cost < 0.001) return "< $0.001";
  return `$${cost.toFixed(3)}`;
}

export default function TokenUsage({
  inputTokens,
  outputTokens,
}: TokenUsageProps) {
  const totalTokens = inputTokens + outputTokens;

  if (totalTokens === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted">
      <Coins className="h-3.5 w-3.5 shrink-0" />
      <span>
        입력 <strong className="text-foreground">{formatNumber(inputTokens)}</strong>
      </span>
      <span className="text-border">|</span>
      <span>
        출력 <strong className="text-foreground">{formatNumber(outputTokens)}</strong>
      </span>
      <span className="text-border">|</span>
      <span>
        비용 <strong className="text-foreground">{calculateCost(inputTokens, outputTokens)}</strong>
      </span>
    </div>
  );
}
