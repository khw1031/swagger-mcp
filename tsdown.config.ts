import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: ["esm"],
  clean: true,
  target: "node18",
  banner: "#!/usr/bin/env node",
  minify: true,
});
