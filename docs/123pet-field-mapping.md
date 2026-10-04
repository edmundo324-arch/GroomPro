# 123Pet header mapping audit

Baseline classification distinguishes existing capabilities from proposed additions. This is a mapping audit, not authorization to copy sensitive credentials. Source identifiers are retained in tenant-scoped ImportRecord; source units, signs and relationship IDs must be validated before importing. New fields below are schema foundations, not a claim that every editor/importer already consumes them.

## Client

| Source header | Classification | GroomPro mapping / action |
|---|---|---|
| Address | Supported under a different GroomPro field/name | address1 |
| Address2 | Supported under a different GroomPro field/name | address2 |
| Anniversary | Needs a new field or relationship | anniversary |
| AptEmail | Needs a new field or relationship | appointmentEmail |
| AptSMS | Needs a new field or relationship | appointmentSms |
| Balance | Supported under a different GroomPro field/name | balanceCents / creditCents and account ledger; confirm sign convention before import |
| BalanceComment | Supported under a different GroomPro field/name | CustomerAccountLedger.reason on imported adjustment |
| CardConnectProfileAccountID | Ambiguous — requires clarification | Do not import into ordinary profile or legacy JSON. Requires a specific secure migration decision; external payment tokens may not be portable. |
| CellEmail | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| CellPhone | Supported under a different GroomPro field/name | CustomerPhone.number with mobile label |
| Children | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| City | Supported under a different GroomPro field/name | city |
| Class | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| ClientHistory | Supported under a different GroomPro field/name | ticket/account/communication history; retain source narrative |
| ClientID | Legacy/import-only data worth retaining | Tenant-scoped source ID mapping in ImportRecord; preserve internal GroomPro IDs. |
| Comment | Supported under a different GroomPro field/name | notes |
| DateCreated | Supported under a different GroomPro field/name | createdAt |
| DateOfBirth | Needs a new field or relationship | dateOfBirth |
| DocumentFolder | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| DoNotCall | Needs a new field or relationship | doNotCall |
| DoNotPostalMail | Needs a new field or relationship | doNotPostalMail |
| E-mail | Supported under a different GroomPro field/name | email |
| EmergencyContactName | Needs a new field or relationship | emergencyContactName |
| EmergencyContactNumber | Needs a new field or relationship | emergencyContactNumber |
| EmergencyContactRelationship | Needs a new field or relationship | emergencyContactRelationship |
| EncryptedInformation | Ambiguous — requires clarification | Do not import into ordinary profile or legacy JSON. Requires a specific secure migration decision; external payment tokens may not be portable. |
| FirstEmployeeID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| FirstEmployeeName | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| FirstName | Supported under a different GroomPro field/name | firstName |
| FirstVisit | Supported under a different GroomPro field/name | derive from tickets; preserve imported historical baseline |
| Guid | Legacy/import-only data worth retaining | Tenant-scoped source ID mapping in ImportRecord; preserve internal GroomPro IDs. |
| Phone | Supported under a different GroomPro field/name | CustomerPhone.number |
| IDCard | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| Inactive | Supported under a different GroomPro field/name | active (invert) |
| InvalidEmail | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| InvalidSmsNumber | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Item | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| ItemComment | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| LastEmployeeID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| LastEmployeeName | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| LastName | Supported under a different GroomPro field/name | lastName |
| LastVisit | Supported under a different GroomPro field/name | derive from tickets; preserve imported historical baseline |
| Link | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| LoyaltyPoints | Supported under a different GroomPro field/name | loyaltyPoints + reward ledger |
| LoyaltyPointsComment | Supported under a different GroomPro field/name | CustomerRewardLedger.reason on imported adjustment |
| Mailing | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| NoShow | Supported under a different GroomPro field/name | derive from ticket status; preserve imported baseline |
| Occupation | Needs a new field or relationship | occupation |
| OnlineID | Legacy/import-only data worth retaining | Tenant-scoped source ID mapping in ImportRecord; preserve internal GroomPro IDs. |
| OptInStatus | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| ProductDiscountPercent | Needs a new field or relationship | productDiscountPct |
| PK | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| PopUp | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| PreferredEmployeeID | Needs a new field or relationship | preferredEmployeeId via employee mapping |
| PreferredEmployeeName | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| PrimaryPhone | Supported under a different GroomPro field/name | CustomerPhone.isPrimary; source semantics must be verified |
| PrimaryPhoneNumber | Supported under a different GroomPro field/name | CustomerPhone.isPrimary + number |
| PrimaryPictureGuid | Needs a new field or relationship | Resolve source image GUID to migrated image asset; pictureUrl is the target, not a copy of the GUID. |
| QuickBooksEditSequence | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksExport | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksID | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksSyncDate | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| ServiceDiscountPercent | Needs a new field or relationship | serviceDiscountPct |
| Gender | Needs a new field or relationship | gender |
| Spouse | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| State | Supported under a different GroomPro field/name | state |
| Title | Needs a new field or relationship | title |
| TotalVisits | Supported under a different GroomPro field/name | derive from tickets; preserve imported historical baseline |
| WorkPhone | Supported under a different GroomPro field/name | CustomerPhone.number with work label |
| ZIP | Supported under a different GroomPro field/name | postalCode |

