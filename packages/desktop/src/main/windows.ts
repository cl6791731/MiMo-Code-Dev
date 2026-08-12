import windowState from "electron-window-state"
import { app, BrowserWindow, nativeImage, nativeTheme, protocol } from "electron"
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"
import log from "electron-log/main.js"
import type { TitlebarTheme } from "../preload/types"

const root = dirname(fileURLToPath(import.meta.url))
const rendererRoot = join(root, "../renderer")
const rendererProtocol = "oc"
const rendererHost = "renderer"

protocol.registerSchemesAsPrivileged([
  {
    scheme: rendererProtocol,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
    },
  },
])

let backgroundColor: string | undefined

export function setBackgroundColor(color: string) {
  backgroundColor = color
}

export function getBackgroundColor(): string | undefined {
  return backgroundColor
}

function iconsDir() {
  return app.isPackaged ? join(process.resourcesPath, "icons") : join(root, "../../resources/icons")
}

function iconPath() {
  const ext = process.platform === "win32" ? "ico" : "png"
  return join(iconsDir(), `icon.${ext}`)
}

function tone() {
  return nativeTheme.shouldUseDarkColors ? "dark" : "light"
}

function overlay(theme: Partial<TitlebarTheme> = {}) {
  const mode = theme.mode ?? tone()
  return {
    color: "#00000000",
    symbolColor: mode === "dark" ? "white" : "black",
    height: 40,
  }
}

export function setTitlebar(win: BrowserWindow, theme: Partial<TitlebarTheme> = {}) {
  if (process.platform !== "win32") return
  win.setTitleBarOverlay(overlay(theme))
}

export function setDockIcon() {
  if (process.platform !== "darwin") return
  const icon = nativeImage.createFromPath(join(iconsDir(), "dock.png"))
  if (!icon.isEmpty()) app.dock?.setIcon(icon)
}

export function createMainWindow() {
  const state = windowState({
    defaultWidth: 1280,
    defaultHeight: 800,
  })

  const mode = tone()
  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    show: false,
    title: "MiMoCode",
    icon: iconPath(),
    backgroundColor,
    ...(process.platform === "darwin"
      ? {
          titleBarStyle: "hidden" as const,
          trafficLightPosition: { x: 12, y: 14 },
        }
      : {}),
    ...(process.platform === "win32"
      ? {
          frame: false,
          titleBarStyle: "hidden" as const,
          titleBarOverlay: overlay({ mode }),
        }
      : {}),
    webPreferences: {
      preload: join(root, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders } = details
    upsertKeyValue(requestHeaders, "Access-Control-Allow-Origin", ["*"])
    callback({ requestHeaders })
  })

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders = {} } = details
    upsertKeyValue(responseHeaders, "Access-Control-Allow-Origin", ["*"])
    upsertKeyValue(responseHeaders, "Access-Control-Allow-Headers", ["*"])
    callback({ responseHeaders })
  })

  state.manage(win)
  loadWindow(win, "index.html")
  wireZoom(win)

  win.once("ready-to-show", () => {
    win.show()
  })

  return win
}

export function createLoadingWindow() {
  const mode = tone()
  const win = new BrowserWindow({
    width: 640,
    height: 480,
    resizable: false,
    center: true,
    show: true,
    icon: iconPath(),
    backgroundColor,
    ...(process.platform === "darwin" ? { titleBarStyle: "hidden" as const } : {}),
    ...(process.platform === "win32"
      ? {
          frame: false,
          titleBarStyle: "hidden" as const,
          titleBarOverlay: overlay({ mode }),
        }
      : {}),
    webPreferences: {
      preload: join(root, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  loadWindow(win, "loading.html")

  return win
}

export function registerRendererProtocol() {
  if (protocol.isProtocolHandled(rendererProtocol)) return

  protocol.handle(rendererProtocol, async (request) => {
    const url = new URL(request.url)
    if (url.host !== rendererHost) {
      return new Response("Not found", { status: 404 })
    }

    const file = resolve(rendererRoot, `.${decodeURIComponent(url.pathname)}`)
    const rel = relative(rendererRoot, file)
    if (rel.startsWith("..") || isAbsolute(rel)) {
      return new Response("Not found", { status: 404 })
    }

    try {
      // Read through fs so asar archives are resolved (net.fetch does not go
      // through Electron's asar patch and fails to serve packaged renderer).
      const data = await readFile(file)
      const mime = mimeType(extname(file))
      // Wrap in Uint8Array so `Buffer<ArrayBufferLike>` satisfies BodyInit.
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": mime,
          // Module scripts loaded with `crossorigin` require CORS headers on
          // custom protocol responses, otherwise Chromium silently drops them
          // and the renderer stays blank.
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        },
      })
    } catch {
      return new Response("Not found", { status: 404 })
    }
  })
}

function mimeType(ext: string): string {
  switch (ext) {
    case ".html":
      return "text/html"
    case ".js":
    case ".mjs":
      return "text/javascript"
    case ".css":
      return "text/css"
    case ".json":
      return "application/json"
    case ".svg":
      return "image/svg+xml"
    case ".png":
      return "image/png"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".gif":
      return "image/gif"
    case ".ico":
      return "image/x-icon"
    case ".woff":
      return "font/woff"
    case ".woff2":
      return "font/woff2"
    case ".wasm":
      return "application/wasm"
    default:
      return "application/octet-stream"
  }
}

function loadWindow(win: BrowserWindow, html: string) {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    const url = new URL(html, devUrl)
    void win.loadURL(url.toString())
    return
  }

  win.webContents.on("did-finish-load", () => {
    log.info("[renderer] did-finish-load", html)
    void win.webContents.executeJavaScript(
      `new Promise(resolve => setTimeout(() => {
        const root = document.getElementById('root')
        resolve({
          title: document.title,
          readyState: document.readyState,
          bodyHtml: (document.body ? document.body.innerHTML : '').slice(0, 400),
          rootChildren: root ? root.childElementCount : -1,
          resources: performance.getEntriesByType('resource').map(r => r.name.slice(0, 110)),
        })
      }, 3000))`,
      true,
    ).then((r: any) => log.info("[renderer:dom]", JSON.stringify(r))).catch((e: any) => log.error("[renderer:dom] failed", String(e)))
  })
  win.webContents.on("did-fail-load", (_event, code, desc, url) => {
    log.error("[renderer] did-fail-load", code, desc, url)
  })
  // `render-process-gone` exists at runtime on WebContents but is missing from
  // the Electron 41 type-definition overloads, so pin it through `any`.
  ;(win.webContents as any).on("render-process-gone", (_event: any, _webContents: any, details: any) => {
    log.error("[renderer] render-process-gone", JSON.stringify(details))
  })
  // Electron >= 32 passes a MessageDetails object as the second argument, but
  // the type definitions also carry the legacy (level, message) overload, so
  // pin the listener parameters to the runtime shape.
  win.webContents.on("console-message", (_event: Electron.Event, details: any) => {
    if (details.level >= 2) log.info("[renderer:console]", details.message)
  })

  void win.loadURL(`${rendererProtocol}://${rendererHost}/${html}`)
}
function wireZoom(win: BrowserWindow) {
  win.webContents.setZoomFactor(1)
  win.webContents.on("zoom-changed", () => {
    win.webContents.setZoomFactor(1)
  })
}

function upsertKeyValue(obj: Record<string, any>, keyToChange: string, value: any) {
  const keyToChangeLower = keyToChange.toLowerCase()
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === keyToChangeLower) {
      // Reassign old key
      obj[key] = value
      // Done
      return
    }
  }
  // Insert at end instead
  obj[keyToChange] = value
}
