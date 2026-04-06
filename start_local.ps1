# ═══════════════════════════════════════════════════════════════════
#  HomeCare Hub — Local Development Starter
#  Run this from the homecare-hub root folder:
#      .\start_local.ps1
# ═══════════════════════════════════════════════════════════════════

$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$Venv = Join-Path $Backend "venv\Scripts\python.exe"

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "   HomeCare Hub — Local Dev Starter" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Step 0: Ensure Docker Desktop is running ──────────────────────
Write-Host "▶ [0/4] Checking Docker Desktop..." -ForegroundColor Yellow

function Test-DockerRunning {
    $result = docker info 2>&1
    return ($LASTEXITCODE -eq 0)
}

if (-not (Test-DockerRunning)) {
    Write-Host "   Docker Desktop is not running. Attempting to start it..." -ForegroundColor DarkYellow

    # Common Docker Desktop install paths
    $dockerPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    )
    $started = $false
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            Start-Process $path
            $started = $true
            break
        }
    }

    if (-not $started) {
        Write-Host "   ❌ Could not find Docker Desktop. Please start it manually and re-run this script." -ForegroundColor Red
        exit 1
    }

    Write-Host "   Waiting for Docker Engine to become ready (up to 60s)..." -ForegroundColor DarkGray
    $waited = 0
    while ($waited -lt 60) {
        Start-Sleep -Seconds 3
        $waited += 3
        if (Test-DockerRunning) { break }
        Write-Host "   ...still waiting ($waited s)" -ForegroundColor DarkGray
    }

    if (-not (Test-DockerRunning)) {
        Write-Host "   ❌ Docker Engine did not start in time. Please open Docker Desktop manually and re-run." -ForegroundColor Red
        exit 1
    }
}

Write-Host "   ✅ Docker Desktop is running." -ForegroundColor Green

# ── Step 1: Start Postgres via Docker ─────────────────────────────
Write-Host ""
Write-Host "▶ [1/4] Starting Postgres container..." -ForegroundColor Yellow
Set-Location $Root
docker-compose up postgres -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Failed to start Postgres container. Check docker-compose.yml." -ForegroundColor Red
    exit 1
}

Write-Host "   Waiting for Postgres to become healthy..." -ForegroundColor DarkGray
$pgReady = $false
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 3
    $check = docker exec homecare-postgres pg_isready -U homecare_user -d homecare 2>&1
    if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
    Write-Host "   ...still waiting ($([int]($i+1)*3) s)" -ForegroundColor DarkGray
}
if (-not $pgReady) {
    Write-Host "   ❌ Postgres did not become healthy in time." -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Postgres is healthy." -ForegroundColor Green

# ── Step 2: Install / update Python deps ──────────────────────────
Write-Host ""
Write-Host "▶ [2/4] Installing Python dependencies..." -ForegroundColor Yellow
Set-Location $Backend
& $Venv -m pip install --quiet --upgrade pip
& $Venv -m pip install --quiet "psycopg[binary]>=3.1.0"
& $Venv -m pip install --quiet -e .

# ── Step 3: Test DB connection ─────────────────────────────────────
Write-Host ""
Write-Host "▶ [3/4] Testing database connection..." -ForegroundColor Yellow
$dbUrl = $env:DATABASE_URL_LOCAL
if (-not $dbUrl) {
    $dbUrl = "postgresql://homecare_user:homecare_pass@127.0.0.1:5435/homecare"
}
$dbTest = & $Venv -c @"
import psycopg, sys
try:
    conn = psycopg.connect('$dbUrl', connect_timeout=5)
    conn.close()
    print('OK')
except Exception as e:
    print(f'FAIL: {e}')
    sys.exit(1)
"@
if ($dbTest -eq "OK") {
    Write-Host "   ✅ Database is reachable at localhost:5435" -ForegroundColor Green
}
else {
    Write-Host "   ❌ DB test failed: $dbTest" -ForegroundColor Red
    Write-Host "   Make sure Docker Desktop is running, then try again." -ForegroundColor Red
    exit 1
}

# ── Step 4: Launch Backend + Frontend in parallel ─────────────────
Write-Host ""
Write-Host "▶ [4/4] Launching backend (port 8000) and frontend (port 3000)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Backend  → http://localhost:8000" -ForegroundColor Cyan
Write-Host "   Swagger  → http://localhost:8000/api/v1/docs" -ForegroundColor Cyan
Write-Host "   Frontend → http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "   Press Ctrl+C in each window to stop." -ForegroundColor DarkGray
Write-Host ""

# Open backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  Set-Location '$Backend'
  Write-Host '🚀 Backend starting on http://localhost:8000 ...' -ForegroundColor Cyan
  & '$Venv' -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"@

# Give backend 3 seconds head start, then open frontend
Start-Sleep -Seconds 3
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
  Set-Location '$Frontend'
  Write-Host '🚀 Frontend starting on http://localhost:3000 ...' -ForegroundColor Cyan
  npm run dev
"@

Write-Host "✅ Both servers launched in separate windows." -ForegroundColor Green
Write-Host "   Opening browser in 6 seconds..." -ForegroundColor DarkGray
Start-Sleep -Seconds 6
Start-Process "http://localhost:3000"
Start-Process "http://localhost:8000/api/v1/docs"