## Pet

| Source header | Classification | GroomPro mapping / action |
|---|---|---|
| ClientID | Supported under a different GroomPro field/name | customerId through source-client mapping; never guess owner |
| AgWithAnimals | Needs a new field or relationship | careFlags.AgWithAnimals (explicit source boolean conversion) |
| AgWithPeople | Needs a new field or relationship | careFlags.AgWithPeople (explicit source boolean conversion) |
| Barker | Needs a new field or relationship | careFlags.Barker (explicit source boolean conversion) |
| Biter | Needs a new field or relationship | careFlags.Biter (explicit source boolean conversion) |
| Blind | Needs a new field or relationship | careFlags.Blind (explicit source boolean conversion) |
| Breed | Supported under a different GroomPro field/name | breed |
| Breeding | Needs a new field or relationship | careFlags.Breeding (explicit source boolean conversion) |
| Burns | Needs a new field or relationship | careFlags.Burns (explicit source boolean conversion) |
| Chews | Needs a new field or relationship | careFlags.Chews (explicit source boolean conversion) |
| Color | Needs a new field or relationship | color |
| Comments | Supported under a different GroomPro field/name | notes |
| Dead | Needs a new field or relationship | careFlags.Dead (explicit source boolean conversion) |
| Deaf | Needs a new field or relationship | careFlags.Deaf (explicit source boolean conversion) |
| Diabetic | Needs a new field or relationship | careFlags.Diabetic (explicit source boolean conversion) |
| DateOfBirth | Needs a new field or relationship | dateOfBirth |
| Epileptic | Needs a new field or relationship | careFlags.Epileptic (explicit source boolean conversion) |
| Gender | Needs a new field or relationship | gender |
| GroomComments | Needs a new field or relationship | groomingNotes |
| GroomLevel | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| HairDryer | Needs a new field or relationship | careFlags.HairDryer (explicit source boolean conversion) |
| Heart | Needs a new field or relationship | careFlags.Heart (explicit source boolean conversion) |
| Hyper | Needs a new field or relationship | careFlags.Hyper (explicit source boolean conversion) |
| Inactive | Supported under a different GroomPro field/name | active (invert) |
| KennelComments | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| LastVisit | Supported under a different GroomPro field/name | ticket history; preserve imported historical baseline |
| LeashOn | Needs a new field or relationship | careFlags.LeashOn (explicit source boolean conversion) |
| Length | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| MedicalComments | Needs a new field or relationship | medicalNotes |
| Name | Supported under a different GroomPro field/name | name |
| Notes | Supported under a different GroomPro field/name | notes |
| PersonalityComments | Needs a new field or relationship | behaviorNotes |
| PetID | Legacy/import-only data worth retaining | Tenant-scoped source ID mapping in ImportRecord; preserve internal GroomPro IDs. |
| PK | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| PrimaryPictureGuid | Needs a new field or relationship | Resolve source image GUID to migrated image asset; pictureUrl is the target, not a copy of the GUID. |
| Rabies | Supported under a different GroomPro field/name | Vaccination (dates and source format need review) |
| SensitiveSkin | Needs a new field or relationship | careFlags.SensitiveSkin (explicit source boolean conversion) |
| Shy | Needs a new field or relationship | careFlags.Shy (explicit source boolean conversion) |
| Texture | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Type | Needs a new field or relationship | species |
| Vet | Needs a new field or relationship | veterinarian |
| Weight | Needs a new field or relationship | weightLbs (verify source unit) |

## Service

