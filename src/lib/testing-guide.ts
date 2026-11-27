export type GuideItem={id:string;section:string;title:string;steps:string;expected:string};
export const guideItems:GuideItem[]=[
  {
    "id": "01",
    "section": "START HERE — EVERYDAY SHOP WORK",
    "title": "Clicking a dog's name — the reported error",
    "steps": "Open Day, open a test POS ticket, and click Test Gizmo's name. Use a dog with an assigned grooming package. Click again to remove that package, then again to add it.",
    "expected": "no saved-information error. The assigned package toggles without duplicating its items. Separate extras, products and other dogs' packages remain. Existing grooming history is preserved. Pet-name clicking adds/removes the package; editing the dog remains in the pet editor."
  },
  {
    "id": "02",
    "section": "START HERE — EVERYDAY SHOP WORK",
    "title": "Complete forms and clear hints",
    "steps": "Open a new POS ticket before choosing a customer. Open a customer and pet editor. Open a question-mark hint, then dismiss it with Escape.",
    "expected": "the established form structure appears before its information arrives. Opening an editable form does not select an input automatically; PIN authorization is the exception. Hints explain the field, keep it visible and disappear when dismissed. Test your highlight color under Settings → Calendar & Workflow → Helpful hints, then refresh."
  },
  {
    "id": "03",
    "section": "START HERE — EVERYDAY SHOP WORK",
    "title": "Reorder Menu and Search",
    "steps": "Right-click the blue menu, choose Reorder Menu, move two items and save. Refresh. Open Search, search for Rewards, follow the customer account result, then search for a different item.",
    "expected": "menu order survives refresh. Search keeps its wording and remains open until you close it with X. You can move its window. It finds working modules/fields, not merely Settings. Multiple destinations let you choose; the destination uses the current customer where applicable and highlights the requested field."
  },
  {
    "id": "04",
    "section": "START HERE — EVERYDAY SHOP WORK",
    "title": "Customer information and family contacts",
    "steps": "Open Customer Profile → Details. Enter three phone contacts and add another. Try creating another customer with the same primary phone, then a different phone with the same name/email.",
    "expected": "family contacts remain on that customer's account. Matching phone numbers prevent duplicate customer creation; matching names/emails alone do not. New customers require a phone. Save and reopen to verify persistence."
  },
  {
    "id": "05",
    "section": "START HERE — EVERYDAY SHOP WORK",
    "title": "Notes and grooming history",
    "steps": "Enter Customer Notes and Today's Grooming Notes for Test Gizmo. Reopen the dog through Customer Profile and through the POS ticket. Review an older appointment too.",
    "expected": "Customer Notes and appointment-specific grooming notes appear in their intended places. Today's Grooming Notes may use the shorter Grooming Notes label where space is limited. The floating pet notes show appointment grooming notes. Earlier dates remain distinguishable and are not overwritten by today's edits. Earlier free-text instructions stay visible with their explanation; Historical notes explain unmatched imported customer notes."
  },
  {
    "id": "06",
    "section": "START HERE — EVERYDAY SHOP WORK",
    "title": "Transfer a dog without losing history",
    "steps": "Transfer Test Gizmo from Test Maria to Test John, then open a ticket from before the transfer. Transfer the dog back.",
    "expected": "one current owning family at a time. Old tickets still open and retain their original customer and history. Family contacts do not automatically become separate owners/accounts."
  },
  {
    "id": "07",
    "section": "START HERE — EVERYDAY SHOP WORK",
    "title": "Agreement Settings and customer forms",
    "steps": "Open Customers → Agreement Settings. Try X, Full Size and Restore Size. Reopen it and try a protected change.",
    "expected": "the window stays above the other windows, its controls work, and authorization opens the PIN module when required. Helpful explanations remain readable. Test intake or VIP forms with fictional information; delivery of signed copies requires connected email."
  },
  {
    "id": "08",
    "section": "START HERE — EVERYDAY SHOP WORK",
    "title": "Complete one ordinary visit",
    "steps": "Book both test dogs, assign services and employees, confirm, check in, mark ready, record a test payment and close. Reopen the ticket from history.",
    "expected": "the dogs, service assignments, notes and amounts remain correct. Check-in/ready undo actions affect the intended ticket. Closing requires settlement; the closed ticket has no balance due. History opens normally."
  },
  {
    "id": "09",
    "section": "BOOKING AND CUSTOMER COMMUNICATION",
    "title": "Online availability",
    "steps": "Review each test service, employee and resource's online availability and online-booking classes. Open the customer portal and search for a visit.",
    "expected": "only eligible online services/resources/employees appear, within their shop's schedule. Factory availability favors resources; tenants can change this. New service online availability defaults off, while existing selections are preserved. A shop location is required on public booking links."
  },
  {
    "id": "10",
    "section": "BOOKING AND CUSTOMER COMMUNICATION",
    "title": "Accepted versus Confirmed",
    "steps": "Submit a portal request and accept it as staff. Then record that the customer confirmed attendance.",
    "expected": "shop acceptance shows Accepted. The customer's confirmation changes the appointment to Confirmed and stops further confirmation requests. A booking notice is separate from asking the customer to confirm attendance."
  },
  {
    "id": "11",
    "section": "BOOKING AND CUSTOMER COMMUNICATION",
    "title": "Confirmation schedule and moving a visit",
    "steps": "Review Settings → Communications and the tenant's confirmation schedule. Move a confirmed test appointment. Try the choice not to request confirmation again, then test the other choice on a separate appointment.",
    "expected": "declining a new request keeps it Confirmed. Requesting one starts the appropriate new confirmation process. Old appointment-time requests do not continue. The appointment-change notice remains separate. Factory request timing is 7, 5, 3 and 2 days before at 9 AM, plus appointment morning at 7 AM when still before the visit; tenants can edit it."
  },
  {
    "id": "12",
    "section": "BOOKING AND CUSTOMER COMMUNICATION",
    "title": "Customer-selected reminders and editable messages",
    "steps": "In the portal, choose more than one reminder and a time for each. Review the tenant's ready-for-pickup, reminder, rebooking, review-request and other message wording. Save a harmless wording change and reopen it.",
    "expected": "selected reminders and tenant wording persist. Messages use the correct dog, appointment date and time. Actual delivery is WAITING FOR CONNECTION unless the relevant email/text service is configured."
  },
  {
    "id": "13",
    "section": "BOOKING AND CUSTOMER COMMUNICATION",
    "title": "Failed email and manual resend",
    "steps": "With connected email, use a controlled test that produces a genuine bounced/failed confirmation. Open its appointment, correct the email, then later test manual resend.",
    "expected": "staff see useful guidance; a corrected address can trigger a new applicable confirmation. Staff can request another reminder outside the normal intervals. Uncertain delivery is not blindly resent. Do not use somebody else's address for this test."
  },
  {
    "id": "14",
    "section": "BOOKING AND CUSTOMER COMMUNICATION",
    "title": "Customer portal, unfinished booking and waitlist",
    "steps": "Edit a test customer's contact/pet details and view their appointments/agreements. Leave a booking unfinished, return and continue it. Add a waitlist request through the portal and through staff controls.",
    "expected": "saved choices return without creating duplicate appointments. Staff can see unfinished bookings for follow-up. Staff choose whom to contact from the waitlist; customers are not automatically promised the same opening."
  },
  {
    "id": "15",
    "section": "BOOKING AND CUSTOMER COMMUNICATION",
    "title": "Late cancellation",
    "steps": "Use a test appointment inside the tenant's cancellation window; factory notice is 30 hours. Request cancellation through the portal.",
    "expected": "a clear warning explains the tenant's rule. The booking stays in place for staff review, the request time is retained and the pending-cancellation appearance is applied. Staff can resolve it and waive a fee when authorized. Same-day time moves preserve the approved fee exception."
  },
  {
    "id": "16",
    "section": "BOOKING AND CUSTOMER COMMUNICATION",
    "title": "Report cards, birthdays and vaccination notices",
    "steps": "Save a report card and try the available send choices before/after closing. Check its closing policy, birthday settings and vaccination settings.",
    "expected": "report cards support email, text or both; factory closing behavior is automatic, with an ask-staff option. Birthday messages default on at 8 AM and use March 1 for February 29 birthdays in non-leap years, with tenant choices. Vaccination reminders default to eight weeks for active customers. Missing/expired vaccinations flag booking for review rather than automatically blocking it under factory rules. Actual sending requires connected services."
  },
  {
    "id": "17",
    "section": "MONEY, REWARDS AND INVENTORY",
    "title": "Deposit and Customer Credit",
    "steps": "Record a $45 test deposit, reopen the customer account and apply it to a later ticket.",
    "expected": "$45 appears in Customer Credit, stays available after an eligible reschedule, and is applied only once. Collecting a deposit is not reported as another grooming sale."
  },
  {
    "id": "18",
    "section": "MONEY, REWARDS AND INVENTORY",
    "title": "No-show fee and Balance Owed",
    "steps": "Use a test account with $20 credit and a $45 no-show/cancellation fee. Process the no-show without a usable connected card.",
    "expected": "credit covers $20 and the remaining $25 becomes Balance Owed. The next visit can collect that amount without counting it as a new service sale. Saved-card charging remains a separate payment-provider test."
  },
  {
    "id": "19",
    "section": "MONEY, REWARDS AND INVENTORY",
    "title": "Void and refund",
    "steps": "Void an unpaid test ticket using an authorized role and a reason. Try the same on a paid ticket. Refund a separate closed test sale.",
    "expected": "void retains history and the reason; paid tickets use refunds. Factory refunds are store credit unless the tenant enables cash. Refunded item tax and the refunded portion of commission are handled; performed work still counts in Productivity Report. Staff choose whether refunded merchandise returns to sellable stock."
  },
  {
    "id": "20",
    "section": "MONEY, REWARDS AND INVENTORY",
    "title": "Discounts and return visits",
    "steps": "Test a fixed-dollar discount across eligible items and as one discount line. Test a percentage discount. Use a qualifying repeat GR, FFT or FW visit within two weeks, plus a separate extra.",
    "expected": "a $10 discount totals $10, not $10 per item. The main grooming package qualifies for the configured return-visit offer; separate extras do not. Factory checkout-booked tiers are 10% within four weeks and 5% within six weeks. Same-date time changes preserve those discounts; date changes follow the approved removal rule. Competing eligible discounts use the larger discount rather than stacking by default."
  },
  {
    "id": "21",
    "section": "MONEY, REWARDS AND INVENTORY",
    "title": "Refer-A-Friend",
    "steps": "Review the tenant's referral offer, open it in the portal and link a fictional new customer to the referrer. Complete the qualifying visit.",
    "expected": "factory Give $10! Get $10! rewards are assigned to the right people once. Tenant choices can give each person a different reward, including a product, service or add-on."
  },
  {
    "id": "22",
    "section": "MONEY, REWARDS AND INVENTORY",
    "title": "Gift cards",
    "steps": "Sell a test gift card, fully pay/close its ticket, and redeem part of it using its code. Review print/email choices.",
    "expected": "purchase activation follows payment and closing; every redemption requires a code and reduces the remaining balance once. Anyone with the code can redeem under the factory rule. Email can go to the purchaser or another recipient. Factory refund policy is nonrefundable unless changed by the tenant."
  },
  {
    "id": "23",
    "section": "MONEY, REWARDS AND INVENTORY",
    "title": "Prepaid packages",
    "steps": "Create a test six-visit offer at the price you choose. Buy it, use one visit and close that visit's ticket. Test family-wide versus one-dog eligibility, and transfer some unused visits to Test John.",
    "expected": "visit deduction happens at closing. The package follows its own tax, commission, expiration and eligibility settings. Transfers preserve remaining visits and purchaser history. When keeping a one-dog balance with the original family, it can remain unused until another dog is assigned. Refunds require tenant permission and cover whole unused visits; gifted-visit refunds offer the approved recipient choice."
  },
  {
    "id": "24",
    "section": "MONEY, REWARDS AND INVENTORY",
    "title": "Tips and stock",
    "steps": "Add a $30 tip and assign $15/$10/$5 to three employees; test equal splitting on another ticket. Add a tip after closing. Sell merchandise and review stock and recorded cost.",
    "expected": "tips total correctly and use the original ticket closing date in employee reports. Stock subtracts at closing; a shortage warns but does not block the sale. Product cost is saved at closing so later cost edits do not rewrite past reports."
  },
  {
    "id": "25",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Schedule, time clock and staff tasks",
    "steps": "Under Schedule, record a test shift, clock-in/out and a break. Make a manager correction with a reason. Create a staff task for a Customer Service Associate and give it a due date.",
    "expected": "corrected time and reason remain recorded. Owners/managers assign tasks under factory permissions; tenants can expand this. Overdue tasks appear and notify inside GroomPro. Completing the task resolves applicable pending task follow-ups."
  },
  {
    "id": "26",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Productivity Report",
    "steps": "Open Reports for a past day with six assigned service hours and eight clocked hours including a half-hour recorded break. Then review today/future dates.",
    "expected": "past productivity is 6 ÷ 7.5 = 80%. Today/future use scheduled hours. Durations estimate work; no employee stopwatch is required. Refunded performed services still count; cancelled, voided and no-show work does not. Work without an assigned employee is not credited to someone arbitrarily."
  },
  {
    "id": "27",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Sales, accounts and other reports",
    "steps": "Compare your test tickets against Reports, including Reconciliation, Deposits, Account changes, Voids, refunds, gift cards, prepaid packages, stock/cost, memberships, customer outcomes and message results. Try CSV export and printing.",
    "expected": "sales, tax, tips and old-balance collections remain distinct. For example, $100 new services + $8 tax + $25 old balance means $133 collected but $100 new service sales. Tax reports count closed tickets. Paused VIP memberships are excluded from retained membership counts. Each report's dates and shop match your selection."
  },
  {
    "id": "28",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Scheduled staff reports",
    "steps": "Open Reports → Scheduled staff reports. Configure one test report to your own email, then review daily/weekly/monthly options.",
    "expected": "scheduling stays off until configured. Missing monthly dates use the last day of the month. Missed reports use the settings that applied when each was due. Actual timed delivery and recovery after host downtime need the running host and connected email; do not mark those passed from the settings screen alone."
  },
  {
    "id": "29",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Custom automatic rules and marketing limits",
    "steps": "Under Settings → Communications, create a small test rule that makes a staff follow-up task. Review service/package and VIP targeting, rule priority, existing-record choices, and message replacement choices.",
    "expected": "only matching records qualify. Enabling lets the tenant choose whether existing records qualify. Matching custom messages replace the selected standard message as configured. Factory marketing allowance is one per customer per week for rebooking/promotions; ordinary appointment messages are separate. These rules do not gain unauthorized automatic account or appointment-status changes."
  },
  {
    "id": "30",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Customer conversations and follow-ups",
    "steps": "With OpenAI and messaging connected, send a test offer to your own phone and reply, “Not this month.” Try an appointment date/time question too.",
    "expected": "only that customer's relevant offer pauses. Conversation handling continues and remembers context. The offer resumes only if still relevant. Factory “next month” timing uses the original send date: 1st–22nd → next month's 1st; 23rd onward → next month's 15th, at 9 AM. An explicit customer date takes priority. Appointment answers use the saved dog's name, date and time. Without the connections, mark delivery/conversation tests WAITING FOR CONNECTION."
  },
  {
    "id": "31",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Offline work and reconnecting",
    "steps": "While online, allow the test device to finish preparing its offline information. Stay on that same GroomPro address. Disconnect internet, move a fictional appointment, review reports and try approved offline customer/service/package/schedule work. Close/reopen, then reconnect.",
    "expected": "available saved records remain usable, queued changes survive reopening and sync once. Pending appointment moves affect forecasts/planned reports; they do not invent payments or closed sales. Conflicts request review rather than silently overwriting somebody else's changes. Report history shows its saved-through date. Messages and external payments cannot actually send while offline."
  },
  {
    "id": "32",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Location access, permissions and saved preferences",
    "steps": "Test a one-location business, then a test business with sharing groups. Sign in with an ordinary employee and an authorized owner. Review the same customer, reports and Whiteboard visibility.",
    "expected": "a one-location business does not require an unnecessary shop choice. Groups set in Settings → Locations & hours → Customer sharing control access. Restricted records remain restricted across screens. Whiteboard layout remains unchanged. Owner/developer access uses its authorized sign-in path; employee PINs remain bound to the selected verified business."
  },
  {
    "id": "33",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Optional features and seven-stage care",
    "steps": "With developer access, review subscription feature choices and grants. For a test tenant with seven-stage care enabled, open Settings → Calendar & Workflow → Seven-stage care and edit an instruction.",
    "expected": "access follows the tenant's granted features. Instructions save without changing the seven approved stage names/order. This does not establish that subscription payment collection is connected."
  },
  {
    "id": "34",
    "section": "STAFF, REPORTS AND AUTOMATION",
    "title": "Import/export and Windows catalog correction",
    "steps": "Use Settings → Data & integrations → Starter library to review the approved catalog. If you already have a harmless supported sample import, preview its customer/pet links and notes before importing. Review an authorized tenant export.",
    "expected": "the unchanged reviewed catalog is accepted. Imports do not guess pet ownership from a name alone or duplicate already-linked source records. Exported business information excludes passwords/API secrets. The real 123Pet backup test remains tabled; do not treat it as completed by this check."
  },
  {
    "id": "35",
    "section": "LATEST FIXES — PIN AND PICKUP NOTICES",
    "title": "Employee PIN and Menu Order",
    "steps": "Sign out, right-click the blue menu, choose Reorder Menu, and move one item. Enter a regular employee PIN. Refresh after signing in. Under Schedule, have an authorized manager change a test employee PIN, then sign in with it.",
    "expected": "The Employee PIN form opens above other windows. The requested order saves after sign-in. PIN resets save without a database error. Owner/device verification and role permissions still apply."
  },
  {
    "id": "36",
    "section": "LATEST FIXES — PIN AND PICKUP NOTICES",
    "title": "Pickup Notices and Calling",
    "steps": "Mark a test appointment Completed. Move and resize Pickup Notices, scroll its list, and close it with X. Mark another appointment Completed. Try the dog-name link, Send Text, and the ⋯ or right-click menu. Try Call Customer, then Record Call Already Made only after the call.",
    "expected": "The header stays visible. Closing hides notices for five minutes by default; a new completion brings them back on refresh. Ready includes the shop-local date/time. Dog names open their POS. Calling opens the device calling app without falsely recording a completed call. Undo restores the previous status. Cancel Queued Text leaves the appointment Ready and stops its pending automatic text."
  },
  {
    "id": "37",
    "section": "LATEST FIXES — PIN AND PICKUP NOTICES",
    "title": "Templates and Readable POS Search",
    "steps": "Open Messaging → Message Templates. Create a reminder and insert Dog Names, customer and appointment details. In POS, type into Employee, Status and Search Items.",
    "expected": "Templates can be edited and found through blue-menu Search. Selected customers show their dogs. Searches filter as you type, and the item window shows readable names, descriptions and prices."
  }
,{"id":"38","section":"LATEST ADDITIONS — FIND AND TEST","title":"PrePaid Setup and Plain-Language Search","steps":"Packages → + PrePaid Package → Add PrePaid. Confirm the new offer form is already open. Enter a description, then type words from a service description into Each Visit Covers. Review both employee commission choices.","expected":"Typing filters the choices. Descriptions help identify the right service. Commission wording explains whether the calculation uses the package purchase price divided by visits, or the service’s regular price."},{"id":"39","section":"LATEST ADDITIONS — FIND AND TEST","title":"All Filters and Multiple Dogs","steps":"Packages → try All, Packages and PrePaid in different combinations, then Include Inactive. In Day, hover an appointment containing two dogs, open its POS, and move the pointer away.","expected":"All starts selected in combined lists. Individual filters may be combined. Every calendar block belonging to the open appointment stays highlighted, not just the dog clicked."},{"id":"40","section":"LATEST ADDITIONS — FIND AND TEST","title":"POS Header and Pickup Text Grace Period","steps":"Day → POS → check Arrived beside the check-in time. Complete a test visit. Before five minutes pass, use Undo Completion or change its status back in Whiteboard. Repeat and let the queue run using your own phone.","expected":"Arrived has an order icon and a larger number. Completion means Ready for Pickup, not checkout. Undo or changing away from Ready cancels the queued automatic text. Settings → Communications → Automatic appointment messages controls the delay and pickup behavior. A connected text provider is needed to verify delivery."},{"id":"41","section":"LATEST ADDITIONS — FIND AND TEST","title":"Reminder Templates and Saved Messages","steps":"Messaging → Message Templates → review the included reminders. Add or edit a text and an email. Insert customer name, dog names, appointment date/time and business details. Select your test customer and appointment, choose the template, then Insert Saved Message.","expected":"Dogs are visible beside the selected customer. Inserted fields use that customer and appointment. Inserting a template does not send it. Blue-menu Search finds Message Templates when you search Choose a Template or Insert Saved Message. Existing custom templates remain."},{"id":"42","section":"LATEST ADDITIONS — FIND AND TEST","title":"Floating Guide and Shared Feedback","steps":"Blue Menu → Testing Guide. Move and resize this window alongside Day or POS. Write feedback, save it, close with X and reopen. The GroomPro owner can select Show Feedback From All Businesses.","expected":"The guide stays open when you navigate to other modules. Saved results return after refresh. Testers see their own business’s feedback; Owner/Developer can review both businesses together. Small screenshots expand without leaving the guide."}
,{"id":"43","section":"LATEST ADDITIONS — FIND AND TEST","title":"Owner/Developer — Create the Two Tester Businesses","steps":"Settings → Access & subscription → Subscription → GroomPro platform access controls → Create business. Choose Start With Sample Records From, enter the new business name and owner details, and leave Use GroomPro’s Text and Email Connection selected for testing. Open the new business and set fresh employee PINs under Schedule.","expected":"Sample customers, dogs, appointments, history, catalog and business settings are available in the new business. The original business stays unchanged. Your Owner/Developer account can open either business and see both sets of guide feedback. Existing source PINs and active sign-in sessions are not reused. Each business can use its own sending number and email connection later."}
  ,{"id": "44", "section": "LATEST ADDITIONS — FIND AND TEST", "title": "Split Tip — One Amount, Each Dog’s Team", "steps": "Settings → Tip Distribution → save Grooming percentages and a separate Full Wash split. Day → POS → Tip ($) → enter $60 → Split Tip. Try one worker, then two dogs with different Prep/Bath/Groom employees. Change the amount inside Split Tip, try Equal Split, % Split and manual amounts, then Save Tip.", "expected": "Both tip fields show the same amount. A sole worker receives the full tip automatically. % Split divides the tip equally by dog, then uses each dog’s work roles and saved service-type percentages. Save Tip records the amount and closes the window. Regular staff cannot change role settings."}
  ,{"id": "45", "section": "LATEST ADDITIONS — FIND AND TEST", "title": "Ready for Pick-Up — Reopen and Dismiss", "steps": "Day → right-click an empty calendar space → Ready for Pickup. Add Time Block remains available. Open a reminder’s ⋯ menu. Try Send Text and Call Customer with your own contact details. Dismiss after contact, and try dismissing when the customer called first.", "expected": "The selected Ready for Pickup menu option opens the reminder window even during its five-minute snooze. Actions float above the list. Dismissal hides that completion’s reminder on every device at the same location; it does not record a call or text or cancel a queued text. A new completion gets a new reminder."}
  ,{"id": "46", "section": "LATEST ADDITIONS — FIND AND TEST", "title": "Calendar — Copy, Cut and Paste a Family Appointment", "steps": "Day → right-click a test family appointment with two dogs → Copy Appointment. Right-click a new time → Paste Appointment. Cut the copied appointment and paste at another time. Check in the copied visit using In @.", "expected": "Both dogs are included. Copy creates a new visit without copied payments, tips or check-in status. Cut leaves the appointment in place until Paste succeeds. Booking checks still apply. Check-in updates POS status, time and arrival order together."}
  ,{"id":"47","section":"LATEST ADDITIONS — FIND AND TEST","title":"Customer Contacted — Record Time and Method","steps":"Ready for Pick-Up → ⋯ → Customer Contacted. Choose Phone Call, Text Message or Other, enter the time and a note such as Customer called us, then Save Contact. Open POS → History.","expected":"The reminder and history show the contact method and time. Saving this record does not send a message, place a call or mark an outgoing call as made. Dismiss Reminder still hides the notice across the location’s devices."}
  ,{"id":"48","section":"LATEST ADDITIONS — FIND AND TEST","title":"Automatic Sales Tax","steps":"Settings → Sales Tax → confirm the saved rate and automatic calculation. Open an existing unpaid appointment and add a taxable item, then an exempt item. Compare the tax with the saved percentage. Review a closed ticket.","expected":"Open appointments calculate tax from the saved rate. Exempt items, gift card purchases, tips, no-show fees and prior account balances do not add tax. Closed tickets retain their recorded tax. Authorized manual adjustments remain available."}
  ,{"id":"49","section":"LATEST ADDITIONS — FIND AND TEST","title":"Service and Package Updates — Choose Which Appointments Change","steps":"Create matching test appointments for today and next month. Services or Packages → edit that item → Where Should These Changes Apply? Try Future Appointments Only — Exclude Today, then Today and Future Appointments, and finally New Bookings Only. Check the results and any appointments listed for review. The same choices are available in Settings → Pricing for bulk and location price changes.","expected":"Future Only leaves today unchanged. Today and Future includes today’s unpaid tickets and later appointments. New Bookings Only leaves saved appointments unchanged. Closed and paid tickets retain their saved amounts. Employees, drop-off times and staff adjustments stay protected; conflicting appointments are listed for review."}
  ,{"id":"50","section":"LATEST ADDITIONS — FIND AND TEST","title":"VIP Updates — Benefits and Price Are Separate","steps":"Use a test member on a $40 VIP plan. VIP Memberships → edit the plan → add a benefit and change the plan price to $45. Select only Update Included Services for Current Members, then save and review that customer’s membership. Reopen the plan and select only Update Future Membership Charges for Current Members.","expected":"The first save updates that member’s included services while keeping the $40 price. The second applies the $45 future price without replacing the member’s included services again. Selecting both applies both; selecting neither keeps existing members’ terms. Paid charges, activation fees, billing dates and signed agreements stay unchanged."}
  ,{"id":"51","section":"LATEST ADDITIONS — FIND AND TEST","title":"Master Administration on the Current Site","steps":"Sign in with a GroomPro Platform Owner or Developer PIN. Blue Menu → Master Administration (look under ⋯ if needed). In Businesses & Plans, choose a business and Open Business. Confirm its normal Calendar opens, then use Back to GroomPro. Return to Master Administration → Features & Permissions. Finally switch to a regular employee PIN.","expected":"Both administration sections work within the current site. Business switching uses the selected business’s workspace, while Calendar and ordinary modules stay available. Master Administration disappears and closes when a regular employee signs in or the platform session ends. Existing Settings controls remain available with their existing permissions."}
  ,{"id":"52","section":"LATEST ADDITIONS — FIND AND TEST","title":"Arrival Order, Employee Search and Daycare","steps":"Settings → Calendar & Workflow → Appointment Appearance → turn on arrival order for calendar cards. In Popup Content, include Arrival Order and place it beside the scheduled time. Check in a test appointment, then hover its calendar card. Open POS → Items → search and select an employee on a package and on a service line. Add a Daycare service, then remove it.","expected":"Arrival order appears on the card and beside the time in the hover details, equally bold. Employee choices float above the ticket without stretching rows. Typing narrows the choices and selecting an employee updates the intended assignment. Daycare shows Added while the service is on the ticket. Removing it restores Not added unless daycare attendance was separately recorded."}
];
export const guideStatuses=["Not Tested","Passed","Needs Attention","Waiting for Connection"] as const;
export function guideBusinessText(text:string,name:string){return text.replace(/your test business|your shop|test business/gi,name).replace(/\btenants\b/gi,name).replace(/\btenant\b/gi,name);}

