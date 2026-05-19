$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$TerraformDir = Join-Path $Root "terraform"

$Domain = terraform -chdir="$TerraformDir" output -raw cloudfront_domain_name
Write-Host "https://$Domain"
