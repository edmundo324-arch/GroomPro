$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\connectors\123pet\Build-DemoPlan.ps1')
function Assert($condition,$message){if(-not $condition){throw $message}}
$data=@{locations=@([pscustomobject]@{id='loc';timezone='America/Chicago'});customers=@([pscustomobject]@{id='c';firstName='John';lastName='One';active=$true;phones=@()});employees=@([pscustomobject]@{id='e';firstName='Abby';lastName='E';displayName='Abby';active=$true});pets=@([pscustomobject]@{id='p';customerId='c';name='Gizmo1';active=$true});services=@([pscustomobject]@{id='s';name='Groom';priceCents=8000;durationMin=60;active=$true});products=@();packages=@();groomingNotes=@();tickets=@([pscustomobject]@{id='t';customerId='c';locationId='loc';scheduledStart='2026-11-01T15:00:00Z';closedAt='2026-11-01T17:00:00Z';status='CLOSED';timingMode='CONCURRENT';totalCents=8000;salesTaxCents=0;tipCents=0;payments=@([pscustomobject]@{paymentType='CASH';amount='80.00'});lines=@([pscustomobject]@{id='l';petId='p';serviceId='s';assignedUserId='e';lineType='SERVICE';description='Groom';quantity=1;unitPriceCents=8000;discountCents=0;totalCents=8000;durationMin=60;sortOrder=0})})}
$plan=@(New-DemoPlan $data)
Assert ($plan.Count -eq 7) 'Unexpected plan count.'
$ticket=@($plan|Where-Object {$_.key -eq 'ticket/t'})[0]
Assert ($ticket.values.fldTotal -eq 80) 'Cents were not converted to dollars.'
Assert ($ticket.values.fldDateScheduled.Hour -eq 0) 'Scheduled day must be separate from line time.'
$line=@($plan|Where-Object {$_.key -eq 'line/l'})[0]
Assert ($line.values.fldStartDateTime.Hour -eq 9) 'DST-aware Chicago appointment conversion failed.'
Assert ($line.values.fldEmployeeID.ref -eq 'employee/e') 'Employee association lost.'
Assert ($line.values.fldPetID.ref -eq 'pet/p') 'Pet association lost.'
Assert ($line.values.fldTicketID.ref -eq 'ticket/t') 'Ticket association lost.'
$again=@(New-DemoPlan $data)
Assert ($again[5].values.fldGuid -eq $plan[5].values.fldGuid) 'Stable replay identifiers failed.'
$data.tickets[0].totalCents=9000
$rejected=$false;try{New-DemoPlan $data|Out-Null}catch{$rejected=$true};Assert $rejected 'Inconsistent totals accepted.'
$data.tickets[0].totalCents=8000;$data.pets[0].customerId='wrong'
$rejected=$false;try{New-DemoPlan $data|Out-Null}catch{$rejected=$true};Assert $rejected 'Cross-customer pet accepted.'
Write-Host 'Demo plan: relationships, DST, dollar amounts, stable IDs, and rejection checks passed.'
# Package identity, native zero-total package heading and one billable child.
$data.pets[0].customerId='c'
$data.packages=@([pscustomobject]@{id='pkg';name='Medium Groom';basePriceCents=8000;active=$true;items=@([pscustomobject]@{id='pi';serviceId='s';quantity=1;sortOrder=0})})
$data.tickets[0].lines[0]|Add-Member packageId 'pkg'
$data.tickets[0].lines[0]|Add-Member packageGroupKey 'p:pkg'
$data.tickets[0].lines[0]|Add-Member packageName 'Medium Groom'
$packagePlan=@(New-DemoPlan $data)
$head=@($packagePlan|Where-Object {$_.table -eq 'tblTicketsRow' -and $_.values.fldPS -eq 'K'})
Assert ($head.Count -eq 1 -and $head[0].values.fldRowTotal -eq 0) 'Package heading charges twice.'
$child=@($packagePlan|Where-Object {$_.key -eq 'line/l'})[0]
Assert ($child.values.fldParentGuid -eq $head[0].values.fldGuid) 'Package child lost parent grouping.'
$item=@($packagePlan|Where-Object {$_.key -eq 'package-item/pi'})[0]
Assert ($item.values.fldRetail -eq 80) 'Package item price lost.'
$data.tickets[0].payments[0].paymentType='CARD'
$rejected=$false;try{New-DemoPlan $data|Out-Null}catch{$rejected=$true};Assert $rejected 'Unmapped tender silently converted.'
Write-Host 'Package grouping, prices, and unsupported-tender rejection passed.'
