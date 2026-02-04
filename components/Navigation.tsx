"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSearch, PlusCircle, History } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "새 분석", icon: PlusCircle },
    { href: "/history", label: "히스토리", icon: History },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto max-w-4xl px-4">
        <div className="flex h-14 items-center justify-between">
          {/* 로고 */}
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FileSearch className="h-5 w-5 text-primary" />
            <span>Log Analyzer</span>
          </Link>

          {/* 네비게이션 메뉴 */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted hover:bg-card hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
