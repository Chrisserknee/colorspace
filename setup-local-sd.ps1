# LumePet Local SDXL Setup Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "LumePet Local SDXL Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env.local"

# Check if .env.local exists
if (-not (Test-Path $envFile)) {
    Write-Host "Creating .env.local file..." -ForegroundColor Yellow
    New-Item -ItemType File -Path $envFile -Force | Out-Null
}

Write-Host "Updating .env.local with Local SDXL settings..." -ForegroundColor Yellow

# Read existing content
$content = Get-Content $envFile -ErrorAction SilentlyContinue

# Settings to add/update
$newSettings = @{
    "USE_STABLE_DIFFUSION" = "true"
    "LOCAL_SD_API_URL" = "http://localhost:7860"
    "LOCAL_SD_API_TYPE" = "automatic1111"
    "SD_MODEL" = "sdxl-ip-adapter-plus"
    "IP_ADAPTER_SCALE" = "0.85"
    "SD_STEPS" = "35"
    "SD_GUIDANCE_SCALE" = "7.5"
    "SD_STRENGTH" = "0.6"
}

# Create hashtable of existing settings
$existingSettings = @{}
foreach ($line in $content) {
    if ($line -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $existingSettings[$key] = $value
    }
}

# Merge settings (new settings override existing)
foreach ($key in $newSettings.Keys) {
    $existingSettings[$key] = $newSettings[$key]
}

# Write back to file
$output = @()
foreach ($key in $existingSettings.Keys) {
    $output += "$key=$($existingSettings[$key])"
}

# Add any comments or other lines that weren't settings
foreach ($line in $content) {
    if ($line -match '^\s*#') {
        $output += $line
    } elseif ($line -match '^\s*$') {
        $output += ""
    }
}

Set-Content -Path $envFile -Value $output

Write-Host "✅ .env.local updated!" -ForegroundColor Green
Write-Host ""
Write-Host "Settings added:" -ForegroundColor Cyan
foreach ($key in $newSettings.Keys) {
    Write-Host "  $key=$($newSettings[$key])" -ForegroundColor Gray
}
Write-Host ""
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host "1. Go to: C:\Users\SR115\stable-diffusion-webui" -ForegroundColor White
Write-Host "2. Run: .\download-models.ps1" -ForegroundColor White
Write-Host "3. Download the required models (see script output)" -ForegroundColor White
Write-Host "4. Run: .\start-api.bat" -ForegroundColor White
Write-Host "5. Restart your Next.js dev server: npm run dev" -ForegroundColor White
Write-Host ""

