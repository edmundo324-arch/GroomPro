function Read-ApprovedRows($Connection,$Transaction,[string]$Sql,$Parameter,[Data.SqlDbType]$ParameterType=[Data.SqlDbType]::Int) {
 $command=$Connection.CreateCommand();$command.Transaction=$Transaction;$command.CommandTimeout=30;$command.CommandText=$Sql
 if($null -ne $Parameter){
  if($ParameterType -eq [Data.SqlDbType]::NVarChar){$null=$command.Parameters.Add('@id',$ParameterType,20);$command.Parameters['@id'].Value=[string]$Parameter}
  else{$null=$command.Parameters.Add('@id',$ParameterType);$command.Parameters['@id'].Value=[int]$Parameter}
 }
 $rows=New-Object 'System.Collections.Generic.List[object]'
 try {
  $reader=$command.ExecuteReader()
  try {while($reader.Read()){
   $row=[ordered]@{}
   for($i=0;$i -lt $reader.FieldCount;$i++){
    $value=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}
    if($value -is [DateTime]){$value=$value.ToString('yyyy-MM-ddTHH:mm:ss.fff',[Globalization.CultureInfo]::InvariantCulture)}
    elseif($value -is [decimal]){$value=$value.ToString([Globalization.CultureInfo]::InvariantCulture)}
    elseif($value -is [Guid]){$value=$value.ToString()}
    $row[$reader.GetName($i)]=$value
   }
   $rows.Add([pscustomobject]$row)
  }}finally{$reader.Dispose()}
 }finally{$command.Dispose()}
 return $rows.ToArray()
}

function Send-PackageBundles($Connection,$Manifest) {
 $summary=$Manifest | Where-Object {$_.table -eq 'tblPackagesSummary'}
 $lines=$Manifest | Where-Object {$_.table -eq 'tblPackagesRow'}
 if(-not $summary -or -not $lines){throw 'Package manifest is incomplete.'}
 $summaryColumns=($summary.columns | ForEach-Object {Quote-Identifier $_}) -join ','
 $lineColumns=($lines.columns | ForEach-Object {Quote-Identifier $_}) -join ','
 $keys=@(Read-ApprovedRows $Connection $null 'SELECT [fldPK] FROM [dbo].[tblPackagesSummary] ORDER BY [fldPK]' $null)
 foreach($key in $keys){
  $transaction=$Connection.BeginTransaction([Data.IsolationLevel]::Serializable)
  try{
   $headers=@(Read-ApprovedRows $Connection $transaction ('SELECT '+$summaryColumns+' FROM [dbo].[tblPackagesSummary] WHERE [fldPK]=@id') $key.fldPK)
   if($headers.Count -ne 1){$transaction.Commit();continue}
   $code=[string]$headers[0].fldPackageID
   $matches=@(Read-ApprovedRows $Connection $transaction 'SELECT TOP (2) [fldPK] FROM [dbo].[tblPackagesSummary] WHERE [fldPackageID]=@id' $code NVarChar)
   if($matches.Count -ne 1 -or -not $code.Trim()){$transaction.Commit();continue}
   $rows=@(Read-ApprovedRows $Connection $transaction ('SELECT TOP (1001) '+$lineColumns+' FROM [dbo].[tblPackagesRow] WHERE [fldPackageID]=@id ORDER BY [fldOrder],[fldPK]') $code NVarChar)
   $serviceKeys=@()
   foreach($serviceCode in @($rows | ForEach-Object {[string]$_.fldPSID} | Where-Object {$_.Trim()} | Sort-Object -Unique)){
    $services=@(Read-ApprovedRows $Connection $transaction "SELECT TOP (2) [fldPK] FROM [dbo].[tblProductsAndServices] WHERE [fldID]=@id AND [fldPS]='S'" $serviceCode NVarChar)
    if($services.Count -eq 1){$serviceKeys+=@{code=$serviceCode;sourceId=[string]$services[0].fldPK}}
   }
   $transaction.Commit()
  }catch{try{$transaction.Rollback()}catch{};throw}finally{$transaction.Dispose()}
  if($rows.Count -le 1000){$null=Send-Message @{action='PACKAGE_BUNDLE';summary=$headers[0];rows=@($rows);serviceKeys=@($serviceKeys)}}
 }
}
function Send-TicketBundles($Connection,$Manifest) {
 $summary=$Manifest | Where-Object {$_.table -eq 'tblTicketsSummary'}
 $lines=$Manifest | Where-Object {$_.table -eq 'tblTicketsRow'}
 if(-not $summary -or -not $lines){throw 'Ticket manifest is incomplete.'}
 $summaryColumns=($summary.columns | ForEach-Object {Quote-Identifier $_}) -join ','
 $lineColumns=($lines.columns | ForEach-Object {Quote-Identifier $_}) -join ','
 $ids=@(Read-ApprovedRows $Connection $null 'SELECT [fldPK] FROM [dbo].[tblTicketsSummary] ORDER BY [fldPK]' $null)
 foreach($key in $ids){
  # Hold a short read-only transaction so header and lines describe one version.
  # Commit before sending over HTTP; network latency never holds source locks.
  $transaction=$Connection.BeginTransaction([Data.IsolationLevel]::Serializable)
  try {
   $headers=@(Read-ApprovedRows $Connection $transaction ('SELECT '+$summaryColumns+' FROM [dbo].[tblTicketsSummary] WHERE [fldPK]=@id') $key.fldPK)
   if($headers.Count -ne 1){$transaction.Commit();continue}
   $matches=@(Read-ApprovedRows $Connection $transaction 'SELECT [fldPK] FROM [dbo].[tblTicketsSummary] WHERE [fldTicketID]=@id' $headers[0].fldTicketID)
   if($matches.Count -ne 1){throw 'Ambiguous source ticket number; review required.'}
   $rows=@(Read-ApprovedRows $Connection $transaction ('SELECT TOP (1001) '+$lineColumns+' FROM [dbo].[tblTicketsRow] WHERE [fldTicketID]=@id ORDER BY [fldRowOrder],[fldPK]') $headers[0].fldTicketID)
   if($rows.Count -gt 1000){throw 'Source ticket exceeds the supported bundle size.'}
   $transaction.Commit()
  }catch{try{$transaction.Rollback()}catch{};throw}finally{$transaction.Dispose()}
  $null=Send-Message @{action='TICKET_BUNDLE';summary=$headers[0];rows=@($rows)}
 }
}
