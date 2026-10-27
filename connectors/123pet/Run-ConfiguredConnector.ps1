$ErrorActionPreference='Stop'
$file=Join-Path $PSScriptRoot 'connection.local.json'
if(-not(Test-Path -LiteralPath $file)){throw 'Run Setup-Connector.cmd first.'}
$c=Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
& (Join-Path $PSScriptRoot 'Start-Connector.ps1') -GroomProUrl $c.GroomProUrl -Server $c.Server -Database $c.Database -CredentialPath $c.CredentialPath -TrustLocalCertificate
