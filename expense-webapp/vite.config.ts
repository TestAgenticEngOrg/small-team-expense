import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mockMode } from "./mock/plugin";

// No `base` — served at host root (react-webapp).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === "mock" ? [mockMode()] : [])],
}));
