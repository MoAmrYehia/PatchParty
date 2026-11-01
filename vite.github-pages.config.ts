import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./github-pages", import.meta.url)),
  base: "/PatchParty/",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  define: { "import.meta.env.VITE_GITHUB_PAGES": JSON.stringify("true") },
  build: {
    outDir: fileURLToPath(new URL("./dist/github-pages", import.meta.url)),
    emptyOutDir: true,
  },
});
