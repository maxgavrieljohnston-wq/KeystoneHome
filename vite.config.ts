// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

// Force every `entities` import (and its deep paths) to resolve to the
// hoisted v4.5.0 copy. Some transitive deps install entities v7 nested,
// which removed ./lib/decode.js and breaks SSR rendering of email templates.
const entitiesRoot = path.resolve(process.cwd(), "node_modules/entities");

export default defineConfig({
  vite: {
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(entitiesRoot, "lib/decode.js"),
        "entities/lib/encode.js": path.resolve(entitiesRoot, "lib/encode.js"),
        entities: entitiesRoot,
      },
    },
  },
});
