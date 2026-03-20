import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import path from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const shouldAnalyze = env.ANALYZE === "true";
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3000";

  return {
    plugins: [
      react(),
      tailwindcss(),
      shouldAnalyze &&
        visualizer({
          filename: "dist/stats.html",
          gzipSize: true,
          brotliSize: true,
          open: false,
        }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        "/img": {
          target: "http://localhost:9000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/img/, ""),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }

            if (id.includes("echarts")) {
              return "vendor-echarts";
            }

            if (
              id.includes("react") ||
              id.includes("scheduler") ||
              id.includes("react-router")
            ) {
              return "vendor-react";
            }

            if (id.includes("@tanstack/react-query")) {
              return "vendor-query";
            }

            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
          },
        },
      },
    },
  };
});
