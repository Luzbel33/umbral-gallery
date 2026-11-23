import { defineConfig, loadEnv } from "vite";
export default defineConfig(({ mode }) => {
  const configured =
    loadEnv(mode, process.cwd()).VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "https://mlmhtoejxkoczykvahlh.supabase.co";
  const api = new URL(configured).origin,
    ws = api.replace(/^http/, "ws");
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: " + api,
    "media-src 'self' blob: " + api,
    "connect-src 'self' blob: " + api + " " + ws,
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    base: process.env.BASE_PATH || "/umbral-gallery/",
    build: { chunkSizeWarningLimit: 650 },
    plugins: [
      {
        name: "gallery-content-policy",
        apply: "build",
        transformIndexHtml() {
          return [
            {
              tag: "meta",
              attrs: {
                "http-equiv": "Content-Security-Policy",
                content: policy,
              },
              injectTo: "head-prepend",
            },
          ];
        },
      },
    ],
  };
});
