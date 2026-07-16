param(
  [Parameter(Mandatory=$true)][string]$File,
  [string]$Description
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Pfx = Join-Path (Join-Path $Root "output") "root.pfx"
$PwdFile = Join-Path (Join-Path $Root "output") "pfx.password"
$SignTool = Join-Path (Join-Path $Root "tools") "signtool.exe"
if (-not $Description) { $Description = [IO.Path]::GetFileNameWithoutExtension($File) }
if (-not (Test-Path -LiteralPath $File)) { throw "File not found: $File" }
if (-not (Test-Path -LiteralPath $Pfx)) { throw "PFX not found: $Pfx" }
if (-not (Test-Path -LiteralPath $PwdFile)) { throw "Password file missing: $PwdFile" }
if (-not (Test-Path -LiteralPath $SignTool)) {
  $found = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($found) { $SignTool = $found.Source } else { throw "signtool not found: $SignTool" }
}
$Password = (Get-Content -LiteralPath $PwdFile -Raw).Trim()
Write-Host "Signing $File as HFQ-ClodBreeze ..."
# call operator + array so /d description with spaces is not split
$base = @("sign","/f",$Pfx,"/p",$Password,"/fd","SHA256","/d",$Description,"/v",$File)
$withTs = @("sign","/f",$Pfx,"/p",$Password,"/fd","SHA256","/tr","http://timestamp.digicert.com","/td","SHA256","/d",$Description,"/v",$File)
& $SignTool @withTs
$exit = $LASTEXITCODE
if ($exit -ne 0) {
  Write-Host "Timestamp failed, retry without timestamp..."
  & $SignTool @base
  $exit = $LASTEXITCODE
}
if ($exit -ne 0) { throw "Sign failed: $exit" }
& $SignTool verify /pa /v $File
if ($LASTEXITCODE -ne 0) {
  Write-Host "[TIP] Verify may fail if root not trusted. Signature may still be present."
} else {
  Write-Host "[OK] Signature verified."
}
Write-Host "Done."
