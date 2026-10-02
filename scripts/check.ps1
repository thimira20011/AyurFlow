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
    & $goExecutable build ./cmd/api ./cmd/migrate
    if ($LASTEXITCODE -ne 0) { throw 'Go build failed.' }
} finally { Pop-Location }

Push-Location (Join-Path $projectRoot 'frontend')
try {
    foreach ($check in @('lint', 'typecheck', 'build')) {
        & npm.cmd run $check
        if ($LASTEXITCODE -ne 0) { throw "Frontend $check failed." }
    }
} finally { Pop-Location }
