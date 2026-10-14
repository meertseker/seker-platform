import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Next 16 / react-hooks v7 yeni kuralı: AttributionFields, CookieBanner ve Header'daki
    // bilinçli hydration-sonrası setState kalıplarını işaretliyor; Faz 0 kapsamı dışı, uyarı olarak tutuluyor.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public-originals-backup/**", "photos/**"]),
]);

export default eslintConfig;
