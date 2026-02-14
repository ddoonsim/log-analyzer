-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "systemInfo" TEXT NOT NULL,
    "summary" TEXT,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Session" ("createdAt", "id", "issueCount", "summary", "systemInfo", "title", "updatedAt") SELECT "createdAt", "id", "issueCount", "summary", "systemInfo", "title", "updatedAt" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
