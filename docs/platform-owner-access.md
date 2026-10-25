# GroomPro company authority

Platform Owner is the highest platform role. Edmundo and Zagla, the company owners, have platform-wide access above Developer. Tenant Admin remains limited to its business.

Only Platform Owners may grant Owner authority or change an Owner's account or PIN. Developers retain platform administration for other accounts and businesses. Normal employee editing preserves platform authority; role removal and deactivation belong in platform access settings. An administrator cannot demote or deactivate their own platform account there.

The GoDaddy startup bootstrap appends PLATFORM_OWNER to both role enums and runs a one-time, audited migration for existing Edmundo and Zagla accounts with last name Saenz, Saens, or S. It does not match Zagla Maria or Zagla Paz. The completion marker prevents future tenant accounts from gaining platform access merely by sharing a name. Existing PINs and production assignments are preserved.

Upload the prepared commit, then sync and restart GoDaddy normally. The build regenerates Prisma and the startup bootstrap applies the database change. No manual secret or PIN change is needed. A newly initialized empty installation does not receive default Owner accounts or credentials.
