# Node.js PATH (Cursor/VS Code terminal)
$env:Path = "C:\Program Files\nodejs;" + $env:Path

Set-Location $PSScriptRoot

Write-Host "Node: $(node -v)" -ForegroundColor Green
Write-Host "npm:  $(npm -v)" -ForegroundColor Green
Write-Host "Starting dev server..." -ForegroundColor Cyan

npm run dev
