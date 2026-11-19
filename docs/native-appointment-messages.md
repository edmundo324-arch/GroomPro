# Native appointment messages

GroomPro owns this scheduler. It does not use Airo Automations, an external cron service, or an open employee browser.

## Running it

Use the existing production command, `npm start`, or the package entry point `scripts/godaddy-start.cjs`. After database bootstrap succeeds, the launcher starts the application and its native appointment scheduler. It generates a private, temporary internal credential automatically; tenants do not enter or manage a scheduler key. The loop checks through tenant/ticket pages and pauses one minute after a complete pass. Development and production builds do not start sending.

The hosting service must keep the Node process running. A suspended, stopped, or serverless-only process cannot send at the requested time. Starting Next directly bypasses GroomPro’s launcher and does not start the scheduler. This needs live deployment verification; a passing local build is not proof that the host keeps the process running.

## Tenant controls

Settings → Communications → Automatic appointment messages contains the factory-on schedule, channel choice, customer website address, reschedule prompt, and editable wording. The website address must be the public HTTPS origin of this GroomPro installation, without preview credentials. Links include the specific tenant and shop location and open the existing authenticated customer portal; they do not expose customer records or bypass verification.

SMS/email delivery still needs the existing provider configuration and subscription permissions. SMS respects current texting consent. Settings reports the latest scheduler check and setup problems; Communication History records each attempted delivery. Reopen Settings to refresh the check information.

Factory repeat requests: 7, 5, 3 and 2 days before at 9 AM, then appointment morning at 7 AM, using the shop time zone. The initial request is queued transactionally when a future appointment is created or a shop accepts a pending online booking. Pending requests do not send. Past schedule times at activation are skipped; requests never send at or after appointment start.

Customer attendance confirmation is distinct from the shop’s POS status. It stops confirmation requests for that saved date/time. Customers can select multiple optional reminders. The POS Status help shows the recorded customer confirmation. Add to calendar remains available through the existing portal control.

Staff moving a customer-confirmed appointment choose whether to request confirmation again, move without sending, or cancel the change. The prompt is factory-on and tenant-editable. It also covers changes to the appointment’s start caused by timed service removal. Offline changes wait for sync; a required confirmation choice is available in Offline changes before the server applies the change.

## Reliability boundaries

Each tenant, ticket, saved appointment start, message kind, scheduled instant and channel has a stable delivery identifier. Repeated checks and server restarts reuse the stored Communication entry rather than send the same copy again. Unknown, failed or interrupted provider outcomes are not automatically retried for that identifier. Staff review Communication History. Provider acceptance is not delivery confirmation.

Before sending, the dispatcher rechecks the saved appointment time, customer confirmation, pending cancellation, tenant policy and access. A message already accepted by a provider cannot be recalled when staff subsequently move or cancel an appointment.

After server downtime, only the most recent due request/reminder for each kind is considered, rather than sending a backlog of old messages together. Existing schedule times before the tenant activation boundary remain skipped. Invalid local clock times (for example a nonexistent daylight-saving time) surface a preparation problem rather than inventing a different send time.

No schema migration is introduced; policy, attendance and runtime check metadata use existing tenant settings. Policy and attendance are included in tenant exports; runtime credentials are not.

## Verification

Focused tests cover the scheduler lifecycle and private endpoint, tenant and customer isolation, saved delivery identifiers, uncertain outcomes, confirmation/reminder selection, activation, rescheduling, indirect timing changes and offline decision metadata. No live customer texts or emails were sent during implementation. Live provider delivery, host uptime and a full device/database offline round trip require deployment validation.

Customer Profile → Details exposes the existing appointment-email/text choices and invalid-address flags. Automatic messages skip disabled or invalid channels, and the delivery helper checks again immediately before sending. Individual phone SMS permission remains required. These choices do not change the existing explicit receipt/agreement/manual-message workflows.