| Source header | Classification | GroomPro mapping / action |
|---|---|---|
| Alias1 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Alias2 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Alias3 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| AllDay | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| BackBar | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| BackBar1 | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| Balance | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| Category | Supported under a different GroomPro field/name | category |
| CommissionBonus | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ComPurType | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| ComPurValue | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| ComType | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| ComUsedType | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| ComUsedValue | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| CustomField1 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| CustomField2 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| CustomField3 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Setup | Supported under a different GroomPro field/name | durationMin is only total duration; component timing needs source units |
| Finish | Supported under a different GroomPro field/name | durationMin is only total duration; component timing needs source units |
| Process | Supported under a different GroomPro field/name | durationMin is only total duration; component timing needs source units |
| Favorite | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ID | Needs a new field or relationship | code (separate from internal UUID) |
| IDNumeric | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| Inactive | Supported under a different GroomPro field/name | active (invert) |
| IsDropOff | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| IsFractionalQuantity | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Link1 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Link2 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Link3 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| LoyaltyPoints | Needs a new field or relationship | service reward rule (future configuration, retain source value) |
| Name | Supported under a different GroomPro field/name | name |
| PK | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| PreExpires | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| PreInstructions | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| PreLot | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| PreManufacturer | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| PreQuantity | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| PreRefills | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Prescription | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| QntPur | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| QntUsed | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| QuickBooksEditSequence | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksExport | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksID | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksSyncDate | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| RequiresProcess | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ResourceID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ResourceLinkType | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| Price | Supported under a different GroomPro field/name | priceCents |
| Tax1 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Tax2 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Tax3 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Vendor | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebBookingFriday | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebBookingMonday | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebBookingSaturday | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebBookingSunday | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebBookingThursday | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebBookingTuesday | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebBookingWednesday | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebDisplayName | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| WebOrder | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |

## Employee

| Source header | Classification | GroomPro mapping / action |
|---|---|---|
| ABComment | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ABName | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Active | Supported under a different GroomPro field/name | active |
| Address | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Address2 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| AptComment | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| BookBeyondMaxOccupancy | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| CardConnectMerchantID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Category | Supported under a different GroomPro field/name | role/jobTitle — role mapping must be explicit |
| CellPhone | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Cert0-Cert9 | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| City | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Comment | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| CustomerID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| DateOfBirth | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| DateOfHire | Needs a new field or relationship | dateOfHire |
| ElementAcceptorID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ElementAccountID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ElementToken | Ambiguous — requires clarification | Do not import into ordinary profile or legacy JSON. Requires a specific secure migration decision; external payment tokens may not be portable. |
| E-mail | Supported under a different GroomPro field/name | email |
| EmployeeGuid | Legacy/import-only data worth retaining | Tenant-scoped source ID mapping in ImportRecord; preserve internal GroomPro IDs. |
| EmployeeID | Legacy/import-only data worth retaining | Tenant-scoped source ID mapping in ImportRecord; preserve internal GroomPro IDs. |
| EmployeeIDCard | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| EmployeeIDExists | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| FacebookUrl | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| FirstName | Supported under a different GroomPro field/name | firstName |
| GooglePlusUrl | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Guid | Legacy/import-only data worth retaining | Tenant-scoped source ID mapping in ImportRecord; preserve internal GroomPro IDs. |
| Phone | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ICID | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| Independent | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| InstagramUrl | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| InvalidEmail | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| InvalidSmsNumber | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| LastName | Supported under a different GroomPro field/name | lastName |
| LastWorkDate | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| LinkedInUrl | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| MaxOccupancy | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| MerchantID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| MercuryMerchantID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| MercuryPassword | Ambiguous — requires clarification | Do not import into ordinary profile or legacy JSON. Requires a specific secure migration decision; external payment tokens may not be portable. |
| Notes | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| NotificationsEmail | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| NotificationsSMS | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| PDA | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| PinterestUrl | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| PK | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| QuickBooksEditSequence | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksExport | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksID | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| QuickBooksSyncDate | Legacy/import-only data worth retaining | ImportRecord source accounting metadata; not a configured QuickBooks integration. |
| ServiceLimit | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| Gender | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| SMSNumber | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| SSN | Ambiguous — requires clarification | Do not import into ordinary profile or legacy JSON. Requires a specific secure migration decision; external payment tokens may not be portable. |
| State | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| TipsClaimed | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| TwitterUrl | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| W2Local | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| W2State | Ambiguous — requires clarification | Retain original value in reviewed source archive only; confirm source meaning before activating any behavior. |
| XAuthKey | Ambiguous — requires clarification | Do not import into ordinary profile or legacy JSON. Requires a specific secure migration decision; external payment tokens may not be portable. |
| XTerminalID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| XWebID | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
| ZIP | Legacy/import-only data worth retaining | Retain non-secret source value in ImportRecord after import review; no operational feature currently consumes it. |
