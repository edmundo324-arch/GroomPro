# Customer conversations through the OpenAI API

GroomPro keeps the original offer, customer replies and sent responses in its own communication history. It sends the relevant recent conversation and current shop facts to the OpenAI Responses API with provider response storage disabled. No browser receives the API key.

## Connection
Set `OPENAI_API_KEY` in the server environment, then restart the application. An optional `GROOMPRO_OPENAI_MODEL` selects a compatible model that supports strict structured responses. The default is `gpt-6.2-astra`. A ChatGPT subscription does not configure this server connection. No live connection or provider delivery was exercised during local verification.

Tenant controls are in Settings → Communications → Customer conversations. Existing role checks allow owners and managers to change them. Turning AI replies off leaves incoming messages available to staff and preserves customer-requested pauses.

## Approved scope
Replies to custom marketing offers and standard rebooking invitations can continue the original conversation. Existing appointment-confirmation and simple date/time handlers run first. The AI cannot edit appointments, accounts, customer consent or pricing. Missing facts and ambiguous requests remain for staff review.

For “next month,” the original offer's shop-local send date determines the factory day: 1–22 gives the 1st; 23–month-end gives the 15th. The month is relative to the customer reply, at 09:00 shop time. Tenant overrides and explicit customer dates are supported. Resumption checks current rule version, eligibility, future bookings, visits since the offer, contact preferences and marketing limits. Changed or uncertain circumstances do not silently send the old offer.

Customer Profile → Communication History → Pending follow-ups lists pending, paused and review-needed offer conversations. Staff can stop one with a recorded reason. Other customers and appointment reminders remain unaffected. A new customer reply continues to be received and evaluated; stopping an offer never shuts down the inbox.

## Delivery and verification limits
The existing GroomPro server scheduler runs the conversation work without an open browser. Customer locks, processing leases, stable communication IDs and existing provider submission safeguards protect against duplicate work. Uncertain delivery is retained for review rather than automatically resent.

Focused isolated tests cover dates, tenant settings access, response validation, stale replies, pauses, fresh booking checks, scheduler continuation and staff visibility. They do not replace real database concurrency, hosting, API-key setup, email/SMS delivery or provider webhook verification. No live messages or production records were used, and no changes were published.
