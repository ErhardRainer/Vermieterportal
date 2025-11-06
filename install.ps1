<#
.SYNOPSIS
  Installiert PHP via winget (Standard: 8.4 NTS), setzt PATH und optional VS-Code-Einstellung.

.PARAMETER Version
  PHP-Hauptversion (z.B. "8.4", "8.3"). Standard: 8.4

.PARAMETER ThreadSafe
  Installiert die Thread-Safe-Variante statt NTS.

.PARAMETER VSCodeWorkspaceRoot
  Repo-/Workspace-Ordner für .vscode\settings.json. Standard: Ordner des Skripts.

.PARAMETER NoUpdateVSCodeSettings
  Unterdrückt das Setzen von php.validate.executablePath in .vscode\settings.json.

.EXAMPLE
  .\install.ps1
#>

[CmdletBinding()]
param(
  [string]$Version = "8.4",
  [switch]$ThreadSafe,
  [string]$VSCodeWorkspaceRoot = $(if ($PSCommandPath) { Split-Path -Parent $PSCommandPath } else { Get-Location }),
  [switch]$NoUpdateVSCodeSettings
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Section([string]$text) {
  Write-Host "`n==== $text ====" -ForegroundColor Cyan
}

function Add-ToPath([string]$Dir, [switch]$Session, [switch]$User) {
  if (-not (Test-Path $Dir)) { return }

  # Sitzung
  if ($Session) {
    $parts = ($env:Path -split ';') | Where-Object { $_ -and $_.Trim() }
    if ($parts -notcontains $Dir) {
      $env:Path = ($Dir + ';' + $env:Path)
    }
  }

  # Benutzer-PATH persistent
  if ($User) {
    $current = [Environment]::GetEnvironmentVariable('Path', 'User')
    $items = ($current -split ';') | Where-Object { $_ -and $_.Trim() }
    if ($items -notcontains $Dir) {
      $new = if ($current) { "$current;$Dir" } else { $Dir }
      [Environment]::SetEnvironmentVariable('Path', $new, 'User')
    }
  }
}

function Ensure-Winget() {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget nicht gefunden. Bitte 'App Installer' aus dem Microsoft Store installieren und erneut ausführen."
  }
}

function Install-PHP($Version, $ThreadSafe) {
  Write-Section "Winget-Quellen aktualisieren"
  winget source update | Out-Host

  $pkgId = if ($ThreadSafe) { "PHP.PHP.$Version" } else { "PHP.PHP.NTS.$Version" }
  Write-Section "PHP installieren ($pkgId)"
  # Akzeptiere Agreements, verwende Community-Quelle explizit
  $args = @(
    'install','--source','winget','--id', $pkgId, '-e',
    '--accept-package-agreements','--accept-source-agreements'
  )

  try {
    winget @args | Out-Host
  } catch {
    Write-Warning "Winget-Installation meldete einen Fehler: $($_.Exception.Message)"
  }

  Write-Section "Installierte PHP-Pakete (winget list php)"
  winget list php | Out-Host
}

function Find-PhpExe() {
  Write-Section "Suche nach php.exe"
  $candidates = @(
    "$env:ProgramFiles\PHP",
    "$env:ProgramFiles(x86)\PHP",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages",
    "$env:LOCALAPPDATA\Programs\PHP",
    "C:\xampp\php"
  ) | Where-Object { $_ -and (Test-Path $_) }

  $phpExe = Get-ChildItem -Path $candidates -Recurse -Filter php.exe -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1 -ExpandProperty FullName

  if (-not $phpExe) {
    # evtl. bereits im PATH
    try {
      $where = & where.exe php 2>$null
      if ($where) { $phpExe = ($where -split "`r?`n")[0] }
    } catch { }
  }

  if (-not $phpExe) {
    throw "php.exe nicht gefunden. Prüfe winget-Installation oder Installationspfade."
  }

  Write-Host "PHP gefunden unter: $phpExe" -ForegroundColor Green
  return $phpExe
}

function Update-VSCode-PHPPath([string]$WorkspaceRoot, [string]$PhpExe) {
  try {
    $vsDir = Join-Path $WorkspaceRoot ".vscode"
    if (-not (Test-Path $vsDir)) { New-Item -ItemType Directory -Path $vsDir | Out-Null }
    $settingsPath = Join-Path $vsDir "settings.json"

    $settings = @{}
    if (Test-Path $settingsPath) {
      $raw = Get-Content $settingsPath -Raw
      if ($raw.Trim()) { $settings = $raw | ConvertFrom-Json -AsHashtable }
    }

    $settings["php.validate.executablePath"] = $PhpExe
    ($settings | ConvertTo-Json -Depth 5 | Out-String) | Set-Content -Path $settingsPath -Encoding UTF8

    Write-Host "VS Code: php.validate.executablePath gesetzt -> $PhpExe" -ForegroundColor Green
    Write-Host "Datei: $settingsPath" -ForegroundColor DarkGray
  } catch {
    Write-Warning "Konnte VS-Code settings.json nicht aktualisieren: $($_.Exception.Message)"
  }
}

# --- Ablauf ---
Ensure-Winget
Install-PHP -Version $Version -ThreadSafe:$ThreadSafe

$phpExe = Find-PhpExe
$phpDir = Split-Path $phpExe

Write-Section "PATH aktualisieren"
Add-ToPath -Dir $phpDir -Session -User
Write-Host "User-PATH wurde ergänzt (ggf. Terminal/VS Code neu starten)." -ForegroundColor Yellow

Write-Section "Versionstest"
& $phpExe -v | Out-Host
& $phpExe --ini | Out-Host

if (-not $NoUpdateVSCodeSettings) {
  Write-Section "VS Code-Einstellung setzen"
  Update-VSCode-PHPPath -WorkspaceRoot $VSCodeWorkspaceRoot -PhpExe $phpExe
}

Write-Host "`nFertig. Du kannst jetzt z. B. starten mit:" -ForegroundColor Cyan
Write-Host "php -S localhost:8000 -t `"$VSCodeWorkspaceRoot\html`"" -ForegroundColor Gray
