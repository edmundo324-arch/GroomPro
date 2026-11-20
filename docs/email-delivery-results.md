# Email delivery results

GroomPro records Resend delivery results for emails sent through the shared customer email service: staff messages, appointment messages and POS receipts. Existing sending configuration remains valid without callbacks; those messages remain accepted/unconfirmed until a verified result arrives.

## Hosting setup

1. In Resend, create a webhook for the deployed HTTPS address `/api/integrations/resend?tenantId=BUSINESS_ID`. Use the actual internal business ID, not its display name.
2. Select `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, and `email.suppressed`. Opens/clicks are not tracked.
3. In the existing secret environment setting `GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON`, add the webhook's signing secret as `webhookSecret` alongside that business's existing `apiKey` and `from`. Preserve the other business entries. Never commit the secret or put it in a browser setting.
4. Redeploy. Provider setup and a controlled real delivery must be verified on the host before claiming live operation.

The public callback requires a valid signature over the original body, with a five-minute timestamp tolerance and a 128 KiB size limit. The server must have an accurate clock. Invalid signatures cannot update records. Signed events are matched to the business's outbound email and its sender/recipient/provider ID; unknown records are ignored. Communication row locking prevents competing callbacks from overwriting one another. A delivery result is also recorded in the customer audit history and included in tenant exports.

Duplicates and older events are ignored. Final outcomes cannot regress to sent/delayed. A later delivery can resolve a prior failed/delayed state; bounce or spam complaints take precedence. These results do not automatically resend messages, change consent or mark an address invalid.

Messaging and Customer Profile → Communication History show the same explanation. Delivered is acceptance by the customer's mail server, not proof of reading. The separate signed-agreement attachment sender is not covered by this change.

## Verification

Focused tests cover the published Svix signature example, tampering, expired timestamps, malformed signatures, request size, missing authentication, tenant/recipient/provider isolation, duplicate and out-of-order events, and delivery arriving before the send response. Tests use fictional records and do not send live messages.

References: [Resend verification](https://resend.com/docs/webhooks/verify-webhooks-requests), [event types](https://resend.com/docs/webhooks/event-types), [delivery meaning](https://resend.com/docs/webhooks/emails/delivered), [Svix manual verification](https://docs.svix.com/receiving/verifying-payloads/how-manual).

## Customer replies

Optionally enable receiving on a Resend-managed receiving domain (or an explicitly configured custom receiving domain). Add `email.received` to the same signed webhook, and add `receivingDomain` to that business's existing server email configuration. Do not change an existing shop mailbox's MX records as part of ordinary deployment.

New outgoing customer messages then receive an opaque reply address linked to their customer and, when present, ticket. Signed incoming events must match that route and original recipient. GroomPro retrieves the body from Resend on the server, verifies the retrieved sender and destination again, and records an inbound communication. Repeated events do not duplicate history. Unmatched or unsolicited mail is not imported. Replies do not change booking status, customer consent or account records automatically.

Plain-text replies are displayed in the existing communication history; HTML-only bodies are converted to text. Bodies are bounded and attachments are identified but not imported. The original remains available through the provider. Existing outbound delivery remains unchanged when no receiving domain is configured. Live receiving requires provider configuration and is not yet verified on GoDaddy.

References: [Receiving email](https://resend.com/docs/dashboard/receiving/introduction), [Retrieve received email](https://resend.com/docs/api-reference/emails/retrieve-received-email), [Send email / reply_to](https://resend.com/docs/api-reference/emails/send-email).