export const guideScreenshots:Record<string,{src:string;caption:string}>={
"23":{src:"/testing-guide/prepaid-packages.png",caption:"Packages → + PrePaid Package → Add PrePaid"},
"36":{src:"/testing-guide/pickup-notices.png",caption:"Pickup Notices → Dog Name, Send Text and ⋯"},
"37":{src:"/testing-guide/find-items.png",caption:"Day → POS → Items → Search Items"},
"38":{src:"/testing-guide/prepaid-packages.png",caption:"Packages → PrePaid Packages → Each Visit Covers"},
"40":{src:"/testing-guide/pickup-notices.png",caption:"Pickup Notices → Undo Completion"},
"41":{src:"/testing-guide/message-templates.png",caption:"Messaging → Message Templates"},
"49":{src:"/testing-guide/catalog-update-choices.png",caption:"Services or Packages → Edit → Where Should These Changes Apply?"},
"50":{src:"/testing-guide/vip-update-choices.png",caption:"VIP Memberships → Edit VIP Plan → Apply Changes to Current VIP Members"},
"51":{src:"/testing-guide/master-administration.png",caption:"Blue Menu → Master Administration → Businesses & Plans"},"52":{src:"/testing-guide/employee-picker-floating.png",caption:"POS → Items → Employee Choices Float Above the Ticket"}
};
