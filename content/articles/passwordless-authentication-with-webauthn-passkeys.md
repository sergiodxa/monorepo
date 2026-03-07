---
title: Understanding Passkeys and WebAuthn Security
excerpt: Explore how passkeys use public key cryptography to eliminate phishing attacks.
---

Passwords have dominated web authentication for decades, but they carry fundamental security flaws that no amount of hashing, salting, or complexity requirements can fix. Users reuse them across sites, attackers steal them through phishing, and databases of hashed passwords become targets for brute force attacks. WebAuthn, the standard behind passkeys, takes a fundamentally different approach: it replaces shared secrets with public key cryptography.

## The Core Problem with Passwords

Password authentication relies on a shared secret. Both you and the server know the password (or a hash of it). This creates several attack vectors:

- **Phishing**: Users can be tricked into entering passwords on fake sites
- **Database breaches**: Stolen password hashes can be cracked offline
- **Credential stuffing**: Reused passwords from one breach unlock accounts elsewhere
- **Interception**: Man in the middle attacks can capture passwords in transit

Every mitigation adds friction. Two factor authentication requires extra steps. Password managers help with complexity but add a dependency. Rate limiting slows down legitimate users alongside attackers. The fundamental architecture remains vulnerable.

## How Passkeys Work

Passkeys flip the authentication model. Instead of proving you know a secret, you prove you possess a private key. The difference is crucial: the private key never leaves your device.

When you register a passkey, your device generates a key pair. The public key goes to the server. The private key stays in secure hardware (the Secure Enclave on Apple devices, the TPM on Windows, or the Titan chip on Android). During authentication, the server sends a challenge, your device signs it with the private key, and the server verifies the signature using the stored public key.

```json
{
	"type": "public-key",
	"id": "abc123...",
	"publicKey": "MFkwEwYH...",
	"counter": 42,
	"transports": ["internal", "hybrid"]
}
```

This is what your server stores for each credential: an identifier, the public key, a counter for replay protection, and metadata about how the authenticator can be reached. No secrets, no hashes. If attackers steal this data, they cannot authenticate because they lack the private keys.

## The Security Model

WebAuthn's security comes from three properties working together.

### Origin Binding

The credential is cryptographically bound to your domain. When the authenticator signs a challenge, it includes the origin in the signed data. A passkey created for `example.com` will not work on `examp1e.com` or any other domain, even if the user is tricked into visiting a phishing site. The authenticator simply refuses to sign because the origin does not match.

This is phishing resistance at the protocol level. Users do not need to recognize fake domains because the cryptography enforces the correct one.

### No Shared Secrets

With passwords, both parties know the secret. An attacker who compromises the server gets password hashes they can crack. With passkeys, the server only holds public keys. Even complete database access gives attackers nothing useful for authentication.

This also eliminates credential reuse attacks. Each passkey is unique to a single site. A breach at one service has zero impact on your accounts elsewhere because there is no password to reuse.

### Local User Verification

Before signing anything, the authenticator verifies the user through biometrics (Touch ID, Face ID, fingerprint) or a local PIN. This happens on the device, not over the network. You get the security benefits of two factor authentication, something you have (the device) plus something you are (biometric), without the friction of SMS codes or authenticator apps.

## The Trade-offs

Passkeys are not universally better than passwords. Understanding the trade-offs helps you decide when they make sense.

### Advantages

**Stronger security**: Eliminates phishing, credential stuffing, and the value of database breaches. The attack surface shrinks dramatically.

**Better user experience**: Biometric authentication is faster than typing passwords. No password managers to configure, no codes to type, no secrets to remember.

**Reduced operational burden**: No password reset flows to maintain. No password breach notifications to send. No password strength policies to enforce.

### Limitations

**Device dependency**: Users need access to their registered device. Losing all devices means losing account access unless you have recovery mechanisms in place.

**Account recovery complexity**: What happens when someone loses their phone? You need fallback authentication methods, which may reintroduce some password-like vulnerabilities.

**Adoption friction**: Users unfamiliar with passkeys need education. The mental model ("prove I have this device") differs from passwords ("prove I know this secret").

**Cross-platform gaps**: While syncing works well within ecosystems (iCloud Keychain, Google Password Manager), moving between Apple and Android remains awkward.

## When Passkeys Make Sense

Passkeys work best when the security benefits outweigh the adoption complexity.

**High-value accounts**: Banking, email, healthcare portals, and anything where account takeover causes significant harm. The phishing resistance alone justifies the transition.

**Repeat users on personal devices**: Internal tools, subscription services, and apps users access regularly from the same devices. The UX improvement compounds over time.

**New applications**: Starting fresh lets you build passkeys as the primary authentication method rather than retrofitting them onto a password system.

**Enterprises with managed devices**: When IT controls the devices, recovery and device loss scenarios are more predictable.

## When Passwords Still Win

**Shared accounts**: A family sharing a Netflix password cannot share a passkey because it is bound to individual devices and biometrics.

**Public or shared computers**: Passkeys rely on personal devices. Kiosk scenarios or computer labs need a different approach.

**Diverse user populations**: If your users span technical sophistication levels and device ecosystems, the transition costs may exceed the security gains.

**Critical recovery requirements**: Systems where account lockout is unacceptable (medical records, financial accounts) need robust fallback methods that may undermine passkey security.

## Browser and Platform Support

WebAuthn has broad support across modern browsers: Chrome, Firefox, Safari, and Edge all implement the standard. Platform authenticators work on macOS (Touch ID), Windows (Windows Hello), iOS, and Android.

The concept of "passkeys" specifically refers to syncing credentials. Apple introduced passkey syncing with iOS 16 and macOS Ventura through iCloud Keychain. Google added passkey sync to Chrome and Android. Microsoft supports passkeys through Windows Hello. These sync mechanisms solve the device loss problem that plagued earlier WebAuthn implementations: register a passkey on your phone, use it immediately on your laptop.

```ts
let available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
```

This check tells you whether the current device supports passkeys. Not all users will have it, so plan for graceful degradation.

## Designing for Recovery

Account recovery is where passkey implementations often stumble. Consider these strategies:

**Multiple passkeys**: Let users register passkeys on multiple devices. If one is lost, others still work.

**Recovery codes**: Generate one-time codes during registration that users store safely. This reintroduces some password-like risks but provides a safety net.

**Trusted contacts**: Allow pre-designated contacts to vouch for identity recovery. Social recovery adds complexity but avoids shared secrets.

**Fallback to email or SMS**: Less secure than passkeys but still more secure than having no recovery path. The risk calculus depends on your threat model.

## The Transition Period

Most applications will support both passkeys and passwords during a transition period. This creates a security paradox: your account is only as secure as the weakest authentication method. An attacker can bypass passkeys by triggering password reset if you still support passwords.

The cleanest approach is offering passkeys as optional initially, promoting them to users with compatible devices, then eventually requiring them for high-security accounts. Monitor adoption rates and support requests to gauge when users are ready for each phase.

## Conclusion

Passkeys represent a genuine architectural improvement over passwords. By replacing shared secrets with public key cryptography, they eliminate entire categories of attacks. The user experience improves too: biometric authentication beats password typing.

But they are not a drop-in replacement. Device dependency, recovery complexity, and cross-platform limitations require careful design. The security gains are substantial for high-value accounts accessed from personal devices. For shared access scenarios or diverse user populations, passwords may remain the pragmatic choice.

As platform support matures and user familiarity grows, passkeys will likely become the default for sensitive accounts. Understanding the technology now prepares you to make informed decisions about when and how to adopt it.
