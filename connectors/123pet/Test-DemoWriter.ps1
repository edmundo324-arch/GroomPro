param([string]$Server='DESKTOP-L2J4TSD\DSI',[string]$Database='OneTwoThreePet')
$ErrorActionPreference='Stop'
if($Server -ine 'DESKTOP-L2J4TSD\DSI' -or $Database -cne 'OneTwoThreePet'){throw 'Only the designated sample database may be tested.'}
. (Join-Path $PSScriptRoot '..\..\tests\123pet-demo-plan.ps1')
. (Join-Path $PSScriptRoot 'Write-DemoPlan.ps1')
# Use the valid package plan produced before the negative tender test.
$b=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$b['Data Source']=$Server;$b['Initial Catalog']=$Database;$b['Integrated Security']=$true;$b['Encrypt']=$true;$b['TrustServerCertificate']=$true;$b['Connect Timeout']=10
$c=New-Object System.Data.SqlClient.SqlConnection $b.ConnectionString
try{
 $c.Open()
 $result=Invoke-DemoPlan $c $packagePlan 'https://connector-validation.invalid' ([Guid]::NewGuid().ToString())
 if($result.state -ne 'VALIDATED_ROLLED_BACK'){throw 'Validation did not roll back.'}
 $result|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'demo-writer-validation.local.json') -Encoding UTF8
 Write-Host 'SQL write/read-back test passed and rolled back. No imported records were kept.'
}catch{
 [ordered]@{state='FAILED';message=$_.Exception.Message;at=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'demo-writer-validation.local.json') -Encoding UTF8
 throw
}finally{$c.Dispose()}
