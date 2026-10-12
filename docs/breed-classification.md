# Shared breed and grooming classification

The shipped dictionary combines the user’s Google Sheet (1h0FCq9U6-qkrflwqKa5OwDLgQGwDtOECyR6arsULLOM, Sheet1) and 211-entry pasted list. Source varieties remain distinct. Approved nicknames and spelling variants resolve to stable IDs. Designer examples retain separate foundation-breed IDs.

`breed-source.json` is the shared starting dictionary. Business-approved additions and aliases are stored in the existing TenantSetting table under BREED_DICTIONARY_V1, isolated by tenant. IDs remain unchanged when names change. Settings → Breeds & grooming classification edits this dictionary and links exact/approved aliases in existing pet records. Unknown descriptions remain in the review list; no fuzzy matches are applied. Existing descriptions are preserved in originalBreed.

The shared PetEditor records customer-facing breed, underlying breeds, actual weight, coat length/type and an optional grooming classification. Package and VIP-plan editors share the same rule editor. Weight boundaries are inclusive; empty rules impose no restriction. Missing required measurements require review. Breed exclusions override inclusions. Parent-breed inclusion is supported for mixed breeds. Breed weight references are retained separately in breed-reference.json and never supply pet measurements or eligibility limits. The sheet’s historic column placements do not create coat defaults.

The same matcher supplies POS recommendations and server validation for package additions and VIP enrollment. A valid preferred package has priority; otherwise only a unique default/matching rule is automatically selected. Ambiguous matches offer choices. Pet clicks retain package selection behavior. Measurements can be edited through the existing shared customer/pet editor. Existing ticket prices and membership snapshots are not recalculated when rules change. Matching does not enroll or charge a membership.

Imports use the same dictionary. Weight remains the original descriptive source field; explicitly mapped WeightLbs accepts actual numeric pounds. CoatLength, CoatTexture and GroomingClassification are available operational mappings. Original imported source values remain retained by the import system.

Schema changes are additive nullable Pet columns and Package.groomingRules. `npm run db:sql` regenerates the hosting schema artifact; the existing bootstrap adds these columns using metadata checks, without resetting data. No hosting changes or publishing are part of this local implementation.

Verification: `node --test tests/*.test.cjs`; `node scripts/test-breed-database.cjs` with GROOMPRO_TEST_PIN supplied through the environment, the explicitly guarded local database URL and development server running on 33318. The database script uses disposable fixtures and removes those fixtures afterward. It also links recognized existing test-pet breeds without changing displayed names or owners.


Local verification completed October 12, 2026: 121 automated tests passed; TypeScript validation passed; production build completed. Browser checks covered the shared pet editor, designer-breed parents, package/VIP eligibility controls and dictionary alias search. Live local API/database checks passed for authorization, owner preservation, original breed text, partial pet updates retaining breed, package/VIP rule persistence, actual-weight enforcement, rejection without enrollment, tenant isolation and unknown-breed review. Disposable fixtures were removed. No GitHub push or GoDaddy deployment was performed.
