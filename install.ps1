# Project Protector CLI - Windows Automated Installer
# AES-256-GCM + scrypt In-Memory Executable Packager

$ErrorActionPreference = "Stop"

function Write-Color {
    param([string]$text, [string]$color = "Cyan")
    Write-Host $text -ForegroundColor $color
}

function Write-Success {
    param([string]$text)
    Write-Host " [OK] $text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$text)
    Write-Host " [WARN] $text" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$text)
    Write-Host " [ERROR] $text" -ForegroundColor Red
}

Clear-Host
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Cyan
Write-Host "    PROJECT PROTECTOR CLI - Windows Automated Installer" -ForegroundColor White
Write-Host "    AES-256-GCM + scrypt In-Memory Executable Packager" -ForegroundColor DarkCyan
Write-Host "  ================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
Write-Color "Checking Node.js environment..." "Cyan"
try {
    $nodeVer = & node -v 2>$null
    if ($nodeVer) {
        Write-Success "Node.js detected: $nodeVer"
    } else {
        throw "Node.js not found"
    }
} catch {
    Write-Err "Node.js is not installed or not in PATH!"
    Write-Host ""
    Write-Host "  You can install Node.js quickly via PowerShell:" -ForegroundColor Yellow
    Write-Host "    winget install OpenJS.NodeJS.LTS" -ForegroundColor White
    Write-Host "  Or download from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# 2. Target installation paths
$InstallDir = Join-Path $HOME ".project-protector"
$BinDir = Join-Path $InstallDir "bin"
$RepoUrl = "https://github.com/SkellyVA/project-protector.git"

if ($env:PROTECTOR_REPO_URL) {
    $RepoUrl = $env:PROTECTOR_REPO_URL
}

Write-Color "`nPreparing installation directory: $InstallDir" "Cyan"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
}

# 3. Source extraction or download
$CurrentScriptDir = $PSScriptRoot

if ($CurrentScriptDir -and (Test-Path (Join-Path $CurrentScriptDir "cli.js"))) {
    Write-Color "Copying files from local source..." "Cyan"
    Get-ChildItem -Path $CurrentScriptDir | Where-Object { 
        $_.Name -ne "node_modules" -and $_.Name -ne "dist" -and -not ($_.Name.StartsWith("temp"))
    } | Copy-Item -Destination $InstallDir -Recurse -Force
} else {
    Write-Color "Downloading latest release from GitHub..." "Cyan"
    try {
        if (Get-Command git -ErrorAction SilentlyContinue) {
            if (Test-Path (Join-Path $InstallDir ".git")) {
                Write-Color "Updating existing git repository..." "Cyan"
                Push-Location $InstallDir
                & git pull origin main 2>$null
                Pop-Location
            } else {
                & git clone --depth 1 $RepoUrl $InstallDir
            }
        } else {
            $ZipUrl = "https://github.com/SkellyVA/project-protector/archive/refs/heads/main.zip"
            $TempZip = Join-Path $env:TEMP "project-protector.zip"
            $TempExtract = Join-Path $env:TEMP "protector-extracted"
            Invoke-WebRequest -Uri $ZipUrl -OutFile $TempZip -UseBasicParsing
            Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force
            $ExtractSubfolder = Join-Path $TempExtract "project-protector-main"
            if (Test-Path $ExtractSubfolder) {
                Copy-Item -Path (Join-Path $ExtractSubfolder "*") -Destination $InstallDir -Recurse -Force
            }
            Remove-Item -Path $TempZip -Force -ErrorAction SilentlyContinue
            Remove-Item -Path $TempExtract -Recurse -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Err "Failed to download repository: $($_.Exception.Message)"
        exit 1
    }
}

Write-Success "Project files placed in $InstallDir"

# 4. Generate wrappers
Write-Color "`nGenerating global CLI binary wrappers..." "Cyan"
$CliPath = Join-Path $InstallDir "cli.js"

# Create cmd launcher
$CmdContent = "@ECHO off`r`nSETLOCAL`r`nnode `"$CliPath`" %*"
Set-Content -Path (Join-Path $BinDir "protector.cmd") -Value $CmdContent -Encoding UTF8
Set-Content -Path (Join-Path $BinDir "encrypter.cmd") -Value $CmdContent -Encoding UTF8

# Create ps1 launcher
$Ps1Content = '$Cli = "' + $CliPath + '"' + "`r`n" + '& node $Cli $args'
Set-Content -Path (Join-Path $BinDir "protector.ps1") -Value $Ps1Content -Encoding UTF8
Set-Content -Path (Join-Path $BinDir "encrypter.ps1") -Value $Ps1Content -Encoding UTF8

# Create sh launcher for Git Bash
$ShContent = '#!/bin/sh' + "`r`n" + 'exec node "' + $CliPath + '" "$@"'
Set-Content -Path (Join-Path $BinDir "protector") -Value $ShContent -Encoding UTF8
Set-Content -Path (Join-Path $BinDir "encrypter") -Value $ShContent -Encoding UTF8

Write-Success "Created executable wrappers in $BinDir"

# 5. Add to User PATH
Write-Color "`nConfiguring User PATH environment variable..." "Cyan"
$UserPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
$PathList = ($UserPath -split ";") | Where-Object { $_ -ne "" }

if ($PathList -notcontains $BinDir) {
    $NewPath = ($PathList + $BinDir) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, [EnvironmentVariableTarget]::User)
    $env:Path = "$env:Path;$BinDir"
    Write-Success "Added $BinDir to User PATH permanently"
} else {
    Write-Success "$BinDir is already in User PATH"
}

# 6. Global npm link
try {
    Push-Location $InstallDir
    & npm link --silent 2>$null
    Pop-Location
    Write-Success "Linked via NPM global registry"
} catch {
    # Non-fatal
}

# 7. Complete
Write-Host ""
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host "    PROJECT PROTECTOR CLI INSTALLED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "  ================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Quick Start Commands:" -ForegroundColor White
Write-Host "    protector               # Launch Interactive TUI Menu" -ForegroundColor Cyan
Write-Host "    protector protect ./src # Encrypt project into single executable" -ForegroundColor Cyan
Write-Host "    protector run app.js    # Run encrypted project in-memory" -ForegroundColor Cyan
Write-Host "    protector restore app.js# Restore original project files" -ForegroundColor Cyan
Write-Host ""
Write-Host "  (Note: If running in an existing open terminal, restart it to refresh PATH)" -ForegroundColor Gray
Write-Host ""
