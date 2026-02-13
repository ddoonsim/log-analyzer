"use client";

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
  return (
    <div className="flex flex-wrap gap-2 px-2">
      {questions.map((q) => {
        const Icon = q.icon;
        return (
          <button
            key={q.text}
            type="button"
            onClick={() => onSelect(q.text)}
            className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/15 hover:border-primary/50"
          >
            <Icon className="h-3.5 w-3.5" />
            {q.text}
          </button>
        );
      })}
    </div>
  );
}
