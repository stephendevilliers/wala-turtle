import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/components/wala-turtle.ts",
      name: "WalaTurtle",
      fileName: "wala-turtle",
      formats: ["iife"],
    },
    outDir: "public",
    emptyOutDir: false,
    rollupOptions: {
      output: {
        entryFileNames: "wala-turtle.js",
      },
    },
  },
});
