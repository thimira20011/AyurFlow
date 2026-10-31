$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location (Join-Path $projectRoot 'backend')
try {
    $goCommand = Get-Command go -ErrorAction SilentlyContinue
    $goExecutable = if ($goCommand) { $goCommand.Source } else { 'C:\Program Files\Go\bin\go.exe' }
    if (-not (Test-Path -LiteralPath $goExecutable)) { throw 'Install Go and add it to PATH.' }
    $unformatted = & $goExecutable fmt ./...
    if ($LASTEXITCODE -ne 0) { throw 'Go formatting failed.' }
    & $goExecutable vet ./...
    if ($LASTEXITCODE -ne 0) { throw 'Go vet failed.' }
    & $goExecutable test ./...
    if ($LASTEXITCODE -ne 0) { throw 'Go tests failed.' }
    & $goExecutable build ./...
    if ($LASTEXITCODE -ne 0) { throw 'Go build failed.' }
    if ($env:TEST_DATABASE_URL) {
        & $goExecutable test -tags=integration -shuffle=on -count=1 -timeout=5m ./...
        if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL integration tests failed.' }
    } else {
        Write-Host 'PostgreSQL integration tests not run locally: TEST_DATABASE_URL is unset. CI requires them.'
    }
} finally { Pop-Location }

Push-Location (Join-Path $projectRoot 'frontend')
try {
    & npm.cmd ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Frontend clean install failed. Match the Node/npm versions in frontend/package.json and repair the lockfile if needed.' }
    foreach ($check in @('lint', 'test', 'typecheck', 'build')) {
        & npm.cmd run $check
        if ($LASTEXITCODE -ne 0) { throw "Frontend $check failed." }
    }
} finally { Pop-Location }
