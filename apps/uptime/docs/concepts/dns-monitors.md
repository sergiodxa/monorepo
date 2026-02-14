---
title: DNS Monitors
description: Check DNS records for your domains and get alerted when they change, fail to resolve, or don't match expected values.
section:
  title: Concepts
  order: 2
order: 3
lastUpdated: 2026-02-14
---

DNS records control how users reach your website, where your email is delivered, and how third-party services verify your domain ownership. DNS monitoring helps you:

- **Detect unauthorized changes** - Get alerted if someone modifies your DNS records without authorization, which could indicate a compromised account or domain hijacking attempt
- **Verify propagation** - Confirm that DNS changes have propagated correctly after making updates
- **Catch misconfigurations** - Identify typos or incorrect values before they cause outages
- **Track expiration issues** - Notice when nameserver delegations change unexpectedly

## Supported Record Types

DNS monitors support the following record types:

### A Records

A records map a domain name to an IPv4 address. These are the most common DNS records and control where your domain points.

```
example.com.  A  192.0.2.1
```

### AAAA Records

AAAA records map a domain name to an IPv6 address. Monitor these alongside A records if your infrastructure supports IPv6.

```
example.com.  AAAA  2001:db8::1
```

### CNAME Records

CNAME (Canonical Name) records create an alias from one domain name to another. These are commonly used for subdomains that point to external services.

```
blog.example.com.  CNAME  example.netlify.app.
```

### MX Records

MX (Mail Exchange) records specify which mail servers handle email for your domain. Incorrect MX records mean you won't receive email.

```
example.com.  MX  10 mail.example.com.
```

### TXT Records

TXT records store text data and are commonly used for domain verification, SPF email authentication, and DKIM keys.

```
example.com.  TXT  "v=spf1 include:_spf.google.com ~all"
```

### NS Records

NS (Name Server) records specify which DNS servers are authoritative for your domain. Changes to NS records could indicate domain hijacking.

```
example.com.  NS  ns1.example-dns.com.
```

## Configuration Options

When creating a DNS monitor, you can configure the following options:

### Domain Name

The fully qualified domain name to query. This can be your root domain (`example.com`) or any subdomain (`api.example.com`, `mail.example.com`).

### Record Type

Select which DNS record type to monitor from the supported types listed above.

### Expected Value

Optionally specify the value you expect the record to contain. When set, the monitor will alert you if the resolved value differs from your expected value.

Leave this blank if you only want to monitor that the record exists and resolves successfully, without checking for a specific value.

### Check Interval

How often to query the DNS record. Available intervals range from 5 minutes to 24 hours.

Since DNS records change infrequently, longer intervals (1 hour or more) are appropriate for most use cases. Use shorter intervals only when actively making DNS changes and monitoring propagation.

## Monitor Statuses

DNS monitors report one of three statuses:

| Status      | Description                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **OK**      | The DNS record resolved successfully. If an expected value is configured, the resolved value matches.                                    |
| **Changed** | The DNS record resolved, but the value differs from the expected value you configured.                                                   |
| **Error**   | The DNS query failed. This could mean the record doesn't exist, the nameservers are unreachable, or there's a DNS configuration problem. |

## Best Practices

### Monitor Critical Records

Focus on the DNS records that matter most to your business:

- **A records for your main domain** - These control access to your primary website
- **MX records** - Essential for receiving email
- **CNAME records for critical subdomains** - API endpoints, CDN configurations, etc.

### Set Expected Values for Stable Records

For records that shouldn't change, configure an expected value. This catches unauthorized modifications immediately rather than waiting for an outage.

### Use Longer Check Intervals

DNS changes are rare in normal operations. Checking every hour or every few hours is usually sufficient. This reduces unnecessary queries while still catching issues in a reasonable timeframe.

Reserve shorter intervals (5-15 minutes) for:

- Actively monitoring DNS propagation after making changes
- Records that are dynamically updated

### Monitor Nameserver Records

Your NS records determine who controls your DNS. Monitor these to detect potential domain hijacking attempts. If your NS records change unexpectedly, investigate immediately.

### Monitor Multiple Record Types

For critical domains, consider monitoring multiple record types:

- A record for the root domain
- A or CNAME record for `www`
- MX records for email delivery
- NS records for security
