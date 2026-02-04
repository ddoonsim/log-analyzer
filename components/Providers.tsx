"use client";

import ThemeProvider from "./ThemeProvider";
import Navigation from "./Navigation";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
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
