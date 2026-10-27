function Invoke-VerifiedWrite($Connection,$Operation,[string]$ConnectorIdentity){
 # A fixed operation allowlist, never arbitrary SQL from the network.
 $allowed=@{
  CUSTOMER_CONTACT=@{Table='tblClients';Key='fldClientID';Fields=@('fldFirstName','fldLastName','fldEMail','fldAddress','fldAddress2','fldCity','fldState','fldZIP')}
  PET_INSTRUCTIONS=@{Table='tblPets';Key='fldPetID';Fields=@('fldNotes','fldGroomComments','fldPersonalityComments','fldKennelComments','fldMedicalComments')}
 }
 if(-not $allowed.ContainsKey([string]$Operation.operation)){return 'FAILED'}
 $spec=$allowed[[string]$Operation.operation]
 $fields=@($Operation.values.PSObject.Properties.Name | Sort-Object)
 $expected=@($Operation.expected.PSObject.Properties.Name | Sort-Object)
 if(-not $fields.Count -or ($fields -join ',') -cne ($expected -join ',') -or @($fields | Where-Object {$_ -notin $spec.Fields}).Count){return 'FAILED'}
 $id=0;if(-not [int]::TryParse([string]$Operation.sourceId,[ref]$id) -or $id -lt 0){return 'FAILED'}
 $requestId=[Guid]::Empty;if(-not [Guid]::TryParse([string]$Operation.id,[ref]$requestId)){return 'FAILED'}
 $transaction=$Connection.BeginTransaction([Data.IsolationLevel]::Serializable)
 $command=$Connection.CreateCommand();$command.Transaction=$transaction;$command.CommandTimeout=30
 $committing=$false
 try{
  # Receipt storage must be installed and verified separately in the TEST DB.
  # Its absence fails before any source mutation. No automatic schema changes.
  $command.CommandText='SELECT Outcome FROM GroomProIntegration.WriteReceipt WITH (UPDLOCK,HOLDLOCK) WHERE ConnectorId=@connector AND RequestId=@request'
  $null=$command.Parameters.Add('@connector',[Data.SqlDbType]::NVarChar,191);$command.Parameters['@connector'].Value=$ConnectorIdentity
  $null=$command.Parameters.Add('@request',[Data.SqlDbType]::UniqueIdentifier);$command.Parameters['@request'].Value=$requestId
  $receipt=$command.ExecuteScalar()
  if($null -ne $receipt -and $receipt -ne [DBNull]::Value){$transaction.Commit();return [string]$receipt}
  $command.Parameters.Clear()
  $command.CommandText='SELECT '+(($fields | ForEach-Object {'['+$_+']'}) -join ',')+' FROM dbo.['+$spec.Table+'] WITH (UPDLOCK,HOLDLOCK) WHERE ['+$spec.Key+']=@id'
  $null=$command.Parameters.Add('@id',[Data.SqlDbType]::Int);$command.Parameters['@id'].Value=$id
  $reader=$command.ExecuteReader();$matches=$true
  try{
   if(-not $reader.Read()){$matches=$false}else{
    for($i=0;$i -lt $fields.Count;$i++){
     $actual=if($reader.IsDBNull($i)){$null}else{[string]$reader.GetValue($i)}
     if($actual -cne $Operation.expected.($fields[$i])){$matches=$false}
    }
    if($reader.Read()){$matches=$false}
   }
  }finally{$reader.Dispose()}
  $outcome='CONFLICT'
  if($matches){
   $sets=New-Object 'System.Collections.Generic.List[string]'
   for($i=0;$i -lt $fields.Count;$i++){
    $field=$fields[$i];$value=$Operation.values.$field
    if($null -ne $value -and $value -isnot [string]){throw 'Invalid value'}
    $sets.Add('['+$field+']=@v'+$i)
    $null=$command.Parameters.Add(('@v'+$i),[Data.SqlDbType]::NVarChar,-1)
    $command.Parameters['@v'+$i].Value=if($null -eq $value){[DBNull]::Value}else{$value}
   }
   $command.CommandText='UPDATE dbo.['+$spec.Table+'] SET '+($sets -join ',')+' WHERE ['+$spec.Key+']=@id'
   if($command.ExecuteNonQuery() -ne 1){throw 'Unexpected affected row count'}
   $outcome='APPLIED'
  }
  $command.Parameters.Clear()
  $command.CommandText='INSERT INTO GroomProIntegration.WriteReceipt (ConnectorId,RequestId,Outcome,CompletedAt) VALUES (@connector,@request,@outcome,SYSUTCDATETIME())'
  $null=$command.Parameters.Add('@connector',[Data.SqlDbType]::NVarChar,191);$command.Parameters['@connector'].Value=$ConnectorIdentity
  $null=$command.Parameters.Add('@request',[Data.SqlDbType]::UniqueIdentifier);$command.Parameters['@request'].Value=$requestId
  $null=$command.Parameters.Add('@outcome',[Data.SqlDbType]::NVarChar,20);$command.Parameters['@outcome'].Value=$outcome
  $null=$command.ExecuteNonQuery();$committing=$true;$transaction.Commit()
  return $outcome
 }catch{
  try{$transaction.Rollback()}catch{}
  if($committing){return 'UNCERTAIN'}
  return 'FAILED'
 }finally{$command.Dispose();$transaction.Dispose()}
}
