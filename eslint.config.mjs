// eslint-config-next@16 ships native flat configs (no FlatCompat needed).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const config = [
  {
    ignores: [
      "docs/**",
      "TrendTrack/**",
      "playwright-report/**",
      "coverage/**",
      "src/generated/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  // R2: the base Prisma client is banned outside src/server/db. Application code
  // must use the tenant-scoped client from @/server/db/tenant (tenant models) or
  // the focused helpers in @/server/db/identity (identity models) instead.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/server/db/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/client"],
              message:
                "Importing the base Prisma client is forbidden outside src/server/db (R2). Use the tenant-scoped client from @/server/db/tenant or the identity helpers from @/server/db/identity instead.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
];

export default config;
