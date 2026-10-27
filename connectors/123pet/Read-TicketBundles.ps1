function Read-ApprovedRows($Connection,$Transaction,[string]$Sql,$Parameter) {
 $command=$Connection.CreateCommand();$command.Transaction=$Transaction;$command.CommandTimeout=30;$command.CommandText=$Sql
 if($null -ne $Parameter){$null=$command.Parameters.Add('@id',[Data.SqlDbType]::Int);$command.Parameters['@id'].Value=[int]$Parameter}
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
