import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  workers: 1,
  timeout: 45000,
  outputDir: ".qa/test-results",
  use: {
    baseURL:
      process.env.GALLERY_TEST_URL || "http://127.0.0.1:5178/umbral-gallery/",
    launchOptions: {
      executablePath: process.env.CHROME_PATH || undefined,
      args: ["--enable-unsafe-swiftshader"],
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 950 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
