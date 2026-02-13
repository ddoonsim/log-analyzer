"use client";

import ThemeProvider from "./ThemeProvider";
import Navigation from "./Navigation";
import KeyboardShortcuts from "./KeyboardShortcuts";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <KeyboardShortcuts />
      <div className="flex min-h-screen flex-col">
        <Navigation />
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-4 py-8">
            {children}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
