"use client";

import { useState } from "react";
import { MessageCircleQuestion, ListChecks, ShieldCheck, FileText } from "lucide-react";

interface QuickQuestionsProps {
  onSelect: (question: string) => void;
}

const questions = [
  { text: "이 에러 더 자세히 설명해줘", icon: MessageCircleQuestion },
  { text: "해결 방법 단계별로 알려줘", icon: ListChecks },
  { text: "비슷한 이슈 예방하려면?", icon: ShieldCheck },
  { text: "관련 문서 있어?", icon: FileText },
];

export default function QuickQuestions({ onSelect }: QuickQuestionsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-wrap gap-2 px-2">
      {questions.map((q, index) => {
        const Icon = q.icon;
        const isHovered = hoveredIndex === index;
        return (
          <button
            key={q.text}
            type="button"
            onClick={() => onSelect(q.text)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
            style={{
              backgroundColor: isHovered
                ? "var(--quick-btn-hover-bg)"
                : "var(--quick-btn-bg)",
              color: isHovered
                ? "var(--quick-btn-hover-text)"
                : "var(--quick-btn-text)",
              border: "1px solid var(--quick-btn-border)",
              transition: "background-color 0.2s, color 0.2s",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
            {q.text}
          </button>
        );
      })}
    </div>
  );
}
