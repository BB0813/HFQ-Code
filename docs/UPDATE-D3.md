# D3 — In-app update download

Status: **shipped (backend)** · 2026-07-16  
Policy: installers may be **self-signed (HFQ-ClodBreeze)** when release CI has signing secrets — see [PACKAGING.md](./PACKAGING.md). SmartScreen may still warn for new publishers.

## Product behavior

| Step | Behavior |
|------|----------|
| Check | Existing `update:check` (multi-source: ghproxy → ungh → direct) |
| Download | User-initiated only; file under `%APPDATA%/HFQ-Code/updates/` |
| Install | Opens `.exe` with OS; **confirmation dialog** by default (not silent) |
| Auto | Startup still only **notifies** when newer (`update:available`) — never auto-downloads |

## Why not electron-updater

- Avoids native Squirrel/NSIS auto-replace complexity without a cert  
- Reuses existing release JSON + mirror chain  
- Clear security boundary: allowlisted HTTPS hosts, size cap, path sandbox under `updates/`

## IPC (`window.hfq`)

```js
const check = await hfq.checkForUpdates({ force: true });
// check.recommendedAsset: { name, url, mirrorUrl?, size } | null
// check.assets: [...]

const off = hfq.onUpdateDownload((st) => {
  // st.status: idle|downloading|completed|failed|cancelled
  // st.percent, bytesReceived, bytesTotal, filePath, sha256, error
});

// A) auto-pick recommended installer
await hfq.downloadUpdate({});

// B) explicit asset
await hfq.downloadUpdate({
  url: check.recommendedAsset.mirrorUrl || check.recommendedAsset.url,
  fileName: check.recommendedAsset.name,
  expectedSize: check.recommendedAsset.size,
});

await hfq.getUpdateDownloadStatus();
await hfq.cancelUpdateDownload();

// Opens installer (native confirm unless confirm:false)
await hfq.installUpdate({});
// → { ok, filePath, quitSuggested?, cancelled? }

await hfq.clearUpdateDownloads();
await hfq.revealInFolder({ path: filePath }); // optional
off();
```

### Channels

| Invoke | Event |
|--------|--------|
| `update:download` | `update:download` progress |
| `update:downloadCancel` | |
| `update:downloadStatus` | |
| `update:install` | |
| `update:clearDownloads` | |

## Security

- HTTPS only  
- Host allowlist (GitHub + known mirrors + `*.githubusercontent.com`)  
- File written only under `userData/updates`  
- Install only opens paths inside that directory ending in `.exe`  
- Max size ~600 MB  
- No `quitAndInstall` force; UI may suggest quit after open  

## Frontend wiring (Settings)

1. After check with `updateAvailable` → toast「发现新版本，可下载安装」  
2. **下载更新** → `downloadUpdate({})` + `onUpdateDownload` progress  
3. **安装更新** → `installUpdate({})`  
   - If local installer exists (memory or `%APPDATA%/HFQ-Code/updates/*.exe`) → confirm → open  
   - If missing → **auto download** recommended asset, then confirm → open (`autoDownload: false` disables)  
4. Keep **打开发布页** fallback (`openReleasePage`)  
5. Copy: 安装包使用自签发布者 **HFQ-ClodBreeze**；首次安装可能导入信任并仍可能出现 SmartScreen  

### Errors (Chinese, fail-closed)

| Condition | Message |
|-----------|---------|
| No file + `autoDownload: false` | 尚未下载安装包，请先点「下载更新」 |
| Auto-download fails | 自动下载安装包失败：… |
| Already latest on install | 当前已是最新版本，无需安装 |
| Concurrent download | 正在下载安装包，请稍候完成后再安装 |

## Tests

- `packages/shared/src/update-assets.test.ts` — pick asset / host allowlist / filename sanitize  

## Related

- [FRONTEND-IPC.md](./FRONTEND-IPC.md)  
- [PACKAGING.md](./PACKAGING.md) — release channel still GitHub Releases  
