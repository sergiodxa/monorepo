---
title: Understanding Passkeys and WebAuthn Security
excerpt: Explore how passkeys use public key cryptography to reduce phishing risk and change auth trade-offs.
---

Passwords remain common because they are familiar, portable, and easy to explain. They also create a broad attack surface. Users reuse them, phishing pages can capture them, and a stolen password database still gives attackers material for offline cracking.

WebAuthn, the standard behind passkeys, changes that model. Instead of asking the user to reveal a secret to the server, it asks the user's device to prove possession of a private key. That shift improves security in meaningful ways, but it also changes the operational problems you need to solve.

## The Problem with Shared Secrets

Password authentication depends on a shared secret. The user knows it, and the server stores enough information to verify it later. Even with modern password hashing, that arrangement leaves several weaknesses in place.

Phishing works because users can type the same password into a fake site and a real one. Credential stuffing works because people reuse passwords across services. Database breaches remain valuable because password hashes can often be attacked offline. Each mitigation helps, but each one layers more complexity onto a model that still starts with a reusable secret.

## What Passkeys Change

Passkeys replace that shared secret with a key pair. During registration, the authenticator creates a public key and a private key. The server stores the public key, and the private key stays on the user's device, usually in hardware backed storage such as Secure Enclave, a Trusted Platform Module, or a similar secure element.

During authentication, the server sends a challenge. The authenticator signs it with the private key, and the server verifies the signature with the stored public key. The private key does not leave the device, so the server never receives a secret it could later leak.

```json
{
	"type": "public-key",
	"id": "abc123...",
	"publicKey": "MFkwEwYH...",
	"counter": 42,
	"transports": ["internal", "hybrid"]
}
```

This is roughly what the server stores for a credential: an identifier, the public key, a counter for replay protection, and transport metadata. A database breach is still serious because it exposes account relationships and credential metadata, but it does not hand attackers a reusable login secret.

## Why Origin Binding Matters

The most important security property in WebAuthn is origin binding. The authenticator signs data for the requesting origin, so a credential created for `example.com` will not satisfy a challenge from `examp1e.com`. A fake site can still trick someone into visiting it, but it cannot usually convince the authenticator to produce a valid signature for the real domain.

That makes passkeys phishing resistant in a way passwords are not. With passwords, users must notice the fake site. With WebAuthn, the protocol itself rejects the mismatch. The trade-off is that you now depend more heavily on browser and platform support for the ceremony, and on your own implementation handling the origin checks correctly.

## Where the Security Gains Come From

Passkeys improve security through several related properties. The server stores public keys instead of password verifiers, which reduces the value of a stolen authentication database. Credentials are scoped to a specific relying party, which limits reuse across sites. User verification usually happens locally through biometrics or a device PIN, which can feel similar to two factor authentication without adding a separate code entry step.

Those properties reduce common attacks, but they do not remove all risk. Session theft, weak recovery flows, compromised devices, and social engineering against support teams still matter. Passkeys narrow one part of the problem, which is often worth it, but they do not replace the rest of your account security model.

## The Operational Trade-Offs

The main appeal of passkeys is not just stronger security. They can also reduce friction. Biometric or device based verification is often faster than typing a password, and password reset flows become less central to the product. For repeat users on personal devices, that can be a real usability improvement.

The costs show up elsewhere. Users become more dependent on their devices and the ecosystem syncing those credentials. Recovery gets harder to design well because a fallback path that is much weaker than WebAuthn can undo part of the security benefit. Cross platform movement is better than it was, but it is still less seamless than the simple portability of a password.

Synced passkeys make this trade-off more nuanced. iCloud Keychain, Google Password Manager, and similar systems reduce the risk of losing access when a single device disappears. At the same time, they shift part of your trust to account recovery in those ecosystems. That is still often a good trade, but it is a trade.

## When Passkeys Fit Well

Passkeys tend to fit best when account compromise has a meaningful cost and most users log in from personal devices. Banking, email, healthcare, internal tools, and subscription products with frequent return visits all benefit from phishing resistance and from not asking users to manage another password.

They also fit new applications more naturally than legacy ones. Starting with passkeys lets you design enrollment, recovery, and fallback paths around WebAuthn from the beginning. Retrofitting them into an existing password system is possible, but the transition period often leaves both systems active, which means the account is still exposed through the weaker path.

## When Passwords Still Solve Real Problems

Passwords still solve cases that passkeys handle awkwardly. Shared accounts are one example. A household sharing a streaming account can share a password more easily than a credential tied to individual devices and local user verification.

Public computers and kiosk style environments are another. Passkeys assume access to a personal authenticator or a nearby device, which is not always practical. Very broad user populations can also make rollout harder, especially when device support, ecosystem sync, and user expectations vary widely.

This does not mean passwords are the better security mechanism. It means they remain a simpler compatibility mechanism. In some products, that simplicity is still operationally useful enough to justify the weaker security posture.

## Recovery Defines the Real Security Posture

Recovery is where many passkey deployments become less clear cut. If users can recover an account through email alone, then the effective security of the account may be closer to the security of the email account than to the security of WebAuthn.

Several approaches exist, and each has costs. Allowing multiple registered passkeys improves resilience, but requires users to enroll them before a loss event. Recovery codes give users an offline escape hatch, but they reintroduce a bearer secret that must be stored safely. Email or SMS fallback is convenient, but usually weaker than the primary authentication method.

The right choice depends on the threat model. Consumer products may accept a weaker but understandable recovery path. Administrative systems or high value accounts may prefer stricter recovery with more support involvement because the cost of account takeover is higher.

## Platform Support Shapes Adoption

Browser and platform support for WebAuthn is broad across Chrome, Firefox, Safari, and Edge, and platform authenticators are available on macOS, Windows, iOS, and Android. That support makes passkeys viable for mainstream applications, but viable does not mean universal. Some users will still be on devices without suitable authenticators, or in contexts where the experience is confusing.

That is why feature detection still matters.

```ts
let available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
```

This check does not tell you whether passkeys are the right product choice. It only tells you whether the current device can support an important part of the experience. Product design still needs to account for fallback, enrollment, and mixed device populations.

## Conclusion

Passkeys improve web authentication by removing the shared secret at the center of password systems and by binding authentication to the real origin. Those gains are meaningful, especially for high value accounts on personal devices. Their limits show up in recovery, rollout, and compatibility, so the real question is not whether passkeys are better in theory, but whether their trade-offs fit the system you are designing.
