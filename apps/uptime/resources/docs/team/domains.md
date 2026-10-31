---
title: Team Domains
description: Add verified domains to automatically provision new team members based on their email address.
section:
  title: Team & Settings
  order: 5
order: 3
lastUpdated: 2026-10-31
notice: "Only team owners and admins can do this."
next: ["/docs/guides/check-a-sign-in-flow", "/docs/team/members"]
---

Team domains let you automatically add new users to your team based on their email address. When you verify a domain like `company.com`, anyone who signs up with an `@company.com` email address is automatically added to your team.

This streamlines onboarding for organizations where team members share a common email domain. A verified domain is also what lets your team create [flow monitors](/docs/guides/check-a-sign-in-flow) that reach it.

## How It Works

1. You add and verify a domain (e.g., `company.com`)
2. A new user signs up with an email like `jane@company.com`
3. The user is automatically added to your team upon registration

No manual invitations required. Team members can start collaborating immediately after signing up.

## Adding a Domain

1. Open <ui>Settings</ui> in the sidebar
2. Under **Domains**, click <ui>Add Domain</ui>
3. Enter your domain (e.g., `company.com`) in <ui>Domain</ui>
4. Click <ui>Add Domain</ui>

The domain appears in your list as <ui>Awaiting verification</ui>. You must verify ownership before auto-provisioning takes effect.

## Verification Process

Domain verification uses a DNS TXT record to confirm you control the domain. This prevents unauthorized teams from claiming domains they don't own.

### Step 1: Copy the Verification Record

After adding a domain, the **Verification ID** column shows its unique value, such as `ping_0190f3a2-…`. Copy it exactly as shown, or use <ui>Copy Verification ID</ui> from the domain's <ui>Actions Menu</ui>.

### Step 2: Add the DNS Record

Log into your DNS provider (Cloudflare, Route 53, GoDaddy, Namecheap, etc.) and add a new TXT record:

| Field     | Value                                           |
| --------- | ----------------------------------------------- |
| Type      | TXT                                             |
| Name/Host | `_ping-verification`                            |
| Value     | Your Verification ID, such as `ping_0190f3a2-…` |
| TTL       | 300 (or your provider's default)                |

For example, if you're verifying `company.com`:

- The **Name** field should be `_ping-verification` (some providers may require `_ping-verification.company.com`)
- The **Value** field should be the full Verification ID, including its `ping_` prefix

> [!NOTE]
> Some DNS providers require you to enter the full domain in the name field, while others only want the subdomain portion. Check your provider's documentation if you're unsure.

### Step 3: Wait for DNS Propagation

DNS changes can take anywhere from a few minutes to 48 hours to propagate globally, though most providers propagate within 5-15 minutes.

You can check if your record has propagated using online DNS lookup tools or by running:

```bash
dig TXT _ping-verification.company.com
```

### Step 4: Complete Verification

Once the DNS record is in place:

Uptime checks pending domains for the TXT record on its own. To check right away:

1. Return to <ui>Settings</ui> and find your domain under **Domains**
2. Open its <ui>Actions Menu</ui>
3. Choose <ui>Retry Verification</ui>

When the record is found and matches, **Verified At** shows the date and auto-provisioning becomes active.

## Auto-Provisioning Behavior

Once a domain is verified:

- **New signups**: Users who register with a matching email domain are automatically added to your team
- **Existing users**: Users who already have accounts are not automatically added. You must invite them manually
- **Role assignment**: Auto-provisioned members receive the default member role. Admins can adjust roles after they join
- **Multiple teams**: If multiple teams have verified the same domain, users are added to all of them

## Managing Domains

### Viewing Domain Status

Open <ui>Settings</ui> and look under **Domains** to see all your domains and their status in the **Verified At** column:

- **A date**: Domain is verified and auto-provisioning is enabled
- <ui>Awaiting verification</ui>: Domain added but its TXT record hasn't been found yet

### Removing a Domain

To remove a domain:

1. Open <ui>Settings</ui> and find the domain under **Domains**
2. Open its <ui>Actions Menu</ui>
3. Choose <ui>Remove Domain</ui>

> [!NOTE]
> Removing a domain immediately stops auto-provisioning for that email domain. Existing team members are not affected—they remain on the team.

You can optionally remove the TXT verification record from your DNS provider after removing the domain.

### Multiple Domains

You can verify multiple domains for a single team. This is useful if your organization uses multiple email domains:

- `company.com`
- `company.co.uk`
- `subsidiary.com`

Each domain requires its own verification process.

## Common Issues

### Verification Failing After Adding Record

**DNS hasn't propagated yet.** Wait 15-30 minutes and try again. In rare cases, propagation can take up to 48 hours.

**Wrong record type.** Ensure you created a TXT record, not a CNAME or A record.

**Incorrect record name.** Double-check the hostname/name field matches exactly what Uptime expects. Some providers automatically append your domain.

**Value mismatch.** Copy the Verification ID exactly as shown, including the `ping_` prefix. Don't add quotes or extra spaces.

### Record Shows in DNS but Verification Still Fails

Some DNS providers add quotation marks around TXT values automatically. If you added quotes manually, you may have double quotes in the actual record. Remove any quotes you added and let the provider handle formatting.

### Users Not Being Auto-Provisioned

**Domain not verified.** Check that **Verified At** shows a date for the domain in <ui>Settings</ui>.

**User already exists.** Auto-provisioning only applies to new signups. Existing users must be invited manually.

**Email domain doesn't match exactly.** The email domain must match the verified domain exactly. Subdomains are not included (e.g., verifying `company.com` does not cover `mail.company.com`).

### Can I Use Subdomains?

Yes, you can verify subdomains separately. If your team uses `team.company.com` email addresses, verify `team.company.com` as its own domain.
