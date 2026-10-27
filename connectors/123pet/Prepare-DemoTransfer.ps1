param([switch]$TrustLocalCertificate)
$ErrorActionPreference='Stop'
# User explicitly declined a backup of the disposable test database.
& (Join-Path $PSScriptRoot 'Inspect-123Pet.ps1') -TrustLocalCertificate:$TrustLocalCertificate
Write-Host 'Test database metadata is ready. No backup was made and no records were changed.'
