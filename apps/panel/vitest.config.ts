import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    setupFiles: ["tests/setup-ws.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: [...configDefaults.exclude, "tests/rls/**"],
        },
      },
      {
        // Gerçek yerel Supabase'e giden testler: CI'da lint/typecheck yükü altında zaman aşımı olmasın,
        // dosyalar ortak DB'de sırayla çalışsın.
        extends: true,
        test: {
          name: "rls",
          include: ["tests/rls/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
