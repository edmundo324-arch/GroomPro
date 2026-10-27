param(
 [string]$Server='DESKTOP-L2J4TSD\DSI',
 [string]$Database='OneTwoThreePet',
 [string]$OutputPath=(Join-Path $PSScriptRoot '123pet-schema.json'),
 [switch]$TrustLocalCertificate
)
$ErrorActionPreference='Stop'
# Metadata only: no customer data, passwords, notes, or database mutations.
$builder=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source']=$Server
$builder['Initial Catalog']=$Database
$builder['Integrated Security']=$true
$builder['Encrypt']=$true
$builder['TrustServerCertificate']=[bool]$TrustLocalCertificate
$builder['Connect Timeout']=10
$connection=New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString
function Read-Metadata([string]$Sql){
 $command=$connection.CreateCommand();$command.CommandText=$Sql;$command.CommandTimeout=30
 $reader=$command.ExecuteReader();$rows=New-Object 'System.Collections.Generic.List[object]'
 try {while($reader.Read()){$row=[ordered]@{};for($i=0;$i -lt $reader.FieldCount;$i++){$row[$reader.GetName($i)]=if($reader.IsDBNull($i)){$null}else{$reader.GetValue($i)}};$rows.Add([pscustomobject]$row)}}finally{$reader.Dispose();$command.Dispose()}
 return $rows.ToArray()
}
try{
 $connection.Open()
 $report=[ordered]@{
  formatVersion=1;capturedAt=[DateTime]::UtcNow.ToString('o');server=$Server;database=$Database
  engine=@(Read-Metadata "SELECT CAST(SERVERPROPERTY('ProductVersion') AS nvarchar(128)) productVersion, CAST(SERVERPROPERTY('Edition') AS nvarchar(128)) edition, compatibility_level, snapshot_isolation_state, is_read_committed_snapshot_on, is_cdc_enabled FROM sys.databases WHERE database_id=DB_ID()")
  permissions=@(Read-Metadata "SELECT permission_name FROM fn_my_permissions(NULL,'DATABASE')")
  columns=@(Read-Metadata "SELECT s.name [schema],t.name [table],c.name [column],ty.name [type],c.max_length,c.precision,c.scale,c.is_nullable,c.is_identity,c.is_computed,c.column_id FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE t.is_ms_shipped=0 ORDER BY s.name,t.name,c.column_id")
  keys=@(Read-Metadata "SELECT s.name [schema],t.name [table],i.name [index],i.is_primary_key,i.is_unique,c.name [column],ic.key_ordinal FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id JOIN sys.indexes i ON i.object_id=t.object_id JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=t.object_id AND c.column_id=ic.column_id WHERE (i.is_primary_key=1 OR i.is_unique=1) AND ic.key_ordinal>0 ORDER BY s.name,t.name,i.name,ic.key_ordinal")
  relationships=@(Read-Metadata "SELECT fk.name,OBJECT_SCHEMA_NAME(fk.parent_object_id) parentSchema,OBJECT_NAME(fk.parent_object_id) parentTable,pc.name parentColumn,OBJECT_SCHEMA_NAME(fk.referenced_object_id) referencedSchema,OBJECT_NAME(fk.referenced_object_id) referencedTable,rc.name referencedColumn,fk.delete_referential_action_desc,fk.update_referential_action_desc FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fc ON fc.constraint_object_id=fk.object_id JOIN sys.columns pc ON pc.object_id=fc.parent_object_id AND pc.column_id=fc.parent_column_id JOIN sys.columns rc ON rc.object_id=fc.referenced_object_id AND rc.column_id=fc.referenced_column_id")
  changeTracking=@(Read-Metadata "SELECT OBJECT_SCHEMA_NAME(object_id) [schema],OBJECT_NAME(object_id) [table],is_track_columns_updated_on,begin_version,min_valid_version FROM sys.change_tracking_tables")
  trackingSettings=@(Read-Metadata "SELECT retention_period,retention_period_units_desc,is_auto_cleanup_on FROM sys.change_tracking_databases WHERE database_id=DB_ID()")
  triggers=@(Read-Metadata "SELECT OBJECT_SCHEMA_NAME(parent_id) [schema],OBJECT_NAME(parent_id) [table],name,is_disabled,is_instead_of_trigger FROM sys.triggers WHERE parent_class=1")
  defaults=@(Read-Metadata "SELECT OBJECT_SCHEMA_NAME(d.parent_object_id) [schema],OBJECT_NAME(d.parent_object_id) [table],c.name [column],d.definition FROM sys.default_constraints d JOIN sys.columns c ON c.object_id=d.parent_object_id AND c.column_id=d.parent_column_id")
  checks=@(Read-Metadata "SELECT OBJECT_SCHEMA_NAME(parent_object_id) [schema],OBJECT_NAME(parent_object_id) [table],name,definition,is_disabled FROM sys.check_constraints")
 }
 $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
 Write-Host "Metadata saved to $OutputPath. No 123Pet records were changed."
}finally{$connection.Dispose()}
