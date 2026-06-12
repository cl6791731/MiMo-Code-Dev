import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const getBase = (): Configuration => ({
  artifactName: "mimocode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  files: ["out/**/*", "resources/**/*"],
  extraResources: [
    {
      from: "../opencode/dist/mimocode-darwin-arm64/bin/mimo",
      to: "bin/mimo",
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: [
      {
        target: "dmg",
        arch: ["x64", "arm64"],
      },
      {
        target: "zip",
        arch: ["x64", "arm64"],
      },
    ],
  },
  dmg: {
    sign: true,
    contents: [
      { x: 130, y: 220 },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
  },
  protocols: {
    name: "MiMo Code",
    schemes: ["mimocode"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const base = getBase()

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId: "ai.mimocode.desktop.dev",
        productName: "MiMo Code Dev",
        rpm: { packageName: "mimocode-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId: "ai.mimocode.desktop.beta",
        productName: "MiMo Code Beta",
        protocols: { name: "MiMo Code Beta", schemes: ["mimocode"] },
        publish: { provider: "github", owner: "cl6791731", repo: "MiMo-Code-Dev", channel: "latest" },
        rpm: { packageName: "mimocode-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId: "ai.mimocode.desktop",
        productName: "MiMo Code Dev",
        protocols: { name: "MiMo Code", schemes: ["mimocode"] },
        publish: { provider: "github", owner: "cl6791731", repo: "MiMo-Code-Dev", channel: "latest" },
        rpm: { packageName: "mimocode-dev" },
      }
    }
  }
}

export default getConfig()
