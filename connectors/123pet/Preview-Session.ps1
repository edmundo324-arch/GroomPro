# Private Airo preview access is separate from the connector credential.
function Open-GroomProPreviewSession([Uri]$Origin,[string]$PreviewAccessPath){
 $session=New-Object Microsoft.PowerShell.Commands.WebRequestSession
 if(-not $PreviewAccessPath){return $session}
 $protected=Import-Clixml -LiteralPath $PreviewAccessPath
 if($protected -isnot [Security.SecureString]){throw 'Invalid private preview access file.'}
 $share=(New-Object Management.Automation.PSCredential('preview',$protected)).GetNetworkCredential().Password
 try{
  $entry=$Origin.GetLeftPart([UriPartial]::Authority)+'/?airoShareToken='+[Uri]::EscapeDataString($share)
  try{$null=Invoke-WebRequest -UseBasicParsing -Uri $entry -WebSession $session -MaximumRedirection 0 -TimeoutSec 30}catch{
   $status=[int]$_.Exception.Response.StatusCode
   if($status -notin @(301,302,303,307,308)){throw 'The private GoDaddy preview link has expired or is unavailable. Run setup with a current share link.'}
  }
  return $session
 }finally{$share=$null;$entry=$null}
}
