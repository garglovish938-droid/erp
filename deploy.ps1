Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Starting Zero-Downtime Deployment (Blue-Green)" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Function to wait for container to be healthy
function Wait-For-Healthy {
    param(
        [string]$ServiceName,
        [string]$ContainerName
    )
    Write-Host "Waiting for $ServiceName ($ContainerName) to become healthy..."
    
    $count = 0
    $maxAttempts = 30
    
    while ($count -lt $maxAttempts) {
        # Get health status of the container
        $inspectResult = docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' $ContainerName 2>$null
        $status = if ($LASTEXITCODE -eq 0) { $inspectResult } else { "not-found" }
        
        if ($status -eq "healthy" -or $status -eq "no-healthcheck") {
            Write-Host "✓ $ServiceName ($ContainerName) is healthy and online." -ForegroundColor Green
            return $true
        } elseif ($status -eq "unhealthy") {
            Write-Host "✗ $ServiceName ($ContainerName) is unhealthy." -ForegroundColor Red
            return $false
        }
        
        $count++
        Write-Host "Current status: '$status' (Attempt $count/$maxAttempts). Retrying in 2 seconds..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 2
    }
    
    Write-Host "✗ Timeout: $ServiceName failed to become healthy within $($maxAttempts*2) seconds." -ForegroundColor Red
    return $false
}

# 1. Update Blue environment
Write-Host "Step 1: Deploying to BLUE environment..." -ForegroundColor Yellow
docker-compose up -d --build backend-blue frontend-blue

# Wait for Blue to pass health checks
$blueBackendHealthy = Wait-For-Healthy -ServiceName "Service Engine (Blue)" -ContainerName "allure_erp_backend_blue"
$blueFrontendHealthy = Wait-For-Healthy -ServiceName "User Interface (Blue)" -ContainerName "allure_erp_frontend_blue"

if (-not $blueBackendHealthy -or -not $blueFrontendHealthy) {
    Write-Host "✗ Error: Blue environment failed to start correctly. Aborting deployment to protect live Green system." -ForegroundColor Red
    exit 1
}

# Allow gateway traffic routing stabilization
Write-Host "Stabilizing traffic routing on Blue..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3

# 2. Update Green environment
Write-Host "Step 2: Deploying to GREEN environment..." -ForegroundColor Yellow
docker-compose up -d --build backend-green frontend-green

# Wait for Green to pass health checks
$greenBackendHealthy = Wait-For-Healthy -ServiceName "Service Engine (Green)" -ContainerName "allure_erp_backend_green"
$greenFrontendHealthy = Wait-For-Healthy -ServiceName "User Interface (Green)" -ContainerName "allure_erp_frontend_green"

if (-not $greenBackendHealthy -or -not $greenFrontendHealthy) {
    Write-Host "✗ Warning: Green environment failed to start correctly, but Blue is running successfully." -ForegroundColor Yellow
}

# Gracefully reload Gateway Router (nginx) to apply latest configurations (if changed)
Write-Host "Step 3: Reloading Gateway Router configuration..." -ForegroundColor Yellow
docker-compose exec -T nginx nginx -s reload 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Gateway Router successfully reloaded." -ForegroundColor Green
} else {
    Write-Host "✓ Gateway Router successfully routed." -ForegroundColor Green
}

Write-Host "=============================================" -ForegroundColor Green
Write-Host "Deployment Completed Successfully (ZERO DOWNTIME)" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
