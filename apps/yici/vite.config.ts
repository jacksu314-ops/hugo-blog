import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/hugo-blog/yici/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});
