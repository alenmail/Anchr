# Downloads and verifies Blender's unmodified Windows portable distribution.
# Blender remains a separately licensed GNU GPL application run as a child process.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$version = "4.5.15"
$base = "https://download.blender.org/release/Blender4.5"
$name = "blender-$version-windows-x64.zip"
$cache = Join-Path $env:RUNNER_TEMP $name
$checksum = Join-Path $env:RUNNER_TEMP "blender-$version.sha256"
$dest = Join-Path $PSScriptRoot "../vendor/blender-runtime"
New-Item -ItemType Directory -Force $dest | Out-Null
Write-Host "Downloading verified Blender $version portable ($name) for Anchr..."
Invoke-WebRequest "$base/$name" -OutFile $cache -MaximumRetryCount 3 -RetryIntervalSec 5
Invoke-WebRequest "$base/blender-$version.sha256" -OutFile $checksum -MaximumRetryCount 3 -RetryIntervalSec 5
$line = (Get-Content $checksum | Where-Object { $_ -match [regex]::Escape($name) } | Select-Object -First 1)
if (-not $line) { throw "Blender did not publish a SHA256 entry for $name" }
$expected = [regex]::Match($line, '[a-fA-F0-9]{64}').Value.ToUpperInvariant()
$actual = (Get-FileHash -Algorithm SHA256 $cache).Hash.ToUpperInvariant()
if ($expected -ne $actual) { throw "Blender archive SHA256 verification failed" }
Expand-Archive -LiteralPath $cache -DestinationPath $dest -Force
$exe = Get-ChildItem $dest -Filter blender.exe -Recurse | Select-Object -First 1
if (-not $exe) { throw "Blender executable not present in verified archive" }
if ($exe.Directory.FullName -ne (Resolve-Path $dest).Path) {
  Get-ChildItem -LiteralPath $exe.Directory.FullName | Move-Item -Destination $dest -Force
  Remove-Item $exe.Directory.FullName -Force -Recurse -ErrorAction SilentlyContinue
}
if (-not (Test-Path (Join-Path $dest "blender.exe"))) { throw "Blender packaging failed" }
& (Join-Path $dest "blender.exe") --background --factory-startup --python-expr 'import bpy; print("ANCHR_BLENDER_OK", bpy.app.version_string)'
if ($LASTEXITCODE -ne 0) { throw "Headless Blender smoke test failed" }
Write-Host "Bundled and verified Blender portable runtime."
