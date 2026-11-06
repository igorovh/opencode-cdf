# Prepares a throwaway OpenCode for docs/demo.tape: fake home, config, state and sample projects.
# Dot-source it (`. ./docs/demo-setup.ps1`) so the variables stay set for the opencode command.
$ErrorActionPreference = "Stop"
$opencode = if ($env:OPENCODE_BIN) { $env:OPENCODE_BIN } else { "opencode" }
$root = Join-Path ([IO.Path]::GetTempPath()) "cdf-demo"
Remove-Item -Recurse -Force (Join-Path $root "home"), (Join-Path $root "config"), (Join-Path $root "data"), (Join-Path $root "state") -ErrorAction SilentlyContinue

$demoHome = Join-Path $root "home"
foreach ($dir in "demo/acme-api", "demo/acme-web", "demo/billing", "demo/docs-site", "dotfiles") {
  New-Item -ItemType Directory -Force (Join-Path $demoHome $dir) | Out-Null
}
$demoHome = (Resolve-Path $demoHome).Path

$env:HOME = $demoHome
$env:USERPROFILE = $demoHome
$env:XDG_CONFIG_HOME = Join-Path $root "config"
$env:XDG_DATA_HOME = Join-Path $root "data"
$env:XDG_STATE_HOME = Join-Path $root "state"
# The cache only holds the downloaded plugin, so it survives between recordings.
$env:XDG_CACHE_HOME = Join-Path $root "cache"

& $opencode plugin add github:igorovh/opencode-cdf#v0.2.1 | Out-Null

$projects = @(
  @{ name = "acme-api"; path = "demo/acme-api"; favorite = $true },
  @{ name = "acme-web"; path = "demo/acme-web"; favorite = $true },
  @{ name = "docs-site"; path = "demo/docs-site"; favorite = $false },
  @{ name = "dotfiles"; path = "dotfiles"; favorite = $false }
) | ForEach-Object { @{ name = $_.name; path = (Join-Path $demoHome $_.path); favorite = $_.favorite } }
$store = Join-Path $env:XDG_STATE_HOME "opencode/latest/tui"
New-Item -ItemType Directory -Force $store | Out-Null
# WriteAllText skips the BOM that Windows PowerShell's Set-Content would add.
$json = @{ version = 1; projects = $projects } | ConvertTo-Json -Depth 4
[IO.File]::WriteAllText((Join-Path $store "plugin.cdf.projects.json"), $json)

Set-Location (Join-Path $demoHome "demo/acme-api")
Clear-Host
