param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference='Stop'
if(Test-Path -LiteralPath $Path){throw 'A credential already exists at this path. Choose a new path when rotating a connector.'}
$secret=Read-Host 'Paste the connector credential from GroomPro (input is hidden)' -AsSecureString
$credential=New-Object System.Management.Automation.PSCredential('GroomProConnector',$secret)
# Windows DPAPI binds the protected value to this Windows account and PC.
$credential | Export-Clixml -LiteralPath $Path
Write-Host 'Connector credential saved privately for this Windows account.'
