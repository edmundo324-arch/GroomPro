# Converts the downloaded GroomPro snapshot to an explicit, dependency-ordered plan.
# References are resolved by the SQL writer, never by matching a pet name.
function New-DemoPlan($Data) {
 $rows=New-Object 'System.Collections.Generic.List[object]'
 function Ref($key,$field){return @{ref=$key;field=$field}}
 function Add($key,$table,$identity,$values){$rows.Add([pscustomobject]@{key=$key;table=$table;identity=$identity;values=$values})}
 function Money($n){return ([decimal]$n / 100)}
 function GuidFor($key){$h=[Security.Cryptography.SHA256]::Create();try{$b=$h.ComputeHash([Text.Encoding]::UTF8.GetBytes($key));return ([Guid]::new([byte[]]$b[0..15])).ToString()}finally{$h.Dispose()}}
 function Clock($v,$zone){if(-not $v){return $null};$z=if($zone -eq 'America/Chicago'){'Central Standard Time'}elseif($zone -eq 'America/New_York'){'Eastern Standard Time'}elseif($zone -eq 'America/Denver'){'Mountain Standard Time'}elseif($zone -eq 'America/Los_Angeles'){'Pacific Standard Time'}elseif($zone -eq 'UTC'){'UTC'}else{$zone};return [TimeZoneInfo]::ConvertTimeFromUtc(([DateTimeOffset]::Parse([string]$v)).UtcDateTime,[TimeZoneInfo]::FindSystemTimeZoneById($z))}
 $customers=@{};$pets=@{};$employees=@{};$locations=@{}
 foreach($r in $Data.locations){$locations[$r.id]=$r.timezone}
 foreach($r in $Data.customers){
  if($customers.ContainsKey($r.id)){throw 'Duplicate customer identifier.'};$customers[$r.id]=$r
  $phone=@($r.phones|Sort-Object isPrimary -Descending|Select-Object -First 1)
  Add ('customer/'+$r.id) 'tblClients' 'fldClientID' ([ordered]@{fldFirstName=$r.firstName;fldLastName=$r.lastName;fldEMail=$r.email;fldAddress=$r.address1;fldAddress2=$r.address2;fldCity=$r.city;fldState=$r.state;fldZIP=$r.postalCode;fldPrimaryPhoneNumber=$(if($phone.Count){$phone[0].number}else{$null});fldPopUp=$r.notes;fldClientHistory=$r.historyNotes;fldInactive=(-not $r.active);fldOptInStatus=1;fldHomePhone=$(($r.phones|Where-Object {$_.label -match "home"}|Select-Object -First 1).number);fldCellPhone=$(($r.phones|Where-Object {$_.label -match "mobile|cell"}|Select-Object -First 1).number);fldWorkPhone=$(($r.phones|Where-Object {$_.label -match "work"}|Select-Object -First 1).number);fldEmergencyContactName=$r.emergencyContactName;fldEmergencyContactNumber=$r.emergencyContactNumber;fldEmergencyContactRelationship=$r.emergencyContactRelationship;fldDoNotCall=[bool]$r.doNotCall;fldDoNotPostalMail=[bool]$r.doNotPostalMail;fldAptEmail=[bool]$r.appointmentEmail;fldAptSMS=[bool]$r.appointmentSms;fldLoyaltyPoints=[int]$r.loyaltyPoints;fldBalance=(Money ([int]$r.balanceCents-[int]$r.creditCents))})
 }
 foreach($r in $Data.employees){
  $employees[$r.id]=$r
  Add ('employee/'+$r.id) 'tblEmployees' 'fldEmployeeID' ([ordered]@{fldFirstName=$r.firstName;fldLastName=$r.lastName;fldABName=$r.displayName;fldActive=[bool]$r.active;fldShowOnApp=[bool]$r.active;fldShowOnSched=[bool]$r.active;fldShowOnTickets=$true;fldCategory=$r.jobTitle})
 }
 foreach($r in $Data.pets){
  if(-not $customers.ContainsKey($r.customerId)){throw 'Pet owner missing.'};$pets[$r.id]=$r
  Add ('pet/'+$r.id) 'tblPets' 'fldPetID' ([ordered]@{fldClientID=(Ref ('customer/'+$r.customerId) 'fldClientID');fldName=$r.name;fldBreed=$r.breed;fldType='Dog';fldWeight=[string]$r.weightLbs;fldGender=$r.gender;fldNotes=$r.notes;fldGroomComments=$r.groomingNotes;fldMedicalComments=$r.medicalNotes;fldPersonalityComments=$r.behaviorNotes;fldKennelComments=$r.kennelNotes;fldLength=$r.coatLength;fldTexture=$r.coatTexture;fldColor=$r.color;fldVet=$r.veterinarian;fldDOB=$(if($r.dateOfBirth){[DateTime]::Parse($r.dateOfBirth).Date}else{$null});fldInactive=(-not $r.active)})
 }
 foreach($kind in @('services','products')){foreach($r in $Data.$kind){
  $key=$kind+'/'+$r.id;$code='GP'+(GuidFor $key).Replace('-','').Substring(0,18)
  Add $key 'tblProductsAndServices' $null ([ordered]@{fldID=$code;fldPS=$(if($kind -eq 'products'){'P'}else{'S'});fldName=$r.name;fldRetail=(Money $r.priceCents);fldDur=$(if($kind -eq 'services'){[int]$r.durationMin}else{0});fldInactive=(-not $r.active);fldStockCount=$(if($kind -eq 'products'){[int]$r.quantity}else{0});fldWholeSale=(Money $r.costCents);fldTax1=$false;fldTax2=$false;fldTax3=$false})
 }}
 foreach($r in $Data.packages){
  $key='package/'+$r.id;$code='GP'+(GuidFor $key).Replace('-','').Substring(0,18)
  Add $key 'tblPackagesSummary' $null ([ordered]@{fldPackageID=$code;fldName=$r.name;fldComments=$r.description;fldInactive=(-not $r.active);fldRetail=(Money $r.basePriceCents)})
  $units=0;foreach($item in $r.items){if([int]$item.quantity -lt 1){throw 'Invalid package quantity.'};$units += [int]$item.quantity}
  $remaining=[decimal]$r.basePriceCents/100;$position=0
  foreach($item in $r.items){$position++;$share=if($position -eq @($r.items).Count){$remaining}else{[Math]::Floor([decimal]$r.basePriceCents*[int]$item.quantity/$units)/100};$remaining-=$share;$unit=[Math]::Round($share/[int]$item.quantity,4);if([Math]::Abs($unit*[int]$item.quantity-$share) -ge 0.005){throw 'Package quantity cannot represent its price exactly in 123Pet.'};if(-not $item.serviceId){throw 'Package item has no service.'};Add ('package-item/'+$item.id) 'tblPackagesRow' $null ([ordered]@{fldPackageID=$code;fldPackageItemGuid=(GuidFor ('package-item/'+$item.id));fldOrder=[int]$item.sortOrder;fldPSID=(Ref ('services/'+$item.serviceId) 'fldID');fldQuantity=[int]$item.quantity;fldQuantityUsed=[int]$item.quantity;fldRetail=$unit})}
 }
 foreach($t in $Data.tickets){
  if(-not $customers.ContainsKey($t.customerId) -or -not $locations.ContainsKey($t.locationId)){throw 'Ticket owner or location missing.'}
  $zone=$locations[$t.locationId];$start=Clock $t.scheduledStart $zone
  if(-not $start){throw 'A ticket has no appointment time. Review before transfer.'}
  $customer=$customers[$t.customerId];$closed=Clock $t.closedAt $zone
  $sum=[decimal]0;foreach($line in $t.lines){$sum += [decimal]$line.totalCents}
  if(($sum+[decimal]$t.salesTaxCents+[decimal]$t.tipCents) -ne [decimal]$t.totalCents){throw 'Ticket totals require reconciliation.'}
  $paid=[decimal]0;foreach($p in $t.payments){if($p.paymentType -ne 'CASH'){throw 'Non-cash payment needs a verified 123Pet tender mapping.'};$paid += [decimal]$p.amount}
  if($t.status -eq 'CLOSED' -and (($paid*100) -ne [decimal]$t.totalCents -or -not $closed)){throw 'Closed ticket payment or closure time does not reconcile.'}
  $status=if($t.status -eq 'CLOSED'){'Closed'}elseif($t.status -in @('CANCELLED','NO_SHOW')){'Voided'}else{'Open'}
  $key='ticket/'+$t.id
  Add $key 'tblTicketsSummary' 'fldTicketID' ([ordered]@{fldGuid=(GuidFor $key);fldTicketType=0;fldTicketStatus=$status;fldClientID=(Ref ('customer/'+$t.customerId) 'fldClientID');fldFirstName=$customer.firstName;fldLastName=$customer.lastName;fldDateScheduled=$start.Date;fldDateCreated=$(if($t.createdAt){(Clock $t.createdAt $zone).Date}else{$start.Date});fldTimeCreated=$(if($t.createdAt){Clock $t.createdAt $zone}else{$start});fldConfirm=$(if($t.status -in @('CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED')){'GroomPro confirmed'}else{$null});fldCompleted=($t.status -in @('READY','CLOSED'));fldDateClosed=$(if($closed){$closed.Date}else{$null});fldTimeClosed=$closed;fldSubtotal=(Money $sum);fldTax1=(Money $t.salesTaxCents);fldTax2=0;fldTax3=0;fldTip=(Money $t.tipCents);fldTotal=(Money $t.totalCents);fldTender1=$paid;fldTender2=0;fldPayType1=$(if($paid){'Cash'}else{$null});fldChange=0;fldCheckedIn=(Clock $t.checkedInAt $zone);fldPickupFull=(Clock $t.pickupCompletedAt $zone);fldComment=('GroomPro #'+$t.orderNumber+' '+$t.status+"`r`n"+$t.notes)})
  $offset=0;$groups=@{};$rowOrder=0
  foreach($l in $t.lines){
   if($l.petId -and (-not $pets.ContainsKey($l.petId) -or $pets[$l.petId].customerId -ne $t.customerId)){throw 'Ticket pet ownership mismatch.'}
   if($l.assignedUserId -and -not $employees.ContainsKey($l.assignedUserId)){throw 'Ticket employee missing.'}
   $ls=$start.AddMinutes($offset);$le=$ls.AddMinutes([int]$l.durationMin);if($t.timingMode -eq 'SEQUENTIAL'){$offset += [int]$l.durationMin}
   $group=$null
   if($l.packageGroupKey){$group=[string]$l.petId+'/'+[string]$l.packageGroupKey}
   if($group -and -not $groups.ContainsKey($group)){
    $groupKey='package-line/'+$t.id+'/'+$group;$groupGuid=GuidFor $groupKey;$groups[$group]=$groupGuid
    $packageTotal=[decimal]0;foreach($member in $t.lines){if($member.petId -eq $l.petId -and $member.packageGroupKey -eq $l.packageGroupKey){$packageTotal+=[decimal]$member.totalCents}}
    Add $groupKey 'tblTicketsRow' $null ([ordered]@{fldGuid=$groupGuid;fldTicketID=(Ref $key 'fldTicketID');fldQuoteID=0;fldPetID=$(if($l.petId){Ref ('pet/'+$l.petId) 'fldPetID'}else{$null});fldPetName=$(if($l.petId){$pets[$l.petId].name}else{$null});fldID=$(if($l.packageId){Ref ('package/'+$l.packageId) 'fldPackageID'}else{$null});fldPS='K';fldDescription=$l.packageName;fldQuantity=1;fldQuantityUsed=0;fldPrice=(Money $packageTotal);fldRowTotal=0;fldRowSubTotal=0;fldRowOrder=$rowOrder;fldStartDateTime=$ls;fldEndDateTime=$ls;fldStartDate=$ls.Date;fldEndDate=$ls.Date;fldStartTime=$ls;fldEndTime=$ls});$rowOrder++
   }
   $employee=if($l.assignedUserId){$employees[$l.assignedUserId]}else{$null}
   $catalog=if($l.productId){Ref ('products/'+$l.productId) 'fldID'}elseif($l.serviceId){Ref ('services/'+$l.serviceId) 'fldID'}else{$null}
   Add ('line/'+$l.id) 'tblTicketsRow' $null ([ordered]@{fldGuid=(GuidFor ('line/'+$l.id));fldParentGuid=$(if($group){$groups[$group]}else{$null});fldTicketID=(Ref $key 'fldTicketID');fldQuoteID=0;fldPetID=$(if($l.petId){Ref ('pet/'+$l.petId) 'fldPetID'}else{$null});fldPetName=$(if($l.petId){$pets[$l.petId].name}else{$null});fldEmployeeID=$(if($employee){Ref ('employee/'+$employee.id) 'fldEmployeeID'}else{$null});fldEmployeeName=$(if($employee){($employee.firstName+' '+$employee.lastName).Trim()}else{$null});fldID=$catalog;fldPS=$(if($l.lineType -eq 'PRODUCT'){'P'}else{'S'});fldDescription=$l.description;fldCategory=$l.role;fldQuantity=[decimal]$l.quantity;fldQuantityUsed=[decimal]$l.quantity;fldPrice=(Money $l.unitPriceCents);fldDiscountCurrency=(Money $l.discountCents);fldDiscountPercent=0;fldRowSubTotal=(Money ($l.unitPriceCents*$l.quantity));fldRowTotal=(Money $l.totalCents);fldRowOrder=$rowOrder;fldStartDateTime=$ls;fldEndDateTime=$le;fldStartDate=$ls.Date;fldEndDate=$le.Date;fldStartTime=$ls;fldEndTime=$le;fldTaxable=$false;fldTax1Apply=$false;fldTax2Apply=$false;fldTax3Apply=$false;fldTax1Amount=0;fldTax2Amount=0;fldTax3Amount=0});$rowOrder++
  }
  $notes=@($Data.groomingNotes|Where-Object {$_.ticketId -eq $t.id})
  $historyLines=New-Object 'System.Collections.Generic.List[string]'
  $historyLines.Add('Imported from GroomPro #'+$t.orderNumber+'; original status: '+$t.status)
  foreach($note in $notes){
   $labels=@{classification='Grooming type';body='Body';tbf='Face/TBF';ears='Ears';tail='Tail';specialNotes='Special notes'}
   $historyLines.Add($pets[$note.petId].name+' — '+[string]$note.appointmentAt)
   foreach($field in @('classification','body','tbf','ears','tail','specialNotes')){if($note.instructions.$field){$historyLines.Add($labels[$field]+': '+$note.instructions.$field)}}
   if($note.usual){$historyLines.Add("Saved as this dog's usual haircut.")}
   foreach($snapshotName in @('closureSnapshot','finalSnapshot')){if($note.$snapshotName){$historyLines.Add($snapshotName+': '+($note.$snapshotName|ConvertTo-Json -Compress -Depth 12))}}
  }
  foreach($a in $t.assignments){if(-not $employees.ContainsKey($a.userId)){throw 'Historical assignment employee missing.'};$e=$employees[$a.userId];$historyLines.Add($a.role+': '+$e.firstName+' '+$e.lastName+'; assigned '+$a.assignedAt)}
  foreach($move in $t.scheduleHistory){$historyLines.Add('Appointment '+$move.changeType+': '+$move.previousStart+' -> '+$move.newStart+' at '+$move.changedAt)}
  $history=$historyLines -join "`r`n"
  Add ('history/'+$t.id) 'tblTicketsHistory' $null ([ordered]@{fldTicketID=(Ref $key 'fldTicketID');fldHistory=$history})
 }
 return $rows.ToArray()
}
