import { defineConfig } from "electron-vite"
import appPlugin from "@mimo-ai/app/vite"
import * as fs from "node:fs/promises"

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const OPENCODE_SERVER_DIST = "../opencode/dist/node"

const nodePtyPkg = `@lydell/node-pty-${process.platform}-${process.arch}`

export default defineConfig({
  main: {
    define: {
      "import.meta.env.OPENCODE_CHANNEL": JSON.stringify(channel),
    },
    build: {
      rollupOptions: {
        input: { index: "src/main/index.ts" },
        external: (id) => {
          // Externalize all node builtins and electron dependencies
          if (id.startsWith("node:")) return true
          if (id.startsWith("electron")) return true
          if (id.includes("electron-log")) return true
          if (id.includes("electron-store")) return true
          if (id.includes("electron-updater")) return true
          if (id.includes("electron-window-state")) return true
          if (id.includes("electron-context-menu")) return true
          if (id.includes("@lydell/node-pty")) return true
          if (id.includes("drizzle-orm")) return true
          if (id.includes("marked")) return true
          return false
        },
      },
      externalizeDeps: { include: [nodePtyPkg] },
    },
    plugins: [
      {
        name: "opencode:node-pty-narrower",
        enforce: "pre",
        resolveId(s) {
          if (s === "@lydell/node-pty") return nodePtyPkg
        },
      },
    ],
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: "src/preload/index.ts" },
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    plugins: [appPlugin],
    publicDir: "../../../app/public",
    root: "src/renderer",
    define: {
      "import.meta.env.VITE_OPENCODE_CHANNEL": JSON.stringify(channel),
    },
    build: {
      rollupOptions: {
        input: {
          main: "src/renderer/index.html",
          loading: "src/renderer/loading.html",
        },
      },
    },
  },
})
