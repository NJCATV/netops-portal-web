import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "/",
  plugins: [vue()],
  server: {
    proxy: {
      "/wx/api": {
        target: "https://anbo.njcatv.net:5772",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
