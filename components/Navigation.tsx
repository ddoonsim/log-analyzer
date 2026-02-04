"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSearch, PlusCircle, History, Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

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

          {/* 네비게이션 메뉴 + 테마 토글 */}
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

            {/* 테마 토글 버튼 */}
            <button
              onClick={toggleTheme}
              className="ml-2 flex items-center justify-center rounded-lg p-2 text-muted transition-colors hover:bg-card hover:text-foreground"
              aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
