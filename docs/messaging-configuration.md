# Tenant SMS configuration

Set server-only `GROOMPRO_SMS_TENANTS_JSON` to a JSON object keyed by exact tenant ID. Each entry requires `accountSid`, `authToken`, `from` (E.164 number), and optionally `webhookUrl` (the public HTTPS URL ending in `/api/integrations/twilio`, without a query string). Never put credentials in browser settings, import archives, or source control.

When `webhookUrl` is present, outbound sends include a signed status callback destination. Configure the Twilio phone number's incoming-message webhook to that URL with `?tenantId=YOUR_TENANT_ID` appended (URL-encode the ID). Use POST. Incoming messages from known customer phone contacts appear in the existing communication history; unknown numbers are not automatically assigned to a customer.

Callbacks validate the provider signature against the configured public URL and tenant account. Repeated inbound callbacks are deduplicated. Delayed queued/sent callbacks cannot overwrite a final delivered/failed result. No provider credential or global sending number is shared implicitly between tenants.

Without configuration, messages are saved as NOT_CONFIGURED and explicitly reported as not sent. A provider acceptance is not delivery. Network uncertainty is recorded as UNKNOWN with no automatic resend. Check the provider before manually resending an uncertain message.

Provider references: [request signatures](https://www.twilio.com/docs/usage/security) and [outbound status callbacks](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status).
