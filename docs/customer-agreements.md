# Customer intake and VIP agreements

Open **Customers → Agreement Settings** to choose channels and edit policy sections. All three channels are enabled by default. The supplied Rubber Doggies policy templates apply to the Rubber Doggies business. Other businesses can enter their own terms and shop email. Use an HTTPS video link for an optional policy video.

For an existing customer, open **Customer Profile → ⋯ → Agreements** to open intake or retrieve signed copies. For VIP signup, open the customer’s **POS Ticket → VIP Memberships**, choose the dog, plan, billing day and quoted price, and click **Enroll Dog**. Once the agreement is signed, click **Finish enrollment** to complete the existing membership workflow.

On the shop device, sign in with an employee PIN and choose **Customers → Open Tablet** once. Customers enter their phone number to start, and the open form does not inherit the staff PIN timeout. **Text code needed for existing profiles** is optional in Agreement Settings. Public self-service and links for new customers verify the mobile number before accessing or creating a profile. Enable the online channel and use its intake link as the entry point for new customers on the booking site. Set the optional HTTPS booking page address to offer **Continue to booking** after signing.

The form saves edits to the live profile when a customer completes each field. The signed PDF records the profile details and terms the customer reviewed. Staff can open it in the Agreements tab. The dedicated intake tablet resets to a clean form after both emails are accepted. If email is unavailable, the signed PDF can be downloaded and **Done** clears the tablet for the next customer.

## Hosting setup

- Text verification uses the business's existing Twilio configuration in `GROOMPRO_SMS_TENANTS_JSON`.
- Automatic PDF copies use Resend. Set `GROOMPRO_AGREEMENT_EMAIL_TENANTS_JSON` to a JSON object keyed by GroomPro tenant ID. For each business, include `apiKey` and `from`, using a verified sender. Store the actual secret only in hosting configuration.
- Set the business's recipient address in **Agreement settings → Shop email for signed copies**. The other copy uses the customer email shown in the form.
- If email delivery is unavailable, customers can still download the signed PDF and staff can retrieve it from the profile.
