
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In local development the same routing as nginx: auth paths -> auth service,
// everything else under /api -> core service. Run with VITE_API_BASE_URL=/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "localhost",
    port: 3000,
    strictPort: true,
    proxy: {
      "^/api/v1/(auth|internal|users)(/|$)": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
