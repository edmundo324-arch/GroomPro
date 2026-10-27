param(
 [string]$Server='DESKTOP-L2J4TSD\DSI',
 [string]$Database='OneTwoThreePet',
 [switch]$TrustLocalCertificate
)
$ErrorActionPreference='Stop'
$builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source']=$Server
$builder['Initial Catalog']=$Database
$builder['Integrated Security']=$true
$builder['Encrypt']=$true
$builder['TrustServerCertificate']=[bool]$TrustLocalCertificate
$builder['Connect Timeout']=10
$connection=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
function Read-Profile([string]$Sql){
 $command=$connection.CreateCommand();$command.CommandText=$Sql;$command.CommandTimeout=60
 $reader=$command.ExecuteReader();$rows=New-Object 'System.Collections.Generic.List[object]'
 try {while($reader.Read()){$row=[ordered]@{};for($i=0;$i -lt $reader.FieldCount;$i++){$row[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};$rows.Add([pscustomobject]$row)}}finally{$reader.Dispose();$command.Dispose()}
 return $rows.ToArray()
}
# Aggregate integrity checks and code values only. No names, contact details,
# grooming notes, payment credentials, or source record modifications.
try{
 $connection.Open()
 $report=[ordered]@{formatVersion=1;server=$Server;database=$Database;capturedAt=[DateTime]::UtcNow.ToString('o')}
 $report.ticketIdentifiers=@(Read-Profile 'SELECT COUNT_BIG(*) rows, COUNT(DISTINCT fldTicketID) distinctTicketIds, SUM(CASE WHEN fldTicketID IS NULL THEN 1 ELSE 0 END) missingTicketIds FROM dbo.tblTicketsSummary')
 $report.ticketTypes=@(Read-Profile 'SELECT fldTicketType, fldTicketStatus, COUNT_BIG(*) rows FROM dbo.tblTicketsSummary GROUP BY fldTicketType,fldTicketStatus')
 $report.catalogTypes=@(Read-Profile 'SELECT fldPS, COUNT_BIG(*) rows FROM dbo.tblProductsAndServices GROUP BY fldPS')
 $report.lineTypes=@(Read-Profile 'SELECT fldPS, COUNT_BIG(*) rows FROM dbo.tblTicketsRow GROUP BY fldPS')
 $report.petOwners=@(Read-Profile 'SELECT COUNT_BIG(*) orphanPets FROM dbo.tblPets p LEFT JOIN dbo.tblClients c ON c.fldClientID=p.fldClientID WHERE c.fldPK IS NULL')
 $report.ticketOwners=@(Read-Profile 'SELECT COUNT_BIG(*) unmatchedTicketClients FROM dbo.tblTicketsSummary t LEFT JOIN dbo.tblClients c ON c.fldClientID=t.fldClientID WHERE c.fldPK IS NULL')
 $report.lineTickets=@(Read-Profile 'SELECT COUNT_BIG(*) unmatchedRows FROM dbo.tblTicketsRow r WHERE NOT EXISTS (SELECT 1 FROM dbo.tblTicketsSummary t WHERE t.fldTicketID=r.fldTicketID)')
 $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $PSScriptRoot '123pet-profile.json') -Encoding UTF8
 Write-Host 'Compatibility profile saved. No 123Pet records were changed.'
}finally{$connection.Dispose()}
