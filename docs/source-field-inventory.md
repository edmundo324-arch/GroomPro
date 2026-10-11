# Source field inventory

All 247 source headers are inventoried. This report contains no source record values. Unresolved relationships and conflicting contacts block operational import.

| Source | Field | Destination | Disposition |
| --- | --- | --- | --- |
| Clients.xlsx | Address | customer.address1 | OPERATIONAL |
| Clients.xlsx | Address2 | customer.address2 | OPERATIONAL |
| Clients.xlsx | Anniversary | customer.anniversary | OPERATIONAL |
| Clients.xlsx | AptEmail | customer.appointmentEmail | OPERATIONAL |
| Clients.xlsx | AptSMS | customer.appointmentSms | OPERATIONAL |
| Clients.xlsx | Balance | Linked historical source record | HISTORICAL |
| Clients.xlsx | BalanceComment | Linked historical source record | HISTORICAL |
| Clients.xlsx | CardConnectProfileAccountID | Encrypted source record | SECURE |
| Clients.xlsx | CellEmail | Linked historical source record | HISTORICAL |
| Clients.xlsx | CellPhone | customer.phone:Cell | OPERATIONAL |
| Clients.xlsx | Children | Linked historical source record | HISTORICAL |
| Clients.xlsx | City | customer.city | OPERATIONAL |
| Clients.xlsx | Class | Linked historical source record | HISTORICAL |
| Clients.xlsx | ClientHistory | customer.historyNotes | OPERATIONAL |
| Clients.xlsx | ClientID | customer.importSourceId | OPERATIONAL |
| Clients.xlsx | Comment | customer.notes | OPERATIONAL |
| Clients.xlsx | DateCreated | customer.sourceCreatedAt | OPERATIONAL |
| Clients.xlsx | DateOfBirth | customer.dateOfBirth | OPERATIONAL |
| Clients.xlsx | DocumentFolder | customer.documentFolder | OPERATIONAL |
| Clients.xlsx | DoNotCall | customer.doNotCall | OPERATIONAL |
| Clients.xlsx | DoNotPostalMail | customer.doNotPostalMail | OPERATIONAL |
| Clients.xlsx | E-mail | customer.email | OPERATIONAL |
| Clients.xlsx | EmergencyContactName | customer.emergencyContactName | OPERATIONAL |
| Clients.xlsx | EmergencyContactNumber | customer.emergencyContactNumber | OPERATIONAL |
| Clients.xlsx | EmergencyContactRelationship | customer.emergencyContactRelationship | OPERATIONAL |
| Clients.xlsx | EncryptedInformation | Encrypted source record | SECURE |
| Clients.xlsx | FirstEmployeeID | Linked historical source record | HISTORICAL |
| Clients.xlsx | FirstEmployeeName | Linked historical source record | HISTORICAL |
| Clients.xlsx | FirstName | customer.firstName | OPERATIONAL |
| Clients.xlsx | FirstVisit | customer.firstVisit | OPERATIONAL |
| Clients.xlsx | Guid | Linked historical source record | HISTORICAL |
| Clients.xlsx | Phone | customer.phone:Main | OPERATIONAL |
| Clients.xlsx | IDCard | Encrypted source record | SECURE |
| Clients.xlsx | Inactive | customer.active | OPERATIONAL |
| Clients.xlsx | InvalidEmail | customer.invalidEmail | OPERATIONAL |
| Clients.xlsx | InvalidSmsNumber | customer.invalidSmsNumber | OPERATIONAL |
| Clients.xlsx | Item | Linked historical source record | HISTORICAL |
| Clients.xlsx | ItemComment | Linked historical source record | HISTORICAL |
| Clients.xlsx | LastEmployeeID | Linked historical source record | HISTORICAL |
| Clients.xlsx | LastEmployeeName | Linked historical source record | HISTORICAL |
| Clients.xlsx | LastName | customer.lastName | OPERATIONAL |
| Clients.xlsx | LastVisit | customer.lastVisit | OPERATIONAL |
| Clients.xlsx | Link | Linked historical source record | HISTORICAL |
| Clients.xlsx | LoyaltyPoints | Linked historical source record | HISTORICAL |
| Clients.xlsx | LoyaltyPointsComment | Linked historical source record | HISTORICAL |
| Clients.xlsx | Mailing | Linked historical source record | HISTORICAL |
| Clients.xlsx | NoShow | Linked historical source record | HISTORICAL |
| Clients.xlsx | Occupation | customer.occupation | OPERATIONAL |
| Clients.xlsx | OnlineID | Linked historical source record | HISTORICAL |
| Clients.xlsx | OptInStatus | customer.consentStatus | OPERATIONAL |
| Clients.xlsx | ProductDiscountPercent | Linked historical source record | HISTORICAL |
| Clients.xlsx | PK | Linked historical source record | HISTORICAL |
| Clients.xlsx | PopUp | customer.popupNotes | OPERATIONAL |
| Clients.xlsx | PreferredEmployeeID | customer.preferredEmployeeId | OPERATIONAL |
| Clients.xlsx | PreferredEmployeeName | Linked historical source record | HISTORICAL |
| Clients.xlsx | PrimaryPhone | Linked historical source record | HISTORICAL |
| Clients.xlsx | PrimaryPhoneNumber | customer.phone:Primary | OPERATIONAL |
| Clients.xlsx | PrimaryPictureGuid | customer.pictureGuid | OPERATIONAL |
| Clients.xlsx | QuickBooksEditSequence | Linked historical source record | HISTORICAL |
| Clients.xlsx | QuickBooksExport | Linked historical source record | HISTORICAL |
| Clients.xlsx | QuickBooksID | Linked historical source record | HISTORICAL |
| Clients.xlsx | QuickBooksSyncDate | Linked historical source record | HISTORICAL |
| Clients.xlsx | ServiceDiscountPercent | Linked historical source record | HISTORICAL |
| Clients.xlsx | Gender | customer.gender | OPERATIONAL |
| Clients.xlsx | Spouse | customer.spouse | OPERATIONAL |
| Clients.xlsx | State | customer.state | OPERATIONAL |
| Clients.xlsx | Title | customer.title | OPERATIONAL |
| Clients.xlsx | TotalVisits | customer.totalVisits | OPERATIONAL |
| Clients.xlsx | WorkPhone | customer.phone:Work | OPERATIONAL |
| Clients.xlsx | ZIP | customer.postalCode | OPERATIONAL |
| Pets.xlsx | ClientID | pet.customerId | OPERATIONAL |
| Pets.xlsx | AgWithAnimals | pet.careFlags:AgWithAnimals | OPERATIONAL |
| Pets.xlsx | AgWithPeople | pet.careFlags:AgWithPeople | OPERATIONAL |
| Pets.xlsx | Barker | pet.careFlags:Barker | OPERATIONAL |
| Pets.xlsx | Biter | pet.careFlags:Biter | OPERATIONAL |
| Pets.xlsx | Blind | pet.careFlags:Blind | OPERATIONAL |
| Pets.xlsx | Breed | pet.breed | OPERATIONAL |
| Pets.xlsx | Breeding | pet.breedingStatus | OPERATIONAL |
| Pets.xlsx | Burns | pet.careFlags:Burns | OPERATIONAL |
| Pets.xlsx | Chews | pet.careFlags:Chews | OPERATIONAL |
| Pets.xlsx | Color | pet.color | OPERATIONAL |
| Pets.xlsx | Comments | Linked historical source record | HISTORICAL |
| Pets.xlsx | Dead | pet.careFlags:Dead | OPERATIONAL |
| Pets.xlsx | Deaf | pet.careFlags:Deaf | OPERATIONAL |
| Pets.xlsx | Diabetic | pet.careFlags:Diabetic | OPERATIONAL |
| Pets.xlsx | DateOfBirth | pet.dateOfBirth | OPERATIONAL |
| Pets.xlsx | Epileptic | pet.careFlags:Epileptic | OPERATIONAL |
| Pets.xlsx | Gender | pet.gender | OPERATIONAL |
| Pets.xlsx | GroomComments | pet.groomingNotes | OPERATIONAL |
| Pets.xlsx | GroomLevel | Linked historical source record | HISTORICAL |
| Pets.xlsx | HairDryer | pet.careFlags:HairDryer | OPERATIONAL |
| Pets.xlsx | Heart | pet.careFlags:Heart | OPERATIONAL |
| Pets.xlsx | Hyper | pet.careFlags:Hyper | OPERATIONAL |
| Pets.xlsx | Inactive | pet.active | OPERATIONAL |
| Pets.xlsx | KennelComments | pet.kennelNotes | OPERATIONAL |
| Pets.xlsx | LastVisit | pet.lastVisit | OPERATIONAL |
| Pets.xlsx | LeashOn | pet.careFlags:LeashOn | OPERATIONAL |
| Pets.xlsx | Length | pet.coatLength | OPERATIONAL |
| Pets.xlsx | MedicalComments | pet.medicalNotes | OPERATIONAL |
| Pets.xlsx | Name | pet.name | OPERATIONAL |
| Pets.xlsx | Notes | pet.notes | OPERATIONAL |
| Pets.xlsx | PersonalityComments | pet.behaviorNotes | OPERATIONAL |
| Pets.xlsx | PetID | pet.importSourceId | OPERATIONAL |
| Pets.xlsx | PK | Linked historical source record | HISTORICAL |
| Pets.xlsx | PrimaryPictureGuid | pet.pictureGuid | OPERATIONAL |
| Pets.xlsx | Rabies | pet.careFlags:Rabies | OPERATIONAL |
| Pets.xlsx | SensitiveSkin | pet.careFlags:SensitiveSkin | OPERATIONAL |
| Pets.xlsx | Shy | pet.careFlags:Shy | OPERATIONAL |
| Pets.xlsx | Texture | pet.coatTexture | OPERATIONAL |
| Pets.xlsx | Type | pet.species | OPERATIONAL |
| Pets.xlsx | Vet | pet.veterinarian | OPERATIONAL |
| Pets.xlsx | Weight | pet.weightDescription | OPERATIONAL |
| Employees.xlsx | ABComment | Linked historical source record | HISTORICAL |
| Employees.xlsx | ABName | user.displayName | OPERATIONAL |
| Employees.xlsx | Active | Linked historical source record | HISTORICAL |
| Employees.xlsx | Address | user.address1 | OPERATIONAL |
| Employees.xlsx | Address2 | user.address2 | OPERATIONAL |
| Employees.xlsx | AptComment | Linked historical source record | HISTORICAL |
| Employees.xlsx | BookBeyondMaxOccupancy | user.bookBeyondMaxOccupancy | OPERATIONAL |
| Employees.xlsx | CardConnectMerchantID | Encrypted source record | SECURE |
| Employees.xlsx | Category | user.jobTitle | OPERATIONAL |
| Employees.xlsx | CellPhone | user.cellPhone | OPERATIONAL |
| Employees.xlsx | Cert0 | user.certifications:Cert0 | OPERATIONAL |
| Employees.xlsx | Cert1 | user.certifications:Cert1 | OPERATIONAL |
| Employees.xlsx | Cert2 | user.certifications:Cert2 | OPERATIONAL |
| Employees.xlsx | Cert3 | user.certifications:Cert3 | OPERATIONAL |
| Employees.xlsx | Cert4 | user.certifications:Cert4 | OPERATIONAL |
| Employees.xlsx | Cert5 | user.certifications:Cert5 | OPERATIONAL |
| Employees.xlsx | Cert6 | user.certifications:Cert6 | OPERATIONAL |
| Employees.xlsx | Cert7 | user.certifications:Cert7 | OPERATIONAL |
| Employees.xlsx | Cert8 | user.certifications:Cert8 | OPERATIONAL |
| Employees.xlsx | Cert9 | user.certifications:Cert9 | OPERATIONAL |
| Employees.xlsx | City | user.city | OPERATIONAL |
| Employees.xlsx | Comment | Linked historical source record | HISTORICAL |
| Employees.xlsx | CustomerID | Linked historical source record | HISTORICAL |
| Employees.xlsx | DateOfBirth | user.dateOfBirth | OPERATIONAL |
| Employees.xlsx | DateOfHire | user.dateOfHire | OPERATIONAL |
| Employees.xlsx | ElementAcceptorID | Encrypted source record | SECURE |
| Employees.xlsx | ElementAccountID | Encrypted source record | SECURE |
| Employees.xlsx | ElementToken | Encrypted source record | SECURE |
| Employees.xlsx | E-mail | user.email | OPERATIONAL |
| Employees.xlsx | EmployeeGuid | Linked historical source record | HISTORICAL |
| Employees.xlsx | EmployeeID | user.importSourceId | OPERATIONAL |
| Employees.xlsx | EmployeeIDCard | Encrypted source record | SECURE |
| Employees.xlsx | EmployeeIDExists | Linked historical source record | HISTORICAL |
| Employees.xlsx | FacebookUrl | Linked historical source record | HISTORICAL |
| Employees.xlsx | FirstName | user.firstName | OPERATIONAL |
| Employees.xlsx | GooglePlusUrl | Linked historical source record | HISTORICAL |
| Employees.xlsx | Guid | Linked historical source record | HISTORICAL |
| Employees.xlsx | Phone | user.phone | OPERATIONAL |
| Employees.xlsx | ICID | Linked historical source record | HISTORICAL |
| Employees.xlsx | Independent | user.independent | OPERATIONAL |
| Employees.xlsx | InstagramUrl | Linked historical source record | HISTORICAL |
| Employees.xlsx | InvalidEmail | user.invalidEmail | OPERATIONAL |
| Employees.xlsx | InvalidSmsNumber | user.invalidSmsNumber | OPERATIONAL |
| Employees.xlsx | LastName | user.lastName | OPERATIONAL |
| Employees.xlsx | LastWorkDate | user.lastWorkDate | OPERATIONAL |
| Employees.xlsx | LinkedInUrl | Linked historical source record | HISTORICAL |
| Employees.xlsx | MaxOccupancy | user.maxOccupancy | OPERATIONAL |
| Employees.xlsx | MerchantID | Encrypted source record | SECURE |
| Employees.xlsx | MercuryMerchantID | Encrypted source record | SECURE |
| Employees.xlsx | MercuryPassword | Encrypted source record | SECURE |
| Employees.xlsx | Notes | user.notes | OPERATIONAL |
| Employees.xlsx | NotificationsEmail | user.notificationsEmail | OPERATIONAL |
| Employees.xlsx | NotificationsSMS | user.notificationsSms | OPERATIONAL |
| Employees.xlsx | PDA | Linked historical source record | HISTORICAL |
| Employees.xlsx | PinterestUrl | Linked historical source record | HISTORICAL |
| Employees.xlsx | PK | Linked historical source record | HISTORICAL |
| Employees.xlsx | QuickBooksEditSequence | Linked historical source record | HISTORICAL |
| Employees.xlsx | QuickBooksExport | Linked historical source record | HISTORICAL |
| Employees.xlsx | QuickBooksID | Linked historical source record | HISTORICAL |
| Employees.xlsx | QuickBooksSyncDate | Linked historical source record | HISTORICAL |
| Employees.xlsx | ServiceLimit | user.serviceLimit | OPERATIONAL |
| Employees.xlsx | Gender | Linked historical source record | HISTORICAL |
| Employees.xlsx | SMSNumber | user.smsNumber | OPERATIONAL |
| Employees.xlsx | SSN | Encrypted source record | SECURE |
| Employees.xlsx | State | user.state | OPERATIONAL |
| Employees.xlsx | TipsClaimed | Linked historical source record | HISTORICAL |
| Employees.xlsx | TwitterUrl | Linked historical source record | HISTORICAL |
| Employees.xlsx | W2Local | Linked historical source record | HISTORICAL |
| Employees.xlsx | W2State | Linked historical source record | HISTORICAL |
| Employees.xlsx | XAuthKey | Encrypted source record | SECURE |
| Employees.xlsx | XTerminalID | Encrypted source record | SECURE |
| Employees.xlsx | XWebID | Encrypted source record | SECURE |
| Employees.xlsx | ZIP | user.postalCode | OPERATIONAL |
| Services.xlsx | Alias1 | service.aliases:Alias1 | OPERATIONAL |
| Services.xlsx | Alias2 | service.aliases:Alias2 | OPERATIONAL |
| Services.xlsx | Alias3 | service.aliases:Alias3 | OPERATIONAL |
| Services.xlsx | AllDay | Linked historical source record | HISTORICAL |
| Services.xlsx | BackBar | Linked historical source record | HISTORICAL |
| Services.xlsx | BackBar1 | Linked historical source record | HISTORICAL |
| Services.xlsx | Balance | Linked historical source record | HISTORICAL |
| Services.xlsx | Category | service.category | OPERATIONAL |
| Services.xlsx | CommissionBonus | service.sourceCommission:CommissionBonus | OPERATIONAL |
| Services.xlsx | ComPurType | service.sourceCommission:ComPurType | OPERATIONAL |
| Services.xlsx | ComPurValue | service.sourceCommission:ComPurValue | OPERATIONAL |
| Services.xlsx | ComType | service.sourceCommission:ComType | OPERATIONAL |
| Services.xlsx | ComUsedType | service.sourceCommission:ComUsedType | OPERATIONAL |
| Services.xlsx | ComUsedValue | service.sourceCommission:ComUsedValue | OPERATIONAL |
| Services.xlsx | CustomField1 | service.customFields:CustomField1 | OPERATIONAL |
| Services.xlsx | CustomField2 | service.customFields:CustomField2 | OPERATIONAL |
| Services.xlsx | CustomField3 | service.customFields:CustomField3 | OPERATIONAL |
| Services.xlsx | Setup | Linked historical source record | HISTORICAL |
| Services.xlsx | Finish | Linked historical source record | HISTORICAL |
| Services.xlsx | Process | Linked historical source record | HISTORICAL |
| Services.xlsx | Favorite | service.favorite | OPERATIONAL |
| Services.xlsx | ID | service.code | OPERATIONAL |
| Services.xlsx | IDNumeric | Linked historical source record | HISTORICAL |
| Services.xlsx | Inactive | service.active | OPERATIONAL |
| Services.xlsx | IsDropOff | Linked historical source record | HISTORICAL |
| Services.xlsx | IsFractionalQuantity | Linked historical source record | HISTORICAL |
| Services.xlsx | Link1 | Linked historical source record | HISTORICAL |
| Services.xlsx | Link2 | Linked historical source record | HISTORICAL |
| Services.xlsx | Link3 | Linked historical source record | HISTORICAL |
| Services.xlsx | LoyaltyPoints | service.loyaltyPoints | OPERATIONAL |
| Services.xlsx | Name | service.name | OPERATIONAL |
| Services.xlsx | PK | Linked historical source record | HISTORICAL |
| Services.xlsx | PreExpires | service.inventoryDetails:PreExpires | OPERATIONAL |
| Services.xlsx | PreInstructions | service.inventoryDetails:PreInstructions | OPERATIONAL |
| Services.xlsx | PreLot | service.inventoryDetails:PreLot | OPERATIONAL |
| Services.xlsx | PreManufacturer | service.inventoryDetails:PreManufacturer | OPERATIONAL |
| Services.xlsx | PreQuantity | service.inventoryDetails:PreQuantity | OPERATIONAL |
| Services.xlsx | PreRefills | service.inventoryDetails:PreRefills | OPERATIONAL |
| Services.xlsx | Prescription | service.inventoryDetails:Prescription | OPERATIONAL |
| Services.xlsx | QntPur | service.inventoryDetails:QntPur | OPERATIONAL |
| Services.xlsx | QntUsed | service.inventoryDetails:QntUsed | OPERATIONAL |
| Services.xlsx | QuickBooksEditSequence | Linked historical source record | HISTORICAL |
| Services.xlsx | QuickBooksExport | Linked historical source record | HISTORICAL |
| Services.xlsx | QuickBooksID | Linked historical source record | HISTORICAL |
| Services.xlsx | QuickBooksSyncDate | Linked historical source record | HISTORICAL |
| Services.xlsx | RequiresProcess | Linked historical source record | HISTORICAL |
| Services.xlsx | ResourceID | Linked historical source record | HISTORICAL |
| Services.xlsx | ResourceLinkType | Linked historical source record | HISTORICAL |
| Services.xlsx | Price | service.priceCents | OPERATIONAL |
| Services.xlsx | Tax1 | service.taxConfiguration:Tax1 | OPERATIONAL |
| Services.xlsx | Tax2 | service.taxConfiguration:Tax2 | OPERATIONAL |
| Services.xlsx | Tax3 | service.taxConfiguration:Tax3 | OPERATIONAL |
| Services.xlsx | Vendor | service.inventoryDetails:Vendor | OPERATIONAL |
| Services.xlsx | WebBookingFriday | service.onlineBookingDays:WebBookingFriday | OPERATIONAL |
| Services.xlsx | WebBookingMonday | service.onlineBookingDays:WebBookingMonday | OPERATIONAL |
| Services.xlsx | WebBookingSaturday | service.onlineBookingDays:WebBookingSaturday | OPERATIONAL |
| Services.xlsx | WebBookingSunday | service.onlineBookingDays:WebBookingSunday | OPERATIONAL |
| Services.xlsx | WebBookingThursday | service.onlineBookingDays:WebBookingThursday | OPERATIONAL |
| Services.xlsx | WebBookingTuesday | service.onlineBookingDays:WebBookingTuesday | OPERATIONAL |
| Services.xlsx | WebBookingWednesday | service.onlineBookingDays:WebBookingWednesday | OPERATIONAL |
| Services.xlsx | WebDisplayName | service.webDisplayName | OPERATIONAL |
| Services.xlsx | WebOrder | service.webOrder | OPERATIONAL |
