param(
 [Parameter(Mandatory=$true)][string]$GroomProUrl,
 [string]$Server='DESKTOP-L2J4TSD\DSI',
 [string]$Database='OneTwoThreePet',
 [Parameter(Mandatory=$true)][string]$CredentialPath,
 [switch]$TrustLocalCertificate,
 [switch]$Once,
 [ValidateRange(10,3600)][int]$PollSeconds=30
)
$ErrorActionPreference='Stop'
$endpoint=[Uri]$GroomProUrl
if($endpoint.Scheme -ne 'https' -and -not ($endpoint.Scheme -eq 'http' -and $endpoint.IsLoopback)){throw 'Use HTTPS, or HTTP on this PC for local testing.'}
if($endpoint.UserInfo -or $endpoint.Query -or $endpoint.Fragment){throw 'Enter the GroomPro origin without credentials, query, or fragment.'}
$credential=Import-Clixml -LiteralPath $CredentialPath
if($credential -isnot [System.Management.Automation.PSCredential]){throw 'Invalid protected connector credential.'}
if($credential.UserName -ne $endpoint.GetLeftPart([UriPartial]::Authority) -and -not($endpoint.IsLoopback -and $credential.UserName -eq 'GroomProConnector')){throw 'This credential belongs to another GroomPro address. Run Setup-Connector.cmd for this site.'}
$token=$credential.GetNetworkCredential().Password
. (Join-Path $PSScriptRoot 'Invoke-VerifiedWrite.ps1')
. (Join-Path $PSScriptRoot 'Read-TicketBundles.ps1')
. (Join-Path $PSScriptRoot 'Receive-DemoSnapshot.ps1')
$uri=$GroomProUrl.TrimEnd('/')+'/api/integrations/123pet/connector'
$instance=[Guid]::NewGuid().ToString()
function Send-Message($Message){
 $Message.instance=$instance
 $body=$Message | ConvertTo-Json -Depth 20 -Compress
 Invoke-RestMethod -Uri $uri -Method Post -Headers @{Authorization=('Bearer '+$token)} -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 60 -MaximumRedirection 0
}
function Quote-Identifier([string]$Name){
 if($Name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$'){throw 'Invalid approved SQL identifier.'}
 return '['+$Name+']'
}
$builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source']=$Server;$builder['Initial Catalog']=$Database
$builder['Integrated Security']=$true;$builder['Encrypt']=$true
$builder['TrustServerCertificate']=[bool]$TrustLocalCertificate;$builder['Connect Timeout']=10
$mutexName='Local\GroomPro123Pet_'+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($CredentialPath)).Replace('/','_').Replace('+','-')
$mutex=New-Object System.Threading.Mutex($false,$mutexName)
if(-not $mutex.WaitOne(0)){throw 'This connector is already running.'}
try{
 $schemaSent=$false
 $registered=$false
 for($attempt=0;$attempt -lt 5;$attempt++){
  try{$null=Send-Message @{action='HEARTBEAT'};$registered=$true;break}
  catch{if($Once -or $attempt -eq 4){throw};Write-Host 'Waiting for the previous connection to release or GroomPro to respond...';Start-Sleep -Seconds 45}
 }
 if(-not $registered){throw 'Connector registration did not complete.'}
 do{
  try{
   $status=Send-Message @{action='HEARTBEAT'}
    if(-not $schemaSent){
     & (Join-Path $PSScriptRoot 'Inspect-123Pet.ps1') -Server $Server -Database $Database -TrustLocalCertificate:$TrustLocalCertificate
     $schema=Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot '123pet-schema.json') | ConvertFrom-Json
     $null=Send-Message @{action='SCHEMA';schema=$schema};$schemaSent=$true
    }
   Receive-DemoSnapshot $CredentialPath
   if($status.writeEnabled){
    $operations=(Send-Message @{action='POLL_WRITES'}).commands
    $writeConnection=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
    try{
     $writeConnection.Open()
     foreach($operation in $operations){
      # Recheck authorization immediately before every mutation.
      $current=(Send-Message @{action='POLL_WRITES'}).commands
      if(-not @($current | Where-Object {$_.id -eq $operation.id}).Count){continue}
      $outcome=Invoke-VerifiedWrite $writeConnection $operation (($token -split '\.')[1])
      $null=Send-Message @{action='WRITE_RESULT';id=$operation.id;state=$outcome}
     }
    }finally{$writeConnection.Dispose()}
   }
   if($status.readEnabled){
    $manifest=(Send-Message @{action='MANIFEST'}).manifest
    $connection=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
    try{
     $connection.Open()
     foreach($table in $manifest){
      $columns=($table.columns | ForEach-Object {Quote-Identifier $_}) -join ','
      $source=(Quote-Identifier $table.schema)+'.'+(Quote-Identifier $table.table)
      $key=Quote-Identifier $table.key
      $offset=0
      do{
       # Repeated complete scans tolerate sources without Change Tracking. A
       # disappearing row is never interpreted as permission to delete a ticket.
       $command=$connection.CreateCommand();$command.CommandTimeout=60
       $command.CommandText='SELECT '+$columns+' FROM '+$source+' ORDER BY '+$key+' OFFSET @offset ROWS FETCH NEXT 100 ROWS ONLY'
       $null=$command.Parameters.Add('@offset',[Data.SqlDbType]::Int);$command.Parameters['@offset'].Value=$offset
       $reader=$command.ExecuteReader();$rows=New-Object 'System.Collections.Generic.List[object]'
       try{
        while($reader.Read()){
         $row=[ordered]@{}
         for($i=0;$i -lt $reader.FieldCount;$i++){
          $value=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}
          if($value -is [DateTime]){$value=$value.ToString('yyyy-MM-ddTHH:mm:ss.fff',[Globalization.CultureInfo]::InvariantCulture)}
          elseif($value -is [decimal]){$value=$value.ToString([Globalization.CultureInfo]::InvariantCulture)}
          elseif($value -is [Guid]){$value=$value.ToString()}
          $row[$reader.GetName($i)]=$value
         }
         $rows.Add([pscustomobject]$row)
        }
       }finally{$reader.Dispose();$command.Dispose()}
       if($rows.Count){$null=Send-Message @{action='BATCH';table=$table.table;rows=@($rows.ToArray())}}
       $offset+=$rows.Count
      }while($rows.Count -eq 100)
     }
     Send-TicketBundles $connection $manifest
     Write-Host ('Source scan acknowledged at '+(Get-Date)+'. Check GroomPro connection settings for records needing review.')
    }finally{$connection.Dispose()}
   }
  }catch{
   # Do not write response bodies, source records, or bearer credentials to logs.
   Write-Warning 'Synchronization interrupted. Source records are unchanged; the next scan will retry safely.'
   if($Once){throw}
  }
  if(-not $Once){Start-Sleep -Seconds $PollSeconds}
 }while(-not $Once)
}finally{$mutex.ReleaseMutex();$mutex.Dispose();$token=$null}
