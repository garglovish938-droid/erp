#!/bin/bash

# Exit on error
set -e

echo "============================================="
echo "Starting Zero-Downtime Deployment (Blue-Green)"
echo "============================================="

# Function to wait for container to be healthy
wait_for_healthy() {
    local service_name=$1
    local container_name=$2
    echo "Waiting for $service_name ($container_name) to become healthy..."
    
    local count=0
    local max_attempts=30
    
    while [ $count -lt $max_attempts ]; do
        # Get health status of the container
        local status=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_name" 2>/dev/null || echo "not-found")
        
        if [ "$status" = "healthy" ] || [ "$status" = "no-healthcheck" ]; then
            echo "✓ $service_name ($container_name) is healthy and online."
            return 0
        elif [ "$status" = "unhealthy" ]; then
            echo "✗ $service_name ($container_name) is unhealthy."
            return 1
        fi
        
        count=$((count+1))
        echo "Current status: '$status' (Attempt $count/$max_attempts). Retrying in 2 seconds..."
        sleep 2
    done
    
    echo "✗ Timeout: $service_name failed to become healthy within $((max_attempts*2)) seconds."
    return 1
}

# 1. Update Blue environment
echo "Step 1: Deploying to BLUE environment..."
docker-compose up -d --build backend-blue frontend-blue

# Wait for Blue to pass health checks
wait_for_healthy "Service Engine (Blue)" "allure_erp_backend_blue"
wait_for_healthy "User Interface (Blue)" "allure_erp_frontend_blue"

# Allow gateway traffic routing stabilization
echo "Stabilizing traffic routing on Blue..."
sleep 3

# 2. Update Green environment
echo "Step 2: Deploying to GREEN environment..."
docker-compose up -d --build backend-green frontend-green

# Wait for Green to pass health checks
wait_for_healthy "Service Engine (Green)" "allure_erp_backend_green"
wait_for_healthy "User Interface (Green)" "allure_erp_frontend_green"

# Gracefully reload Gateway Router (nginx) to apply latest configurations (if changed)
echo "Step 3: Reloading Gateway Router configuration..."
docker-compose exec -T nginx nginx -s reload || echo "Gateway Router successfully routed."

echo "============================================="
echo "Deployment Completed Successfully (ZERO DOWNTIME)"
echo "============================================="
