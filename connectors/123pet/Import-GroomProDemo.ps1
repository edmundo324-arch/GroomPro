param([Parameter(Mandatory=$true)][string]$SnapshotDirectory,[Parameter(Mandatory=$true)][string]$GroomProOrigin,[string]$Server='DESKTOP-L2J4TSD\DSI',[string]$Database='OneTwoThreePet',[switch]$Apply,[scriptblock]$BeforeCommit)
$ErrorActionPreference='Stop'
# This entry point is exclusively the explicitly authorized demo destination.
if($Server -ine 'DESKTOP-L2J4TSD\DSI' -or $Database -cne 'OneTwoThreePet'){throw 'Demo import is restricted to the designated sample database.'}
$origin=[Uri]$GroomProOrigin
if($origin.Scheme -ne 'https' -or $origin.IsLoopback -or $origin.UserInfo -or $origin.Query -or $origin.Fragment){throw 'Use the GoDaddy HTTPS origin, not the PC server.'}
$originText=$origin.GetLeftPart([UriPartial]::Authority)
$receipt=Get-Content -LiteralPath (Join-Path $SnapshotDirectory 'received.json') -Raw|ConvertFrom-Json
if($receipt.origin -cne $originText -or $receipt.source -ne 'GROOMPRO_DEMO'){throw 'The snapshot is not bound to this GoDaddy source. Download it again with the updated connector.'}
$data=@{};foreach($kind in @('locations','customers','pets','employees','services','products','packages','tickets','groomingNotes')){$data[$kind]=New-Object 'System.Collections.Generic.List[object]'}
for($i=0;$i -lt [int]$receipt.chunks;$i++){
 $secret=Import-Clixml -LiteralPath (Join-Path $SnapshotDirectory ('chunk-'+$i+'.xml'))
 if($secret -isnot [Security.SecureString]){throw 'Snapshot is not protected.'}
 $json=(New-Object System.Management.Automation.PSCredential('snapshot',$secret)).GetNetworkCredential().Password
 $chunk=$json|ConvertFrom-Json;$json=$null
 if($chunk.jobId -ne $receipt.jobId -or $chunk.index -ne $i -or $chunk.total -ne $receipt.chunks -or -not $data.ContainsKey($chunk.kind)){throw 'Snapshot chunk mismatch.'}
 foreach($r in $chunk.rows){$data[$chunk.kind].Add($r)}
}
. (Join-Path $PSScriptRoot 'Build-DemoPlan.ps1')
. (Join-Path $PSScriptRoot 'Write-DemoPlan.ps1')
$plan=@(New-DemoPlan $data)
$builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source']=$Server;$builder['Initial Catalog']=$Database;$builder['Integrated Security']=$true;$builder['Encrypt']=$true;$builder['TrustServerCertificate']=$true;$builder['Connect Timeout']=10
$connection=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
try{
 $connection.Open()
 if($Apply -and -not $BeforeCommit){throw 'An active GoDaddy authorization check is required.'}; if($BeforeCommit){& $BeforeCommit | Out-Null}
 $result=Invoke-DemoPlan $connection $plan $originText $receipt.jobId -Apply:$Apply -BeforeCommit:$BeforeCommit
 $result|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $SnapshotDirectory 'write-result.json') -Encoding UTF8
 Write-Host ($result.state+': '+$result.rows+' related rows. Existing unmatched records retained.')
 return $result
}finally{$connection.Dispose();$data=$null;$plan=$null}
