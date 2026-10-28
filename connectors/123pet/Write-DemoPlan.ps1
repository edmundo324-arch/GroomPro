# Add/update only. One SQL transaction includes mapping receipts and read-back checks.
# A committed receipt makes retries safe; no payment processor is ever called.
function Invoke-DemoPlan($Connection,$Plan,[string]$Origin,[string]$JobId,[switch]$Apply,[scriptblock]$BeforeCommit){
 $tables=@('tblClients','tblEmployees','tblPets','tblProductsAndServices','tblPackagesSummary','tblPackagesRow','tblTicketsSummary','tblTicketsRow','tblTicketsHistory')
 $tx=$Connection.BeginTransaction([Data.IsolationLevel]::Serializable)
 $cmd=$Connection.CreateCommand();$cmd.Transaction=$tx;$cmd.CommandTimeout=120
 function Query($sql,$parameters){
  $cmd.Parameters.Clear();$cmd.CommandText=$sql
  foreach($k in $parameters.Keys){$value=$parameters[$k];$null=$cmd.Parameters.AddWithValue('@'+$k,$(if($null -eq $value){[DBNull]::Value}else{$value}))}
  $reader=$cmd.ExecuteReader();$result=New-Object 'System.Collections.Generic.List[object]'
  try{while($reader.Read()){$v=[ordered]@{};for($i=0;$i -lt $reader.FieldCount;$i++){$v[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};$result.Add([pscustomobject]$v)}}finally{$reader.Dispose()}
  return $result.ToArray()
 }
 function Fingerprint($values){$h=[Security.Cryptography.SHA256]::Create();try{$ordered=[ordered]@{};foreach($k in @($values.Keys|Sort-Object)){$v=$values[$k];$ordered[$k]=if($v -is [DateTime]){$v.ToString('yyyy-MM-ddTHH:mm:ss.fff')}elseif($null -eq $v){$null}else{[string]$v}};return ([BitConverter]::ToString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes(($ordered|ConvertTo-Json -Compress -Depth 5))))).Replace('-','')}finally{$h.Dispose()}}
 try{
  $lock=Query "DECLARE @r int; EXEC @r=sp_getapplock @Resource='GroomProDemoImport',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=0; SELECT @r result" @{}
  if($lock[0].result -lt 0){throw 'Another import is running.'}
  $null=Query "IF SCHEMA_ID('GroomProIntegration') IS NULL EXEC('CREATE SCHEMA GroomProIntegration'); IF OBJECT_ID('GroomProIntegration.DemoMap') IS NULL CREATE TABLE GroomProIntegration.DemoMap(Origin nvarchar(256) NOT NULL,SourceKey nvarchar(191) NOT NULL,TableName nvarchar(64) NOT NULL,TargetPK int NOT NULL,LastHash varchar(64) NOT NULL,CONSTRAINT PK_GroomProDemoMap PRIMARY KEY(Origin,SourceKey)); IF OBJECT_ID('GroomProIntegration.DemoJob') IS NULL CREATE TABLE GroomProIntegration.DemoJob(Origin nvarchar(256) NOT NULL,JobId uniqueidentifier NOT NULL,ImportedRows int NOT NULL,CompletedAt datetime2 NOT NULL,CONSTRAINT PK_GroomProDemoJob PRIMARY KEY(Origin,JobId));" @{}
  $receipt=@(Query 'SELECT ImportedRows FROM GroomProIntegration.DemoJob WHERE Origin=@origin AND JobId=@job' @{origin=$Origin;job=[Guid]$JobId})
  if($receipt.Count){$tx.Rollback();return @{state='ALREADY_APPLIED';rows=$receipt[0].ImportedRows}}
  $columns=@(Query "SELECT t.name TableName,c.name ColumnName,ty.name TypeName,c.max_length,c.is_identity,c.is_computed FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE SCHEMA_NAME(t.schema_id)='dbo'" @{})
  $plannedKeys=@{};foreach($r in $Plan){$plannedKeys[$r.key]=$true}
  $previous=@(Query 'SELECT SourceKey FROM GroomProIntegration.DemoMap WHERE Origin=@origin' @{origin=$Origin})
  foreach($r in $previous){if(-not $plannedKeys.ContainsKey([string]$r.SourceKey)){throw 'A previously imported record is absent from the new snapshot. Review removals before updating; no rows were deleted.'}}
  $resolved=@{};$seen=@{};$inserted=0;$updated=0;$unchanged=0
  foreach($row in $Plan){
   if($row.table -notin $tables -or $seen.ContainsKey($row.key)){throw 'Unsupported or duplicate planned entity.'};$seen[$row.key]=$true
   $values=[ordered]@{}
   foreach($k in $row.values.Keys){
    $column=@($columns|Where-Object {$_.TableName -ceq $row.table -and $_.ColumnName -ceq $k -and -not $_.is_identity -and -not $_.is_computed})
    if($column.Count -ne 1 -or $k -notmatch '^fld[A-Za-z0-9_]+$'){throw ('Unsupported destination field: '+$row.table+'.'+$k)}
    $v=$row.values[$k]
    if($v -is [Collections.IDictionary] -and $v.Contains('ref')){if(-not $resolved.ContainsKey($v.ref)){throw ('Missing dependency: '+$v.ref)};$v=$resolved[$v.ref][$v.field]}
    if($v -is [string] -and $column[0].max_length -gt 0 -and $column[0].TypeName -in @('nvarchar','nchar') -and $v.Length -gt ($column[0].max_length/2)){throw ('Text exceeds destination capacity: '+$row.table+'.'+$k)}
    if($null -ne $v -and $column[0].TypeName -in @('datetime','datetime2','date','smalldatetime') -and $v -isnot [DateTime]){throw ('Expected a date for '+$row.table+'.'+$k)}
    if($v -is [bool] -and $column[0].TypeName -ne 'bit'){throw ('Boolean mapped to a non-boolean field: '+$row.table+'.'+$k)}
    $values[$k]=$v
   }
   $map=@(Query 'SELECT TableName,TargetPK,LastHash FROM GroomProIntegration.DemoMap WHERE Origin=@origin AND SourceKey=@key' @{origin=$Origin;key=$row.key})
   $pk=$null;$old=$null
   if($map.Count){
    if($map[0].TableName -cne $row.table){throw 'Stored mapping table changed.'};$pk=[int]$map[0].TargetPK
    $selectKeys=@($values.Keys);if($row.identity){$selectKeys+=$row.identity};$selection=($selectKeys|ForEach-Object {'['+$_+']'}) -join ','
    $oldRows=@(Query ('SELECT '+$selection+' FROM dbo.['+$row.table+'] WITH(UPDLOCK,HOLDLOCK) WHERE fldPK=@pk') @{pk=$pk})
    if($oldRows.Count -ne 1){throw 'Previously imported record is missing.'};$old=$oldRows[0]
    $oldValues=[ordered]@{};foreach($k in $values.Keys){$oldValues[$k]=$old.$k};if($row.identity){$oldValues[$row.identity]=$old.($row.identity)}
    if((Fingerprint $oldValues) -cne $map[0].LastHash){throw ('123Pet record changed after import: '+$row.key)}
   }
   if($row.identity){
    if($row.identity -notin @('fldClientID','fldEmployeeID','fldPetID','fldTicketID')){throw 'Unsupported identity.'}
    $values[$row.identity]=if($old){$old.($row.identity)}else{[int](Query ('SELECT COALESCE(MAX(['+$row.identity+']),0)+1 NextID FROM dbo.['+$row.table+'] WITH(UPDLOCK,HOLDLOCK)') @{})[0].NextID}
   }
   $parameters=@{};$names=New-Object 'System.Collections.Generic.List[string]';$sets=New-Object 'System.Collections.Generic.List[string]';$holders=New-Object 'System.Collections.Generic.List[string]';$i=0
   foreach($k in $values.Keys){$parameters['v'+$i]=$values[$k];$names.Add('['+$k+']');$sets.Add('['+$k+']=@v'+$i);$holders.Add('@v'+$i);$i++}
   if($old){$parameters.pk=$pk;$null=Query ('UPDATE dbo.['+$row.table+'] SET '+($sets -join ',')+' WHERE fldPK=@pk') $parameters;$updated++}
   else{$pk=[int](Query ('INSERT INTO dbo.['+$row.table+'] ('+($names -join ',')+') VALUES ('+($holders -join ',')+'); SELECT CAST(SCOPE_IDENTITY() AS int) NewPK') $parameters)[0].NewPK;$inserted++}
   $readback=@(Query ('SELECT '+($names -join ',')+' FROM dbo.['+$row.table+'] WHERE fldPK=@pk') @{pk=$pk})
   if($readback.Count -ne 1){throw 'Import verification could not find its record.'}
   $verified=[ordered]@{};foreach($k in $values.Keys){$verified[$k]=$readback[0].$k}
   # Compare using SQL-typed values, allowing decimal formatting differences.
   foreach($k in $values.Keys){$expected=$values[$k];$actual=$verified[$k];if($null -eq $expected){if($null -ne $actual){throw 'Read-back verification failed.'}}elseif($expected -is [decimal] -or $expected -is [int]){if([decimal]$expected -ne [decimal]$actual){throw 'Numeric read-back verification failed.'}}elseif($expected -is [DateTime]){if([Math]::Abs(($expected-[DateTime]$actual).TotalMilliseconds) -gt 4){throw 'Date read-back verification failed.'}}elseif([string]$expected -cne [string]$actual){throw 'Text read-back verification failed.'}}
   $hash=Fingerprint $verified
   $null=Query 'UPDATE GroomProIntegration.DemoMap SET LastHash=@hash WHERE Origin=@origin AND SourceKey=@key; IF @@ROWCOUNT=0 INSERT INTO GroomProIntegration.DemoMap(Origin,SourceKey,TableName,TargetPK,LastHash) VALUES(@origin,@key,@table,@pk,@hash)' @{origin=$Origin;key=$row.key;table=$row.table;pk=$pk;hash=$hash}
   $resolved[$row.key]=$verified
  }
  $null=Query 'INSERT INTO GroomProIntegration.DemoJob(Origin,JobId,ImportedRows,CompletedAt) VALUES(@origin,@job,@count,SYSUTCDATETIME())' @{origin=$Origin;job=[Guid]$JobId;count=$Plan.Count}
  if($Apply){if(-not $BeforeCommit){throw 'Missing write authorization.'};& $BeforeCommit | Out-Null;$tx.Commit();return @{state='APPLIED';rows=$Plan.Count;inserted=$inserted;updated=$updated}}
  $tx.Rollback();return @{state='VALIDATED_ROLLED_BACK';rows=$Plan.Count;inserted=$inserted;updated=$updated}
 }catch{try{$tx.Rollback()}catch{};throw}finally{$cmd.Dispose();$tx.Dispose()}
}
