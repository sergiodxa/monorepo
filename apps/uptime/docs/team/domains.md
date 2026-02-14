---
title: Team Domains
description: Add verified domains to automatically provision new team members based on their email address.
section:
  title: Team & Settings
  order: 3
order: 3
lastUpdated: 2026-02-14
---

Team domains let you automatically add new users to your team based on their email address. When you verify a domain like `company.com`, anyone who signs up with an `@company.com` email address is automatically added to your team.

This streamlines onboarding for organizations where team members share a common email domain.

## How It Works

1. You add and verify a domain (e.g., `company.com`)
2. A new user signs up with an email like `jane@company.com`
3. The user is automatically added to your team upon registration

No manual invitations required. Team members can start collaborating immediately after signing up.

## Adding a Domain

1. Navigate to **Team Settings** in the sidebar
2. Select the **Domains** tab
3. Click **Add Domain**
4. Enter your email domain (e.g., `company.com`)
5. Click **Add**

The domain appears in your list with a "Pending Verification" status. You must verify ownership before auto-provisioning takes effect.

## Verification Process

Domain verification uses a DNS TXT record to confirm you control the domain. This prevents unauthorized teams from claiming domains they don't own.

### Step 1: Copy the Verification Record

After adding a domain, Uptime displays the verification details:

- **Record Type**: TXT
- **Host/Name**: `_uptime-verification` (or the full record name shown)
- **Value**: A unique verification string like `uptime-verification=abc123xyz`

Copy the verification value exactly as shown.

### Step 2: Add the DNS Record

Log into your DNS provider (Cloudflare, Route 53, GoDaddy, Namecheap, etc.) and add a new TXT record:

| Field     | Value                                            |
| --------- | ------------------------------------------------ |
| Type      | TXT                                              |
| Name/Host | `_uptime-verification`                           |
| Value     | `uptime-verification=abc123xyz` (your unique ID) |
| TTL       | 300 (or your provider's default)                 |

For example, if you're verifying `company.com`:

- The **Name** field should be `_uptime-verification` (some providers may require `_uptime-verification.company.com`)
- The **Value** field should be the full verification string provided by Uptime

> **Note**: Some DNS providers require you to enter the full domain in the name field, while others only want the subdomain portion. Check your provider's documentation if you're unsure.

### Step 3: Wait for DNS Propagation

DNS changes can take anywhere from a few minutes to 48 hours to propagate globally, though most providers propagate within 5-15 minutes.

You can check if your record has propagated using online DNS lookup tools or by running:

```bash
dig TXT _uptime-verification.company.com
```

### Step 4: Complete Verification

Once the DNS record is in place:

1. Return to **Team Settings** > **Domains**
2. Find your pending domain
3. Click **Verify**

Uptime queries DNS for the TXT record. If found and matching, the domain status changes to "Verified" and auto-provisioning becomes active.

If verification fails, click **Retry Verification** after confirming your DNS record is correct and has had time to propagate.

## Auto-Provisioning Behavior

Once a domain is verified:

- **New signups**: Users who register with a matching email domain are automatically added to your team
- **Existing users**: Users who already have accounts are not automatically added. You must invite them manually
- **Role assignment**: Auto-provisioned members receive the default member role. Admins can adjust roles after they join
- **Multiple teams**: If multiple teams have verified the same domain, users are added to all of them

## Managing Domains

### Viewing Domain Status

Navigate to **Team Settings** > **Domains** to see all your domains and their status:

- **Verified**: Domain is active and auto-provisioning is enabled
- **Pending Verification**: Domain added but DNS verification not yet complete
- **Verification Failed**: DNS record not found or doesn't match

### Removing a Domain

To remove a domain:

1. Navigate to **Team Settings** > **Domains**
2. Find the domain you want to remove
3. Click the menu icon (three dots)
4. Select **Remove Domain**

> **Important**: Removing a domain immediately stops auto-provisioning for that email domain. Existing team members are not affected—they remain on the team.

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

**Value mismatch.** Copy the verification string exactly as shown, including the `uptime-verification=` prefix. Don't add quotes or extra spaces.

### Record Shows in DNS but Verification Still Fails

Some DNS providers add quotation marks around TXT values automatically. If you added quotes manually, you may have double quotes in the actual record. Remove any quotes you added and let the provider handle formatting.

### Users Not Being Auto-Provisioned

**Domain not verified.** Check that the domain status shows "Verified" in Team Settings.

**User already exists.** Auto-provisioning only applies to new signups. Existing users must be invited manually.

**Email domain doesn't match exactly.** The email domain must match the verified domain exactly. Subdomains are not included (e.g., verifying `company.com` does not cover `mail.company.com`).

### Can I Use Subdomains?

Yes, you can verify subdomains separately. If your team uses `team.company.com` email addresses, verify `team.company.com` as its own domain.
