# Tenant SMS configuration

Set server-only `GROOMPRO_SMS_TENANTS_JSON` to a JSON object keyed by exact tenant ID. Each entry requires `accountSid`, `authToken`, `from` (E.164 number), and optionally `webhookUrl` (the public HTTPS URL ending in `/api/integrations/twilio`, without a query string). Never put credentials in browser settings, import archives, or source control.

When `webhookUrl` is present, outbound sends include a signed status callback destination. Configure the Twilio phone number's incoming-message webhook to that URL with `?tenantId=YOUR_TENANT_ID` appended (URL-encode the ID). Use POST. Incoming messages from known customer phone contacts appear in the existing communication history; unknown numbers are not automatically assigned to a customer.

Callbacks validate the provider signature against the configured public URL and tenant account. Repeated inbound callbacks are deduplicated. Delayed queued/sent callbacks cannot overwrite a final delivered/failed result. No provider credential or global sending number is shared implicitly between tenants.

Without configuration, messages are saved as NOT_CONFIGURED and explicitly reported as not sent. A provider acceptance is not delivery. Network uncertainty is recorded as UNKNOWN with no automatic resend. Check the provider before manually resending an uncertain message.

Provider references: [request signatures](https://www.twilio.com/docs/usage/security) and [outbound status callbacks](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status).

## Incoming texting preferences

Signed inbound STOP/START events now update the matching tenant contact's `smsEnabled` preference and record an audit entry. Provider `OptOutType` takes precedence, including customized Advanced Opt-Out keywords. Without that property, standalone standard stop keywords and START/UNSTOP are recognized. Ordinary replies (including YES or a sentence requesting an appointment cancellation) do not change consent or appointment status. Duplicate provider message IDs do not repeat the update. Preference changes remain accepted when the texting subscription is inactive; this does not enable sending without the subscription.

Enable Advanced Opt-Out on the Twilio Messaging Service to receive provider-classified customized keywords. GroomPro does not send another opt-out acknowledgment; the provider handles its own response. See [Twilio Advanced Opt-Out](https://www.twilio.com/docs/messaging/tutorials/advanced-opt-out).

## Staff-composed email

Messaging → EMAIL reuses the tenant's existing server-only `GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON` entry (`apiKey`, `from`) and Resend provider. A configured, verified sending address is still required. There is no fallback to another tenant's credentials. Staff choose the customer and press Send / Save Message; this change does not send existing drafts automatically.

The message subject uses the tenant's name. Each saved communication supplies the provider idempotency key. Acceptance is recorded as ACCEPTED, not DELIVERED. Explicit rejection is FAILED; a timeout, uncertain server error or missing provider receipt is UNKNOWN, with no automatic retry. Email delivery callbacks and a customer email inbox are not part of this batch. See [Resend idempotency keys](https://resend.com/blog/engineering-idempotency-keys).
