---
title: DNS as a Security Surface
excerpt: Your NS records control who can modify your DNS, making them a security target.
---

DNS is usually discussed in terms of availability: will users be able to reach your service? [DNS failures are hard to diagnose](/articles/why-dns-failures-are-hard-to-diagnose) precisely because they happen before your application runs. But DNS is also a security surface, and a particularly dangerous one. An attacker who controls your DNS controls where your traffic goes.

The security implications of DNS compromise are severe. An attacker can redirect your users to malicious servers, intercept authentication tokens, issue fraudulent SSL certificates for your domain, and read all traffic intended for your services. Unlike most attacks that target your infrastructure, DNS attacks can happen entirely outside your control.

## NS Records: The Keys to Your Domain

Your NS (nameserver) records determine which DNS servers are authoritative for your domain. Whoever controls those nameservers controls your entire DNS configuration.

If an attacker changes your NS records to point to their nameservers, they can:

- Redirect your website to a phishing page
- Intercept email by changing MX records
- Issue valid SSL certificates using DNS validation
- Redirect API traffic to capture credentials

This is not theoretical. Domain hijacking through NS record manipulation has affected major companies. The attack vector is often the domain registrar account, not the DNS provider itself.

Monitoring your NS records should be a security measure, not just an availability check. Any unexpected change to NS records is a potential indicator of compromise and should trigger immediate investigation.

## Record Types and Threat Models

Different DNS record types present different security concerns. Your monitoring strategy should reflect your specific threat model.

**NS Records**: Changes indicate potential domain hijacking. This is the highest priority security concern. Any unexpected NS change should be treated as a security incident until proven otherwise.

**MX Records**: Changes can redirect email to attacker-controlled servers. This enables business email compromise, password reset interception, and data exfiltration. Organizations handling sensitive communications should monitor MX records closely.

**A and AAAA Records**: Changes redirect web traffic. While this could indicate compromise, it's also commonly changed during legitimate deployments. Monitor for unexpected changes, particularly to critical services. Consider [monitoring from multiple regions](/articles/regional-monitoring-latency-is-not-universal) to detect targeted attacks.

**TXT Records**: Often used for domain verification (SPF, DKIM, domain ownership). Changes can affect email deliverability and may indicate attempts to verify domain ownership for malicious purposes.

**CAA Records**: Control which certificate authorities can issue certificates for your domain. Removal or modification could be a precursor to fraudulent certificate issuance.

**CNAME Records**: Subdomain takeover is possible when CNAME records point to services you no longer control. Monitor for dangling CNAMEs pointing to unclaimed resources.

## The Registrar as Attack Vector

Your domain registrar is often the weakest link in DNS security. Registrar accounts are protected by passwords, sometimes weak ones, and may lack proper multi-factor authentication.

Attackers target registrar accounts through:

- Credential stuffing from breached password databases
- Social engineering of registrar support staff
- Exploiting account recovery processes
- Compromising email accounts used for registrar communication

Once an attacker has registrar access, they can change NS records, disable domain lock, and transfer the domain entirely. Some of these changes can be reversed, but the damage during the attack window can be severe.

Monitoring cannot prevent registrar compromise, but it can detect it quickly. The faster you detect unauthorized NS changes, the faster you can begin incident response and contact your registrar.

## DNS Monitoring as Security Control

Treating DNS monitoring as a security control changes how you approach it. Availability monitoring asks "is DNS working?" Security monitoring asks "is DNS correct?"

Security-focused DNS monitoring should:

- Alert immediately on NS record changes, not just failures
- Track all record changes over time for forensic purposes
- Compare current records against known-good baselines
- Monitor from multiple geographic locations to detect targeted attacks

The baseline comparison is particularly important. You should know what your DNS records should be, not just whether they resolve. A record that resolves correctly but to the wrong IP is a security incident, not an availability incident. This is similar to how [status codes can lie](/articles/status-codes-lie) when the response content isn't what you expect.

## Response Planning

DNS security incidents require specific response procedures. Unlike application incidents where you control the infrastructure, DNS incidents may require coordination with third parties.

Your response plan should include:

- Registrar contact information and account recovery procedures
- DNS provider emergency contacts
- Pre-authorized personnel who can make DNS changes
- Documentation of correct DNS configuration for rapid restoration
- Legal contacts for domain disputes if necessary

The time to establish these relationships and procedures is before an incident, not during one. Registrar support queues can be slow, and proving domain ownership during an active attack is challenging.

## Beyond Monitoring

DNS monitoring is one layer of a defense-in-depth approach to DNS security. Other measures include:

- Registrar lock to prevent unauthorized transfers
- Multi-factor authentication on registrar accounts
- Separate, secure email for registrar communications
- CAA records to limit certificate issuance
- DNSSEC to prevent response spoofing

None of these measures are perfect, and none replace monitoring. They reduce the likelihood of compromise, while monitoring reduces the time to detect compromise. Both are necessary for a robust DNS security posture.
