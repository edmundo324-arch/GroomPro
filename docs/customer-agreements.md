# Customer intake and VIP agreements

Open **Customers → Customer intake & agreement settings** to choose channels and edit policy sections. All three channels are enabled by default. The supplied Rubber Doggies policy templates apply to the Rubber Doggies business. Other businesses can enter their own terms and shop email. Use an HTTPS video link for an optional policy video.

For an existing customer, open **Customer Profile → Agreements**. Choose intake or VIP, then create a private link or open the form on the shop tablet. For VIP, choose the dogs to offer and enter the recurring price in dollars for each one. The customer selects the dogs they agree to enroll. Signing records the agreement and the quoted prices. Staff complete membership activation through the existing VIP workflow.

For a new customer, issue a form from **Customers → Customer intake & agreement settings**. Public self-service and new-customer links verify the mobile number before accessing or creating a profile. Enable the online channel and use its intake link as the entry point for new customers on the booking site. Set the optional HTTPS booking page address to offer **Continue to booking** after signing.

The form saves edits to the live profile when a customer completes each field. The signed PDF records the profile details and terms the customer reviewed. Staff can open it in the Agreements tab. Completing the shop tablet form and clicking **Done** clears it from that tab.

## Hosting setup

- Text verification uses the business's existing Twilio configuration in `GROOMPRO_SMS_TENANTS_JSON`.
- Automatic PDF copies use Resend. Set `GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON` to a JSON object keyed by GroomPro tenant ID. For each business, include `apiKey` and `from`, using a verified sender. Store the actual secret only in hosting configuration.
- Set the business's recipient address in **Agreement settings → Shop email for signed copies**. The other copy uses the customer email shown in the form.
- If email delivery is unavailable, customers can still download the signed PDF and staff can retrieve it from the profile.
