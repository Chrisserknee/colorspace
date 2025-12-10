# Remove local API settings from .env.local
$envFile = ".env.local"

if (Test-Path $envFile) {
    $content = Get-Content $envFile
    $filtered = $content | Where-Object { 
        $_ -notmatch '^LOCAL_SD_API_URL' -and 
        $_ -notmatch '^LOCAL_SD_API_TYPE'
    }
    Set-Content -Path $envFile -Value $filtered
    Write-Host "✅ Removed LOCAL_SD_API_URL and LOCAL_SD_API_TYPE from .env.local" -ForegroundColor Green
} else {
    Write-Host "⚠️ .env.local not found" -ForegroundColor Yellow
}

