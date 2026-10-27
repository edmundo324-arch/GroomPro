$ErrorActionPreference='Stop'
$origin=Read-Host 'Paste your GoDaddy GroomPro address (https://...)'
$uri=[Uri]$origin
if(-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or $uri.UserInfo){throw 'Enter the HTTPS address of your GroomPro site.'}
$origin=$uri.GetLeftPart([UriPartial]::Authority)
$server=Read-Host 'SQL Server (Enter for DESKTOP-L2J4TSD\DSI)'
if([string]::IsNullOrWhiteSpace($server)){$server='DESKTOP-L2J4TSD\DSI'}
$database=Read-Host 'Database (Enter for OneTwoThreePet)'
if([string]::IsNullOrWhiteSpace($database)){$database='OneTwoThreePet'}
$folder=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('GroomPro\123Pet\'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $folder
$path=Join-Path $folder 'connector.credential.xml'
$secret=Read-Host 'Paste the connector credential created in GoDaddy GroomPro Settings (hidden)' -AsSecureString
(New-Object System.Management.Automation.PSCredential($origin,$secret)) | Export-Clixml -LiteralPath $path
[ordered]@{GroomProUrl=$origin;Server=$server;Database=$database;CredentialPath=$path} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'connection.local.json') -Encoding UTF8
Write-Host ('Configured GroomPro at '+$origin+'. No records have been transferred.')
Write-Host 'Run Start-Connector.cmd to connect. Read/write permissions are controlled in GroomPro Settings.'
