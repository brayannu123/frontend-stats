param(
  [string]$StatsApiUrl = $env:STATS_API_URL,
  [switch]$SkipTerraform
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$TerraformDir = Join-Path $Root "terraform"
$PublicDir = Join-Path $Root "public"
$ConfigPath = Join-Path $PublicDir "config.js"
$ExistingBucket = "frontend-stats-dev"
$ExistingDistributionComment = "frontend-stats dev frontend"

Push-Location $Root
try {
  if ($StatsApiUrl) {
    Write-Host "Writing runtime stats API config..." -ForegroundColor Cyan
    @"
window.APP_CONFIG = {
  STATS_API_URL: "$StatsApiUrl",
};
"@ | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
  }
  else {
    Write-Host "STATS_API_URL was not provided. Keeping current public/config.js." -ForegroundColor Yellow
  }

  $ExistingDistribution = $null
  try {
    aws s3api head-bucket --bucket $ExistingBucket 2>$null | Out-Null
    $ExistingDistribution = aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='$ExistingDistributionComment'] | [0]" --output json | ConvertFrom-Json
  }
  catch {
    $ExistingDistribution = $null
  }

  $UseExistingInfrastructure = $ExistingDistribution -and $ExistingDistribution.Id

  if ((-not $SkipTerraform) -and (-not $UseExistingInfrastructure)) {
    Write-Host "Applying Terraform..." -ForegroundColor Cyan
    terraform -chdir="$TerraformDir" init
    terraform -chdir="$TerraformDir" apply -auto-approve
  }
  elseif ($UseExistingInfrastructure) {
    Write-Host "Using existing AWS frontend infrastructure..." -ForegroundColor Cyan
  }

  if ($UseExistingInfrastructure) {
    $Bucket = $ExistingBucket
    $DistributionId = $ExistingDistribution.Id
    $Domain = $ExistingDistribution.DomainName
  }
  else {
    $Bucket = terraform -chdir="$TerraformDir" output -raw bucket_name
    $DistributionId = terraform -chdir="$TerraformDir" output -raw cloudfront_distribution_id
    $Domain = terraform -chdir="$TerraformDir" output -raw cloudfront_domain_name
  }

  Write-Host "Uploading assets to s3://$Bucket..." -ForegroundColor Cyan
  aws s3 sync "$PublicDir" "s3://$Bucket" --delete --cache-control "public,max-age=300"
  aws s3 cp (Join-Path $PublicDir "index.html") "s3://$Bucket/index.html" --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"
  aws s3 cp $ConfigPath "s3://$Bucket/config.js" --cache-control "no-cache,no-store,must-revalidate" --content-type "application/javascript"

  Write-Host "Invalidating CloudFront distribution $DistributionId..." -ForegroundColor Cyan
  aws cloudfront create-invalidation --distribution-id "$DistributionId" --paths "/*" | Out-Null

  Write-Host ""
  Write-Host "Frontend stats deployed:" -ForegroundColor Green
  Write-Host "https://$Domain" -ForegroundColor Green
}
finally {
  Pop-Location
}
