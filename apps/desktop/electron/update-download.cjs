/**
 * D3 — in-app update download (no electron-updater, no silent install).
 * Downloads a release .exe under userData/updates, then opens it for the user.
 */

const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const crypto = require("node:crypto");
const { net } = require("electron");

/**
 * @typedef {{
 *   status: "idle"|"downloading"|"completed"|"failed"|"cancelled",
 *   url: string|null,
 *   fileName: string|null,
 *   filePath: string|null,
 *   bytesReceived: number,
 *   bytesTotal: number|null,
 *   percent: number|null,
 *   error: string|null,
 *   startedAt: string|null,
 *   finishedAt: string|null,
 *   sha256: string|null,
 * }} DownloadState
 */

/** @returns {DownloadState} */
function emptyState() {
  return {
    status: "idle",
    url: null,
    fileName: null,
    filePath: null,
    bytesReceived: 0,
    bytesTotal: null,
    percent: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    sha256: null,
  };
}

class UpdateDownloader {
  /**
   * @param {{
   *   updatesDir: string,
   *   broadcast: (channel: string, payload: unknown) => void,
   *   assertUrl: (url: string) => URL,
   *   sanitizeName: (name: string) => string,
   *   maxBytes?: number,
   * }} opts
   */
  constructor(opts) {
    this.updatesDir = opts.updatesDir;
    this.broadcast = opts.broadcast;
    this.assertUrl = opts.assertUrl;
    this.sanitizeName = opts.sanitizeName;
    this.maxBytes = opts.maxBytes ?? 600 * 1024 * 1024;
    /** @type {DownloadState} */
    this.state = emptyState();
    /** @type {import('electron').ClientRequest | null} */
    this._request = null;
    /** @type {import('node:fs').WriteStream | null} */
    this._stream = null;
    this._aborting = false;
  }

  getState() {
    return { ...this.state };
  }

  /**
   * @param {{ url: string, fileName?: string, expectedSize?: number }} payload
   */
  async start(payload) {
    if (this.state.status === "downloading") {
      throw new Error("download already in progress");
    }
    const urlObj = this.assertUrl(String(payload.url || ""));
    const url = urlObj.toString();
    const fileName = this.sanitizeName(
      payload.fileName || path.basename(urlObj.pathname) || "HFQ-Code-update.exe",
    );
    await fsp.mkdir(this.updatesDir, { recursive: true });
    const filePath = path.join(this.updatesDir, fileName);
    // Clear previous partial
    try {
      await fsp.unlink(filePath);
    } catch {
      /* ignore */
    }

    this._aborting = false;
    this.state = {
      status: "downloading",
      url,
      fileName,
      filePath,
      bytesReceived: 0,
      bytesTotal:
        payload.expectedSize && Number(payload.expectedSize) > 0
          ? Number(payload.expectedSize)
          : null,
      percent: null,
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      sha256: null,
    };
    this._emit();

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createWriteStream(filePath);
      this._stream = stream;
      let settled = false;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        this._cleanupRequest();
        try {
          stream.destroy();
        } catch {
          /* ignore */
        }
        const msg = err instanceof Error ? err.message : String(err);
        this.state = {
          ...this.state,
          status: this._aborting ? "cancelled" : "failed",
          error: msg,
          finishedAt: new Date().toISOString(),
        };
        this._emit();
        fsp.unlink(filePath).catch(() => {});
        if (this._aborting) {
          resolve(this.getState());
        } else {
          reject(err instanceof Error ? err : new Error(msg));
        }
      };

      const finishOk = () => {
        if (settled) return;
        settled = true;
        this._cleanupRequest();
        const sha256 = hash.digest("hex");
        this.state = {
          ...this.state,
          status: "completed",
          percent: 100,
          sha256,
          finishedAt: new Date().toISOString(),
          error: null,
        };
        this._emit();
        resolve(this.getState());
      };

      stream.on("error", fail);

      const request = net.request({
        method: "GET",
        url,
        redirect: "follow",
      });
      this._request = request;
      request.setHeader(
        "User-Agent",
        `HFQ-Code-Updater/${process.env.npm_package_version || "desktop"}`,
      );
      request.setHeader("Accept", "application/octet-stream,*/*");

      request.on("response", (response) => {
        const status = response.statusCode || 0;
        if (status < 200 || status >= 300) {
          fail(new Error(`download HTTP ${status}`));
          return;
        }
        const lenHeader = response.headers["content-length"];
        const lenRaw = Array.isArray(lenHeader) ? lenHeader[0] : lenHeader;
        if (lenRaw != null && Number(lenRaw) > 0) {
          this.state.bytesTotal = Number(lenRaw);
        }
        if (this.state.bytesTotal != null && this.state.bytesTotal > this.maxBytes) {
          fail(new Error(`installer too large (>${this.maxBytes} bytes)`));
          return;
        }

        response.on("data", (chunk) => {
          if (this._aborting) return;
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          this.state.bytesReceived += buf.length;
          if (this.state.bytesReceived > this.maxBytes) {
            fail(new Error(`installer too large (>${this.maxBytes} bytes)`));
            return;
          }
          hash.update(buf);
          stream.write(buf);
          if (this.state.bytesTotal && this.state.bytesTotal > 0) {
            this.state.percent = Math.min(
              99,
              Math.floor((this.state.bytesReceived / this.state.bytesTotal) * 100),
            );
          } else {
            this.state.percent = null;
          }
          this._emitProgress();
        });
        response.on("end", () => {
          if (this._aborting) {
            fail(new Error("cancelled"));
            return;
          }
          stream.end(() => finishOk());
        });
        response.on("error", fail);
      });
      request.on("error", fail);
      request.end();
    });
  }

  cancel() {
    if (this.state.status !== "downloading") {
      return this.getState();
    }
    this._aborting = true;
    try {
      this._request?.abort();
    } catch {
      /* ignore */
    }
    try {
      this._stream?.destroy();
    } catch {
      /* ignore */
    }
    this.state = {
      ...this.state,
      status: "cancelled",
      error: "cancelled",
      finishedAt: new Date().toISOString(),
    };
    this._emit();
    if (this.state.filePath) {
      fsp.unlink(this.state.filePath).catch(() => {});
    }
    this._cleanupRequest();
    return this.getState();
  }

  _cleanupRequest() {
    this._request = null;
    this._stream = null;
  }

  _emit() {
    this.broadcast("update:download", this.getState());
  }

  _lastProgressAt = 0;
  _emitProgress() {
    const now = Date.now();
    // Throttle progress events ~8/s
    if (now - this._lastProgressAt < 120) return;
    this._lastProgressAt = now;
    this.broadcast("update:download", this.getState());
  }
}

module.exports = { UpdateDownloader, emptyState };
