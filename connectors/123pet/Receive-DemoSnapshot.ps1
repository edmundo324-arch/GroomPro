function Receive-DemoSnapshot([string]$CredentialPath){
 $job=(Send-Message @{action='INITIAL_SETUP'}).batch
 if($null -eq $job -or $job.state -ne 'PREPARED'){return}
 $jobId=[Guid]::Empty
 if(-not [Guid]::TryParse([string]$job.jobId,[ref]$jobId)){throw 'Invalid initial setup identifier.'}
 $folder=Join-Path (Split-Path -Parent $CredentialPath) ('initial-setup-'+$jobId.ToString('N'))
 $null=New-Item -ItemType Directory -Force -Path $folder
 $complete=Join-Path $folder 'received.json'
 if(Test-Path -LiteralPath $complete){return}
 $count=[int]$job.chunks
 if($count -lt 0 -or $count -gt 100000){throw 'Invalid initial setup size.'}
 for($i=0;$i -lt $count;$i++){
  $chunk=(Send-Message @{action='SNAPSHOT_CHUNK';jobId=$job.jobId;index=$i}).batch
  if($chunk.jobId -ne $job.jobId -or $chunk.index -ne $i -or $chunk.total -ne $count){throw 'Initial setup changed during download. Try the current snapshot.'}
  # Local source data stays protected by Windows DPAPI, never clear JSON files.
  $json=$chunk | ConvertTo-Json -Depth 80 -Compress
  $protected=ConvertTo-SecureString -String $json -AsPlainText -Force
  $protected | Export-Clixml -LiteralPath (Join-Path $folder ('chunk-'+$i+'.xml'))
 }
 [ordered]@{jobId=$job.jobId;chunks=$count;receivedAt=[DateTime]::UtcNow.ToString('o');writesExecuted=0} | ConvertTo-Json | Set-Content -LiteralPath $complete -Encoding UTF8
 Write-Host 'GroomPro initial data received privately for compatibility review. No 123Pet records have been written.'
}
