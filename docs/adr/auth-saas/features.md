# Auth platform feature comparison — Auth0, Okta, Clerk, Better Auth

Researched September 2026. An exhaustive, feature-by-feature comparison of four identity
platforms, normalized so the same capability appears once under a standards-neutral name with
each vendor's own term recorded beside it.

## The four products are not the same shape

Comparing them row by row is useful, but a column full of ❌ usually means a product solves a
different problem rather than solving this one badly.

- **Auth0** — hosted customer identity (CIAM), developer-oriented, priced per monthly active
  user. Now sold as Okta Customer Identity Cloud.
- **Okta** — hosted workforce identity first, customer identity second. Priced per user per
  month per product SKU, with an annual contract minimum. Its centre of gravity is employee
  access, governance and provisioning, not application sign-up flows.
- **Clerk** — hosted customer identity with prebuilt UI components, aimed at product teams
  shipping a SaaS application. Priced per monthly *requesting* user.
- **Better Auth** — an open-source TypeScript library, MIT licensed, that runs inside your
  application and stores identity data in your own database. No per-user cost. Acquired by
  Vercel in July 2026; a paid hosted layer (`@better-auth/infra`) exists alongside it.

Auth0 and Okta are one company but two distinct products with separate docs, pricing and
feature sets, so they hold separate columns throughout. A capability in Okta Workforce Identity
does not imply the same capability in Auth0, and vice versa.

## How to read the matrix

Each row is one distinct capability. The **Feature** cell carries the canonical name, and an
*aka* line recording what each vendor calls it when that differs — so a capability can be found
under any vendor's vocabulary.

| Symbol | Meaning |
| --- | --- |
| ✅ | Supported natively and generally available |
| 🟡 | Partial, or gated behind a paid add-on, a separate SKU, a higher plan, a plugin, or meaningful custom code |
| ❌ | Not supported |
| ➖ | Not applicable to this product's model — for example, vendor-side log retention for a self-hosted library |
| ❔ | Could not be verified from public documentation |

Every non-❌ cell carries a short qualifier naming the plan, SKU, add-on or plugin required.
Read those qualifiers closely: a feature present on all four columns can still differ by an
order of magnitude in price, and several capabilities that look free are add-on-gated.

## Method and limits

Each vendor's product documentation and API reference was walked systematically — not just
landing pages — yielding roughly 3,100 raw capability records, which were then normalized into
the matrix below. Cells where a vendor's absence would be commercially significant were
re-verified against live documentation; cells that could not be resolved are marked ❔ rather
than guessed.

Two limits worth stating plainly. This is a point-in-time snapshot: plan gating in particular
changes often, and one add-on in this comparison was restructured seven months before research.
And absence of a documented feature is weaker evidence than presence — a ❌ means public
documentation describes no such capability, which is not the same as the vendor confirming one
does not exist.

The matrix below holds **1343 capability rows** across 20 sections, followed by a pricing section with worked cost scenarios.

## Contents

- [01. Identifiers, passwords & account recovery](#01-identifiers-passwords-account-recovery)
- [02. Passwordless authentication & passkeys](#02-passwordless-authentication-passkeys)
- [03. Social & consumer identity providers](#03-social-consumer-identity-providers)
- [04. Enterprise federation & SSO](#04-enterprise-federation-sso)
- [05. Multi-factor authentication & step-up](#05-multi-factor-authentication-step-up)
- [06. OAuth 2.0 / OpenID Connect protocol surface](#06-oauth-20-openid-connect-protocol-surface)
- [07. Tokens, claims & session management](#07-tokens-claims-session-management)
- [08. Login UX, hosted pages & UI components](#08-login-ux-hosted-pages-ui-components)
- [09. User management & directory](#09-user-management-directory)
- [10. Organizations, teams & B2B multi-tenancy](#10-organizations-teams-b2b-multi-tenancy)
- [11. Authorization — roles, permissions & policy](#11-authorization-roles-permissions-policy)
- [12. Identity governance, provisioning & lifecycle automation](#12-identity-governance-provisioning-lifecycle-automation)
- [13. Extensibility — custom logic, hooks & integrations](#13-extensibility-custom-logic-hooks-integrations)
- [14. Security & threat protection](#14-security-threat-protection)
- [15. Machine-to-machine, API keys & AI-agent identity](#15-machine-to-machine-api-keys-ai-agent-identity)
- [16. Billing & monetization of your own users](#16-billing-monetization-of-your-own-users)
- [17. Data layer, deployment & environments](#17-data-layer-deployment-environments)
- [18. Observability — logs, audit trail & analytics](#18-observability-logs-audit-trail-analytics)
- [19. Compliance, privacy & certifications](#19-compliance-privacy-certifications)
- [20. Developer experience — SDKs, tooling & testing](#20-developer-experience-sdks-tooling-testing)
- [21. Pricing & packaging](#21-pricing-packaging)

---

## 01. Identifiers, passwords & account recovery

How each product identifies a user (email, username, phone), stores and governs passwords, verifies the identifier, and lets a locked-out user back in. The four diverge most on password policy depth (Okta ships a full workforce-style policy with history, expiry and minimum age; Clerk deliberately follows NIST and omits them), on who owns the hash (Better Auth hands you the hash and verify functions; the hosted products do not), and on admission control at sign-up (Clerk ships allowlists, blocklists, disposable-domain and subaddress blocking as settings, while Auth0 and Okta expect a custom Action or inline hook).

### 1.1 Login identifiers

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Email address as login identifier**<br>*aka: Database Connection identifier (Auth0), login / multiple identifiers (Okta), Email (Clerk), `emailAndPassword` (BA)* | The account is identified and authenticated by an email address. | ✅ (Free+) | ✅ (all tiers) | ✅ (Free) | ✅ (Core) |
| **Username as login identifier**<br>*aka: Requires Username (Auth0), login (Okta), Username (Clerk), username plugin (BA)* | A non-email handle chosen by the user serves as the unique login identifier. | ✅ (per-connection toggle) | ✅ (native `login` attribute) | ✅ (Free) | 🟡 (plugin: username) |
| **Phone number as login identifier**<br>*aka: Flexible Identifiers (Auth0), Multiple identifiers (Okta), Phone (Clerk), phoneNumber plugin (BA)* | A verified phone number acts as the unique handle the user signs in with. | ✅ (Universal Login + phone provider) | 🟡 (Multiple identifiers, Identity Engine) | ✅ (Pro; free in development) | 🟡 (plugin: phoneNumber) |
| **Configurable identifier set per environment**<br>*aka: Flexible Identifiers and Attributes (Auth0), Multiple identifiers (Okta), User & authentication settings (Clerk)* | Administrators choose which attributes are unique login handles versus merely stored profile data, and may combine several. | ✅ (GA, per connection) | 🟡 (Identity Engine only) | ✅ (Free, per instance) | 🟡 (core + username/phone plugins) |
| **Non-unique email addresses**<br>*aka: Non-Unique Emails (Auth0)* | Several accounts in one user store may share an email address because username or phone is the primary identifier. | ✅ (GA; irreversible per connection) | 🟡 (login is the only unique attribute; behavior varies) | ❌ | ❌ (email column is unique) |
| **Username format and length constraints**<br>*aka: allowed character set (Auth0), Username settings (Clerk), `minUsernameLength`/`usernameValidator` (BA)* | Enforced bounds and character set for usernames, including protection against homograph/spoofing characters. | ✅ (1–128 chars, restricted charset) | ❔ (unverified) | ✅ (4–64 default, Latin-only, charset customizable) | ✅ (plugin: username, 3–30 + validators) |
| **Separate display username**<br>*aka: `displayUsername` (BA)* | Stores the user's original capitalization alongside a normalized lookup value, so display and matching differ. | ❌ | ❌ | ❌ | ✅ (plugin: username) |
| **Case-insensitive username normalization**<br>*aka: `usernameNormalization` (BA)* | Different casings of a username resolve to one account, with a pluggable normalizer and control over validation order. | ❔ (unverified) | ❔ (unverified) | ❔ (unverified) | ✅ (plugin: username) |
| **Username availability check endpoint**<br>*aka: `isUsernameAvailable()` (BA)* | A dedicated endpoint reporting whether a candidate username is free before submission. | ❌ | ❌ | ❌ | ✅ (plugin: username; disableable) |
| **Restrict identifier changes after sign-up**<br>*aka: Restrict changes / User permissions (Clerk), `immutableUsername` (BA)* | Prevents users from adding, removing or editing their own email, phone or username once the account exists, while admins retain control. | 🟡 (Actions / profile rules) | 🟡 (Universal Directory attribute permissions) | ✅ (Free, per identifier) | ✅ (Core toggles + plugin: username) |
| **Multiple email addresses per account**<br>*aka: MyAccount Email endpoints (Okta), Email addresses (Clerk)* | One account holds several verified email addresses with one marked primary. | ❌ (single `email`) | ✅ (MyAccount email endpoints) | ✅ (Free) | ❌ (single `email`) |

### 1.2 Sign-up mode and admission control

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Self-service sign-up**<br>*aka: Signup on database connection (Auth0), Self-Service Registration / profile enrollment policy (Okta), Open access mode (Clerk), `signUp.email()` (BA)* | Unauthenticated visitors can create their own account through a sign-up form. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Free, default mode) | ✅ (Core) |
| **Disable self-service sign-up**<br>*aka: Disable Sign Ups (Auth0), Invite-only / `restricted` (Clerk), `disableSignUp` (BA)* | Sign-in stays open while new self-service registrations are refused; accounts must be created by an administrator. | ✅ (per connection) | ✅ (registration off by default) | ✅ (Free) | ✅ (Core) |
| **Invitation-based sign-up**<br>*aka: Invitations (Clerk), activation email (Okta)* | An admin-created invitation emails a unique link that provisions the account and auto-verifies the invited address. | 🟡 (org invitations or password-change ticket) | 🟡 (admin-created user + activation email) | ✅ (Free; single and bulk, metadata, redirect URL) | 🟡 (plugin: organization, or custom) |
| **Waitlist sign-up mode**<br>*aka: Waitlist / `waitlist` (Clerk)* | Visitors join a queue instead of registering; an admin approves entries and the approved user receives an invitation to complete sign-up. Includes a management view and two dedicated email templates. | ❌ | ❌ | ✅ (Free; template editing needs Pro) | ❌ |
| **Identifier allowlist at sign-up**<br>*aka: Allowlist (Clerk), pre-user-registration Action (Auth0), registration inline hook (Okta)* | Only listed email addresses, email domains or phone numbers may register. | 🟡 (custom Action) | 🟡 (registration inline hook) | ✅ (Pro; free in development) | 🟡 (`validateUserInfo` hook) |
| **Identifier blocklist at sign-up**<br>*aka: Blocklist (Clerk)* | Listed addresses, domains or numbers are refused; Clerk supports wildcard patterns for a whole local part or subdomain label. | 🟡 (custom Action) | 🟡 (registration inline hook) | ✅ (Pro; allowlist wins on conflict) | 🟡 (`validateUserInfo` hook) |
| **Disposable email domain blocking**<br>*aka: Block sign-ups that use disposable email addresses (Clerk)* | Rejects registrations from throwaway inbox providers using a maintained domain list. | 🟡 (custom Action; documented recipe) | 🟡 (registration inline hook) | ✅ (Free) | 🟡 (`validateUserInfo` hook + own list) |
| **Email subaddress blocking**<br>*aka: Block email subaddresses (Clerk)* | Blocks `+`/`=`/`#` subaddresses (and Yahoo hyphens) of an address that already has an account, and ignores dots for Gmail, to stop mass account creation from one inbox. | ❌ | ❌ | ✅ (Free) | ❌ |
| **Blocking pre-registration extensibility hook**<br>*aka: pre-user-registration Action (Auth0), Registration inline hook (Okta), `user.validateUserInfo` (BA)* | Custom code runs before the account is created and can allow, modify or deny the registration. | ✅ (Actions trigger) | ✅ (inline hook) | ❌ (webhooks fire after creation) | ✅ (Core) |

### 1.3 Password storage, import and migration

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Password hashing at rest** | Passwords are stored only as salted one-way hashes. Auth0 and Clerk use bcrypt, Better Auth defaults to scrypt; Okta's storage algorithm is not customer-selectable. | ✅ (bcrypt) | ✅ (algorithm fixed) | ✅ (bcrypt) | ✅ (scrypt default) |
| **Custom hash and verify functions**<br>*aka: `emailAndPassword.password.hash` / `.verify` (BA)* | The application replaces the built-in hasher with its own implementation, e.g. to keep a legacy format working. | ❌ | ❌ | ❌ | ✅ (Core) |
| **Password hash import at account creation**<br>*aka: `password_hash`/`custom_password_hash` (Auth0), Create user with imported hashed password (Okta), `password_digest` + `password_hasher` (Clerk)* | Existing hashes are loaded directly so migrated users keep their passwords. Auth0 takes bcrypt `$2a$`/`$2b$` or a custom hash object; Okta accepts BCRYPT, SHA-512, SHA-256, SHA-1, MD5 and PBKDF2; Clerk accepts 17 hashers and rehashes to bcrypt on first use. | ✅ (all plans) | ✅ (Users API) | ✅ (Backend API) | 🟡 (direct DB insert + custom verify) |
| **Bulk user import job**<br>*aka: Bulk User Imports job (Auth0), Clerk user migration tool (Clerk)* | A batch job or maintained tool loads many user records, including credentials, in one operation. | ✅ (Management API job; 500 KB ≈ 1,000 users per job) | 🟡 (per-user Users API; scripted) | ✅ (JSON/CSV tool, rate-limit aware) | 🟡 (per-provider migration guides/scripts) |
| **Lazy / trickle password migration**<br>*aka: Automatic Migration (Auth0), Password import inline hook (Okta), Trickle Migration (Clerk)* | Users are moved from a legacy store one successful login at a time, with no mass password reset. | ✅ (custom DB connection; Professional+) | ✅ (inline hook on first sign-in) | ✅ (rehashes weak hashes to bcrypt) | 🟡 (custom verify fallback) |
| **External store as the credential authority**<br>*aka: Custom Database Connection (Auth0), delegated authentication to AD/LDAP (Okta)* | Authentication is delegated to a customer-owned database or directory that remains the system of record for passwords. | 🟡 (Professional and Enterprise) | 🟡 (AD/LDAP agent) | ❌ | 🟡 (custom verify or plugin) |
| **Scripted connectors to an external store**<br>*aka: Database Action Scripts (Auth0)* | Named script slots (Login, Get User, Create, Verify, Change Password, Change Email, Delete) define how the product talks to the external store; Auth0 also ships templates for MongoDB, MySQL, PostgreSQL, SQL Server, Azure SQL, ASP.NET Membership and Basic-Auth web services. | ✅ (with custom DB connection) | 🟡 (password-import and user-import hooks only) | ❌ | ➖ (the application owns the database) |
| **Password hash export** | Getting the stored hashes back out, for migrating off the product. | 🟡 (support case, PGP-encrypted; paid plans) | ❌ | ❔ (unverified) | ✅ (direct database access) |

### 1.4 Password policy

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Minimum password length**<br>*aka: Flexible Password Policy (Auth0), Minimum length (Okta), Password rules (Clerk), `minPasswordLength` (BA)* | A configurable floor on password length. Clerk's NIST-based default is 8 and raising it requires the paid policy editor; Better Auth defaults to 8. | ✅ (Flexible Password Policy, GA) | ✅ (Starter; from 4 characters) | 🟡 (Pro to change the default) | ✅ (Core) |
| **Maximum length and truncation behavior**<br>*aka: 72-byte truncate-or-error (Auth0), `maxPasswordLength` (BA)* | How over-long passwords are handled. Auth0 exposes truncate-vs-error past bcrypt's 72-byte input limit (the legacy policy truncated silently); Clerk accepts at least 64 characters with no truncation. | ✅ (configurable at 72 bytes) | ✅ (fixed cap) | ✅ (no truncation, ≥64 accepted) | ✅ (default 128) |
| **Character-class complexity requirements**<br>*aka: Password Strength / Flexible Password Policy (Auth0), Password complexity requirements (Okta), Update password requirements (Clerk)* | Requires lower case, upper case, digits or symbols, individually or as "N of 4". | ✅ (GA) | ✅ (Starter) | 🟡 (Pro) | ❌ |
| **Preset password strength tiers**<br>*aka: Password Strength / `passwordPolicy` (Auth0)* | Five named complexity presets (None, Low, Fair, Good, Excellent) instead of individual rules. Legacy — superseded by Auth0's Flexible Password Policy. | 🟡 (legacy, superseded) | ❌ | ❌ | ❌ |
| **Sequential and repeated character rules**<br>*aka: Flexible Password Policy (Auth0), consecutive repeating characters (Okta)* | Rejects three-or-more sequential characters and runs of identical characters. | ✅ (both rules) | ✅ (repeat limit) | ❌ | ❌ |
| **Common-password dictionary blocklist**<br>*aka: Password Dictionary (Auth0), Common password check (Okta)* | Rejects passwords appearing in a bundled list of common passwords. Auth0 offers 10,000 or 100,000 entries plus tenant-supplied additions, compared case-insensitively; Okta ships one million. | ✅ (database connections) | ✅ (Starter) | ❌ (covered by the breach corpus check) | ❌ |
| **Block profile data inside passwords**<br>*aka: Block Personal Data (Auth0), must not contain part of username/first name/last name (Okta)* | Rejects a password containing the user's own name, username or email local part. | ✅ (up to 12 selectable fields) | ✅ (Starter; fixed fields) | ❌ | ❌ |
| **Custom expression-based password rule**<br>*aka: OEL statement to block restricted content (Okta)* | An administrator-authored predicate evaluated against a proposed password to reject organization-specific strings. | ❌ (fixed rule set) | ✅ (Starter) | ❌ | 🟡 (validate in a before hook) |
| **Password strength estimation**<br>*aka: Password strength (Clerk)* | Scores entropy with a zxcvbn-style estimator and surfaces improvement suggestions beyond pass/fail policy. | ❌ | ❌ | ✅ (Free, zxcvbn-ts) | ❌ |
| **Password history / reuse prevention**<br>*aka: Password History (Auth0), Enforce password history for last N passwords (Okta)* | Rejects a new password matching one of the user's N most recent passwords. | 🟡 (Professional+; up to 24 retained) | ✅ (Starter; up to 30) | ❌ | ❌ |
| **Password expiry (maximum age)**<br>*aka: Password expires after N days (Okta), Password Rotation integration (Auth0)* | Forces a reset once a password reaches a set age. Auth0 only through a Marketplace Action, not a connection setting. | 🟡 (Marketplace Action) | ✅ (Starter; up to 999 days) | ❌ | ❌ |
| **Password expiry warning**<br>*aka: Prompt user N days before password expires (Okta)* | Notifies the user ahead of a forced rotation. | ❌ | ✅ (Starter; up to 999 days) | ❌ | ❌ |
| **Minimum password age**<br>*aka: Minimum password age (Okta)* | Blocks a second password change until a waiting period elapses, so users cannot cycle back to an old password. | ❌ | ✅ (Starter; up to 9,999 minutes) | ❌ | ❌ |
| **Turn password authentication on or off**<br>*aka: `authentication_methods.password.*` (Auth0), Password authenticator (Okta), Password strategy (Clerk), `emailAndPassword.enabled` (BA)* | Passwords can be disabled as an authentication method, independently of whether they may be set at sign-up. Clerk's switch affects new users only; existing users keep their passwords. | ✅ (per connection) | ✅ (authenticator + policy) | ✅ (Free) | ✅ (Core; off by default) |
| **Set a password on an account that has none**<br>*aka: `auth.api.setPassword()` (BA), MyAccount create password (Okta)* | Attaches a credential to a user who registered through a social provider or a passwordless factor. | ✅ (Management API) | ✅ (MyAccount / Users API) | ✅ (Backend API and user profile) | ✅ (Core; server-only, not client-callable) |
| **Server-side password verification for step-up**<br>*aka: `auth.api.verifyPassword()` (BA), Verify password (Clerk)* | Re-checks the stored password before a sensitive action without creating a session. | 🟡 (password grant against the token endpoint) | ✅ (User Credentials API) | ✅ (Backend API) | ✅ (Core; server-only) |

### 1.5 Compromised-credential handling

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Reject breached passwords when one is set**<br>*aka: Breached Password Detection (Auth0), Breached credentials protection (Okta), Reject compromised passwords (Clerk), haveIBeenPwned plugin (BA)* | A password chosen at sign-up or password change is checked against breach corpora and refused if it appears there. Clerk and Better Auth use Have I Been Pwned; Better Auth's check is k-anonymous, sending only the first five SHA-1 characters. | 🟡 (B2B/B2C Professional and Enterprise) | ✅ (standard for all customers) | ✅ (Free) | 🟡 (plugin: haveIBeenPwned) |
| **Detect breached credentials at sign-in** | A correct password that appears in breach data is acted on at login: blocked, the account locked, or the password expired and a reset forced. | 🟡 (Professional+; blocks login and can lock the account) | ✅ (expires the password; not supported for LDAP-sourced auth) | ✅ (Free; forces a password reset) | ❌ |
| **Reject breached passwords at reset** | The reset flow refuses a new password that is itself known-breached, so a compromised credential cannot be re-selected. | 🟡 (Professional+; `reset_pwd_leak` log event) | ✅ (checked at password reset) | ✅ (Free) | 🟡 (plugin: haveIBeenPwned) |
| **Standalone breach-check helper**<br>*aka: `isPasswordCompromised()` (BA)* | The breach check is callable as a plain function from custom password flows that bypass the product's own endpoints. | ❌ | ❌ | ❌ | ✅ (plugin: haveIBeenPwned) |
| **Accelerated / dark-web breach intelligence**<br>*aka: Credential Guard (Auth0), Identity Threat Protection (Okta)* | Breach data sourced from dark-web collection rather than public dumps, cutting detection latency from months to hours. | 🟡 (Attack Protection add-on, Enterprise) | 🟡 (Identity Threat Protection SKU) | ❌ | ❌ |
| **Notification when compromised credentials are detected**<br>*aka: Password Breach Alert email (Auth0)* | The affected user and/or administrators are told that breached credentials were used. | ✅ (user + admin emails; immediate/daily/weekly/monthly) | 🟡 (`security.breached_credential.detected` System Log event) | 🟡 (user is shown a forced reset, no dedicated alert email) | ❌ (build from the error code) |
| **Administratively force a password reset**<br>*aka: Set password as compromised / Force password reset (Clerk), Expire password (Okta)* | An admin marks a user's password unusable so sign-in is blocked until a new one is set. | 🟡 (password-change ticket; no expire flag) | ✅ (Users API expire password) | ✅ (Free; surfaces as the `reset-password` session task) | 🟡 (clear the credential, custom flow) |

### 1.6 Identifier verification

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Email address verification**<br>*aka: Verify Emails / `email_verified` (Auth0), MyAccount Email endpoints (Okta), Email verification code/link (Clerk), `emailVerification` (BA)* | Confirms the user controls the email address and records a verified flag on the profile. | ✅ (all plans) | ✅ (activation and MyAccount flows) | ✅ (Free) | ✅ (Core) |
| **Verification by one-time code as well as link** | The verification challenge can be a numeric code the user types, not only a clickable link. | ❌ (link only) | ✅ (email OTP or magic link) | ✅ (Free; both, 10-minute validity) | 🟡 (link in core; code via plugin: emailOTP) |
| **Require a verified email before access**<br>*aka: Verify at sign-up (Clerk), `requireEmailVerification` (BA)* | Sign-in or account creation is blocked until the address is confirmed. | 🟡 (Marketplace Action blocks sign-in) | ✅ (activation required) | ✅ (Free; instance setting) | ✅ (Core; unverified sign-in returns 403) |
| **Verification token lifetime configurable**<br>*aka: `ttl_sec` on the verification ticket (Auth0), `emailVerification.expiresIn` (BA)* | The validity window of the verification token can be changed. | 🟡 (ticket API only) | 🟡 (email authenticator settings) | ❌ (fixed 10 minutes) | ✅ (Core; default 3600s) |
| **Resend throttling / cooldown** | Repeat verification sends are rate limited to curb abuse and mail-provider damage. | ✅ (platform throttling) | ✅ (built in) | ✅ (30-second cooldown in prebuilt components) | 🟡 (configure the core rate limiter) |
| **Verification URL generated for out-of-band delivery**<br>*aka: `POST /api/v2/tickets/email-verification` (Auth0), `{ user, url, token }` sender (BA)* | The product hands the application a one-time verification URL or token so the app can send it over its own channel. | ✅ (tickets API) | ✅ (activation link from the Users API) | ❌ (Clerk sends the message) | ✅ (Core; the app always sends) |
| **Automatic sign-in after verification**<br>*aka: `autoSignInAfterVerification` (BA)* | Completing verification issues a session instead of returning the user to a login screen. | ❌ | ✅ (activation completes into a session) | ✅ (verification completes the sign-up) | ✅ (Core; opt-in) |
| **Same-device enforcement for verification links**<br>*aka: Require the same device and browser (Clerk)* | A verification or magic link only works in the browser that started the flow, defeating link-following by mail scanners or third parties. | ❔ (unverified) | ❔ (unverified) | ✅ (Free) | ❌ |
| **Phone number verification**<br>*aka: Phone verification code (Clerk), Phone authenticator (Okta), phoneNumber plugin (BA)* | Confirms control of a phone number by SMS or voice one-time code. | ✅ (with phone identifier) | ✅ (MyAccount phone endpoints) | ✅ (Pro; free in development) | 🟡 (plugin: phoneNumber) |
| **Email change requiring verification of the new address**<br>*aka: `user.changeEmail` (BA), MyAccount Email endpoints (Okta)* | Changing the login email only takes effect once the new address is proven. | 🟡 (Management API + custom flow) | ✅ (MyAccount) | ✅ (add, verify, then set primary) | ✅ (Core; opt-in) |
| **Approval from the current address before an email change**<br>*aka: `sendChangeEmailConfirmation` (BA)* | A confirmation link goes to the existing address first, so an attacker with a live session cannot silently move the account. | ❌ | ❌ | ❌ | ✅ (Core) |

### 1.7 Password reset, change and account recovery

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Self-service password reset by emailed link**<br>*aka: Change Password ticket flow / `POST /dbconnections/change_password` (Auth0), `requestPasswordReset()` (BA)* | A "forgot password" link emails a one-time URL that opens a reset form. | ✅ (Free+) | ✅ (email magic link option) | ❌ (code-based instead) | ✅ (Core) |
| **Password reset by one-time code**<br>*aka: Forgot password (Clerk), Password recovery options (Okta)* | The user proves control with a numeric code before setting a new password, with no link to click. | ❌ | ✅ (email OTP, SMS, voice) | ✅ (Free; email or SMS OTP) | 🟡 (plugin: emailOTP or phoneNumber) |
| **Reset token lifetime configurable**<br>*aka: `resetPasswordTokenExpiresIn` (BA)* | The validity window of the reset token or link can be changed. | 🟡 (ticket API `ttl_sec`) | 🟡 (recovery token settings) | ❌ (fixed 10 minutes) | ✅ (Core; default 3600s) |
| **Change password with the current password**<br>*aka: `changePassword()` (BA), User Credentials change password (Okta)* | A signed-in user replaces their password by supplying the old one, without an email round trip. | 🟡 (no native endpoint; via reset ticket or Management API) | ✅ (Users API and MyAccount) | ✅ (Free) | ✅ (Core) |
| **Administrative password set**<br>*aka: Directly set the new password (Auth0)* | An administrator sets a user's password outright from the console or a management API. | ✅ (Free+) | ✅ (Users API) | ✅ (Backend API and Dashboard) | ✅ (`setPassword` or direct DB write) |
| **Revoke sessions on password reset or change**<br>*aka: `revokeSessionsOnPasswordReset` / `revokeOtherSessions` (BA), sign out of other sessions (Clerk)* | Other active sessions are invalidated when the password changes, so a stolen session does not survive the reset. | ✅ (reset expires the session) | ✅ (policy-driven) | ✅ (per-call flag) | ✅ (Core; off by default, separate flags for reset and change) |
| **Disable self-service password change**<br>*aka: `disable_self_service_change_password` (Auth0), `disabledPaths` (BA)* | Users are prevented from changing their own password, leaving it to administrators or an upstream store. | ✅ (Flexible Password Policy) | ✅ (password policy) | 🟡 (hide the UI in custom flows) | 🟡 (disable the route) |
| **Post-password-change extensibility**<br>*aka: `post-change-password` Actions trigger (Auth0), `onPasswordReset` (BA)* | Custom code runs after a successful password change or reset, for audit or downstream notification. | ✅ (Actions trigger) | 🟡 (event hooks) | 🟡 (webhooks) | ✅ (Core callback) |
| **Choice of which factors may recover an account**<br>*aka: Password recovery options (Okta)* | Administrators pick which authenticators are acceptable proof during recovery — push, phone, email code or link, TOTP, security question, or none. | ❌ (email link only) | ✅ (Starter) | 🟡 (email or SMS code only) | 🟡 (email; SMS via plugin) |
| **Knowledge-based recovery (security question)**<br>*aka: Security Question authenticator (Okta)* | A stored question-and-answer pair is accepted as recovery proof. | ❌ | ✅ (MFA base) | ❌ | ❌ |
| **Policy-gated recovery and account unlock**<br>*aka: Okta Account Management Policy (Okta)* | Recovery and unlock are governed by their own policy with the full sign-on condition vocabulary, and expressions can demand different proof for recovery than for unlock. | ❌ | ✅ (Adaptive MFA) | ❌ | ❌ |
| **Email enumeration protection on credential endpoints**<br>*aka: Strict user enumeration protection (Clerk), synthetic-user sign-up response (BA)* | Sign-up, reset and change-email responses are identical whether or not the identifier exists, including simulated hash timing, so the endpoints cannot be used to probe for accounts. | ✅ (generic responses on reset) | 🟡 (configurable per flow) | ✅ (Free; bulk and strict modes) | ✅ (Core; plus `customSyntheticUser` so plugin fields stay indistinguishable) |
| **Notify the real owner of a duplicate sign-up attempt**<br>*aka: `onExistingUserSignUp` (BA), strict enumeration notification (Clerk)* | When someone registers with an address that already has an account, the existing owner is told instead of the attacker learning the account exists. | ❌ | ❌ | ✅ (Free; notification instead of a code) | ✅ (Core callback) |

---

## 02. Passwordless authentication & passkeys

Covers authentication where no password is the primary credential: emailed links and codes, SMS/voice codes, passkeys and WebAuthn used as a first factor, Google One Tap, wallet signatures, guest sessions, and one-time sign-in tokens. The four products diverge most on configurability (Better Auth exposes code length, expiry, storage format and delivery transport as plugin options; the hosted products fix most of these), on passkey policy depth (Okta gates by authenticator model and method characteristics, Clerk exposes almost no WebAuthn knobs), and on non-email strategies (wallets, One Tap and guest sessions are absent or partner-supplied on Okta).

### Email-delivered passwordless sign-in

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Emailed sign-in link (magic link)**<br>*aka: Email Magic Link (Auth0), Email Magic Links / EML (Okta), Email link (Clerk), magicLink plugin (BA)* | A single-use tokenized URL is emailed to the user; opening it authenticates them and creates a session without a password. | 🟡 (Classic Login only) | ✅ (Identity Engine) | ✅ (Free) | ✅ (plugin: magicLink) |
| **Emailed one-time code**<br>*aka: Email OTP / Passwordless Email connection (Auth0), Okta Email authenticator (Okta), Email code (Clerk), emailOTP plugin (BA)* | A numeric code is emailed and exchanged for a session, so the sign-in can be completed in the browser that started it. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Free) | ✅ (plugin: emailOTP) |
| **Link and code offered in the same message** | One email carries both a clickable link and a transcribable code, letting the user choose; clicking the link submits the code on the user's behalf. | ❌ | ✅ (Identity Engine) | ❌ | ❌ |
| **Configurable one-time code length** | Admin or application control over how many digits/characters the emailed or texted code contains. Clerk and Okta emit a fixed six-digit code. | ✅ (Free+) | ❌ | ❌ | ✅ (plugin: emailOTP / phoneNumber) |
| **Configurable one-time code expiry** | Admin or application control over the validity window of a code. Auth0 defaults to 3 minutes, Okta to 5 minutes (settable in 5-minute steps up to 30), Better Auth to 300s; Clerk's is fixed. | ✅ (Free+) | ✅ (Identity Engine) | ❌ | ✅ (plugin: emailOTP / phoneNumber) |
| **Configurable sign-in link expiry** | Control over how long an emailed sign-in link stays valid. Okta's link shares the email code expiry; Clerk fixes email links at 10 minutes. | ❔ (unverified) | ✅ (Identity Engine) | ❌ | ✅ (plugin: magicLink) |
| **Single-use consumption and replay protection** | The link or code is invalidated the first time it is redeemed, so a captured or forwarded credential cannot be replayed. Auth0 additionally keeps only the most recent code valid. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Free) | ✅ (plugin: magicLink / emailOTP) |
| **Failed-attempt limiting on one-time codes** | The code is destroyed after a fixed number of wrong entries, forcing the user to request a new one. Auth0 and Better Auth default to 3 attempts; Clerk's lockout policy defaults to 10. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Free) | ✅ (plugin: emailOTP / phoneNumber) |
| **Custom one-time code generation** | The application supplies its own code generator instead of using the built-in one (for alphabetic codes, checksums, or a shared code service). | ❌ | ❌ | ❌ | ✅ (plugin: emailOTP) |
| **Resend strategy for pending codes**<br>*aka: resendStrategy rotate/reuse (BA)* | Choice between issuing a fresh code on every resend and re-sending the outstanding code with an extended lifetime, so a delayed email does not leave several valid codes. | ❌ | ❌ | ❌ | ✅ (plugin: emailOTP) |
| **At-rest storage format for codes and link tokens** | Whether the one-time credential is stored plain, hashed, or encrypted in the verification store, with a hook for a custom hasher or encryptor. | ➖ (managed, not exposed) | ➖ (managed, not exposed) | ➖ (managed, not exposed) | ✅ (plugin: emailOTP / magicLink) |
| **Application-controlled email delivery**<br>*aka: SMTP Email Providers (Auth0), sendMagicLink / sendVerificationOTP (BA)* | Passwordless emails are sent through a provider the customer configures (SES, SendGrid, Mailgun, Resend, custom SMTP) or a send function the application implements, rather than the vendor's own mailer. | ✅ (Free+) | ✅ (Identity Engine) | ❔ (unverified) | ✅ (plugin: magicLink / emailOTP) |
| **Headless link verification with a custom landing page** | The application hosts the page the link lands on and verifies the token itself, instead of the link resolving on a vendor-hosted page. | ❌ | ❔ (unverified) | ✅ (Free) | ✅ (plugin: magicLink) |
| **Restrict passwordless sign-in to existing accounts**<br>*aka: Disable Sign Ups (Auth0), Restricted sign-up mode (Clerk), disableSignUp (BA)* | Prevents the passwordless flow from silently creating an account for an unknown identifier; documented as increasing user-enumeration exposure unless paired with enumeration protection. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Free) | ✅ (plugin: magicLink / emailOTP) |
| **Just-in-time account creation on first passwordless use** | An unknown but verified identifier creates the user record as part of the sign-in, with no separate registration step. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Free) | ✅ (plugin: magicLink / emailOTP) |

### Phone-delivered passwordless sign-in

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **SMS one-time code as a primary factor**<br>*aka: SMS OTP / Passwordless SMS connection (Auth0), Phone authenticator (Okta), Phone code (Clerk), phoneNumber plugin (BA)* | A code texted to a registered phone number is the sole credential needed to establish a session. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Pro; free in dev) | ✅ (plugin: phoneNumber) |
| **Voice-call one-time passcode** | The same code delivered as a spoken phone call, for users without SMS or with accessibility needs. Auth0's phone provider carries voice, but its passwordless connection is SMS-based. | 🟡 (via phone provider) | ✅ (Identity Engine) | ❌ | ✅ (plugin: phoneNumber, custom sender) |
| **Delivery over other channels (WhatsApp, chat apps)** | Sending the code over a channel other than SMS or voice by routing it through application code. | 🟡 (custom phone provider Action) | 🟡 (telephony inline hook) | ❌ | ✅ (plugin: phoneNumber) |
| **Bring-your-own SMS/voice provider**<br>*aka: Custom Phone Provider / Custom SMS Gateway (Auth0), Telephony inline hook (Okta), sendOTP (BA)* | The customer's own telephony account or gateway delivers the message instead of the vendor's pooled sender. Auth0's Management-API-only SMS gateway is the legacy fallback to the Actions-based provider. | ✅ (Twilio or custom) | ✅ (Identity Engine) | ❌ | ✅ (plugin: phoneNumber, required) |
| **Account creation from a verified phone number alone** | A first-time phone verification creates the user record, synthesizing whatever identifier the user schema otherwise requires. | ✅ (Free+) | ❌ | ✅ (Pro) | ✅ (plugin: phoneNumber) |
| **Delegating code verification to the SMS provider** | The built-in code check is replaced by a call to an external verification service (for example Twilio Verify), so codes never touch the auth store. | ❌ | ❌ | ❌ | ✅ (plugin: phoneNumber, verifyOTP) |

### Passkeys and WebAuthn as a primary factor

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Passkey sign-in as the primary factor**<br>*aka: Passkeys (Auth0, Okta, Clerk), passkey plugin (BA)* | FIDO2/WebAuthn public-key credentials replace the password entirely: the user authenticates with a biometric, device PIN, or security key. | ✅ (New Universal Login) | ✅ (Adaptive MFA) | ✅ (Pro; free in dev) | ✅ (plugin: passkey) |
| **Self-service passkey enrollment for a signed-in user** | An authenticated user runs the WebAuthn registration ceremony and the resulting public key is stored on their account. | ✅ (My Account API) | ✅ (Identity Engine) | ✅ (Pro) | ✅ (plugin: passkey) |
| **Passkey registration before a session exists (sign-up with a passkey)** | A brand-new user can create their credential during registration rather than having to authenticate by another means first. Clerk only permits passkey creation after sign-up completes. | ✅ (New Universal Login) | ✅ (Identity Engine) | ❌ | ✅ (plugin: passkey) |
| **Conditional UI / browser autofill sign-in**<br>*aka: Passkeys Autofill / Enable autofill UI (Okta), autoFill option (BA)* | The browser offers stored passkeys inline in the identifier field's autofill dropdown, so no button press or username entry is needed. | ✅ (New Universal Login) | ✅ (Identity Engine) | ✅ (Pro) | ✅ (plugin: passkey) |
| **Configurable passkey login surface**<br>*aka: Passkey Authentication UI — Autofill / button / both (Auth0)* | Admin choice of whether passkeys are surfaced through autofill, an explicit "continue with a passkey" button, or both. Clerk and Better Auth decide this in application code. | ✅ (New Universal Login) | ✅ (Identity Engine) | 🟡 (code-level only) | 🟡 (code-level only) |
| **Usernameless sign-in with discoverable credentials** | The credential carries the user handle, so the challenge can start with no identifier typed at all. | ✅ (New Universal Login) | ✅ (Adaptive MFA) | ✅ (Pro) | ✅ (plugin: passkey) |
| **User-verification and resident-key requirements**<br>*aka: authenticatorSelection — residentKey / userVerification (BA)* | Configuring whether the authenticator must verify the user (biometric or PIN rather than mere presence) and whether the credential must be discoverable. | ❌ | ✅ (Adaptive MFA) | ❌ | ✅ (plugin: passkey) |
| **Platform vs roaming authenticator restriction** | Restricting enrollment or authentication to built-in platform authenticators or to cross-platform security keys. Auth0 splits these into distinct device-biometrics and security-key profiles rather than one setting. | 🟡 (separate biometrics profile) | ✅ (Adaptive MFA) | ❌ | ✅ (plugin: passkey, authenticatorAttachment) |
| **Authenticator model identification and restriction**<br>*aka: FIDO MDS / AAGUID allow list (Okta), aaguid + getAuthenticatorName (BA)* | Recording which authenticator model produced a credential, and refusing models that are not on an allow list (for FIPS or certified-key mandates). | ❌ | ✅ (Adaptive MFA) | ❌ | 🟡 (AAGUID exposed; filtering is custom code) |
| **Multiple passkeys per user** | A user may hold several credentials (phone, laptop, security key). Auth0 caps at 20 per user and Clerk at 10; Better Auth sets no limit. | ✅ (New Universal Login) | ✅ (Identity Engine) | ✅ (Pro) | ✅ (plugin: passkey) |
| **Listing, renaming and revoking passkeys** | End-user management of stored credentials: see what is enrolled, relabel it, and remove it. Clerk ships this inside its prebuilt profile component; Auth0 exposes list and revoke but no rename. | 🟡 (My Account API; no rename) | ✅ (Identity Engine) | ✅ (Pro) | ✅ (plugin: passkey) |
| **Relying-party ID configuration**<br>*aka: Relying Party ID / RP ID (Auth0), rpID / rpName / origin (BA)* | Setting the WebAuthn RP ID to a parent or root domain so one credential covers subdomains and native apps. Changing it invalidates existing passkeys; Clerk binds the RP ID to its own managed domain. | ✅ (New Universal Login) | 🟡 (via custom domain) | ❌ | ✅ (plugin: passkey) |
| **Passkeys usable across several root domains**<br>*aka: Passkeys and custom domains (Okta), Multiple Custom Domains (Auth0)* | Related-origin association that lets one credential authenticate on distinct root domains belonging to the same tenant. Clerk credentials never cross a root domain, including to satellite domains. | 🟡 (Multiple Custom Domains) | ✅ (Identity Engine) | ❌ | ❌ |
| **Distinguishing synced from device-bound credentials** | Telling a credential synced through a password manager apart from one bound to a single device, and being able to require the device-bound kind. All four accept both kinds; only Okta can enforce the distinction in policy. | ❌ | ✅ (Adaptive MFA, method characteristics) | ❌ | 🟡 (via WebAuthn extensions) |
| **Cross-device sign-in (hybrid transport / QR)** | Authenticating on one device using a passkey held on another by scanning a QR code over the platform's hybrid transport. | ✅ (New Universal Login) | ✅ (Identity Engine) | ✅ (Pro) | ✅ (plugin: passkey) |
| **Post-login passkey enrollment prompt**<br>*aka: Progressive Enrollment (Auth0)* | After a successful password sign-in, the user is invited to create a passkey; declining re-prompts later (every 30 days on Auth0). | ✅ (New Universal Login, default on) | 🟡 (enrollment policy) | ❌ | ❌ |
| **Device-local enrollment prompt after cross-device sign-in**<br>*aka: Local Enrollment (Auth0)* | When a user signs in on a new device with a passkey from another device, they are offered a credential local to the new device. | ✅ (New Universal Login, default on) | ❌ | ❌ | ❌ |
| **Native and embedded passkey APIs without a redirect**<br>*aka: Passkey APIs + webauthn grant (Auth0), Expo passkey client (BA)* | Endpoints and SDKs that let a native or single-page app drive registration and assertion directly, with the vendor hosting the Apple/Android app-association files. Auth0 requires a custom domain and the passkey grant. | ✅ (custom domain required) | ✅ (Identity Engine SDKs) | ✅ (Pro; Expo/iOS/Android) | ✅ (plugin: passkey) |
| **WebAuthn extension passthrough (PRF, largeBlob, credProps)** | Forwarding client extension inputs on registration and assertion and returning the raw response, so the application can derive encryption keys or read credential properties. | ❌ | ❌ | ❌ | ✅ (plugin: passkey) |
| **Passkeys against an external credential store** | Registering and verifying passkeys while the user records stay in a database the vendor does not own. | 🟡 (Early Access, custom DB without import) | ➖ (users live in Okta directory) | ➖ (users live in Clerk) | ✅ (core, your database) |
| **Device biometrics as a primary factor**<br>*aka: WebAuthn with Device Biometrics (Auth0), Okta Verify biometrics (Okta), Biometric credentials (Clerk)* | Touch ID/Face ID, Windows Hello or Android biometrics used instead of a password on return visits, with the private key held on the device. | ✅ (New Universal Login) | ✅ (Adaptive MFA) | ✅ (mobile SDKs) | 🟡 (via passkey platform attachment) |
| **Credential pre-provisioning**<br>*aka: WebAuthn Preregistration API (Okta)* | Security keys are enrolled on the user's behalf, typically by a fulfilment partner, so hardware arrives ready to use. | ❌ | ✅ (Identity Engine) | ❌ | ❌ |
| **Device-bound cryptographic authenticator client**<br>*aka: Okta FastPass (Okta)* | A first-party desktop/mobile client that signs authentication challenges with device-held keys, satisfying OIDC, SAML and WS-Federation apps and establishing the org session with no password collected. | ❌ | ✅ (Adaptive MFA) | ❌ | ❌ |
| **Accounts that never hold a password**<br>*aka: Password optional (Okta)* | Registering and signing in with no password ever set on the account. Auth0 requires passwords to stay enabled on database connections alongside passkeys, so only its passwordless connections are truly password-free. | 🟡 (passwordless connections only) | ✅ (Identity Engine) | ✅ (Free) | ✅ (core) |

### Other primary passwordless strategies

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Google One Tap / FedCM prompt sign-in**<br>*aka: `<GoogleOneTap />` (Clerk), oneTap plugin (BA)* | Google's browser-native prompt signs a user in from an existing Google session without a redirect, exchanging a Google ID token for a session. Requires the tenant's own Google credentials on Auth0 and Clerk. | ✅ (New Universal Login) | ❌ | ✅ (Free) | ✅ (plugin: oneTap) |
| **One Tap presentation and retry controls** | Application control over the prompt: rendered button vs automatic prompt, auto-select, popup vs redirect, dismissal handling, and re-prompting with backoff. | 🟡 (tenant toggle only) | ❌ | ✅ (Free) | ✅ (plugin: oneTap) |
| **Wallet signature sign-in (Sign-In with Ethereum, ERC-4361)**<br>*aka: SIWE Marketplace integration (Auth0), Web3 (Clerk), siwe plugin (BA)* | The user proves control of a wallet address by signing a server-issued message; the recovered address becomes or matches the account. Auth0 ships this as a partner Marketplace integration rather than a built-in connection. | 🟡 (Marketplace integration) | ❌ | ✅ (Free) | ✅ (plugin: siwe) |
| **Nonce issuance and signed-message field binding** | A single-use server nonce per attempt, plus independent validation of the domain, address, chain id and not-before/expiry fields inside the signed message before the signature is accepted. | 🟡 (inside Marketplace integration) | ❌ | ✅ (Free) | ✅ (plugin: siwe) |
| **Pluggable signature verification library** | The application supplies the signature-recovery implementation, so the auth layer does not depend on a particular web3 library. | ❌ | ❌ | ❌ | ✅ (plugin: siwe) |
| **Non-EVM wallet chains** | Wallets outside Ethereum-compatible chains, such as Solana, usable as a sign-in strategy. | ❌ | ❌ | ✅ (Free) | ❌ |
| **Multiple wallet addresses per account** | An account can carry more than one wallet, each with its chain id and an optional primary flag. | ❌ | ❌ | ✅ (Free) | ✅ (plugin: siwe) |
| **ENS name and avatar resolution** | Resolving the wallet's ENS name and avatar at sign-in and storing them as the user's profile name and image. | 🟡 (inside Marketplace integration) | ❌ | ❌ | ✅ (plugin: siwe) |
| **Anonymous / guest sessions**<br>*aka: Anonymous Sessions (Auth0), anonymous plugin (BA)* | A visitor gets a usable session and identity with no credential at all, so carts, preferences and activity can be tracked before registration. Auth0's variant issues session and access tokens from a dedicated endpoint and is in Beta behind a support request. | 🟡 (Beta, request access) | ❌ | ❌ | ✅ (plugin: anonymous) |
| **Guest-to-permanent account upgrade with data migration** | When the guest later authenticates for real, a hook exposes both identities so the application can move guest-owned data onto the permanent account. | 🟡 (Beta; Actions trigger) | ❌ | ❌ | ✅ (plugin: anonymous) |
| **Guest record cleanup after linking** | The temporary guest user is deleted once linked, with an option to retain it and an endpoint to discard a guest account on demand. | ➖ (no guest user record) | ❌ | ❌ | ✅ (plugin: anonymous) |
| **One-time sign-in token / ticket**<br>*aka: Sign-in tokens (Clerk), session token + sessionCookieRedirect (Okta), oneTimeToken plugin (BA)* | A server-minted single-use token that yields a sign-in URL or hands an existing session to another domain, consumed once by the front end. | ❌ | ✅ (Identity Engine) | ✅ (Free) | ✅ (plugin: oneTimeToken) |
| **One-time token lifetime and storage configuration** | Setting the token's validity window, supplying a custom generator, hashing the stored copy, and disabling client-side requests. Clerk's sign-in tokens default to 30 days; Better Auth's to 3 minutes. | ❌ | ❌ | 🟡 (lifetime only) | ✅ (plugin: oneTimeToken) |
| **Admin-issued temporary access code**<br>*aka: Temporary Access Code / TAC (Okta)* | An administrator generates a short-lived code with an explicit validity window that the user redeems to authenticate, for onboarding or a lost authenticator; one active code per user. | ❌ | ✅ (Identity Engine) | ❌ | ❌ |
| **Embedded passwordless flow without a hosted login page**<br>*aka: Embedded Passwordless Login grant (Auth0)* | Running the whole passwordless exchange from the application's own UI through API calls instead of redirecting to a vendor-hosted page. Auth0 requires an extension grant and a custom domain, and its passwordless connections bypass an existing session. | 🟡 (extension grant; custom domain) | ✅ (Identity Engine SDKs) | ✅ (Free, headless flows) | ✅ (core) |

---

## 03. Social & consumer identity providers

Signing a user in with a consumer identity provider (Google, Apple, GitHub, …): the prebuilt provider catalog, how a provider is credentialed, how extra scopes and profile claims are handled, and what happens to the provider's own access and refresh tokens afterwards. The four products diverge most on three axes — catalog size (Auth0 and Better Auth ship by far the largest lists), whether the vendor lends you shared OAuth credentials for development (Auth0 and Clerk do, Okta and Better Auth do not), and what you can do with the upstream provider's tokens afterwards (Auth0 sells a dedicated token-exchange vault, Better Auth exposes the token table directly, Okta and Clerk expose a read/refresh API). Enterprise IdPs, account linking between identities, Web3 wallets and Google One Tap are covered elsewhere.

### 3.1 Prebuilt provider catalogs

Each row below is one product's inventory, listed once rather than as one row per provider. `➖` marks the other three columns because a catalog is specific to the product that ships it.

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Prebuilt consumer provider catalog — Auth0**<br>*aka: Social Connections (Auth0)* | 38 named consumer strategies in the Management API connection `strategy` enum, plus generic `oauth1` and `oauth2`: amazon, apple, dropbox, bitbucket, auth0-oidc, baidu, bitly, box, daccount, dwolla, evernote, evernote-sandbox, exact, facebook, fitbit, github, google-oauth2, instagram, line, linkedin, paypal, paypal-sandbox, planningcenter, salesforce, salesforce-community, salesforce-sandbox, shopify, shop, soundcloud, thirtysevensignals (Basecamp), twitter, untappd, vkontakte, weibo, windowslive, wordpress, yahoo, yandex. The enum has since grown by asana, atlassian, gitlab, slack and five Token-Vault/MCP-oriented strategies (hubspot-mcp, linear-mcp, notion-mcp, sentry-mcp, cloudflare-mcp). | ✅ (Free+) | ➖ (own catalog row) | ➖ (own catalog row) | ➖ (own catalog row) |
| **Prebuilt consumer provider catalog — Okta**<br>*aka: Social Identity Providers, IdP (Okta)* | 15 prebuilt social IdP cards with dedicated setup guides: Google, Facebook, Apple, Microsoft, LinkedIn, Amazon, Discord, GitHub, GitLab, Spotify, PayPal, Salesforce, Xero, Yahoo, Yahoo Japan. Anything else is added through the generic OpenID Connect IdP type. Managed through the Identity Providers API, which also covers enterprise SAML/OIDC, smart card and identity-verification vendors. | ➖ (own catalog row) | ✅ (Customer Identity) | ➖ (own catalog row) | ➖ (own catalog row) |
| **Prebuilt consumer provider catalog — Clerk**<br>*aka: SSO connections — For all users, Social connections (Clerk)* | 25 documented OAuth/OIDC providers plus one deprecated: Apple, Atlassian, Bitbucket, Box, Coinbase, Discord, Dropbox, Facebook, GitHub, GitLab, Google, HubSpot, Hugging Face, Line, Linear, LinkedIn (OIDC), Microsoft, Notion, Slack, Spotify, TikTok, Twitch, X/Twitter v2, Vercel, Xero — with Twitter v1 marked deprecated. | ➖ (own catalog row) | ➖ (own catalog row) | ✅ (Hobby+) | ➖ (own catalog row) |
| **Prebuilt consumer provider catalog — Better Auth**<br>*aka: `socialProviders` (BA)* | 36 first-party providers shipped in the core package, each with its own docs page, default scopes and profile mapping: Apple, Atlassian, Cloudflare, Cognito, Discord, Dropbox, Facebook, Figma, GitHub, GitLab, Google, Hugging Face, Kakao, Kick, LINE, Linear, LinkedIn, Microsoft (Entra ID), Naver, Notion, Paybin, PayPal, Polar, Railway, Reddit, Roblox, Salesforce, Slack, Spotify, TikTok, Twitch, Twitter (X), Vercel, VK, WeChat, Zoom. The `genericOAuth` plugin additionally ships reusable provider *helpers* (e.g. Auth0, Gumroad, Microsoft Entra ID) that package endpoints, scopes and mapping. | ➖ (own catalog row) | ➖ (own catalog row) | ➖ (own catalog row) | ✅ (Core, MIT) |

### 3.2 Credentialing and defining a provider

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Own OAuth client credentials per provider**<br>*aka: Custom credentials (Clerk), Connection settings (Auth0), IdP client ID/secret (Okta)* | Register your own application at the provider and supply its client ID and client secret, together with the product-issued authorized redirect URI. | ✅ (Free+) | ✅ (Customer Identity) | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Vendor-supplied shared development credentials**<br>*aka: Auth0 Developer Keys / devkeys (Auth0), development instance shared credentials (Clerk)* | The vendor's own OAuth client is used so a provider works before you register anything provider-side. Auth0 documents devkeys as testing-only (no SSO, no refresh tokens, Auth0-branded consent); Clerk applies shared credentials to development instances only and requires custom credentials in production. | ✅ (Free+, testing only) | ❌ | ✅ (development instances) | ❌ |
| **Custom OAuth 2.0 provider definition**<br>*aka: Custom Social Connection / `oauth2` strategy (Auth0), Custom provider (Clerk), `genericOAuth` plugin (BA)* | Define a provider the product does not ship by supplying authorization URL, token URL, scopes and credentials. Okta's generic external IdP type is OIDC-only, so a plain non-OIDC OAuth 2.0 provider has no equivalent. | ✅ (Free+) | ❌ | ✅ (Hobby+, OIDC-shaped) | ✅ (plugin: genericOAuth) |
| **Generic OIDC provider via discovery document**<br>*aka: OIDC connection (Auth0), OpenID Connect IdP (Okta), Custom provider discovery endpoint (Clerk), `discoveryUrl` (BA)* | Point the product at a provider's `.well-known` configuration and let it resolve authorization, token, userinfo, JWKS and end-session endpoints. Better Auth skips a provider whose discovery metadata is invalid and retries when the auth instance is recreated. | ✅ (Free+) | ✅ (Customer Identity) | ✅ (Hobby+) | ✅ (plugin: genericOAuth) |
| **Explicit endpoint configuration without discovery**<br>*aka: manual endpoints (Clerk), `authorizationUrl`/`tokenUrl`/`userInfoUrl` (BA)* | Name each provider endpoint directly for providers that publish no discovery document; in Better Auth explicit endpoints also act as a fallback while discovery is unavailable. | ✅ (Free+) | ✅ (Customer Identity) | ✅ (Hobby+) | ✅ (plugin: genericOAuth) |
| **Generic OAuth 1.0a provider**<br>*aka: `oauth1` strategy (Auth0)* | Legacy connection type for providers that never moved past OAuth 1.0a. | ✅ (Free+, legacy) | ❌ | ❌ | ❌ |
| **PKCE on the outbound authorization request**<br>*aka: `pkce_enabled` (Auth0), Use PKCE (Clerk), `pkce` (BA)* | Sends a PKCE code challenge to the upstream provider. Better Auth defaults it on for generic providers (OAuth 2.1 baseline); Clerk exposes a per-connection toggle for custom providers; Auth0 sets it per-connection through the Management API rather than the dashboard; Okta's external IdP configuration exposes no PKCE setting. | 🟡 (Management API only) | ❌ | ✅ (custom providers) | ✅ (plugin: genericOAuth, default on) |
| **Token-endpoint client authentication method**<br>*aka: `tokenEndpointAuth` / legacy `authentication` (BA)* | Chooses how the product authenticates to the upstream token endpoint — `client_secret_basic`, `client_secret_post`, `private_key_jwt`, `none` (public client) or a custom request customizer. Okta's external OIDC IdP offers client secret or public/private key pair; Auth0 offers a signed client assertion on OIDC and Okta Workforce enterprise connections but not on custom social connections; Clerk's custom provider takes a client secret only. | 🟡 (enterprise OIDC connections only) | ✅ (secret or key pair) | ❌ | ✅ (plugin: genericOAuth) |
| **Private key JWT client assertion to the provider (RFC 7523)**<br>*aka: `getClientAssertion` / `createPrivateKeyJwtClientAssertionGetter` (BA)* | Authenticate to the upstream provider's token endpoint with a signed JWT assertion instead of a shared secret, signed locally from a JWK or supplied by an external workload-identity source. Auth0 ships this for OIDC and Okta Workforce enterprise connections, not for consumer social connections. | 🟡 (enterprise OIDC connections only) | ✅ (public/private key pair) | ❌ | ✅ (plugin: genericOAuth) |
| **Custom redirect URI for a provider**<br>*aka: `redirectURI` (BA), Authorized Redirect URI (Clerk)* | Override the default callback path registered with the provider. Better Auth requires a custom `redirectURI` to retain the provider-id path segment. Okta's callback is fixed at `https://{yourOktaDomain}/oauth2/v1/authorize/callback` (org or custom domain) and Clerk issues the redirect URI you register with the provider. | ✅ (Free+) | ❌ | ❌ | ✅ (Core, MIT) |
| **Provider usable by every application in the tenant**<br>*aka: Promote Connections to Domain Level (Auth0)* | Marks a connection as domain-level so any application in the tenant — including dynamically registered third-party clients, which may use only domain-level connections — can use it. | ✅ (Free+) | ✅ (IdP routing rules) | ➖ (instance-wide by design) | ➖ (single app by design) |

### 3.3 Scopes, consent and the authorization request

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Extra provider scopes configured on the connection**<br>*aka: `connection_scope` / Add Scopes to Call Identity Provider APIs (Auth0), `additionalScopes` (Clerk), `socialProviders.<id>.scope` (BA)* | Request provider scopes beyond basic profile so the application can later call that provider's own API. | ✅ (Free+) | ✅ (Customer Identity) | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Incremental authorization — request more scopes later**<br>*aka: `reauthorize` / `createExternalAccount` (Clerk), `linkSocial({ scopes })` (BA)* | Re-run the provider flow for an already-connected account to obtain additional scopes. Better Auth merges newly granted scopes into the stored `account.scope` so earlier grants survive; Okta accepts a space-delimited `idp_scope` on `/authorize` that is added to the scopes configured on the IdP. | 🟡 (re-authorize with `connection_scope`) | ✅ (`idp_scope` per request) | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Suppress a provider's default scopes**<br>*aka: `disableDefaultScope` (BA)* | Strip the built-in `email`/`profile`-style scopes so only explicitly listed scopes are requested. | ❌ | ❌ | ❌ | ✅ (Core, MIT) |
| **Force the provider's consent screen again**<br>*aka: Re-prompt for Permissions (Auth0), `oidcPrompt` (Clerk), `prompt` (BA)* | Sets the OAuth `prompt` parameter (`consent`, `select_account`, `login`, `none`) so the provider re-displays consent or the account chooser — commonly used to force re-issue of a refresh token. | ✅ (Free+) | 🟡 (fixed behavior, not configurable) | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Login hint pass-through**<br>*aka: `oidcLoginHint` (Clerk), `loginHint` (BA), `authParamsMap` (Auth0)* | Pre-identifies the user at the provider so the account selector is pre-filled. | ✅ (Free+) | 🟡 (honored by Okta, not forwarded) | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Arbitrary extra authorization-request parameters**<br>*aka: `authParams`/`authParamsMap` (Auth0), `additionalParams` / `authorizationUrlParams` (BA)* | Append provider-specific query parameters (e.g. `access_type`, `domain_hint`) to the outbound authorization URL, either statically or per request. Both Auth0 and Better Auth refuse to let a caller overwrite managed OAuth keys (`state`, `client_id`, `redirect_uri`, `response_type`, PKCE, `scope`). Okta offers only fixed toggles — an Application context option that sends the app name and id, and signed request objects — rather than arbitrary parameters. | ✅ (Free+) | 🟡 (fixed app-context option only) | ❌ | ✅ (Core, MIT) |
| **Authorization response mode selection**<br>*aka: `responseMode` (BA)* | Chooses `query` or `form_post` for how the provider returns the authorization response. Neither Auth0's custom social connection nor Okta's external IdP exposes it as a setting; providers that require `form_post` (Apple) are handled internally. | ❌ | ❌ | ❌ | ✅ (Core, MIT) |

### 3.4 Mapping the provider profile onto your user record

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Provider profile to user attribute mapping**<br>*aka: Fetch User Profile script (Auth0), IdP profile mappings (Okta), Attribute mapping (Clerk), `mapProfileToUser` (BA)* | Map the provider's claims onto local user fields, including non-standard claims. Better Auth treats the return value as provider *input*, so fields declared `input: false` are ignored. | ✅ (Free+, Node script) | ✅ (Customer Identity) | ✅ (custom providers) | ✅ (Core, MIT) |
| **Default value for a missing provider claim**<br>*aka: Attribute mapping defaults (Clerk)* | Supply a fallback when a provider omits a claim the product needs, such as an email-verified flag. | 🟡 (Fetch User Profile script) | 🟡 (Okta Expression Language) | ✅ (custom providers) | 🟡 (inside `mapProfileToUser`) |
| **Replace the provider userinfo request entirely**<br>*aka: User info URL (Clerk), `getUserInfo` (BA), Fetch User Profile script (Auth0)* | Substitute your own profile-retrieval implementation for providers whose profile API is non-standard or needs several calls. Clerk documents pointing the User info URL at your own proxy that performs the extra provider calls and returns a Clerk-mappable JSON shape; Better Auth lets `getUserInfo` return `null` to reject the sign-in outright. | ✅ (Free+) | ❌ | ✅ (proxy pattern) | ✅ (Core, MIT) |
| **Custom immutable account identifier**<br>*aka: `user_id` from Fetch User Profile (Auth0), `accountSubject(context)` (BA)* | Choose which provider field is the stable account identity when it is neither OIDC `sub` nor `id`. Better Auth deliberately forbids `mapProfileToUser` from setting it, keeping profile mapping separate from account recognition. | ✅ (Free+, required) | ❌ | ❌ | ✅ (plugin: genericOAuth) |
| **Refresh the stored profile on every sign-in**<br>*aka: Sync user profile attributes at each login (Auth0), `overrideUserInfoOnSignIn` / `overrideUserInfo` (BA)* | Re-reads the profile from the provider on each login instead of only at account creation; Auth0 defaults it on and lets you turn it off so the application owns profile attributes, Okta sources it through the IdP's Profile Master setting and JIT create-and-update, and Better Auth defaults it off. Clerk does not document whether stored user fields are refreshed from the provider on later sign-ins. | ✅ (Free+, default on) | ✅ (mapping on create and update) | ❔ (unverified) | ✅ (Core, MIT, default off) |
| **Documented guidance for providers that omit email**<br>*aka: Handling providers without email (BA)* | A per-provider table of when `email` may be absent (Apple, Discord, Facebook, GitHub, LinkedIn, Microsoft Entra ID, Roblox), which stable fallback identifier to use instead, and how far to trust each provider's `email_verified` signal. Better Auth is alone in shipping this as documentation rather than leaving it to the integrator. | ❌ | ❌ | ❌ | ✅ (Core, MIT) |

### 3.5 Upstream provider tokens

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Storage of the provider's access/refresh tokens**<br>*aka: Identity Provider Access Tokens (Auth0), social auth tokens (Okta), external account tokens (Clerk), `account` table (BA)* | Persists the token material issued by the upstream provider against the linked identity so the application can call that provider's API later. | ✅ (Free+) | ✅ (Customer Identity) | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Backend API to read a provider access token**<br>*aka: `identities[].access_token` via Management API (Auth0), List Social Auth Tokens (Okta), `getUserOauthAccessToken()` (Clerk), `getAccessToken()` (BA)* | A server-side call that returns the current upstream access token for a user's connected provider. Better Auth requires an explicit account selector (account record `id`, or `useAccountCookie: true`). | ✅ (Free+) | ✅ (Customer Identity) | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Automatic refresh when the provider token has expired**<br>*aka: Token Vault refresh (Auth0), on-demand refresh in `getUserOauthAccessToken()` (Clerk), auto-refresh in `getAccessToken()` (BA)* | The token-retrieval call transparently exchanges the stored refresh token and returns a fresh access token. Okta returns the social token it stored without refreshing it. Clerk documents that it does not refresh in the background — access tokens live one day, refresh tokens do not expire, and the refresh happens when you ask for the token. | ✅ (Token Vault) | ❌ | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Explicit force-refresh endpoint**<br>*aka: `refreshToken()` — `POST /refresh-token` (BA)* | Exchanges the stored refresh token immediately, regardless of whether the current access token has expired. | 🟡 (via Token Vault exchange) | ❌ | ❌ | ✅ (Core, MIT) |
| **Custom refresh-exchange implementation**<br>*aka: `refreshAccessToken` (BA)* | Per-provider override of the refresh call for providers with a non-standard refresh endpoint. Better Auth supports it for built-in social providers but not for `genericOAuth` providers, which instead take `refreshTokenParams` to inject a tenant-scoped `scope`, `audience` or `resource` (the grant type, refresh token and client id stay fixed). | ❌ | ❌ | ❌ | ✅ (Core, MIT; built-ins only) |
| **Access-token lifetime fallback for providers that omit `expires_in`**<br>*aka: `accessTokenExpiresIn` (BA)* | Supplies an assumed lifetime so expiry detection and refresh still work rather than returning a stale token indefinitely. | ❌ | ❌ | ❌ | ✅ (plugin: genericOAuth) |
| **Dedicated federated-token exchange service**<br>*aka: Token Vault / tokensets (Auth0)* | A separate store of federated access and refresh tokens (one tokenset per authorized connection) that an application or agent exchanges its own Auth0 token for, so provider credentials are never handed to client-side code or an AI agent. No equivalent product exists in the other three; they hand you the raw stored token. | ✅ (Token Vault) | ❌ | ❌ | ❌ |
| **Encryption of provider tokens at rest**<br>*aka: `account.encryptOAuthTokens` (BA)* | Encrypts the stored access/refresh tokens before they are written to the database. Better Auth defaults it off and also documents doing it yourself in a `databaseHooks.account.create.before` hook. The hosted products encrypt storage as a service property rather than a toggle. | ➖ (hosted, managed) | ➖ (hosted, managed) | ➖ (hosted, managed) | ✅ (Core, MIT, opt-in) |
| **Database-less provider token storage**<br>*aka: `account.storeAccountCookie` + `getAccountCookie()` (BA)* | Keeps provider account data (access/refresh/ID tokens, scopes, expiry) in a chunked, encrypted five-minute cookie so token material survives without an account table; auto-enabled when no database is configured. | ➖ (hosted store) | ➖ (hosted store) | ➖ (hosted store) | ✅ (Core, MIT) |
| **Fetch the live provider profile on demand**<br>*aka: `accountInfo()` — `GET /account-info` (BA)* | Calls the provider for current profile data for a linked account, returning the local account record, the mutable user fields and the raw provider payload separately. | 🟡 (custom call with IdP token) | 🟡 (custom call with IdP token) | 🟡 (custom call with IdP token) | ✅ (Core, MIT) |

### 3.6 Native and mobile sign-in

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Sign in with an ID token obtained by a platform SDK**<br>*aka: Apple Native / Facebook Native / Google Native (Auth0), `signInWithIdToken()` / `signUpWithIdToken()` (Clerk), `signIn.social({ idToken })` (BA)* | The mobile app obtains the provider's ID token through Apple's or Google's native SDK and posts it to the auth backend, which verifies and issues its own session — no browser redirect. Okta's social IdP flow is browser-redirect only (its native-SSO token exchange trades Okta's own tokens, not a social provider's). | ✅ (native connections) | ❌ | ✅ (iOS/Expo native) | ✅ (Core, MIT) |
| **Token-exchange grant for native social sign-in (RFC 8693)**<br>*aka: Token Exchange for Native Social (Auth0)* | Posts a platform SDK `subject_token` with a declared `subject_token_type` to the token endpoint and receives access/ID/refresh tokens. Auth0 supports an optional `user_profile` parameter for iOS name capture and a DPoP proof header. | ✅ (native social grant) | ❌ | 🟡 (SDK-level, not a public grant) | 🟡 (SDK-level, not a public grant) |
| **One backend configuration accepting several client IDs**<br>*aka: `clientId: string[]` (BA)* | Accepts an array of client IDs for providers that validate ID tokens by audience (Google, Apple, Microsoft Entra, Facebook, Cognito), so Web, iOS and Android SDK tokens all verify against one server config. Clerk reaches the same result by registering each native app (App ID prefix and bundle id) against the connection rather than by listing client ids. | 🟡 (separate connections) | ❌ | ✅ (native applications registered) | ✅ (Core, MIT) |
| **Nonce binding on ID tokens**<br>*aka: `disableIdTokenNonceBinding` (BA)* | Binds the provider's `id_token` to the authorization request with a server-generated nonce and rejects a callback whose token does not echo it (OIDC Core §3.1.3.7). On by default for Better Auth discovery providers. | ✅ (OIDC connections) | ✅ (OIDC IdP) | ✅ (nonce required for Apple) | ✅ (plugin: genericOAuth) |
| **Turn off client-supplied ID-token sign-in**<br>*aka: `disableIdTokenSignIn` (BA)* | Disables the direct ID-token path per provider, where it is otherwise on by default (Google, Apple). | 🟡 (disable native connection) | ➖ (not offered) | ❌ | ✅ (Core, MIT) |
| **Replace built-in ID-token verification**<br>*aka: `verifyIdToken(token, nonce?, ctx?)` (BA)* | Fully substitutes your own signature/issuer/audience/expiry checks for a provider's ID token, with access to the request context. Better Auth also offers `requireIdTokenVerification`, which refuses to register a provider unless discovery yields a usable issuer and `jwks_uri`. | ❌ | ❌ | ❌ | ✅ (Core, MIT) |

### 3.7 Account-creation policy and provider-specific behavior

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Block new-account creation through a social provider**<br>*aka: Provisioning Policy disabled (Okta), `disableSignUp` (BA)* | Existing users may sign in with the provider, but an unrecognized identity is rejected instead of provisioned. Okta ships it as an IdP policy setting; Auth0 requires a post-login or pre-user-registration Action (there is an official "disable social signup" template), so it is code rather than configuration. | 🟡 (Action code required) | ✅ (Provisioning Policy) | 🟡 (restrictions / allowlist) | ✅ (Core, MIT) |
| **Require explicit sign-up intent before creating a user**<br>*aka: `transferable` prop (Clerk), `disableImplicitSignUp` (BA)* | A social sign-in with an unknown identity does not silently become a sign-up; the caller must ask for it (`requestSignUp: true`, or Clerk's `<SignIn />` transfer to a sign-up attempt, default `true`). | ❌ | ➖ (covered by provisioning policy) | ✅ (Hobby+) | ✅ (Core, MIT) |
| **Reject a provider identity before user creation (admission control)**<br>*aka: post-login Action (Auth0), `validateUserInfo({ user, source })` (BA)* | A callback that inspects the provider id and raw profile and can refuse the identity — e.g. enforce an email domain — before a user is created, an account is linked or a session is issued; redirect flows land on the error URL, programmatic flows get a 403. | ✅ (Actions) | 🟡 (routing rules / hooks) | 🟡 (restrictions, allowlist) | ✅ (Core, MIT) |
| **Per-provider verified-email requirement**<br>*aka: `socialProviders.<id>.requireEmailVerification` (BA)* | Refuses to create a session when a specific provider reports the email unverified; the user and account are still created or linked and the callback redirects with `?error=email_not_verified`. Independent of the email/password verification setting. | 🟡 (Action code required) | 🟡 (mapping plus policy, custom work) | 🟡 (Clerk verifies unverified provider emails) | ✅ (Core, MIT) |
| **Popup vs redirect presentation of the provider step**<br>*aka: `oauthFlow: redirect \| popup \| auto` (Clerk), `disableRedirect` (BA)* | Chooses how the provider's authorization page is presented. Better Auth's `disableRedirect` returns the authorization URL for the caller to navigate itself rather than offering a managed popup. | 🟡 (auth0.js popup mode) | ❌ | ✅ (Hobby+) | 🟡 (URL returned, no managed popup) |
| **Restrict a Google connection to one Workspace domain**<br>*aka: `hd` option (BA)* | Rejects Google accounts outside a named Workspace domain at the provider step rather than after the fact. | 🟡 (Action code required) | 🟡 (IdP username RegEx filter) | 🟡 (instance-level allowlist) | ✅ (Core, MIT) |
| **Block Google email subaddresses**<br>*aka: Block email subaddresses (Clerk)* | Connection-level default rejecting Google addresses containing `+`, `=` or `#`, mitigating the Google Workspace alias issue where admins cannot suspend alias accounts. | 🟡 (Action code required) | ❌ | ✅ (Hobby+, default on) | 🟡 (`validateUserInfo` code) |
| **Pin a provider connection to one workspace/tenant/instance**<br>*aka: `team` (Slack), `tenantId` (Microsoft), `issuer` (self-hosted GitLab), `domain`/`userPoolId` (Cognito) in BA* | Per-provider options constraining sign-in to a specific upstream workspace, directory tenant or self-hosted instance of the provider. | 🟡 (per-connection options vary) | 🟡 (edit IdP issuer and endpoints) | 🟡 (Microsoft tenant only) | ✅ (Core, MIT) |
| **Carry ephemeral data through the provider round trip**<br>*aka: `additionalData` + `getOAuthState()` (BA)* | Passes values such as a referral code or acquisition source through the redirect and reads them back in callback hooks without persisting them. Client-supplied values are documented as untrusted; the same mechanism started server-side (`auth.api.signInSocial`) cannot be set by the client and is safe to trust. | 🟡 (state/`appState` handling) | 🟡 (own `state` parameter) | ❌ | ✅ (Core, MIT) |
| **Accept an IdP-initiated callback for a custom provider**<br>*aka: `allowIdpInitiated` (BA)* | Accepts a stateless callback that arrives with a `code` but no `state` by discarding the code and restarting the flow server-side with a fresh `state` and PKCE verifier, so CSRF and PKCE protection are preserved. Requires a global `baseURL`. The IdP-initiated SSO the hosted products offer is the SAML mechanism for enterprise IdPs, not an OAuth consumer-provider callback. | ❌ | ❌ | ❌ | ✅ (plugin: genericOAuth) |
| **Preserve the raw provider token response**<br>*aka: `tokens.raw` (BA)* | Keeps the provider's original token payload accessible in callbacks, for providers that return identity or other data alongside the tokens. | 🟡 (Fetch User Profile script) | ❌ | ❌ | ✅ (plugin: genericOAuth) |
| **Custom token exchange for non-standard token endpoints**<br>*aka: `getToken({ code, redirectURI })` (BA)* | Replaces the default authorization-code exchange for providers that require a GET, custom parameters or a non-standard response shape, returning tokens, expiry, scopes and the raw response. | ❌ | ❌ | ❌ | ✅ (plugin: genericOAuth) |

---

## 04. Enterprise federation & SSO

Federating authentication to an external corporate identity provider. Okta and Auth0 cover the full protocol surface including on-premises directory agents; Clerk and Better Auth are SAML/OIDC service providers only, with no Active Directory or LDAP story. The sharpest commercial divergence in the whole comparison sits here: Auth0 counts enterprise connections against the plan (1 on Free, 5 on B2B Professional, $100/month for each additional), Clerk bills $75/month per connection past the first, Okta folds unlimited inbound connections into its per-user SSO SKU, and Better Auth's `@better-auth/sso` plugin is MIT-licensed with no connection limit — only the hosted self-service onboarding dashboard is commercial.

### Connection model and federation protocols

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Enterprise identity-provider connection**<br>*aka: Enterprise Connection (Auth0), Identity Provider / IdP (Okta), Enterprise SSO connection (Clerk), SSO provider (BA)* | A configured trust relationship that delegates authentication for a defined population of users to an external corporate identity provider. | 🟡 (counted per plan) | ✅ (SSO SKU) | 🟡 (Pro+, metered) | ✅ (plugin: sso, MIT) |
| **SAML 2.0 service provider**<br>*aka: SAML connection `samlp` (Auth0), inbound SAML / SAML 2.0 IdP (Okta), Custom SAML Provider (Clerk), `samlConfig` (BA)* | The product consumes and validates SAML 2.0 assertions issued by an external identity provider. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (plugin: sso) |
| **SAML 2.0 identity provider**<br>*aka: SAML2 Web App Addon (Auth0), SAML app integration (Okta)* | The product issues signed SAML assertions to downstream service-provider applications, making it the IdP in the trust. | ✅ (Free and up) | ✅ (SSO SKU) | ❌ | ❌ |
| **Chained SAML proxy (SP and IdP together)**<br>*aka: Configure Auth0 as Service and Identity Provider (Auth0), hub-and-spoke (Okta)* | Accepts an assertion from an upstream IdP and re-issues a fresh assertion to a downstream SP, acting as a federation broker. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ❌ | ❌ |
| **Generic OIDC enterprise connection**<br>*aka: OpenID Connect connection `oidc` (Auth0), OpenID Connect IdP (Okta), OIDC Provider (Clerk), `oidcConfig` (BA)* | Federation to any standards-compliant OpenID Connect provider using discovery or manually supplied endpoints. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (plugin: sso) |
| **Domain-routed multi-tenant OIDC SSO**<br>*aka: EASIE (Clerk)* | Enterprise sign-in through a shared multi-tenant OpenID provider (Google Workspace, Microsoft Entra ID) selected by email domain, with no per-customer SAML metadata exchange; positioned as a lighter alternative to SAML. | 🟡 (per-tenant Google/Entra connection) | 🟡 (per-tenant Entra/Google IdP) | ✅ (Pro/Business) | ❌ |
| **WS-Federation as an upstream protocol**<br>*aka: ADFS connection (Auth0), WS-Federation inbound capability (Okta)* | Federates to a WS-Fed identity provider such as AD FS or IdentityServer by importing or subscribing to federation metadata. | ✅ (Enterprise connection) | 🟡 (OIN capability) | ❌ | ❌ |
| **WS-Federation as a downstream protocol**<br>*aka: WS-Fed endpoint `/wsfed/{clientId}` (Auth0), WS-Federation app integration (Okta)* | Exposes a WS-Federation endpoint and federation metadata so legacy relying parties can consume the product's tokens. | ✅ (Free and up) | 🟡 (OIN listings only) | ❌ | ❌ |
| **Prebuilt Microsoft Entra ID connection**<br>*aka: Microsoft Azure AD connection `waad` (Auth0), Microsoft Entra ID IdP (Okta), Microsoft Azure AD / Entra ID (Clerk)* | Guided connection type for Microsoft Entra ID with provider-specific defaults rather than raw protocol configuration. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (Pro/Business) | 🟡 (generic OIDC/SAML config) |
| **Prebuilt Google Workspace connection**<br>*aka: Google Workspace connection `google-apps` (Auth0)* | Guided connection type treating a Google Workspace domain as an enterprise identity provider. | ✅ (Enterprise connection) | 🟡 (via generic OIDC IdP) | ✅ (Pro/Business) | 🟡 (generic OIDC config) |
| **Okta Workforce as an upstream IdP**<br>*aka: Okta Workforce connection `okta` (Auth0), Okta-to-Okta IdP / Org2Org (Okta), Okta Workforce (Clerk)* | Dedicated connection type federating to an Okta Workforce Identity org, typically the customer's corporate IdP. | ✅ (uncounted connection) | ✅ (SSO SKU) | ✅ (Pro/Business) | 🟡 (generic SAML/OIDC) |
| **Prebuilt AD FS and PingFederate connections**<br>*aka: ADFS and `pingfederate` connections (Auth0)* | Named connection types for the two most common on-premises federation servers, with vendor-specific setup guidance. | ✅ (Enterprise connection) | 🟡 (generic SAML IdP) | 🟡 (custom SAML) | 🟡 (generic SAML config) |
| **X.509 / smart-card certificate authentication**<br>*aka: Smart Card IdP (Okta), client SSL certificate authentication (Auth0)* | Authenticates the user with a client certificate (PIV/CAC or similar) instead of an interactive credential. | 🟡 (AD/LDAP connector only) | ✅ (SSO SKU) | ❌ | ❌ |
| **Pre-built enterprise integration catalog**<br>*aka: Okta Integration Network / OIN (Okta), SAML SSO integration guides (Auth0)* | A published catalog of ready-made federation integrations an administrator can pick from instead of hand-configuring a protocol. | 🟡 (~7 SAML guides, 12 strategies) | ✅ (8,367 listings; 7,818 SSO) | 🟡 (3 named IdPs + custom) | ❌ |

### Metadata, certificates and assertion security

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Service-provider metadata publication**<br>*aka: `/samlp/metadata/{clientId}` (Auth0), ACS URL and Entity ID (Clerk), `spMetadata` endpoint (BA)* | Publishes the product's own SP entity ID, ACS URL and certificates for upload into the identity provider. | ✅ (Free and up) | ✅ (SSO SKU) | 🟡 (values shown, no metadata doc) | ✅ (XML or JSON) |
| **Identity-provider metadata import**<br>*aka: `metadataUrl` / `metadataXml` (Auth0), `idpMetadataUrl` / `idpMetadata` (Clerk), `idpMetadata.metadata` (BA)* | Configures endpoints and certificates by importing the IdP's metadata document instead of typing each value; Auth0 re-polls a subscribed AD FS metadata URL daily for certificate rollover. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (XML, 100KB cap) |
| **Signed authentication requests**<br>*aka: Sign Request / `signSAMLRequest` (Auth0), `authnRequestsSigned` (BA)* | Signs the outbound AuthnRequest with the SP key so the identity provider can verify its origin. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ❌ | ✅ (plugin: sso) |
| **Customer-supplied SP signing key**<br>*aka: `options.signing_key` (Auth0), sign the Okta certificate with your own CA (Okta), `spMetadata.privateKey` (BA)* | Replaces the platform's tenant key with a customer-controlled private key or CA-issued certificate for one connection. | ✅ (Management API only) | ✅ (CSR / own CA) | ❌ | ✅ (plugin: sso) |
| **Inbound assertion signature validation**<br>*aka: X509 Signing Certificate (Auth0), `idpCertificate` (Clerk), `samlConfig.cert` (BA)* | Verifies every inbound SAML response or assertion against the identity provider's signing certificate. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (plugin: sso) |
| **Encrypted SAML assertions**<br>*aka: Sign and Encrypt SAML Requests (Auth0), `isAssertionEncrypted` (BA)* | Consumes assertions encrypted to the SP's key, and (where the product is an IdP) encrypts outbound assertions. | ✅ (both directions) | ✅ (SSO SKU) | ❌ | ✅ (decryption keys, with passphrase) |
| **Multiple or rotating IdP signing certificates**<br>*aka: certificate rollover (Auth0), key rollover (Okta), `cert` array (BA)* | Accepts responses signed by either the current or the next IdP key so a certificate can be rotated without an outage window. | 🟡 (metadata-driven rollover) | ✅ (SSO SKU) | 🟡 (single certificate field) | ✅ (PEM list, either key accepted) |
| **Certificate expiry alerting**<br>*aka: "Signing certificate will expire" email (Auth0), SAML certificate expiration notifications (Okta), `idpCertificateExpiresAt` (Clerk)* | Warns administrators before a federation certificate expires, rather than letting sign-in break silently. | ✅ (email ~30 days ahead) | 🟡 (app certs, not inbound IdP) | 🟡 (expiry timestamp via API) | ❌ |
| **Signature and digest algorithm configuration**<br>*aka: `signatureAlgorithm` / `digestAlgorithm` (Auth0), upgrade SAML apps to SHA256 (Okta), `saml.algorithms` (BA)* | Selects the signing and digest algorithms used on the connection; Better Auth additionally has a warn/reject/allow policy for deprecated algorithms (RSA-SHA1, SHA1, RSA 1.5, 3DES). | ✅ (Enterprise connection) | ✅ (SSO SKU) | ❌ | ✅ (plus deprecation policy) |
| **NameID format configuration**<br>*aka: `nameIdentifierFormat` / `nameIdentifierProbes` (Auth0), Name ID format (Okta), `identifierFormat` (BA)* | Chooses which NameID format the SP requests and how the subject identifier is derived from it. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ❌ (attribute mapping instead) | ✅ (plugin: sso) |
| **SAML binding selection**<br>*aka: `protocolBinding` (Auth0), Request binding (Okta), `spMetadata.binding` (BA)* | Picks HTTP-POST or HTTP-Redirect for the messages exchanged with the identity provider. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ❔ (unverified) | ✅ (post or redirect) |
| **Audience, Recipient and Destination validation** | Rejects an assertion whose AudienceRestriction, bearer Recipient or response Destination does not match this service provider. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (checked against SP entity ID and ACS) |
| **`InResponseTo` correlation**<br>*aka: `saml.enableInResponseToValidation` (BA), Allow IdP-Initiated flow guard (Clerk)* | Tracks issued AuthnRequest IDs and rejects responses that do not correlate, blocking unsolicited responses and cross-provider injection. | 🟡 (IdP-initiated path is documented login-CSRF risk) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (configurable request TTL, default 5 min) |
| **SAML assertion replay protection** | Records consumed assertion IDs and rejects a second use of the same assertion. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (each response consumed once) | ✅ (DB-backed, held to `NotOnOrAfter`) |
| **Assertion timestamp and clock-skew validation** | Enforces the `NotBefore` / `NotOnOrAfter` conditions with a tolerance for clock drift between SP and IdP. | ✅ (not tunable) | ✅ (SSO SKU) | ✅ (not tunable) | ✅ (`clockSkew`, `requireTimestamps`) |

### Sign-in flows and upstream request configuration

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **SP-initiated federated sign-in**<br>*aka: Service Provider-initiated flow (Clerk)* | The user starts at the application, is redirected to the identity provider, and returns with an assertion or code. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (plugin: sso) |
| **IdP-initiated SAML sign-in**<br>*aka: Identity Provider-Initiated SSO (Auth0), Allow IdP-Initiated flow (Clerk), `saml.allowIdpInitiated` (BA)* | Accepts an unsolicited SAMLResponse posted from the identity provider's app catalog and establishes a session. | 🟡 (off by default; no Adaptive MFA) | ✅ (SSO SKU) | 🟡 (opt-in per connection) | 🟡 (off by default) |
| **IdP-initiated OIDC sign-in**<br>*aka: `oidcConfig.allowIdpInitiated` (BA)* | Handles an OIDC login started at the provider with no client state by discarding the provider's code and restarting a fresh server-side flow with new state and PKCE. | ❌ | ❌ | ❌ | ✅ (plugin: sso, off by default) |
| **IdP-initiated landing target configuration**<br>*aka: default application + query overrides (Auth0), Default Relay State (Okta), `idpInitiatedCallbackUrl` (BA)* | Defines where an unsolicited sign-in (or a validation failure) lands when the client supplied no callback. | ✅ (default app, protocol and `redirect_uri` overrides) | ✅ (SSO SKU) | ❌ (toggle only) | ✅ (per-provider and global) |
| **Post-login redirect allow-listing**<br>*aka: Allowed Callback URLs (Auth0), Trusted Origins (Okta), mobile SSO redirect allowlist (Clerk), `trustedOrigins` (BA)* | Restricts where a federated sign-in may redirect afterwards, preventing open redirects and nonce leakage to unapproved native targets. | ✅ (Free and up) | ✅ (SSO SKU) | ✅ (Free) | ✅ (relative paths and trusted origins) |
| **Forced re-authentication at the identity provider**<br>*aka: Force authentication / `ForceAuthn` (Clerk), `wfresh=0` (Auth0)* | Adds `ForceAuthn` so the IdP ignores its own existing SSO session and re-prompts, aimed at shared devices. | 🟡 (WS-Fed `wfresh=0` only) | 🟡 (app sign-on policy re-auth) | ✅ (per-connection toggle) | ❌ |
| **Login hint passthrough**<br>*aka: Login hint (Clerk), `signIn.sso({ loginHint })` (BA)* | Forwards the user's identifier to the identity provider so its own login screen is prefilled or routed. | ✅ (Enterprise connection) | ✅ (SSO SKU) | ✅ (email, custom attribute, or off) | ✅ (OIDC only; not SAML) |
| **PKCE on the upstream authorization code flow**<br>*aka: `requiresPkce` (Clerk), `oidcConfig.pkce` (BA)* | Applies Proof Key for Code Exchange to the code exchange with the upstream OIDC provider. | ✅ (OIDC and Okta connections) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (plugin: sso) |
| **Client authentication to the upstream token endpoint**<br>*aka: Private Key JWT Client Authentication for Enterprise Connections (Auth0), `tokenEndpointAuthentication` (BA)* | Chooses how the product authenticates itself to the IdP's token endpoint; Auth0 additionally supports DPoP-bound tokens from upstream enterprise IdPs. | ✅ (`private_key_jwt`, GA) | 🟡 (client secret only) | 🟡 (client secret only) | 🟡 (`client_secret_basic` / `_post`) |

### Domain routing, verification and tenant binding

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Email-domain routing to the right identity provider**<br>*aka: Home Realm Discovery / IdP Domains (Auth0), IdP routing rules / IdP Discovery (Okta), domain-scoped connection (Clerk), `signIn.sso({ email })` (BA)* | Resolves which identity provider to use from the domain part of the identifier the user typed, so no password prompt appears. | ✅ (B2B Essentials+; not on B2C) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (plugin: sso) |
| **Multiple email domains per connection**<br>*aka: Multiple domains for enterprise SSO connections (Clerk)* | One connection serves several corporate domains rather than forcing one connection per domain. | ✅ (up to 1,000 domains) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (comma-separated list) |
| **Subdomain matching**<br>*aka: Allow subdomains (Clerk)* | Lets addresses on subdomains of a claimed domain use the parent domain's connection. | ❌ (each domain listed explicitly) | 🟡 (routing-rule expressions) | ✅ (requires eTLD+1) | ❌ |
| **Explicit provider selection by ID or tenant slug**<br>*aka: `connection` parameter (Auth0), `idp` parameter (Okta), `signIn.sso({ providerId, organizationSlug })` (BA)* | Starts the flow against a named connection or tenant rather than inferring it from the email, so several IdPs can coexist for one population. | ✅ (Free and up) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (provider ID, domain or org slug) |
| **Email-domain ownership verification**<br>*aka: Domain verification (Auth0, Clerk), `domainVerification` (BA)* | Requires proof of control over a claimed domain — a DNS TXT record in all three cases — before a connection serving it can be activated. | ✅ (self-service profiles) | ❌ | ✅ (DNS TXT) | ✅ (`TXT _better-auth-token-{providerId}`, 1-week token) |
| **Organization / tenant-scoped connections**<br>*aka: Enterprise Connections for Organizations (Clerk), `registerSSOProvider({ organizationId })` (BA)* | Binds a connection to one tenant so IdP-authenticated users land in the correct organization rather than a global pool. | ✅ (B2B plans) | 🟡 (realms / group scoping) | 🟡 (B2B Auth add-on, $100/mo) | ✅ (owner/admin gated) |
| **Automatic organization membership on federated sign-in**<br>*aka: auto-membership in Connection Profile (Auth0), `organizationProvisioning` (BA)* | Adds a federated user to the connection's organization on first sign-in without an invitation; Better Auth leaves pending invitations to complete on their own. | ✅ (B2B plans) | 🟡 (group rules) | 🟡 (B2B Auth add-on) | ✅ (default or computed role) |

### On-premises directory integration

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Active Directory integration via on-premises agent**<br>*aka: AD/LDAP Connector (Auth0), Okta AD Agent (Okta)* | Software agent installed inside the customer network that connects the identity platform to Active Directory over outbound-only connections. | ✅ (Enterprise connection) | ✅ (Universal Directory) | ❌ | ❌ |
| **Generic LDAP directory integration**<br>*aka: `auth0-adldap` (Auth0), Okta LDAP Agent (Okta)* | Connects to a non-AD LDAP server for authentication and profile import. Okta documents AD LDS, eDirectory, IBM, OpenDJ, OpenLDAP, ODSEE and OUD. | ✅ (Enterprise connection) | ✅ (Universal Directory) | ❌ | 🟡 (unofficial community plugin) |
| **Delegated password verification against the directory**<br>*aka: Delegated authentication (Okta)* | Forwards the submitted password to the directory for validation instead of storing a local hash. | ✅ (with AD/LDAP connector) | ✅ (Universal Directory) | ❌ | ❌ |
| **Password synchronization from the domain controller**<br>*aka: Okta AD Password Sync agent* | Domain-controller agent that captures password changes in AD and replicates them into the identity platform. | ❌ | ✅ (Universal Directory) | ❌ | ❌ |
| **Directory credential caching for outage resilience**<br>*aka: credential caching / Disable cache (Auth0)* | Caches profiles and password hashes in the connector so sign-in survives a directory or connector outage; can be switched off. | ✅ (with AD/LDAP connector) | ❌ | ❌ | ❌ |
| **Directory agent clustering and auto-update**<br>*aka: AD/LDAP High Availability (Auth0), Agent Pools (Okta)* | Runs several agent instances for failover and pushes agent version upgrades without manual reinstallation. | ✅ (with AD/LDAP connector) | ✅ (Universal Directory) | ❌ | ❌ |
| **Kerberos desktop single sign-on**<br>*aka: Windows Integrated Authentication (Auth0), Desktop SSO / Agentless DSSO (Okta)* | Silently authenticates domain-joined machines on a trusted network using Kerberos, falling back to a credential prompt elsewhere. | 🟡 (auto-login is Classic Login only) | ✅ (agent or agentless) | ❌ | ❌ |
| **LDAP front-end for legacy applications**<br>*aka: Okta LDAP Interface* | Exposes an LDAP bind/search endpoint backed by the cloud directory so LDAP-only applications can authenticate against it. | ❌ | ✅ (Universal Directory) | ❌ | ❌ |
| **Directory attribute mapping into the user profile**<br>*aka: Map AD/LDAP Profile Attributes (Auth0), Profile Editor mappings (Okta)* | Defines how directory attributes populate the platform's normalized user profile, including manager relationships. | ✅ (with AD/LDAP connector) | ✅ (Universal Directory) | ❌ | ❌ |

### Identity mapping and provisioning at federated sign-in

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Just-in-time user creation on first federated sign-in**<br>*aka: Create users during sign-in (Clerk), SAML / AD / LDAP JIT provisioning (Okta), implicit sign-up (BA)* | Creates the local account the first time a user authenticates through the IdP, instead of requiring a prior import. Clerk enables it by default per SAML connection; Better Auth can require an explicit sign-up request instead. | ✅ (Enterprise connection) | ✅ (Universal Directory) | ✅ (`disable_jit_provisioning` to turn off) | ✅ (`disableImplicitSignUp` to turn off) |
| **SAML attribute to profile mapping**<br>*aka: Customize SAML Assertions / User Attribute Profile (Auth0), IdP user profile mappings (Okta), Custom Attribute Mapping (Clerk), `samlConfig.mapping` (BA)* | Maps assertion attributes onto local user profile fields. | ✅ (Enterprise connection) | ✅ (Universal Directory) | ✅ (Pro/Business) | ✅ (signed NameID stays the subject) |
| **OIDC claim to profile mapping**<br>*aka: Configure PKCE and Claim Mapping for OIDC Connections (Auth0), `oidcConfig.mapping` (BA)* | Maps ID token and userinfo claims onto local profile fields. | ✅ (OIDC and Okta connections) | ✅ (Universal Directory) | 🟡 (four fixed claims plus custom attributes) | ✅ (verified `sub` stays the subject) |
| **Custom and multi-valued attribute pass-through**<br>*aka: User Attribute Profile (Auth0), custom attributes (Okta), Allow multiple values (Clerk), `extraFields` (BA)* | Carries arbitrary extra attributes — including repeated values such as groups or roles — from the IdP into application-visible metadata. | ✅ (Enterprise connection) | ✅ (Universal Directory) | ✅ (arrays in `publicMetadata`) | ✅ (plugin: sso) |
| **Attribute re-sync on every federated sign-in**<br>*aka: Sync user attributes (Clerk), profile sourcing (Okta), `provisionUserOnEveryLogin` (BA)* | Refreshes the stored profile from the IdP response at each sign-in rather than only at creation. | 🟡 (post-login Actions) | ✅ (Universal Directory) | ✅ (per-connection toggle) | ✅ (requires idempotent callback) |
| **Federated group or attribute to role assignment**<br>*aka: Role mapping (Clerk), SAML JIT group provisioning (Okta), `organizationProvisioning.getRole` (BA)* | Derives the user's role or group membership from IdP-supplied claims at sign-in time. | 🟡 (post-login Actions) | ✅ (Universal Directory) | 🟡 (B2B Auth add-on + Directory Sync) | ✅ (computed per user) |
| **Custom identity resolution hook**<br>*aka: `resolveUser` (BA), account link policy / username template (Okta)* | Application code decides which local account a verified federated identity belongs to, on the provider/issuer/subject tuple rather than on email, and may reject the sign-in. | 🟡 (post-login Actions) | 🟡 (policy, not code) | ❌ | ✅ (transactional: continue, link or reject) |
| **Custom provisioning callback**<br>*aka: `provisionUser` (BA), registration inline hook (Okta), post-login Action (Auth0)* | Runs application logic when a user arrives through SSO — creating resources, syncing to external systems or writing audit records. | ✅ (Actions) | 🟡 (inline hook) | 🟡 (webhooks, asynchronous) | ✅ (receives user info and tokens) |
| **Account linking to an existing local account**<br>*aka: Account linking (Clerk), verified-domain trusted providers (BA), account link policy (Okta)* | Attaches a federated identity to a pre-existing local account with the same email instead of creating a duplicate. | 🟡 (Actions / account-link extension) | ✅ (Universal Directory) | ✅ (IdP emails treated as verified) | ✅ (after domain verification) |
| **Upstream deactivation check at session issuance**<br>*aka: Automatic deprovisioning (Clerk)* | Before minting a session token, checks whether the account was suspended or deleted at the identity provider and revokes sessions if so — without a directory-sync connection. | ❌ | ❌ | ✅ (EASIE only, up to 10 min delay) | ❌ |

### Administration, delegation and commercial model

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **End-customer self-service IdP configuration**<br>*aka: Self-Service Enterprise Configuration, formerly Self-Service SSO (Auth0), Self-serve SSO (Clerk), self-service SSO dashboard (BA)* | Hands a customer's own IT administrator a guided flow to claim a domain, exchange metadata and activate their connection without the vendor's staff. | ✅ (Free and B2B plans; 20 profiles) | 🟡 (Partner Admin Portal, separate SKU) | 🟡 (B2B Auth add-on, $100/mo) | 🟡 (commercial `@better-auth/infra`) |
| **Connection template for delegated setup**<br>*aka: Connection Profile (Auth0), `defaultSSO` (BA)* | Pins naming, permitted features and organization behaviour for connections created by a third party, so delegated setup cannot exceed policy. | ✅ (`/api/v2/connection-profiles`) | ❌ | ❌ | 🟡 (code-level defaults, not a policy template) |
| **Programmatic connection management API**<br>*aka: Management API connections (Auth0), Identity Providers API (Okta), Enterprise connections Backend API (Clerk), `POST /sso/register` (BA)* | Creates and updates federation connections from code rather than only through an admin console. | ✅ (Management API) | ✅ (SSO SKU) | ✅ (Pro/Business) | ✅ (runtime, org owner/admin gated) |
| **Live connection test**<br>*aka: Try Connection / Test Connection (Auth0), preview the SAML assertion (Okta)* | Runs a real authentication against a configured connection and shows the resulting profile before users are exposed to it. | ✅ (Free and up) | ✅ (SSO SKU) | ✅ (test step in self-serve setup) | ❌ |
| **Guard on authentication-boundary changes**<br>*aka: `guardProviderMutation` (BA)* | Blocks edits to security-critical connection settings (entity IDs, endpoints, signing certificates, NameID format, ACS URLs) while a directory-sync control plane is paired. | ❌ | ❌ | ❌ | ✅ (plugin: sso) |
| **Enterprise-connection metering and price** | How federated connections are counted and billed. Auth0 counts an active connection per plan; Clerk bills per connection above the first; Okta charges per user for the SSO SKU with no per-connection fee; Better Auth charges nothing for the plugin at any volume. | 🟡 (1 Free, 3/5 B2B, +$100/mo each, max 30) | ✅ (per-user SSO SKU, uncounted) | 🟡 (1 in Pro, then $75/mo each) | ✅ (MIT, unlimited, free) |

---

## 05. Multi-factor authentication & step-up

Everything here concerns verification *beyond* the primary credential: the factors themselves, how users enrol and manage them, when the product decides to challenge, and how an application forces a fresh challenge before a sensitive operation. Okta carries by far the widest factor catalogue and the only declarative policy engine over it, but nearly all of the policy vocabulary sits behind the Adaptive MFA SKU; Auth0 covers the mainstream factors with risk scoring sold as a separate add-on; Clerk ships three factors plus the most developer-friendly step-up primitives; Better Auth provides a single official `twoFactor` plugin (TOTP, app-delivered OTP, backup codes, trusted device) and no policy or risk layer at all.

### 5.1 Second-factor methods

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Authenticator app one-time code (TOTP)**<br>*aka: One-Time Password / OTP (Auth0), Okta Verify TOTP + Google Authenticator (Okta), Authenticator application (Clerk), `twoFactor` totp method (BA)* | Time-based six-digit code from an authenticator app, enrolled by QR code or manual secret entry. | ✅ (MFA, Essentials+) | ✅ (MFA SKU) | ✅ (Pro) | 🟡 (plugin: twoFactor) |
| **Push-approval notification**<br>*aka: Push Notification using Auth0 Guardian (Auth0), Okta Verify push (Okta)* | Approve/deny prompt delivered to a registered mobile app over APNs/FCM instead of a transcribed code. | ✅ (MFA, Essentials+) | ✅ (MFA SKU) | ❌ | ❌ |
| **Push number-matching challenge**<br>*aka: Push notification number challenge (Okta)* | Anti-push-fatigue control requiring the user to pick a number shown in the browser; configurable for all pushes or only high-risk ones. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Embeddable authenticator SDK for a first-party app**<br>*aka: Guardian SDK (Auth0), Custom authenticator / Okta Devices SDK (Okta)* | Libraries that turn the customer's own mobile app into the push and biometric authenticator, so users install no separate app. | ✅ (iOS/Android SDK) | ✅ (Identity Engine) | ❌ | ❌ |
| **SMS one-time code**<br>*aka: Phone Message / SMS notifications (Auth0), Phone authenticator — SMS (Okta), SMS verification code (Clerk)* | One-time code sent by text message to a registered mobile number. | ✅ (MFA, Essentials+) | ✅ (MFA SKU) | ✅ (Pro) | 🟡 (plugin: twoFactor, own sender) |
| **Voice-call one-time code**<br>*aka: Voice notifications (Auth0), Phone authenticator — Voice call (Okta)* | One-time code read aloud over an automated phone call; Okta also accepts landlines and extensions. | ✅ (New Universal Login only) | ✅ (MFA SKU) | ❌ | 🟡 (plugin: twoFactor, custom channel) |
| **Email one-time code as a second factor**<br>*aka: Email notifications for MFA (Auth0), Email authenticator (Okta)* | One-time code sent to the registered email address and accepted as the second factor. | ✅ (dependent factor, New UL) | ✅ (MFA SKU) | ❌ (email code is first factor only) | 🟡 (plugin: twoFactor) |
| **Email magic link as a verification step**<br>*aka: Email Magic Links / EML (Okta), email link in Device Trust (Clerk)* | Click-through link that completes the verification step in place of transcribing a code. | ❌ (MFA email is code only) | ✅ (Identity Engine) | 🟡 (Device Trust step-up only) | ❌ (magic link is primary sign-in) |
| **Roaming security key (FIDO2/WebAuthn)**<br>*aka: WebAuthn with FIDO Security Keys (Auth0), Passkeys / FIDO2 WebAuthn (Okta)* | External hardware key such as a YubiKey or Titan used as the second factor; phishing-resistant. | ✅ (MFA, Essentials+) | 🟡 (Adaptive MFA SKU) | ❌ (passkeys cannot be a dedicated 2nd factor) | ❌ (passkey plugin is primary only) |
| **Platform authenticator / device biometrics**<br>*aka: WebAuthn with FIDO Device Biometrics (Auth0), FastPass with Windows Hello, Touch ID or Face ID (Okta)* | WebAuthn against the built-in authenticator — Touch ID, Face ID, Windows Hello, Android biometrics — always performing user verification. | ✅ (dependent factor) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Passkey accepted in place of a second factor**<br>*aka: Security key with PIN as sole method (Auth0), Okta FastPass / phishing-resistant single factor (Okta), Passkeys satisfy MFA (Clerk)* | A single user-verifying, phishing-resistant credential is treated as meeting the multi-factor requirement, so no extra prompt appears. | ✅ (WebAuthn key with PIN) | 🟡 (Adaptive MFA SKU) | ✅ (Pro, default for new instances) | ❌ |
| **Hardware OTP key**<br>*aka: YubiKey OTP (Okta)* | Hardware token that emits a one-time passcode, provisioned by uploading the vendor seed file. | ❌ | ✅ (MFA SKU) | ❌ | ❌ |
| **Generic OTP token profile**<br>*aka: Custom OTP (Okta)* | Support for arbitrary OTP hardware or software by configuring code length, HMAC algorithm, time step, drift window and secret encoding. | ❌ | ✅ (Identity Engine) | ❌ | ❌ |
| **Knowledge-based security question**<br>*aka: Security question (Okta)* | Predefined or custom question answered as a knowledge factor; cannot by itself satisfy an "any two factor types" rule. | ❌ | ✅ (MFA SKU) | ❌ | ❌ |
| **Smart card / PIV-CAC certificate**<br>*aka: Smart Card authenticator + Smart Card IdP (Okta)* | X.509 certificate on a PIV/CAC card validated by mutual TLS, with expression-based mapping of certificate subject fields to the user. | ❌ | ✅ (Identity Engine) | ❌ | ❌ |
| **Third-party MFA service delegation (Duo)**<br>*aka: Cisco Duo Security (Auth0), Duo Security authenticator + Symantec VIP (Okta)* | Hands the whole second-factor step to an external MFA service — Cisco Duo, or Symantec VIP on Okta — which becomes the system of record for verification. Auth0 requires Duo to be the only factor enabled and gives it a fixed 30-day MFA session with no remember-device option. | ✅ (must be the only factor) | ✅ (MFA SKU) | ❌ | ❌ |
| **External identity provider as a second factor**<br>*aka: IdP authenticator (Okta)* | An external SAML 2.0 or OIDC provider used purely as a possession factor rather than for primary sign-in; browser-only, and Microsoft Entra ID is excluded. | ❌ | ✅ (Identity Engine) | ❌ | ❌ |
| **NFC / proximity authenticator**<br>*aka: NFC authenticator, Proximity Providers (Okta)* | Verification by detecting a paired card, token or device physically near the host. | ❌ | 🟡 (Early Access) | ❌ | ❌ |
| **User-held backup / recovery codes**<br>*aka: Recovery Codes (Auth0), Backup codes (Clerk), backup codes (BA)* | Single-use codes issued at enrolment that substitute for the user's other factors when the device is lost. Okta has no user-held code set; its equivalent is the admin-issued temporary access code. | ✅ (dependent factor, off by default) | ❌ | ✅ (Pro) | 🟡 (plugin: twoFactor) |
| **Backup-code regeneration**<br>*aka: recovery code regeneration (Auth0), `generateBackupCodes` (BA)* | Issuing a fresh set of recovery codes, invalidating the previous set. | ✅ (Management API) | ➖ | ✅ (Pro) | 🟡 (plugin: twoFactor) |
| **Admin-issued temporary bypass code**<br>*aka: Temporary access code / TAC (Okta)* | Time-boxed code an administrator generates for a user who cannot use their enrolled factors, for onboarding or lost-device cases; one active code per user. | ❌ | ✅ (Identity Engine) | ❌ | ❌ |
| **Configurable code length and validity**<br>*aka: Advanced MFA Configurations (Auth0), OTP settings on Custom OTP (Okta)* | Tuning of one-time-code parameters: Auth0 allows 4–10 digits with SMS lifetime 30s–1h and email 5m–1h; Better Auth exposes the TOTP period and accepts one window of drift either side. | ✅ (GA Sept 2026) | ✅ (Identity Engine) | ❌ | 🟡 (plugin: twoFactor) |
| **Throttling and lockout on failed factor verification**<br>*aka: OTP attempt rate limiting (Okta), Lockout policy (Clerk), account lockout options (BA)* | Invalidating the challenge and locking the account after repeated wrong codes. Okta kills the code after five wrong entries and returns 429; Clerk defaults to 10 attempts and a one-hour cooldown across codes, TOTP and backup codes; Better Auth shares one counter across all second-factor methods. | ✅ (brute-force protection) | ✅ (MFA SKU) | ✅ (Free) | 🟡 (plugin: twoFactor, on by default) |

### 5.2 Enrolment and factor management

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Per-factor availability configuration**<br>*aka: Enable MFA factors (Auth0), Authenticators setup (Okta), Multi-factor page (Clerk)* | Administrative switches deciding which second factors users of this tenant or instance may enrol at all. | ✅ (Dashboard) | ✅ (MFA SKU) | ✅ (Pro) | 🟡 (plugin options) |
| **Group-scoped enrolment policy**<br>*aka: Authenticator enrollment policy (Okta)* | Declares each authenticator required, optional or disallowed for a named population, and when the enrolment prompt appears. | 🟡 (post-login Actions) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Phishing-resistant enrolment gating**<br>*aka: Phishing-resistant authenticator enrollment (Okta)* | Enrolment policy that offers only phishing-resistant authenticator types, preventing users from registering weaker methods. | 🟡 (Actions restrict factor list) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Authenticator model allow-list**<br>*aka: FIDO MDS and custom AAGUID list (Okta)* | Restricts which FIDO2 authenticator models may be registered, by FIDO Metadata Service entry or explicit AAGUID list. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **User-verification requirement on the authenticator**<br>*aka: Device passcode or biometric user verification (Okta), Guardian app passcode/biometric lock (Auth0)* | Forces a local unlock — device passcode, PIN or biometric — before the authenticator will sign or release a challenge. | ✅ (WebAuthn UV, Guardian app lock) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Out-of-band enrolment invitation**<br>*aka: Custom Enrollment Tickets (Auth0)* | Admin-generated one-off URL inviting a specific user to enrol a factor outside a sign-in attempt. | ✅ (Management API) | ❔ (unverified) | ❌ | ❌ |
| **Pre-provisioned security keys**<br>*aka: WebAuthn Preregistration API (Okta)* | Issuing security keys to users already enrolled, by having a fulfilment provider register the credential in advance. | ❌ | ✅ (Identity Engine) | ❌ | ❌ |
| **Import of existing factor enrolments**<br>*aka: Import User MFA Authenticator Enrollments (Auth0), `totp_secret` on createUser (Clerk)* | Migrating TOTP seeds or phone enrolments from a previous system so users are not forced to re-enrol. | ✅ (Management API) | 🟡 (seed upload for YubiKey / Custom OTP) | ✅ (Free, createUser) | 🟡 (direct row insert) |
| **Self-service factor management for end users**<br>*aka: My Account API (Auth0), End-User Dashboard settings (Okta), `<UserProfile />` (Clerk), twoFactor client methods (BA)* | Letting a signed-in user list, add and remove their own enrolled factors. | ✅ (My Account API, MFA API) | ✅ (MFA SKU) | ✅ (Pro, prebuilt component) | 🟡 (plugin endpoints, own UI) |
| **Self-service removal or disabling of the second factor**<br>*aka: `twoFactor.disable()` (BA), Remove method (Clerk)* | The user turns off their own second factor, normally after re-proving the password. | ✅ (My Account API) | 🟡 (governed by account management policy) | ✅ (Pro, reverification required) | 🟡 (plugin: twoFactor, password required) |
| **Admin-initiated factor reset**<br>*aka: Reset User MFA (Auth0), Reset multifactor authentication (Okta), `disableUserMFA()` (Clerk)* | Administrator unenrols a user's factors and recovery codes so they re-enrol at next sign-in. Clerk's reset neither revokes sessions nor changes the password. | ✅ (all plans) | ✅ (MFA SKU) | ✅ (Free, Dashboard + Backend API) | 🟡 (custom, no admin API) |
| **Self-service MFA reset without an administrator**<br>*aka: Self-reset MFA (Okta)* | The user recovers from a lost factor on their own, by proving identity through a permitted alternative. Clerk deliberately ships no end-user reset path through its Frontend API. | 🟡 (recovery code or custom flow) | 🟡 (Adaptive MFA SKU, account management policy) | ❌ (by design) | 🟡 (backup code, then re-enrol) |
| **Passwordless-account factor management**<br>*aka: `allowPasswordless` (BA), MFA for passwordless users (Okta)* | Enrolling and managing a second factor for an account that has no password to re-prove. | ✅ (My Account API) | 🟡 (Adaptive MFA SKU) | ✅ (Pro) | 🟡 (plugin: twoFactor option) |

### 5.3 Enforcement policy

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Tenant- or instance-wide MFA requirement**<br>*aka: Define policies — Never / Adaptive / Always (Auth0), Global session policy (Okta), Require multi-factor authentication (Clerk)* | A single switch making every user of the tenant complete a second factor. | ✅ (Dashboard policy selector) | ✅ (Starter+) | ✅ (Pro) | 🟡 (plugin + own hook) |
| **Blocking access until enrolment completes**<br>*aka: `setup-mfa` session task (Clerk), enrollment prompt (Okta)* | An unenrolled user is challenged to register a factor and is treated as unauthenticated until they do. | ✅ (with Always policy) | 🟡 (Adaptive MFA SKU) | ✅ (Pro, pending session) | ❌ |
| **Per-application MFA policy**<br>*aka: App sign-on policy / authentication policy (Okta)* | Different applications behind the same identity provider demand different factor requirements. | 🟡 (post-login Actions) | 🟡 (Adaptive MFA SKU) | ➖ (one instance per app) | ➖ (library serves one app) |
| **Per-organization MFA policy**<br>*aka: per-org MFA via post-login Action (Auth0)* | One B2B tenant is required to use MFA while another is not, within a single deployment. | 🟡 (Actions, no native toggle) | 🟡 (Adaptive MFA SKU, group-scoped) | 🟡 (custom middleware check) | 🟡 (custom check) |
| **Per-group or per-segment MFA policy**<br>*aka: policy rule group conditions (Okta), user metadata conditions in Actions (Auth0)* | Requirement varies by group membership, user type or profile attribute, with individual users excludable from a rule. | 🟡 (Actions on metadata/IP) | 🟡 (Adaptive MFA SKU) | 🟡 (custom check) | 🟡 (custom check) |
| **Factor-count and factor-class requirement**<br>*aka: User must authenticate with 1 factor type / 2 factor types / password + another factor (Okta)* | States how many distinct factor classes a sign-in must present rather than naming products. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Possession-factor characteristic constraints**<br>*aka: Method characteristics — phishing-resistant, hardware-protected, device-bound, user-verifying (Okta)* | Policies demand security properties of the factor (hardware-protected, requires user interaction, PIN or biometric) instead of specific authenticators. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Per-policy method allow/deny list**<br>*aka: Allow only specific methods (Okta), Customize MFA Selection with `api.multifactor.enable` (Auth0)* | Enumerates, per rule or per application, which factors may satisfy the challenge. | 🟡 (Actions, New Universal Login) | 🟡 (Adaptive MFA SKU) | ❌ (instance-wide only) | ❌ |
| **Ordered factor sequencing**<br>*aka: Authentication method chain (Okta)* | Enforces a specific order of authenticators — for example OTP then biometric — with alternates permitted at each step. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Factor prerequisite model**<br>*aka: Independent vs dependent factors (Auth0)* | Certain factors may only be offered once a stronger one is enrolled: Auth0 gates device biometrics, email and recovery codes behind an independent factor; Clerk and Better Auth tie backup codes to another enrolled factor and delete them with the last one. | ✅ (built-in model) | ❌ | 🟡 (backup codes only) | 🟡 (backup codes only) |
| **Second factor after enterprise SSO return**<br>*aka: MFA after IdP return (Clerk)* | The identity provider applies its own second factor to users who authenticated at an external IdP, adding assurance the IdP does not provide. | 🟡 (Actions on connection) | ✅ (MFA SKU, policy applies to federated sign-ins) | ✅ (Pro, optional) | ❌ |
| **Phishing-resistance enforcement**<br>*aka: Phishing-resistant authentication (Okta)* | A policy outcome satisfiable only by WebAuthn-class credentials, denying access to anyone presenting a weaker method. | 🟡 (Actions limiting to WebAuthn) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Preset policy templates**<br>*aka: Preset authentication policies — Any two factors, Password only, One factor access, Seamless access based on risk/network (Okta)* | Shipped policy templates covering common assurance patterns, including a risk-adaptive preset that accepts one factor when risk is low and two when it is high. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Scoping the second factor to particular sign-in routes**<br>*aka: twoFactor applies to `/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number` (BA)* | Which primary authentication paths trigger a second-factor challenge. Better Auth challenges only password-based routes by default, leaving OAuth, magic link, passkey and email OTP unchallenged unless the app adds hooks. | ✅ (policy applies to all flows) | ✅ (policy applies to all flows) | ✅ (Pro) | 🟡 (plugin: twoFactor, credential routes only) |

### 5.4 Adaptive and risk-based challenges

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Risk-scored conditional MFA**<br>*aka: Adaptive MFA (Auth0), Risk level condition / Behavior Detection (Okta)* | The product scores each sign-in and challenges only when confidence is low, rather than on every attempt. Auth0's implementation deliberately ignores existing remember-this-browser sessions and does not cover client-credentials, device-authorization, ROP, token-exchange or IdP-initiated SAML flows. | 🟡 (Enterprise + Adaptive MFA add-on) | 🟡 (Adaptive MFA SKU / Identity Threat Protection) | ❌ | ❌ |
| **New-device signal**<br>*aka: `NewDevice` assessor (Auth0), New Device behavior (Okta), Device Trust, formerly Client Trust (Clerk)* | Challenges when the browser or device has not been seen for this user before. Auth0 keys on user agent plus cookies over a 30-day window; Clerk's Device Trust fires only for users who have no MFA enrolled and uses an email code, SMS code or email link. | 🟡 (Adaptive MFA add-on) | 🟡 (Adaptive MFA SKU) | 🟡 (Free, only when no MFA enrolled) | ❌ |
| **Impossible-travel signal**<br>*aka: `ImpossibleTravel` assessor (Auth0), Velocity behavior (Okta)* | Compares the geolocation and time of consecutive sign-ins and challenges when the implied travel speed is not physically possible. | 🟡 (Adaptive MFA add-on) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Untrusted-IP / IP-reputation signal**<br>*aka: `UntrustedIP` assessor (Auth0), Okta ThreatInsight (Okta)* | Challenges or denies when the source address carries a poor reputation in the vendor's traffic intelligence. | 🟡 (Adaptive MFA add-on) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **New-location signal**<br>*aka: New Geo-Location, New Country, New City behaviors (Okta)* | Challenges when the sign-in comes from a country, region or city this user has not used before, independent of travel speed. | 🟡 (folded into the impossible-travel assessor) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Network-zone condition**<br>*aka: Network zones, including dynamic zones (Okta)* | Named IP ranges that relax or tighten the factor requirement — typically one factor on the corporate network, two off it. | 🟡 (Actions on IP) | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Registered-device condition**<br>*aka: Device state — Registered / Unregistered (Okta)* | Requires the request to come from a device already enrolled with the identity provider's device agent. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Managed-device condition**<br>*aka: Device management attestation (Okta)* | Requires proof that the device is enrolled in the organization's MDM before access is granted. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Device posture condition**<br>*aka: Device assurance policy, Device Posture Checks (Okta)* | Requires the device to meet named security requirements — OS version, disk encryption, screen lock, endpoint-security agent — evaluated as a policy condition. | ❌ | 🟡 (Adaptive MFA SKU / Device Access) | ❌ | ❌ |
| **Custom expression or code condition**<br>*aka: Custom expression condition with Okta Expression Language (Okta), post-login Action (Auth0)* | An arbitrary predicate the tenant writes, evaluated as an extra condition on whether to challenge. | ✅ (Actions) | 🟡 (Adaptive MFA SKU) | 🟡 (custom middleware) | 🟡 (hooks, custom code) |
| **Risk verdicts exposed to custom logic**<br>*aka: Customize Adaptive MFA (Auth0), risk level in policy conditions (Okta)* | The individual assessor results and confidence score are readable by tenant-written code so it can implement its own policy, including its own device-remembrance rules. Auth0 also emits per-assessment log events. | 🟡 (with Adaptive MFA add-on) | 🟡 (Adaptive MFA SKU, policy conditions only) | ❌ | ❌ |

### 5.5 Device trust and challenge frequency

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Remember this device (suppress later challenges)**<br>*aka: Remember this device / `allowRememberBrowser` (Auth0), device cookie MFA lifetime (Okta), `trustDevice` (BA)* | After a successful challenge the browser is marked trusted so the factor is not requested again for a period. Clerk has no such option: an enrolled second factor is requested at every sign-in. | ✅ (all plans, 30 days default) | ✅ (MFA SKU) | ❌ | 🟡 (plugin: twoFactor, 30 days) |
| **Configurable remember-device lifetime**<br>*aka: Advanced MFA Configurations (Auth0), MFA lifetime for the device cookie (Okta)* | Administrative control over how long the trusted-device state survives. Auth0 allows an idle window of 1 hour to 30 days and an absolute cap up to 90 days; Better Auth's window is a fixed 30 days refreshed on each sign-in. | ✅ (GA Sept 2026) | ✅ (MFA SKU) | ❌ | ❌ (fixed) |

### 5.6 Step-up and re-authentication

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Step-up challenge before a sensitive operation**<br>*aka: Step-up Authentication for Web Apps (Auth0), Step-up authentication with `acr_values` (Okta), Reverification (Clerk)* | An already-signed-in user is made to re-prove a factor before a high-value action or page. Clerk's prebuilt components apply it automatically to credential changes, identifier changes, MFA changes, session revocation and account deletion. | ✅ (Actions forcing MFA) | ✅ (Identity Engine) | ✅ (Free) | 🟡 (core `session.freshAge` + own gate) |
| **Configurable re-authentication freshness window**<br>*aka: Re-authentication frequency (Okta), Reverification window (Clerk), `max_age` (Auth0), `session.freshAge` (BA)* | How recently the user must have authenticated for a protected action to proceed. Clerk allows 1–10 minutes (default 10); Better Auth defaults to one day and can disable the check with `0`; Okta expresses it as per-rule re-prompt intervals. | ✅ (`max_age` / `prompt=login`) | 🟡 (Adaptive MFA SKU) | ✅ (Free, Dashboard setting) | ✅ (Core OSS) |
| **Separate password and factor re-prompt timers**<br>*aka: Password / factor re-prompt intervals (Okta)* | Distinct freshness windows for the knowledge factor and for the other factors, so a password can be demanded more or less often than the second factor. | ❌ | 🟡 (Adaptive MFA SKU) | ❌ | ❌ |
| **Step-up tied to API scopes or assurance level**<br>*aka: Step-up Authentication for APIs (Auth0), `acr_values` on the authorize request (Okta)* | Requesting an elevated scope or assurance level forces a challenge, and the resulting token carries `amr`/`acr` evidence the resource server can verify. | ✅ (Actions + scopes) | ✅ (Identity Engine) | 🟡 (session-token claims, not OAuth `acr`) | ❌ |
| **Server-side step-up assertion helper**<br>*aka: `has({ reverification })` with `strict_mfa` / `strict` / `moderate` / `lax`, `require_reverification!` (Clerk)* | A first-party server helper that asserts factor freshness and returns the error shape the client needs, rather than leaving the application to inspect token claims. | 🟡 (verify `amr`/`acr` yourself) | 🟡 (verify `acr`/`amr` yourself) | ✅ (Free, several SDKs) | 🟡 (check `session.freshAge` yourself) |
| **Client-side step-up prompt with automatic retry**<br>*aka: `useReverification()`, `onNeedsReverification` (Clerk)* | Wrapping a request so a step-up error opens a verification dialog and the original call is retried on success, with a hook for a fully custom UI. | ❌ | ❌ | ✅ (Free) | ❌ |
| **One verification bound to one action**<br>*aka: `{{session.reverification_id}}` with the `fva` claim (Clerk)* | A unique identifier minted per verification and carried in the session token, so a backend can bind exactly one sensitive operation to it and reject replays. | ❌ | ❌ | ✅ (Free, custom claim) | ❌ |
| **Step-up enforced on the account self-service surface**<br>*aka: My Account API Default Policy "Require 2FA" (Auth0), Okta Account Management Policy (Okta)* | The product itself demands a recent second factor before a user may change their own credentials or factors. Auth0 requires a factor within the last 15 minutes, re-challenged on refresh-token exchange, and returns `unmet_authentication_requirements` otherwise. | ✅ (release-stage gated) | 🟡 (Adaptive MFA SKU) | ✅ (Free, built into components) | 🟡 (freshness on some endpoints) |
| **Constrained factor set for re-verification**<br>*aka: Available factors for reverification (Clerk)* | Which factors are acceptable for a step-up challenge, as distinct from sign-in. Clerk accepts password, email code and phone code as first factors and phone code, authenticator app and backup code as second, downgrading gracefully when the user has no second factor. | 🟡 (Actions choose providers) | 🟡 (Adaptive MFA SKU, policy methods) | ✅ (Free) | ❌ |

### 5.7 APIs and custom flows

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Factor enrolment and challenge API for custom UIs**<br>*aka: MFA API — `/mfa/associate`, `/mfa/authenticators`, `/mfa/challenge` (Auth0), Authenticators + User Authenticator Enrollments APIs (Okta), custom MFA flows (Clerk), twoFactor endpoints (BA)* | Programmatic enrolment, listing, deletion and verification of factors outside the hosted login UI. Auth0's MFA API covers SMS, voice, push, email and OTP but cannot enrol Duo or WebAuthn. | ✅ (MFA grant on the app) | ✅ (Identity Engine) | ✅ (Free, Frontend + Backend API) | 🟡 (plugin: twoFactor) |
| **MFA over a direct / resource-owner grant**<br>*aka: ROPG with MFA, `mfa-oob` / `mfa-otp` / `mfa-recovery-code` grants (Auth0)* | Completing a second factor for a non-browser sign-in, using an `mfa_required` error plus an `mfa_token` handshake. | ✅ (MFA grants) | 🟡 (Identity Engine interaction code flow) | ❌ | 🟡 (plugin: twoFactor, own client) |
| **Challenge signalling to the client**<br>*aka: `mfa_required` + `mfa_token` (Auth0), `needs_second_factor` status (Clerk), `twoFactorRedirect` and `twoFactorMethods` (BA), remediation steps (Okta)* | The sign-in response tells the client that a factor is outstanding and which enrolled methods can satisfy it, so a custom UI can route the user to the right screen. | ✅ (MFA, Essentials+) | ✅ (Identity Engine) | ✅ (Pro) | 🟡 (plugin: twoFactor, callback or path) |

---

## 06. OAuth 2.0 / OpenID Connect protocol surface

This section covers the standards-level machinery: which grants, client authentication methods and protocol extensions each product implements, and in which direction — acting as an authorization server for other applications versus acting as a client of an external provider. All four can act as an authorization server, but the depth differs sharply: Auth0 and Okta implement the regulated-finance extension set (PAR, JAR, RAR, mTLS, FAPI profiles), while Clerk and Better Auth implement an OAuth 2.1-shaped subset that drops implicit, hybrid and password grants outright.

### Direction: which side of the protocol the product plays

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Authorization server for the customer's own applications**<br>*aka: Tenant authorization server (Auth0), Org authorization server (Okta), OAuth applications (Clerk), `oauthProvider` / formerly `oidcProvider` (BA)* | Issues OAuth access tokens and OIDC ID tokens to applications the customer owns, from an issuer the customer controls. | ✅ (all plans) | ✅ (org authorization server) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **OpenID Provider for externally owned third-party applications**<br>*aka: Third-Party Applications (Auth0), Clerk as an IdP (Clerk)* | Lets applications the customer does not own integrate with the product as their identity provider, with consent, restricted grants and per-client scope ceilings. | ✅ (all plans) | ✅ (org authorization server) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **Several authorization servers with independent issuers**<br>*aka: Custom authorization server (Okta)* | Multiple issuers inside one tenant, each with its own scopes, claims, signing keys, access policies and metadata document, so different APIs get genuinely separate token domains. Auth0, Clerk and Better Auth expose one issuer per tenant/instance and model APIs as audiences under it. | ❌ | ✅ (API Access Management) | ❌ | ❌ |
| **Client (relying party) to an arbitrary external OAuth 2.0 / OIDC provider**<br>*aka: Generic OIDC / Custom Social Connection (Auth0), Generic OIDC IdP (Okta), Custom provider (Clerk), `genericOAuth` (BA)* | Registers any standards-compliant external provider as a sign-in source by supplying endpoints and client credentials, rather than only pre-integrated vendors. | ✅ (all plans) | ✅ (included) | ✅ (all plans) | ✅ (plugin: genericOAuth) |
| **Upstream endpoint auto-configuration from OIDC discovery**<br>*aka: `discoveryUrl` (BA), Discovery endpoint (Clerk)* | Reads the external provider's `.well-known/openid-configuration` to learn its authorize, token, userinfo, JWKS and end-session endpoints instead of hand-entering each URL. | ✅ (all plans) | ✅ (included) | ✅ (all plans) | ✅ (plugin: genericOAuth) |

### Grant types

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Authorization code grant**<br>*aka: Authorization Code Flow (Auth0), Authorization Code flow (Okta), OAuth scoped access (Clerk)* | Redirect flow in which the client exchanges a short-lived code at the token endpoint, so tokens never travel through the browser. | ✅ (all plans) | ✅ (org and custom AS) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **Authorization code with PKCE (RFC 7636)**<br>*aka: Authorization Code Flow with PKCE (Auth0), Authorization Code with PKCE (Okta), Require PKCE (Clerk)* | Adds a code verifier/challenge pair so public clients (SPAs, native apps, CLIs) can use the code grant without holding a client secret. | ✅ (all plans) | ✅ (org and custom AS) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **PKCE mandatory by default, `plain` challenge rejected** | Server-side policy that requires `S256` PKCE on every authorization request rather than leaving it to the client, and refuses the insecure `plain` challenge method. Auth0 enforces it only for public and third-party/DCR clients; Okta leaves it per-application. | 🟡 (public/third-party clients) | 🟡 (per-application setting) | ✅ (default on new instances) | ✅ (plugin: oauth-provider) |
| **Implicit grant**<br>*aka: Implicit Flow with Form Post (Auth0), Implicit flow (Okta)* | Returns tokens directly from the authorization endpoint. Documented as no longer best practice by both vendors that still offer it, and removed by OAuth 2.1, which Clerk and Better Auth follow (`response_type=code` only). | ✅ (all plans, discouraged) | ✅ (legacy, discouraged) | ❌ | ❌ |
| **Hybrid flow** | Returns an ID token from the authorization endpoint alongside the code, so the client learns the user's identity immediately while tokens are fetched back-channel. | ✅ (confidential clients) | ✅ (org and custom AS) | ❌ | ❌ |
| **Client credentials grant**<br>*aka: Client Credentials Flow (Auth0), Client Credentials flow (Okta), `client_credentials_scopes` (BA)* | Machine-to-machine grant where the client itself is the resource owner and no user is involved. Clerk's docs state the grant is explicitly not supported; its machine-auth product uses M2M tokens instead. Better Auth is fail-closed — an administrator must assign a non-empty machine-scope ceiling. | ✅ (metered M2M token quota) | ✅ (org and custom AS) | ❌ | ✅ (plugin: oauth-provider) |
| **Resource owner password credentials grant**<br>*aka: Resource Owner Password Flow (Auth0), ROPC (Okta)* | Client collects the username and password and posts them to the token endpoint. Documented as a last resort by both vendors; removed by OAuth 2.1. | ✅ (first-party apps only) | ✅ (high-trust apps only) | ❌ | ❌ |
| **Connection-scoped password grant**<br>*aka: `password-realm` (Auth0)* | Vendor extension to the password grant adding a `realm` parameter naming which directory or connection to authenticate against. | ✅ (first-party apps only) | ❌ | ❌ | ❌ |
| **Refresh token grant**<br>*aka: `offline_access` (all four)* | Exchanges a refresh token for a fresh access token with no user interaction, requested through the `offline_access` scope. | ✅ (all plans) | ✅ (org and custom AS) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **Device authorization grant (RFC 8628)**<br>*aka: Device Authorization Flow (Auth0), Device Authorization Grant (Okta), Device authorization grant (Clerk), `deviceAuthorization` (BA)* | Input-constrained devices (CLIs, TVs, consoles, IoT) display a short user code and verification URL; the user approves in a browser while the device polls the token endpoint. | ✅ (native apps; not third-party) | ✅ (requires a native OIDC app) | 🟡 (Beta, enabled by support) | ✅ (plugin: deviceAuthorization) |
| **Device grant issuing a resource-bound OAuth access token**<br>*aka: `oauthDeviceAuthorization()` (BA)* | Distinguishes a device flow that yields a first-class, audience-scoped OAuth access token from one that only yields a first-party session credential. Better Auth ships both modes and requires composing the OAuth provider plugin for the former. | ✅ (with device flow) | ✅ (with device flow) | ✅ (with device flow) | ✅ (plugin: oauth-provider) |
| **Token exchange (RFC 8693)**<br>*aka: Custom Token Exchange / On-Behalf-Of Token Exchange (Auth0), On-Behalf-Of Token Exchange (Okta)* | Accepts an externally issued `subject_token` at the token endpoint and returns a token from this authorization server, for cross-service delegation or migration from another IdP. Better Auth ships no token-exchange grant, but its provider extension API allows a plugin to register one. | ✅ (B2C/B2B Professional+) | ✅ (API Access Management) | ❌ | ❌ |
| **Delegation chain recorded in exchanged tokens**<br>*aka: `setActor()` / `act` claim (Auth0)* | Preserves who is acting on whose behalf across an exchange, nested to a documented depth, so downstream services can audit the delegation path. | ✅ (with token exchange) | ✅ (with token exchange) | ❌ | ❌ |
| **SAML 2.0 bearer assertion grant (RFC 7522)**<br>*aka: SAML 2.0 Assertion flow (Okta)* | Exchanges a signed SAML 2.0 assertion from an existing trust relationship for an OAuth access token, bridging a SAML federation into OAuth-protected APIs. | ❌ | ✅ (org and custom AS) | ❌ | ❌ |
| **JWT bearer assertion grant (RFC 7523)**<br>*aka: `ro/jwt-bearer` (Auth0)* | Exchanges a JWT assertion issued by a trusted party for an access token. Auth0 offers this only as a legacy grant restricted to tenants that existed before 8 June 2017; new tenants cannot enable it and are directed to Custom Token Exchange. | 🟡 (legacy tenants only) | ❌ | ❌ | ❌ |
| **Client-initiated backchannel authentication (CIBA)**<br>*aka: CIBA / `/bc-authorize` (Auth0), CIBA grant / transactional verification (Okta)* | Decoupled flow where the client's backend starts authentication and the user approves on a separate device, with no browser on the consuming device. Used for call-centre verification, payment confirmation and agent approvals. | ✅ (Enterprise; add-on below) | ✅ (custom authenticator + Devices SDK) | ❌ | ❌ |
| **Browserless native authentication at the token endpoint**<br>*aka: MFA grants / passwordless OTP grant (Auth0), Direct Authentication — OOB, MFA OOB, MFA OTP (Okta)* | Grant family letting a native client post credentials and factor responses straight to the token endpoint instead of opening a browser, including out-of-band factors as primary or second factor. | 🟡 (MFA and passwordless grants) | ✅ (Direct Authentication) | ❌ | ❌ |
| **Remediation-driven grant for embedded sign-in widgets**<br>*aka: Interaction Code grant (Okta)* | Extension grant where the app drives each authentication step itself, exchanging an interaction handle for remediation steps and finally an interaction code for tokens. | ❌ | 🟡 (Identity Engine; embedded widget) | ❌ | ❌ |
| **Legacy grants retained for migration**<br>*aka: Auth0 Legacy Grants / Delegation (Auth0), `/oob-authenticate` (Okta)* | Pre-OIDC grants and endpoints kept alive only for customers who already depended on them. Auth0's legacy grant set and `/delegation` endpoint are restricted to tenants created before 8 June 2017; Okta marks `/oob-authenticate` deprecated in its OAuth API reference. | 🟡 (pre-June-2017 tenants) | 🟡 (deprecated endpoint) | ❌ | ❌ |

### Client authentication methods

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **HTTP Basic client authentication (`client_secret_basic`)**<br>*aka: Client Secret (Auth0)* | Client sends `client_id:client_secret` base64-encoded in the Authorization header; the default for confidential clients on three of the four. | ✅ (all plans) | ✅ (default method) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **POST-body client authentication (`client_secret_post`)** | Client sends its id and secret as form parameters in the token request body. | ✅ (all plans) | ✅ (included) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **Shared-secret JWT client authentication (`client_secret_jwt`)** | Client authenticates with a JWT assertion signed symmetrically with the client secret (HS256/384/512), so the secret itself never crosses the wire. | ❌ | ✅ (secret ≥ 32 characters) | ❌ | ❌ |
| **Private key JWT client authentication (`private_key_jwt`, RFC 7523)**<br>*aka: Private Key JWT (Auth0)* | Client authenticates with a short-lived JWT assertion signed by its own private key, verified against a registered public key or JWKS URI; the authorization server never holds a shared secret. | ✅ (Enterprise plan) | ✅ (RSA or ECDSA) | ❌ | ✅ (plugin: oauth-provider) |
| **Client assertion replay protection** | Persists each assertion's `jti` so a replayed or concurrent assertion is rejected atomically, rather than only checking the signature and expiry. | ❔ (unverified) | ✅ (one-time-use `jti`) | ❌ | ✅ (plugin: oauth-provider) |
| **Mutual TLS client authentication (RFC 8705)**<br>*aka: mTLS for OAuth (Auth0)* | Authenticates the client with a CA-issued or self-signed X.509 certificate presented during the TLS handshake instead of any shared secret. Okta's client-authentication reference enumerates five methods and mTLS is not among them. | ✅ (Enterprise + HRI add-on) | ❌ | ❌ | ❌ |
| **Public client with no authentication (`none`)** | Marks SPAs, native apps and CLIs as public clients that send only a `client_id`, and restricts them from confidential-only grants. | ✅ (all plans) | ✅ (included) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **Client secret rotation with an overlap window** | Lets a client hold two valid secrets at once so it can roll credentials without downtime. Auth0 and Better Auth replace the secret immediately with no overlap; Auth0 does offer dual-key overlap for `private_key_jwt` and mTLS certificates. | 🟡 (no overlap for secrets) | ✅ (multiple client secrets) | ❔ (unverified) | 🟡 (no overlap window) |

### Protocol extensions

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Pushed Authorization Requests (RFC 9126)**<br>*aka: PAR (Auth0), `/par` (Okta)* | Client POSTs the authorization parameters back-channel and receives a `request_uri` to use at the authorize endpoint, keeping parameters out of the browser and out of logs. | ✅ (Enterprise + HRI add-on) | ✅ (included) | ❌ | ❌ |
| **JWT-Secured Authorization Request (RFC 9101)**<br>*aka: JAR / `signed_request_object` (Auth0), `request` parameter (Okta)* | Packages the authorization request parameters into a JWT signed by the client, so the authorization server can verify the request was not tampered with in the front channel. | ✅ (Enterprise + HRI add-on) | ✅ (HMAC, RSA or ECDSA) | ❌ | ❌ |
| **Rich Authorization Requests (RFC 9396)**<br>*aka: RAR / `authorization_details` (Auth0)* | Carries a structured JSON description of exactly what is being authorized (amount, payee, operation) instead of coarse scopes, and renders it on the consent prompt. | ✅ (Enterprise + HRI add-on) | ❌ | ❌ | ❌ |
| **DPoP sender-constrained tokens (RFC 9449)**<br>*aka: Demonstrating Proof-of-Possession (Auth0, Okta), `dpop` option (BA)* | Binds access and refresh tokens to a client-held key pair via a signed proof JWT, recorded in the token's `cnf.jkt`, so a stolen token cannot be replayed by another party. | ✅ (Enterprise plans) | ✅ (included) | ❌ | ✅ (plugin: oauth-provider) |
| **DPoP proof replay protection across server instances**<br>*aka: Server-issued nonce (Auth0), `dpop.replayStore` (BA)* | Rejects a reused DPoP proof even when the second request lands on a different node, via a shared nonce or a database-backed `jti` store rather than per-process memory. | ✅ (nonce required, public clients) | ❔ (unverified) | ❌ | ✅ (plugin: oauth-provider) |
| **Certificate-bound access tokens (RFC 8705)**<br>*aka: mTLS Sender Constraining / Token Binding (Auth0)* | Embeds the SHA-256 thumbprint of the client's certificate in the token's `cnf` claim so a resource server rejects the token unless the same certificate terminates the connection. | ✅ (Enterprise + HRI add-on) | ❌ | ❌ | ❌ |
| **Resource indicators (RFC 8707)**<br>*aka: Resource Parameter Compatibility Profile (Auth0), `resources` option (BA)* | Standards-compliant `resource` parameter naming the protected resource a token is for, which becomes the token's audience. Auth0 and Okta historically scope tokens with a proprietary `audience` parameter instead; Auth0 added `resource` behind a tenant profile because the MCP authorization spec requires it. | ✅ (tenant toggle) | ❌ | ❌ | ✅ (plugin: oauth-provider) |
| **Authorization server issuer identification (RFC 9207)**<br>*aka: Include Issuer in Authorization Responses (Auth0)* | Returns an `iss` parameter on every authorization response, success or error, so a client with several configured providers can detect a mix-up attack. | ✅ (tenant toggle) | ❔ (unverified) | ❔ (unverified) | ✅ (plugin: oauth-provider) |
| **Pairwise subject identifiers**<br>*aka: `subject_type: "pairwise"` (BA)* | Gives each client a different, unlinkable `sub` for the same user, computed from a sector identifier, so colluding relying parties cannot correlate users. | ❌ | ❌ | ❌ | ✅ (plugin: oauth-provider) |
| **Extension API for adding grants and client-auth methods**<br>*aka: `extendOAuthProvider()` (BA)* | Documented interface for a third-party plugin to register a new token grant, an assertion-based client authentication method, additive discovery metadata or a client-discovery source, without forking the provider. Auth0 and Okta extend behaviour through hooks on existing grants rather than by adding grants. | ❌ | ❌ | ❌ | ✅ (plugin: oauth-provider) |

### Client registration, discovery and metadata

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Dynamic Client Registration (RFC 7591 / OIDC DCR)**<br>*aka: DCR — `/oidc/register` (Auth0), `/oauth2/v1/clients` (Okta), Publish DCR support (Clerk), `allowDynamicClientRegistration` (BA)* | Programmatic endpoint where a client self-registers with metadata and receives a `client_id` and, for confidential clients, a one-time secret. Off by default on all four. | 🟡 (per-tenant flag, off by default) | ✅ (included) | ✅ (opt-in per instance) | ✅ (plugin: oauth-provider) |
| **Unauthenticated (open) client registration**<br>*aka: Open Dynamic Registration (Auth0), `allowUnauthenticatedClientRegistration` (BA)* | Allows an anonymous caller to register a client with no initial access token or session — the mode MCP clients historically relied on. All vendors that offer it document the abuse trade-off. | ✅ (with DCR enabled) | ❔ (unverified) | ✅ (with DCR enabled) | ✅ (plugin: oauth-provider) |
| **Initial-access-token-protected registration**<br>*aka: `validateInitialAccessToken()` (BA)* | RFC 7591 registration gated by a bearer token the operator issues out of band, so machine callers can self-register without opening the endpoint to the public. | ❌ | ❔ (unverified) | ❌ | ✅ (plugin: oauth-provider) |
| **Hardened defaults for self-registered clients**<br>*aka: Enhanced Security Controls for Third-Party Applications (Auth0), `clientRegistrationAllowedScopes` (BA)* | Forces self-registered clients into a restricted profile: mandatory PKCE, a limited grant set, a scope and resource allowlist, and no ability to set privileged fields such as consent-skipping or machine-scope ceilings. | ✅ (GA; DCR clients) | ❌ | 🟡 (forces consent screen) | ✅ (plugin: oauth-provider) |
| **Client ID Metadata Documents (CIMD)**<br>*aka: Register Applications with CIMD (Auth0), CIMD registration (Okta), CIMD (Clerk), `cimd` plugin (BA)* | A client identifies itself by an HTTPS URL that is both its `client_id` and the location of its metadata document, which the authorization server fetches and validates — no registration write endpoint, no stored secret. Implements an unfinished IETF draft that MCP's 2026-07-28 revision prefers over DCR. All four now ship it, at very different maturity. | ✅ (tier unknown) | ✅ (AI agent registration) | 🟡 (Beta, enabled by support) | ✅ (plugin: cimd) |
| **Operator policy over which CIMD clients are admitted**<br>*aka: Client admission (Clerk), `isMetadataDocumentUrlAllowed()` (BA)* | Restricts URL-identified clients to an allowlist, a pre-registered set or previously connected clients, with per-client allow/block status and controls over metadata refresh. | ❔ (unverified) | ❔ (unverified) | ✅ (Beta; three admission modes) | ✅ (plugin: cimd) |
| **Administrative client management API**<br>*aka: Applications API (Auth0), Apps API (Okta), `adminCreateOAuthClient()` (BA)* | Server-side create/read/update/delete for OAuth clients, including privileged fields that self-registration cannot set. | ✅ (all plans) | ✅ (included) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **OAuth clients owned by an end user or an organization**<br>*aka: `clientReference()` / `POST /oauth2/create-client` (BA)* | Lets a signed-in user or an organization register and manage its own OAuth clients through the product's API, with ownership bound at registration and a policy callback deciding who may do what. Needed to build a developer portal on top of the authorization server. | ❌ | ❌ | ❌ | ✅ (plugin: oauth-provider) |
| **OpenID Connect discovery document**<br>*aka: `/.well-known/openid-configuration` (all four)* | Publishes endpoint locations, supported scopes, response types and claims so client SDKs self-configure. | ✅ (all plans) | ✅ (org and custom AS) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **OAuth 2.0 authorization server metadata (RFC 8414)**<br>*aka: `/.well-known/oauth-authorization-server` (all four)* | The OAuth-only metadata document, which MCP and other non-OIDC clients look for, published alongside the OIDC discovery document. | ✅ (all plans) | ✅ (custom AS) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **Control over what discovery advertises**<br>*aka: per-scope metadata publication (Okta), `advertisedMetadata` (BA)* | Lets the publicized scope and claim lists differ from what the server can actually issue — used to hide internal scopes or to advertise a narrower surface to unknown clients. | ❌ | 🟡 (per-scope publication flag) | ❌ | ✅ (plugin: oauth-provider) |

### Scopes, consent and resource targeting

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Custom scope catalog**<br>*aka: API permissions/scopes (Auth0), Authorization Server Scopes API (Okta), Custom scopes (Clerk), `scopes` option (BA)* | Defines the application-specific scopes the authorization server will issue beyond the OIDC built-ins, and which clients may request each one. | ✅ (all plans) | 🟡 (API Access Management) | ✅ (all plans) | ✅ (plugin: oauth-provider) |
| **Consent requirement enforced for third-party clients**<br>*aka: User Consent and Third-Party Applications (Auth0), User consent for OAuth scopes (Okta), Consent screen management (Clerk), `consentPage` (BA)* | Policy that a client not owned by the tenant cannot receive a token until the user approves the requested scopes. Better Auth enforces the protocol step but the application supplies the page. | ✅ (all plans) | ✅ (`consent_method` per app) | ✅ (default on per app) | 🟡 (app renders the page) |
| **Per-scope consent configuration**<br>*aka: `consent` — REQUIRED / IMPLICIT / FLEXIBLE (Okta)* | Marks individual scopes as always requiring consent, never requiring it, or deferring to the application, rather than treating consent as a single per-client switch. | ❌ | ✅ (API Access Management) | ❌ | ❌ |
| **Trusted first-party clients that skip consent**<br>*aka: First-party applications (Auth0), `consent_method: TRUSTED` (Okta), `skip_consent` (BA)* | Marks a client as owned by the same party as the authorization server so no consent prompt is shown. Better Auth restricts the flag to admin-managed creation and can pin the list in memory. | ✅ (all plans) | ✅ (included) | ✅ (per-app toggle) | ✅ (plugin: oauth-provider) |
| **Stored consent grants that can be listed and revoked**<br>*aka: Grants API (Auth0), User Grants API (Okta), `oauthConsent` table (BA)* | Persists each user's grant per client, independently of the tokens it produced, so a user or administrator can review and revoke past authorizations. | ✅ (all plans) | ✅ (included) | ❔ (unverified) | ✅ (plugin: oauth-provider) |
| **User narrows the granted scopes at consent time**<br>*aka: `oauth2.consent({ accept, scope, claims })` (BA)* | Lets the user approve a subset of the requested scopes or claims rather than only accepting or denying the whole request. | ❌ | ❌ | ❌ | ✅ (plugin: oauth-provider) |
| **Organization or tenant chosen during the authorization flow**<br>*aka: `user:org:read` / Organization selector (Clerk), `postLogin.consentReferenceId()` (BA)* | Inserts a step where the user picks which organization the authorization applies to, and binds that reference into the consent record and the issued token. | 🟡 (organization prompt at login) | ❌ | ✅ (Organizations enabled) | ✅ (plugin: oauth-provider) |
| **Application-to-API access policy**<br>*aka: Client Grants / Application Access to APIs (Auth0), Authorization Server Policies (Okta), `clientRegistrationAllowedScopes` + `resources` (BA)* | Declares which clients may obtain tokens for which API or resource and with which scopes, separately from what the user consents to. | ✅ (all plans) | ✅ (API Access Management) | 🟡 (per-app scope assignment) | ✅ (plugin: oauth-provider) |

### Conformance profiles and certification

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **FAPI conformance profile enforcement**<br>*aka: FAPI Compliance Enforcement Level / `compliance_level` (Auth0)* | Per-application switch that enforces a certified financial-grade profile (FAPI 1.0 Advanced or FAPI 2.0 Security Profile) end to end: mandatory PAR, S256 PKCE, JAR with PS256, mTLS or `private_key_jwt`, no wildcard callbacks, shortened code lifetimes. Okta lacks the mTLS client authentication FAPI 1.0 Advanced and FAPI 2.0 require. | ✅ (Enterprise + HRI add-on) | ❌ | ❌ | ❌ |
| **Regulated-finance identity bundle**<br>*aka: Highly Regulated Identity — HRI (Auth0)* | Packaged SKU grouping the FAPI profiles with strong customer authentication, dynamic linking via RAR, front-channel confidentiality (PAR/JAR), token encryption, strong client authentication and transactional approval. | ✅ (Enterprise add-on) | ❌ | ❌ | ❌ |
| **Documented path through the OpenID FAPI conformance suite**<br>*aka: Configure Auth0 to Pass OpenID FAPI Certification Tests (Auth0)* | Vendor-published configuration recipe for running the OpenID Foundation conformance tests against a customer's own tenant, which a regulated deployment usually has to evidence itself. | ✅ (Enterprise + HRI add-on) | ❌ | ❌ | ❌ |
| **OpenID Connect provider certification** | Whether the product's OpenID Provider implementation has been certified against an OpenID Foundation conformance profile, as opposed to merely implementing the specification. | ✅ (certified OP) | ✅ (certified OP) | ❔ (unverified) | ❔ (unverified) |
| **OAuth 2.1-aligned defaults**<br>*aka: Enhanced Security Controls (Auth0), OAuth 2.1 Provider (BA)* | Ships the OAuth 2.1 posture by default: no implicit or password grants, PKCE required, exact redirect matching, `code` response type only. Auth0 applies this profile to third-party applications while first-party applications keep the older grants; Okta leaves the legacy grants available per application. | 🟡 (third-party applications only) | ❌ | ✅ (all plans) | ✅ (plugin: oauth-provider) |

---

## 07. Tokens, claims & session management

What each product issues after a successful authentication, and how that credential is maintained, inspected and ended. Auth0 and Okta are OAuth/OIDC authorization servers whose primary artifact is a token set plus a provider-side SSO cookie; Clerk issues a very short-lived session JWT refreshed from a long-lived client cookie; Better Auth keeps an opaque, database-backed session cookie and adds token issuance through plugins. The sharpest divergences are token introspection (absent from Auth0), signing-algorithm choice (fixed on Clerk, widest on Better Auth), and how much session lifetime and revocation control sits behind a paid tier.

### Token types and formats

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **ID token**<br>*aka: ID Token (Auth0), OIDC ID token (Okta)* | Signed JWT asserting who authenticated, carrying `iss`, `sub`, `aud`, `exp`, `sid` and scope-gated profile claims. | ✅ (Free and up) | ✅ (all plans) | 🟡 (OAuth applications only) | 🟡 (plugin: oauthProvider) |
| **JWT access token for a registered audience**<br>*aka: Access Token (Auth0), access token from a custom authorization server (Okta)* | Self-contained token minted for a named API/resource identifier, carrying granted scopes and verifiable without calling the issuer. | ✅ (Free and up) | 🟡 (API Access Management) | 🟡 (OAuth applications only) | 🟡 (plugin: oauthProvider) |
| **Issuer-validated (opaque) access token**<br>*aka: Opaque Access Token (Auth0), opaque token format (Clerk)* | Non-parseable token the resource server cannot verify locally; validity is resolved by calling back to the issuer, which makes instant revocation possible. | ✅ (Free and up) | 🟡 (org-server tokens only) | ✅ (Free) | 🟡 (plugin: oauthProvider) |
| **Per-client token format selection**<br>*aka: Access token format (Clerk), `disableJwtPlugin` (BA)* | An explicit setting choosing whether a given client receives self-contained JWTs or opaque strings, trading networkless verification against instant revocation. | 🟡 (implied by API audience) | ❌ | ✅ (per OAuth application) | 🟡 (plugin: oauthProvider) |
| **RFC 9068 access-token profile**<br>*aka: Access Token Profiles / token dialects (Auth0)* | Choice of the claim and header layout of a JWT access token, including `typ: at+jwt`, `client_id` versus `azp`, and presence of `jti`. | ✅ (per API setting) | ❔ (unverified) | ❌ | 🟡 (plugin: oauthProvider, RFC 9068 only) |
| **Encrypted tokens (JWE)**<br>*aka: JSON Web Encryption for access tokens (Auth0), token encryption keys (Okta)* | Wraps a signed token in RFC 7516 encryption so only the intended resource server can read its claims, using a public key registered for the client or API. | 🟡 (Highly Regulated Identity add-on) | 🟡 (API Access Management) | ❌ | 🟡 (session cookie only) |
| **Refresh token**<br>*aka: Refresh Token (Auth0, Okta)* | Long-lived credential obtained with `offline_access` that mints new access tokens without user interaction. | ✅ (Free and up) | ✅ (all plans) | ✅ (OAuth applications) | 🟡 (plugin: oauthProvider) |
| **Session-representing JWT for first-party backends**<br>*aka: Session token / `__session` (Clerk), `authClient.token()` (BA)* | Short-lived signed JWT that stands for the current browser session and is presented to the application's own services, distinct from an OAuth access token for a third party. | 🟡 (SDK passes ID/access token) | 🟡 (SDK passes ID/access token) | ✅ (Free) | 🟡 (plugin: jwt) |

### Token contents and claims

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Custom claims**<br>*aka: Create Custom Claims via Actions (Auth0), Authorization Server Claims (Okta), Customize session token (Clerk), `definePayload` / `customAccessTokenClaims` (BA)* | Adds application-defined key/values to issued tokens so the consumer can act on them without a round trip to the identity provider. | ✅ (Free and up) | ✅ (API Access Management for access tokens) | ✅ (Free) | ✅ (Core) |
| **Non-namespaced custom claims** | Whether a custom claim may use a plain name rather than being forced under a collision-resistant URI namespace. | ❌ | ✅ (all plans) | ✅ (Free) | ✅ (Core) |
| **Expression or template language for claim values**<br>*aka: Okta Expression Language (Okta), shortcodes (Clerk)* | Declarative syntax that computes a claim value from the user profile, session or context without writing deployed code. | 🟡 (JavaScript Actions) | ✅ (all plans) | ✅ (Free) | 🟡 (TypeScript callback) |
| **JWT templates for third-party services**<br>*aka: JWT templates (Clerk)* | Named, reusable claim sets used to mint a token shaped for an external consumer (a database, a backend-as-a-service) alongside the normal session credential. | ❌ | ❌ | ✅ (Free) | 🟡 (plugin: jwt, single payload) |
| **Prebuilt third-party template library**<br>*aka: Integrations (Clerk)* | Ready-made templates for well-known consumers so the claim shape does not have to be researched per service. | ❌ | ❌ | ✅ (Free) | ❌ |
| **Typed claims for the application language**<br>*aka: `CustomJwtSessionClaims` (Clerk)* | A declared type for custom claims so consuming code gets completion and compile-time checking. | ❌ | ❌ | ✅ (Free) | ✅ (Core) |
| **Cookie-bound claim size ceiling**<br>*aka: Size limitations (Clerk)* | A documented ceiling on custom claim volume because the credential is carried in a browser cookie capped near 4KB; exceeding it breaks the cookie. | ➖ (tokens not cookie-bound) | ➖ (tokens not cookie-bound) | ✅ (~1.2KB documented) | 🟡 (session cache cookie only) |
| **Per-audience claim sets** | Different claims for different resource servers, rather than one claim set for every token the user receives. | ✅ (per registered API) | ✅ (API Access Management) | ✅ (per JWT template) | 🟡 (plugin: oauthProvider per-resource claims) |

### Signing keys and verification

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **JWKS endpoint**<br>*aka: `/keys` (Okta), `/.well-known/jwks.json` (Clerk, BA)* | Publishes the public keys so any service can verify issued tokens locally instead of calling the issuer per request. | ✅ (Free and up) | ✅ (all plans) | ✅ (Free) | 🟡 (plugin: jwt) |
| **Signing algorithm selection** | Choice of the algorithm and key type used to sign tokens (for example RS256, PS256, ES256, EdDSA, or a shared-secret HS256). | 🟡 (RS256, PS256, HS256 only) | ❌ | ❌ | ✅ (plugin: jwt) |
| **Automatic signing key rotation**<br>*aka: Key rotation (Okta), managed JWKS (Clerk), `jwks.rotationInterval` (BA)* | The issuer replaces its signing key pair on a schedule and keeps the previous key published long enough for in-flight tokens to verify. | ❌ | ✅ (all plans) | ✅ (Free) | 🟡 (plugin: jwt, off by default) |
| **Operator-triggered key rotation**<br>*aka: Manage Signing Keys (Auth0), Authorization Server Keys API (Okta)* | An administrator can force a rotation immediately, for example after a suspected compromise. | ✅ (Free and up) | ✅ (API Access Management) | 🟡 (rotation signs out all users) | 🟡 (plugin: jwt) |
| **Control over private key storage and signing**<br>*aka: private key encryption, custom `jwt.sign`, custom JWKS adapter (BA)* | The deployment decides where the private key lives and can delegate signing to an external key management service. | ➖ (managed service) | ➖ (managed service) | ➖ (managed service) | ✅ (plugin: jwt) |
| **Custom or remote JWKS location**<br>*aka: `jwks.jwksPath` / `jwks.remoteUrl` (BA)* | The key set can be served from a chosen path or delegated entirely to an external URL that discovery documents then advertise. | ❌ | ❌ | ❌ | ✅ (plugin: jwt) |

### Token lifetime, introspection and revocation

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Configurable access and ID token lifetime** | Per-client or per-API control of how long an issued token stays valid. | ✅ (per API and application) | 🟡 (API Access Management; ID token fixed) | 🟡 (JWT templates; OAuth fixed at 1 day) | 🟡 (plugin: oauthProvider) |
| **Configurable refresh token expiry**<br>*aka: Configure Refresh Token Expiration (Auth0), refresh token idle/absolute lifetime (Okta)* | Separate absolute and inactivity lifetimes for refresh tokens. | ✅ (Free and up) | 🟡 (API Access Management; org server fixed 90 days) | ❌ | 🟡 (plugin: oauthProvider) |
| **Refresh token rotation**<br>*aka: Refresh Token Rotation (Auth0), Refresh token rotation (Okta)* | Each exchange returns a new refresh token and invalidates the presented one. | ✅ (Free and up) | ✅ (all plans) | ❔ (unverified) | 🟡 (plugin: oauthProvider, always on) |
| **Rotation reuse detection**<br>*aka: Automatic Reuse Detection (Auth0)* | Presenting an already-consumed refresh token invalidates the whole token family and raises an event, per the OAuth security best current practice. | ✅ (Free and up) | 🟡 (grace-period based) | ❔ (unverified) | 🟡 (plugin: oauthProvider) |
| **Replay grace window for rotated tokens**<br>*aka: reuse interval / leeway (Auth0), grace period (Okta), `refreshTokenReuseInterval` (BA)* | A short interval in which a just-rotated refresh token still returns the same response, so retries and lost responses do not trip reuse detection. | ✅ (Free and up) | ✅ (all plans) | ❌ | 🟡 (plugin: oauthProvider) |
| **Token revocation endpoint (RFC 7009)**<br>*aka: `/oauth/revoke` (Auth0), `/revoke` (Okta)* | Standard endpoint letting a client invalidate an issued access or refresh token before it expires. | ✅ (Free and up) | ✅ (all plans) | 🟡 (Backend API call, not RFC 7009) | 🟡 (plugin: oauthProvider) |
| **Token introspection (RFC 7662)**<br>*aka: `/introspect` (Okta), `/oauth/token_info` (Clerk)* | Standard endpoint where a resource server asks the issuer whether a token is active and what metadata it carries. | ❌ | ✅ (all plans) | ✅ (Free) | 🟡 (plugin: oauthProvider) |
| **One refresh token covering several APIs**<br>*aka: Multi-Resource Refresh Token, MRRT (Auth0)* | A single refresh token can be exchanged for access tokens targeting different registered resource servers, each with its own scopes. | ✅ (GA; first-party applications) | ❌ | ❌ | 🟡 (plugin: RFC 8707 resources) |
| **Session-bound refresh tokens**<br>*aka: Online Refresh Tokens, `online_access` (Auth0)* | Refresh tokens tied to the provider session: they do not rotate, extend the session idle timeout, and die when the session ends. | 🟡 (Beta) | ❌ | ➖ (tokens always session-bound) | ❌ |
| **Refresh token metadata**<br>*aka: Refresh Token Metadata (Auth0)* | Custom key/value pairs stored on a refresh token that survive rotation and are readable at exchange time, for device names or token-level flags. | ✅ (GA) | ❌ | ❌ | ❌ |
| **Policy re-evaluation at refresh time**<br>*aka: Manage Refresh Tokens with Actions (Auth0)* | Inspecting request context when a refresh token is exchanged, and shortening or refusing the new token if conditions changed. | 🟡 (Enterprise: Continuous Session Protection) | ✅ (API Access Management policies) | 🟡 (upstream account checks for federated users) | 🟡 (custom hooks) |

### Session representation and storage

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Server-side session record**<br>*aka: Auth0 session layer / SSO cookie (Auth0), Okta session (Okta), `session` model (BA)* | The authoritative session lives on the server and the browser holds only an identifier, so a session can be ended centrally. | ✅ (Free and up) | ✅ (all plans) | ✅ (Free) | ✅ (Core) |
| **Stateless cookie-only session**<br>*aka: stateless mode (BA), session token in `__session` (Clerk)* | Session state is carried entirely in a signed or encrypted cookie and validated without any datastore read. | 🟡 (SDK-managed encrypted cookie) | 🟡 (SDK-managed token cookie) | ✅ (Free) | ✅ (Core) |
| **Secondary key-value session storage**<br>*aka: `secondaryStorage`, `storeSessionInDatabase` (BA)* | Sessions can be kept in a key-value store such as Redis instead of, or alongside, the relational database. | ➖ (managed service) | ➖ (managed service) | ➖ (managed service) | ✅ (Core) |
| **Cached session snapshot to skip a lookup**<br>*aka: cookie cache / `session_data` (BA), 60-second session token (Clerk)* | A short-lived cached copy of the session lets most requests be authorized without hitting the session store; revocation lags by the cache window. | 🟡 (SDK session cookie) | 🟡 (SDK session cookie) | ✅ (Free) | ✅ (Core) |
| **Cache encoding and encryption choice**<br>*aka: `cookieCache.strategy` — compact, jwt, jwe (BA)* | Choice of how the cached session is encoded and whether it is merely signed or fully encrypted, including signing it with asymmetric keys for JWKS verification. | ❌ | ❌ | ❌ | ✅ (Core; jwt strategy needs plugin) |
| **Forced fresh session read**<br>*aka: `disableCookieCache` (BA), `getToken({ skipCache: true })` (Clerk)* | A caller can bypass the cache for one request when stale revocation state is unacceptable. | ➖ (no client-side cache) | ➖ (no client-side cache) | ✅ (Free) | ✅ (Core) |
| **Custom fields on the session record**<br>*aka: Session Metadata (Auth0), `additionalFields` / `updateSession` (BA)* | Application-defined key/values stored on the session itself and readable wherever the session is read. | 🟡 (Enterprise, GA) | ❌ | ❌ | ✅ (Core) |
| **IP address and device recorded per session** | Each session stores the originating address and user agent so a device list can be shown and anomalies spotted. | 🟡 (Enterprise Session Management API) | ✅ (all plans) | ✅ (Free) | ✅ (Core) |
| **Revoked sessions retained for audit**<br>*aka: `preserveSessionInDatabase` (BA), session status (Clerk)* | Ended sessions remain queryable rather than being deleted, so revocation history survives. | ❌ | ❌ | ✅ (Free) | ✅ (Core) |
| **Bulk invalidation of stateless sessions**<br>*aka: `cookieCache.version` (BA)* | Bumping a version string on deploy invalidates every outstanding cookie-carried session at once. | ❌ | ❌ | ❌ | ✅ (Core) |

### Session lifetime and freshness

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Absolute session lifetime**<br>*aka: session/maximum lifetime (Auth0), Maximum Okta global session lifetime (Okta), Maximum lifetime (Clerk), `session.expiresIn` (BA)* | Hard cap after which the session ends regardless of activity. | ✅ (Free and up) | ✅ (Starter and up) | 🟡 (7-day default free; custom values Pro) | ✅ (Core) |
| **Idle / inactivity timeout**<br>*aka: idle session lifetime (Auth0), Maximum Okta global session idle time (Okta), Inactivity timeout (Clerk)* | Session ends after a period with no activity, independent of the absolute cap. | ✅ (Free and up) | ✅ (Starter and up) | 🟡 (Pro; free in development) | ✅ (Core) |
| **Sliding extension on use**<br>*aka: `session.updateAge` (BA)* | An active session's expiry is pushed forward as it is used, up to any absolute cap. | ✅ (Free and up) | ✅ (Starter and up) | 🟡 (inactivity window only) | ✅ (Core) |
| **Session-policy container with conditions**<br>*aka: Global session policy, formerly Okta Sign-On Policy (Okta)* | Lifetime and persistence settings expressed as ordered policy rules that can differ per group, network or risk level rather than one tenant-wide value. | 🟡 (via post-login Actions) | ✅ (Starter; conditions need Adaptive MFA) | ❌ | 🟡 (custom code) |
| **Persistent versus browser-session cookie**<br>*aka: Keep Me Signed In / ephemeral sessions (Auth0), session cookies persist across browser sessions (Okta), `rememberMe` / `dont_remember` (BA)* | Whether the session survives a browser restart, optionally as a user-facing choice at sign-in. | ✅ (Free and up) | ✅ (Starter and up) | ❌ | ✅ (Core) |
| **Per-login lifetime override**<br>*aka: `api.session.setExpiresAt` / `setIdleExpiresAt` (Auth0)* | Code or policy evaluated during a single login can shorten or extend that session's timeouts. | ✅ (GA) | ✅ (per policy rule) | 🟡 (impersonated sessions only) | 🟡 (custom hooks) |
| **Session-age gate on sensitive operations**<br>*aka: `session.freshAge` (BA), My Account API default policy (Auth0), re-authentication frequency (Okta), reverification (Clerk)* | Endpoints that only accept a session authenticated within a recent window, forcing a re-login for account-critical actions. | 🟡 (release-stage gated) | 🟡 (Adaptive MFA) | 🟡 (built-in reverification) | ✅ (Core) |
| **Read-replica-safe session refresh**<br>*aka: `session.deferSessionRefresh` (BA)* | Session reads stay write-free and signal that a follow-up write is needed, so reads can be served by a replica. | ➖ (managed service) | ➖ (managed service) | ➖ (managed service) | ✅ (Core) |

### Session inventory and revocation

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Session listing for the signed-in user**<br>*aka: Session Management API (Auth0), MyAccount Sessions (Okta), `listSessions` (BA)* | The user (or their app) can enumerate their active sessions with device detail, for a device-management screen. | 🟡 (Enterprise plans) | ✅ (all plans) | ✅ (Free) | ✅ (Core) |
| **Revoke one named session** | Ending a single session by identifier, leaving the others alive. | 🟡 (Enterprise plans) | ✅ (all plans) | ✅ (Free) | ✅ (Core) |
| **Revoke every other session**<br>*aka: `revokeOtherSessions` (BA), `signOutOfOtherSessions` (Clerk), Delete all Stay-signed-in sessions (Okta)* | One call ends all of the user's sessions except the current one. | 🟡 (Enterprise plans) | ✅ (all plans) | ✅ (Free) | ✅ (Core) |
| **Administrative revocation of another user's sessions** | An operator or support tool ends sessions belonging to a user they are not signed in as. | 🟡 (Enterprise plans) | ✅ (all plans) | ✅ (Free) | 🟡 (plugin: admin) |
| **Session revocation on password change or reset**<br>*aka: `revokeSessionsOnPasswordReset` (BA), back-channel logout initiators (Auth0)* | Changing or resetting the password automatically invalidates sessions established with the old credential. | 🟡 (via back-channel logout initiators) | 🟡 (manual clear-sessions call) | ✅ (Free) | ✅ (Core; opt-in) |
| **Several accounts signed in simultaneously**<br>*aka: Multi-session handling (Clerk), multiSession plugin (BA)* | One browser holds live sessions for more than one account at a time. | ❌ | ❌ | 🟡 (Pro) | 🟡 (plugin: multiSession) |
| **Active-account switching**<br>*aka: `setActive()` / `useSessionList()` (Clerk), `multiSession.setActive` (BA)* | Promoting one of the browser's stored sessions to be the active one without a new sign-in. | ❌ | ❌ | ✅ (Free) | 🟡 (plugin: multiSession) |
| **Per-device concurrent session cap**<br>*aka: `maximumSessions` (BA)* | A configured ceiling on how many accounts may be signed in on one device. | ❌ | ❌ | ❌ | 🟡 (plugin: multiSession) |
| **Impersonation sessions**<br>*aka: Session Delegation (Auth0), actor tokens / user impersonation (Clerk), `admin.impersonateUser` (BA)* | An authorized operator obtains a time-boxed session acting as another user, with the impersonator recorded (typically an `act` claim). | 🟡 (B2C/B2B Professional and Enterprise) | ❌ | 🟡 (5/month free; Administration add-on) | 🟡 (plugin: admin) |
| **In-session risk re-evaluation**<br>*aka: Continuous Session Protection (Auth0), session protection policy / Identity Threat Protection (Okta)* | An established session is re-assessed against context changes and can be re-challenged or terminated mid-life. | 🟡 (Enterprise plan) | 🟡 (Identity Threat Protection SKU) | ❌ | 🟡 (custom hooks) |

### Cookies and cross-domain sessions

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Cookie name and attribute configuration**<br>*aka: `advanced.cookies` / `defaultCookieAttributes` / `useSecureCookies` (BA)* | The deployment sets cookie names, `SameSite`, `Secure`, `Partitioned` and related attributes per cookie. | ❌ | ❌ | ❌ | ✅ (Core) |
| **Cross-subdomain session cookie**<br>*aka: `crossSubDomainCookies` (BA), Allowed Subdomains (Clerk)* | One session cookie scoped to a parent domain so sibling subdomains share it. | ✅ (custom domain) | ✅ (custom domain) | ✅ (Free) | ✅ (Core) |
| **Session shared across separate registrable domains**<br>*aka: Satellite domains (Clerk), Manage Multi-Site Sessions (Auth0)* | One signed-in state spanning domains that cannot share a cookie, via a primary/satellite or provider-hosted-cookie model. | ✅ (SSO cookie at the provider) | ✅ (SSO cookie at the provider) | 🟡 (paid in production) | 🟡 (plugin: oneTimeToken or proxy) |
| **First-party auth cookie on the customer's own domain**<br>*aka: custom domain (Auth0, Okta, Clerk), reverse-proxy pattern (BA)* | Serving the authentication endpoints from the application's own domain so the session cookie is first-party and survives tracking prevention. | 🟡 (custom domain; paid plans) | ✅ (custom domain) | ✅ (production custom domain) | ✅ (Core) |
| **Session credential accepted in an Authorization header**<br>*aka: bearer plugin / `set-auth-token` (BA)* | Non-browser clients present the session credential as a header instead of a cookie. | ➖ (token-based by design) | ➖ (token-based by design) | ✅ (Free) | 🟡 (plugin: bearer) |
| **Single-use token for handing a session to another context**<br>*aka: Session Transfer Token (Auth0), session token (Okta), sign-in tokens (Clerk), oneTimeToken plugin (BA)* | A short-lived, single-use credential minted from an existing session and redeemed elsewhere to establish the same signed-in state. | 🟡 (Enterprise plan) | ✅ (all plans) | ✅ (Free) | 🟡 (plugin: oneTimeToken) |
| **Native-app to browser session handoff**<br>*aka: Native to Web SSO (Auth0)* | A mobile app's credential is exchanged for a device-bound token that continues the same session in a browser or web view, with cascaded revocation. | 🟡 (Enterprise plan) | 🟡 (session-token pattern) | ❌ | ❌ |
| **Session state propagated to a browser extension**<br>*aka: Sync Host (Clerk)* | Authentication established on a website is carried into a companion browser extension. | ❌ | ❌ | ✅ (Free) | ❌ |

### Single sign-on and logout

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Single sign-on across applications**<br>*aka: SSO cookie / Cross-App SSO (Auth0), Okta session (Okta)* | One authentication at the provider satisfies subsequent sign-ins to other applications registered with it. | 🟡 (cross-app SSO on Professional and up) | ✅ (all plans) | 🟡 (one instance per app; satellite domains) | 🟡 (plugin: oauthProvider) |
| **Silent session check without UI**<br>*aka: `prompt=none` / `checkSession` (Auth0), token refresh and handshake (Clerk)* | An application determines whether a session is still live and obtains fresh credentials without rendering any interface. | ✅ (Free and up) | ✅ (all plans) | ✅ (Free) | ✅ (Core) |
| **Forced re-authentication**<br>*aka: `max_age` / `prompt=login` (Auth0), re-authentication frequency (Okta), reverification (Clerk)* | A request that requires the user to authenticate again if the existing authentication is older than a given age. | ✅ (Free and up) | ✅ (Adaptive MFA for policy control) | 🟡 (reverification only) | 🟡 (custom code) |
| **Programmatic sign-out**<br>*aka: `/v2/logout` (Auth0), Sessions API (Okta), `signOut()` (Clerk, BA)* | An API or client call that ends the current session immediately. | ✅ (Free and up) | ✅ (all plans) | ✅ (Free) | ✅ (Core) |
| **RP-initiated logout endpoint (OIDC)**<br>*aka: `/oidc/logout` (Auth0), `/logout` (Okta), `/oauth2/end-session` (BA)* | Standards-based endpoint where a relying party sends the user to end the provider session, with `id_token_hint` and a redirect back. | ✅ (Free and up) | ✅ (all plans) | ❌ | 🟡 (plugin: oauthProvider) |
| **Post-logout redirect allowlist**<br>*aka: Allowed Logout URLs (Auth0), sign-out redirect URIs (Okta)* | Only pre-registered URLs are accepted as the destination after logout, preventing open redirects. | ✅ (Free and up) | ✅ (all plans) | ✅ (Free) | ✅ (Core trusted origins) |
| **Federated logout to the upstream identity provider**<br>*aka: `federated` parameter (Auth0)* | Logout is propagated to the external provider that authenticated the user, ending that session layer too. | ✅ (OIDC and Okta connections) | ✅ (all plans) | ❌ | ❌ |
| **SAML Single Logout**<br>*aka: Single Logout, SLO (Okta)* | SAML-native logout propagation between the identity provider and service providers. | 🟡 (SAML addon) | ✅ (all plans) | ❌ | ❌ |
| **OIDC back-channel logout**<br>*aka: OIDC Back-Channel Logout (Auth0), Back-Channel Logout (BA)* | When a session ends, the provider POSTs a signed logout token carrying `sub` and `sid` to each registered application so it can end its own session. | 🟡 (Enterprise plan) | ❌ | ❌ | 🟡 (plugin: oauthProvider) |
| **Configurable back-channel logout triggers**<br>*aka: OIDC Back-Channel Logout Initiators (Auth0)* | Choosing which events (explicit logout, session revocation, password change) emit logout notifications. | 🟡 (with Enterprise back-channel logout) | ❌ | ❌ | 🟡 (plugin: all session-end paths) |
| **Global logout across every application and token**<br>*aka: Universal Logout (Auth0), Global Token Revocation (Okta)* | One administrative or upstream security event terminates all of the user's sessions and revokes their issued tokens everywhere. | ✅ (GA) | ✅ (all plans) | ❌ | 🟡 (plugin: revoke plus back-channel logout) |

*Gap: `better-auth-part3.md` was not present in the research directory, so the Better Auth cells for the OAuth/OIDC provider and `customSession` were taken from the vendor's own plugin documentation (`oauth-provider`, `custom-session`) rather than from the prepared research file.*

---

## 08. Login UX, hosted pages & UI components

This section covers what the end user sees during authentication and account management, and the controls developers have over it: hosted versus embedded login, drop-in components, theming, copy and localization, and self-service end-user pages. Better Auth is a headless library — it ships authentication endpoints and typed client actions but no rendered screens at all, so most rows below are ❌ or ➖ for it by design rather than by omission; where the capability is expressible as app-owned code or an official plugin, the cell says so. Auth0 and Okta centre on a vendor-hosted page customized through a dashboard and template language, while Clerk centres on React components rendered inside the application.

### Login delivery modes

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Hosted login page**<br>*aka: Universal Login / New Universal Login (Auth0), Redirect authentication / Okta-hosted Sign-In Widget (Okta), Account Portal (Clerk)* | Vendor-hosted, vendor-updated authentication pages the application redirects to, so new factors and flows appear without application changes. | ✅ (Free+) | ✅ (SSO base) | ✅ (Free) | ❌ |
| **Superseded hosted login experience**<br>*aka: Classic Universal Login / Classic Login (Auth0), Classic Engine sign-in (Okta)* | An earlier generation of the hosted login page, still served but no longer gaining features. Auth0 Classic lacks passkeys, WebAuthn, Organizations and full localization but is the only experience supporting email magic links and Kerberos auto-login; Okta Classic Engine relies on the deprecated Authn/Factors APIs. | 🟡 (Free+, feature-frozen) | 🟡 (Classic Engine only) | ❌ | ❌ |
| **Vendor-supplied login widget hosted by the app**<br>*aka: Lock (Auth0), Embedded / customer-hosted Sign-In Widget (Okta), `<SignIn />` (Clerk)* | A drop-in login UI rendered inside the application's own pages with no redirect, at the cost of the customer owning the package upgrade and XSS surface. | 🟡 (Lock, legacy) | ✅ (SSO base) | ✅ (Free) | ❌ |
| **Credential submission with no browser redirect**<br>*aka: Embedded Login / Cross-Origin Authentication (Auth0), Direct Authentication \| Interaction Code grant (Okta), Custom flows (Clerk)* | The application collects credentials in its own UI and posts them to the identity API directly. Auth0 documents trade-offs including third-party-cookie fragility, no cross-app SSO and divergence from RFC 8252. | ✅ (Free+, discouraged) | ✅ (Identity Engine) | ✅ (Free) | ✅ (Core) |
| **Modal vs dedicated-page rendering**<br>*aka: `routing` / `userProfileMode` (Clerk)* | Whether the login or profile UI can be opened as an overlay from a parent component as well as mounted on its own route, and whether that route uses path or hash routing. | 🟡 (Lock modal, legacy) | ❌ | ✅ (Free) | ❌ |
| **Native mobile login experience**<br>*aka: Native Login (Auth0), Embedded SDKs / Identity Engine SDKs (Okta), Expo \| iOS \| Android SDKs (Clerk), `@better-auth/expo` (BA)* | Guidance and SDKs for authenticating inside a mobile app, spanning system browser flows (SafariViewController, Custom Chrome Tabs) and in-app native screens. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Free) | ✅ (Core companion pkg) |
| **Turning the vendor-hosted pages off**<br>*aka: Disable Account Portal (Clerk)* | An explicit switch that makes the hosted pages stop serving so the application must supply the whole experience. | 🟡 (use embedded login instead) | 🟡 (use embedded widget instead) | ✅ (Free) | ➖ (no hosted pages) |
| **Pinning the login UI version**<br>*aka: Sign-In Widget major/minor version selection (Okta)* | Control over which version of the rendered login UI a tenant runs, so upgrades can be staged rather than pushed. | 🟡 (Lock via npm; UL auto-updated) | ✅ (per brand) | ✅ (npm package version) | ➖ (no shipped UI) |

### Prebuilt UI components

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Sign-in component** | A drop-in component rendering the full sign-in UI, with the available strategies driven by tenant settings rather than component props. Clerk's `<SignIn />` can also render sign-up inline via `withSignUp`, plus pending session tasks. | 🟡 (Lock, legacy) | ✅ (Sign-In Widget) | ✅ (Free) | ❌ |
| **Sign-up component**<br>*aka: `<SignUp />` (Clerk)* | A drop-in registration UI including identifier collection, legal-consent checkbox and any post-signup tasks. | 🟡 (Lock signup mode) | 🟡 (widget + profile enrollment policy) | ✅ (Free) | ❌ |
| **User button / avatar menu**<br>*aka: `<UserButton />` (Clerk)* | Avatar control opening a menu for account management and sign-out, listing all signed-in accounts in multi-session applications. | ❌ | ❌ | ✅ (Free) | ❌ |
| **Custom menu items in the user button**<br>*aka: `<UserButton.MenuItems>` with `<UserButton.Action>` / `<UserButton.Link>` (Clerk)* | Composition API for adding, reordering or replacing entries in the account dropdown. | ❌ | ❌ | ✅ (Free) | ❌ |
| **User profile / account management component**<br>*aka: `<UserProfile />` (Clerk), End-User Settings (Okta), Universal Components (Auth0)* | Full self-service account UI covering profile details, identifiers, connected accounts, passwords, passkeys, MFA methods, backup codes and active devices. | 🟡 (Universal Components, native only) | ✅ (SSO base) | ✅ (Free) | ❌ |
| **Custom pages inside the profile component**<br>*aka: `<UserProfile.Page>` / `<UserProfile.Link>` (Clerk)* | Injecting application-owned pages and external links into the profile component's own side navigation. | ❌ | ❌ | ✅ (Free) | ❌ |
| **Composable profile building blocks**<br>*aka: `@clerk/ui/experimental` profile components (Clerk)* | Breaking the monolithic profile component into providers, panels and sections so a profile page is assembled from chosen pieces in a chosen order. | ❌ | ❌ | 🟡 (experimental) | ❌ |
| **Organization switcher component**<br>*aka: `<OrganizationSwitcher />` (Clerk)* | Drop-in control for switching the active organization and creating new ones. | ❌ | ❌ | ✅ (Hobby) | ❌ |
| **Organization self-service admin component**<br>*aka: `<OrganizationProfile />` (Clerk), Universal Components (Auth0)* | Embedded UI where an organization's own admins manage settings, members, invitations, domains and — when enabled — their own SSO connection. | 🟡 (Universal Components, web) | ❌ | ✅ (Hobby) | ❌ |
| **Organization creation component**<br>*aka: `<CreateOrganization />` (Clerk)* | Drop-in form letting an end user create a new organization. | ❌ | ❌ | ✅ (Hobby) | ❌ |
| **Organization list / picker component**<br>*aka: `<OrganizationList />` (Clerk)* | Renders the organizations a user belongs to, plus suggestions and pending invitations, for selection. | ❌ | ❌ | ✅ (Hobby) | ❌ |
| **Waitlist form component**<br>*aka: `<Waitlist />` (Clerk)* | Prebuilt form letting visitors request early access when the instance runs in waitlist mode. | ❌ | ❌ | ✅ (Free) | ❌ |
| **Google One Tap component**<br>*aka: `<GoogleOneTap />` (Clerk)* | Renders the Google One Tap prompt as a component rather than requiring manual script integration. | 🟡 (New Universal Login only) | ❌ | ✅ (Free) | 🟡 (plugin: oneTap, no UI) |
| **OAuth consent screen component**<br>*aka: `<OAuthConsent />` (Clerk), CustomizedConsent screen (Auth0 ACUL)* | A component for self-hosting the authorization consent step, rendering requested scopes and submitting the decision. | 🟡 (ACUL) | ❌ | ✅ (Free) | ➖ (app builds `consentPage`) |
| **Interrupt / step task components**<br>*aka: `<TaskChooseOrganization />`, `<TaskResetPassword />`, `<TaskSetupMFA />` (Clerk)* | Components rendering post-authentication interrupts — choosing an organization, resetting a compromised password, enrolling MFA — as first-class screens. | 🟡 (Universal Login prompts) | 🟡 (policy-driven widget screens) | ✅ (Free; MFA task is Pro) | ❌ |
| **Unstyled trigger buttons**<br>*aka: `<SignInButton />` / `<SignUpButton />` / `<SignOutButton />` / `<SignInWithMetamaskButton />` (Clerk)* | Headless trigger components that start a flow without imposing any styling on the host application. | ❌ | ❌ | ✅ (Free) | ➖ (app writes handlers) |
| **Auth-state gating components**<br>*aka: `<Show when="signed-in">` (Clerk; replaces `<SignedIn>`, `<SignedOut>`, `<Protect>` removed in Core 3)* | Declarative components that render children only for signed-in, signed-out or suitably authorized users, with a fallback. | ❌ | ❌ | ✅ (Free) | ➖ (app branches on `useSession`) |
| **Client lifecycle and navigation components**<br>*aka: `<ClerkLoading>` / `<ClerkLoaded>` / `<ClerkDegraded>` / `<ClerkFailed>`, `<RedirectToSignIn>` and siblings, `<AuthenticateWithRedirectCallback>` (Clerk)* | Components that render by SDK load state, declaratively navigate to a Clerk page, or complete a redirect-based SSO callback on a callback route. | ❌ | ❌ | ✅ (Free) | ❌ |
| **Prebuilt native mobile screens**<br>*aka: Universal Components for iOS/Android (Auth0), iOS \| Android organization components (Clerk)* | Ready-made SwiftUI and Jetpack Compose screens for end-user self-service over MFA factors, passkeys, recovery codes and organization management. | 🟡 (requires My Account API) | ❌ | 🟡 (native SDKs) | ❌ |
| **Community-maintained component library**<br>*aka: Better Auth UI / `@daveyplate/better-auth-ui` (BA)* | Third-party, MIT-licensed shadcn/ui, HeroUI and Solid components covering sign-in, sign-up, password reset and account settings for a headless auth library. | ➖ (first-party UI ships) | ➖ (first-party UI ships) | ➖ (first-party UI ships) | 🟡 (community, not vendor-supported) |

### Theming, branding and appearance

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **No-code branding editor**<br>*aka: Universal Login Themes (Auth0), Themes / Brands (Okta), Dashboard Customization (Clerk)* | Dashboard editor for colours, fonts, borders, backgrounds and logo across the login experience, without writing code. | ✅ (New Universal Login) | ✅ (all orgs) | ✅ (Free) | ❌ |
| **Design-token / theme variable API**<br>*aka: `appearance.variables` (Clerk), Branding Themes API (Auth0), Themes API (Okta)* | A programmatic set of high-level tokens — colours, typography, radii, spacing — merged over the base theme. | ✅ (New Universal Login) | 🟡 (assets and colours only) | ✅ (Free) | ❌ |
| **Element-level style overrides**<br>*aka: `appearance.elements` / Bring your own CSS \| CSS custom properties (Clerk), Sign-in page code editor (Okta), Page Templates (Auth0)* | Targeting the individual DOM elements of the login UI, including state variants, with custom classes or CSS. | 🟡 (custom domain + page template) | 🟡 (custom URL domain required) | ✅ (Free) | ❌ |
| **Prebuilt theme packs**<br>*aka: Themes in `@clerk/ui` (Clerk)* | Bundled, swappable visual themes — Clerk ships six (default, Simple, shadcn, Dark, Shades of Purple, Neobrutalism), stackable as an array where later themes win. | ❌ | ❌ | ✅ (Free) | ❌ |
| **Light/dark mode support** | The login UI following the viewer's colour-scheme preference, switchable by class, data attribute or media query. | 🟡 (hand-written CSS in page template) | 🟡 (hand-written CSS in sign-in page) | ✅ (Free, default theme) | ❌ |
| **Custom HTML/CSS/JS on the hosted page**<br>*aka: Page Templates + Partials (Auth0), Sign-in page customization code editor (Okta)* | Injecting arbitrary markup, styles and scripts into the vendor-hosted page. Auth0 uses Liquid templates plus named partial entry points capped at 10,000 characters each. | ✅ (custom domain required) | ✅ (custom URL domain required) | ❌ | ➖ (no hosted pages) |
| **Fully custom UI on the vendor's authentication state machine**<br>*aka: Advanced Customizations for Universal Login (ACUL) + `@auth0/auth0-acul-js` (Auth0)* | The customer ships its own React/Vue/vanilla application for each login screen while the vendor still drives the flow; assets are served from the customer's CDN and verified with Subresource Integrity hashes, per-screen and per-application. | 🟡 (custom domain + first-party app + CDN) | ❌ | ❌ | ➖ (app owns all UI) |
| **CSS cascade layer control**<br>*aka: `appearance.cssLayerName` (Clerk)* | Placing the component styles inside a named CSS `@layer` so the host application controls cascade order. | ❌ | ❌ | ✅ (Free) | ➖ (app owns all CSS) |
| **shadcn/ui registry integration**<br>*aka: shadcn CLI / registry (Clerk), Universal Components (Auth0)* | Installable registry components and a matching theme so the auth UI adopts a shadcn design system. | 🟡 (Universal Components) | ❌ | ✅ (Free) | 🟡 (community: better-auth-ui) |
| **Live preview, drafts and revert**<br>*aka: Theme editor (Clerk), Sign-in page code editor (Okta)* | Previewing branding changes before publishing. Okta additionally offers draft saving, a diff against the published version, one-click revert and a `/login/default` bypass URL for troubleshooting. | ✅ (Dashboard preview) | ✅ (draft, diff, revert) | ✅ (hosted theme editor) | ❌ |
| **Several independent brands in one tenant**<br>*aka: Multibrand customization / Brands (Okta), Organizations branding (Auth0)* | Hosting visually distinct login experiences for different customers or product lines within a single tenant, each bound to its own domain. | 🟡 (Organizations branding; MCD release-gated) | ✅ (3 domains default, up to 200) | 🟡 (one brand per instance) | ➖ (app owns all UI) |
| **Custom domain on the login experience**<br>*aka: Custom Domains (Auth0), Custom URL domain (Okta), Production instance domain / `accounts.<domain>` (Clerk)* | Serving the authentication endpoints and pages from a customer-owned hostname so login URLs, token issuer and passkey RP ID all carry the customer's brand. | ✅ (1 included, Free+) | ✅ (all orgs) | ✅ (production instances) | ➖ (app owns its domain) |
| **Several custom domains per tenant**<br>*aka: Multiple Custom Domains (MCD) (Auth0), Multibrand domains (Okta), Satellite domains (Clerk)* | More than one branded authentication hostname on one tenant, with a designated default and per-domain passkey RP IDs. | 🟡 (release-stage gated) | ✅ (3 default, 200 on request) | 🟡 (satellite domains) | ➖ (app owns its domains) |
| **Brand assets — logo, favicon, background**<br>*aka: Theme assets (Okta), Branding (Auth0, Clerk)* | Uploading the logo, favicon and background image applied across login pages, error pages and notification emails. | ✅ (Free+) | ✅ (all orgs) | ✅ (Free) | ❌ |
| **Removing the identity provider's own branding**<br>*aka: Remove "Secured by Clerk" branding (Clerk)* | Whether the vendor's own name or badge can be taken off the login UI. | ✅ (own logo replaces Auth0's) | ✅ (own logo replaces Okta's) | 🟡 (Pro; free in development) | ➖ (no vendor UI) |
| **Error page customization**<br>*aka: Custom Error Pages (Auth0), Error page customization (Okta)* | Replacing the default authentication error page with custom markup or a redirect to the application's own handler. | ✅ (Free+) | ✅ (custom domain for custom code) | ❌ | ➖ (app owns error pages) |

### Copy, localization, accessibility and message templates

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Per-screen text overrides**<br>*aka: Customize Universal Login Text Elements (Auth0), Sign-In Widget `i18n` object / page labels (Okta), `localization` prop (Clerk)* | Overriding every visible string per screen and per language, for brand-specific wording rather than translation. Auth0 exposes it through the Dashboard, `/prompts/{prompt}/custom-text/{language}` and the CLI. | ✅ (New Universal Login) | ✅ (all orgs) | 🟡 (experimental API) | ➖ (app writes all copy) |
| **Bundled translations for the auth UI**<br>*aka: Universal Login Internationalization (Auth0), Supported display languages (Okta), `@clerk/localizations` (Clerk)* | Ready-made translated copy for the login and account screens. Auth0 ships roughly 50 locales, Okta 27 plus emerging locales via BCP 47 codes, Clerk about 48. | ✅ (New Universal Login) | ✅ (27 + BCP 47) | 🟡 (~48 locales, experimental) | ❌ |
| **Custom or self-hosted language bundles**<br>*aka: Custom language bundle (Okta), custom localization object (Clerk)* | Supplying a locale the vendor does not ship, or hosting the translation bundle on the customer's own server. | ✅ (per-language custom text) | ✅ (self-hostable bundle) | ✅ (Free) | ➖ (app owns all copy) |
| **End-user language picker on the login page**<br>*aka: Language Selection prompt (Auth0)* | A control on the login screen itself letting the user switch language, rather than inferring it from the browser or a parameter. | ✅ (New Universal Login) | ❌ | ❌ | ➖ (app owns all UI) |
| **Right-to-left layout** | Mirroring the login UI for RTL languages, not merely shipping RTL translations. Okta ships Arabic and Hebrew display languages but RTL layout mirroring is not documented; the same gap applies to Clerk. | ✅ (New Universal Login) | ❔ (unverified) | ❔ (unverified) | ➖ (app owns all UI) |
| **Published accessibility conformance for the login UI** | A stated conformance target and public report for the authentication screens. | ✅ (WCAG 2.2 AA, EN 301 549) | ✅ (WCAG 2.2 AA, VPAT 2.5 ACRs) | 🟡 (no published conformance report) | ➖ (app owns all UI) |
| **Email template customization**<br>*aka: Email Templates (Auth0), Email templates / Custom Email Templates API (Okta), Email & SMS templates (Clerk)* | Editing the body and subject of system notification emails (verification, password reset, invitation, account unlock). Okta caps bodies at 64 KB and subjects at 128 characters. | 🟡 (requires custom SMTP provider) | ✅ (per brand) | 🟡 (Pro for custom templates) | ✅ (Core — app composes the email) |
| **Templating language and variables in messages**<br>*aka: Liquid (Auth0), Velocity Template Language (Okta), Handlebars + partials (Clerk)* | The interpolation and conditional syntax available inside message templates, including profile attributes, application data, formatting helpers and reusable partials. | ✅ (Liquid) | ✅ (VTL) | ✅ (Handlebars) | ➖ (ordinary application code) |
| **Per-language message templates**<br>*aka: Email template translations (Okta)* | Distinct stored template variants per locale, rather than one template with hand-written conditionals. | 🟡 (Liquid conditionals, manual) | ✅ (27 languages, manual translation) | ❔ (unverified) | ✅ (Core — app branches on locale) |
| **SMS template customization**<br>*aka: Custom SMS message template (Okta), SMS templates (Clerk)* | Overriding the text of verification and MFA SMS messages. Okta allows 159 characters, alphanumerics and punctuation only, and requires the `{code}` variable. | ✅ (passwordless and MFA text) | ✅ (all orgs) | ✅ (Free) | ✅ (Core — app composes the SMS) |
| **WYSIWYG template editor**<br>*aka: Revolvapp editor (Clerk)* | A visual editor for message templates rather than a raw HTML source field. | ❌ (source editor only) | 🟡 (HTML source with allowed tag set) | ✅ (Free) | ❌ |
| **Consent screen customization**<br>*aka: Customize Consent Prompts / `use_scope_descriptions_for_consent` (Auth0), scope display names (Okta), `<OAuthConsent />` (Clerk), `consentPage` (BA)* | Controlling what the authorization consent screen shows and where it is rendered — generated scope text versus verbatim scope descriptions, or handing the screen to the application entirely. | ✅ (Free+) | 🟡 (scope names and descriptions) | ✅ (Free) | ✅ (plugin: oauthProvider) |

### Forms, self-service pages and redirect behaviour

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Custom fields on the sign-up form**<br>*aka: Partials on signup prompts (Auth0), Profile enrollment form / UI Schema API (Okta), `unsafeMetadata` (Clerk), `user.additionalFields` (BA)* | Collecting application-specific attributes during registration and persisting them on the user. Clerk's prebuilt `<SignUp />` accepts no extra fields — custom values arrive only through `unsafeMetadata` in a custom flow or a post-signup onboarding step. | 🟡 (custom domain + page template) | ✅ (Identity Engine) | 🟡 (custom flow or onboarding step) | ✅ (Core, app-built form) |
| **Legal consent checkbox at sign-up**<br>*aka: Terms of Service acceptance (Auth0 Lock), Legal consent (Clerk)* | A required terms-and-privacy acknowledgement rendered as part of registration and recorded against the user. | 🟡 (Lock or partials) | 🟡 (custom sign-in page code) | ✅ (Free) | ➖ (app-built form) |
| **Self-service account management page**<br>*aka: End-User Settings (Okta), `<UserProfile />` (Clerk), My Account API + Universal Components (Auth0)* | A page where end users maintain their own profile, identifiers and credentials without contacting support. Auth0 exposes the user-scoped `/me/v1/...` API with a default policy requiring a second factor within 15 minutes. | 🟡 (API plus native components) | ✅ (SSO base) | ✅ (Free) | 🟡 (Core APIs, app builds UI) |
| **Self-service device and session management**<br>*aka: Active devices tab in `<UserProfile />` (Clerk)* | An end-user view listing active sessions or devices with the ability to sign them out. | 🟡 (Management API, build the UI) | ✅ (SSO base) | ✅ (Free) | 🟡 (`listSessions` API, app builds UI) |
| **Self-service MFA and passkey enrolment UI**<br>*aka: Universal Login MFA prompts (Auth0), Okta Verify enrollment / authenticator enrollment (Okta)* | Screens where a user enrols, renames and removes second factors, passkeys and recovery codes themselves. | ✅ (Universal Login prompts) | ✅ (Identity Engine) | ✅ (Free; MFA is Pro) | 🟡 (plugin APIs, app builds UI) |
| **Self-service password reset and account unlock UI**<br>*aka: Self-service account recovery (SSPR) / Account unlock (Okta)* | The forgot-password and locked-account recovery screens, including which recovery authenticators may start the flow. | ✅ (Free+) | ✅ (policy-configured) | ✅ (Free) | 🟡 (Core APIs, app builds UI) |
| **End-user application portal**<br>*aka: Okta End-User Dashboard (Okta)* | A per-user portal listing every assigned application as a launchable tile, with user-defined sections and reordering as well as admin-curated layout. | ❌ | ✅ (SSO base) | ❌ | ❌ |
| **Browser extension sign-in launcher**<br>*aka: Okta Browser Plugin (Okta)* | A Chrome/Edge/Firefox/Safari extension that launches assigned apps and injects stored form credentials, holding them out of page-readable memory and discarding them after submission. | ❌ | ✅ (SSO base) | ❌ | ❌ |
| **Post-sign-in redirect allow list**<br>*aka: Allowed Callback URLs (Auth0), Sign-in redirect URIs (Okta), `fallbackRedirectUrl` / `forceRedirectUrl` (Clerk), `callbackURL` + `trustedOrigins` (BA)* | Where the user lands after authenticating, and the allow list that prevents open redirects. Auth0 supports subdomain wildcards, which FAPI 1 compliance levels disallow; Clerk requires the target to be on the instance domain, a subdomain or the same origin. | ✅ (Free+) | ✅ (all orgs) | ✅ (Free) | ✅ (Core) |
| **Distinct post-sign-up and error redirects**<br>*aka: `signUpFallbackRedirectUrl` (Clerk), `newUserCallbackURL` / `errorCallbackURL` (BA)* | Sending first-time users, or failed attempts, to a different destination than a normal successful sign-in. | 🟡 (Actions redirect logic) | 🟡 (registration inline hook) | ✅ (Free) | ✅ (Core) |
| **Registered login entry point**<br>*aka: Default Login Routes / `initiate_login_uri` (Auth0), Initiate login URI (Okta), Sign-in URL setting (Clerk), `loginPage` (BA)* | The URL the identity provider sends users to when a login must begin at the application, used for IdP-initiated and session-delegation scenarios. | ✅ (Free+) | ✅ (all orgs) | ✅ (Free) | ✅ (plugin: oauthProvider) |
| **Help and recovery link overrides on the login UI**<br>*aka: Help / forgot-password / unlock link overrides (Okta), `appearance.options` links (Clerk)* | Repointing the login screen's support, terms, privacy, forgot-password and unlock links at the application's own pages. | 🟡 (custom text or partials) | ✅ (widget init parameters) | ✅ (Free) | ➖ (app owns all links) |
| **Last-used sign-in method hint**<br>*aka: `lastAuthenticationStrategy` (Clerk), `lastLoginMethod` plugin (BA)* | Marking on the sign-in screen which strategy the returning user chose last on this device. | ❔ (unverified) | ❔ (unverified) | ✅ (Free) | 🟡 (plugin: lastLoginMethod, no UI) |

### Headless and custom-flow escape hatches

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Headless hooks and client primitives for custom UI**<br>*aka: auth0.js / Authentication API (Auth0), Embedded SDKs + Interaction Code grant (Okta), `useSignIn()` \| `useSignUp()` \| `useClerk()` (Clerk), `createAuthClient()` (BA)* | Typed client APIs exposing each step of the authentication flow so the application can render the whole UI itself. Clerk documents custom flows as advanced with best-effort support; for Better Auth this is the only mode and covers React, Vue, Svelte, Solid and vanilla JS. | ✅ (Free+) | ✅ (Identity Engine) | ✅ (Free) | ✅ (Core) |
| **Unstyled composable UI primitives**<br>*aka: Clerk Elements (Clerk)* | A library of unstyled, composable form primitives that own the flow logic while the application owns every pixel — a middle ground between prebuilt components and raw hooks. | ❌ | ❌ | 🟡 (deprecated; superseded by Core 3 hooks) | ❌ |
| **Screen-level SDK for the vendor's hosted flow**<br>*aka: ACUL JS SDK `@auth0/auth0-acul-js` (Auth0)* | Typed per-screen classes exposing each hosted prompt's state and submit methods (login, passwordless, every MFA factor, passkey enrolment, consent, device activation, logout, brute-force unblock) for a customer-authored replacement UI. | 🟡 (with ACUL) | ❌ | ❌ | ➖ (no hosted flow) |

---

## 09. User management & directory

This section covers the user record itself and every operation performed on it. The four products diverge most on schema extensibility (Okta and Better Auth give the user record real typed columns, while Auth0 and Clerk push everything into JSON metadata namespaces), on migration tooling (Auth0, Okta and Clerk each ship credential-preserving import paths; Better Auth expects you to own the database), and on directory breadth (Okta models multiple emails, phones, user types and lifecycle states that the other three flatten into a single record with boolean flags).

### Profile record and schema

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **User profile record**<br>*aka: User Profile (Auth0), Universal Directory user profile (Okta), `User` object (Clerk), `user` table (BA)* | The per-tenant record holding one person's identity data, aggregated across every connection they authenticate through, and readable from admin APIs, backend SDKs and tokens. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core) |
| **Normalized profile across identity providers**<br>*aka: Normalized User Profile (Auth0), IdP user profile mapping (Okta), `mapProfileToUser` (BA)* | Maps differing provider attribute names onto one canonical shape so application code reads the same fields no matter which provider signed the user in. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core) |
| **Typed custom profile attributes**<br>*aka: Custom attributes / Profile Editor (Okta), `user.additionalFields` (BA)* | First-class profile fields declared with a data type, requiredness and default, beyond the built-in attribute set — as opposed to a free-form JSON blob. Okta declares them in an admin UI; Better Auth declares them in code and generates the columns. | ❌ | ✅ (Universal Directory) | ❌ | ✅ (Core) |
| **Per-attribute uniqueness constraint**<br>*aka: Attribute uniqueness (Okta)* | Forces values of a chosen attribute to be unique across the directory so it can serve as an alternate identifier, such as an employee number. | ❌ | ✅ (Universal Directory) | ❌ | 🟡 (own database schema) |
| **Multiple profile schemas in one tenant**<br>*aka: User Types (Okta)* | Several distinct attribute schemas inside a single tenant so employees, partners and customers carry different field sets. | ❌ | ✅ (Universal Directory) | ❌ | 🟡 (own database schema) |
| **Directory partitioning into isolated populations**<br>*aka: Realms (Okta)* | Splits one directory into separate user populations with their own scoped administrators and allowed email domains; a user belongs to exactly one partition. | ❌ | 🟡 (OIG / Secure Partner Access) | ❌ | ❌ |
| **Per-attribute end-user write permission**<br>*aka: Permit user-initiated attribute modifications (Okta), root attribute editability (Auth0), `input: false` (BA)* | Controls, field by field, whether the signed-in user may change their own stored value. | 🟡 (per-connection root attributes) | ✅ (Universal Directory) | 🟡 (instance-wide identifier toggle) | ✅ (Core) |
| **Profile attribute mapping to applications and IdPs**<br>*aka: Profile mappings (Okta), User Attribute Profile (Auth0), Custom Attribute Mapping (Clerk), `mapProfileToUser` (BA)* | Per-connection rules copying attributes between the directory profile and an application, SAML assertion, SCIM payload or inbound IdP claim, in one or both directions. | 🟡 (enterprise connections) | ✅ (Universal Directory) | 🟡 (Enterprise SSO connections) | 🟡 (per-provider code) |
| **Attribute transformation during mapping**<br>*aka: Okta Expression Language (Okta), Actions (Auth0)* | Concatenating, reformatting, slicing or conditionally deriving an attribute value while it moves between profiles. Okta uses a declarative expression language; the others require code. | 🟡 (Actions, JavaScript) | ✅ (Universal Directory) | ❌ | 🟡 (TypeScript in mapping) |
| **Per-attribute authoritative source**<br>*aka: Profile source / attribute-level sourcing (Okta)* | Names a different system of record for each individual attribute and ranks sources when the same user exists in several upstream systems. | ❌ | ✅ (Universal Directory) | ❌ | ❌ |
| **Refresh profile from the identity provider on every login**<br>*aka: Sync users at login (Auth0), `updateUserInfoOnLink` (BA)* | Chooses whether an upstream provider overwrites profile fields on each sign-in or only when the record is first created, which decides whether local edits survive. | ✅ (all plans) | ✅ (Universal Directory) | ❔ (unverified) | 🟡 (Core, on link only) |
| **Attribute deny list**<br>*aka: DenyList / `non_persistent_attrs` (Auth0)* | Names attributes the platform receives from a provider but deliberately never writes to storage, for data minimization. | ✅ (all plans) | 🟡 (leave attribute unmapped) | ❌ | 🟡 (drop in mapping code) |
| **External / legacy system identifier field**<br>*aka: `external_id` (Clerk)* | A dedicated field carrying the user's primary key from the system being migrated away from, filterable in listings and usable in token claims. | 🟡 (`app_metadata` convention) | 🟡 (custom attribute) | ✅ (Hobby+) | 🟡 (additionalFields) |
| **Profile picture with hosted avatar upload**<br>*aka: `picture` (Auth0), `imageUrl` (Clerk), `image` (BA)* | An avatar field on the record, plus an API that accepts an uploaded image, hosts it and serves it with resize/format parameters. Auth0 defaults to Gravatar or a generated initials image but stores only a URL; Okta's base profile has no picture attribute. | 🟡 (URL only, default avatar) | 🟡 (custom attribute) | ✅ (Hobby+, with optimization) | 🟡 (URL only) |

### Metadata namespaces

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **End-user-writable metadata**<br>*aka: `user_metadata` (Auth0), `unsafeMetadata` (Clerk)* | Free-form JSON on the profile that the signed-in user's own client may write. Documented as untrusted: it must not hold anything that affects access. | ✅ (all plans) | ❌ | ✅ (Hobby+) | 🟡 (typed additionalFields) |
| **Frontend-readable, backend-writable metadata**<br>*aka: `publicMetadata` (Clerk)* | A middle namespace any client may read but only trusted server code may write, for plan or role hints the UI needs. | 🟡 (`app_metadata` via custom claims) | ❌ | ✅ (Hobby+) | 🟡 (additionalFields, `input: false`) |
| **Backend-only privileged metadata**<br>*aka: `app_metadata` (Auth0), `privateMetadata` (Clerk)* | JSON on the profile readable and writable only by server code and webhook handlers, never exposed to the frontend — the documented home for entitlements and external IDs. | ✅ (all plans) | ❌ | ✅ (Hobby+) | 🟡 (additionalFields, `returned: false`) |
| **Metadata settable during sign-up** | The subset of profile data a client may attach while the account is being created, used for onboarding answers captured on the sign-up form. | ✅ (all plans) | 🟡 (registration inline hook) | ✅ (Hobby+, `unsafeMetadata`) | ✅ (Core, additionalFields) |
| **Documented metadata size limits** | Published caps on how much free-form data one user record may hold, and how much of it can safely ride in a session token. | ✅ (all plans) | ➖ (no metadata store) | ✅ (8 KB/user, ~1.2 KB in token) | ➖ (own database) |
| **Metadata write concurrency control**<br>*aka: Manage Metadata Lock (Auth0)* | Guards against two concurrent writers silently overwriting each other's metadata changes. | ✅ (all plans) | ➖ (no metadata store) | ❌ | 🟡 (own database transactions) |

### Identifiers and identity records

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Multiple email addresses per user**<br>*aka: Email Addresses resource (Clerk), `secondEmail` + MyAccount emails (Okta)* | One account holds several email addresses, each independently added, verified, promoted and removed. | ❌ | ✅ (Universal Directory) | ✅ (Hobby+) | ❌ |
| **Multiple phone numbers per user**<br>*aka: Phone Numbers resource (Clerk), MyAccount phones (Okta)* | The same add/verify/remove lifecycle for phone numbers attached to one account. | ❌ | ✅ (Universal Directory) | ✅ (Hobby+) | ❌ |
| **Primary identifier designation**<br>*aka: `primaryEmailAddress` / `primaryPhoneNumber` (Clerk), `login` (Okta)* | Marks which of several identifiers is canonical for sign-in, display and notifications. | ➖ (one email per record) | ✅ (Universal Directory) | ✅ (Hobby+) | ➖ (one email per record) |
| **Atomic identifier replacement** | Swaps a user's email address or phone number in a single administrative operation rather than add-then-verify-then-delete. | 🟡 (PATCH user, custom flow) | 🟡 (update profile login) | ✅ (Hobby+) | ✅ (Core + plugin: admin) |
| **Verified email-change flow**<br>*aka: `user.changeEmail` (BA)* | A user-initiated change that sends verification to the new address and only swaps the stored value once that address is confirmed, with an opt-out when the old address was never verified. | 🟡 (build with tickets API) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core, opt-in) |
| **Confirmation from the current address before an email change**<br>*aka: `sendChangeEmailConfirmation` (BA)* | Adds an approval step on the address being replaced before the new address is asked to verify, so a hijacked session cannot silently move the account. | ❌ | ❌ | ❌ | ✅ (Core) |
| **Restrict end users from changing their identifiers** | Setting that stops users editing their own email, phone or username after sign-up while administrators keep full control. | 🟡 (Actions / connection settings) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core, off by default) |
| **Linked identity records on the user**<br>*aka: `identities` (Auth0), External Accounts (Clerk), `account` table (BA), IdP users (Okta)* | Sub-records on the profile, one per authentication method or external provider account, each keyed by provider plus provider-side user ID. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core) |

### Account linking

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Manual account linking by an authenticated user**<br>*aka: Link User Accounts (Auth0), `linkSocial()` (BA), Link IdP user (Okta)* | An already signed-in user explicitly authenticates a second provider to attach it to their existing profile. | 🟡 (custom implementation) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core) |
| **Automatic linking on a provider-verified email match**<br>*aka: Account linking for OAuth (Clerk), `accountLinking.enabled` (BA), IdP account link policy (Okta)* | A sign-in through a new provider whose email the provider asserts as verified attaches to the existing account with that email instead of creating a duplicate. | 🟡 (Actions or legacy extension) | ✅ (Universal Directory) | ✅ (Hobby+, default) | ✅ (Core, default on) |
| **Trusted providers that link without a verified-email signal**<br>*aka: `accountLinking.trustedProviders` (BA)* | A configured provider list whose sign-ins link automatically even when the provider never marks the email verified. | 🟡 (Actions code) | 🟡 (IdP account-link policy) | ❌ | ✅ (Core) |
| **Disable implicit linking**<br>*aka: `disableImplicitLinking` (BA)* | Rejects a same-email sign-in from an unlinked provider with a distinct error code so linking must be an explicit action in account settings. | 🟡 (Actions code) | ✅ (turn off account link policy) | ❌ | ✅ (Core) |
| **Linking accounts whose emails differ**<br>*aka: `allowDifferentEmails` (BA)* | Permits attaching a provider account with a different email address, or one that returns no email at all. | ✅ (Management API) | ✅ (manual IdP link) | ✅ (via added email) | ✅ (Core) |
| **Linking with a provider token instead of a redirect**<br>*aka: `link_with` (Auth0), `linkSocial({ idToken })` (BA)* | Attaches a provider using tokens a native SDK or custom flow already holds, with no browser round trip. | ✅ (all plans) | 🟡 (link by provider user ID) | ❌ | ✅ (Core) |
| **Copy the provider profile onto the user when linking**<br>*aka: `updateUserInfoOnLink` (BA)* | Refreshes name, picture and mapped fields from the newly linked provider, while leaving the account's email binding untouched so linking cannot rebind identity. | 🟡 (Actions code) | ✅ (IdP profile mapping) | ❌ | ✅ (Core) |
| **Unlink an identity**<br>*aka: Unlink User Accounts (Auth0), delete external account (Clerk), `unlinkAccount()` (BA)* | Detaches a linked provider account from the profile. Products differ on whether the detached identity becomes its own user record again (Auth0) or is simply removed. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core) |
| **Guard against removing the last authentication method**<br>*aka: `allowUnlinkingAll` (BA)* | Refuses an unlink that would leave the account with no way to sign in, unless the guard is explicitly lifted. | ❌ | ➖ (local credential retained) | 🟡 (enforced in prebuilt UI) | ✅ (Core) |

### Search, listing and pagination

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Query-language user search**<br>*aka: User Search Query Syntax v3 (Auth0), `search` / `q` parameters (Okta), `query` parameters (Clerk), `searchValue`+`searchOperator` (BA admin)* | A free-form query over profile fields with operators for exact, prefix, range and boolean terms. Auth0 uses a Lucene subset; Okta uses a SCIM-style filter expression plus a simple `q` name lookup; Clerk and Better Auth offer fixed partial-match parameters only. | ✅ (Lucene subset) | ✅ (Universal Directory) | 🟡 (partial-match params) | 🟡 (plugin: admin, 3 operators) |
| **Search over custom and metadata fields** | Whether administrator-defined attributes and free-form metadata are indexed and queryable alongside the built-in fields. Auth0 does not index empty or null metadata values. | ✅ (all plans) | ✅ (Universal Directory) | ❌ | 🟡 (plugin: admin, own columns) |
| **Structured field filters on the user list** | Exact-match parameters for account status, identifiers, connection or provider, organization, external ID and blocked state. | 🟡 (via query syntax) | ✅ (`filter` parameter) | ✅ (Hobby+) | ✅ (plugin: admin) |
| **Date-range filters on the user list**<br>*aka: `created_at_before/after`, `last_sign_in_at_*`, `last_active_at_*` (Clerk)* | Narrows a listing by account creation, most recent sign-in or most recent session activity. | 🟡 (range queries) | 🟡 (`lastUpdated` only) | ✅ (Hobby+) | 🟡 (plugin: admin field filters) |
| **Sorting the user list**<br>*aka: `sort` (Auth0), `sortBy`/`sortOrder` (Okta), `order_by` (Clerk), `sortBy`/`sortDirection` (BA admin)* | Orders results by a chosen profile field in either direction. | ✅ (all plans) | ✅ (with `search`) | ✅ (Hobby+) | ✅ (plugin: admin) |
| **Cursor pagination over users**<br>*aka: checkpoint pagination (Auth0), `after` + Link header (Okta), `starting_after` (Clerk)* | Opaque-cursor paging that stays correct and fast on large result sets. Offset paging is capped or degrades on all three hosted products (Auth0 caps the searchable set at 1,000 records; Clerk's offset paging eventually times out). | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ❌ (offset/limit only) |
| **Total result count**<br>*aka: `include_totals` (Auth0), `GET /users/count` (Clerk), `total` (BA admin)* | Returns how many users match a filter without paging the whole list. | ✅ (all plans) | 🟡 (no total in list response) | ✅ (Hobby+) | ✅ (plugin: admin) |
| **Immediately-consistent lookup by ID or email** | Lookups guaranteed to reflect a just-written change, unlike the eventually-consistent search index — the supported path during authentication and linking. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core, direct query) |

### CRUD, lifecycle and account state

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Server-side user CRUD API** | Creating, reading and updating a user from trusted server code with identifiers, credentials, roles and profile data, bypassing the sign-up flow. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (plugin: admin) |
| **Hard deletion of a user record**<br>*aka: `removeUser()` (BA admin)* | Irreversibly removes the record and its associated data. Okta requires the account to be deactivated first, making deletion a two-step transition. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core / plugin: admin) |
| **Bulk deletion** | Removing many users in one operation rather than one API call per user. | 🟡 (all users in a connection) | 🟡 (scripted per user) | ❌ | 🟡 (own database) |
| **Self-service account deletion**<br>*aka: `delete_self_enabled` (Clerk), `user.deleteUser` (BA)* | Lets the signed-in user destroy their own account. Both products that ship it gate the action behind a password, a recently established session, or a verified deletion link. | 🟡 (build with Management API) | ❌ | ✅ (Hobby+) | ✅ (Core, opt-in) |
| **Deletion lifecycle hooks**<br>*aka: `beforeDelete` / `afterDelete` (BA)* | Application callbacks around deletion for cleanup of related data; only a synchronous pre-hook can veto the operation. | 🟡 (async log events) | 🟡 (async event hooks) | 🟡 (async webhook) | ✅ (Core, can veto) |
| **Administrative block / ban**<br>*aka: Block user (Auth0), Suspend (Okta), Ban a user (Clerk), `banUser()` (BA admin)* | Flags an account so sign-in is refused while the record and its data stay intact. Clerk also supports banning in bulk. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (plugin: admin) |
| **Ban reason and automatic expiry**<br>*aka: `banReason` / `banExpiresIn` (BA admin)* | Records why an account was blocked and lifts the block automatically after a set duration, with a configurable message shown to the blocked user. | ❌ | ❌ | ❌ | ✅ (plugin: admin) |
| **Session revocation as part of a ban** | Terminates the blocked user's existing sessions and tokens at the moment of the block, rather than only refusing future sign-ins. | 🟡 (separate revoke call) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (plugin: admin) |
| **Temporary lock distinct from ban**<br>*aka: Lock a user (Clerk), Locked out (Okta)* | A short-lived sign-in block with its own unlock operation, typically applied automatically after repeated failed attempts. | 🟡 (per-IP anomaly blocks) | ✅ (Universal Directory) | ✅ (Hobby+) | ❌ |
| **Multi-state account lifecycle**<br>*aka: User Lifecycle — staged, provisioned, active, suspended, deactivated (Okta)* | Named account states with constrained transitions (activate, reactivate, deactivate, suspend, unsuspend, unlock) rather than a single boolean enabled flag. | ❌ | ✅ (Universal Directory) | 🟡 (ban and lock flags) | 🟡 (ban flag only) |

### Import, export and migration

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Bulk user import job from a file**<br>*aka: Bulk User Imports (Auth0), CSV directory integration (Okta), user migration tool (Clerk)* | Loads many user records from one uploaded file as a long-running job, with per-record error reporting and optional upsert of existing records. Auth0 caps each job at 500 KB (roughly 1,000 users). | ✅ (all plans) | 🟡 (CSV via on-prem agent) | 🟡 (open-source script, per-user API) | 🟡 (write to own database) |
| **Password hash import**<br>*aka: `password_hash` / `custom_password_hash` (Auth0), imported hashed password (Okta), `password_digest` + `password_hasher` (Clerk)* | Accepts each user's existing password hash so migrated users keep their current password. Auth0 takes bcrypt natively plus other algorithms via a custom-hash field; Okta takes bcrypt, SHA-1/256/512, MD5 and PBKDF2; Clerk takes 17 hashers (bcrypt, argon2i/id, scrypt variants, PBKDF2 family, phpass, MD5, LDAP SSHA and more) and transparently rehashes to bcrypt on first use. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | 🟡 (custom hash/verify functions) |
| **Import flags that bypass policy checks**<br>*aka: `skip_password_checks`, `skip_password_requirement`, `skip_restriction_checks` (Clerk)* | Options on a trusted server-side import that bypass password policy, the password requirement and instance allow/block lists for records that already exist elsewhere. | 🟡 (implicit in import job) | 🟡 (implicit with imported hash) | ✅ (Hobby+) | ➖ (direct database writes) |
| **Bulk user export**<br>*aka: Bulk User Exports (Auth0), User Accounts report CSV (Okta), Export All Users (Clerk)* | Produces a downloadable file of the directory's users, with selectable fields, in CSV or newline-delimited JSON. | 🟡 (not on Free plan) | 🟡 (report CSV export) | ✅ (Dashboard export) | ➖ (own database) |
| **Export of credential material (password hashes, MFA secrets)** | Retrieval of the secret material ordinary exports withhold, so users can be migrated off the platform without forcing a password reset. | 🟡 (support case, PGP-encrypted) | ❌ | ❌ | ✅ (own database) |
| **Lazy / trickle migration from a legacy store**<br>*aka: Automatic Migration (Auth0), Password import inline hook (Okta), Trickle Migration (Clerk)* | Users move across one at a time on their next successful sign-in, with the platform calling out to the legacy store to verify the submitted password the first time, then storing it locally. | ✅ (custom database scripts) | ✅ (Universal Directory) | ✅ (Hobby+, custom flow) | 🟡 (custom verify function) |
| **Provider-specific migration guides** | Documented step-by-step paths for moving users and credentials off named competing platforms. | ✅ (all plans) | ✅ (all plans) | ✅ (Firebase, Cognito, Auth.js) | ✅ (Auth0, Clerk, Supabase, WorkOS) |

### Administrative operations and self-service

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Administrator impersonation of a user**<br>*aka: Impersonation API (Auth0, legacy), `impersonateUser()` (BA admin)* | Signs an administrator in as another user for support and debugging. Auth0's Impersonation API is a deprecated legacy endpoint not enabled on new tenants; Okta offers no equivalent beyond a time-boxed read-only access grant to its own support staff. | 🟡 (legacy API, deprecated) | ❌ | 🟡 (5/month; Administration add-on) | ✅ (plugin: admin) |
| **Impersonation audit marker and bounded duration**<br>*aka: `act` claim (Clerk), `session.impersonatedBy` (BA admin)* | The impersonated session records who is impersonating, so logs and application code can tell it from a genuine sign-in, and expires on its own after a short lifetime. Clerk times out after 10 minutes idle with a 30-minute maximum; Better Auth defaults to one hour. | 🟡 (legacy `impersonator` fields) | ➖ | ✅ (Hobby+) | ✅ (plugin: admin) |
| **Impersonation via a revocable one-time token**<br>*aka: Actor Tokens (Clerk)* | A server-minted single-use link that starts an impersonated session when opened, revocable before or after it is consumed and also issuable from a CLI. | 🟡 (legacy impersonation URL) | ❌ | ✅ (Hobby+) | ❌ |
| **Administrator-minted passwordless sign-in link**<br>*aka: Sign-in Tokens (Clerk), password-change ticket (Auth0)* | A one-time URL that authenticates or recovers a specific user without credentials, delivered through the application's own channel rather than the platform's email. These links do not themselves prove the recipient's identity. | ✅ (all plans) | ✅ (activation / recovery links) | ✅ (Hobby+) | 🟡 (plugin: oneTimeToken) |
| **Application-level user invitation**<br>*aka: Invitations (Clerk)* | An emailed invite that lets one specific address create an account, with that address treated as verified on sign-up. Auth0 and Better Auth only offer invitations scoped to an organization, not to the application as a whole. | 🟡 (organizations only) | ✅ (activation email) | ✅ (Hobby+) | ❌ |
| **Bulk invitations**<br>*aka: `createInvitationBulk()` (Clerk)* | Creating many invitations in a single call, under its own rate limit (Clerk: 25 requests/hour versus 100/hour for single invites). | 🟡 (per-organization calls) | ✅ (bulk create and activate) | ✅ (Hobby+) | ❌ |
| **Invitation expiry and revocation** | Invitations become invalid after a defined period and can be withdrawn before they are accepted. Clerk's expire after one month. | ✅ (organizations only) | ✅ (activation link expiry) | ✅ (Hobby+) | ❌ |
| **End-user self-service account API**<br>*aka: My Account API (Auth0), MyAccount API (Okta)* | Endpoints implicitly scoped to the signed-in user so an application can build account management without holding administrative credentials. | 🟡 (per-tenant activation, Early Access) | ✅ (Identity Engine) | ✅ (Frontend API) | ✅ (Core) |
| **Self-service profile update**<br>*aka: `updateUser()` (BA)* | Lets the signed-in user change their own mutable profile fields, subject to the per-attribute write permissions above. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ✅ (Core) |
| **Progressive profiling**<br>*aka: Progressive profile enrollment (Okta)* | Collects additional profile attributes at later sign-ins rather than demanding them all at registration. | ✅ (Actions + Forms) | ✅ (Identity Engine) | 🟡 (documented recipe, not packaged) | 🟡 (custom code) |
| **Last-login timestamp and login count on the record**<br>*aka: `last_login`/`last_ip`/`logins_count` (Auth0), `lastLogin` (Okta), `last_sign_in_at`/`last_active_at` (Clerk)* | Profile fields recording the most recent sign-in, its source IP, the most recent activity and the cumulative sign-in count, surfaced in listings and filters. | ✅ (all plans) | ✅ (Universal Directory) | ✅ (Hobby+) | ❌ |
| **Data-subject access, rectification and erasure**<br>*aka: GDPR right to access, correct and erase / data portability (Auth0)* | Documented API patterns for answering a data subject's request to see, correct, export or delete everything the user store holds about them. | ✅ (all plans) | ✅ (documented guidance) | 🟡 (delete + read APIs, no guide) | ✅ (own database) |

---

## 10. Organizations, teams & B2B multi-tenancy

Auth0, Clerk and Better Auth all expose an application-level **organization** primitive — a tenant entity inside one application, with its own members, invitations, roles and login context. Okta has no such primitive: a business customer is modelled as **groups**, as a **realm** (a partition of Universal Directory, gated behind Okta Identity Governance, Secure Partner Access or Advanced Directory Management), or as a separate **child org** (Platform — Multi-org Deployment), so its cells below name the real mechanism rather than claim an equivalent. Better Auth ships this as the free MIT `organization` plugin, so its `🟡 (plugin: organization)` markers are about opting the plugin in, not about price; Clerk's org basics are free and the advanced B2B surface sits behind the $100/mo **B2B Authentication Enhanced** add-on, while Auth0 caps organization counts by plan (5 on Free, 10 on B2C, unlimited on B2B Essentials and above).

### The organization entity

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Organization (tenant) primitive**<br>*aka: Organizations (Auth0), Realms / groups / child orgs (Okta), Organizations (Clerk), `organization()` plugin (BA)* | A first-class entity representing one business customer inside a single application, owning its own members, settings and login context. | ✅ (B2B plans; 5 on Free) | 🟡 (Realms; OIG/Partner Access SKU) | ✅ (all plans; 100 MRO free) | 🟡 (plugin: organization) |
| **Create an organization** | Provision a new organization through an API call or an admin console, with a name supplied at creation. | ✅ (Management API v2) | 🟡 (Realms API / Groups API) | ✅ (Backend API + Dashboard) | 🟡 (plugin: organization) |
| **Update organization** | Patch an existing organization's name, identifier, logo or stored attributes. | ✅ (Management API v2) | 🟡 (Realms / Groups API) | ✅ (Backend API) | 🟡 (plugin: organization) |
| **Delete organization with membership cascade** | Remove an organization and its membership and invitation records while leaving the underlying user accounts intact. | ✅ (memberships removed, users kept) | 🟡 (delete realm or group) | ✅ (Dashboard + API) | 🟡 (plugin: organization) |
| **Restrict or disable organization deletion** | Prevent tenants from being destroyed, either by a global switch or by a per-instance rule about who may delete. | 🟡 (Management API scopes only) | 🟡 (admin role permissions) | ✅ (per-instance member-delete setting) | 🟡 (`disableOrganizationDeletion`) |
| **Organization slug (unique URL-safe identifier)**<br>*aka: organization `name` (Auth0), subdomain (Okta), slug (Clerk), slug (BA)* | A human-readable unique key, distinct from both the opaque ID and the mutable display name, usable in URLs and as a login parameter. | ✅ (lowercase `name`, mutable) | 🟡 (child-org subdomain only) | ✅ (off by default since Oct 2025) | 🟡 (plugin: organization) |
| **Slug availability check before submit** | An endpoint that reports whether a proposed identifier is already taken, so a form can validate before creating. | ❌ | ❌ | ❌ | 🟡 (plugin: organization) |
| **Organization logo** | An image stored on the organization record and rendered in organization-aware screens. | ✅ (Organizations branding) | 🟡 (brand-level, not per group) | ✅ (Clerk-hosted upload) | 🟡 (logo URL field) |
| **Organization metadata (arbitrary JSON)** | A free-form key/value or JSON bag on the organization, for data such as plan tier or an external billing customer ID. | ✅ (metadata, readable in Actions) | ✅ (group profile custom attributes) | ✅ (public + private metadata) | 🟡 (`metadata` field) |
| **Application-defined columns on organization records** | Adding typed first-class fields to the organization, member and invitation records rather than stuffing them into a metadata blob. | ❌ | ✅ (Profile Editor schema) | ❌ | 🟡 (`additionalFields`) |
| **Instance-wide organization search and listing** | Enumerate or search every organization in the tenant, not just those the caller belongs to. | ✅ (search by name/display name) | ✅ (Groups / Realms API) | ✅ (Backend API + Dashboard) | 🟡 (lists caller's orgs; DB query otherwise) |
| **Vendor cap on the number of organizations** | A platform or plan limit on how many organizations one deployment may hold. | 🟡 (5/10/unlimited by plan; 100k hard cap) | 🟡 (child orgs need Multi-org SKU) | 🟡 (100 MRO, then B2B add-on) | ✅ (no vendor cap; self-hosted) |
| **Restrict who may create organizations** | Gate organization creation behind a flag, a per-user permission or an application-supplied predicate. | 🟡 (Management API scopes / Actions) | 🟡 (admin roles only) | ✅ (instance toggle + per-user flag) | 🟡 (`allowUserToCreateOrganization`) |
| **Per-user organization-creation quota** | Cap how many organizations a single end user may create. | ❌ | ❌ | ✅ (default 100 per user) | 🟡 (`organizationLimit`) |
| **Auto-create an organization at sign-up** | Provision a first organization automatically when a new user registers, so nobody lands without a workspace. | 🟡 (custom Action code) | ❌ | ✅ (Dashboard setting) | 🟡 (session/database hooks) |
| **Per-organization login branding** | Apply a specific organization's logo and colors to the sign-in experience when authenticating in that organization's context. | ✅ (Organizations branding) | 🟡 (Brands, one per custom domain) | 🟡 (org logo in components only) | ➖ (no hosted login UI) |

### Membership

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Membership record linking a user to an organization**<br>*aka: organization member (Auth0), group membership (Okta), Organization Membership (Clerk), `member` table (BA)* | A join record binding one user to one organization, carrying the role held there. | ✅ (Organizations plans) | 🟡 (group membership; one realm per user) | ✅ (all plans) | 🟡 (plugin: organization) |
| **Add a member directly, bypassing invitations** | Server-side call that inserts an existing user into an organization without an email round trip. | ✅ (assign members endpoint) | ✅ (group assignment) | ✅ (`createOrganizationMembership()`) | 🟡 (server-only `addMember`) |
| **Remove a member without deleting the user** | Drop the membership while the account remains in the directory and in other organizations. | ✅ (membership only) | ✅ (remove from group) | ✅ (Backend API) | 🟡 (by member ID or email) |
| **Leave an organization (self-service)** | The member themselves ends their own membership, no admin action required. | ❌ | ❌ | ✅ (own membership destroy) | 🟡 (`POST /organization/leave`) |
| **List and filter an organization's members** | Paginated member listing with search or filter expressions over name, email or status. | ✅ (search organization members) | ✅ (Group Members API) | ✅ (Backend API) | 🟡 (pagination, sort, filter operators) |
| **One user in many organizations** | A single account holds memberships in several organizations simultaneously, each with its own roles. | ✅ (Organizations plans) | 🟡 (many groups; exactly one realm) | ✅ (all plans) | 🟡 (plugin: organization) |
| **Membership-level metadata** | Custom JSON stored on the membership itself rather than on the user or the organization. | ❌ | ❌ | ✅ (public + private metadata) | 🟡 (`member.additionalFields`) |
| **Default role on joining** | The role a user receives automatically when they join an existing organization. | 🟡 (roles named per invitation) | 🟡 (entitlements follow the group) | ✅ (configurable Default Role) | 🟡 (default `member`) |
| **Role granted to the organization's creator** | The role automatically held by whoever created the organization. | 🟡 (assigned explicitly after create) | 🟡 (delegated admin assignment) | ✅ (Creator Role, default `org:admin`) | 🟡 (`creatorRole`, default `owner`) |
| **Change a member's role** | Reassign an existing member to a different role inside the organization. | ✅ (add/remove member roles) | 🟡 (move between groups) | ✅ (Backend API) | 🟡 (`updateMemberRole`) |
| **Multiple roles per member** | One membership holds several roles at once, unioning their access. | ✅ (up to 50 per member) | ✅ (multiple group memberships) | ❌ (one role per membership) | 🟡 (role array, stored comma-separated) |
| **Owner tier above admin, and ownership transfer** | A privileged role that admins cannot override, and a way to move it to another member. | 🟡 (role reassignment; no owner tier) | 🟡 (reassign delegated admin role) | 🟡 (admin role reassignment; no owner tier) | 🟡 (`owner` tier; transfer via role update) |
| **Seat cap per organization** | A configurable or platform limit on how many members one organization may hold. | ✅ (100,000 members per org) | 🟡 (no per-group cap) | 🟡 (5 default, 20 max; unlimited with add-on) | 🟡 (`membershipLimit`, default 100) |

### Invitations

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Email invitation to join an organization** | An emailed link that, once accepted, creates the account if needed and grants membership. | ✅ (Organizations plans) | 🟡 (admin-created user + activation email) | ✅ (all plans) | 🟡 (`inviteMember` + app-sent email) |
| **Role chosen at invitation time** | The inviter picks the role the invitee will hold, stored on the invitation and applied on acceptance. | ✅ (roles on the invitation) | 🟡 (pre-assign groups) | ✅ (role on invitation) | 🟡 (one or more roles) |
| **Accept an invitation** | The invited user converts a pending invitation into a membership. | ✅ (Organizations plans) | ➖ (activation, not membership) | ✅ (client + Backend API) | 🟡 (`acceptInvitation`) |
| **Decline an invitation** | The invitee explicitly rejects, as a state distinct from the inviter revoking it. | ❌ | ❌ | ❌ | 🟡 (`rejectInvitation`) |
| **Revoke a pending invitation** | The organization cancels an invitation that has been sent but not yet accepted. | ✅ (delete invitation) | 🟡 (deactivate the pending user) | ✅ (client + server revoke) | 🟡 (`cancelInvitation`) |
| **Configurable invitation expiry** | The validity window of an invitation link is settable rather than fixed. | ✅ (`ttl_sec`; 7 days default, 30 max) | ❌ | ✅ (`expiresInDays`, default 30) | 🟡 (`invitationExpiresIn`, default 48h) |
| **Resend an invitation and supersede duplicates** | Re-send to an already-invited address, optionally cancelling the earlier pending invitation. | 🟡 (issue a fresh invitation) | 🟡 (resend activation email) | 🟡 (revoke, then re-invite) | 🟡 (`resend` + `cancelPendingInvitationsOnReInvite`) |
| **Bulk invitations in one call** | Send many invitations in a single request instead of one per API call. | ❌ | ❌ | ✅ (10 per call) | ❌ |
| **Invitation volume limits** | A cap on invitations per inviter, or a documented rate limit on the invitation endpoints. | 🟡 (Management API rate limits) | ➖ (no invitation flow) | 🟡 (250/hr; bulk 50/hr) | 🟡 (`invitationLimit`, default 100) |
| **List invitations per organization and per invited user** | Enumerate an organization's pending invitations, and the invitations awaiting a given person. | 🟡 (per-organization listing only) | ❌ | ✅ (per-org + instance-wide) | 🟡 (both directions) |
| **Invitation metadata carried onto the membership** | Custom data attached to the invitation transfers to the membership record on acceptance. | ❌ | ❌ | ✅ (all plans) | 🟡 (`invitation.additionalFields`) |
| **Permission gate on who may invite** | Only members holding a given role or permission can send invitations. | ✅ (Management API scopes / My Organization API) | 🟡 (delegated admin role) | ✅ (admins by default, configurable) | 🟡 (`invitation:create` permission) |
| **Verified-email requirement before acting on an invitation** | The accepting session must have a verified email address matching the invitation. | 🟡 (invitation itself verifies the address) | ❌ | 🟡 (invited address must match) | 🟡 (`requireEmailVerificationOnInvitation`) |

### Domains, auto-join and organization-scoped identity providers

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Verified email domains on an organization**<br>*aka: Organization Domains / discovery domains (Auth0), allowed domains for realms (Okta), Verified Domains (Clerk)* | Email domains attached to an organization so membership and routing can be inferred from a user's address. | ✅ (100 discovery domains per org) | 🟡 (realm allowed domains, unverified) | 🟡 (B2B Auth Enhanced; 10 per org) | 🟡 (domains on the SSO provider) |
| **DNS TXT proof of domain ownership** | Ownership of a domain is proven by publishing a token in DNS before the domain can be trusted. | ✅ (`verification_txt` record) | 🟡 (org custom domain only) | ✅ (required before self-serve SSO) | 🟡 (plugin: sso `domainVerification`) |
| **Domain verification by email affiliation** | Ownership is proven instead by receiving a code at an address on that domain. | ❌ | ❌ | ✅ (`email_code` affiliation) | ❌ |
| **Automatic membership for matching email domains** | A user whose email matches a verified domain is joined to the organization without an individual invitation. | ✅ (just-in-time membership) | 🟡 (realm assignment rules) | 🟡 (B2B Auth Enhanced; Automatic Invitation) | 🟡 (plugin: sso `organizationProvisioning`) |
| **Request-to-join with admin approval** | A domain-matched user asks to join and an administrator approves before membership is granted. | ❌ | ❌ | 🟡 (B2B Auth Enhanced; Automatic Suggestion) | ❌ |
| **Consumer and disposable domain exclusion** | Public mailbox providers and throwaway domains are refused as organization domains. | ❌ | ❌ | ✅ (B2B Auth Enhanced) | ❌ |
| **Identity-provider connection bound to one organization** | An enterprise or social connection scoped to a single organization, so its users federate through their own IdP. | ✅ (10 connections per org) | 🟡 (IdP routing rules / realm assignment) | 🟡 (B2B Auth Enhanced + per-connection fee) | 🟡 (plugin: sso `organizationId`) |
| **Just-in-time membership on first federated sign-in** | Signing in through the organization's connection creates the account and the membership on the spot. | ✅ (Organizations plans) | 🟡 (JIT into realm and groups) | 🟡 (same tier as org SSO; per-connection toggle) | 🟡 (plugin: sso; default role or computed) |
| **IdP group or attribute mapped to an organization role** | Membership of a directory group, or an assertion attribute, determines the role held inside the organization. | ✅ (enterprise group-to-role mapping) | ✅ (group rules and group claims) | 🟡 (Directory Sync group role mappings) | 🟡 (plugin: sso `getRole()`) |
| **Customer-administered SSO setup (delegated)** | The business customer's own admin configures their IdP connection from inside the vendor's product, not the vendor's console. | 🟡 (Self-Service Enterprise Config; My Org API in EA) | 🟡 (Partner Admin Portal scope) | 🟡 (B2B Auth Enhanced; Security tab) | 🟡 (endpoints only; build the UI) |
| **Resolve the organization from the email at login**<br>*aka: Home Realm Discovery (Auth0), IdP Discovery (Okta)* | The login form takes an email address and infers which organization or IdP the user belongs to. | ✅ (B2B Essentials+) | ✅ (IdP routing rules) | 🟡 (enterprise connection by domain) | 🟡 (plugin: sso; email or slug) |

### Active organization, session and tokens

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Active organization carried on the session** | The session records which organization the user is currently working in, so requests resolve tenant scope without a parameter. | 🟡 (fixed at login, no session field) | ➖ (a user belongs to exactly one realm) | ✅ (per browser tab) | 🟡 (`session.activeOrganizationId`) |
| **Switch the active organization** | Move an existing session from one organization to another without a full re-login. | 🟡 (re-authenticate with `organization`) | ➖ (single realm per user) | ✅ (all plans) | 🟡 (`setActive`, by ID or slug) |
| **Choose the initial organization at session start** | A default organization is selected when the session is created, so users land in a workspace immediately. | 🟡 (`organization` parameter or picker) | ➖ (single realm per user) | 🟡 (middleware sync / auto-activate) | 🟡 (session-create database hook) |
| **Organization selection prompt during login** | A hosted screen that asks a multi-organization user which organization they are signing in to. | ✅ (Organization Picker; first 20) | ❌ | 🟡 (app-rendered from the org list) | ❌ (app-rendered) |
| **Organization claims in the issued token**<br>*aka: `org_id` / `org_name` (Auth0), `org_id` / `org_role` / `org_permissions` (Clerk)* | The ID token or access token carries the organization context so a resource server can enforce tenant isolation. | ✅ (`org_id`, optional `org_name`) | 🟡 (group claims via expression language) | ✅ (claims in the session token) | 🟡 (plugins: jwt / customSession) |
| **URL pattern binds the request to an organization** | A path segment such as `/orgs/:slug` activates the matching organization for that request. | 🟡 (`organization` parameter on /authorize) | ❌ | ✅ (`organizationSyncOptions`) | 🟡 (resolve the slug, then `setActive`) |
| **Machine credentials scoped to one organization** | A client-credentials app, API key or service token whose issued tokens carry a single organization's context. | ✅ (B2B Professional+; org client grants) | 🟡 (service app per child org) | 🟡 (organization-owned API keys) | 🟡 (plugin: oauthProvider reference ID) |

### Teams (sub-groups inside an organization)

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Teams as a nested layer inside an organization** | A second grouping level below the organization, with its own membership, used to structure members and scope access. | ❌ | ✅ (groups inside a realm) | ❌ | 🟡 (plugin: organization, `teams.enabled`) |
| **Team lifecycle and membership management** | Create, update and delete teams, and move an existing organization member into or out of a team without touching their organization membership. | ❌ | ✅ (Groups / Group Members API) | ❌ | 🟡 (plugin: organization) |
| **Active team on the session** | The session records a current team alongside the current organization. | ❌ | ❌ | ❌ | 🟡 (`setActiveTeam`) |
| **Caps on teams and team size** | Limits on how many teams an organization may hold, how many members each may have, and whether the last team can be removed. | ❌ | 🟡 (org-wide group limits only) | ❌ | 🟡 (`maximumTeams`, `maximumMembersPerTeam`) |
| **Invite or add a member straight into a team** | The invitation names a team so the invitee lands in it on acceptance. | ❌ | 🟡 (pre-assign groups) | ❌ | 🟡 (`teamId` on invite/add) |

### Account modes, delegated administration and metering

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Personal-account vs organization-only mode**<br>*aka: `organization_usage` (Auth0), Personal Accounts toggle (Clerk)* | An instance-level choice of whether users may operate outside any organization, belong only to organizations, or both. | ✅ (Individuals / Business Users / Both) | ➖ (every user belongs to the org) | ✅ (membership required vs optional) | 🟡 (enforced in application code) |
| **Delegated organization administration by the customer**<br>*aka: My Organization API (Auth0), Partner Admin Portal (Okta), `<OrganizationProfile />` (Clerk)* | The business customer's own admins manage their members, invitations, domains and settings from inside your product, without vendor-console access. | 🟡 (My Organization API, Early Access) | 🟡 (Partner Admin Portal; SPA SKU) | ✅ (permission-gated self-service) | 🟡 (endpoints only; build the UI) |
| **Authentication policy scoped to one organization** | MFA, session or sign-on rules that differ per business customer rather than applying instance-wide. | 🟡 (Actions branching on org metadata) | ✅ (group- and realm-scoped policies) | ❌ | 🟡 (custom code in hooks) |
| **Vendor metering of organizations** | How the vendor counts and charges for organizations themselves. | ✅ (plan-capped counts, no per-org fee) | 🟡 (per-org subscription; child-org SKU) | 🟡 (MRO: 100 free, then ~$1/org) | ➖ (self-hosted; no vendor metering) |
| **Organization as the billing subject in your app** | The organization, rather than the individual user, holds the subscription or credit balance your product charges. | ❌ | ❌ | ✅ (org subscriptions + credits) | 🟡 (payment plugins via reference ID) |

---

## 11. Authorization — roles, permissions & policy

This section covers deciding what an authenticated principal may do: role and permission models, where the decision is evaluated (in a token claim or by a lookup), how protected APIs declare their own permissions, and relationship-based authorization. The four products diverge hardest at the bottom of the section: Auth0/Okta ship a full Zanzibar-style relationship engine (Auth0 FGA, sold as Okta FGA, built on the open-source OpenFGA), while Clerk and Better Auth stop at role-and-permission models and point at third-party engines for anything finer. Auth0 and Clerk also differ from Okta in having a first-class end-user role object at all — Okta's application-side authorization is expressed through groups, scopes and (with a governance subscription) entitlements, and its "roles" are console administration roles.

### 11.1 Role and permission model

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Role object with CRUD**<br>*aka: Roles / Authorization Core (Auth0), Organization Roles (Clerk), `ac.newRole()` (BA)* | A named, manageable role entity that end users can hold, created and edited through a console or management API. Auth0 caps 1,000 roles per tenant; Clerk caps 10 custom roles per instance. | ✅ (Essentials+, not Free) | 🟡 (no app-role object; modelled as groups) | ✅ (Hobby for built-ins) | ✅ (plugin: organization) |
| **Permission object with CRUD**<br>*aka: API Permissions / scopes (Auth0), custom scopes or entitlements (Okta), Custom Permissions (Clerk), statements (BA)* | A named unit of authority (`read:posts`, `org:invoices:manage`) that roles are composed from, defined and managed independently of roles. | ✅ (Essentials+; 1,000 per API) | 🟡 (API Access Mgmt SKU or OIG) | 🟡 (custom perms need custom roles) | ✅ (plugin: organization/admin) |
| **Role-to-permission binding** | Attaching and detaching permissions on a role so every holder of the role inherits them. | ✅ (Essentials+) | 🟡 (via group-to-scope/entitlement rules) | 🟡 (B2B Auth add-on in production) | ✅ (plugin: organization/admin) |
| **Built-in default roles**<br>*aka: Admin/Member (Clerk), owner/admin/member (BA)* | A role set shipped out of the box so a tenant model works before any configuration. Okta's built-ins are console admin roles, not end-user roles. | 🟡 (none for end users; define your own) | ➖ (admin roles only — see 11.6) | ✅ (Hobby; `org:admin`, `org:member`) | ✅ (plugin: organization) |
| **Assign a role to a user** | Granting a role to an individual principal via console or API. | ✅ (Essentials+; 50 roles per user) | 🟡 (through group assignment) | ✅ (Hobby; per membership) | ✅ (plugin: organization/admin) |
| **Grant a permission directly to a user**<br>*aka: Assign Permissions to Users (Auth0), Entitlement assignment (Okta)* | Attaching an individual permission to a user without going through a role, for exceptions. | ✅ (Essentials+; 1,000 per user) | 🟡 (OIG entitlements, per-app) | ❌ | ❌ |
| **Role derived from group / directory membership**<br>*aka: Assign Roles to Groups (Auth0), group rules (Okta), IdP group → role mapping (Clerk)* | Mapping a directory or IdP group to a role so membership changes propagate without touching each user. | ✅ (Essentials+; 10 roles per group) | ✅ (all orgs; groups are the vehicle) | 🟡 (Enterprise SSO connections) | 🟡 (teams share org roles; no group mapping) |
| **Organization-scoped roles**<br>*aka: Organization Roles (Auth0), member role (Clerk/BA)* | Roles that exist inside one tenant only, so the same user can hold different roles in different organizations. Auth0 caps 350 org roles per organization and 50 role assignments per member. | ✅ (Organizations plans) | 🟡 (model with groups or Realms) | ✅ (Hobby) | ✅ (plugin: organization) |
| **Multiple roles per principal** | A user holding several roles at once, with permissions unioned. | ✅ (Essentials+; 50 per user) | ✅ (all orgs; multi-group) | ❌ (one role per membership) | ✅ (plugin: organization/admin) |
| **Default and creator role configuration**<br>*aka: Default Role / Creator Role (Clerk), `creatorRole` (BA)* | Settings naming the role a new member receives on joining and the role an organization's creator receives. | 🟡 (roles chosen per invitation) | 🟡 (group rules on profile attributes) | ✅ (Hobby) | ✅ (plugin: organization) |
| **Tenant-defined roles created at runtime**<br>*aka: Role Sets (Clerk), Dynamic Access Control (BA), custom roles modelling (Auth0 FGA)* | End customers defining their own roles and permission sets at run time, per organization, without a redeploy or a platform-admin change. Better Auth persists these in an `organizationRole` table and caps them per organization via `maximumRolesPerOrganization`; Clerk allows 10 custom roles per instance and uses Role Sets to give different tenants different role menus. | 🟡 (org roles via Management API only) | ❌ | 🟡 (B2B Auth add-on for extra sets) | ✅ (plugin: organization) |
| **Runtime role CRUD API**<br>*aka: create/update/delete/list/get role (BA), `/role_sets` (Clerk)* | Endpoints a tenant admin can call to create, read, update, delete and list roles inside their own organization. Better Auth gates these on `ac:create` / `ac:read` and forbids granting a permission the caller does not hold. | 🟡 (tenant-level Management API) | ❌ | 🟡 (B2B Auth add-on) | ✅ (plugin: organization) |
| **Extend rather than replace built-in roles**<br>*aka: `defaultStatements` / `adminAc` (BA)* | Exported default statements and per-role permission sets that a custom role definition can spread into, so redefining a role does not silently drop shipped behaviour. | ➖ (no built-in end-user roles) | ➖ | 🟡 (system permissions are fixed) | ✅ (plugin: organization/admin) |
| **Sub-group (team) permission statements**<br>*aka: `team:create/update/delete` (BA)* | Permissions governing operations on teams inside an organization, evaluated by the same access-control system as everything else. | 🟡 (model as nested orgs) | 🟡 (group-admin permissions) | ❌ | ✅ (plugin: organization, teams) |
| **Effective permission resolution with provenance**<br>*aka: get-user-effective-permissions / role-source-groups (Auth0), Assignment methods (Okta)* | An API that computes a principal's resolved roles and permissions and reports which role, group or policy each one came from. | ✅ (Management API) | 🟡 (OIG governance reports) | ❌ | ❌ |
| **Compile-time typed permissions** | Permission and role names typed by the framework so a wrong resource or action fails at build time rather than at request time. | ❌ (strings) | ❌ (strings) | 🟡 (typed session claims interface) | ✅ (plugin: organization/admin, `as const`) |

### 11.2 Enforcing authorization in application code

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Server-side permission check helper**<br>*aka: `has({ permission })` / `auth.protect()` (Clerk), `hasPermission()` (BA), `requiredScopes()` middleware (Auth0)* | A first-party function the application calls on the server to ask whether the current principal may perform an action. | 🟡 (SDK middleware over token claims) | 🟡 (inspect group/scope claims yourself) | ✅ (Hobby) | ✅ (plugin: organization/admin) |
| **Client-side synchronous role/permission check**<br>*aka: `checkRolePermission()` (BA), `has()` in the browser (Clerk)* | Evaluating a role's permissions locally with no network round trip, for UI gating. Better Auth's client check cannot see dynamically created roles because it reads the statically configured role map. | 🟡 (decode the token yourself) | ❌ | ✅ (Hobby) | ✅ (plugin: organization/admin) |
| **Declarative conditional-render component**<br>*aka: `<Show when={{...}}>`, formerly `<Protect>` (Clerk)* | A UI component that renders children only when an access condition passes. Hides UI only; it is not a data boundary. | ❌ | ❌ | ✅ (Hobby) | ❌ |
| **Throwing route guard**<br>*aka: `auth.protect()` (Clerk)* | A server helper that redirects unauthenticated callers to sign-in and fails closed (404) for authenticated-but-unauthorized callers. | 🟡 (SDK middleware, hand-written) | 🟡 (hand-written) | ✅ (Hobby) | 🟡 (throw from your own middleware) |
| **Roles/permissions carried in the issued token**<br>*aka: `permissions` claim (Auth0), `org_role` / `org_permissions` (Clerk)* | Emitting the principal's authorization data as a token claim so the resource server decides locally instead of calling back. Auth0 makes this a per-API toggle governed by the access-token profile. | ✅ (per-API toggle) | 🟡 (groups/scopes claims; API Access Mgmt for custom) | ✅ (Hobby; session token) | 🟡 (plugin: jwt / customSession) |
| **Permissions excluded from the token, requiring a lookup** | Cases where the authorization data is deliberately not in the token so a server call is required — a correctness trap when only some permissions are claim-backed. Clerk's nine system permissions are not in session claims, so server-side checks work only with custom permissions. | ➖ | ➖ | 🟡 (system permissions are lookup-only) | 🟡 (`hasPermission` is a server call) |
| **Token size budget forcing lookups** | A documented claim-size ceiling that caps how much authorization data can ride in the token. Clerk documents roughly a 1.2 KB budget after default claims; Auth0's permission claim trades token size for fewer lookups. | 🟡 (documented size/latency tradeoff) | 🟡 (per-claim limits) | 🟡 (~1.2 KB claim budget) | 🟡 (depends on cookie/JWT config) |
| **Custom authorization claims injected at token mint**<br>*aka: Create Custom Claims / Actions (Auth0), Claims API + Expression Language (Okta), Claims editor (Clerk), `customSession` (BA)* | Adding application-computed authorization data — entitlements, tenant ids, derived roles — to tokens at issuance. | ✅ (Actions; Rules EOL 18 Nov 2026) | 🟡 (API Access Mgmt for access tokens) | ✅ (Hobby) | ✅ (plugin: customSession) |
| **Force a token refresh after a role change** | Re-minting the token immediately when a role or permission changes server-side, instead of waiting for natural expiry. | 🟡 (re-authenticate or short TTLs) | 🟡 (revoke grants / short TTLs) | ✅ (Hobby) | 🟡 (session refresh, no dedicated API) |

### 11.3 Protected APIs, scopes and machine callers

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Protected API / resource-server registration**<br>*aka: APIs / Resource Servers (Auth0), custom authorization server (Okta), `resources` (BA)* | Registering a protected API as a first-class object with an identifier that becomes the token audience and its own scope list and token settings. | ✅ (all plans) | 🟡 (API Access Management SKU) | 🟡 (scopes on OAuth apps, no API object) | ✅ (plugin: oauthProvider) |
| **Named scopes defined on the API**<br>*aka: API Permissions (Auth0), Authorization Server Scopes (Okta), Custom OAuth scopes (Clerk)* | Declaring the scope vocabulary a protected API accepts, with display metadata and consent requirements. | ✅ (all plans) | 🟡 (API Access Management SKU) | ✅ (Hobby) | ✅ (plugin: oauthProvider) |
| **Per-API RBAC enforcement toggle** | A switch that makes the granted scope the intersection of what was requested and what the user actually holds, rather than anything the client asks for. | ✅ (all plans) | 🟡 (auth-server access policy rules) | ❌ | ❌ |
| **Per-client scope ceiling**<br>*aka: Client Grants (Auth0), Application Grants (Okta), Machine Scopes (Clerk), `clientRegistrationAllowedScopes` (BA)* | Binding an application to an API with the maximum scope set it may ever request, enforced independently of user consent. | ✅ (all plans) | ✅ (all orgs) | ✅ (usage-based, M2M) | ✅ (plugin: oauthProvider) |
| **Per-API application access policy**<br>*aka: allow_all / require_client_grant / deny_all (Auth0)* | A per-API rule deciding which applications may obtain tokens for it at all, configurable separately for user-delegated and client-credentials flows. | ✅ (all plans) | 🟡 (auth-server policies) | ❌ | 🟡 (per-resource allowlist) |
| **Scope-issuance policy on the authorization server**<br>*aka: Authorization Server Policies / Rules (Okta)* | Rules evaluating client, user, group and grant type to decide which scopes are granted and what token lifetimes apply. | 🟡 (Actions can alter scopes) | ✅ (API Access Management SKU) | ❌ | 🟡 (per-resource allowed scopes and TTLs) |
| **Rich Authorization Requests (RFC 9396)**<br>*aka: `authorization_details` / RAR (Auth0)* | Structured, transaction-level authorization requests instead of coarse scope strings — "transfer £500 to account X" rather than `payments:write`. | ✅ (with client-grant `authorization_details_types`) | ❌ | ❌ | ❌ |
| **Scopes and permissions on machine (M2M) callers**<br>*aka: Client Credentials scopes (Auth0), Machine Scopes (Clerk)* | Authorizing service-to-service callers with their own permission set, distinct from any end user. Clerk's machine scopes are directed — which machine may call which. | ✅ (all plans) | ✅ (API Access Management SKU) | ✅ (usage-based) | ✅ (plugin: oauthProvider, client credentials) |
| **Permission sets on user-issued API keys**<br>*aka: API key scopes (Clerk), `permissions` on apiKey (BA)* | A resource-to-actions map attached to a long-lived key an end user or organization creates, enforced at verification. | 🟡 (model as a client grant) | 🟡 (SSWS tokens inherit admin role) | ✅ (GA, usage-priced) | ✅ (plugin: apiKey) |

### 11.4 Attribute-based authorization, policy and entitlements

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Attribute-based access control (ABAC)** | Deciding access from principal, resource, action and environment attributes rather than from a fixed role list. Outside the ReBAC engine, Auth0 does this with Actions code and Okta with Expression Language conditions. | 🟡 (Actions code; native in FGA conditions) | 🟡 (Expression Language in policy rules) | ❌ (custom code) | ❌ (custom code) |
| **Policy expression language**<br>*aka: Okta Expression Language (Okta), CEL conditions (Auth0 FGA)* | A first-party expression syntax for writing authorization conditions declaratively instead of in application code. | 🟡 (CEL inside FGA only) | ✅ (all orgs) | ❌ | ❌ |
| **Custom authorization logic in extensibility code**<br>*aka: Rules for Authorization Policies / Actions (Auth0), Inline hooks (Okta)* | Hook-style code appended to the authorization decision that can grant or strip scopes from arbitrary attributes. Auth0 Actions modifying scopes override RBAC-computed scopes; Auth0 Rules reach EOL 18 November 2026. | ✅ (Actions; Rules EOL Nov 2026) | ✅ (token inline hook) | 🟡 (claims editor, no arbitrary code) | ✅ (hooks, free OSS) |
| **Policy evaluation simulation**<br>*aka: Policy Simulation `/simulate` (Okta), `fga model test` (Auth0)* | Evaluating a hypothetical request against current policy and reporting which rule would match, without performing a real sign-in. | 🟡 (FGA model tests and assertions) | ✅ (all orgs) | ❌ | ❌ |
| **Third-party application entitlement model**<br>*aka: Entitlement Management / Governance Engine (Okta)* | Discovering and managing permissions that live inside a downstream SaaS app, then assigning them from the identity platform. Requires the per-app Governance Engine switch. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Entitlement bundles and role-style resource collections**<br>*aka: Entitlement bundles / Resource collections (Okta)* | Named groups of entitlements, apps and groups granted together as a job-function role, directly assignable and requestable. Resource collections are Early Access. | ❌ | ✅ (OIG SKU; collections EA) | 🟡 (Role Sets are role menus, not bundles) | ❌ |

### 11.5 Relationship-based access control (ReBAC) / fine-grained authorization

Auth0 ships a Zanzibar-style relationship engine as a separate product — hosted as **Auth0 FGA**, sold under the Okta brand as **Okta Fine Grained Authorization** since 5 March 2024 (the Okta product URL redirects to the Auth0 one), and open-sourced as **OpenFGA** (Apache-2.0, CNCF Incubating). Clerk and Better Auth have no equivalent: Clerk's own guidance is to supply identity claims and hand resource-level decisions to an external engine such as OpenFGA, Oso, Cerbos or Permit.io. Every row below is one capability of that engine, so the size of the gap is visible rather than collapsed into a single verdict. Because it is a separate product on a separate ladder, the Okta column is marked gated throughout.

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **First-party relationship-based authorization service**<br>*aka: Auth0 FGA (Auth0), Okta Fine Grained Authorization (Okta)* | A managed service answering per-object permission questions from stored relationships rather than from roles in a token, GA since 5 March 2024 and run active-active across at least two regions per locality. | ✅ (Free trial / Enterprise) | 🟡 (Okta FGA, separate product) | ❌ | ❌ |
| **Self-hostable open-source engine**<br>*aka: OpenFGA* | The Go engine behind the hosted service, exposing HTTP and gRPC APIs, embeddable as a library, with Docker images and an official Helm chart. | ✅ (Apache-2.0, CNCF Incubating) | ✅ (same engine) | ❌ | ❌ |
| **Authorization model DSL** | Type definitions expressing the system's permission rules, authored in a purpose-built DSL or equivalent JSON. Maximum model size 400 KB on both hosted tiers. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Immutable model versioning** | Models are never edited or deleted; each write mints a new version identified by a time-ordered ULID, and queries can pin a version. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Modular models and type extension**<br>*aka: `fga.mod`, `extend type`* | Splitting one model across files owned by different teams and adding relations to another module's type without editing it. Hosted support is CLI-only; write credentials can be scoped per module (max 15 modules per client). | ✅ (GA, schema 1.2) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Store as isolation container** | A top-level container holding model versions and tuples, with no sharing across stores. Free trial 10 stores, Enterprise 20. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Relationship tuples** | The stored `(user, relation, object)` triple that is the only persisted authorization data; objects carry no attributes of their own. Free trial 50,000 tuples per store, Enterprise 10 million. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Usersets (grant to a whole group)**<br>*aka: `organization:acme#member`* | Addressing a set of users on the user side of a tuple, so an entire group — including nested groups — gains a relation in one write. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Type restrictions and public-access wildcard**<br>*aka: Directly Related User Types, `<type>:*`* | Declaring which user types, usersets and wildcards may be directly assigned to a relation, including a wildcard meaning every object of a type. | ✅ (GA, schema 1.1+) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Set operators: union, intersection, exclusion**<br>*aka: `or` / `and` / `but not`* | Combining usersets to express any-of, all-of and deny rules; exclusion is the primitive behind blocklists and explicit denies. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Hierarchy traversal (tuple-to-userset)**<br>*aka: `viewer from parent`* | Evaluating a relation on a related object, which is how folder/document inheritance and any nested hierarchy is modelled. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Conditions (ABAC on relations)**<br>*aka: Condition, conditional relationship tuple* | Named CEL functions with typed parameters attached to a relation, so a grant holds only when a time window, IP range or other predicate passes; parameters may be fixed at write time or supplied at query time. | ✅ (GA, schema 1.1+) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Contextual tuples** | Tuples supplied inline with a query that behave as stored for that request only and are never persisted — used to pass token claims or session organization context without syncing a directory. Limit 100 per request. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Check API (single decision)** | Returns a boolean for one user/relation/object triple, resolving implied relationships through the model. Free trial 20 req/s, Enterprise 500 req/s. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **BatchCheck API** | Evaluates many check items in one request with per-item correlation ids; server maximum 50 checks per call, recommended over parallel checks from about ten upward. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **ListObjects API**<br>*aka: StreamedListObjects* | Returns every object of a type a user holds a relation to — the query that makes permission-aware list screens possible. Default cap 1,000 results (10,000 for Enterprise from 2026); a streaming variant is bounded only by the deadline. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **ListUsers API** | The inverse query: which users hold a relation to one object, narrowed by user filters, returning objects, usersets and wildcard markers. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Decision explanation**<br>*aka: Expand API, relationship graph, ListRelations* | Returning the userset tree behind one relation so a developer can see why access resolved, plus an SDK helper reporting which of a set of relations hold. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Tuple read and transactional write** | Reading stored tuples by partial filter without model traversal, and adding/removing tuples in an all-or-nothing transaction (40 tuples per transaction on the hosted service), with idempotent and non-transactional bulk variants. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Tuple changelog**<br>*aka: ReadChanges* | A chronological, paged log of tuple writes and deletes — the basis for maintaining a local permission-aware search index. Contextual tuples never appear in it. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Per-request consistency control**<br>*aka: MINIMIZE_LATENCY / HIGHER_CONSISTENCY* | Choosing between cached and datastore-fresh evaluation per query. On the hosted service two 10-second cache layers mean a default read can be up to 20 seconds stale after a write. | ✅ (GA) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Declarative model tests and assertions**<br>*aka: `fga model test`, WriteAssertions, `.fga.yaml` store file* | Test cases asserting expected check, list-objects and list-users outcomes against a specific model version, runnable locally and in CI. | ✅ (GA; CI actions are OSS) | 🟡 (Okta FGA) | ❌ | ❌ |
| **Precomputed permissions index**<br>*aka: FGA Permissions Index* | A managed materialized view precomputing a relation's transitive closure at write time, turning multi-hop checks into constant-time lookups. Eventually consistent; does not support conditions, contextual tuples or wildcard negations. | 🟡 (Developer Preview, Enterprise, manual setup) | 🟡 (same, via account team) | ❌ | ❌ |
| **Published pricing for the authorization engine** | Whether the ReBAC product's cost can be determined without a sales conversation. Auth0 FGA Enterprise is quote-only and the product does not appear on the Auth0 pricing page; only the free trial's limits are public. | ❌ (Enterprise is quote-only) | ❌ (quote-only) | ➖ | ➖ |

### 11.6 Delegated administration of the vendor's own console

Authorization over the identity product itself: which staff administrators may change what. Okta is by far the most granular here; Better Auth has no hosted console outside the commercial infrastructure layer.

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Built-in console administrator roles**<br>*aka: Dashboard Access by Role (Auth0), Super/Org/App/Group/Help Desk Admin (Okta), Dashboard team roles (Clerk)* | A shipped set of least-privilege roles for staff who administer the identity product. Auth0 ships ten (Admin, Editor variants, Viewer variants, Elevated Support Access) but gates them by plan — Free is Admin-only, Essentials adds Viewer, Professional and Enterprise add the Editor roles; Okta ships a dozen-plus standard roles; Clerk ships five, with all five only on Business. | ✅ (role set varies by plan) | ✅ (all orgs) | ✅ (Owner/Viewer on Hobby, all five on Business) | 🟡 (Commercial `@better-auth/infra` dashboard) |
| **Custom console administrator roles**<br>*aka: Custom admin roles / Custom Roles API (Okta)* | Admin-defined roles assembled from a granular permission picker, rather than only the shipped standard roles. Okta caps 100 custom roles per org and exposes a large permission catalog (Users, Groups, Apps, Authorization Servers, Realms, Workflows, Policies, Hooks and more). | ❌ (fixed role list) | ✅ (all orgs; 100 per org) | ❌ (fixed role list) | ❌ |
| **Scoping an admin role to a subset of resources**<br>*aka: Resource sets / Role Targets (Okta), Editor – Specific Apps (Auth0)* | Restricting what a delegated administrator's permissions apply to — named groups, apps, authorization servers or customizations — so they cannot see or touch anything else. Okta allows 10,000 resource sets per org and 1,000 resources per set. | 🟡 (Editor – Specific Apps only) | ✅ (all orgs) | 🟡 (Developer role is dev-instance only) | ❌ |
| **Three-part admin binding (principal, role, resource set)** | Assigning administration as an explicit binding of who, which role and over which resources, including assignment to groups and to client applications so a service principal can hold admin scope. Up to 1,000 admins may share one role plus resource-set pair. | 🟡 (role assignment only) | ✅ (all orgs) | ❌ | ❌ |
| **Read-only override on an existing administrator**<br>*aka: Auditor (Read-Only) mode (Okta)* | A flag a super admin applies to an existing admin or admin group that downgrades every one of their role assignments to read-only, preserving visibility without modification rights. | 🟡 (assign a Viewer role instead) | ✅ (all orgs) | 🟡 (assign the Viewer role instead) | ❌ |
| **Delegated administration of the ReBAC engine's own console**<br>*aka: FGA dashboard roles and groups (Auth0)* | Separate role model inside the fine-grained-authorization console: Account Owner, Group Manager, Store Editor and Store Viewer, with groups holding roles scoped to a chosen set of stores. Caps of 30 members and 20 groups per account. | ✅ (hosted FGA; shipped 30 Jan 2026) | 🟡 (Okta FGA) | ➖ | ➖ |
| **Admin privilege audit report**<br>*aka: Admin Role Assignments report (Okta), Admin Logs (Clerk)* | A report or log enumerating who holds administrative privilege and what administrative changes were made, including role and permission edits. | 🟡 (tenant member list; no report) | ✅ (all orgs) | 🟡 (Admin Logs, Business+) | 🟡 (Commercial `@better-auth/infra` audit logs) |

---

## 12. Identity governance, provisioning & lifecycle automation

This is the section where the four products diverge most. Okta ships a full governance stack — outbound provisioning to downstream applications, HR-driven joiner/mover/leaver automation, access requests, certification campaigns, entitlement management, separation of duties, privileged access management and a no-code automation engine — almost all of it behind separately priced SKUs (Lifecycle Management, Okta Identity Governance, Okta Privileged Access, Okta Workflows). Auth0, Clerk and Better Auth stop at provisioning: all three accept an inbound SCIM 2.0 feed and do just-in-time provisioning, and none has access requests, certification campaigns, an entitlement catalog, separation-of-duties policy or credential vaulting. Better Auth's SCIM server is a genuine free OSS plugin rather than a paid tier, though its documented protocol surface is narrower than the hosted vendors'.

### 12.1 Inbound provisioning and directory synchronization

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **SCIM 2.0 inbound user provisioning**<br>*aka: Inbound SCIM (Auth0), Provisioning to Okta / Anything-as-a-Source (Okta), Directory Sync (Clerk), `scim` plugin (BA)* | The product hosts a SCIM 2.0 service that an upstream directory or IdP calls to create, update and deactivate user records inside it. | ✅ (GA, enterprise connections) | 🟡 (pull imports / XaaS API) | ✅ (Pro/Business + connection) | ✅ (plugin: scim, MIT) |
| **SCIM 2.0 inbound group provisioning** | The same inbound service accepts group resources and membership changes, not only users. | ✅ (SCIM Groups GA) | 🟡 (group import, not SCIM) | ✅ (Pro/Business + connection) | ✅ (plugin: scim, MIT) |
| **SCIM 2.0 outbound provisioning to downstream apps**<br>*aka: Provisioning to App / Lifecycle Management (Okta), Send Outbound SCIM (Auth0)* | The product acts as the SCIM client, pushing account create/update/deactivate operations into third-party applications that host a SCIM server. | 🟡 (event stream + custom Action) | ✅ (Lifecycle Management SKU) | ❌ | ❌ |
| **SCIM server protocol surface** | How much of SCIM a directory can exercise: ServiceProviderConfig/Schemas/ResourceTypes discovery, collection filtering and pagination, and ordered atomic PATCH. Better Auth documents bulk operations, POST search, `/Me`, ETags, cursors, sorting and non-equality filters as out of scope. | ✅ (GA) | ➖ (acts as SCIM client) | ✅ (Okta, Entra, custom) | 🟡 (no bulk, `/Me`, ETags, sorting) |
| **Zero-downtime provisioning credential rotation** | Issuing a replacement provisioning credential that overlaps the outgoing one so the directory switches without a failed sync window. Credential types range across bearer tokens, HTTP basic and OAuth 2.0. | ✅ (issue/revoke per connection) | 🟡 (manual reconfiguration) | ✅ (rotate directory API key) | ✅ (overlapping `expiresAt` credentials) |
| **Per-tenant provisioning connections** | Many isolated directory connections in one deployment, each owning its own users, groups and credentials, so each business customer provisions independently. | ✅ (per enterprise connection) | 🟡 (per app integration) | ✅ (per organization) | ✅ (connections + provisioning domains) |
| **Custom attribute mapping from the directory**<br>*aka: User Attribute Profile (Auth0), Profile Mappings (Okta), Custom Attribute Mapping (Clerk)* | Mapping arbitrary IdP or SCIM attributes onto the local profile, including a vendor schema extension for attributes outside the SCIM core. | ✅ (per-protocol mapping) | ✅ (Okta Expression Language) | ✅ (into `publicMetadata`) | 🟡 (Enterprise extension only) |
| **Attribute-level mastering (profile source of truth)**<br>*aka: profile source / Field Override Service (Okta), Sync Users at Login (Auth0)* | Declaring which upstream system owns which profile attribute, so locally edited fields survive and directory-owned fields become read-only. | 🟡 (per-connection sync toggle) | ✅ (profile sources, LCM SKU) | 🟡 (synced attributes read-only) | 🟡 (one profile-managing source) |
| **Just-in-time provisioning on first federated sign-in**<br>*aka: Create users during sign-in (Clerk), `provisionUser` (BA)* | Creating the local user record at the first successful SSO sign-in instead of pre-provisioning it, optionally re-running the sync on every subsequent sign-in. | ✅ (enterprise connections) | ✅ (Universal Directory / LCM) | ✅ (Pro/Business, per connection) | ✅ (plugin: sso, MIT) |
| **Just-in-time tenant membership provisioning** | Adding the user to the business-customer tenant tied to the connection they signed in through, with a default or computed role. | ✅ (Organizations plans) | ➖ (no tenant sub-entity) | ✅ (Pro/Business + connection) | ✅ (plugin: sso, MIT) |
| **Directory group to application role mapping** | Translating an IdP or SCIM group into application roles so directory membership drives authorization. | ✅ (tenant and org scope) | ✅ (group rules, LCM SKU) | 🟡 (B2B add-on; no nested groups) | ✅ (plugin: scim projection) |
| **Directory-owned grant reconciliation** | Recomputing exactly the access the directory should confer for a user and replacing only directory-owned grants, leaving manually assigned access intact. | 🟡 (group-to-role assignment) | ✅ (entitlement policies, OIG SKU) | 🟡 (group role mappings) | ✅ (plugin: scim `reconcileUser`) |
| **Create-or-link identity resolution on provisioning**<br>*aka: user matching rules / import inline hook (Okta), `identity.resolveUser` (BA)* | Deciding whether an incoming directory record links to an existing local user or creates a new one, through an application-controlled hook rather than implicit email matching. | 🟡 (account linking via Actions) | ✅ (matching rules + inline hook) | 🟡 (matches on identifier) | ✅ (plugin: scim, explicit only) |
| **Non-SCIM directory pull (AD / LDAP / Google Workspace)** | Reading an external directory over its own protocol or admin API instead of SCIM, typically on a polling schedule. | 🟡 (AD/LDAP Connector) | ✅ (AD and LDAP agents) | ✅ (Google Admin SDK, 5-min poll) | ❌ |
| **Scheduled incremental and full imports** | Recurring background import runs — incremental runs fetch only changes, full runs can deactivate records that left the source — plus admin-triggered on-demand runs. | ❌ | ✅ (hourly/daily/weekly, LCM SKU) | 🟡 (Google polling only) | ➖ (directory pushes; no pull) |
| **Mass-unassignment safeguards** | A threshold that halts an import which would deactivate or unassign more than a configured share of users, so a broken source feed cannot strip access at scale, with a monitoring surface to resolve and resume. | ❌ | ✅ (app 20% / org-wide, LCM SKU) | ❌ | ❌ |
| **HR system as authoritative source**<br>*aka: HR-as-master (Okta)* | Treating an HR application (Workday, SuccessFactors, UKG, BambooHR, Namely) as the read-only system of record that feeds identity in and is never written back to. | ❌ | ✅ (Lifecycle Management SKU) | ❌ | 🟡 (any SCIM-capable HR feed) |
| **Event-driven termination sync** | Pushing time-critical HR events, notably terminations, immediately rather than waiting for the next scheduled import. | ❌ | ✅ (Workday Real-Time Sync) | ❌ | 🟡 (directory-driven, no schedule) |
| **On-premises provisioning agent** | A customer-hosted agent that lets the identity service provision into applications unreachable from the internet, with a high-availability pairing option. | ❌ | ✅ (OPP agent, LCM SKU) | ❌ | ➖ (self-hosted already) |
| **Delegated self-service directory setup** | A surface where the business customer's own IT administrator configures their SCIM connection and issues or rotates its token, without the vendor's engineers. | 🟡 (My Organization API, EA) | ➖ (customer is the tenant) | 🟡 (Dashboard, B2B add-on) | 🟡 (@better-auth/infra dashboard) |
| **Transactional provisioning with rollback** | Running each directory write and the application's identity callbacks in one database transaction, so a failing callback rolls the directory change back. | ➖ (hosted; not exposed) | ➖ (hosted; not exposed) | ➖ (hosted; not exposed) | ✅ (plugin: scim, native transactions) |

### 12.2 Outbound provisioning and group push

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Downstream account creation**<br>*aka: Create Users (Okta)* | Creating an account in an assigned third-party application for every user who gains access to it. | 🟡 (custom Action per app) | ✅ (Lifecycle Management SKU) | ❌ | ❌ |
| **Downstream profile update push**<br>*aka: Update User Attributes (Okta)* | Propagating profile attribute changes outward into the linked downstream account. | 🟡 (custom Action per app) | ✅ (Lifecycle Management SKU) | ❌ | ❌ |
| **Downstream deactivation on unassignment**<br>*aka: Deactivate Users (Okta)* | Deactivating the downstream account when the user loses the assignment or is deactivated upstream, and reactivating it on reassignment. | 🟡 (custom Action per app) | ✅ (Lifecycle Management SKU) | ❌ | ❌ |
| **Password synchronization to downstream apps**<br>*aka: Sync Password (Okta)* | Keeping the downstream application's password identical to the central one, or generating a unique random password per account. | ❌ | ✅ (Lifecycle Management SKU) | ❌ | ❌ |
| **Group push to downstream applications**<br>*aka: Group Push (Okta)* | Pushing groups and their memberships outward into provisioning-enabled applications, selected explicitly or by a name-match rule, and optionally linked to a group that already exists in the target. | ❌ | ✅ (Lifecycle Management SKU) | ❌ | ❌ |
| **Entitlement provisioning over SCIM** | Provisioning fine-grained in-app entitlements (roles, licences) alongside users and groups to a SCIM target, including discovery of entitlements in on-premises apps. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |

### 12.3 Lifecycle states and joiner/mover/leaver automation

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **User lifecycle state machine**<br>*aka: user account status (Okta), `blocked` (Auth0), ban / lock (Clerk), ban (BA)* | A defined set of account states — staged, active, suspended, deactivated and so on — with documented transitions and different effects on assignments and credentials. Only Okta distinguishes a reversible suspension that keeps assignments from a deactivation that strips them. | 🟡 (blocked flag only) | ✅ (8 states, base platform) | 🟡 (ban and lock only) | 🟡 (plugin: admin; ban only) |
| **Lifecycle transition API** | Programmatic activate / reactivate / suspend / unsuspend / unlock / deactivate operations, constrained by the record's current state. | 🟡 (block, unblock, delete) | ✅ (User Lifecycle API) | 🟡 (ban, unban, lock, unlock) | 🟡 (plugin: admin) |
| **Deprovisioning revokes live sessions** | Sessions and refresh tokens are invalidated the moment the account is deactivated upstream, rather than surviving until natural expiry. | ✅ (revoke-access endpoint) | ✅ (deactivate + Universal Logout) | ✅ (SCIM deactivate revokes sessions) | ✅ (plugin: scim deletes sessions) |
| **Sign-in gated on active provisioning** | Refusing federated sign-in for an identity the directory has deactivated, deleted or never provisioned, even while the IdP still authenticates it. | 🟡 (Actions check) | ✅ (app assignment required) | ✅ (deprovisioning check per token) | ✅ (plugin: scim + sso pairing) |
| **Condition-driven lifecycle automation**<br>*aka: Automations (Okta)* | A rule engine that watches for conditions such as user inactivity or password expiration within a group and fires an action or state change on a schedule. | ❌ | ✅ (Okta Automations) | ❌ | ❌ |
| **Joiner/mover/leaver orchestration from HR events** | Using hire, role-change, termination and rehire events from the HR source to drive downstream account creation, entitlement change and deprovisioning end to end. | ❌ | ✅ (Lifecycle Management SKU) | ❌ | ❌ |
| **Re-provisioning continuity after deletion** | Recreating a previously removed directory identity reattaches it to the original local user instead of producing a duplicate. | ❌ | 🟡 (reactivate a deactivated user) | ❌ | ✅ (plugin: scim tombstones) |

### 12.4 Access requests and approval workflows

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Self-service access request**<br>*aka: Access Requests (Okta)* | An end user requests access to an application, group or entitlement bundle and the request is routed for approval before access is granted, optionally for a bounded duration after which it is revoked automatically. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Resource-scoped request policy**<br>*aka: access request conditions (Okta)* | Rules on a resource defining who may request it, at what access level, for how long, and through which approval sequence. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Multi-step approval chain**<br>*aka: approval sequence (Okta)* | An ordered series of approvers, all of whom must approve before access is granted, reusable across resources. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **No-code request workflow builder**<br>*aka: request types (Okta)* | Composing a request process from questions, approvals, custom and action tasks, timers and automation steps, each routed to an assignee, so fulfillment runs automatically once approved. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **End-user resource catalog** | A browsable catalog of requestable applications, groups and bundles presented to end users, with configurable visibility and audience scoping. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Approval and review delegation** | A reviewer or approver hands their queue to someone else temporarily or permanently; delegation applies only to new tasks and does not cascade. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Chat and ITSM approval integrations** | Submitting and approving requests from Slack or Microsoft Teams, and syncing fulfillment into Jira or ServiceNow. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |

### 12.5 Access certification and review campaigns

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Access certification campaigns**<br>*aka: Access Certifications (Okta)* | Scheduled or recurring reviews in which designated reviewers certify whether each identity should keep its access, producing an auditable decision record. Multi-level reviews add a second tier after the first. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Resource-scoped campaign** | A campaign anchored on one or more resources, reviewing every user who holds access to them; preconfigured templates cover common cases such as inactive users. | ❌ | ✅ (no OIG subscription needed) | ❌ | ❌ |
| **Identity-scoped campaign**<br>*aka: identity campaign, formerly user campaign (Okta)* | A campaign anchored on a set of identities, reviewing every resource and admin role those identities can reach. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Reviewer resolution rules** | Deciding per campaign who reviews each item — a named user, the reviewee's manager, a group, the resource owner or an expression — with a mandatory fallback reviewer and guardrails against self-review or bulk decisions. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Automated remediation of revoked access** | Defining what happens on approve, revoke or reviewer non-response: manual handling, automatic removal including from third-party applications, or a custom automation flow. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Incident-driven access review**<br>*aka: Security Access Reviews (Okta)* | A targeted out-of-band review of one user's access and how it was granted, launchable from the console, by API, or automatically from a security-event webhook. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Administrator role certification** | Treating each admin role plus its resource scope as a reviewable item so privileged assignments are certified like application access. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |

### 12.6 Entitlements, ownership and separation of duties

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Entitlement management**<br>*aka: Entitlement Management (Okta)* | A central catalog of the fine-grained permissions and access levels that live inside third-party applications, discovered automatically for provisioning-enabled apps and assignable by policy. Requires the governance engine to be enabled per app. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Entitlement bundles** | Named sets of entitlements granted together as one requestable unit; resource collections extend the same idea to apps and groups as a business role. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Resource ownership** | Assigning accountable owners to applications, groups, entitlements and bundles, who are then auto-routed the approvals and review items for them. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Governance metadata labels** | Key/value labels on resources, including predefined criticality labels, used to scope campaigns and prioritize reviews. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Separation-of-duties policy**<br>*aka: SoD rules (Okta)* | Declaring entitlement combinations that must not coexist, evaluated at request time against existing assignments, with allow, block and allow-with-oversight enforcement plus a conflict report. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Governance reporting** | Reports covering entitlements assigned per user, active campaign configuration and completion rates, an auditor-formatted compliance package, and an export of past access requests and outcomes. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |
| **Governance management API** | A REST API covering campaigns, reviews, entitlements, bundles, grants, collections, resource owners, labels and delegates, plus end-user-scoped endpoints for requests, catalog and review tasks. | ❌ | ✅ (OIG SKU) | ❌ | ❌ |

### 12.7 Privileged access management

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Privileged access management suite**<br>*aka: Okta Privileged Access, formerly Advanced Server Access (Okta)* | A product covering infrastructure access, credential vaulting and rotation, approval-gated privileged sessions and session recording. Advanced Server Access reaches end of sale on 1 May 2026, with migration required within a year of renewal. | ❌ | ✅ (Privileged Access SKU) | ❌ | ❌ |
| **Credential vault**<br>*aka: secrets and secret folders (Okta)* | Encrypted storage of credentials, API tokens and keys in a folder hierarchy, with per-principal create/reveal/update/delete rights set by policy and a version history of past rotations. | ❌ | ✅ (Privileged Access SKU) | ❌ | ❌ |
| **Credential checkout, check-in and rotation** | Exclusive time-limited checkout of a privileged account password, with automatic rotation on check-in or timeout so the credential cannot be retained, plus scheduled and manual rotation modes. | ❌ | ✅ (Privileged Access SKU) | ❌ | ❌ |
| **Just-in-time privileged elevation** | Requiring an approved access request before a privileged resource becomes reachable, with the approval opening a bounded access window rather than standing privilege. | ❌ | ✅ (Privileged Access SKU) | ❌ | ❌ |
| **Privileged session recording** | Recording complete SSH and RDP sessions for audit, with logs cryptographically signed so tampering is detectable. | ❌ | ✅ (Privileged Access SKU) | ❌ | ❌ |
| **Identity-based server and Kubernetes access** | Connecting to Linux/Windows hosts and Kubernetes clusters with the central identity instead of static keys, proxied through a gateway that replaces an SSH bastion, with centrally managed sudo rules. | ❌ | ✅ (Privileged Access SKU) | ❌ | ❌ |
| **Service, shared and break-glass account control** | Discovering local, Active Directory, database and SaaS accounts and converting them into managed accounts whose credentials are vaulted, rotated and released under policy. | ❌ | ✅ (Privileged Access SKU) | ❌ | ❌ |
| **Secretless workload credentials** | Workloads and CI/CD runners authenticate with a runtime OIDC token or attested JWT with no on-disk secret, or with managed short-lived API keys that can be rotated and revoked. | ❌ | ✅ (Privileged Access SKU) | ❌ | ❌ |

### 12.8 No-code automation and orchestration of identity events

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **No-code identity automation platform**<br>*aka: Okta Workflows (Okta), Flows (Auth0)* | A visual builder composing third-party integrations and logic into executable identity and administration processes without code. Auth0's Flows run only as the server-side logic behind a login-time Form, not as standalone identity automation. | 🟡 (login-time Forms only) | ✅ (Workflows add-on) | ❌ | ❌ |
| **Identity event triggers** | Automation started by a change in the identity system or a connected application, delivered by webhook in real time or by polling where the service has no webhooks. | 🟡 (login-time only) | ✅ (Workflows add-on) | ❌ | ❌ |
| **Scheduled flows** | Time-triggered automation on hourly, daily, weekly or monthly intervals. | ❌ | ✅ (Workflows add-on) | ❌ | ❌ |
| **HTTP-invocable flows** | Exposing a flow at a stable invoke URL so an external system can start it and receive its output, protected by scoped OAuth 2.0, an embedded client token, or nothing. | ❌ | ✅ (Workflows add-on) | ❌ | ❌ |
| **Admin-runnable delegated flows** | Automation an administrator runs from the admin console without access to the builder, gated by a custom admin role holding a run permission. | ❌ | ✅ (Workflows add-on) | ❌ | ❌ |
| **Connector catalog and custom connector authoring** | Packaged integrations supplying a service's event and action cards, plus a builder for authoring new connectors from an API specification and publishing them privately or publicly. | 🟡 (fixed integration list) | ✅ (Workflows add-on) | ❌ | ❌ |
| **Built-in data store for automation**<br>*aka: Tables (Okta)* | Relational-style storage that flows read and write without an external database, with CSV import and export. | ❌ | ✅ (Workflows add-on) | ❌ | ❌ |
| **Automation execution history and log streaming** | Per-run records of each step's inputs, outputs and outcome for debugging, plus streaming of flow lifecycle events to an external SIEM for retention beyond the built-in window. | 🟡 (flow execution debugger) | ✅ (Workflows add-on) | ❌ | ❌ |

---

## 13. Extensibility — custom logic, hooks & integrations

This area covers running your own code inside, or in reaction to, the identity system. The three hosted products expose a fixed, vendor-defined set of extension points that fire vendor-side — Auth0 runs your JavaScript in its own sandbox, Okta calls out to an HTTPS endpoint you host and blocks on the reply, and Clerk offers no synchronous extension point at all, only asynchronous webhooks. Better Auth is a library running in your own process, so its entire surface is extensible and "custom logic" means ordinary application code; its plugin system is correspondingly broader and entirely unmanaged, with no vendor-run runtime, versioning, secret store or delivery guarantees behind it.

### 13.1 Synchronous (inline) extension points

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Custom code inside the authentication pipeline**<br>*aka: Actions (Auth0), Inline hooks (Okta), hooks and plugins (BA)* | Customer-authored code invoked while an authentication or registration transaction is in flight, able to change its outcome. Auth0 runs versioned Node.js functions in its own tenant-scoped sandbox (20 s per trigger execution); Okta makes an outbound HTTPS call to code you host and pauses the flow awaiting the response (3 s timeout); Better Auth code runs in your process. Clerk has no synchronous extension point — reactions are asynchronous webhooks only. | ✅ (all plans) | ✅ (inline hooks) | ❌ | ✅ (Core) |
| **Pre-registration hook**<br>*aka: `pre-user-registration` trigger (Auth0), Registration inline hook (Okta), `databaseHooks.user.create.before` (BA)* | Runs before a user record is created so custom code can deny the registration, or normalize and seed the profile. Auth0's trigger fires only on database and passwordless connections, never on social; Okta's also covers progressive profile enrollment. Clerk offers declarative sign-up restrictions (allowlist, blocklist, blocked subaddresses) but no code hook. | ✅ (all plans) | ✅ (inline hook) | ❌ | ✅ (Core) |
| **Post-registration hook**<br>*aka: `post-user-registration` trigger (Auth0), `user.created` event (Clerk), `databaseHooks.user.create.after` (BA)* | Runs after a user is created for side effects such as CRM sync or a welcome message. Auth0's trigger is asynchronous and does not fire for social connections. Okta and Clerk have no inline equivalent; both reach this point only through asynchronous event delivery. | ✅ (all plans) | 🟡 (event hook, async) | 🟡 (webhook, async) | ✅ (Core) |
| **Post-authentication hook**<br>*aka: `post-login` trigger (Auth0), `hooks.after` (BA)* | Runs after credentials are verified but before tokens are issued — the point at which access can be denied, claims added, the profile enriched, step-up MFA forced, or the user redirected. This is Auth0's primary extension point. Okta has no login-time inline hook: claim changes go through the token inline hook and downstream reactions through event hooks. | ✅ (all plans) | ❌ | ❌ | ✅ (Core) |
| **Token minting hook (custom claims from your own code)**<br>*aka: `api.accessToken.setCustomClaim` in post-login (Auth0), Token inline hook (Okta), session token customization (Clerk), `customSession` plugin (BA)* | Custom code invoked while an ID or access token is being minted, able to add or rewrite claims. Clerk's session-token claims are declarative shortcodes configured in the Dashboard, not executable code. | ✅ (all plans) | 🟡 (API Access Management) | 🟡 (declarative claims only) | ✅ (plugin: customSession) |
| **Machine-to-machine token issuance hook**<br>*aka: `credentials-exchange` trigger (Auth0), Token inline hook (Okta)* | Runs before an access token is returned in the Client Credentials Flow, so custom code can shape the token's contents or refuse issuance. | ✅ (all plans) | 🟡 (API Access Management) | ❌ | 🟡 (plugin: oauthProvider + hooks) |
| **Token exchange hook (RFC 8693)**<br>*aka: `custom-token-exchange` trigger (Auth0)* | Runs during token exchange so custom code can validate an externally issued subject token and decide which token the identity provider should return in its place. | ✅ (Actions trigger) | ❔ (unverified) | ❌ | ❌ |
| **Post-password-change hook**<br>*aka: `post-change-password` trigger (Auth0), `user.account.update_password` event (Okta), `databaseHooks.account.update.after` (BA)* | Runs after a password change completes, for notification or downstream synchronization. Okta and Clerk expose this only as an asynchronous event, not an inline hook. | ✅ (all plans) | 🟡 (event hook, async) | 🟡 (webhook, async) | ✅ (Core) |
| **Password-reset step-up hook**<br>*aka: `password-reset-post-challenge` trigger (Auth0)* | Runs after the first challenge in a password-reset flow but before the password is actually written, allowing an additional verification step to be inserted. | ✅ (all plans) | ❌ | ❌ | 🟡 (hooks.before on reset path) |
| **SAML assertion customization by custom code**<br>*aka: SAML assertion inline hook (Okta), `api.samlResponse.setAttribute` in post-login (Auth0)* | Custom code invoked while the product generates a SAML assertion as identity provider, able to add or rewrite attribute statements. Clerk and Better Auth consume SAML as a service provider rather than issuing assertions. | 🟡 (post-login Action) | ✅ (inline hook) | ➖ | ➖ |
| **Lazy password migration hook**<br>*aka: `login` custom database script in import mode (Auth0), Password import inline hook (Okta), `password.verify` (BA)* | Fires on a migrated user's first sign-in so custom code can verify the supplied password against a legacy store, letting credentials migrate gradually instead of forcing a reset. Clerk instead accepts pre-hashed passwords on bulk import, naming the hashing algorithm, with no verification callback. | ✅ (custom DB connection) | ✅ (inline hook) | 🟡 (bulk hash import only) | 🟡 (Core — custom verify fn) |
| **User import transformation hook**<br>*aka: User import inline hook (Okta), `get_user` custom database script (Auth0)* | Fires per record during a directory or application user import so custom code can transform, enrich or reject each incoming user. | 🟡 (custom DB scripts) | ✅ (inline hook) | ❌ | ✅ (Core — databaseHooks) |
| **Custom user store / external database authentication**<br>*aka: Custom Database Connections (Auth0), Delegated Authentication (Okta), database adapters (BA)* | Authenticating against a user store the product does not own. Auth0 runs six customer-authored scripts — `login`, `create`, `verify`, `change_password`, `get_user`, `delete` — against an external store, in either "use my own database" or progressive-import mode. Okta reaches on-premises AD/LDAP through its agents but has no arbitrary-script store. Clerk is always the store of record; you mirror its data outward via webhooks. Better Auth writes to your own database through an adapter (Kysely, Drizzle, Prisma, MongoDB, or a hand-written one). | ✅ (custom DB connection) | 🟡 (AD/LDAP delegated auth) | ❌ | ✅ (Core) |
| **Deny or abort a transaction from extension code**<br>*aka: `api.access.deny()` (Auth0), inline hook `error` object (Okta), `APIError` (BA)* | A structured way for extension code to stop the in-flight transaction and surface a specific error to the user or the calling application. Better Auth adds centralized handling via `onAPIError` and a themeable served error page. | ✅ (all plans) | ✅ (inline hook) | ❌ | ✅ (Core) |
| **Redirect out of the flow and resume**<br>*aka: Redirect with Actions / `api.redirect.sendUserTo()` (Auth0)* | Suspends the hosted authentication pipeline, sends the user to an external URL carrying signed state, and resumes in the same extension point when the user returns. Better Auth has no hosted flow to suspend — your application owns the redirect. | ✅ (all plans) | ❌ | ❌ | ➖ |

### 13.2 Extension runtime, authoring and operations

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Vendor-hosted, versioned extension runtime**<br>*aka: Actions / Manage Versions (Auth0)* | The identity provider hosts, deploys and retains versions of your extension code, with comparison and rollback between versions, so nothing has to be operated by the customer. Okta and Better Auth both put the code in infrastructure you run and version yourself. | ✅ (all plans) | ❌ | ❌ | ➖ |
| **Third-party package dependencies in extension code**<br>*aka: Manage Dependencies (Auth0)* | Pulling library code into an extension. Auth0 allows nearly all public npm packages, pinned per Action version. Where the code runs in the customer's own service this is an ordinary application concern. | ✅ (all plans) | ➖ | ➖ | ✅ (Core) |
| **Encrypted secret store for extension code**<br>*aka: Action secrets (Auth0), Connections (Okta Workflows), Vault (Auth0 Flows)* | Managed encrypted key/value storage exposed to extension code at runtime, so API keys are not embedded in source. Auth0 versions secrets alongside the code. | ✅ (all plans) | 🟡 (Workflows connections) | ➖ | ➖ |
| **Shared reusable extension modules**<br>*aka: Actions Modules (Auth0), Helper flows (Okta Workflows)* | Factoring common logic out of individual extension points into a reusable unit importable by several of them. Auth0's modules carry their own secrets and dependencies and execute inside the importing Action's runtime; Okta's helper flows are triggerless flows a parent invokes, to a 250-deep recursion limit. | 🟡 (Early Access) | ✅ (Workflows add-on) | ➖ | ✅ (Core — ordinary modules) |
| **Typed local authoring and unit testing of extension code**<br>*aka: `@auth0/actions` npm package / Test Actions (Auth0), `@better-auth/test-utils` (BA)* | Per-trigger TypeScript definitions so extension code can be written, type-checked and unit-tested outside the vendor console, plus an in-console runner that executes an extension against a synthetic event without touching the deployed version. | ✅ (all plans) | ➖ | ➖ | ✅ (Core) |
| **Live execution logs for extension code**<br>*aka: Actions Real-time Logs (Auth0)* | A streaming view of `console.log` output and exceptions from extension code. Auth0's panel covers Actions, custom database scripts and custom social connections. Where the code is customer-hosted, its logs are the customer's own. | ✅ (all plans) | 🟡 (System Log records calls) | ➖ | ➖ |
| **Per-transaction scratch state shared across extension points**<br>*aka: Actions Transaction Metadata (Auth0), `ctx.context` (BA)* | A key/value store scoped to one authentication transaction and readable by later extension points in the same transaction, so data need not be re-fetched. | ✅ (Actions) | ❌ | ❌ | ✅ (Core — request context) |
| **Cache available to extension code**<br>*aka: Actions cache (Auth0), Tables (Okta Workflows), `secondaryStorage` (BA)* | Storage for expensive lookups reused across transactions. Auth0's cache is capped at a 24-hour lifetime, 20 entries per trigger, 64-byte keys, 4 KB values and 8 KB cumulative. | ✅ (all plans) | 🟡 (Workflows add-on) | ➖ | ✅ (Core) |
| **Published execution budget for extension code**<br>*aka: Actions Limitations (Auth0), inline hook timeout (Okta)* | Hard vendor-imposed ceilings the extension must fit inside. Auth0: 100 KB per Action excluding npm modules and 20 seconds per trigger execution. Okta: a 3-second response window on inline hooks, which is what makes the Workflows low-latency mode necessary. Code running in your own process has no vendor budget. | ✅ (documented limits) | ✅ (documented limits) | ➖ | ➖ |

### 13.3 Asynchronous events and webhooks

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Outbound event webhooks**<br>*aka: Event Streams / Auth0 Events (Auth0), Event hooks (Okta), Webhooks powered by Svix (Clerk)* | The provider POSTs event payloads to an endpoint you host after events occur, without affecting the originating transaction. Okta caps this at 25 active verified hooks per org, 300 event types per hook and a 400,000-events-per-24-hours applicability threshold. Better Auth ships no delivery system; the equivalent is calling your own endpoint from a database or request hook. | ✅ (Event Streams) | ✅ (event hooks) | ✅ (Hobby+) | ❌ |
| **Event type catalog**<br>*aka: Event types (Auth0), Event Types reference (Okta), Event Catalog (Clerk)* | The published set of events an endpoint may subscribe to. Auth0 documents roughly seventeen types across four objects — `user.created/updated/deleted`, six `organization.*` events including member and connection changes, four `group.*` events and three `connection.*` events. Okta marks every System Log event type in its full reference as event-hook-eligible or not, making the catalog far broader. Clerk exposes a Dashboard tab enumerating user, organization, session, email, SMS and billing events. | ✅ (4 object families) | ✅ (System Log catalog) | ✅ (Hobby+) | ❌ |
| **Event payload envelope**<br>*aka: webhook payload (Clerk)* | A documented wrapper around each delivered event. Clerk's carries `data`, `object`, `type`, `timestamp` in milliseconds and `instance_id`; Okta batches several events into one delivery. | ✅ (Event Streams) | ✅ (batched payload) | ✅ (Hobby+) | ➖ |
| **Receiver-side authenticity verification**<br>*aka: `verifyWebhook()` and Svix signing secret (Clerk), Secure your hooks / Hook Keys API (Okta)* | How the receiving endpoint proves the request really came from the provider. Clerk signs each payload and ships an SDK helper plus documented manual verification. Okta offers a shared header secret, HTTP Basic, or OAuth 2.0 client credentials, with a Hook Keys API managing JSON Web Keys for inline hooks. Auth0 custom webhook destinations carry an optional Authorization header token rather than a payload signature. | 🟡 (bearer token header) | ✅ (secret, Basic or OAuth) | ✅ (Hobby+) | ➖ |
| **Endpoint ownership challenge on registration**<br>*aka: One-time verification challenge (Okta)* | Before a hook activates, the provider issues a GET carrying a challenge value the endpoint must echo back, proving the customer controls the URL. Okta sends `x-okta-verification-challenge` and requires it echoed in a JSON `verification` object. | ❌ | ✅ (event hooks) | ❌ | ➖ |
| **Delivery retry policy** | What happens when a delivery fails. Okta is the weakest: a 3-second timeout with exactly one retry, on 5xx only, at-least-once best-effort with no latency guarantee. Clerk retries on a fixed schedule managed by Svix and stops retrying if the endpoint is disabled. Auth0 documents failure-recovery tooling for event streams. | 🟡 (failure recovery tooling) | 🟡 (one retry, 5xx only) | ✅ (Hobby+) | ➖ |
| **Delivery replay and redrive**<br>*aka: Message Attempts (Clerk)* | Re-sending events that were never successfully processed. Clerk can replay an individual message, or all failed or missing messages in a date range, from the Dashboard. Okta's single retry is the end of the line. | 🟡 (event failure recovery) | ❌ | ✅ (Hobby+) | ➖ |
| **Subscription filtering beyond event type**<br>*aka: Event hook filters (Okta)* | Narrowing which instances of a subscribed event type are actually delivered. Okta supports expression-based filters evaluated per event; Auth0 and Clerk filter by type and category only. | 🟡 (type/category selection) | ✅ (expression filters) | 🟡 (type selection) | ➖ |
| **Pull-based event consumption**<br>*aka: Events API — Server-Sent Events (Auth0), System Log API (Okta)* | Retrieving the event stream by polling or a long-lived connection instead of hosting a receiving endpoint. Auth0 exposes a Server-Sent Events stream; Okta's System Log API offers keyword search, filters, time bounds and cursor pagination. | ✅ (Events API) | ✅ (System Log API) | ❌ | ➖ |
| **Managed event-bus destination**<br>*aka: AWS EventBridge event stream (Auth0)* | Delivering events to a hosted message bus instead of an HTTPS endpoint you operate. Auth0 event streams target AWS EventBridge directly; Okta reaches buses only through its separate log stream integrations, capped at two per org; Clerk delivers over HTTPS only. | ✅ (EventBridge) | 🟡 (log stream integrations) | ❌ | ➖ |
| **Local webhook tunneling and test delivery**<br>*aka: `clerk webhooks listen` / `clerk webhooks verify` (Clerk), Event Testing (Auth0)* | Getting live events onto a developer machine and verifying a captured payload offline. Clerk's CLI opens a relay tunnel to localhost and verifies signatures without network access. | 🟡 (event testing tooling) | 🟡 (preview and deliver test event) | ✅ (Hobby+) | ➖ |

### 13.4 Custom message delivery and templates

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Custom email delivery by your own code**<br>*aka: `custom-email-provider` trigger (Auth0), `email.created` webhook (Clerk), `sendVerificationEmail` and friends (BA)* | Handing every outbound identity email to customer code so any delivery API can be used. Auth0 routes mail through an Action. Clerk requires toggling off "Delivered by Clerk" per template and then reacting to an asynchronous `email.created` event. Better Auth sends nothing on its own — you always supply the sending function; `@better-auth/infra` adds a managed alternative. | ✅ (Actions trigger) | ❌ | 🟡 (async webhook takeover) | ✅ (Core) |
| **External SMTP or email provider configuration**<br>*aka: SMTP Email Providers (Auth0), custom email provider / SMTP server (Okta)* | Declarative replacement of the vendor's default low-volume mailer with your own provider, no code required. Auth0 documents Amazon SES, Azure Communication Services, Mailgun, Mandrill, Microsoft 365 and Exchange Online, Resend, SendGrid, SparkPost and generic SMTP. | ✅ (all plans) | ✅ (custom SMTP server) | ❌ | ➖ |
| **Email template customization**<br>*aka: Email Templates (Auth0), Emails page (Clerk)* | Editing the subject, body and sender of each transactional email — verification, welcome, password reset, blocked account, MFA enrollment, invitation. Auth0 authors these in Liquid with interpolation, conditionals and filters. Better Auth ships no templates at all: the message body is written in your own sending function. | ✅ (all plans) | ✅ (per template) | ✅ (Hobby+) | ➖ |
| **Custom SMS and voice delivery provider**<br>*aka: `send-phone-message` and `custom-phone-provider` triggers / Configure Phone Messaging Providers (Auth0), Telephony inline hook (Okta), `sms.created` webhook (Clerk)* | Substituting your own telephony vendor for MFA and passwordless message delivery. Auth0 supports both a declarative provider configuration (Twilio, Twilio Verify, fully custom, with a Terraform path) and an Action trigger. Okta delegates delivery synchronously through an inline hook. Clerk's takeover is asynchronous, after disabling its own delivery per template. Better Auth always calls a sending function you supply; `@better-auth/infra` adds a managed option. | ✅ (all plans) | ✅ (inline hook) | 🟡 (async webhook takeover) | ✅ (Core) |
| **SMS and voice template customization**<br>*aka: Phone Templates (Auth0), SMS page (Clerk)* | Editing the text of outbound SMS and voice messages. Auth0 uses a supported Liquid subset, configurable per application, tenant or custom domain, with a preview. | ✅ (Phone Templates) | ✅ (per template) | ✅ (Hobby+) | ➖ |

### 13.5 Library-level extension architecture

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Plugin architecture for the identity framework itself**<br>*aka: `BetterAuthPlugin` (BA)* | Third-party code that extends the identity system's own behaviour rather than reacting to it — adding endpoints, tables, middleware and client methods as a distributable unit. A plugin is a plain object with a unique `id`, conventionally returned from a factory so it can take options. A hosted service cannot be extended this way by definition. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Custom HTTP endpoints on the auth server**<br>*aka: `createAuthEndpoint` (BA), API Endpoint flow (Okta Workflows)* | Adding new HTTP routes to the identity system itself, typed end to end and schema-validated. Okta's nearest equivalent exposes a Workflows flow at an invoke URL, rate-limited to 10 invocations per second per flow with 60-second synchronous and 120-second asynchronous timeouts, protected by scoped OAuth 2.0, an embedded client token, or nothing. | ❌ | 🟡 (Workflows add-on) | ❌ | ✅ (Core) |
| **Extension-declared database tables and columns**<br>*aka: plugin `schema` (BA)* | An extension declaring its own tables, columns and indexes, which then participate in migration and schema generation. Better Auth supports `string`, `number`, `boolean` and `date` fields with `required`, `unique` and `references` including `onDelete`, plus table-level indexes over up to sixteen fields emitted into SQL, Drizzle and Prisma output. Fields a plugin adds to the `user` or `session` table are automatically typed and returned by session and sign-up endpoints. | ❌ | ❌ | ❌ | ✅ (Core) |
| **Database lifecycle hooks**<br>*aka: `databaseHooks.{user,session,account,verification}.{create,update,delete}.{before,after}` (BA)* | Before and after hooks around every core persistence operation. A `before` hook can replace the payload by returning `{ data }`, abort by returning `false`, or throw a typed error with a status and message; the hook receives a context giving access to the current session. The hosted products expose only the specific lifecycle moments their trigger catalog names. | 🟡 (specific Action triggers) | ❌ | ❌ | ✅ (Core) |
| **Request and response hooks with path matchers**<br>*aka: `hooks.before` / `hooks.after` with `createAuthMiddleware` (BA)* | Middleware that runs before or after a matched identity endpoint, whether it was called over HTTP or invoked directly in-process. `before` handlers can validate, reject, or replace the request body and headers; `after` handlers see the new session, the returned value and accumulated response headers. In the hosted products your middleware runs in your application, outside the identity service. | ❌ | ❌ | ❌ | ✅ (Core) |
| **Global request and response interception**<br>*aka: `onRequest` / `onResponse` (BA), path-scoped `middlewares` (BA)* | Interception around every request regardless of route: continue, swap the request object, or return a response that short-circuits the handler; and the response-side counterpart that may rewrite what is sent. Path-scoped middleware runs only for client-originated API calls, not direct server invocations. | ❌ | ❌ | ❌ | ✅ (Core) |
| **Reusable endpoint guard middleware**<br>*aka: `sessionMiddleware`, `requireResourceOwnership`, `requireOrgRole` (BA)* | Prebuilt guards a custom endpoint can compose: require a valid session, verify a record loaded by ID belongs to the caller, or require organization membership and optionally one of a set of roles. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Pluggable secondary key-value storage**<br>*aka: `secondaryStorage` (BA)* | A replaceable key-value backend for sessions, verification records and rate-limit counters, offloading high-churn data from the primary database. The interface is `get`, `getAndDelete`, `set`, `delete` and `increment`; `@better-auth/redis-storage` is the maintained ioredis implementation, with node-redis and Upstash documented and any KV store usable. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Background work scheduled from extension code**<br>*aka: `runInBackground` / `runInBackgroundOrAwait` (BA)* | Deferring slow side effects until after the response is returned. Better Auth's variant awaits the work when no background handler is configured, so tasks that must complete — such as sending email — are not silently dropped. Auth0 reaches this only through triggers that are themselves asynchronous. | 🟡 (async triggers only) | 🟡 (Workflows add-on) | ❌ | ✅ (Core) |
| **Client-side extension interface**<br>*aka: `BetterAuthClientPlugin`, `$InferServerPlugin`, `getActions`, `getAtoms` (BA)* | The browser-side half of a custom extension: server endpoints inferred onto the client as typed nested camelCase methods, hand-written client actions over the fetch layer, reactive nanostores atoms that each framework binding turns into hooks, atom listeners for cache invalidation, HTTP method overrides and fetch-layer plugins. | ➖ | ➖ | ➖ | ✅ (Core) |

### 13.6 No-code automation and visual builders

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **No-code automation engine**<br>*aka: Okta Workflows (Okta)* | A visual engine composing triggers, third-party connector actions and built-in logic cards into executable identity and administration processes, as an alternative to writing and hosting hook services. Okta's is licensed by active flow count — 5 on Free Trial and Starter, 50 Light, 150 Medium, unlimited Max — with runtime ceilings of 2,000,000 steps per execution, 100 MB memory, 1 MB per message and a 30-day maximum pause. | ❌ | ✅ (Workflows add-on) | ❌ | ❌ |
| **Connector and function card library**<br>*aka: Connectors and Connections / Function cards (Okta)* | Packaged integrations supplying a service's event and action cards, plus built-in primitives grouped as API Connector, Branching, Date and Time, Encryption, Error Handling, File, Flow Control, Flows, Folders, JSON, JWT, List, Number, Object, Tables, Text, True/False, URL and XML. A generic HTTP card with pagination handling covers services without a connector. | ❌ | ✅ (Workflows add-on) | ➖ | ➖ |
| **Visual in-flow screen builder**<br>*aka: Forms for Actions (Auth0)* | A visual editor producing multi-step forms rendered on the tenant's own domain during an identity flow. Auth0 composes Start, Step, Flow, Router and Ending nodes; field components (text, number, legal or consent, rich text) carry ID, label, required, hint, placeholder, default, transient or masked flags and length and value validation; customer-authored field components, up to ten ordered router conditions with AND/OR composition, per-locale messages and starter templates are supported. | ✅ (Forms) | ❌ | ❌ | ❌ |
| **Visual server-side logic builder behind a flow**<br>*aka: Flows (Auth0)* | A visual builder for the server-side logic a form executes. Auth0's out-of-the-box actions cover the Management API, arbitrary HTTP requests, JSON and XML parsing, JWT signing and validation, branching, data verification, and messaging through SendGrid, Mailjet, Twilio, WhatsApp and Telegram. | ✅ (Flows) | 🟡 (Workflows, not in-flow) | ❌ | ❌ |
| **Credential and state storage for automations**<br>*aka: Vault and Vault Connections (Auth0), Tables (Okta)* | Storage the visual builder owns. Auth0's Vault encrypts the API keys and tokens used by flow integrations, refreshes access tokens automatically and propagates credential updates to every flow using the connection. Okta's Tables give flows relational-style storage — 200 tables on paid tiers and 100 free, 500,000 rows, 64 columns and 16 KB per cell — with CSV import and export in both the UI and as cards. | ✅ (Flows Vault) | ✅ (Workflows add-on) | ➖ | ➖ |
| **Automation execution history and step debugger**<br>*aka: Flow Execution and Debugger (Auth0), Flow execution history (Okta)* | Per-run inspection of each step's inputs, outputs, duration and outcome. Okta retains 30 days in preview and production orgs and 7 days in developer orgs, with an opt-in toggle persisting all values that pass through cards, an admin purge action, and separate execution log streaming of flow start, completion, failure, cancellation, pause and throttle events to an external SIEM. Auth0 also exposes executions through the Management API. | ✅ (Flows) | ✅ (Workflows add-on) | ➖ | ➖ |
| **Scheduled automations**<br>*aka: Schedule Flow event (Okta)* | Time-triggered automation on hourly, daily, weekly or monthly intervals, independent of any user action. | ❌ | ✅ (Workflows add-on) | ❌ | ➖ |
| **Automation delegated to non-developer administrators**<br>*aka: Delegated flows (Okta)* | Letting an administrator run a prepared automation from the admin console without access to the builder, gated by a custom admin role whose resource set includes the flow plus a run permission. | ❌ | ✅ (Workflows add-on) | ❌ | ➖ |
| **Low-latency execution mode for hook-backed automations**<br>*aka: Low-latency mode (Okta)* | Moving webhook- and inline-hook-driven automations to a less contended execution environment so they can complete inside the 3-second inline hook timeout. | ➖ | ✅ (Workflows add-on) | ➖ | ➖ |
| **Prebuilt extension template catalog**<br>*aka: Actions Templates and Resources: Templates (Auth0), Workflows Templates (Okta)* | A searchable library of ready-made extensions or automations installable in one action and then editable. Okta accepts community contributions through a public repository. | ✅ (all plans) | ✅ (Workflows add-on) | ➖ | ➖ |
| **A/B testing inside the authentication pipeline**<br>*aka: Auth0 Experiment Center (Auth0)* | Native experimentation over the login flow: feature flags with variations, deterministic traffic splitting, segments routing specific populations, a draft to active to paused to completed to archived lifecycle with a validation gate, and auth log events enriched with experiment metadata. Consumable from Actions, Advanced Customizations for Universal Login and page templates. Beta, and not supported on production tenants — development tenants only. | 🟡 (Beta, dev tenants only) | ❌ | ❌ | ❌ |

### 13.7 Integration catalogs and marketplaces

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Integration catalog**<br>*aka: Auth0 Marketplace (Auth0), Okta Integration Network / OIN (Okta), Integrations (Clerk), Community Plugins (BA)* | A browsable catalog of prebuilt integrations. Auth0 publishes 339 listings across 7 integration types and 13 business categories, each marked `supported` (196, vendor or Auth0 maintained) or `community` (143). Okta's OIN is far larger at roughly 8,200 integrations, weighted toward SSO and provisioning connectors. Clerk maintains a documented integrations list rather than a catalog others publish into. Better Auth's docs name 35 community plugins, none of them official or verified. | ✅ (all plans) | ✅ (OIN) | 🟡 (documented list only) | 🟡 (35 unverified community) |
| **Third-party publishing program**<br>*aka: Marketplace Partner Portal (Auth0), OIN submission / Express Submission (Okta)* | A defined path for an outside vendor to build, submit and list an integration. Auth0 runs a self-service partner portal requiring a business profile, integration code, an installation guide, a square logo and per-type GitHub templates against published writing standards. Okta additionally offers Express Configuration, automating SSO and SCIM setup for Auth0-enabled OIN SaaS integrations. Better Auth plugins are ordinary npm packages with no review. | ✅ (partner program) | ✅ (OIN program) | ❌ | ➖ |
| **Partner-authored inline extension listings**<br>*aka: Actions Integrations (Auth0), API Integration Actions (Okta)* | Closed-source partner code installable into the login and registration pipeline. Auth0 lists 60, including Okta Workflows, OneTrust, Persona, Sumsub, LexisNexis, Telesign, Sift, IPinfo, Pangea, Incode, ID.me, Tealium, Prelude and SGNL. Okta's equivalent lets an integration implement provisioning, entitlement management and Universal Logout by calling third-party APIs against published schema contracts, but not run inside sign-in. | ✅ (60 listings) | 🟡 (not inline at sign-in) | ❌ | 🟡 (community plugins) |
| **No-code connector authoring for arbitrary APIs**<br>*aka: Integration Builder, formerly Connector Builder (Okta)* | A project-based tool that packages third-party API calls into a reusable connector with its own cards, scaffolding flows from an imported OpenAPI spec, defining HTTP Basic, OAuth 2.0 authorization code or client credentials, or custom header-injection authentication, adding polling monitors where the service has no webhooks, and publishing privately or to the public catalog. | 🟡 (Flows HTTP integration) | ✅ (Workflows add-on) | ❌ | ➖ |
| **Packaged product and platform integrations**<br>*aka: Marketing Tool Integrations / WordPress plugin / Integrate with Vercel (Auth0)* | Ready-made connections to systems outside identity. Auth0 documents user-data integrations with Adobe Campaign, Alterian, Constant Contact, Eloqua, Mailchimp, Marketo, Sailthru, Salesforce Marketing Cloud and Watson Campaign Automation; API gateway enforcement at Apigee, AWS API Gateway, Azure API Management and Google Cloud Endpoints; AWS federation and STS session tags; Vercel and Netlify guides; and a WordPress plugin with user-table migration. Clerk documents a Vercel Marketplace listing plus Convex, Firebase, Neon, Hasura, Inngest and Loops recipes. | ✅ (all plans) | 🟡 (via Workflows connectors) | 🟡 (documented recipes) | 🟡 (community plugins) |

### 13.8 Deprecated extension mechanisms

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Legacy post-authentication scripts**<br>*aka: Rules (Auth0)* | Chainable, individually toggleable JavaScript functions executed after authentication and before control returns to the application, with a tenant-level encrypted key/value configuration store. Superseded by Actions. Rules reach End of Life on 18 November 2026 and are already unavailable to tenants created after 16 October 2023 — treat this as a migration obligation, not a capability. | 🟡 (EOL 18 Nov 2026) | ➖ | ➖ | ➖ |
| **Legacy connection extension points**<br>*aka: Auth0 Hooks (Auth0)* | Node.js functions bound to extensibility points around database and passwordless connections, with their own per-Hook encrypted secrets store and log view. Superseded by Actions. Hooks reach End of Life on 18 November 2026 and are unavailable to tenants created after 16 October 2023. | 🟡 (EOL 18 Nov 2026) | ➖ | ➖ | ➖ |
| **Migration tooling off the legacy mechanisms**<br>*aka: Migrate from Rules to Actions / Migrate from Hooks to Actions (Auth0)* | Documented migration paths with per-rule conversion guidance and an enumerated list of migration limitations, for moving existing Rules and Hooks onto Actions before the 18 November 2026 End of Life. | ✅ (all plans) | ➖ | ➖ | ➖ |
| **Installable extension framework**<br>*aka: Auth0 Extensions (Auth0)* | Installable applications and scripts extending the base product, each independent and subject to its own rate limits. The Rules- and Hooks-based extensions — Authorization Extension, Delegated Administration, Account Link and SSO Dashboard — go out of support together with the Rules and Hooks End of Life on 18 November 2026. | 🟡 (EOL 18 Nov 2026) | ➖ | ➖ | ➖ |
| **Scoped user-administration console extension**<br>*aka: Delegated Administration Extension v3 (Auth0)* | Exposes only the Users section of the admin dashboard to a selected group of operators, with Hooks controlling access, filtering, writes, membership queries, settings queries and custom-domain behaviour. Legacy: tenant member roles are the recommended replacement, and it goes out of support with the Rules and Hooks End of Life on 18 November 2026. | 🟡 (EOL 18 Nov 2026) | ➖ | ➖ | ➖ |
| **Application launcher extension**<br>*aka: Single Sign-On Dashboard Extension (Auth0)* | Hosts a launcher page listing the SSO-enabled services a user is entitled to, with an admin mode for managing that list. Legacy, and goes out of support with the Rules and Hooks End of Life on 18 November 2026. | 🟡 (EOL 18 Nov 2026) | ➖ | ➖ | ➖ |
| **Other legacy extensions**<br>*aka: User Import/Export Extension, Authentication API Debugger, AD/LDAP Connector Health Monitor (Auth0)* | Bulk user import and export, superseded by Dashboard bulk import/export and deprecated in September 2025; an in-dashboard tool for exercising Authentication API endpoints; and an HTTP endpoint reporting on-premises AD/LDAP connector health for external monitoring. All are legacy extension-framework installs rather than current product surface. | 🟡 (legacy, partly deprecated) | ➖ | ➖ | ➖ |

---

## 14. Security & threat protection

This is the widest capability gap of any section. Okta concentrates continuous risk evaluation, network zones and shared-signal exchange in a paid Identity Threat Protection tier; Auth0 ships a comparable but CIAM-shaped stack (bot detection, tenant ACLs, customer-managed keys) split across plan tiers and add-ons; Clerk covers the common abuse vectors with fixed, non-configurable defaults; Better Auth provides the application-layer primitives (rate limiting, CSRF, origin and redirect validation) and leaves network, key and threat-intelligence controls to the operator.

### 14.1 Bot detection & CAPTCHA

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Automated-client (bot) detection**<br>*aka: Bot Detection (Auth0), Bot Protection (Okta), Bot protection (Clerk), captcha plugin (BA)* | Scores incoming sign-in, sign-up and password-recovery traffic to decide whether the caller is scripted, and interposes a verification step when it probably is. | ✅ (all plans; deeper on Enterprise) | ✅ (base platform) | ✅ (Hobby+) | 🟡 (plugin: captcha, provider-scored) |
| **Invisible / no-puzzle challenge**<br>*aka: Auth Challenge (Auth0), Smart mode (Clerk)* | A background verification (proof-of-work, behavioural or telemetry-based) that confirms a human client without showing a puzzle. | ✅ (default bot-detection response) | 🟡 (provider-dependent) | ✅ (Hobby+, Smart mode default) | 🟡 (plugin: captcha + Turnstile) |
| **Interactive CAPTCHA challenge**<br>*aka: CAPTCHA widget (Clerk)* | A visible challenge the user must solve — checkbox, image grid or equivalent — presented when the client is judged suspicious. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | 🟡 (plugin: captcha) |
| **First-party image CAPTCHA**<br>*aka: Simple CAPTCHA (Auth0)* | A provider-supplied image puzzle requiring no third-party CAPTCHA account, for login experiences that cannot run JavaScript. Not screen-reader accessible. | ✅ (with Bot Detection) | ❌ | ❌ | ❌ |
| **Third-party CAPTCHA provider integration**<br>*aka: CAPTCHA Providers / Configure CAPTCHA (Auth0), CAPTCHAs API (Okta)* | Delegates the challenge to an external CAPTCHA vendor configured with the customer's own site and secret keys. Auth0: reCAPTCHA Enterprise, hCaptcha, Friendly Captcha, Arkose. Okta: hCaptcha or reCAPTCHA v2, one instance per org. Better Auth: Cloudflare Turnstile, reCAPTCHA v2/v3, hCaptcha, CaptchaFox. | ✅ (with Bot Detection) | ✅ (base platform) | 🟡 (Cloudflare Turnstile only, fixed) | ✅ (plugin: captcha) |
| **CAPTCHA score threshold**<br>*aka: minScore (BA), Bot Detection Level (Auth0)* | Rejects a scored (non-binary) CAPTCHA assessment below a configurable confidence value rather than trusting any successful token. | 🟡 (reCAPTCHA Enterprise only) | ❌ (v2 checkbox only) | ❌ | ✅ (plugin: captcha, default 0.5) |
| **Per-flow CAPTCHA trigger policy**<br>*aka: Never / When Risky / Always (Auth0), endpoints option (BA)* | Independently decides which flows — sign-in, sign-up, password reset, passwordless — require a challenge, rather than one global on/off. | ✅ (per password, passwordless, reset) | ✅ (sign-in, registration, recovery) | 🟡 (sign-up flow only) | ✅ (plugin: captcha, wildcard paths) |
| **Bot-detection sensitivity threshold**<br>*aka: Bot Detection Level Low/Medium/High (Auth0)* | Tunes how aggressively the detector challenges, trading false positives against coverage. | ✅ (with Bot Detection) | ❌ | ❌ | 🟡 (plugin: captcha, score only) |
| **Fail-open on detector outage**<br>*aka: Fail Open (Auth0)* | Lets authentication proceed unchallenged when the bot-detection service is unreachable, trading detection coverage for availability. Disabled by default. | ✅ (with Bot Detection) | ❔ (unverified) | ❔ (unverified) | ❌ (verification failure blocks) |
| **Bot protection outside the hosted login page**<br>*aka: Bot Detection for Custom Login Pages / Native Apps (Auth0), CAPTCHA DOM node (Clerk)* | Applies the same challenge to custom-built, headless or native sign-up and sign-in flows rather than only the vendor-hosted page. Clerk requires the app to render a designated DOM node; enabling Clerk's Native API creates a path that bypasses the challenge. | ✅ (all plans) | 🟡 (embedded sign-in widget) | ✅ (Hobby+, DOM node required) | ✅ (plugin: captcha, header-based) |

### 14.2 Credential-attack & account protection

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Per-account brute-force protection**<br>*aka: Brute-Force Protection (Auth0), Attack Protection (Okta), User lockout (Clerk)* | Counts failed authentication attempts against a single account identifier and blocks further attempts past a configurable threshold. Auth0 counts per IP-and-user pair with a default threshold of 10 (range 1–100). | ✅ (all plans, on by default) | ✅ (base platform) | ✅ (Hobby+) | 🟡 (per-IP rate limits only) |
| **Account lockout**<br>*aka: Account Lockout (Auth0), user lockout settings (Okta), User lockout (Clerk), ACCOUNT_TEMPORARILY_LOCKED (BA)* | Disables authentication for a specific account after repeated failures, independent of source IP. Clerk defaults to 10 attempts with a 1-hour cooldown and a configurable minimum of 5, counting password, reset, backup-code, email/phone-code and TOTP attempts. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | 🟡 (plugin: twoFactor, 2FA attempts only) |
| **Lockout duration and unlock paths**<br>*aka: Lockout policy — Protect > Rules (Clerk)* | Controls how long a lock lasts and how it clears: automatic expiry, administrator unlock, self-service email unlock link, or password change. Auth0 blocks clear after 30 days, an admin unblock, a threshold raise, an emailed unblock link or a password change; Clerk allows minutes-to-years or indefinite-until-admin. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | 🟡 (plugin: twoFactor, temporary only) |
| **High-velocity source-IP throttling**<br>*aka: Suspicious IP Throttling (Auth0), ThreatInsight rate limiting (Okta)* | Counts failed logins and sign-ups per source IP across many accounts and returns HTTP 429 past a threshold, re-granting attempts at a drip rate. Auth0 counts logins per day and sign-ups per minute, separately, over a 24-hour drip. | ✅ (all plans, on by default) | ✅ (base platform) | 🟡 (fixed per-IP limits, not tunable) | 🟡 (Core rate limiter, per-IP) |
| **Attack-protection IP exemption list**<br>*aka: IP AllowList (Auth0), IP exempt zone (Okta)* | Source IPs or CIDR ranges exempted from throttling, brute-force counting and bot challenges, so shared corporate egress or test infrastructure is not falsely blocked. Auth0 allows up to 100 entries per protection. | ✅ (with each protection) | ✅ (base platform) | ❌ | ❌ |
| **Credential-stuffing and password-spray detection**<br>*aka: credential stuffing metric (Auth0), Suspected Brute Force Attack / Suspicious Login Using Valid Sprayed Password (Okta)* | A named detector that recognizes list-validation and spray campaigns across many accounts, distinct from per-account counting. Clerk relies on generic bot protection and fixed rate limits with no dedicated detector. | ✅ (Security Center + Bot Detection) | 🟡 (ITP add-on / Professional) | ❌ | ❌ |
| **Continuous breached-credential monitoring**<br>*aka: Breached Password Detection (Auth0), Breached Credential Protection (Okta)* | Tenant-wide monitoring that matches stored or previously used credentials against breach corpora after the fact and flags or locks affected accounts, rather than only checking a password at the moment it is typed. | ✅ (B2B/B2C Professional and Enterprise) | ✅ (Identity Engine; ITP raises risk) | ❌ (screening at entry only) | ❌ (screening at entry only) |
| **Dark-web breach intelligence**<br>*aka: Credential Guard (Auth0), SpyCloud security events provider (Okta)* | Non-public breach data sourced from dark-web collection, cutting detection latency from months to hours versus published breach corpora. | 🟡 (Attack Protection add-on, Enterprise) | 🟡 (third-party provider over SSF) | ❌ | ❌ |
| **Breach notification to user and administrators**<br>*aka: Password Breach Alert email template (Auth0)* | Emails the affected end user and/or tenant administrators when compromised credentials are used. Auth0 throttles user mail to one per hour per user and admin mail to one per hour per IP, with immediate/daily/weekly/monthly admin cadence. | ✅ (with Breached Password Detection) | 🟡 (via Workflows or log streams) | ❌ | ❌ |
| **Forced password reset on compromise**<br>*aka: block login and lock account (Auth0), remediation action (Okta), reset-password session task (Clerk)* | Marks a credential compromised and requires the user to set a new password before the account can be used again. | ✅ (with Breached Password Detection) | ✅ (Identity Engine) | ✅ (default for newer instances) | ❌ |
| **User-enumeration protection**<br>*aka: User enumeration protection (Clerk)* | Prevents responses, timing or error text from revealing whether an identifier is registered, and rate-limits probing. Only Clerk exposes it as an explicit, configurable feature with a strict mode. | 🟡 (default generic errors, no toggle) | 🟡 (default behaviour, no toggle) | ✅ (Hobby+, strict mode) | 🟡 (partial, flow-dependent) |
| **Detect-only (monitoring) mode**<br>*aka: Monitoring mode (Auth0), Log only (Okta)* | Runs a detector with all enforcement responses disabled so risk assessments land in the audit log and configuration can be tuned before it blocks real users. | ✅ (all plans) | ✅ (base platform) | ❌ | ❌ |
| **New-device sign-in notification with self-service revoke**<br>*aka: Unauthorized sign-in (Clerk), Report Suspicious Activity (Okta)* | Emails the user when a sign-in, authenticator enrollment or password change looks unfamiliar and gives them a one-click way to revoke the session or report it as fraud, which in Okta raises the account's risk level. Okta's report link is valid seven days. | 🟡 (blocked-account emails only) | ✅ (base platform) | ✅ (Hobby+) | ❌ |
| **Disposable and subaddressed email blocking**<br>*aka: Blocked disposable email domains / Blocked email subaddresses (Clerk)* | Rejects sign-ups from known throwaway email domains and from plus-addressed or dot-variant forms of an existing address, to curb trial and quota abuse. | 🟡 (custom Action) | 🟡 (custom inline hook) | ✅ (instance setting) | 🟡 (custom hook) |

### 14.3 Rate limiting

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Platform request rate limits**<br>*aka: rate limit policy (Auth0), org rate limits (Okta), system limits (Clerk), rateLimit (BA)* | Caps request volume against the identity service itself. Clerk: 1000 req/10 s Backend API in production, 100/10 s in development. Better Auth is per-IP, on by default in production and off in development, with server-side `auth.api` calls exempt. | ✅ (limits scale with plan) | ✅ (limits scale with plan) | ✅ (Hobby+, fixed by environment) | ✅ (Core) |
| **Per-endpoint rate-limit rules**<br>*aka: customRules (BA), endpoint-specific limits (Clerk)* | Different limits per route, so authentication attempts are held to a tighter budget than reads. Clerk applies 5/10 s on sign-in and sign-up creation and 3/10 s on factor attempts, per IP; Better Auth ships 3/10 s on `/sign-in/email` and supports glob paths, async rules, and exempting a path entirely. | 🟡 (fixed per endpoint; custom on Enterprise) | ✅ (per-endpoint buckets) | 🟡 (fixed, not configurable) | ✅ (Core) |
| **Per-principal rate limits**<br>*aka: Principal Rate Limits API (Okta)* | Caps the share of the tenant's rate-limit budget a single API token, OAuth client or service principal may consume, so one integration cannot starve the rest. | ❌ | ✅ (base platform) | ❌ | 🟡 (customStorage, custom key) |
| **Per-resource write limits**<br>*aka: metadata write limits (Clerk), invitation limits (Clerk)* | Caps writes against one object rather than one caller — Clerk limits user, organization and membership metadata writes to 10 requests / 10 s per resource, invitations to 100/hour and organization invitations to 250/hour. | ❌ | ❌ | ✅ (Hobby+) | 🟡 (customRules, custom code) |
| **Administrator-configurable rate-limit policy**<br>*aka: Rate Limit Policies API / Custom Rate Limit Policies (Auth0), Rate Limit Settings API (Okta)* | Lets the customer change the limits themselves rather than accepting fixed platform values. | 🟡 (Enterprise, negotiated) | ✅ (base platform) | ❌ | ✅ (Core) |
| **429 response with retry hint**<br>*aka: Retry-After (Clerk), X-Retry-After (BA), X-Rate-Limit headers (Okta)* | Returns HTTP 429 with a header stating when the caller may retry, so clients back off deterministically. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | ✅ (Core) |
| **Rate-limit warning threshold and alerting**<br>*aka: warning threshold percentage (Okta)* | Emits an event or notification when the tenant approaches its limit, before requests start failing. | 🟡 (log events only) | ✅ (base platform) | ❌ | ❌ |
| **Client IP resolution behind proxies**<br>*aka: trusted proxy / IP chain evaluation (Okta), auth0-forwarded-for (Auth0), trustedProxies + ipAddressHeaders (BA)* | Determines the real client IP from a forwarded header chain by walking it against declared trusted proxies, because the leftmost value is caller-controlled. Better Auth additionally normalizes IPv6 and IPv4-mapped forms and buckets IPv6 clients by `/64` (configurable 0–128) so a client cannot rotate through its prefix. | ✅ (all plans) | ✅ (base platform) | ❔ (unverified) | ✅ (Core) |

### 14.4 Network zones, IP and geographic controls

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **IP allow/deny policy for authentication traffic**<br>*aka: Tenant Access Control List / network-acls (Auth0), Network Zones / IP zone (Okta)* | Named sets of IPs and CIDR ranges that allow, block or monitor requests to the identity service, usable as a policy condition. Auth0 allows 1 ACL on Enterprise and up to 10 with the add-on, with 20 entries per source identifier per ACL; Okta ships system zones `LegacyIpZone`, `BlockedIpZone` and `DefaultEnhancedDynamicZone`. | 🟡 (Enterprise; add-on for 10 ACLs) | ✅ (base platform) | ❌ | ❌ |
| **Geolocation and ASN-based rules**<br>*aka: Dynamic zone (Okta), Tenant ACL geo/ASN matchers (Auth0)* | Defines a zone or rule by country/region and autonomous system number instead of an explicit address list, so an entire geography or network operator can be gated. Clerk documents geo-blocking only as application-level middleware using the hosting platform's headers. | 🟡 (Enterprise Tenant ACL) | ✅ (base platform) | ❌ | ❌ |
| **Anonymizer, proxy and VPN category rules**<br>*aka: Enhanced dynamic zone (Okta), auth0.icloud_relay_proxy (Auth0)* | Allows or blocks by IP service classification — commercial VPN, open proxy, Tor, privacy relay — rather than by address. | 🟡 (curated blocklists, Attack Protection) | ✅ (base platform) | ❌ | ❌ |
| **Default-deny network posture**<br>*aka: Deny All Tenant ACL (Auth0), Blocklist network zone (Okta)* | Rejects all traffic except what an explicit allow rule admits, inverting the usual allow-by-default model. Okta's blocklist zone matches an IP appearing anywhere in the request's IP chain. | 🟡 (Enterprise) | ✅ (base platform) | ❌ | ❌ |
| **Vendor-curated threat-intelligence feeds**<br>*aka: Curated Blocklists / auth0_managed matcher (Auth0), Okta ThreatInsight (Okta)* | Continuously updated lists of hostile IPs, ranges and TLS fingerprints maintained by the vendor from cross-customer telemetry, referenceable from policy without the customer sourcing the data. | 🟡 (Attack Protection customers) | ✅ (base platform) | ❌ | ❌ |
| **Threat-feed enforcement modes**<br>*aka: Log only / Log and enforce (Okta), Tenant ACL monitoring mode — action.log (Auth0)* | Chooses per rule or per feed between recording a match, rate-limiting the source, and blocking it outright, so impact can be audited before enforcement. Okta records DENY, RATE_LIMIT or ALLOW outcomes; Auth0 emits an `acls_summary` event per rule every 10 minutes. | 🟡 (Enterprise) | ✅ (base platform) | ❌ | ❌ |
| **External edge/bot signal ingestion**<br>*aka: Akamai Supplemental Signals (Auth0), security events provider (Okta)* | Accepts bot or risk verdicts produced by the customer's own edge, CDN or security stack and makes them available to policy logic inside the identity service. | 🟡 (Enterprise, Attack Protection add-on) | 🟡 (ITP add-on / Professional) | ❌ | ❌ |

### 14.5 Telephony abuse and toll fraud

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **SMS/voice destination country restriction**<br>*aka: Geographic Permissions (Auth0/Twilio), geographic permissions (Okta), SMS Settings enabled countries (Clerk)* | Restricts which country calling codes may receive one-time-code SMS or voice calls, the primary control against SMS pumping and toll fraud. Clerk enables only the US and Canada by default and returns a "Rate limited country code" error otherwise. | 🟡 (via Twilio settings or an Action) | ✅ (base platform) | ✅ (instance setting) | ❌ |
| **Telephony rate limits and toll-fraud detection**<br>*aka: telephony hook rate limits / risk markers (Okta)* | Caps message volume per account, per number and per risk category, and scores each send with heuristics or machine learning on number origin to suppress pumped traffic. | 🟡 (platform limits + log alerting) | ✅ (base platform, ML-scored) | 🟡 (fixed per-IP limits) | ❌ |

### 14.6 Continuous risk, anomaly detection & shared signals

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Sign-in risk scoring**<br>*aka: Risk Assessments (Auth0), Risk scoring (Okta)* | Classifies each authentication attempt Low/Medium/High from IP origin, sign-in history, device characteristics, geographic anomalies and threat intelligence, exposed to policy and to custom code. Okta treats a first-ever sign-in as high risk. | ✅ (readable in Actions) | ✅ (base platform) | ❌ | ❌ |
| **Behavioural anomaly detection rules**<br>*aka: Behavior Detection / Behavior Rules API (Okta)* | Compares the current attempt against the account's recent successful sign-ins and flags deviations — new device, new IP, new city/state/country, new geo-coordinates, new ASN — each with its own configurable history window. Okta's new-device window defaults to the last 20 sign-ins, new IP to 50 and new geo-location to a 20 km radius. | 🟡 (new-device assessor only) | 🟡 (typically Adaptive MFA SKU) | 🟡 (Device Trust, new device only) | ❌ |
| **Impossible-travel detection**<br>*aka: impossible travel (Auth0), Velocity (Okta)* | Computes implied travel speed between consecutive sign-in locations and flags attempts above a threshold — Okta defaults to 500 mph / 805 km/h. | ✅ (risk assessment signal) | 🟡 (typically Adaptive MFA SKU) | ❌ | ❌ |
| **Continuous post-authentication risk evaluation**<br>*aka: Continuous Session Protection (Auth0), Identity Threat Protection with Okta AI (Okta)* | Re-assesses risk during an already-established session rather than only at the authentication event, using session, network, device and third-party signals. | 🟡 (evaluated through Actions) | 🟡 (ITP add-on / Professional) | ❌ | ❌ |
| **Mid-session policy re-evaluation**<br>*aka: Session protection / continuous access evaluation (Okta)* | Watches an active session for IP and device context changes and re-applies the session and application sign-in policies, so the user must keep satisfying policy for the session's whole lifetime. Okta scopes the violation trigger by risk level (default Low-and-above) and an IP condition, with Monitoring, Enforced and Enforced-with-action modes. | 🟡 (custom Actions on token refresh) | 🟡 (ITP add-on / Professional) | ❌ | ❌ |
| **Session revocation on risk**<br>*aka: Universal Logout (Okta), session and refresh-token revocation in Actions (Auth0)* | Automatically terminates sessions and refresh tokens — locally and, where supported, in downstream applications — when risk crosses a threshold. Okta's Universal Logout covers Access Gateway, Access Requests, Admin Console, End-User Dashboard, the Browser Plugin, Workflows and Device Logout, but explicitly not Identity Governance or Privileged Access; devices poll roughly every 15 minutes. Clerk and Better Auth expose manual revocation only. | 🟡 (Actions-driven, Continuous Session Protection) | 🟡 (ITP add-on / Professional) | ❌ (manual revoke only) | ❌ (manual revoke only) |
| **Persistent user-level risk profile with manual override**<br>*aka: User Risk API / Elevate Risk Level / Clear user sessions (Okta)* | A durable risk level attached to the account (not just the attempt), listing the detections that produced it, which an administrator can raise or reset; resetting also ends sessions, OAuth tokens and API tokens. | ❌ | 🟡 (ITP add-on / Professional) | ❌ | ❌ |
| **Documented threat-detection catalogue**<br>*aka: ITP detections (Okta), Security Center Metrics (Auth0)* | A published, named set of detections with fixed severities that a security team can build runbooks against. Okta ships breached credential, critical action from high-threat IP, threat-actor infrastructure, suspicious authenticator enrollment, phishing-flagged IP, credential-attack IP, end-user fraud report, session-influenced risk, brute force, app session-cookie harvesting and sprayed-password success. Auth0 publishes three classes — credential stuffing, signup attack and MFA bypass — derived from hourly log-event patterns. | 🟡 (Security Center, 3 classes) | 🟡 (ITP add-on / Professional) | ❌ | ❌ |
| **Shared Signals Framework receiver**<br>*aka: Security events provider / shared signal receiver (Okta)* | Ingests OpenID Shared Signals Framework security event tokens (RFC 8417 SETs) from third-party security tools, configured from the vendor's `.well-known/ssf-configuration` or a manual issuer plus JWKS. | ❌ | 🟡 (ITP add-on / Professional) | ❌ | ❌ |
| **Shared Signals Framework transmitter**<br>*aka: Shared signal transmitter (Okta)* | Publishes the identity provider's own security events to third-party receivers over SSF streams, so downstream services can drop sessions. Okta transmits CAEP session-revoked and credential-change events and also implements the RISC profile for account-level changes. | ❌ | ✅ (Workforce Identity) | ❌ | ❌ |
| **Named third-party risk-signal integrations**<br>*aka: Supported security events providers (Okta)* | A catalogue of pre-validated security vendors whose signals can drive identity risk — Okta documents AppOmni, Cloudflare, CrowdStrike, Google Security Operations, Jamf, Netskope, Omnissa, Palo Alto Networks, Rubrik, SGNL, SquareX, SpyCloud, WideField Security, Windows Security Center, Zimperium and Zscaler. | ❌ | 🟡 (ITP add-on / Professional) | ❌ | ❌ |
| **Identity security posture management**<br>*aka: Okta Identity Security Posture Management, formerly Spera (Okta)* | Agentless scanning of connected identity providers, SaaS apps and cloud infrastructure to surface misconfigurations, over-privileged and dormant accounts, unrotated tokens and non-human identities as severity-ranked findings, with framework scorecards and remediation automation. | ❌ | 🟡 (ISPM add-on / Professional) | ❌ | ❌ |

### 14.7 Cryptography, keys & secrets

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Encryption in transit** | All traffic to and from the identity service carried over TLS. Clerk is phasing out CBC-mode cipher suites on Clerk-managed subdomains from 18 January 2027 as certificates rotate. | ✅ (all plans) | ✅ (base platform) | ✅ (all plans) | ➖ (deployer-controlled) |
| **Encryption at rest** | Identity data encrypted in the vendor's storage layer. For a self-hosted library this is a property of the database the operator runs. | ✅ (all plans) | ✅ (base platform) | ✅ (all plans) | ➖ (operator's database) |
| **Customer-controlled key lifecycle**<br>*aka: Control Your Own Key (Auth0)* | The customer drives rotation and re-keying of the tenant master key inside the vendor's key-management service, re-encrypting dependent namespace keys through an API. Requires a dedicated key-management administrator role. | 🟡 (Enterprise + HRI add-on) | ❌ | ❌ | ➖ (operator's key management) |
| **Bring-your-own root key with HSM backing**<br>*aka: Bring Your Own Key / BYOK (Auth0)* | Replaces the environment root key with customer-supplied wrapped key material imported into the vendor's cloud HSM, putting the customer at the top of the key hierarchy. Key-hierarchy operations emit dedicated audit events. Okta offers per-application and per-authorization-server bring-your-own signing and encryption keys but no tenant-data root key. | 🟡 (Enterprise + HRI add-on) | ❌ | ❌ | ➖ (operator's key management) |
| **Token signing key rotation**<br>*aka: Rotate Signing Keys (Auth0), Key rotation (Okta)* | Replaces the key pair used to sign ID tokens, access tokens and SAML/WS-Fed assertions, publishing old and new keys in the JWKS across the rotation window so verifiers are not broken. | ✅ (all plans) | ✅ (custom authorization servers) | 🟡 (vendor-managed, not self-serve) | 🟡 (plugin: jwt) |
| **Automatic signing key rotation** | The provider rotates signing keys on a schedule with no administrator action, with clients expected to refetch the JWKS rather than pin a key. | 🟡 (manual or API-triggered) | ✅ (base platform) | ❔ (unverified) | ❌ |
| **Signing key revocation**<br>*aka: Revoke Signing Keys (Auth0)* | Immediately invalidates a previous signing key so tokens already signed with it stop validating, rather than waiting for the rotation window to close. | ✅ (all plans) | 🟡 (deactivate per-app keys) | ❌ | 🟡 (plugin: jwt) |
| **Customer-supplied signing keys**<br>*aka: Customer Signing Keys (Auth0), bring your own signing/encryption key (Okta)* | The tenant provides its own signing or token-encryption key material instead of using provider-generated keys. Okta allows up to 50 keys per application and per authorization server, one active at a time. | 🟡 (Customer Signing Keys) | ✅ (base platform) | ❌ | 🟡 (plugin: jwt) |
| **Application secret and API key rotation**<br>*aka: Rotate your Clerk API keys (Clerk), client secret rotation (Okta)* | Documented, zero-downtime replacement of the credentials an application uses to call the identity service, including webhook signing secrets. Okta supports multiple concurrent client secrets so a client can cut over before the old one is retired. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | ✅ (Core, versioned secrets) |

### 14.8 Web attack surface: CSRF, origins and redirects

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Login-CSRF protection on authorization requests**<br>*aka: state parameter (Auth0), OAuth state + PKCE (BA)* | An opaque value echoed through the authorization round trip that lets the application bind the response to its own request, blocking a forged login. Better Auth expires the state cookie and deletes the stored verification record after the callback. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | ✅ (Core) |
| **CSRF protection on the identity service's own endpoints**<br>*aka: CSRF protection (Clerk), non-simple request requirement (BA)* | Prevents a cross-site form or image from reaching a state-changing auth endpoint, through SameSite cookies, authorized-party checks, and requiring a request shape a plain cross-site form cannot produce. Better Auth requires a custom header or JSON content type and treats GET as read-only. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | ✅ (Core) |
| **Fetch Metadata cross-site navigation checks**<br>*aka: Sec-Fetch-Site / Sec-Fetch-Mode / Sec-Fetch-Dest checks (BA)* | Uses the browser's own Fetch Metadata headers to reject cookie-less sign-in and sign-up requests reported as cross-site navigations, protecting first-login CSRF without tokens or client JavaScript. | ❔ (unverified) | ❔ (unverified) | ❔ (unverified) | ✅ (Core) |
| **Trusted origins / CORS allowlist**<br>*aka: Allowed Origins (CORS) and Allowed Web Origins (Auth0), Trusted Origins API (Okta), allowed origins and authorized parties (Clerk), trustedOrigins (BA)* | An explicit list of origins permitted to make cross-origin calls to the identity service and to receive its responses. Okta scopes each trusted origin to CORS, redirect and iframe-embed use during sign-in, sign-out and recovery. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | ✅ (Core) |
| **Wildcard and pattern origin matching**<br>*aka: wildcards-for-subdomains (Auth0), satellite domains (Clerk), trustedOrigins pattern syntax (BA)* | Matching an origin allowlist entry by pattern rather than exact string, for preview deployments and per-customer subdomains. Better Auth supports `?`, `*` and `**` with documented protocol-specific semantics and per-request dynamic resolution; Auth0 permits subdomain wildcards except where a FAPI compliance level is enforced. | 🟡 (subdomain wildcards; blocked under FAPI) | ❌ (exact origins only) | 🟡 (satellite/preview domains) | ✅ (Core) |
| **Redirect and callback URL allowlist with exact matching**<br>*aka: Allowed Callback URLs (Auth0), redirect URIs (Okta/Clerk), callbackURL validation (BA)* | Only pre-registered URLs may receive an authorization response or a post-authentication redirect, defeating open-redirect token theft. Better Auth additionally requires relative redirect targets to begin with a single `/` and rejects protocol-relative URLs, backslashes, control characters and encoded path separators. | ✅ (all plans) | ✅ (base platform, exact match) | ✅ (Hobby+) | ✅ (Core) |
| **Clickjacking / iframe-embedding control**<br>*aka: iframe-embed trusted origin scope (Okta), measures against app impersonation (Auth0)* | Controls whether the hosted sign-in experience may be framed by another site, defaulting to refusal and requiring an explicit allowlist entry to permit embedding. | ✅ (hosted login not framable) | ✅ (opt-in per trusted origin) | 🟡 (CSP guidance; app-hosted UI) | ➖ (no hosted UI) |

### 14.9 Isolation, assurance and security programme

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Tenant / instance isolation boundary**<br>*aka: tenant (Auth0), org (Okta), instance (Clerk)* | The top-level container holding applications, connections, users and configuration, with no data shared across boundaries. Auth0 tenant names are globally unique, 3–63 characters, immutable and non-reusable after deletion. | ✅ (all plans) | ✅ (base platform) | ✅ (Hobby+) | ➖ (one deployment per operator) |
| **Dedicated or single-tenant deployment**<br>*aka: Private Cloud (Auth0)* | Infrastructure not shared with other customers, for isolation, guaranteed throughput and regional placement. | 🟡 (Private Cloud on AWS or Azure) | 🟡 (dedicated cell / gov cloud) | ❌ | ✅ (self-hosted by design) |
| **Security dashboard with threat metrics and alerts**<br>*aka: Security Center / Security Alerts (Auth0), HealthInsight and ITP dashboards (Okta)* | An operator-facing view of attack traffic, threat classes and affected applications, with configurable alert, warning and recovery thresholds computed on a weighted moving average. Auth0's Security Center filters up to 14 days by application and connection, aggregated per minute, hour or day. | 🟡 (Security Center) | ✅ (base platform) | ❌ | ❌ |
| **Security configuration hardening audit**<br>*aka: HealthInsight (Okta)* | Automated review of the tenant's own security settings producing a prioritized list of recommended hardening tasks. | ❌ | ✅ (base platform) | ❌ | ❌ |
| **Third-party penetration testing** | Independent penetration tests and external code audits of the identity service and its SDKs, with reports available to customers. | ✅ (all plans) | ✅ (base platform) | ✅ (all plans) | ❌ (no published vendor test) |
| **Bug bounty programme** | A funded programme paying external researchers for validated vulnerabilities. Auth0 and Okta both run Bugcrowd programmes, Okta's public with rewards up to $15,000. Clerk states explicitly that it operates no paid bounty. | ✅ (Bugcrowd) | ✅ (Bugcrowd, public) | ❌ | ❌ |
| **Vulnerability disclosure policy**<br>*aka: Responsible Disclosure Program (Auth0), VDP (Clerk), GitHub Security Advisories (BA)* | A published channel and timeline for reporting security issues. Clerk targets a 3-business-day response and 90-day coordinated disclosure; Better Auth handles reports privately through GitHub Security Advisories with researcher credit. | ✅ (all plans) | ✅ (base platform) | ✅ (all plans) | ✅ (Core) |

---

## 15. Machine-to-machine, API keys & AI-agent identity

This is the fastest-moving area of the four products and the one where release status matters most: several capabilities below are Early Access, Research Release, experimental, or announcement-only, and are marked as such. Two structural differences dominate the economics. Auth0 and Clerk meter non-human traffic as a separate billable unit (Auth0 charges roughly $4 per 1,000 machine-to-machine tokens over the plan quota; Clerk charges $0.001 per token or key creation and $0.00001 per verification), whereas Better Auth is self-hosted and meters nothing, so machine volume costs only infrastructure. The second split is product shape: Clerk and Better Auth ship an API-key product you resell to your own end users, while Auth0 and Okta have no such feature and steer customers to machine-to-machine applications instead.

### 15.1 Machine principals and machine-to-machine tokens

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Registered machine principal**<br>*aka: Machine to Machine Application (Auth0), API Services app / Service Accounts API (Okta), Machines (Clerk)* | A non-human caller registered as a first-class identity in the directory, distinct from a human user, that credentials and tokens are issued against. | ✅ (all plans) | ✅ (API Services app) | ✅ (usage-based) | ❌ |
| **Machine credential storage and rotation**<br>*aka: client secret / private_key_jwt (Auth0, Okta), machine secret key (Clerk)* | The secret or key pair a machine principal authenticates with, retrievable and rotatable without re-registering the principal. | ✅ (all plans) | ✅ (private_key_jwt or secret) | ✅ (retrievable, rotatable) | ❌ |
| **Included machine-token quota per plan**<br>*aka: M2M tokens entitlement (Auth0), M2M token creations (Clerk)* | A monthly allowance of machine tokens bundled into the subscription before overage pricing applies. | ✅ (1,000 Free/Essentials; 5,000 Pro+) | 🟡 (Enterprise plan only) | ✅ (2,500 creations/mo free) | ➖ (self-hosted, no quota) |
| **Per-token metering and overage pricing for machine traffic**<br>*aka: M2M Add-on (Auth0), usage-based machine auth (Clerk)* | Machine tokens are counted and billed as their own unit, separate from human monthly-active-user pricing. | ✅ (~$4 per 1,000 extra) | 🟡 (Enterprise SKU line item) | ✅ ($0.001 create, $0.00001 verify) | ➖ (self-hosted, unmetered) |
| **Machine token format choice: opaque or JWT**<br>*aka: tokenFormat (Clerk)* | Opaque tokens are stored server-side so they can be listed and revoked; JWT tokens verify locally with no network call and no verification charge, but cannot be revoked. | ❌ (JWT access tokens only) | ❌ (JWT access tokens only) | ✅ (opaque default, JWT opt-in) | ➖ |
| **Machine token verification, enumeration and revocation**<br>*aka: verify() / revokeToken() (Clerk), introspection + revocation endpoints (Okta)* | Server-side endpoints or SDK helpers that validate a presented machine token and invalidate it before expiry, plus listing of live tokens. | 🟡 (JWKS validation; issued access tokens not revocable) | ✅ (introspect and revoke endpoints) | ✅ (opaque tokens only) | ➖ |
| **Custom claims and lifetime on machine tokens**<br>*aka: credentials-exchange Action (Auth0), claims + secondsUntilExpiration (Clerk)* | Arbitrary application claims and an explicit time-to-live set at token creation. | ✅ (Actions, all plans) | 🟡 (token inline hook, API AM) | ✅ (usage-based) | ➖ |
| **Directed machine-to-machine call permissions**<br>*aka: Client Grants (Auth0), scope grants (Okta), Machine Scopes (Clerk)* | An explicit graph declaring which machine principals may obtain tokens for, or call, which other machines or APIs. | ✅ (Client Grants) | ✅ (application grants) | ✅ (Machine Scopes) | ❌ |
| **Mixed credential acceptance in one request authenticator**<br>*aka: acceptsToken (Clerk), enableSessionForAPIKeys (BA)* | A single backend helper that decides whether a request carries a human session, an API key, a machine token or an OAuth token, without separate code paths. | ❌ (hand-written per credential) | ❌ (hand-written per credential) | ✅ (acceptsToken option) | 🟡 (plugin: api-key, session mocking only) |
| **Session token presented as an Authorization bearer header**<br>*aka: bearer plugin (BA)* | Accepts the human session token in an `Authorization: Bearer` header instead of a cookie, for CLIs, native apps and server-to-server callers that cannot hold cookies. | ✅ (all plans) | ✅ (all plans) | ✅ (all plans) | ✅ (plugin: bearer, OSS) |

### 15.2 API keys as a product surface

Rows in this table are about keys *your end users or tenants* mint against *your* API. Auth0 and Okta have no such product: Auth0 support and community guidance direct customers to machine-to-machine applications and short-lived JWTs instead, so the ❌ cells below are a deliberate product position rather than a documentation gap.

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **End-user- or tenant-issued API keys**<br>*aka: API Keys (Clerk), apiKey plugin (BA)* | Long-lived opaque credentials that your own users or organizations create to delegate programmatic access to your API. | ❌ | ❌ | ✅ (GA 2026-04-17, metered) | ✅ (plugin: api-key, OSS) |
| **Key creation with one-time secret disclosure** | The plaintext key value is returned exactly once at creation and never again; only a hash is retained. | ❌ | ❌ | ✅ (metered) | ✅ (plugin: api-key, OSS) |
| **Key verification endpoint**<br>*aka: POST /api_keys/verify (Clerk), verifyApiKey() (BA)* | A server-side call that validates a presented key and returns the key record, optionally asserting required permissions. | ❌ | ❌ | ✅ ($0.00001 per verify) | ✅ (plugin: api-key, OSS) |
| **Key lifecycle management API**<br>*aka: API Keys endpoints (Clerk), get/update/list/delete (BA)* | Programmatic create, read, update, paginated list, revoke and delete over a principal's keys. | ❌ | ❌ | ✅ (metered) | ✅ (plugin: api-key, OSS) |
| **Key hashing at rest**<br>*aka: disableKeyHashing (BA)* | Only a hash of each key is stored, so a database disclosure does not yield usable credentials. | ❌ | ❌ | ✅ (opaque keys) | ✅ (default on, plugin: api-key) |
| **Key prefix and masked preview characters**<br>*aka: defaultPrefix / startingCharactersConfig (BA)* | A recognizable prefix on each key plus stored leading characters so a console can show a masked preview of a hashed key. | ❌ | ❌ | ❌ | ✅ (plugin: api-key, OSS) |
| **Arbitrary key metadata**<br>*aka: claims (Clerk), enableMetadata (BA)* | JSON stored alongside a key, for example the plan, tenant or environment it belongs to. | ❌ | ❌ | ✅ (metered) | ✅ (plugin: api-key, OSS) |
| **Per-key permissions or scopes**<br>*aka: scopes (Clerk), permissions map (BA)* | A resource-to-actions map attached to a key, enforced at verification time. | ❌ | ❌ | ✅ (metered) | ✅ (plugin: api-key, OSS) |
| **Per-key rate limiting**<br>*aka: rateLimitEnabled / rateLimitTimeWindow / rateLimitMax (BA)* | A sliding-window request quota applied whenever a specific key is validated, configurable globally and overridable per key. Clerk rate-limits the instance, not the individual issued key. | ❌ | ❌ | ❌ (instance-level limits only) | ✅ (plugin: api-key, OSS) |
| **Per-key usage quota with automatic refill**<br>*aka: remaining / refillInterval / refillAmount (BA)* | A remaining-uses counter decremented on each validation, disabling the key at zero and resetting on a fixed interval — the primitive behind credit-style API plans. | ❌ | ❌ | ❌ | ✅ (plugin: api-key, OSS) |
| **Key expiry and expiry bounds**<br>*aka: secondsUntilExpiration (Clerk), keyExpiration min/max (BA)* | Keys never expire by default; a default lifetime can be set, client-supplied expiries bounded or forbidden, and Better Auth adds an endpoint that purges every key past its expiry. | ❌ | ❌ | 🟡 (expiry only, no bounds) | ✅ (plugin: api-key, OSS) |
| **Organization-owned keys with role-gated management**<br>*aka: Organization API keys (Clerk), references: "organization" (BA)* | An organization rather than an individual user owns the key, and management is gated by the organization's role permissions. | ❌ | ❌ | ✅ (Business plan orgs) | ✅ (plugins: api-key + organization) |
| **Prebuilt key-management UI**<br>*aka: `<APIKeys />` component (Clerk)* | A drop-in interface where end users create, view and revoke their own keys, embeddable in a profile page. | ❌ | ❌ | ✅ (in UserProfile / OrganizationProfile) | ❌ (headless, build your own) |
| **Several independent key types in one deployment**<br>*aka: multiple apiKey configs with configId (BA)* | Distinct key classes — publishable versus secret, or one per pricing tier — each with its own prefix, rate limit, permissions and storage. | ❌ | ❌ | ❌ | ✅ (plugin: api-key, OSS) |
| **Custom key transport, generation and pre-validation**<br>*aka: apiKeyHeaders / customKeyGenerator / customAPIKeyValidator (BA)* | Overrides for which headers carry the key, how it is extracted and generated, and a cheap pre-check that rejects malformed keys before any database lookup. | ❌ | ❌ | ❌ | ✅ (plugin: api-key, OSS) |
| **Authenticated session derived from an API key**<br>*aka: x-api-key header session (BA)* | A valid user-owned key in the request headers is treated as an authenticated session by ordinary endpoints; organization-owned keys cannot mock a session. | ❌ | ❌ | 🟡 (acceptsToken, no session object) | ✅ (plugin: api-key, OSS) |
| **Per-key metering and billing**<br>*aka: API key creations / verifications (Clerk)* | Key creations and verifications are counted and charged as billable units. | ➖ | ➖ | ✅ (1,000 + 100,000/mo free) | ➖ (self-hosted, unmetered) |

### 15.3 Management-plane API credentials

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Static long-lived token for the provider's own management API**<br>*aka: SSWS API token (Okta), Secret Key (Clerk)* | A non-expiring bearer credential used to call the identity product's administrative API. Okta's SSWS tokens inherit the creating admin's privileges, expire after 30 days of non-use, die with the creating user, and are shown once; Okta steers new work to scoped OAuth tokens instead. | ❌ (M2M client credentials only) | ✅ (legacy; OAuth preferred) | ✅ (instance Secret Key) | ➖ (no hosted control plane) |
| **Network or IP restriction on a management credential**<br>*aka: API token IP/network zone restriction (Okta)* | Binds an administrative token to specific IP ranges or named network zones so it is unusable from other origins. | 🟡 (tenant ACLs) | ✅ (network zones) | ❌ | ➖ |
| **Per-principal share of the org rate-limit budget**<br>*aka: Principal Rate Limits API (Okta)* | Caps how much of the tenant's total API rate-limit bucket a single token or OAuth client may consume, so one runaway integration cannot starve the rest. | ❌ | ✅ (Principal Rate Limits API) | ❌ | ➖ |

### 15.4 Delegation, on-behalf-of access and human approval

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **On-behalf-of token exchange preserving user context**<br>*aka: On-Behalf-Of Token Exchange (Auth0), Delegation Links API (Okta)* | A service or agent exchanges the token it holds for a short-lived token scoped to a downstream API, so the call carries the original user's identity rather than a broad service credential. | ✅ (GA) | ✅ (Okta for AI Agents) | ❌ | ❌ |
| **Multi-hop delegation chain recorded in the token**<br>*aka: act actor claim / nested actors (Auth0)* | An RFC 8693 `act` claim naming each intermediary, so a resource server can see the full chain from human to agent to service. Auth0 supports up to five nested actor levels. | 🟡 (Early Access claims profile) | 🟡 (ID-JAG chaining) | ❌ | ❌ |
| **Asynchronous out-of-band human approval of a machine-initiated action**<br>*aka: Asynchronous Authorization / CIBA (Auth0), CIBA grant / transactional verification (Okta)* | The caller's backend requests approval and polls while the user approves on a separate trusted device — push, SMS, email or a browser page — letting an agent pause for consent mid-run. Auth0 caps this at 5,000 concurrent transactions. | ✅ (add-on; Enterprise includes) | ✅ (CIBA grant) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Itemized transaction detail in the approval prompt**<br>*aka: Rich Authorization Requests in CIBA (Auth0), capability arguments (BA)* | The approval screen states the concrete action and its parameters instead of a generic scope list. | ✅ (GA) | ❔ (unverified) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Per-operation approval strength**<br>*aka: approvalStrength (BA)* | Mutating operations require stronger verification such as WebAuthn while reads are approved with an ordinary session. | 🟡 (Actions raise mfa_required) | 🟡 (policy-driven) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Enterprise-mediated cross-application access**<br>*aka: Cross App Access / XAA (Auth0, Okta), Agent SSO (Okta), ID-JAG* | The IETF Identity Assertion JWT Authorization Grant lets a requesting app or agent obtain a token from the enterprise IdP to call a second vendor's API on the user's behalf, replacing per-user OAuth consent and static API keys with central IT policy. This is the protocol behind MCP's Enterprise-Managed Authorization extension. | 🟡 (Early Access; Enterprise / B2B plans) | ✅ (GA as Agent SSO, Aug 2026) | ❌ | ❌ |

### 15.5 Third-party provider token brokerage

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Stored third-party provider tokens retrievable by your backend**<br>*aka: Token Vault (Auth0), oauth_access_tokens endpoint / getUserOauthAccessToken() (Clerk), account table + getAccessToken() (BA)* | The identity layer holds the access and refresh tokens a user granted to external providers and hands them to your backend on request, so an agent tool never handles provider credentials directly. | ✅ (2 vaults Free, 4 Enterprise) | 🟡 (agent third-party token exchange) | ✅ (all plans) | ✅ (Core, OSS) |
| **Automatic refresh of an expired provider token**<br>*aka: refresh token exchange (Auth0), getAccessToken auto-refresh / refreshToken() (BA)* | The stored refresh token is exchanged transparently when the access token has expired, so callers always receive a live token. | ✅ (with Token Vault) | ❔ (unverified) | ❔ (unverified) | ✅ (Core, OSS) |
| **Curated provider connector catalog for brokered calls**<br>*aka: Auth0 for AI Agents Connections* | A documented set of external providers wired for token brokerage. Auth0 documents 26 connectors including Google Workspace, Microsoft Entra, Slack, GitHub, Salesforce, Box, Stripe Connect, plus generic OAuth2 and OIDC. | ✅ (26 connectors + generic) | 🟡 (per-integration) | 🟡 (social providers only) | 🟡 (social + genericOAuth) |
| **Provider token retrieval with no active user session**<br>*aka: Token Vault Privileged Worker (Auth0)* | A background or fully autonomous agent fetches a user's stored external token via a signed JWT bearer assertion while the user is offline. | 🟡 (Early Access, 2026-07-30) | ❔ (unverified) | ✅ (backend API call) | ✅ (Core, server-side) |
| **Accounts linked purely for API access rather than sign-in**<br>*aka: Connected Accounts for Token Vault (Auth0)* | A separate consent flow that attaches an external provider to a user profile only to obtain API tokens, without making it a login identity. | ✅ (GA; Organizations supported) | ❌ | 🟡 (social connection doubles as login) | 🟡 (account linking doubles as login) |
| **Provider token encryption at rest**<br>*aka: account.encryptOAuthTokens (BA)* | Stored provider access and refresh tokens are encrypted in the datastore. Better Auth defaults this off and also documents a hook-based custom-encryption pattern. | ✅ (managed) | ✅ (managed) | ✅ (managed) | 🟡 (Core, opt-in flag) |
| **Upstream credential injection for proxied agent calls**<br>*aka: resolveHeaders (BA)* | The framework attaches a service token or a user-scoped token to the outbound call when it proxies an agent's request to an upstream API. | 🟡 (AI SDK helpers) | ❌ | ❌ | 🟡 (plugin: agent-auth, experimental) |

### 15.6 Model Context Protocol authorization

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **MCP server authorization**<br>*aka: Auth for MCP (Auth0), Build an MCP server with Clerk, mcp() plugin (BA)* | An OAuth 2.1 authorization server configured for the Model Context Protocol authorization spec: user sign-in before an agent connects, resource-scoped tokens, and standards-based client identification. | ✅ (GA 2026-05-05) | ✅ (Okta for AI Agents) | ✅ (OAuth AS + guides) | ✅ (plugin: @better-auth/mcp, OSS) |
| **Protected resource metadata (RFC 9728)**<br>*aka: /.well-known/oauth-protected-resource* | A served document telling MCP clients which authorization server protects the resource, which scopes it supports, the `resource` value tokens must be bound to, and supported proof-of-possession algorithms. | ✅ (GA) | ✅ (XAA resource metadata) | 🟡 (AS metadata served; resource doc is yours) | ✅ (plugin: @better-auth/mcp, OSS) |
| **Resource identifier binding on issued tokens**<br>*aka: resource option (BA), Resource Parameter Compatibility Profile (Auth0)* | Access tokens carry the MCP resource as their audience so a token minted for one resource cannot be replayed at another. | ✅ (tenant setting) | ✅ (Okta for AI Agents) | ❔ (unverified) | ✅ (plugin: @better-auth/mcp, OSS) |
| **Route guard that verifies an MCP request**<br>*aka: requireMcpAuth / createMcpProtectedRequestHandler (BA)* | A wrapper for an MCP route handler that reads the Authorization header, verifies signature, issuer, audience and expiry against JWKS with no database round trip, and passes verified claims through. | 🟡 (SDK samples, no guard) | 🟡 (SDK samples, no guard) | 🟡 (auth() helper, generic) | ✅ (plugin: @better-auth/mcp, OSS) |
| **Authorization challenge and per-request step-up for tools**<br>*aka: insufficient_scope challenge / createInsufficientScopeError (BA)* | Unauthenticated calls get an RFC 9728 `WWW-Authenticate` challenge pointing at the resource metadata, and a handler can demand exactly the scopes a specific tool needs so the client re-authorizes once for all of them. | 🟡 (standard OAuth errors) | 🟡 (standard OAuth errors) | 🟡 (standard OAuth errors) | ✅ (plugin: @better-auth/mcp, OSS) |
| **Sender-constrained tokens enforced at the MCP resource**<br>*aka: DPoP (RFC 9449)* | Proof-of-possession is checked at the MCP route itself, with a shared replay store so a stolen token is unusable from another client. | 🟡 (DPoP at the AS) | ❔ (unverified) | ❌ | ✅ (plugin: @better-auth/mcp, OSS) |
| **MCP server registered as a governed resource**<br>*aka: MCP Server Registrations API (Okta)* | The MCP server is an inventoried object in the identity product, so tool calls against it can be policy-gated and audited centrally rather than per-server. | ❌ | ✅ (Okta for AI Agents) | ❌ | ❌ |
| **Aggregated or virtual MCP endpoint**<br>*aka: Virtual MCP Servers API (Okta)* | One identity-fronted MCP surface composed from several underlying MCP servers, with its own registrations and connections. | ❌ | ✅ (Okta for AI Agents) | ❌ | ❌ |
| **Fine-grained authorization over individual MCP tools**<br>*aka: Control Access to MCP Tools with FGA (Auth0), resolveCapabilities (BA)* | Which tools a given caller may invoke is decided per caller — by role, group, plan, tenant or a time-bounded rule — rather than by a single scope covering the whole server. | ✅ (with Auth0 FGA) | ✅ (Okta for AI Agents) | ❌ | 🟡 (plugin: agent-auth, experimental) |

### 15.7 AI agent identity primitives

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Agents as first-class principals**<br>*aka: Agent as Principal (Auth0), Okta for AI Agents / AI Agent Registrations API (Okta), Agent Auth provider (BA)* | An AI agent is registered as its own identity with a stable identifier, metadata and lifecycle, separate from both human users and ordinary applications. Auth0 mints `agt_` identifiers with an optional immutable external ID and no credentials of its own. | 🟡 (Early Access; contact support) | ✅ (GA 30 Apr 2026) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Agent credential registration**<br>*aka: AI Agent Credentials API, public key / BYOK (Okta)* | The public keys or client associations an agent uses to authenticate, managed independently of the agent record. | 🟡 (via associated M2M clients) | ✅ (Okta for AI Agents) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Agent identity claims in issued tokens**<br>*aka: sub_profile / client_profile (Auth0)* | Tokens carry the entity type of subject and client — user, AI agent, service, browser app, native app — so a resource server can tell a human-driven call from an agent-driven one. Auth0 makes this opt-in per resource server and applies it to access tokens only. | 🟡 (Early Access, opt-in) | ✅ (Okta for AI Agents) | ❌ | 🟡 (JWT capability claims, experimental) |
| **Agent lifecycle state and revocation**<br>*aka: STAGED / ACTIVE / INACTIVE (Okta), agent revocation events (BA)* | An explicit lifecycle for agent identities, including deactivating a misbehaving agent and killing its tokens. | 🟡 (Early Access) | ✅ (GA) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Per-agent audit trail**<br>*aka: Agent ID in Tenant Logs (Auth0), onEvent (BA)* | Every token issuance and capability execution records the agent identifier, so agent activity is auditable separately from human activity. | 🟡 (Early Access) | ✅ (GA) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Per-agent identity billing**<br>*aka: AI Agents add-on (Auth0)* | Active agent identities are a priced unit. Auth0 charges 50% of the plan's base MAU price for the add-on, which also unlocks unlimited Token Vault connected apps and all CIBA forms. | ✅ (+50% of base plan) | ❔ (unverified) | ➖ | ➖ (self-hosted, unmetered) |
| **Agent capability declarations with typed inputs**<br>*aka: capabilities with JSON Schema input (BA)* | The service declares narrow, reviewable actions an agent may take, each with a name, human-readable description and a schema for its arguments, instead of exposing broad API access. | ❌ (scopes only) | ❌ (scopes only) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Capability grants with runtime constraints**<br>*aka: capabilityGrants with constraints (BA)* | Persisted per-agent grants, intersected with the token's claims at call time, that may carry constraints validated against the actual request arguments. | ❌ | 🟡 (policy + FGA) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Delegated versus autonomous agent modes**<br>*aka: modes: delegated / autonomous, resolveAutonomousUser (BA)* | The same agent can act on behalf of a signed-in user or under an application-resolved identity with no interactive user present. | ✅ (OBO plus client credentials) | ✅ (Okta for AI Agents) | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Capability generation from an OpenAPI document**<br>*aka: createFromOpenAPI / fromOpenAPI (BA)* | Reads an OpenAPI 3.x spec and produces one agent capability per operation, merging path, query, header and body parameters into a single input schema, with a proxy handler that forwards calls upstream. | ❌ | ❌ | ❌ | 🟡 (plugin: agent-auth, experimental) |
| **Agent-to-agent server registration**<br>*aka: A2A Server Registrations API (Okta)* | Agent-to-agent protocol endpoints registered as resource servers so one agent calling another is authorized and logged centrally. | ❌ | ✅ (GA, July 2026) | ❌ | ❌ |
| **Server-created authenticated session for an agent acting as a user**<br>*aka: Agent Tasks (Clerk)* | A backend mints a real user session without the interactive sign-in flow and returns a URL that starts it, so an agent can operate inside the user's own session. Revocable. | ❌ | ❌ | ✅ (Backend API) | 🟡 (admin plugin impersonation) |
| **Identity-aware agent and tool gateway**<br>*aka: Agent Gateway (Auth0, Okta)* | A proxy between agents and enterprise tools that aggregates MCP servers behind one endpoint, applies identity and policy on every tool call, and produces a unified audit trail. Auth0's is marketed on auth0.com/ai as "shipping next" with no documentation pages; Okta's is a Research Release requiring request. | ❌ (announcement only, undocumented) | 🟡 (Research Release) | ❌ | ❌ |
| **Framework SDKs for agent authorization**<br>*aka: Auth0-AI SDKs (Auth0), agentAuthClient + @auth/agent-cli (BA)* | Language and framework packages wrapping token brokerage, human approval and tool authorization for LangChain, LlamaIndex, Vercel AI, Cloudflare Agents, Genkit and similar. | ✅ (JS and Python + framework SDKs) | 🟡 (reference integrations) | 🟡 (SDK helpers) | 🟡 (plugin: agent-auth, experimental) |
| **Vendor tooling for coding agents**<br>*aka: Auth0 MCP Server + Agent Skills, Okta Open Source / Managed MCP Server, Clerk MCP server + Skills + `--mode agent` CLI* | An MCP server exposing the identity product's own configuration to AI coding tools, plus packaged skills and a non-interactive CLI contract so an agent can drive setup and deployment. | ✅ (MCP server + Claude Code skills) | ✅ (self-hosted and managed MCP) | ✅ (Hobby; MCP + Skills + agent CLI) | ❌ |

---

## 16. Billing & monetization of your own users

Using the identity system to charge *your* customers: defining plans, attaching entitlements to them, running checkout, and keeping a subscription in step with the account record. Two of the four products have nothing here — **Auth0 and Okta ship no subscription-billing capability at all**, so their columns are almost uniformly ❌ and the section is deliberately short rather than padded. Clerk ships a single opinionated product (Clerk Billing, Stripe-only, charging **0.7% of billing volume on top of Stripe's own 2.9% + $0.30**), while Better Auth ships no billing in core and instead offers seven separate payment plugins of which only `@better-auth/stripe` is first-party — the rest are maintained by the payment vendors themselves and differ sharply in coverage, so a plugin-by-plugin comparison follows the main tables.

### 16.1 Plans, prices & entitlements

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Subscription billing of end users built into the identity product**<br>*aka: Clerk Billing / Commerce (Clerk), payment plugins (BA)* | The identity product itself can charge the application's own customers, rather than only authenticating them. | ❌ | ❌ | ✅ (Billing, all plans) | 🟡 (7 payment plugins) |
| **Plan / pricing-tier definition**<br>*aka: Plans (Clerk), `subscription.plans` (BA)* | Named subscription tiers with a recurring price, which a customer can hold exactly one of at a time. | ❌ | ❌ | ✅ (Dashboard-defined) | 🟡 (plugin: stripe / chargebee) |
| **Plan catalog declared in application code**<br>*aka: `subscription.plans` array or async function (BA)* | Plans live in the codebase (or are resolved at request time from the app's own database) instead of only in a vendor dashboard. Clerk's plans exist only in its Dashboard and do not sync with Stripe products. | ❌ | ❌ | ❌ | 🟡 (plugin: stripe / chargebee) |
| **Annual billing variant of a plan**<br>*aka: annual prices (Clerk), `annualDiscountPriceId` (BA)* | A second, usually discounted, price on the same plan selected by a flag at checkout rather than by a separate plan. | ❌ | ❌ | ✅ (Billing; annual-only plans supported) | 🟡 (plugin: stripe) |
| **Automatic free default plan**<br>*aka: Default Plan (Clerk)* | Every account always holds an active subscription; downgrade, cancellation and payment failure fall back to a free plan instead of leaving the account with none. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: autumn, provider-side default) |
| **Named feature flags attached to a plan**<br>*aka: Features (Clerk), features / feature codes (BA: autumn, commet)* | Named capabilities associated with a plan, which become the unit the application checks and the pricing table displays. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: autumn / commet) |
| **Numeric quota limits attached to a plan**<br>*aka: plan `limits` object (BA)* | Arbitrary numeric quotas (projects, seats, storage) declared on the plan and returned with the subscription, so the app enforces limits without a second lookup. Clerk's Features are named capabilities, not numeric quotas. | ❌ | ❌ | ❌ | 🟡 (plugin: stripe / chargebee) |
| **Plan-based entitlement check in application code**<br>*aka: `has({ plan })` (Clerk), `subscription.list()` (BA)* | A first-class call answering whether the caller's active subscription is on a given plan, usable on server and client. | ❌ | ❌ | ✅ (Billing enabled) | 🟡 (plugin: read the subscription record) |
| **Feature-based entitlement check in application code**<br>*aka: `has({ feature })` (Clerk), `check({ featureId })` / `features.check()` (BA)* | A call answering whether the caller may use a named feature, resolved from whatever plan grants it, so gating does not hard-code plan names. | ❌ | ❌ | ✅ (Billing for billing features) | 🟡 (plugin: autumn / commet) |
| **One-off custom price for a single customer**<br>*aka: Custom Plans and prices (Clerk)* | A price created for one named customer, including a $0 complimentary price that grants paid features without appearing on the public pricing table. | ❌ | ❌ | ✅ (Billing) | ❌ |
| **Discounts and customer-redeemable promo codes**<br>*aka: Discounts / Promo codes (Clerk), `discountCode` / promotion codes (BA)* | Percentage or fixed reductions applied to a subscription for a set number of cycles, plus codes a customer enters at checkout with availability dates, redemption caps and per-plan eligibility. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: creem code; stripe via checkout params) |
| **Prepaid account credits**<br>*aka: Account credits (Clerk)* | A monetary balance held on the user or organization, applied to eligible charges before the payment method, with a ledger of adjustments. | ❌ | ❌ | ✅ (Billing) | ❌ |

### 16.2 Subscription lifecycle & trials

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Checkout session creation / subscription purchase**<br>*aka: Checkout drawer, `<CheckoutButton />` (Clerk), `subscription.upgrade()` / `checkout()` / `attach()` (BA)* | The flow that collects payment details and activates a subscription. Clerk renders it in-app; every Better Auth plugin redirects to a provider-hosted page. | ❌ | ❌ | ✅ (Billing, in-app drawer) | 🟡 (plugin: all seven, hosted) |
| **Plan upgrade and downgrade on an existing subscription**<br>*aka: price transition (Clerk), `subscription.upgrade({ subscriptionId })` / `subscription.update()` (BA)* | Moving a live subscription to a different plan without opening a second one, so the customer is not billed twice. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: stripe / chargebee / autumn) |
| **Proration control on a mid-cycle plan change**<br>*aka: `prorationBehavior` (BA)* | Explicit choice between prorating the change, invoicing it immediately, or skipping proration. Clerk exposes no proration setting: free→paid activates at once, paid→paid is deferred to period end, paid→free runs out the paid period. | ❌ | ❌ | ❌ | 🟡 (plugin: stripe) |
| **Deferred plan change at end of billing period**<br>*aka: scheduled price transition (Clerk), `scheduleAtPeriodEnd` (BA)* | The new plan starts when the current period ends, with no proration and no double billing; a pending schedule is released if superseded. | ❌ | ❌ | ✅ (Billing, automatic for paid→paid) | 🟡 (plugin: stripe) |
| **Subscription cancellation**<br>*aka: `cancelSubscriptionItem()` (Clerk), `subscription.cancel()` (BA)* | Ending a subscription while leaving plan access in place through the paid period. Only Commet exposes an immediate-termination option and a recorded cancellation reason; Clerk and the other plugins always cancel at period end. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: stripe / chargebee / creem / autumn / commet) |
| **Restoring a pending cancellation or plan change**<br>*aka: `subscription.restore()` (BA)* | Reversing a scheduled cancellation or releasing a pending plan-change schedule before it takes effect. It cannot revive an already-ended subscription. | ❌ | ❌ | ❌ | 🟡 (plugin: stripe) |
| **Explicit subscription status model**<br>*aka: Subscription / Subscription Item states (Clerk), `status` plus `cancelAtPeriodEnd` / `cancelAt` / `canceledAt` / `endedAt` (BA)* | A documented state machine distinguishing active, trialing, upcoming, past-due, incomplete, abandoned, canceled-pending and ended, so the app can tell a requested cancellation from an effective one. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: stripe / chargebee / creem) |
| **Several concurrent plans on one customer**<br>*aka: subscription items (Clerk), multi-item subscriptions (BA: chargebee)* | More than one plan or add-on billed under the same customer at once. The Stripe and Chargebee plugins allow only one active subscription per reference id and reject or duplicate-bill a second. | ❌ | ❌ | ✅ (Billing, one item per plan) | 🟡 (plugin: chargebee item arrays only) |
| **Free trial period per plan**<br>*aka: Free trials (Clerk), `freeTrial.days` (BA)* | A plan-level trial of a configurable length that starts the subscription in a trialing state. Clerk supports 1–365 days and requires a payment method by default (disableable); the Chargebee plugin also accepts an explicit trial-end date per call. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: stripe / chargebee) |
| **Duplicate-trial prevention**<br>*aka: one trial per user per application (Clerk), trial abuse prevention (BA)* | A customer who has already consumed a trial on any plan is charged immediately instead of receiving another. Always on in the Stripe plugin and in Creem's database mode; an opt-in flag in Chargebee. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: stripe / creem / chargebee) |
| **Trial extension and early termination**<br>*aka: `extendSubscriptionItemFreeTrial()` (Clerk), `trialEnd` override (BA: chargebee)* | Administratively lengthening an active trial, cancelling it at period end, or ending it immediately. | ❌ | ❌ | ✅ (Billing, Dashboard and Backend API) | 🟡 (plugin: chargebee, new subscriptions only) |
| **Trial lifecycle notifications**<br>*aka: `subscriptionItem.freeTrialEnding` (Clerk), `onTrialStart` / `onTrialEnd` / `onTrialExpired` (BA)* | Server-side signals when a trial starts, is about to expire (Clerk fires three days ahead), ends, or lapses without converting. | ❌ | ❌ | ✅ (Billing, webhook) | 🟡 (plugin: stripe / chargebee) |

### 16.3 Billing subject, organizations & usage

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Payment-provider customer record linked to the account**<br>*aka: `createCustomerOnSignUp`, `externalId` (BA)* | A billing customer created for the account and joined to the auth user, optionally at sign-up rather than at first purchase, with hooks to inject metadata at creation. | ❌ | ❌ | ✅ (Billing, managed internally) | 🟡 (plugin: all seven) |
| **Organization as the billing subject**<br>*aka: Billing for Organizations (Clerk), `customerType: "organization"` (BA)* | The organization, not the individual, is the customer and holds the subscription; B2B purchases are managed by members with billing rights. | ❌ | ❌ | ✅ (Billing for orgs) | 🟡 (plugin: stripe / chargebee / autumn) |
| **Arbitrary entity as the billing subject**<br>*aka: `referenceId` / `identify()` (BA)* | Subscriptions keyed to any entity id — a workspace, a project, a team — rather than only to a user or a first-class organization. | ❌ | ❌ | ❌ | 🟡 (plugin: stripe / chargebee / polar / autumn) |
| **Authorization of billing operations per subject**<br>*aka: billing permissions (Clerk), `authorizeReference({ action })` (BA)* | A check deciding who may purchase, change, cancel or view billing for a given subject, with the attempted operation available so rules can differ per action. | ❌ | ❌ | ✅ (Billing, org permission) | 🟡 (plugin: stripe / chargebee) |
| **Per-seat pricing**<br>*aka: Per-seat pricing (Clerk), `seats` / `seatPriceId` / `seats()` sub-plugin (BA)* | Charging per occupied seat on a team plan, optionally with a base fee and included free seats. Clerk counts members plus pending invitations and reconciles at renewal; Commet exposes relative add/remove and absolute set across several seat types. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: stripe / chargebee / commet) |
| **Plan-enforced seat cap on an organization**<br>*aka: Seat limits (Clerk)* | The plan itself caps organization membership and blocks further invitations once the cap is hit. Better Auth plugins expose the seat count but leave enforcement to the application. | ❌ | ❌ | 🟡 (Billing; >20 seats needs B2B Authentication Enhanced) | ❌ |
| **Usage-based (metered) billing**<br>*aka: usage / meters / metered features (BA)* | Charging on consumption rather than a flat recurring price. Clerk's pricing page still advertises usage billing as forthcoming. | ❌ | ❌ | ❌ | 🟡 (plugin: polar / autumn / commet) |
| **Usage event ingestion**<br>*aka: `usage.ingest()` / `track()` (BA)* | Recording a named consumption event, attributed to the authenticated customer, as the input to metered pricing; Commet adds an idempotency key so retries are safe. | ❌ | ❌ | ❌ | 🟡 (plugin: polar / autumn / commet) |
| **Metered balance read and pre-charge overage check**<br>*aka: `usage.meters.list()`, `features.canUse()` (BA)* | Reading consumed, credited and remaining units per meter, and asking before an action whether one more unit is allowed and whether it would incur an overage charge. | ❌ | ❌ | ❌ | 🟡 (plugin: polar / autumn / commet) |

### 16.4 Checkout surfaces & prebuilt UI

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Prebuilt pricing-table component**<br>*aka: `<PricingTable />` (Clerk)* | A drop-in component rendering the plan catalog and its features for users or organizations, with props for a highlighted plan, CTA placement, feature collapsing and checkout appearance. | ❌ | ❌ | ✅ (Billing) | ❌ |
| **Prebuilt purchase-confirmation UI**<br>*aka: Checkout drawer (Clerk), `AttachDialog` (BA: autumn)* | A shipped component that confirms and completes a purchase in the application rather than sending the buyer to a hosted page. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: autumn, React only) |
| **In-app subscription-management UI**<br>*aka: `<SubscriptionDetailsButton />`, `<PlanDetailsButton />` (Clerk)* | Components opening the caller's current subscription and plan details for self-service management inside the application. | ❌ | ❌ | ✅ (Billing) | ❌ |
| **Provider-hosted customer portal session**<br>*aka: `subscription.billingPortal()` / `customer.portal()` / `createPortal()` (BA)* | A generated URL to the payment provider's own portal for payment methods, invoices, subscription changes and billing history. Clerk does not expose the Stripe portal; it replaces it with its own components. | ❌ | ❌ | ❌ | 🟡 (plugin: all seven) |
| **Server-side checkout parameter customization**<br>*aka: `getCheckoutSessionParams()` / `getHostedPageParams()` (BA)* | A hook injecting provider-specific options into the checkout session — promotion codes, billing-address collection, custom text, metadata, embed mode, idempotency keys. | ❌ | ❌ | ❌ | 🟡 (plugin: stripe / chargebee) |

### 16.5 Invoices, payments & webhooks

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Invoice / billing statement access**<br>*aka: `/billing/statements` (Clerk), invoices / orders expansion (BA)* | Programmatic listing and retrieval of the customer's issued statements or invoices. | ❌ | ❌ | ✅ (Billing, Backend API) | 🟡 (plugin: autumn / polar / commet) |
| **Payment and transaction history**<br>*aka: payment attempts (Clerk), `payments.list()` / `searchTransactions()` / `orders.list()` (BA)* | Paginated history of charges with amount, currency and status, filterable by status or product. | ❌ | ❌ | ✅ (Billing, Backend API) | 🟡 (plugin: dodo / creem / polar) |
| **Payment-failure and past-due handling**<br>*aka: `subscription.pastDue`, `paymentAttempt.updated` (Clerk), `onSubscriptionPastDue` / `onPaymentFailed` (BA)* | Signals when a recurring charge fails, distinguishing checkout from renewal failures, and a defined consequence — Clerk drops the customer back to the default free plan. | ❌ | ❌ | ✅ (Billing) | 🟡 (plugin: creem / commet / chargebee) |
| **Refund and dispute handling**<br>*aka: `onRefundCreated` / `onDisputeCreated` (BA)* | Issuing refunds, or at minimum reacting to refunds and chargebacks. Clerk explicitly cannot refund — refunds are done in Stripe directly. No Better Auth plugin initiates a refund; several deliver refund and dispute events. | ❌ | ❌ | ❌ | 🟡 (plugin: polar / creem, events only) |
| **Billing webhook endpoint with verification**<br>*aka: Webhooks via Svix (Clerk), mounted webhook route (BA)* | A receiving endpoint that authenticates each delivery before processing — signature verification everywhere except the Chargebee plugin, which uses HTTP Basic credentials. | ❌ | ❌ | ✅ (Billing, Svix + `verifyWebhook()`) | 🟡 (plugin: six of seven; autumn needs none) |
| **Billing event catalog and typed lifecycle hooks**<br>*aka: `subscription.*` / `subscriptionItem.*` / `paymentAttempt.*` (Clerk), `onSubscriptionCreated` etc. (BA)* | Named events or in-process callbacks per lifecycle transition. Clerk emits roughly fifteen billing webhook types; the Polar plugin exposes over twenty-five typed handlers, and the Stripe, Chargebee, Creem and Commet plugins add in-process subscription hooks that a webhook cannot replace. | ❌ | ❌ | ✅ (Billing, webhooks only) | 🟡 (plugin: stripe / polar / creem / chargebee / commet) |
| **Local subscription mirror in the application database**<br>*aka: `subscription` table, `creem_subscription` (BA)* | A subscription table in the app's own database kept in sync by webhooks, so entitlement can be decided with a SQL query instead of a provider API call. Clerk's billing state is hosted and read through its API. | ❌ | ❌ | ❌ | 🟡 (plugin: stripe / chargebee / creem) |

### 16.6 Commercial terms & documented limits

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Vendor take rate on your transaction volume** | What the identity vendor charges on money you collect, on top of the payment processor's own fees. Clerk takes **0.7% of billing volume** with no base fee, on top of Stripe's 2.9% + $0.30 — roughly 3.6% + $0.30 all-in. Better Auth takes nothing; you pay only the chosen provider. | ➖ | ➖ | 🟡 (0.7% of volume, all plans) | ✅ (0%, provider fees only) |
| **Choice of payment provider** | Whether the application picks its payment processor. Clerk Billing uses Stripe exclusively and its plans do not sync with existing Stripe Billing objects. | ➖ | ➖ | 🟡 (Stripe only) | ✅ (7 providers via plugins) |
| **Merchant-of-record option** | A provider that becomes the seller of record and assumes tax remittance and compliance. Clerk is explicitly not a merchant of record. | ➖ | ➖ | ❌ | 🟡 (plugin: dodo / commet; polar per its own pricing) |
| **Tax and VAT handling at checkout**<br>*aka: `tax_id_collection` / `automatic_tax` (BA: stripe)* | Collecting customer tax IDs and computing tax from location. Clerk documents no tax or VAT support at all. | ❌ | ❌ | ❌ | 🟡 (plugin: stripe config; MoR vendors handle it) |
| **Multi-currency pricing** | Charging in currencies other than USD. Clerk Billing is USD-only. | ❌ | ❌ | ❌ | 🟡 (provider-dependent, not plugin-managed) |
| **Unrestricted geographic and client availability** | Whether the billing product works everywhere and from any client. Clerk Billing is unavailable in Brazil, India, Malaysia, Mexico, Singapore and Thailand, has no 3D Secure support, and checkout is web-only — native apps can read billing data but cannot check out. | ❌ | ❌ | 🟡 (6 countries excluded; web-only checkout) | 🟡 (hosted checkout URL, provider limits apply) |

### 16.7 Better Auth payment plugins compared

Better Auth spreads this capability across seven plugins with very uneven coverage, so the choice of plugin decides which of the rows above are actually available. Only `@better-auth/stripe` is published by Better Auth; the other six carry an explicit "maintained by the vendor team" callout on their doc pages and are versioned and supported by those vendors, not by the framework.

| Capability | Stripe | Polar | Autumn | Dodo | Creem | Chargebee | Commet |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Maintainer | Better Auth (first-party) | Polar team | Autumn team | Dodo team | Creem team | Chargebee team | Commet team |
| Package | `@better-auth/stripe` | `@polar-sh/better-auth` | `autumn-js` | `@dodopayments/better-auth` | `@creem_io/better-auth` | `@chargebee/better-auth` | `@commet/better-auth` |
| Plans declared in app code | ✅ | ❌ (provider products) | ❌ (provider dashboard) | ❌ (provider products) | ❌ (provider products) | ✅ | ❌ (provider products) |
| Local subscription table | ✅ | ❌ | ❌ (by design) | ❌ | ✅ (optional) | ✅ | ❌ |
| Checkout session | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Plan upgrade / downgrade | ✅ | ❌ | 🟡 (re-attach) | ❌ | ❌ | ✅ | ❌ |
| Proration control | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Cancel subscription | ✅ (portal) | ❌ (portal only) | ✅ | ❌ (portal only) | ✅ | ✅ (portal) | ✅ (immediate option) |
| Restore pending cancellation | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Free trials | ✅ | ❌ | 🟡 (provider-side) | ❌ | 🟡 (provider-side) | ✅ | ❌ |
| Duplicate-trial prevention | ✅ (always on) | ❌ | ❌ | ❌ | ✅ (database mode) | 🟡 (opt-in flag) | ❌ |
| Per-seat billing | ✅ | ❌ | ❌ | ❌ | 🟡 (units at checkout) | ✅ | ✅ (seat types) |
| Organization as customer | ✅ | 🟡 (reference id only) | ✅ | ❌ | ❌ | ✅ | ❌ |
| Usage metering | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Feature entitlement check | 🟡 (plan limits) | 🟡 (benefits / state) | ✅ | ❌ | 🟡 (access check) | 🟡 (plan limits) | ✅ |
| Invoice or transaction history | ❌ | ✅ (orders) | ✅ (expansion) | ✅ (payments) | ✅ (transactions) | 🟡 (portal only) | 🟡 (invoice event) |
| Customer portal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Webhook verification | ✅ (signature) | ✅ (signature) | ➖ (no webhooks) | ✅ (signature) | ✅ (signature) | 🟡 (HTTP Basic) | ✅ (signature) |
| Typed per-event handlers | ✅ (5 hooks) | ✅ (25+) | ➖ | ❌ (catch-all only) | ✅ (12+) | ✅ (6 hooks) | ✅ (8) |
| Merchant of record | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |

Merchant-of-record status is stated in the plugin docs for Dodo Payments and Commet; Polar's is taken from Polar's own pricing rather than from the Better Auth documentation.

---

## 17. Data layer, deployment & environments

Better Auth stores identity data in **your** database and runs as part of **your** application, so the data store, its engine, its schema, its region and its uptime are all yours to choose and operate; Auth0, Okta and Clerk hold identity data in vendor infrastructure and expose only the knobs the vendor ships. Almost every row below follows from that one difference: engine, schema and migration rows are `➖` for the three hosted products because there is no customer-chosen store, while tenant, region, SLA and infrastructure-as-code rows are `➖` for Better Auth because there is no vendor-side tenant to configure. Where a hosted product does expose a real equivalent — Auth0's Private Cloud, Okta's regional cells, Clerk's proxying — it is marked rather than dismissed.

### 17.1 Where identity data lives

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Identity data in the application's own database**<br>*aka: Custom Database Connections (Auth0), Anything-as-a-Source / AD mastering (Okta)* | The user, session and credential records are stored in a database the customer operates and can query directly with SQL, rather than inside vendor infrastructure. | 🟡 (Custom Database Connections, scripted) | 🟡 (AD/LDAP mastering; Okta keeps copy) | ❌ | ✅ (Core, MIT) |
| **Vendor-hosted identity store**<br>*aka: Auth0 user store (Auth0), Universal Directory (Okta), Clerk user store (Clerk)* | The product operates the identity database itself; the customer reaches the records only through the vendor's APIs and console. | ✅ (all plans) | ✅ (all orgs) | ✅ (Hobby+) | ➖ |
| **PostgreSQL**<br>*aka: built-in Kysely adapter (BA)* | PostgreSQL as the primary identity store, including non-default schema selection via `schemaName` or `search_path`. | ➖ | ➖ | ➖ | ✅ (Core) |
| **MySQL / MariaDB**<br>*aka: built-in Kysely adapter (BA)* | MySQL as the primary identity store, with schema generation and migration; `CLIENT_FOUND_ROWS` affects `UPDATE` semantics. | ➖ | ➖ | ➖ | ✅ (Core) |
| **SQLite**<br>*aka: built-in Kysely adapter (BA)* | SQLite as the primary identity store via `better-sqlite3`, Node's `node:sqlite` `DatabaseSync`, or `bun:sqlite`. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Microsoft SQL Server**<br>*aka: built-in Kysely adapter, Tedious + Tarn (BA)* | MSSQL as the primary identity store, with schema generation and migration. | ➖ | ➖ | ➖ | ✅ (Core) |
| **MongoDB**<br>*aka: `mongodbAdapter()` (BA)* | Document store as the primary identity store; passing the `MongoClient` alongside the `Db` handle also enables transactions. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Arbitrary SQL dialect / hosted database services**<br>*aka: Kysely dialect passthrough (BA)* | Any Kysely dialect works with CLI generate and migrate — documented examples include Postgres.js, Supabase, PlanetScale, Cloudflare D1, AWS RDS Data API, Neon, Xata, libSQL, SurrealDB, TiDB Cloud, SingleStore, ClickHouse, BigQuery and PGLite. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Drizzle ORM adapter**<br>*aka: `drizzleAdapter()` (BA)* | Maps the auth models onto an existing Drizzle schema, with table/field renaming, plural table names, custom schema namespaces, Relations v2 and joins. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Prisma ORM adapter**<br>*aka: `prismaAdapter()` (BA)* | Uses a generated Prisma client as the data layer; the CLI emits the matching Prisma schema. | ➖ | ➖ | ➖ | ✅ (Core) |
| **In-memory store for development and tests**<br>*aka: `@better-auth/memory-adapter` (BA)* | A non-persistent data layer for local development and automated tests, with no database to provision. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Reactive backend-as-a-service store**<br>*aka: Convex integration (BA)* | Runs the auth data layer inside Convex, with Convex functions, React hooks, server helpers and SSR support. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Custom data-store adapter authoring**<br>*aka: `createAdapter()` (BA)* | Public factory for backing the auth models with any store, implementing `create`, `update`, `updateMany`, `delete`, `deleteMany`, `findOne`, `findMany`, `count`, `consumeOne`, `incrementOne` and an optional `createSchema`. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Atomic multi-write transactions**<br>*aka: adapter `transaction` support (BA)* | Multi-table writes run in a single database transaction when the adapter declares support; MongoDB requires a client handle. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Single-query joins for related records**<br>*aka: `advanced.database.joins` (BA)* | Opt-in join support across 50+ endpoints (since 1.4); off by default, in which case related rows are fetched with separate queries. | ➖ | ➖ | ➖ | ✅ (Core, opt-in) |
| **Read-replica-safe session reads**<br>*aka: `session.deferSessionRefresh` (BA)* | Makes session retrieval read-only and signals `needsRefresh`, so the refresh write can be issued separately against a primary rather than a replica. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Secondary key-value storage**<br>*aka: `secondaryStorage` (BA)* | Pluggable KV store for sessions, verification records and rate-limit counters, keeping high-churn data out of the primary database. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Maintained Redis secondary storage**<br>*aka: `@better-auth/redis-storage` (BA)* | First-party ioredis-backed implementation of the secondary-storage interface with a configurable key prefix. | ➖ | ➖ | ➖ | ✅ (Core companion package) |

### 17.2 Schema, migrations and identifiers

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Documented core table schema**<br>*aka: core models (BA)* | A published relational schema the customer owns — `user`, `session`, `account` and `verification` — that plugins extend with their own tables and columns. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Schema generation for the configured store**<br>*aka: `auth generate` (BA)* | Emits the schema in the adapter's own format — Prisma schema, Drizzle `schema.ts` or Kysely `schema.sql` — with Prisma and Drizzle generating without a live database connection. | ➖ | ➖ | ➖ | ✅ (Core CLI) |
| **Applying migrations to the database**<br>*aka: `auth migrate` (BA)* | Applies the required tables and columns directly to the database for the built-in Kysely adapter, prompting for what is missing. | ➖ | ➖ | ➖ | ✅ (Core CLI, Kysely only) |
| **Programmatic migrations from application code**<br>*aka: `getMigrations()` (BA)* | Runs migrations from inside the app — required for serverless stores such as Cloudflare D1 that the CLI cannot reach — returning `toBeCreated`, `toBeAdded` and `runMigrations`. | ➖ | ➖ | ➖ | ✅ (Core, Kysely only) |
| **Startup schema validation**<br>*aka: `advanced.database.validateSchema` (BA)* | Compares the live database against the configured models at initialization and reports missing tables, missing columns and unfilled required columns with their fixes. | ➖ | ➖ | ➖ | ✅ (Core, on by default) |
| **Custom table names**<br>*aka: `<model>.modelName` (BA)* | Renames the physical table backing a model while type inference keeps the canonical names. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Custom column names**<br>*aka: `<model>.fields` (BA)* | Maps each model field to a differently named database column, for fitting an existing schema or naming convention. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Extra columns on core models**<br>*aka: `user.additionalFields` / `session.additionalFields` (BA)* | Type-safe schema extension with per-field `type`, `required`, `defaultValue`, `input` and `returned`; the CLI generates the matching columns. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Custom primary-key generation**<br>*aka: `advanced.database.generateId` (BA)* | Replaces the default random base62 identifier with a caller-supplied generator, for matching an existing ID convention. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Database-generated identifiers**<br>*aka: `generateId: false` (BA)* | Hands identifier generation entirely to the database for every table. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Numeric auto-increment identifiers**<br>*aka: `generateId: "serial"` (BA)* | Generates schemas with an auto-incrementing integer `id`; values are still surfaced as strings through the API. | ➖ | ➖ | ➖ | ✅ (Core) |
| **UUID identifiers**<br>*aka: `generateId: "uuid"` (BA)* | Uses UUID columns for `id`, delegating generation to PostgreSQL where available and falling back to a string column elsewhere. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Mixed identifier strategies per model**<br>*aka: per-model `generateId(options)` (BA)* | Different ID types per table — e.g. serial integers for users and UUIDs for sessions — chiefly to match a schema being migrated in from another provider. | ➖ | ➖ | ➖ | ✅ (Core) |

### 17.3 Hosting model, regions and service levels

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Vendor-hosted multi-tenant service**<br>*aka: Public Cloud (Auth0), cell architecture (Okta), Clerk Cloud (Clerk)* | The authentication service runs as shared vendor infrastructure; the customer operates no servers for it. | ✅ (all plans) | ✅ (all orgs) | ✅ (Hobby+) | ➖ |
| **Dedicated single-tenant managed deployment**<br>*aka: Private Cloud (Auth0)* | An isolated instance of the vendor's stack on AWS or Azure, with customer-scheduled updates, geo-HA add-ons and guaranteed throughput. | ✅ (Enterprise Private Cloud) | ❌ | ❌ | ➖ |
| **Runs entirely in the customer's own infrastructure**<br>*aka: self-hosting (BA)* | The auth server is code the customer deploys and runs; no vendor service sits in the request path. | ❌ | ❌ | ❌ | ✅ (Core, MIT) |
| **Choice of hosting region / data residency**<br>*aka: locality and sub-locality (Auth0), cells (Okta)* | The customer chooses where identity data is physically stored and served from. Auth0 Public Cloud offers AU, CA, EU, EU-2, JP and US localities chosen at tenant creation and immutable thereafter; Auth0 Private Cloud spans 60+ regions; Okta runs cells in the US, EMEA, Japan, Australia, Canada and India; Clerk is US-hosted with no region selection. | ✅ (all plans, set at creation) | ✅ (per-org cell) | ❌ | ✅ (you pick host and region) |
| **Customer-triggered regional failover**<br>*aka: Enhanced Disaster Recovery (Okta), Geo-HA (Auth0)* | Failing an environment over to another region during a regional outage, and failing it back afterwards. | 🟡 (Geo-HA add-on, Private Cloud) | ✅ (EA) | ❌ | ✅ (your own DR design) |
| **Guaranteed throughput tier**<br>*aka: Rate Limit Configurations (Auth0)* | A contracted requests-per-second level at which the vendor commits to meet its SLAs — Auth0 Private Cloud sells 20 RPS development through 10000 RPS tiers. | ✅ (Private Cloud tiers) | 🟡 (rate-limit overrides/multipliers) | ❌ | ➖ |
| **Published request rate limits and entity caps**<br>*aka: Rate Limit Policy / Entity Limit Policy (Auth0), rate limit buckets (Okta)* | Documented per-plan ceilings on API requests and on configuration objects such as applications, connections and roles, distinct from pricing entitlements. | ✅ (per-plan matrices) | ✅ (per-endpoint buckets) | ✅ (per-plan limits) | ➖ |
| **Contractual uptime SLA**<br>*aka: Service Level Agreement (Auth0), 99.99% Uptime SLA (Clerk)* | A committed availability percentage with service credits when it is missed. Auth0 commits 99.99% monthly with 5/10/20% credits; Clerk offers 99.99% only on Enterprise. | ✅ (Enterprise) | ✅ (99.99% contractual) | 🟡 (Enterprise only) | ➖ |
| **Public status page and incident postmortems** | A component-level availability page for the hosted service, with published incident write-ups. | ✅ (all plans) | ✅ (all orgs) | ✅ (all plans) | ➖ |

### 17.4 Tenants, instances and environments

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Top-level configuration container**<br>*aka: Tenant (Auth0), Org (Okta), Application / Instance (Clerk)* | The isolation boundary holding users, applications, connections and configuration. Auth0 tenant names are globally unique, immutable and non-reusable; Okta orgs are hard boundaries with no cross-org object sharing. | ✅ (all plans) | ✅ (all orgs) | ✅ (Hobby+) | ➖ |
| **Account layer above individual tenants**<br>*aka: Auth0 Teams (Auth0), Okta Aerial (Okta), workspace (Clerk)* | A container above tenants for cross-tenant inventory, member management and billing, with its own API. | ✅ (Teams; default since Nov 2023) | 🟡 (Aerial; separate product) | ✅ (Hobby+) | ➖ |
| **Separate development and production environments**<br>*aka: environment tag (Auth0), Preview org / Production org (Okta), Development / Production instance (Clerk)* | First-class separation of pre-production from production configuration and data. Okta preview orgs receive releases early and allow Beta features; Clerk gives every application one development and one production instance. | ✅ (tenant per environment) | ✅ (preview + production orgs) | ✅ (Hobby+) | ✅ (separate deployment and database) |
| **Free non-production environment**<br>*aka: free tenant (Auth0), Integrator Free Plan / trial org (Okta), development instance (Clerk)* | A no-cost environment for building and testing against the real product. | ✅ (Free plan) | ✅ (Free) | ✅ (Hobby) | ✅ (local database or memory adapter) |
| **Relaxed-security development instance semantics**<br>*aka: `__clerk_db_jwt` dev browser (Clerk)* | Development environments behave differently from production by design — Clerk dev instances carry a 100-user cap, shared OAuth credentials, no search indexing, banners, an `accounts.dev` portal and query-string session transport instead of the production HttpOnly cookie. | 🟡 (environment tag affects rate limits) | 🟡 (preview orgs get Beta features) | ✅ (Hobby+) | ➖ |
| **Per-environment early-access feature opt-in**<br>*aka: Features page / Features API (Okta), beta_features endpoints (Clerk)* | Enabling Beta or Early Access capabilities in one environment without a support request, so they can be tested before production. | 🟡 (EA opt-in per tenant) | ✅ (self-service EA/Beta toggles) | 🟡 (beta_features endpoints) | ➖ |
| **Additional environments beyond dev and production**<br>*aka: multi-environment setup (Auth0), staging instances (Clerk)* | Staging, QA or per-team environments in addition to the default two. | ✅ (any number of tenants) | 🟡 (extra orgs need Multi-org SKU) | 🟡 (separate application; settings do not mirror) | ✅ (deploy another instance) |
| **Cloning configuration between environments**<br>*aka: create production instance (Clerk), Deploy CLI import/export (Auth0)* | Copying an environment's settings into another environment rather than re-entering them. Clerk clones development settings into a new production instance but does not carry over SSO connections, integrations or Paths. | ✅ (Deploy CLI) | 🟡 (Terraform or child-org inheritance) | ✅ (Hobby+; some settings excluded) | ➖ (configuration is code) |
| **Environment-scoped API keys**<br>*aka: `pk_test_`/`pk_live_`, `sk_test_`/`sk_live_` (Clerk)* | Key prefixes or key scoping that make it impossible to point production code at a test environment by accident. | 🟡 (per-tenant M2M credentials) | 🟡 (per-org API tokens) | ✅ (Hobby+) | ✅ (per-deployment secret and env vars) |
| **Programmatic creation of isolated tenants**<br>*aka: Org Creator API (Okta), child tenants (Auth0), Platform API applications (Clerk)* | Creating new isolated tenants or instances by API, for org-per-customer architectures. Distinct from B2B organizations inside one tenant. | 🟡 (Dashboard/Teams, not API) | 🟡 (Platform — Multi-org Deployment SKU) | 🟡 (Platform API) | ➖ |
| **User partitions inside one tenant**<br>*aka: Realms / Realm Assignments (Okta)* | Isolated sub-directories within a single tenant, with rules routing users into a partition by profile attribute or originating IdP, and delegated administration per partition. | ❌ | ✅ (Realms API) | ❌ | ❌ |

### 17.5 Domains, DNS and routing

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Custom domain for authentication endpoints**<br>*aka: Custom Domains / vanity URL (Auth0), Custom URL domain (Okta), Domains page / Frontend API CNAME (Clerk)* | Serving login pages and auth APIs from a domain the customer owns rather than a vendor subdomain; also a prerequisite for binding passkeys to the customer's relying-party ID. Okta does not support root domains and excludes Workflows sign-in. | 🟡 (paid plans) | ✅ (DNS TXT + CNAME verification) | 🟡 (Pro+, production only) | ✅ (inherent — it is your server) |
| **Vendor-managed TLS certificate**<br>*aka: Auth0-Managed Certificates (Auth0), Okta-managed certificate — Let's Encrypt (Okta)* | The vendor provisions and auto-renews the custom domain's certificate. | ✅ (paid plans) | ✅ (no extra cost) | ✅ (issued after DNS propagation) | ➖ |
| **Customer-terminated TLS / bring-your-own certificate**<br>*aka: Self-Managed Certificates (Auth0), BYO certificate (Okta)* | Terminating TLS at the customer's own CDN or proxy in front of the service, or uploading a certificate. Auth0 documents Akamai, CloudFront, Azure CDN, Cloudflare and Google Cloud; Okta accepts RSA 2048–4096 with SHA256–512. | ✅ (paid plans) | ✅ (BYO certificate) | 🟡 (via Frontend API proxying) | ✅ (inherent) |
| **Several custom domains on one tenant**<br>*aka: Multiple Custom Domains — MCD (Auth0), Multibrand customization / Brands (Okta), satellite domains (Clerk)* | More than one verified customer domain served by a single tenant, for multi-brand or multi-region front doors. Auth0 grants 20 domains per tenant with more via add-on; Okta defaults to three, expandable to 200 on request. | 🟡 (Enterprise; add-on beyond 20) | 🟡 (3 by default, 200 on request) | 🟡 (paid plan in production) | ✅ (dynamic `baseURL` allowed hosts) |
| **One session shared across genuinely different domains**<br>*aka: satellite domains (Clerk)* | A primary/satellite model letting one signed-in session span unrelated domains, rather than only subdomains of one root. Clerk exposes `isSatellite`, `domain`, `allowedRedirectOrigins` and `satelliteAutoSync`, supports Next.js, TanStack Start, Nuxt and non-SSR React, and advises against passkeys in this mode. | 🟡 (via the central login session) | 🟡 (via the org session at the custom domain) | ✅ (paid in production, free in development) | 🟡 (cross-domain requires your own design) |
| **Reverse-proxying the auth API under your own path**<br>*aka: Proxying the Clerk Frontend API (Clerk)* | Routing the vendor's frontend API through a path on the customer's domain (e.g. `/__clerk`) instead of a CNAME, forwarding `Clerk-Proxy-Url`, `Clerk-Secret-Key` and `X-Forwarded-For`, with framework helpers and a `POST /proxy_checks` validation endpoint. | 🟡 (CDN/proxy in front, self-managed certs) | ❌ | ✅ (production instances) | ➖ (the auth server is already yours) |
| **Ephemeral preview-deployment URLs**<br>*aka: preview deployments (Clerk), dynamic base URL (BA)* | Supporting per-branch preview hostnames that change on every deploy. Better Auth resolves the base URL per request from the `Host` header against an exact/wildcard/port-wildcard allowlist, adding matches to trusted origins automatically. | 🟡 (extra tenant or wildcard callback URLs) | 🟡 (extra preview org) | 🟡 (dev keys or an extra production instance) | ✅ (Core) |

### 17.6 Infrastructure as code and configuration management

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Official Terraform provider**<br>*aka: Auth0 Terraform Provider (Auth0), Okta Terraform Provider (Okta)* | A vendor-supported provider representing tenant configuration as declarative infrastructure-as-code with state tracking. Auth0's is also published to the OpenTofu Registry; Okta's authenticates with OAuth client credentials and an RSA key against an API service app. | ✅ (all plans, OSS) | ✅ (all orgs) | 🟡 (community providers only) | ➖ (configuration lives in your repo) |
| **Declarative configuration export and import**<br>*aka: Auth0 Deploy CLI (Auth0), `clerk config pull` / `clerk config patch` (Clerk)* | Exporting an environment's configuration to files that can be reviewed in version control and applied back. Auth0's Deploy CLI covers actions, branding, clients, client grants, connections, custom domains, email templates, grants, guardian, log streams, organizations, pages, prompts, resource servers, roles, tenant settings and themes. | ✅ (all plans, OSS) | 🟡 (Terraform only) | ✅ (Hobby+) | ➖ |
| **Per-environment value substitution in declarative config**<br>*aka: Keyword Replacement (Auth0)* | Templating that shares one configuration definition across environments by substituting environment-specific values at deploy time. | ✅ (Deploy CLI) | 🟡 (Terraform variables) | 🟡 (environment variables) | ✅ (environment variables) |
| **Guided deployment CLI**<br>*aka: Auth0 CLI (Auth0), `clerk deploy` (Clerk), `auth` CLI (BA)* | A command-line tool that drives setup and promotion. Clerk's `clerk deploy` is resumable, clones development to production, prints and polls DNS records, walks OAuth credential setup and verifies with `clerk deploy status`; Better Auth's CLI covers init, schema generation, migration, secret generation and diagnostics. | ✅ (OSS, all plans) | 🟡 (Okta CLI: app scaffolding only) | ✅ (Hobby+) | ✅ (Core, `@better-auth/cli`) |
| **Pre-production readiness checks**<br>*aka: Production Readiness Checks (Auth0)* | An automated audit of an environment's configuration before launch, classifying findings as critical, non-critical and best practice. | ✅ (all plans) | ❌ | 🟡 (`clerk deploy status` verification) | ❌ |

### 17.7 Runtime and platform support

These rows describe where the **auth server itself** executes. For the three hosted products the auth server is vendor infrastructure, so the question does not apply; their client and backend SDK matrices are a separate matter.

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Auth server runs inside the application process**<br>*aka: `auth.handler` (BA)* | The whole auth server is a single Web-standard `Request` → `Response` handler mounted in the application, so there is no separate service to deploy, scale or monitor. | ❌ | ❌ | ❌ | ✅ (Core) |
| **Node.js runtime**<br>*aka: `toNodeHandler()` (BA)* | The auth server runs on Node.js, bridging Node's `IncomingMessage`/`ServerResponse` to the Web-standard handler. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Bun runtime** | The auth server runs on Bun, including `bun:sqlite` as a data store. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Deno runtime** | The auth server runs on Deno via the Web-standard handler. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Edge / serverless workers**<br>*aka: Cloudflare Workers, D1, KV (BA)* | The auth server runs in a V8-isolate worker environment, with a D1 Kysely dialect, KV secondary storage and migrations run programmatically because the CLI cannot reach D1. A community `better-auth-cloudflare` package packages the toolkit. | ➖ | ➖ | ➖ | ✅ (Core primitives; community toolkit) |
| **Deferred background work after the response**<br>*aka: `advanced.backgroundTasks.handler` (BA)* | Pushes cleanup, analytics, timing-attack mitigation and rate-limit counter updates past the response using a platform primitive such as `waitUntil`, at the cost of eventual consistency. | ➖ | ➖ | ➖ | ✅ (Core) |

---

## 18. Observability — logs, audit trail & analytics

This is the area where the four products diverge most structurally. Auth0, Okta and Clerk each keep a vendor-side event log you can search in a console, and the commercial question is retention length and whether you may stream it out. Better Auth core keeps no vendor-side log at all — the framework logs to your own runtime and you own the store — while an audit trail, analytics and log drains exist only in the paid `@better-auth/infra` control plane, metered per audit event.

### 18.1 The event log

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Authentication & system event log**<br>*aka: Tenant Logs (Auth0), System Log (Okta), Application Logs (Clerk), Audit Logs (BA)* | A vendor-held, queryable record of authentication, user-lifecycle, session, policy and configuration events for the tenant. | ✅ (all plans) | ✅ (all orgs) | ✅ (Hobby+) | Commercial (@better-auth/infra) |
| **Event type catalog breadth**<br>*aka: Log Event Type Codes (Auth0), System Log event types (Okta), Event Catalog (Clerk), Tracked events (BA)* | How many distinct event types the log records and which areas of the product they span. | ✅ (all plans; large coded catalog) | ✅ (all orgs; hundreds of types) | ✅ (Hobby+; 16 categories, 150+ types) | Commercial (@better-auth/infra) |
| **Log retention window**<br>*aka: Log Data Retention (Auth0), 90-day System Log retention (Okta), log retention (Clerk)* | How long the vendor keeps log records before they become unqueryable; beyond it you must have exported. | 🟡 (1d Free / 5d Ess / 10d Pro / 30d Ent) | ✅ (all orgs; 90 days flat) | 🟡 (1d Hobby / 7d Pro / 30d Business / custom Ent) | Commercial (@better-auth/infra; 1d Starter / 7d Pro / custom Ent) |
| **Structured log search syntax**<br>*aka: Log Search Query Syntax v3 (Auth0), System Log filters and search (Okta)* | A query language over log fields, as opposed to fixed dropdown filters. | ✅ (all plans; Lucene subset) | ✅ (all orgs; SCIM-style filter + keyword) | 🟡 (Hobby+; faceted filters, wildcards) | Commercial (@better-auth/infra) |
| **Dimension filters on the log view**<br>*aka: Filter Log Events (Auth0), System Log filters (Okta)* | Filtering the log feed by event type, actor, subject, connection, device, IP and date range from the console. | ✅ (all plans; preset categories) | ✅ (all orgs) | ✅ (Hobby+; type, actor, subject, device, date) | Commercial (@better-auth/infra; eventType, userId, organizationId, identifier) |
| **Programmatic log retrieval API**<br>*aka: `GET /api/v2/logs` (Auth0), System Log API (Okta), `GET /events/list` (BA)* | Reading the event log over an API for your own pipeline, rather than only in the console. | ✅ (all plans; checkpoint pagination) | ✅ (all orgs; polling and bounded queries) | ❌ | Commercial (@better-auth/infra) |
| **Correlation identifiers on log records**<br>*aka: session/transaction/root-session ID (Okta), trace ID (Clerk)* | Identifiers that tie several log records to one request, session or transaction so a flow can be reconstructed. | 🟡 (all plans; `log_id`, correlation guidance for events) | ✅ (all orgs) | ✅ (Hobby+; distributed trace ID) | ❔ (unverified) |
| **Documented PII content of log records**<br>*aka: PII in Auth0 Logs (Auth0)* | A published statement of which log fields may contain personal data and which secrets are never logged. | ✅ (documentation) | ❔ (unverified) | ❔ (unverified) | ➖ (you own the log store) |
| **End-user self-service activity history**<br>*aka: Recent Activity / Sign-ins (Okta), `dash.getAuditLogs()` (BA)* | A view the signed-in user can open showing their own recent sign-ins and security events. | ❌ | ✅ (all orgs; admin-enabled, last 100 or 30 days) | ❌ | Commercial (@better-auth/infra) |
| **Transactional email delivery log**<br>*aka: Email Logs (Clerk)* | A searchable record of outbound auth emails with recipient, message ID and delivery status. | ❌ | ❌ | 🟡 (Beta) | Commercial (@better-auth/infra; managed email) |
| **Live logs for customer extension code**<br>*aka: Actions Real-time Logs (Auth0)* | A streaming console view of `console.log` output and exceptions from customer-written code running inside the auth pipeline. | ✅ (all plans) | ❌ | ❌ | ➖ (your own runtime logs) |

### 18.2 Log export & streaming destinations

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Log streaming to an external destination**<br>*aka: Log Streams (Auth0), Log Streaming (Okta), log sinks (Clerk), log drains (BA)* | Continuous near-real-time push of the event log to a SIEM or observability platform for alerting and long-term retention. | ✅ (Essentials+) | ✅ (all orgs) | 🟡 (Enterprise only) | Commercial (@better-auth/infra; Pro add-on $25/mo) |
| **Number of concurrent streams permitted** | How many stream integrations a tenant may run at once — a hard ceiling on fan-out to multiple SIEMs. | 🟡 (0 Free / 1 Ess / 2 Pro / 2 Ent) | 🟡 (2 per org) | ❔ (unverified) | ❔ (unverified) |
| **Datadog destination** | A prebuilt stream target delivering log events into Datadog. | ✅ (Essentials+) | ❌ | 🟡 (Enterprise; generic sink, not a named integration) | 🟡 (infra: generic log drain) |
| **Splunk destination**<br>*aka: Splunk Cloud log stream (Okta)* | A prebuilt stream target delivering log events into Splunk, typically via an HTTP Event Collector token. | ✅ (Essentials+) | ✅ (all orgs; Splunk Cloud, HEC token) | 🟡 (Enterprise; generic sink) | 🟡 (infra: generic log drain) |
| **AWS EventBridge destination**<br>*aka: Amazon EventBridge (Auth0/Okta)* | A prebuilt stream target publishing log events onto an AWS event bus. | ✅ (Essentials+) | ✅ (all orgs; event source + account ID + region) | ❌ | ❌ |
| **Azure Event Grid destination** | A prebuilt stream target publishing log events into Azure Event Grid. | ✅ (Essentials+) | ❌ | ❌ | ❌ |
| **Sumo Logic destination** | A prebuilt stream target delivering log events into Sumo Logic. | ✅ (Essentials+) | ❌ | ❌ | ❌ |
| **Segment destination** | A prebuilt stream target forwarding auth events into a customer data platform for downstream analytics. | ✅ (Essentials+) | ❌ | ❌ | ❌ |
| **Mixpanel destination** | A prebuilt stream target forwarding auth events into a product-analytics tool. | ✅ (Essentials+) | ❌ | ❌ | ❌ |
| **Elastic destination** | A prebuilt stream target delivering log events into Elastic. | ✅ (Essentials+) | ❌ | ❌ | ❌ |
| **Other partner SIEM destinations**<br>*aka: Integrated Log Streaming Services (Auth0)* | Additional vendor-maintained stream targets — Logz.io, Panther, Pangea, Oort, Oodle AI, MDR ONE, Perch Security. | ✅ (Essentials+; Marketplace) | ❌ (Okta builds all integrations; no partner submissions) | ❌ | ❌ |
| **Generic HTTP webhook log stream**<br>*aka: Custom Log Streams Using Webhooks (Auth0)* | Delivery of log events as HTTP POSTs to any customer-supplied URL, for destinations with no prebuilt integration. | ✅ (Essentials+; bearer token, JSON lines/array/object) | ❌ | 🟡 (Enterprise) | Commercial (@better-auth/infra) |
| **Per-stream event filtering**<br>*aka: Log Stream Filters (Auth0)* | Selecting which event categories a given stream delivers, so a downstream system is not billed for noise. | ✅ (all plans) | ❌ (explicitly unfiltered) | ❔ (unverified) | ❔ (unverified) |
| **Stream health, retry and backfill**<br>*aka: Check Log Stream Health (Auth0)* | Per-stream delivery status, recent error detail, pause/resume, and re-delivery of events queued while paused. | ✅ (all plans; last 10 errors, 5 days) | ❌ (no replay of past windows) | ❔ (unverified) | 🟡 (infra: test-delivery endpoint only) |
| **Prebuilt SIEM dashboard templates**<br>*aka: Datadog / Splunk / Sumo Logic Dashboard templates (Auth0)* | Vendor-published dashboards for visualising the streamed log data in the destination tool. | ✅ (all plans) | ❌ | ❌ | ❌ |

### 18.3 Administrative audit trail

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Audit trail of administrative actions**<br>*aka: `sapi` / `mgmt_api_read` events (Auth0), System Log admin events (Okta), Admin Logs (Clerk)* | A record of who changed tenant configuration, roles, secrets and settings, distinct from end-user authentication events. | ✅ (all plans; in tenant logs) | ✅ (all orgs; in System Log) | 🟡 (Business and Enterprise only) | Commercial (@better-auth/infra) |
| **Separate console-vs-application log split** | Administrative/workspace actions kept in their own log rather than mixed into the application event feed. | ❌ (single tenant log) | ❌ (single System Log) | ✅ (Business+; Admin Logs vs Application Logs) | ❌ (single audit log) |
| **Admin privilege assignment report**<br>*aka: Admin Role Assignments report (Okta)* | A point-in-time listing of every administrative role assignment, filterable by principal, role and resource scope. | ❌ | ✅ (all orgs) | ❌ | ❌ |
| **Impersonation and support-access auditing**<br>*aka: Support Access (Auth0), user impersonation logs (Clerk), `user_impersonated` (BA)* | Recording when an operator or vendor support staff acts as a user, including start and stop of the impersonated session. | 🟡 (all plans; Support Access is read-only) | ✅ (all orgs) | ✅ (Hobby+; 5/mo free, unlimited on Administration Enhanced) | Commercial (@better-auth/infra) |
| **Org-scoped audit query gated by tenant role**<br>*aka: `getAllAuditLogs()` (BA)* | Letting a customer's own tenant administrators read the audit events for the organizations they administer, without vendor-console access. | 🟡 (all plans; build on Management API + `organization_id` filter) | ❌ | ❌ | Commercial (@better-auth/infra; requires organization plugin) |
| **Tamper-evident or immutable audit store** | Cryptographic hash-chaining, WORM storage or a signed export proving log records were not altered. No vendor here documents one; all four logs are read-only through the API but carry no integrity proof. | ❌ | ❌ | ❌ | ❌ |

### 18.4 Analytics, reports & usage visibility

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Sign-in and sign-up analytics dashboard**<br>*aka: Activity Page (Auth0), Administrator Dashboard / Okta Usage report (Okta), Analytics (Clerk), Dashboard Analytics (BA)* | A console view charting signups, logins, active users and failed logins over a selectable period. | ✅ (all plans; admin role required, up to 24h lag) | ✅ (all orgs) | ✅ (Hobby+; excludes dev instances, impersonation, M2M) | Commercial (@better-auth/infra) |
| **Retention cohort analysis**<br>*aka: user retention (Auth0), cohort retention (Clerk), `/dash/retention` (BA)* | Reporting on what share of a signup cohort returns over subsequent periods. | ✅ (all plans) | ❌ | ✅ (Hobby+) | Commercial (@better-auth/infra) |
| **Geographic distribution reporting**<br>*aka: `/dash/map` (BA), Metric Streams geo data (Auth0)* | Breaking authentication or user counts down by country or region. | 🟡 (Enterprise; Metric Streams Beta) | 🟡 (all orgs; Proxy IP report only) | ❔ (unverified) | Commercial (@better-auth/infra) |
| **Analytics query API**<br>*aka: Stats API (Auth0), `/dash/stats` `/dash/graph` (BA)* | Programmatic access to the aggregate numbers behind the analytics console. | ✅ (all plans; `/api/v2/stats/daily`, `/active-users`) | 🟡 (all orgs; report exports, no analytics API) | ❌ | Commercial (@better-auth/infra) |
| **Active-user reporting for billing visibility**<br>*aka: MAU (Auth0), Okta Usage report (Okta), MRU usage (Clerk)* | Seeing the metered user count that drives the invoice before the invoice arrives. | ✅ (all plans; MAU-metered) | ✅ (all orgs; per-user licensing) | ✅ (Hobby+; MRU and MRO per app) | ➖ (no per-user metering; infra meters audit events) |
| **Per-application sign-in usage report**<br>*aka: Application Usage report (Okta)* | Sign-in volume broken down per registered application or client. | 🟡 (all plans; log search by `client_id`) | ✅ (all orgs; by date, app, user, group) | ❔ (unverified) | ❌ |
| **MFA enrolment and usage report**<br>*aka: MFA Usage report / MFA Activity report (Okta)* | A roster of which users have enrolled which authenticators, derived from real sign-in activity. | 🟡 (all plans; from log search) | ✅ (all orgs) | ❌ | ❌ |
| **Password health report**<br>*aka: Okta Password Health report / App Password Health report (Okta)* | Current status of every stored password in the tenant, for hygiene and expiry planning. | ❌ | ✅ (all orgs) | ❌ | ❌ |
| **Telephony usage report**<br>*aka: Telephony Usage report (Okta)* | SMS and voice message volume over time, used to diagnose delivery problems and forecast cost. | 🟡 (all plans; phone-message log events) | ✅ (all orgs; filterable SMS vs voice) | 🟡 (Hobby+; metered SMS usage) | Commercial (@better-auth/infra; managed SMS) |
| **Deprovisioning report**<br>*aka: Deprovision Details report (Okta)* | Which applications a user was deprovisioned from over a period and what triggered each deprovision. | ❌ | ✅ (all orgs) | ❌ | ❌ |
| **Hardware authenticator inventory report**<br>*aka: YubiKey report (Okta)* | Serial numbers, enrolment dates and last-used timestamps for issued hardware tokens. | ❌ | ✅ (all orgs) | ❌ | ❌ |
| **Scheduled or emailed report delivery**<br>*aka: Receive reports by email (Okta)* | Reports delivered to an administrator's inbox rather than only rendered on demand in the console. | ❌ | ✅ (all orgs; 7 report types) | ❌ | ❌ |
| **Bulk report export to file** | Downloading a report or log selection as CSV for offline analysis or evidence. | 🟡 (all plans; via Management API) | ✅ (all orgs; CSV, ISPM up to 200k rows) | 🟡 (Hobby+; full data export, not log export) | ❔ (unverified) |

### 18.5 Service health, alerting & instrumentation

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Built-in alerting on identity events** | Vendor-side notification when a chosen security or operational event occurs, without you building a consumer. | 🟡 (all plans; via log streams or an Action) | ✅ (all orgs; admin notifications, task inbox, threshold alerts) | 🟡 (Hobby+; via webhooks) | 🟡 (infra: via log drain) |
| **Rate-limit consumption monitoring**<br>*aka: `limit_wc` / `api_limit` log events (Auth0), Rate Limits report (Okta)* | Visibility into how much of the API rate-limit budget is consumed, with a configurable warning threshold. | 🟡 (all plans; log events only) | ✅ (all orgs; per-bucket charts, warning threshold, alerts) | ❔ (unverified) | ➖ (rate limits are yours to observe) |
| **Connector and agent health monitoring**<br>*aka: AD/LDAP Connector Health Monitor (Auth0), agent and service health widget (Okta)* | Health status of on-premises connectors and directory agents the tenant depends on. | 🟡 (legacy extension) | ✅ (all orgs; admin dashboard widget) | ➖ | ➖ |
| **Public status page**<br>*aka: status.auth0.com (Auth0), status.okta.com / trust.okta.com (Okta), status.clerk.com (Clerk)* | A component-level public page reporting current service availability and open incidents. | ✅ (all plans; per-region, Atom/RSS) | ✅ (all orgs) | ✅ (all plans) | ➖ (self-hosted; no vendor status page) |
| **Historical uptime and incident postmortems** | Published incident history and written postmortems, as opposed to only a live status indicator. | ✅ (all plans) | ✅ (all orgs; averaged over incidents affecting ≥10% of customers) | ✅ (all plans; full postmortems published) | ➖ |
| **Contractual uptime SLA** | A committed availability figure backed by contract, rather than a best-effort target. | 🟡 (Enterprise only; 99.99%) | ✅ (Enterprise base platform) | 🟡 (Enterprise only; 99.99%) | ❌ (no SLA published, including for the paid infra tier) |
| **Operational metric streaming**<br>*aka: Metric Streams (Auth0)* | Export of operational metrics — request volume, error rate, rate-limit events, grant-type mix — separate from event logs. | 🟡 (Enterprise; Beta, Datadog native or OTLP) | ❌ | ❌ | ➖ (your own APM) |
| **OpenTelemetry tracing of the auth runtime**<br>*aka: `experimental.instrumentation` (BA)* | OTel spans emitted by the auth layer itself for endpoints, hooks and database calls, consumable by any APM. | 🟡 (Enterprise; OTLP metrics only, no traces) | ❌ | ❌ | ✅ (Core OSS; experimental, on by default) |
| **Configurable log level and custom log sink**<br>*aka: `logger` option (BA)* | Setting the auth layer's own log verbosity and routing its output into your logging stack. | ➖ (vendor-hosted runtime) | ➖ (vendor-hosted runtime) | ➖ (vendor-hosted runtime) | ✅ (Core OSS; debug/info/warn/error) |
| **Anonymous product telemetry sent to the vendor**<br>*aka: `telemetry.enabled` (BA), Clerk Telemetry (Clerk)* | Usage data the SDK reports back to the vendor, and whether it is opt-in or opt-out. | ➖ | ➖ | ✅ (all plans; opt-out) | ✅ (Core OSS; opt-in, off by default) |

---

## 19. Compliance, privacy & certifications

For Auth0, Okta and Clerk the vendor holds the certification and passes it to you as a processor, so a SOC 2 report, a DPA or a sub-processor list is an artifact you receive; for Better Auth no vendor holds the user data at all, so those artifacts do not transfer and compliance becomes an attribute of infrastructure you already control and must now certify yourself — an advantage for control and a cost for the team that has to earn it. Rows where that shift applies are marked `➖` with a qualifier naming the shift rather than `❌`, except where an artifact genuinely does not exist. The paid `@better-auth/infra` service *is* a vendor-hosted third-party processor that receives auth events, so sub-processor, residency and breach-notification rows are scored against it specifically.

### 19.1 Certifications, attestations & audit reports

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **SOC 2 Type II**<br>*aka: SOC 2 (Auth0), SOC 2 Type II report (Clerk)* | Independent audit report over a period of time against the AICPA Trust Services Criteria, the baseline artifact most security reviews request. | ✅ (all plans; via Support Center) | ✅ (all orgs; trust portal) | 🟡 (Business $300/mo+, on request) | ➖ (shifts to your own infra) |
| **SOC 1 and SOC 3 reports** | The financial-controls report (SOC 1 / ISAE 3402) and the public summary report (SOC 3) that accompany a SOC 2 programme. | ❔ (unverified) | ✅ (SOC 1, SOC 2, SOC 3) | ❌ | ➖ (shifts to your own infra) |
| **ISO/IEC 27001 certification** | Certification of an information security management system by an accredited body, with a Statement of Applicability. | ✅ (all plans; cert on request) | ✅ (ISO 27001:2022) | ❌ | ➖ (shifts to your own infra) |
| **ISO/IEC 27017 certification** | Cloud-services extension to ISO 27001 covering controls specific to running as, or on, a cloud provider. | ✅ (all plans; cert on request) | ✅ (ISO 27017:2015) | ❌ | ➖ (shifts to your own infra) |
| **ISO/IEC 27018 certification** | Code of practice for protecting personally identifiable information processed in public clouds. | ✅ (all plans; cert on request) | ✅ (ISO 27018:2019) | ❌ | ➖ (shifts to your own infra) |
| **ISO/IEC 27701 certification** | Privacy information management extension to ISO 27001, mapping controls onto GDPR controller/processor roles. | ❌ | ❌ | ❌ | ➖ (shifts to your own infra) |
| **PCI DSS attestation** | Attestation of Compliance and self-assessment questionnaire for handling cardholder-data environments. | ✅ (specific deployment models; AoC/SAQ-D) | ✅ (PCI DSS v4.0) | ❌ | ➖ (shifts to your own infra) |
| **HIPAA support and Business Associate Agreement**<br>*aka: HIPAA and HITECH (Auth0), HIPAA compliance with a BAA (Clerk)* | The vendor signs a BAA and acts as a Business Associate so a Covered Entity may place electronic protected health information in the service. | ✅ (BAA for qualifying customers) | ✅ (HIPAA; BAA available) | 🟡 (Enterprise plan only) | ➖ (you sign your own BAA) |
| **FedRAMP authorization**<br>*aka: Okta for Government / Okta for Government High (Okta)* | US federal cloud authorization at a named impact level, granted to a specifically authorized government environment rather than to the commercial product. | ❌ | ✅ (Okta for Government; Moderate and High) | ❌ | ➖ (your platform's authorization) |
| **US Department of Defense impact level** | DoD Cloud Computing SRG impact-level authorization above FedRAMP, required for defense workloads. | ❌ | ✅ (DoD IL5, government environment) | ❌ | ➖ (your platform's authorization) |
| **State and local government programme**<br>*aka: StateRAMP / GovRAMP* | The state-and-local analogue of FedRAMP, used in US public-sector procurement. | ❌ | ✅ (GovRAMP listed) | ❌ | ➖ (your platform's authorization) |
| **CSA STAR registration** | Cloud Security Alliance STAR self-assessment (Level 1) and third-party certification (Level 2), with the CAIQ published in the STAR Registry. | ✅ (all plans; CAIQ in STAR Registry) | ✅ (Level 1 and 2; Trusted Cloud Provider) | ❌ | ➖ (shifts to your own infra) |
| **National and sector assurance schemes**<br>*aka: IRAP, C5, ENS, TISAX, DORA, EU Cloud CoC (Okta)* | Country- or industry-specific assurance schemes required by Australian government, German BSI, Spanish public sector and the automotive industry. | ❌ | ✅ (IRAP, C5, ENS, TISAX) | ❌ | ➖ (shifts to your own infra) |
| **Independent penetration test report** | A third-party offensive-security assessment whose report or summary the vendor will share, usually under NDA. | ❔ (unverified) | ✅ (report in trust portal) | 🟡 (tests run; report on request) | ❌ (no vendor to test) |
| **Trust portal / compliance document access**<br>*aka: Support Center Compliance section (Auth0), security.okta.com (Okta), trust.clerk.com (Clerk)* | A self-serve portal from which a buyer downloads or requests certificates, reports and policies, typically gated by NDA for the sensitive ones. | ✅ (all plans; role-gated) | ✅ (all orgs; NDA-gated docs) | ✅ (all plans) | ❌ (no trust portal exists) |
| **Pre-completed security questionnaires**<br>*aka: CAIQ, HECVAT, MVSP (Okta), custom security questionnaires (Clerk)* | Standard vendor-assessment questionnaires answered in advance so a buyer's review does not start from a blank form. | ✅ (CAIQ via CSA STAR) | ✅ (CAIQ, HECVAT, MVSP) | 🟡 (Enterprise plan only) | ❌ (no vendor to assess) |

### 19.2 Protocol conformance certification

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **OpenID Connect OP certification** | Formal OpenID Foundation conformance certification of the provider implementation against named profiles (Basic, Implicit, Hybrid, Config, Form Post). | ✅ (certified OP) | ✅ (five OP profiles certified) | ❔ (unverified) | ❌ |
| **FAPI certification** | OpenID Foundation certification against the Financial-grade API security profiles used by open banking and other regulated APIs. | 🟡 (certified; flows need HRI add-on) | ❔ (unverified) | ❌ | ❌ |
| **PSD2 Strong Customer Authentication**<br>*aka: Payment Services Directive 2, Dynamic Linking (Auth0)* | Building blocks for a PSD2-compliant payment journey, including SCA and dynamic linking that binds a transaction's details into the user's approval. | 🟡 (Enterprise + HRI add-on) | ❔ (unverified) | ❌ | ❌ |

### 19.3 Privacy regulation, contracts & commitments

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **GDPR processor documentation** | Published description of the vendor's controller/processor model and of which product features map onto a customer's GDPR obligations. | ✅ (all plans; dedicated guides) | ✅ (GDPR privacy whitepaper) | ✅ (all plans) | ➖ (you are the controller) |
| **Data Processing Agreement**<br>*aka: DPA, Data Processing Addendum* | The contract under which the vendor processes personal data on the customer's instructions; the artifact a legal review asks for first. | ✅ (all plans) | ✅ (all orgs) | ✅ (all plans, public DPA) | 🟡 (only @better-auth/infra; custom on Enterprise) |
| **Standard Contractual Clauses** | EU Commission SCC modules (and the UK Addendum) incorporated into the DPA to legitimize transfers outside the EEA. | ✅ (in the DPA) | ✅ (in the DPA) | ✅ (Modules 1–3 + UK Addendum) | 🟡 (only @better-auth/infra contracts) |
| **EU-US Data Privacy Framework self-certification**<br>*aka: DPF, EU-US DPF + UK Extension + Swiss-US DPF* | Self-certification to the DPF programme as an alternative transfer mechanism for EU, UK and Swiss personal data sent to the US. | ❔ (unverified) | ✅ (EU-US, UK ext., Swiss-US) | ✅ (self-certified Feb 2024) | ❌ (no self-certification) |
| **Published sub-processor list** | A public, current list of the third parties the vendor uses to process customer personal data. | ✅ (Okta, Inc. legal pages) | ✅ (Legal section of trust portal) | ✅ (trust portal) | ❌ (@better-auth/infra publishes none) |
| **Sub-processor change notification** | A contractual commitment to give advance notice before adding a sub-processor, with a customer objection window. | ✅ (in the DPA) | ✅ (in the DPA) | ✅ (15 days' notice, 10-day objection) | ❌ (no published commitment) |
| **Personal data breach notification commitment** | Contractual undertaking to notify the customer of a security incident affecting their personal data, within a stated timeframe. | ✅ (in the DPA) | ✅ (in the DPA) | ✅ (without undue delay) | ➖ (your own obligation to users) |
| **CCPA / CPRA privacy notice** | A California-specific supplementary privacy notice covering consumer rights and service-provider status. | ✅ (Okta, Inc. notice) | ✅ (Okta, Inc. notice) | ✅ (public CCPA notice) | ➖ (your own notice) |
| **Controller/processor split documented**<br>*aka: Data Processing disclosure (Auth0), shared responsibility* | A written statement of what the vendor stores and secures versus what the customer must configure, secure and account for in its record of processing. | ✅ (data-processing documentation) | ✅ (privacy whitepaper + DPA) | ✅ (security page + DPA) | ➖ (you are both roles) |
| **Controller status for exported event data**<br>*aka: Event stream / log stream controller notice (Auth0)* | Explicit statement that turning on an outbound event or log stream makes the customer the controller of the exported copy and owner of any cross-region transfer it causes. | ✅ (all plans; documented) | ❔ (unverified) | ❔ (unverified) | ➖ (all data already yours) |

### 19.4 Data residency & regional storage commitments

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Regional data residency commitment**<br>*aka: Region, locality and sub-locality (Auth0), cells (Okta)* | A contractual and technical commitment that a tenant's user data is stored in a customer-chosen geography, fixed at tenant creation. | ✅ (all plans; chosen at tenant creation) | ✅ (cell chosen per org) | ❌ | ➖ (your DB; @better-auth/infra undocumented) |
| **United States residency** | User data stored in US data centres. | ✅ (US, US-3, US-4, US-5) | ✅ (US cells) | ✅ (US-only; GCP and Cloudflare) | ➖ (your choice of region) |
| **European Union residency** | User data stored in EU data centres, the usual answer to a GDPR data-localization requirement. | ✅ (EU, EU-2 localities) | ✅ (Dublin, Frankfurt cells) | ❌ | ➖ (your choice of region) |
| **Canada residency** | User data stored in Canadian data centres. | ✅ (CA locality) | ✅ (Canada cell) | ❌ | ➖ (your choice of region) |
| **Australia residency** | User data stored in Australian data centres, including the disaster-recovery copy. | ✅ (AU locality) | ✅ (Sydney cell; DR in Melbourne) | ❌ | ➖ (your choice of region) |
| **Japan residency** | User data stored in Japanese data centres. | ✅ (JP locality) | ✅ (Japan cell) | ❌ | ➖ (your choice of region) |
| **India residency** | User data stored in Indian data centres. | ❌ | ✅ (India cell) | ❌ | ➖ (your choice of region) |
| **Dedicated or isolated deployment for residency**<br>*aka: Private Cloud (Auth0), Okta for Government (Okta)* | A single-tenant managed deployment for buyers who cannot accept a shared multi-tenant environment or need a guaranteed location. | ✅ (Enterprise Private Cloud, AWS/Azure) | 🟡 (government environments only) | ❌ | ➖ (you run the deployment) |
| **Outbound message delivery under your control**<br>*aka: SMTP Email Providers (Auth0), Custom email provider (Okta), email.created webhook (Clerk)* | Routing authentication emails and SMS through a provider you choose, so message content never leaves a region or vendor you have not approved. | ✅ (all plans; SES, SendGrid, SMTP, etc.) | ✅ (basic SMTP GA; OAuth EA) | 🟡 (via email.created webhook) | ✅ (Core; you supply the sender) |

### 19.5 Data subject rights, consent & retention

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Right of access to a data subject's record**<br>*aka: GDPR: Right to Access, Correct and Erase Data (Auth0)* | Retrieving everything held about one identified user so a subject access request can be answered. | ✅ (all plans; Management API) | ✅ (Users API) | ✅ (Backend API) | ✅ (Core; direct database access) |
| **Right to erasure**<br>*aka: deleteUser (Clerk, BA), Delete user (Auth0, Okta)* | Hard deletion of a user record and its associated identities, sessions and credentials. | ✅ (all plans; Management API) | ✅ (deactivate then delete) | ✅ (Dashboard or Backend API) | 🟡 (opt-in `deleteUser`, off by default) |
| **End-user self-service account deletion**<br>*aka: My Account API (Auth0), delete_self_enabled (Clerk)* | Letting the account holder delete their own account from the application, without a support ticket. | 🟡 (My Account API; build the UI) | ❌ | ✅ (per-user flag; prebuilt component) | ✅ (Core; with verification email) |
| **Data portability export**<br>*aka: GDPR: Data Portability (Auth0), Full data export (Clerk)* | Bulk export of user records in a machine-readable format so a data subject, or the customer, can move them elsewhere. | ✅ (export job; hashes excluded) | ✅ (Users API and reports) | ✅ (all plans incl. Hobby) | ✅ (Core; it is your database) |
| **Data minimization / attribute deny-list**<br>*aka: DenyList, `non_persistent_attrs` (Auth0)* | Naming attributes the platform receives from an upstream provider but must not persist, so sensitive fields never enter the user store. | ✅ (all plans; per connection) | 🟡 (omit from profile mappings) | 🟡 (request fewer OAuth scopes) | ✅ (Core; you define the schema) |
| **Terms-of-service and privacy-policy acceptance capture**<br>*aka: Legal compliance (Clerk), Update Policy Form (Auth0)* | Requiring explicit acceptance of legal documents at sign-up and recording that the user gave it. | 🟡 (Forms; plan-limited Form count) | 🟡 (custom profile enrollment attribute) | ✅ (Dashboard setting) | 🟡 (custom `additionalFields`) |
| **Consent versioning and re-acceptance**<br>*aka: GDPR: Conditions for Consent (Auth0)* | Storing which version of a policy the user accepted and re-prompting when that document changes. | 🟡 (Forms + `app_metadata` version) | 🟡 (custom attribute + policy rule) | 🟡 (timestamp only; no version) | 🟡 (custom field + hook) |
| **Marketing and communication consent record** | A durable, queryable record of opt-in to marketing or non-transactional messaging, separate from legal-document acceptance. | 🟡 (`app_metadata` field) | 🟡 (custom profile attribute) | 🟡 (public/private user metadata) | 🟡 (custom `additionalFields`) |
| **Data-subject-request assistance commitment** | Contractual undertaking that the vendor will help the customer answer access, correction and erasure requests it cannot serve alone. | ✅ (in the DPA) | ✅ (in the DPA) | ✅ (self-service plus assistance) | ➖ (no vendor to ask) |
| **Deletion or return of data on termination**<br>*aka: Data Export and Transfer Policy (Auth0)* | Committed handling of customer data when the contract ends — return on request, then deletion within a stated window. | ✅ (export any time; tenant delete) | ✅ (in the DPA) | ✅ (return, then delete within 90 days) | ➖ (your own retention policy) |

---

## 20. Developer experience — SDKs, tooling & testing

This section covers what it is like to build against each product: SDK breadth, the shape of the server-side API surface, type safety, API reference formats, CLI tooling, local development, automated testing, documentation, versioning and support. The structural split is that Auth0, Okta and Clerk are hosted services whose server half lives outside your repository, while Better Auth is a library you import — so schema generation, offline development and server-to-client type inference exist only on one side, and hosted dashboards, SLAs and dated API versions only on the other.

### 20.1 SDK and platform coverage

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Backend SDKs by language**<br>*aka: Backend/API quickstart libraries (Auth0), Management SDKs and JWT verifiers (Okta), Backend SDK matrix (Clerk)* | Official server-side libraries for validating tokens and talking to the identity service. Auth0: Node, .NET, Java, PHP, Python, Go, Ruby. Okta: .NET, Java, Node, Python, Go (the PHP SDK is archived). Clerk: Express, Fastify, Go, Rails, Python, PHP, Java, C#/.NET. Better Auth is a TypeScript library, so other languages must call its HTTP endpoints directly. | ✅ (all plans) | ✅ (all plans) | ✅ (Hobby+) | 🟡 (TypeScript/JavaScript only) |
| **Management API client SDKs**<br>*aka: Management API v2 SDKs (Auth0), Management SDKs (Okta), `clerkClient` / `@clerk/backend` (Clerk), `auth.api.*` (BA)* | Typed clients for administrative operations over users, applications, connections and configuration. Auth0 and Okta ship these as packages separate from their login SDKs; Clerk folds them into one backend package; Better Auth exposes the same operations as in-process function calls with no network hop. | ✅ (6 languages) | ✅ (5 languages) | ✅ (Hobby+) | ✅ (Core, in-process) |
| **Browser / SPA JavaScript SDKs**<br>*aka: auth0-spa-js + framework wrappers (Auth0), Auth JS + framework SDKs (Okta), `@clerk/clerk-js` (Clerk), `createAuthClient()` (BA)* | Client-side libraries for running the sign-in flow and holding session state in a browser app. Auth0: vanilla JS, React, Vue, Angular. Okta: Auth JS, React, Angular, Vue, Blazor WebAssembly. Clerk: JavaScript, React, Vue. Better Auth: React, Vue, Svelte, Solid, vanilla, plus a Lynx build, all over one shared core. | ✅ (all plans) | ✅ (all plans) | ✅ (Hobby+) | ✅ (Core) |
| **Full-stack / SSR meta-framework integrations**<br>*aka: framework SDKs (Auth0), frontend SDK matrix (Clerk), integrations (BA)* | First-party support for server-rendered JavaScript frameworks, including handler mounting, server-side session access and route protection. Auth0: Next.js, Nuxt, TanStack Start (Beta). Clerk: Next.js, TanStack React Start, React Router, Astro, Nuxt. Better Auth: Next.js, React Router v7 (plus legacy Remix), TanStack Start, SvelteKit, SolidStart, Nuxt, Astro, Waku. Okta publishes none and directs users to generic OIDC libraries. | 🟡 (Next.js/Nuxt GA; TanStack Beta) | 🟡 (generic OIDC recipes only) | ✅ (Hobby+) | ✅ (Core) |
| **Server framework integrations (Node and edge)** | Documented mounting patterns and middleware for API frameworks. Auth0: Express, Fastify, Hono. Clerk: Express and Fastify official, Hono/Koa/Elysia community. Better Auth: Express, Fastify, Hono, Elysia, NestJS, Nitro, Encore, Convex, plus a Web-standard handler that runs on Node, Bun, Deno and Cloudflare Workers. Okta relies on passport and similar generic middleware. | ✅ (all plans) | 🟡 (generic middleware recipes) | ✅ (Hobby+) | ✅ (Core) |
| **Native mobile SDKs (iOS and Android)**<br>*aka: Auth0.swift / Auth0.Android (Auth0), Mobile SDK for Swift/Kotlin, Identity Engine SDKs (Okta)* | First-party Swift and Kotlin libraries handling browser-based login, secure credential storage and token refresh on device. Auth0 also ships a Kotlin Multiplatform SDK in Beta; Okta additionally ships Devices SDKs for building a branded push authenticator. Better Auth has no native-language SDK; native apps use the Expo client or call the HTTP endpoints. | ✅ (all plans) | ✅ (all plans) | ✅ (Hobby+) | ❌ |
| **React Native / Expo support**<br>*aka: react-native-auth0 (Auth0), `@clerk/expo` (Clerk), `@better-auth/expo` (BA)* | A React Native client covering deep-link return from the system browser, secure token storage and authenticated requests. Clerk adds biometric re-entry and offline support; Better Auth pairs a server plugin with a SecureStore-backed client and supports native ID-token exchange for Google, Apple and Facebook. Okta's React Native SDK is documented as limited in functionality. | ✅ (all plans) | 🟡 (limited functionality) | ✅ (Hobby+) | ✅ (plugin: expo) |
| **Flutter SDK** | A first-party Dart/Flutter client for the authentication flow. Auth0 covers native mobile targets plus a separate Flutter Web path; Clerk lists Flutter only under community-maintained SDKs; Okta and Better Auth publish none. | ✅ (all plans) | ❌ | 🟡 (community-maintained) | ❌ |
| **Desktop application SDKs**<br>*aka: auth0-oidc-client-net (Auth0), `@better-auth/electron` (BA)* | Libraries for desktop shells. Auth0's .NET OIDC client serves MAUI, Xamarin, UWP and WPF/WinForms; Better Auth ships an Electron package with browser-side authorization, in-app authentication, token exchange and IPC bridges. Clerk lists Tauri only as community-maintained. | ✅ (all plans) | 🟡 (generic OIDC libraries) | 🟡 (Tauri, community) | ✅ (Core companion package) |
| **Browser extension support**<br>*aka: `@clerk/chrome-extension` with `syncHost` (Clerk), Browser Extension guide (BA)* | Documented path for authenticating a browser extension, including syncing auth state with a companion web app and trusting `chrome-extension://` origins. | 🟡 (SPA SDK, no extension guide) | ❌ | ✅ (Hobby+) | ✅ (Core) |
| **Community-maintained SDK tier** | Officially listed but externally maintained libraries, and a published statement of what support they carry. Clerk names nine (Angular, Elysia, Flutter, Hono, Koa, Rust, SolidJS, Svelte, Tauri); Auth0 classifies libraries as Community or Partner in its Product Support Matrix; Better Auth lists 35 community plugins, none of them official or verified. | 🟡 (Community tier, no support) | 🟡 (samples, no support statement) | ✅ (9 named SDKs) | 🟡 (35 plugins, unverified) |

### 20.2 Server-side API surface and type safety

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **HTTP management API**<br>*aka: Management API v2 (Auth0), Okta Management API (Okta), Backend API (Clerk)* | A REST surface covering users, applications, sessions, policies and tenant configuration, callable from any language. Better Auth's equivalent is the routes mounted under your own base path (default `/api/auth/*`) rather than a vendor-hosted endpoint. | ✅ (all plans) | ✅ (all plans) | ✅ (Hobby+) | ✅ (Core, self-hosted) |
| **Typed in-process endpoint callers**<br>*aka: `auth.api.*` (BA)* | Calling every endpoint, including plugin-contributed ones, as a typed local function taking body, headers and query, with options to return the raw `Headers` or full `Response`. The hosted products always cross the network to reach their own API. | ❌ | ❌ | ❌ | ✅ (Core) |
| **End-to-end type inference from server configuration to client** | Types derived from the actual server configuration flow through to the client, so enabling a plugin or an extra field on the server changes the client's typed method surface and result shapes without hand-written declarations. The hosted products cannot do this because their server half is configured in a dashboard, not in your codebase. | ❌ | ❌ | ❌ | ✅ (Core) |
| **Typed session and user objects**<br>*aka: `auth.$Infer` / `authClient.$Infer` (BA)* | TypeScript types for the session and user returned by the SDK. Better Auth infers them from the configured instance (and documents that `strict` must be on, and that `declaration`/`composite` break inference); the others ship hand-authored types with their packages. | ✅ (SDK typings) | ✅ (SDK typings) | ✅ (SDK typings) | ✅ (inferred, Core) |
| **Typing for custom profile fields and claims**<br>*aka: Override Clerk interfaces (Clerk), `inferAdditionalFields()` (BA)* | Making application-specific user fields, metadata or token claims visible to the type checker. Clerk offers declaration-merging hooks you fill in by hand; Better Auth propagates server-declared `additionalFields` types to the client automatically, or by manual declaration in split repositories. Auth0 and Okta surface custom claims and metadata as untyped values. | ❌ | ❌ | 🟡 (manual declaration merging) | ✅ (Core) |
| **Uniform result shape with enumerated error codes** | A predictable success/error return rather than thrown exceptions, with stable machine-readable codes. Better Auth returns `{ data, error }` where the error carries `message`, `status`, `statusText` and `code`; Clerk publishes enumerated Backend and Frontend API error codes. | 🟡 (per-SDK error classes) | 🟡 (documented error codes) | ✅ (Hobby+) | ✅ (Core) |
| **Headless primitives for hand-built auth flows**<br>*aka: custom flows and hooks (Clerk), ACUL (Auth0), Identity Engine embedded SDKs (Okta)* | APIs for driving sign-in, sign-up, MFA enrollment and consent from your own UI rather than a hosted page. Clerk documents this as advanced with best-effort support only; Auth0's screen-level customization still runs the flow on Auth0; Better Auth's client is headless by default. | 🟡 (ACUL screens, flow stays hosted) | 🟡 (embedded SDK, Interaction Code grant) | 🟡 (best-effort support) | ✅ (Core) |
| **Reactive session hook / store**<br>*aka: `useUser()` (Auth0), `useOktaAuth()` (Okta), `useAuth()` / `useUser()` (Clerk), `useSession()` (BA)* | A framework-idiomatic subscription to the current auth state that re-renders on change. Better Auth exposes the underlying nanostores atoms for selective key subscriptions and lets a call opt out of triggering re-renders. | ✅ (React/Vue/Angular) | 🟡 (React wrapper only) | ✅ (React and Vue) | ✅ (Core, 5 clients) |

### 20.3 API reference, documentation and AI-facing surfaces

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Published OpenAPI specification**<br>*aka: Management API OAS schema (Auth0), `clerk/openapi-specs` (Clerk), openAPI plugin (BA)* | A machine-readable API description usable for client generation. Okta publishes specs for Management, OAuth, SCIM, IGA and other APIs; Clerk publishes MIT-licensed OpenAPI 3.0.3 documents per dated API version; Auth0's OAS schema for the Management API is a Beta download; Better Auth generates an OpenAPI 3.1.1 document from your own configured instance, covering plugin endpoints. | 🟡 (Management API, Beta) | ✅ (public spec repository) | ✅ (MIT, per API version) | 🟡 (plugin: openAPI, early-stage) |
| **Interactive API reference** | A browsable reference where requests can be executed from the page. Better Auth serves a Scalar-based UI from your own deployment at `/api/auth/reference`, grouped per plugin, with the path, theme, CSP nonce and whether it is served at all all configurable. | ✅ (docs explorer) | ✅ (docs explorer) | ✅ (Hobby+) | ✅ (plugin: openAPI) |
| **Postman collections** | Ready-made request collections for the vendor's APIs. Auth0 publishes collections for the Authentication and Management APIs, generated from its OpenAPI definitions; Okta publishes a public Postman workspace. Clerk and Better Auth expect you to import their OpenAPI documents instead. | ✅ (all plans) | ✅ (all plans) | ❌ | 🟡 (import generated spec) |
| **Enumerated API error reference** | A published catalog of error codes and messages for handling specific failures programmatically. | 🟡 (per-API error listings) | ✅ (error code reference) | ✅ (Backend and Frontend APIs) | 🟡 (codes in source and i18n keys) |
| **Quickstart catalog** | Step-by-step first-integration tutorials organized by application type or framework. Auth0's catalog spans Native/Mobile, SPA, Regular Web App, Backend/API and AI Agent across its whole SDK lineup; Okta pairs quickstarts with the `okta start` CLI command; Better Auth documents one per supported framework. | ✅ (all plans) | ✅ (all plans) | ✅ (Hobby+) | ✅ (Core) |
| **Runnable sample applications** | Downloadable or clonable applications pre-wired to the product. Auth0 attaches a configured sample to each quickstart; Okta maintains sample repositories per framework; Clerk publishes demo repositories and templates; Better Auth ships examples and a demo application in its repository. | ✅ (per quickstart) | ✅ (sample repositories) | ✅ (demos and templates) | 🟡 (repo examples and demo) |
| **LLM-readable documentation exports**<br>*aka: llms.txt and llms-full.txt (Auth0), `.md` doc endpoints (Clerk)* | Machine-readable documentation indexes and plain-Markdown versions of every page, for feeding into AI coding tools. Auth0 adds a full-text export and a separate pair for its AI-agents docs. Okta's `llms.txt` covers only the marketing site; its developer documentation has none. | ✅ (all plans) | 🟡 (marketing site only) | ✅ (Hobby+) | ✅ (Core) |
| **Hosted documentation MCP server** | A Model Context Protocol endpoint that lets an AI client search the product's documentation. Auth0 hosts one for its main docs and another for its AI-agents docs; Better Auth hosts one at `mcp.better-auth.com`; Clerk's is Beta and installs into ten AI clients via its CLI. Okta's MCP servers target the management API rather than the docs. | ✅ (read-only, hosted) | ❌ | 🟡 (Beta) | ✅ (Core, hosted) |
| **Tenant-administration MCP server**<br>*aka: `@auth0/auth0-mcp-server` (Auth0), Open Source / Managed MCP Server (Okta), `@clerk/agent-toolkit` (Clerk)* | An MCP server that lets an AI client perform configuration changes against the account — creating applications, connections and users — under scoped, auditable credentials. Not applicable to Better Auth, whose configuration is source code rather than remote state. | ✅ (local, device-flow auth) | ✅ (self-hosted or managed) | ✅ (via CLI install) | ➖ |
| **Coding-assistant skill packs**<br>*aka: Agent Skills for Auth0 (Auth0), Clerk Skills (Clerk), Better Auth Skills (BA)* | Installable instruction bundles that teach an AI coding agent the product's conventions, often framework-detecting. Auth0's router detects the framework and loads references for adding login, protecting routes, securing APIs, configuring MFA or migrating from another provider; Clerk ships a core skill plus framework-specific ones, installable during `clerk init`. | ✅ (Claude Code and Cursor marketplaces) | ❔ (unverified) | ✅ (Hobby+) | ✅ (Core) |
| **Localized error messages returned by the auth server**<br>*aka: `@better-auth/i18n` (BA), Sign-In Widget i18n (Okta)* | Translation of the error strings the authentication backend returns, keyed by stable error codes and selected per request. Better Auth ships 22 language catalogs, detects the locale from `Accept-Language`, a cookie, a user field or a callback in a configured priority order, and preserves the untranslated English text in `originalMessage`. The hosted products localize strings inside their own UI rather than in API responses. | 🟡 (hosted login UI only) | 🟡 (widget language bundles only) | 🟡 (prebuilt components only) | ✅ (plugin: i18n, 22 locales) |

### 20.4 CLI and local development

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Official command-line tool**<br>*aka: `auth0` CLI (Auth0), Okta CLI (Okta), `clerk` (Clerk), `auth` CLI / `@better-auth/cli` (BA)* | A terminal tool for working against the product without the dashboard. Clerk's spans init, auth, link, env pull, config pull/patch, deploy, doctor, api, users, impersonate, webhooks, MCP install and more; Auth0's covers tenant resources, `auth0 test login` and `auth0 logs tail`; Okta's is still labelled Beta. | ✅ (all plans) | 🟡 (Beta) | ✅ (Hobby+) | ✅ (Core) |
| **Project scaffolding into your codebase**<br>*aka: `okta start` (Okta), `clerk init` (Clerk), `auth init` (BA)* | Generating or wiring auth code into an existing or new project. Better Auth's `init` takes name, framework, plugins, database and package manager; Clerk's `init` also offers to install its agent skills, and a shadcn CLI path bootstraps a Next.js app. Auth0's CLI creates tenant-side applications rather than application code. | 🟡 (creates tenant app, not code) | 🟡 (Beta, scaffolds sample app) | ✅ (Hobby+) | ✅ (Core) |
| **Database schema generation**<br>*aka: `auth generate` (BA)* | Emitting the auth tables for your own database in your ORM's format — Prisma schema, Drizzle `schema.ts` or Kysely `schema.sql` — including columns contributed by enabled plugins. Prisma and Drizzle output needs no live database connection. Not applicable where the vendor owns the user store. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Schema migration execution**<br>*aka: `auth migrate` / `getMigrations()` (BA)* | Applying the generated schema to a database, either from the CLI or programmatically from application code for serverless and Cloudflare D1 deployments where the CLI cannot reach the database. Kysely-backed adapters only. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Configuration pull, inspect and patch**<br>*aka: `clerk config pull` / `config patch` (Clerk)* | Reading and changing instance settings from the terminal. Clerk's CLI exposes named configuration keys for sign-up mode, allowed identifiers, password rules, disposable-domain blocking, social connections and session claims. For Better Auth the configuration is source code, so it is already inspectable and diffable; `auth info` prints the resolved view. | 🟡 (`auth0 api` raw calls) | 🟡 (raw management API) | ✅ (Hobby+) | ✅ (configuration is code) |
| **Local environment credential bootstrap**<br>*aka: `clerk env pull` (Clerk), `.okta.env` (Okta)* | Writing the instance's publishable and secret keys into a local env file so a new checkout can run immediately. | 🟡 (credentials shown, manual copy) | 🟡 (Beta CLI writes env file) | ✅ (Hobby+) | ➖ (no remote credentials) |
| **Secret generation**<br>*aka: `auth secret` (BA)* | Generating a cryptographically suitable signing secret for the deployment. Hosted products issue their own keys instead. | ➖ | ➖ | ➖ | ✅ (Core) |
| **Environment diagnostics**<br>*aka: `clerk doctor` (Clerk), `auth info` (BA)* | A command that reports the resolved local setup and common misconfigurations. Better Auth prints system, package manager, version, config, detected frameworks and databases with secrets redacted and a `--json` mode for sharing; Clerk's also probes the configured MCP server with a real handshake. | ❌ | ❌ | ✅ (Hobby+) | ✅ (Core) |
| **Assisted dependency upgrade**<br>*aka: `@clerk/upgrade` (Clerk), `auth upgrade` (BA)* | A command that moves the project to a newer SDK version. Clerk's detects the installed SDK, bumps it, runs codemods and scans the codebase for remaining breaking changes across `.ts`, `.tsx`, `.js` and `.jsx`; Better Auth's bumps the synchronized release train only, leaving independently versioned packages such as `@better-auth/utils` alone. | ❌ | ❌ | ✅ (codemods, Hobby+) | 🟡 (version bump only) |
| **First-admin bootstrap from the CLI**<br>*aka: `auth create-admin` (BA)* | Creating the initial privileged user through the normal API so password hashing and database hooks still run. Hosted products create the first administrator during account signup. | ➖ | ➖ | ➖ | ✅ (Core CLI, admin plugin) |
| **Local tunnel or public URL requirement**<br>*aka: `clerk webhooks listen` (Clerk)* | Whether inbound callbacks and webhooks can reach a developer's machine without exposing it publicly. Clerk's CLI forwards webhook deliveries to localhost and verifies signatures; Auth0 and Okta require a publicly reachable endpoint, typically a tunnel, for hook and webhook testing. Better Auth's hooks run in-process, so nothing needs to reach in from outside. | 🟡 (external tunnel needed) | 🟡 (external tunnel needed) | ✅ (CLI forwarder) | ➖ (hooks are in-process) |
| **Separate development environment**<br>*aka: development instance (Clerk), Preview org / Integrator Free Plan org (Okta), development tenant (Auth0)* | A non-production environment for building against. Clerk development instances issue `pk_test_` keys and a `.accounts.dev` domain; Okta offers free Trial and Integrator orgs plus Preview orgs that receive releases early and can enable Beta features; Better Auth's development environment is simply another local database. | ✅ (free dev tenants) | ✅ (free Integrator/Preview orgs) | ✅ (dev instance, Hobby+) | ✅ (local instance) |
| **Fully offline local development** | Whether the application's authentication works with no network access to a vendor. Only a self-hosted library can run entirely offline; the hosted products need reachability to their API for every sign-in and most token operations. | ❌ | ❌ | ❌ | ✅ (Core) |

### 20.5 Automated testing support

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Test credentials that bypass bot protection**<br>*aka: Testing Tokens (Clerk)* | A documented way for CI to get past bot detection and CAPTCHA. Clerk issues short-lived instance-scoped Testing Tokens passed as `__clerk_testing_token`, created with `createTestingToken()`. Auth0 and Okta rely on excluding CI addresses from attack-protection rules; Better Auth's CAPTCHA is an opt-in plugin you simply leave out of a test instance. | 🟡 (IP allowlist, no test token) | 🟡 (network zone exclusion) | ✅ (dev and production) | 🟡 (omit the captcha plugin) |
| **Official test helper package**<br>*aka: `@clerk/testing` (Clerk), testUtils plugin (BA)* | A supported library of testing helpers. Clerk's provides `clerkSetup()`, `setupClerkTestingToken()` and UI-bypassing sign-in helpers; Better Auth's attaches helpers to the server context with no HTTP routes, and is documented as belonging in a separate test-only auth instance because it can mint sessions and write records. | 🟡 (test tenant pattern only) | 🟡 (test org pattern only) | ✅ (Hobby+) | ✅ (plugin: testUtils) |
| **First-class E2E framework integration** | Documented support for browser test runners, including reusing an authenticated state across tests. Clerk documents Playwright and Cypress with their own command sets; Better Auth's `getCookies()` returns cookie objects in the exact shape Playwright and Puppeteer accept so a test can start already signed in. | ❌ | ❌ | ✅ (Playwright and Cypress) | ✅ (plugin: testUtils) |
| **Programmatic session minting for tests**<br>*aka: `clerk.signIn()` (Clerk), `test.login()` (BA)* | Creating a valid session for a given user without driving the sign-in flow. Better Auth returns the session as an object, request headers, browser cookies and a raw token in one call, and can seed custom session fields. | 🟡 (password grant in a test tenant) | 🟡 (session token via API) | ✅ (Hobby+) | ✅ (plugin: testUtils) |
| **Test data factories and seeding helpers**<br>*aka: `test.createUser()` / `saveUser()` / `addMember()` (BA)* | Helpers for building and persisting test users, organizations and memberships. Better Auth builds in-memory objects with defaults that can be overridden, then writes and deletes them per test; the hosted products expose only their normal management API. | 🟡 (management API) | 🟡 (management API) | 🟡 (Backend API) | ✅ (plugin: testUtils) |
| **Reserved test identifiers with fixed verification codes**<br>*aka: test emails and phones (Clerk)* | Fake email addresses and phone numbers that always accept a known one-time code, so email and SMS verification can be exercised without sending real messages. | ❌ | ❌ | ✅ (Hobby+) | ❌ |
| **In-test capture of generated one-time codes**<br>*aka: `captureOTP` / `test.getOTP()` (BA)* | A hook that keeps an in-memory copy of every generated one-time code keyed by email or phone, so tests can complete real OTP flows without mocking the sender; delivery still happens normally, and the store can be cleared between tests. | ❌ | ❌ | ❌ | ✅ (plugin: testUtils) |
| **Reserved domain for testing domain ownership**<br>*aka: `clerk.test` (Clerk)* | A domain whose subdomains skip DNS lookups so organization domain-verification flows can be exercised in automated tests. | ❌ | ❌ | ✅ (Hobby+) | ❌ |

### 20.6 Versioning, lifecycle and support

| Feature | Description | Auth0 | Okta | Clerk | Better Auth |
| --- | --- | --- | --- | --- | --- |
| **Semantic versioning commitment for SDKs** | A published statement that libraries follow semver so breaking changes are discoverable, with guidance on pinning. Clerk batches breaking changes into roughly six-monthly "Core" releases shared across every SDK; Better Auth moves its first-party packages on a synchronized release train. | ✅ (documented strategy) | ✅ (per-SDK semver) | ✅ (Core releases) | ✅ (semver, release train) |
| **Dated API versioning**<br>*aka: `Clerk-API-Version` header (Clerk)* | Selecting a pinned, dated snapshot of API behavior per request rather than only a path version. Clerk's Backend and Frontend APIs are versioned by date and selected by header or query parameter; Auth0 and Okta version in the path (`/api/v2`, `/api/v1`). Not applicable to a library you deploy yourself. | 🟡 (path version only) | 🟡 (path version only) | ✅ (Hobby+) | ➖ |
| **Published release cadence** | A stated schedule for shipping features and fixes. Okta ships GA and Early Access features monthly with weekly patch deployments; Clerk ships continuously with breaking changes batched into Core releases; Auth0 and Better Auth publish changes as they land without a stated cadence. | 🟡 (changelog, no cadence) | ✅ (monthly, weekly patches) | ✅ (Core ≈6-monthly) | 🟡 (frequent, no stated cadence) |
| **Support window for the previous major version** | How long the prior major release keeps receiving fixes. Clerk gives the previous Core one year of LTS with backported critical patches (Core 3 active since January 2026, Core 2 in LTS until January 2027); Auth0's Product Support Matrix limits support to the most recent version unless stated otherwise. | 🟡 (latest version only) | 🟡 (per-SDK policy) | ✅ (1 year LTS) | ❌ (no LTS policy) |
| **Published release stage taxonomy**<br>*aka: Product Release Stages (Auth0), Feature release lifecycle (Okta)* | Named maturity stages with defined production-use rules. Auth0: Beta, Developer Preview, Early Access, GA, Deprecated. Okta: Research Release, Beta, Early Access, GA, Deprecated, with Beta confined to Preview orgs and a self-service Features page for enabling eligible EA and Beta features. | ✅ (5 stages) | ✅ (5 stages) | 🟡 (Beta labels, no taxonomy) | 🟡 (one plugin marked in-development) |
| **Deprecation register and migration deadlines** | A maintained list of mandatory migrations with rationale and dates. Auth0 publishes a register plus an archive; its Rules and Hooks reach End of Life on 18 November 2026, taking Rules- and Hooks-based Extensions with them. Okta marks the Classic Engine authentication and registration endpoints deprecated in favour of the Interaction Code model. | ✅ (register with deadlines) | ✅ (deprecation notices) | 🟡 (per-release upgrade guides) | 🟡 (changelog notes only) |
| **Version pinning of the delivered client**<br>*aka: `CLERK_JS_VERSION` and component versioning (Clerk), widget version selection (Okta)* | Choosing which version of the vendor-delivered UI or script an application loads, so upgrades can be staged. Okta pins the Sign-In Widget per brand; Clerk pins both packages and hosted components and publishes a separate component changelog. Better Auth has nothing vendor-delivered — every version is in your lockfile. | 🟡 (CDN pinning guidance) | ✅ (per-brand widget version) | ✅ (Hobby+) | ➖ |
| **Migration guides from named competitors** | Step-by-step guides and tooling for importing users and rewriting integration code from another identity product. Clerk documents Auth.js/NextAuth, Firebase, Auth0 and Supabase, with an open-source Auth0 import tool and CLI detection of the incumbent. Better Auth documents Auth.js, Auth0, Clerk, Supabase and WorkOS, including password-hash and social-account carryover. Okta's migration material targets its own Classic-to-Identity-Engine upgrade. | 🟡 (bulk import plus an AI skill) | 🟡 (own Classic-to-OIE upgrade) | ✅ (4 products, import tool) | ✅ (5 products) |
| **Tiered support plans with a severity model** | Paid support tiers with defined response commitments. Auth0 defines four defect severity levels, Severity 1 being a production outage, on Basic/Silver and higher success plans. Better Auth's support is community-run. | ✅ (success plans) | ✅ (support tiers) | 🟡 (Business/Enterprise) | 🟡 (community Discord and GitHub) |
| **Contractual uptime SLA with service credits** | A committed availability figure backed by financial credits. Auth0 commits to at least 99.99% average monthly availability on Enterprise Public and Private Cloud, with credits of 5%, 10% or 20% of the monthly fee claimable within 5 business days. Not applicable to software you host yourself. | ✅ (Enterprise) | ✅ (Enterprise contract) | 🟡 (Enterprise) | ➖ |
| **Public community channel**<br>*aka: Auth0 Community (Auth0), Okta developer forum (Okta), Discord (Clerk, BA)* | A free public forum or chat used for questions and, for some libraries, as the only support channel. | ✅ (forum) | ✅ (forum) | ✅ (Discord) | ✅ (Discord and GitHub) |
| **Published per-SDK support classification**<br>*aka: Product Support Matrix (Auth0)* | A table stating, for every SDK and platform, what level of assistance the vendor provides. Auth0 classifies each as Supported, Sustained, Bug Fixes, Community or Partner; Okta marks individual repositories as archived or unmaintained without a single matrix. | ✅ (documented matrix) | 🟡 (per-repository statements) | ❌ | ❌ |
| **Public changelog** | Published release notes for the platform and SDKs. Auth0's is also available in machine-readable form; Clerk maintains a separate changelog for its hosted UI components. | ✅ (machine-readable) | ✅ (release notes) | ✅ (product and components) | ✅ (releases and blog) |

---

## 21. Pricing & packaging

The four products meter on four incompatible units, and that — not the headline numbers — is what
makes them hard to compare. Auth0 bills **monthly active users (MAU)**; Clerk bills **monthly
retained users (MRU)** and, separately, **monthly retained organizations (MRO)**; Okta bills **per
user per month per SKU or suite** under an annual contract; Better Auth bills **nothing for the
framework** and sells an optional hosted layer metered on **audit-log events and security
detections**. Prices below are USD list prices as published on each vendor's own pages, verified
2026-09-17; anything unpublished is written as "contact sales" rather than estimated, and every
third-party figure is marked **unofficial**.

### 21.1 At a glance

| Product | Free tier | Entry paid plan | Metering unit | What drives cost up |
| --- | --- | --- | --- | --- |
| **Auth0** | 25,000 external MAU, production use allowed ([auth0.com/pricing](https://auth0.com/pricing)) | B2C Essentials $35/mo (500 MAU); B2B Essentials $150/mo (500 MAU) | External MAU, billed in tiers; separate B2C and B2B ladders | Crossing an MAU tier boundary; enterprise SSO connections at $100/mo each (B2B); M2M tokens; the +50% AI-agents add-on |
| **Okta — Workforce Identity** | 30-day trial only ([okta.com/free-trial](https://www.okta.com/free-trial/)) | Starter $6/user/mo, annual billing, **$1,500 annual contract minimum** ([okta.com/pricing](https://www.okta.com/pricing/)) | Per user per month, per suite | Headcount; moving up the suite ladder ($6 → $14 → $17 → unpublished); add-on SKUs, all unpriced |
| **Okta — Customer Identity** (the non-Auth0 CIAM) | Integrator Free Plan: **10 active users, non-production only** ([developer.okta.com/signup](https://developer.okta.com/signup/)) | **$3,000/mo base platform**, mandatory, annual contract ([okta.com/pricing](https://www.okta.com/pricing/)) | Flat platform fee + MAU-metered suites on top | The base fee is the floor; B2C and B2B suites and every add-on are unpublished |
| **Clerk** | Hobby: **50,000 MRU per app**, unlimited apps, production use allowed ([clerk.com/pricing](https://clerk.com/pricing)) | Pro $25/mo ($20/mo billed annually) | MRU, plus MRO as a second meter | Features, not users, up to 50,000 MRU; then enterprise SSO connections, the B2B add-on, MRO count, and the 4th dashboard seat |
| **Better Auth** | Entire framework and all plugins, MIT, unlimited users ([LICENSE.md](https://github.com/better-auth/better-auth/blob/main/LICENSE.md)) | Framework: none. Optional Infrastructure Pro $20/mo ([better-auth.com/pricing](https://better-auth.com/pricing)) | Framework: nothing. Infrastructure: audit-log events, security detections, SSO/SCIM connections, emails, SMS | Your own database, hosting, email and SMS bills — and engineering time, which appears on no invoice |

Okta is one vendor selling two separately priced products, and Auth0 is a third (sold as "Okta
Customer Identity Cloud"). The two CIAM offerings differ by **$36,000/year at the entry point**, so
the SKU name has to be in writing before any quote is comparable
([okta.com/pricing/auth0](https://www.okta.com/pricing/auth0/) is a stub that redirects the reader to
auth0.com).

### 21.2 Auth0

Auth0 splits self-service pricing into **two use-case toggles, B2C and B2B**, with the same four tier
names in each. Free is shared; Essentials and Professional are priced very differently per toggle;
Enterprise is quote-only in both. Source for every price in this subsection unless noted:
[auth0.com/pricing](https://auth0.com/pricing).

**Metering unit.** An Auth0 **MAU** is a unique user ID that successfully authenticates at least once
in the calendar month, counted once regardless of how many tokens, apps or tenants are involved
([support.auth0.com — How MAU are counted](https://support.auth0.com/center/s/article/How-MAU-are-counted)).

#### B2C MAU ladder

| MAU tier | Essentials /mo | Essentials /yr | Professional /mo | Professional /yr |
| --- | --- | --- | --- | --- |
| 500 | $35 | $385 | $240 | $2,640 |
| 1,000 | $70 | $770 | $240 | $2,640 |
| 2,500 | $175 | $1,925 | $545 | $5,995 |
| 5,000 | $350 | $3,850 | $1,000 | $11,000 |
| 7,500 | $525 | $5,775 | $1,200 | $13,200 |
| 10,000 | $700 | $7,700 | $1,600 | $17,600 |
| 20,000 | $1,400 | $15,400 | $3,200 | $35,200 |
| 30,000 | $2,100 | $23,100 | Contact sales | Contact sales |
| 40,000 | $2,800 | $30,800 | Contact sales | Contact sales |
| 50,000 | $3,500 | $38,500 | Contact sales | Contact sales |
| 50,001+ | Contact sales | Contact sales | Contact sales | Contact sales |

B2C Essentials is a flat **$0.07/MAU** across the whole published ladder. B2C Professional's $240 base
covers the first 1,000 MAU, then climbs at roughly $0.16–$0.22/MAU.

#### B2B MAU ladder

| MAU tier | Essentials /mo | Essentials /yr | Professional /mo | Professional /yr |
| --- | --- | --- | --- | --- |
| 500 | $150 | $1,650 | $800 | $8,800 |
| 1,000 | $300 | $3,300 | $800 | $8,800 |
| 2,500 | $700 | $7,700 | $1,200 | $13,200 |
| 5,000 | $1,300 | $14,300 | $1,500 | $16,500 |
| 7,500 | $1,725 | $18,975 | $1,800 | $19,800 |
| 10,000 | $2,100 | $23,100 | Contact sales | Contact sales |
| 20,000 | $3,800 | $41,800 | Contact sales | Contact sales |
| 30,000+ | Contact sales | Contact sales | Contact sales | Contact sales |

B2B is metered on the same external-MAU basis — **there is no per-organization fee**. What the B2B
toggle costs extra for is the org-shaped feature set, and its real cost driver is enterprise SSO
connections. At 500 MAU, B2B Essentials is 4.3× B2C Essentials and B2B Professional 3.3× B2C
Professional.

**What each tier unlocks**

- **Free** — 25,000 external MAU, unlimited social connections, unlimited Okta enterprise
  connections plus **1** other enterprise connection, Self-Service SSO and SCIM (added 2026-02-12),
  5 Organizations, passwordless, passkeys, 1 custom domain (**credit-card verification required**),
  1 tenant, 3 admins, 1-day log retention, no log streams, 1,000 M2M tokens. No SLA, community
  support only.
- **Essentials** — adds role management (RBAC), account linking, Pro MFA factors, 10 Actions/Forms,
  3 tenants, 5-day log retention, 1 log stream, Viewer role, standard support. B2B additionally:
  unlimited Organizations, Home Realm Discovery, 3 enterprise connections.
- **Professional** — adds custom database connections, cross-app SSO, breached-password detection,
  15 Actions/Forms, 12 tenants, 10-day log retention, 2 log streams, 5,000 M2M tokens, Editor role.
  B2B additionally: 5 enterprise connections, M2M access for Organizations.
- **Enterprise** — **contact sales, not published.** Adds the 99.99% SLA, custom enterprise-connection
  tiers, unlimited tenants, 30-day log retention, 30 Actions/Forms, Premier Success support options,
  and eligibility for the Adaptive MFA / Bot Detection / Private Deployment add-ons.

**Add-ons and metered extras**

| Add-on | Price | Source |
| --- | --- | --- |
| Extra enterprise SSO connection (B2B only) | **$100/mo ($1,100/yr) each**; Essentials includes 3, Professional 5; **hard cap 30 total** | [auth0.com/pricing](https://auth0.com/pricing) |
| Enterprise MFA factors (B2B Essentials) | **$100/mo ($1,100/yr)**; included on B2B Professional | [auth0.com/pricing](https://auth0.com/pricing) |
| Auth0 for AI Agents ("Auth for GenAI") | **+50% of base plan price**, rounded up to the dollar — scales with your MAU tier | [auth0.com/pricing](https://auth0.com/pricing) |
| M2M tokens (B2C, Professional+) | 5,000 included; 10,000 = $40 · 50,000 = $200 · 100,000 = $400 · 300,000 = $1,200 per month | [auth0.com/pricing](https://auth0.com/pricing) |
| M2M tokens (B2B) | from **$10/mo for 2,500**; 10,000 = $40, then identical to the B2C ladder from 20,000 up | [auth0.com/pricing](https://auth0.com/pricing) |
| Adaptive MFA | Enterprise add-on — **price not published** | [auth0.com/pricing](https://auth0.com/pricing) |
| Bot Detection / Credential Guard | Enterprise add-on — **price not published** | [auth0.com/pricing](https://auth0.com/pricing) |
| Actions + Forms beyond 30 | Enterprise add-on — **price not published** | [auth0.com/pricing](https://auth0.com/pricing) |
| Token Vault extra connected apps | Essentials+ add-on — **price not published** | [auth0.com/pricing](https://auth0.com/pricing) |
| Private Deployment / Private Cloud | Enterprise add-on — **price not published** (tiers: Basic, Performance at 500 RPS, Performance Plus at 1,500 RPS) | [auth0.com/pricing](https://auth0.com/pricing) |
| Highly Regulated Identity | Enterprise-only — **price not published**, no pricing page exists | — |
| **Auth0 FGA** (relationship-based authorization) | **Genuinely unpublished.** The free trial is free and untimed but capped at **100 MAU / 50,000 tuples**, no SLA, community support. Production use requires an Enterprise contract at an unquoted price | [docs.fga.dev/subscription-plans](https://docs.fga.dev/subscription-plans) |

Billing footnotes, verbatim from the pricing page: "Yearly billing is 11× the monthly price
(equivalent to 1 month free)"; "If usage falls between tiers, you are billed at the next tier up";
"credit card verification required for custom domains"; and "subject to system limitations" attached
to every "Unlimited" claim.

**Auth0 for Startups** ([auth0.com/startups](https://auth0.com/startups)): B2B Professional free for
one year up to 100,000 MAU, including 5 enterprise connections and unlimited Organizations.
Eligibility requires all three of: venture-backed with under $5M funding, under $1M ARR, and under
2 years since incorporation.

**Gotchas (Auth0)**

1. **Next-tier-up billing.** One user over a boundary bills the whole next tier: 10,001 B2C Essentials
   MAU bills as 20,000, taking $700/mo to $1,400/mo. There is no published per-MAU overage rate.
2. **B2C plans have zero enterprise connections.** Not "limited" — enterprise connections read as *not
   available* on B2C Essentials and Professional. A B2C product that lands its first enterprise logo
   has to change toggles entirely or go to Enterprise.
3. **The enterprise-connection cap is 30.** A B2B SaaS with 40 SSO customers cannot stay on
   self-service pricing at any price.
4. **The pricing page gates two features inconsistently between its own B2C and B2B tables.**
   *Security Center* is included from Professional on the B2C table but is **Enterprise-only on the
   B2B table** — the toggle that costs 3–4× more gets *less*. *Enterprise MFA factors* are a
   purchasable **$100/mo add-on on B2B Essentials** but cannot be bought at all on B2C Essentials.
   (The exact B2C tier for Enterprise MFA is itself disputed: the live page reads Professional+, while
   the plan summary reads Essentials. Get it in writing.)
5. **Deleted users still count** for the month in which they were active. A mid-month cleanup does not
   reduce that month's bill.
6. **Refresh tokens are free; silent authentication is not.** Silent auth (`ssa`) and refresh-token
   exchange (`sertft`) both generate MAU.
7. **No SLA below Enterprise.** Professional at $3,200/mo (20,000 B2C MAU) still carries no SLA and
   only business-hours standard support.
8. **Log retention is 1 / 5 / 10 / 30 days**, and log streams are 0 / 1 / 2 / 2. Audit history means
   streaming logs out, which is itself plan-gated.
9. **Tenant count is a plan feature** — 1 / 3 / 12 / unlimited. Separate dev, staging and prod tenants
   per product line consumes the Essentials allowance of 3 immediately.
10. **Free's custom domain requires a credit card on file** even though the plan is $0.
11. **Auth0 FGA cannot be adopted gradually** — the trial ceiling is 100 MAU, and production is an
    Enterprise contract at an unpublished price.
12. **Enterprise is unpublished and large.** *Unofficial* third-party estimates put typical Enterprise
    entry near **$30,000/year**, with 500,000-MAU quotes in the **$4,000–$10,000+/month** range once
    enterprise SSO, adaptive MFA and FGA are layered in
    ([ssojet.com](https://ssojet.com/blog/enterprise-authentication-pricing-2026), 2026-07-28,
    **unofficial — not corroborated by auth0.com**).

### 21.3 Okta

Okta sells two separately priced things under names that are easy to confuse, plus Auth0 as a third.
Source for every price in this subsection: [okta.com/pricing](https://www.okta.com/pricing/) and
[okta.com/pricing/add-ons](https://www.okta.com/pricing/add-ons/).

**Metering unit.** Workforce Identity is **per user per month, per suite, billed annually**, with a
**$1,500 annual contract minimum** and no month-to-month option at all. Customer Identity is a flat
**$3,000/month platform fee** plus MAU-metered suites on top, also annual. Okta's CIAM MAU definition
is "a unique user that authenticates with or is authorized by the Okta service within a given month."

#### Workforce Identity suites

| Suite | Price | Metering unit | Included |
| --- | --- | --- | --- |
| Starter | **$6 per user/month** | per user, billed annually | SSO, MFA, Universal Directory, 5 Workflows |
| Core Essentials | **$14 per user/month** | per user, billed annually | Starter + Adaptive MFA, Lifecycle Management, 5 Workflows |
| Essentials ("Most Popular") | **$17 per user/month** | per user, billed annually | Core Essentials + Privileged Access (2 admins), Access Governance, 50 Workflows |
| Professional | **Contact sales — not published** | per user, billed annually | Essentials + Device Access, API Access Management, Identity Threat Protection, 2 ISPM integrations, Sandbox, unlimited Workflows |
| Enterprise | **Contact sales — not published** | per user, billed annually | Professional + Secure Partner Access, Access Gateway, 50 ISPM integrations, M2M tokens, customizable base suite |

#### Customer Identity (the non-Auth0 CIAM)

| Component | Price | Metering unit | Included |
| --- | --- | --- | --- |
| Enterprise base platform (**mandatory**) | **$3,000 per month**, billed annually | flat platform fee | Unlimited OIDC and outbound SAML apps, Okta APIs, "enterprise-grade SLAs" |
| B2C Suite | **Contact sales — not published** | MAU-based, on top of the base | 50 Workflows, MFA, SSO with unlimited OIN apps |
| B2B Suite | **Contact sales — not published** | MAU-based, on top of the base | Inbound Federation, Identity Governance, Lifecycle Management |

**What each tier unlocks**

- **Starter → Core Essentials** ($6 → $14) buys Adaptive MFA and Lifecycle Management.
- **Core Essentials → Essentials** ($14 → $17) buys Privileged Access (2 admins), Access Governance,
  and Workflows from 5 to 50. A 21% step for three things.
- **Professional** adds Device Access, API Access Management, Identity Threat Protection, a Sandbox,
  unlimited Workflows and 2 ISPM integrations — and is the point at which pricing stops being published.
- **Enterprise** adds Secure Partner Access, Access Gateway, 50 ISPM integrations, M2M tokens, and a
  customizable base suite.
- **Customer Identity** is a different product line entirely: the $3,000/mo base buys the platform and
  the SLA, and buys no suite.

**Add-ons and metered extras**

**Okta publishes no price for any individually-sold product.** Every item on the add-ons page reads
"Contact us" / "View suite pricing": Okta for AI Agents, Single Sign-On, Adaptive MFA, Device Access,
API Access Management, Secure Partner Access, Access Gateway, Universal Directory, Privileged Access,
Advanced Server Access, Identity Security Posture Management, Identity Threat Protection with Okta AI,
Lifecycle Management, Identity Governance, and Workflows. On Customer Identity the same applies to
Identity Threat Protection, Lifecycle Management, Identity Governance, MFA, Adaptive MFA, SSO
integrations, Access Gateway, API Access Management, M2M authorization, directory integrations,
inbound federation, Workflows and **DynamicScale** (the rate-limit multiplier add-on, 5× to 1000×).

*Unofficial* third-party figures circulate for the retired per-SKU list prices. **None are corroborated
by okta.com and none should be used for budgeting:** SSO ~$2/user/mo and MFA ~$3/user/mo
([idsync.com](https://idsync.com/guides/okta-pricing)); Adaptive MFA ~$6, Lifecycle Management ~$4,
API Access Management ~$2 ([accessowl.com](https://www.accessowl.com/blog/okta-cost)); Identity
Governance $9–$11 ([underdefense.com](https://underdefense.com/industry-pricings/okta-pricing-ultimate-guide-for-security-products/));
a realistic all-in stack at $18–$25/user/mo ([idsync.com](https://idsync.com/guides/okta-pricing)).
Volume discounts for 5,000+ users and 15–30% for 24–36 month commitments are likewise **unofficial**
([vendr.com](https://www.vendr.com/marketplace/okta)).

Programs: **Okta for Good** gives nonprofits 50 free Workforce licences plus 50% off additional
licences, subject to TechSoup validation
([okta.com/okta-for-good-free-trial](https://www.okta.com/okta-for-good-free-trial/)). There is no
Okta Workforce startup programme — the startup offer lives on the Auth0 side.

**Gotchas (Okta)**

1. **The $1,500 annual contract minimum binds until ~21 users** at Starter's $6/user/mo. Below that
   you are paying above list per head.
2. **No monthly billing at all.** "All suites are billed annually." There is no self-service
   month-to-month Workforce tier.
3. **Okta stopped publishing per-SKU prices.** Any $2-SSO or $3-MFA figure circulating in 2026 is a
   third-party estimate or a legacy number. Budget from suite prices, not SKU folklore.
4. **Pricing goes opaque exactly at governance.** Professional and Enterprise — the only suites with
   Device Access, ITP and ISPM — are both unpublished. Okta publishes nothing above $17/user/mo.
5. **Identity Security Posture Management is capped by integration count, not users** — 2 on
   Professional, 50 on Enterprise. A scaling wall that no per-user model exposes.
6. **Privileged Access on Essentials and Professional is 2 admins** (0.5 Resource Unit per licence),
   not unlimited. Only Enterprise includes it outright.
7. **The $3,000/month Customer Identity base platform is mandatory and buys no suite.** Entry cost for
   Okta's non-Auth0 CIAM is **$36,000/year minimum** before a single MAU is priced.
8. **Two products are both called "Okta customer identity"** and they differ by ~$36,000/year at the
   entry point.
9. **The free developer tier is 10 users and non-production**, and cannot be grown into. Orgs are
   deactivated after 180 days of inactivity per the pricing page and 90 days per the signup page — the
   two Okta pages disagree; treat 90 as the conservative figure.
10. **Rate-limit relief is bought on Customer Identity** (DynamicScale, unpriced), though Workforce
    gets automatic 5× and 10× multipliers at 10,000 and 100,000 licences
    ([developer.okta.com/docs/reference/rl2-increase](https://developer.okta.com/docs/reference/rl2-increase/)).

### 21.4 Clerk

Source for every price in this subsection: [clerk.com/pricing](https://clerk.com/pricing), verified
live 2026-09-17.

**Metering unit.** Clerk does **not** meter MAU. It meters **MRU — Monthly Retained Users**, and the
page defines it as: "A user only counts as retained if they return to your app at least 24 hours after
signing up." A signup that never comes back is never billed. Organizations are a second, independent
meter — **MRO, Monthly Retained Organizations**: an organization with at least 2 members where at
least one is a retained user that month.

#### Plan table

| Plan | Base price | Included MRU | MRU overage | Included MRO | MRO overage |
| --- | --- | --- | --- | --- | --- |
| **Hobby** (free) | $0 | 50,000 per app (**hard cap** — must upgrade past it) | n/a | 100 per app | n/a (cap) |
| **Pro** | $25/mo, **$20/mo billed annually** | 50,000 per app | $0.02 (50,001–100k) → $0.018 (100,001–1M) → $0.015 (1M–10M) → $0.012 (10M+) | 100 per app | requires the B2B add-on; then $1 → $0.90 → $0.75 → $0.60 |
| **Business** | $300/mo, **$250/mo billed annually** | 50,000 per app | same tiers as Pro | 100 per app | same as Pro |
| **Enterprise** | **Custom — not published.** Annual billing only | committed-use | negotiated | negotiated | negotiated |

Allowances are **per application, and applications are unlimited on every plan**. Dashboard seats:
Hobby and Pro up to 3; Business 10 included, then $20/mo each.

**What each tier unlocks**

- **Hobby** — 50,000 MRU/app, 100 MRO/app, custom domain, device tracking and revocation, account
  lockout, bot protection, webhooks, custom JWT templates, machine auth at full paid quotas, full data
  export, 1-day log retention. Excluded: removing the "Secured by Clerk" watermark, MFA, passkeys,
  biometric sign-in, SMS codes (entirely unavailable, not merely metered), enterprise connections,
  user bans, allowlist/blocklist, simultaneous sessions, satellite domains, and custom session
  duration — Hobby is **hard-fixed at a 7-day session lifetime**. Social connections cap at 3.
- **Pro** — MFA, passkeys, biometrics, unlimited social connections, custom session duration
  (5 minutes to 10 years), simultaneous sessions, satellite domains, user bans, allowlist/blocklist,
  waitlist, custom password requirements, custom email templates, branding removal, and enterprise
  SSO (1 connection included).
- **Business** — adds the SOC 2 report, Admin Logs (the workspace audit trail), 10 dashboard seats and
  priority email support.
- **Enterprise** — **contact sales.** Adds a 99.99% uptime SLA, enterprise SSO for the Clerk workspace
  itself, premium support SLA with a dedicated Slack channel, custom log retention, log sink
  destinations, **HIPAA with a BAA**, and migration support. Data residency is *not* advertised on the
  pricing page — treat it as a sales conversation rather than assuming it.

**Add-ons and metered extras**

| Item | Price |
| --- | --- |
| **B2B Authentication — base** | **$0, included in all plans.** 100 MRO/app, up to 20 members per Organization, Admin and Member roles, custom permissions, invitation emails |
| **B2B Authentication — Enhanced** | **$100/mo ($85/mo annually).** Unlimited members per Organization, **linking enterprise connections to Organizations** (org-scoped SSO), Verified Domains and Automatic Invitations, Custom Roles and RoleSets, and MRO metering above 100 |
| **Administration — base** | **$0, included in all plans.** 5 user impersonations per month |
| **Administration — Enhanced** | **$100/mo ($85/mo annually).** Unlimited user impersonations — that is the entire delta |
| **Enterprise connections (SAML / OIDC / EASIE)** | 1 included per app on Pro and Business, then **graduated**: $75/mo each for connections 2–15, $60/mo for 16–100, $30/mo for 101–500, $15/mo for 501+. Not available on Hobby. **Directory Sync (SCIM) is included with a connection at no extra charge** ([changelog 2026-04-16](https://clerk.com/changelog/2026-04-16-directory-sync)) |
| Satellite domains | **$10/mo each** (Pro and Business only) |
| Clerk Billing (charging your own users) | **0.7% of billing volume**, no base fee, on every plan — on top of Stripe's 2.9% + $0.30, so ≈3.6% + $0.30 all-in ([clerk.com/billing](https://clerk.com/billing)) |
| SMS (auth codes), US and Canada | **$0.01 per SMS** |
| SMS, international | "market rate" — **unpublished**, varies by destination |
| API key creations / verifications | 1,000/mo then $0.001 each; 100,000/mo then $0.00001 each |
| M2M token creations / verifications | 2,500/mo then $0.001 each; 100,000/mo then $0.00001 each |

**Gotchas (Clerk)**

1. **The add-on lineup in most third-party comparisons is stale.** Clerk restructured on 2026-02-05:
   the **"Enhanced Authentication" add-on was removed entirely** and its features — MFA, satellite
   domains, simultaneous sessions — were folded into the Pro plan
   ([changelog 2026-02-05](https://clerk.com/changelog/2026-02-05-new-plans-more-value)). Only two paid
   "Enhanced" add-ons remain, **B2B Authentication** and **Administration**, at $100/mo each. Any
   article describing three "Enhanced" add-ons is describing a model that no longer exists.
2. **MRU is not MAU.** Clerk's number is structurally lower than a true MAU count because day-one-only
   users are free. Any head-to-head against a per-MAU vendor flatters Clerk unless you normalise, and
   the correction factor depends entirely on your signup-to-retention curve.
3. **50,000 MRU on Hobby is a cap, not an overage tier.** Cross it and you are *required* to upgrade,
   with a one-month grace period. Same for 100 MRO.
4. **B2B is a two-step paywall.** Basic organizations are free, but 21+ members per org, custom roles,
   verified domains, auto-join and org-scoped SSO all need the $100/mo add-on — *and* that add-on is
   what switches MRO metering on, so crossing 100 organizations costs $100/mo before the first $1 of
   overage.
5. **The 4th dashboard seat costs $250–300/mo**, because it forces the Business plan. This is the
   sharpest single cliff in Clerk's pricing and is unrelated to user count.
6. **The Administration Enhanced add-on is $100/mo for exactly one thing** — impersonations above
   5 per month.
7. **SOC 2 is Business-gated and HIPAA is Enterprise-gated.** If procurement needs the SOC 2 report,
   your floor is $250/mo regardless of how few users you have.
8. **Hobby has no SMS authentication at all**, and its 7-day session lifetime is fixed.
9. **International SMS is "market rate"** — an unbounded, unpublished pass-through.
10. **Clerk Billing has no tax/VAT handling**, is USD-only, and is unavailable in Brazil, India,
    Malaysia, Mexico, Singapore and Thailand ([docs](https://clerk.com/docs/guides/billing/overview)).
11. **Rate limits are instance-scoped, not plan-scoped.** Paying more does not raise the Backend API
    ceiling; only promoting a dev instance to production does (100 → 1,000 requests per 10 seconds)
    ([system limits](https://clerk.com/docs/guides/how-clerk-works/system-limits)).
12. **The docs and the pricing page disagree on free MRO** — the organizations guide says 50 in
    development and 100 in production, the pricing page says 100 per app.

### 21.5 Better Auth

**Metering unit: none for the framework.** Better Auth's own pricing page states it directly: "The
Better Auth framework is free and open source. Pricing below is for our managed infrastructure."
([better-auth.com/pricing](https://better-auth.com/pricing)). The framework is MIT
([LICENSE.md](https://github.com/better-auth/better-auth/blob/main/LICENSE.md)), and every first-party
package checked is MIT, including `@better-auth/sso`, `@better-auth/scim`, `@better-auth/stripe` and
even `@better-auth/infra` itself. **There is no per-MAU, per-user, per-session, per-organization or
per-application charge, and no paid tier of the framework.** SSO/SAML, SCIM, organizations, MFA,
passkeys, admin/impersonation, API keys, the OAuth 2.1 provider and device authorization are all free
OSS plugins.

**Better Auth was acquired by Vercel, announced 2026-07-07**
([better-auth.com/blog/better-auth-joins-vercel](https://better-auth.com/blog/better-auth-joins-vercel),
[vercel.com/blog/vercel-acquires-better-auth](https://vercel.com/blog/vercel-acquires-better-auth)).
Both posts commit to the library staying free, MIT, same name and same contribution model.

#### Infrastructure tiers — the only thing Better Auth sells

| Tier | Price | Included | Overage |
| --- | --- | --- | --- |
| **Framework** | **$0, MIT, unlimited users** | Everything in the OSS repo and all plugins | n/a |
| **Infrastructure Starter** | **$0/month** | 1 dashboard seat; 10,000 audit logs/mo at **1-day retention**; 1,000 security detections/mo; community support | No transactional email or SMS. No self-service SSO or Directory Sync |
| **Infrastructure Pro** | **$20/month** | Unlimited seats; 20,000 audit logs/mo at **7-day retention**; 10,000 security detections/mo; 1 self-service SSO connection; 1 Directory Sync connection; email templates and abuse protection; email support | Audit logs **$0.0001/event**; detections **$0.001/event**; SSO and Directory Sync **$50/mo per extra connection**; email **$0.001 each**; SMS **$0.09 each** |
| **Infrastructure Enterprise** | **Custom — not published, "Contact Us"** | Custom usage and retention; custom domain and log drain included; Dashboard RBAC; Slack support and implementation help; custom MSA and DPA | — |

Pro add-ons: custom dashboard domain **$25/month**, log drain **$25/month**; both included on
Enterprise. Note the price is **flat $20/month regardless of user count** — there is no MAU dimension
anywhere in Better Auth's commercial pricing.

**What Infrastructure buys**: `dash()` connects a self-hosted instance to a hosted control plane for
user management, session monitoring, analytics and audit-log querying; Audit Logs are automatic once
`dash()` is installed and are the metered unit; `sentinel()` covers credential-stuffing protection,
impossible-travel detection, device-fingerprint trial-abuse prevention, HIBP checks, geo-blocking,
bot and suspicious-IP blocking and velocity limiting; Managed Email and Managed SMS are Pro-and-above
transactional services; and self-service SSO/Directory Sync is the *hosted customer-facing
configuration UI*, which is distinct from the free OSS SSO and SCIM plugins.

**Real cost line items when self-hosting** — none of these are charged by Better Auth: your database
(session rows scale with MAU × devices × session lifetime, and every request hits the session table
unless cookie cache is on); compute (scrypt password hashing is deliberately CPU-expensive, so sign-in
throughput sizes the box, not user count); email delivery; SMS; captcha (Cloudflare Turnstile is free
at typical volumes); breached-password checks (HIBP's k-anonymity range API is free); observability;
and **engineering time for schema migrations, security-advisory triage and on-call, which appears on no
invoice**. A concrete example of that last cost: the 1.7 `account` schema change broke upgrades and
needed a dedicated remediation post and a 1.7.3 fix
([blog](https://better-auth.com/blog/1-7-account-schema)).

**Gotchas (Better Auth)**

1. **"Free" is real for the framework — MIT, no MAU meter, no gated features, no CLA-based dual
   licence — but it is not free of cost.** The bill moves from a vendor invoice to your cloud bill and
   your headcount.
2. **The Infrastructure npm package is MIT but the service behind it is not open.** `@better-auth/infra`
   is MIT, its backing repo returns 404 on the GitHub API (i.e. private), and the `dash()` plugin talks
   to `dash.better-auth.com` and `kv.better-auth.com`. **You cannot self-host the dashboard, Sentinel
   or the audit-log store** — it is an open SDK over a closed hosted service.
3. **Adding `dash()` sends auth events off your infrastructure**, which partly undercuts the "own your
   auth" position and matters in any data-residency review.
4. **No SLA, no published SOC 2, no HIPAA BAA** anywhere in the product. This is the sharpest contrast
   with Clerk Business/Enterprise and with Auth0 Enterprise.
5. **The Vercel acquisition cuts both ways.** It is good for the framework's longevity, and ambiguous
   for the paid Infrastructure layer given the founder's stated intent to refocus "without having to
   shape the strategy around monetization". The pricing page is live and self-serve today; treat
   Infrastructure as a product with an uncertain long-term roadmap.
6. **Sentinel's plan gate is documented inconsistently** — getting-started says Pro or above, while the
   pricing page grants Starter 1,000 detections/month. Verify in-dashboard before relying on it at $0.
7. **Managed SMS at $0.09 is the most expensive SMS in this comparison** — 9× Clerk's $0.01 US/Canada
   rate and roughly 7× Twilio's all-in US rate. Bring your own SMS provider if you need volume.
8. **Audit-log retention is 1 day on Starter and 7 days on Pro**, which will not satisfy most
   compliance asks without the unpublished Enterprise tier.
9. **`@better-auth/stripe` takes 0%** of your billing volume, which is the direct contrast with Clerk
   Billing's additional 0.7%.

### 21.6 What a given scale actually costs

Two scenarios, each at roughly 1,000 / 10,000 / 100,000 monthly active users. **Every figure is a
monthly, list-price, monthly-billing estimate**; annual billing changes it (Auth0 annual is 11× the
monthly price, Clerk annual is roughly 17% off, Okta is annual-only). Arithmetic and assumptions are
in the footnotes below each table. "Contact sales" means the published ladder ends before that
scale — it is never a number we invented.

#### Scenario A — B2C consumer app

No organizations, no enterprise SSO. Email/password plus social plus passkeys, TOTP MFA, and SMS OTP
for 10% of monthly actives once each.

| | 1,000 MAU | 10,000 MAU | 100,000 MAU |
| --- | --- | --- | --- |
| **Auth0** (B2C Essentials) | **$70** [A1] | **$700** [A1] | **Contact sales** [A2] |
| **Auth0** (B2C Professional) | **$240** | **$1,600** | **Contact sales** [A2] |
| **Auth0** (Free, if its limits fit) | $0 | $0 | n/a — Free caps at 25,000 MAU |
| **Okta — Customer Identity** | **$3,000 known + B2C Suite contact sales** [A3] | **$3,000 known + B2C Suite contact sales** [A3] | **$3,000 known + B2C Suite contact sales** [A3] |
| **Okta — Workforce Identity** | not applicable [A4] | not applicable [A4] | not applicable [A4] |
| **Clerk** (Pro) | **≈$26** [A5] | **≈$35** [A5] | **≈$1,125** [A6] |
| **Clerk** (Hobby, if its limits fit) | $0 — but no MFA, no SMS, 7-day sessions, Clerk watermark | $0 — same caveats | n/a — Hobby caps at 50,000 MRU |
| **Better Auth** (infrastructure, not $0) | **≈$21** [A7] | **≈$58–73** [A8] | **≈$245–570** [A9] |
| **Better Auth** + Infrastructure Pro | **≈$41** | **≈$78–93** | **≈$293–618** [A10] |

**Footnotes — Scenario A**

- **[A1]** Straight from the published B2C Essentials ladder: 1,000 MAU = $70/mo, 10,000 MAU =
  $700/mo, a flat $0.07/MAU. B2C Professional: $240 and $1,600. Auth0's Free plan genuinely covers
  both of these scales at $0 if you do not need RBAC, account linking, MFA beyond the basics,
  breached-password detection, more than 1 tenant or more than 1-day log retention.
- **[A2]** **Contact sales.** *Known:* the B2C Essentials ladder is published only to 50,000 MAU
  ($3,500/mo), and B2C Professional is "Contact us" above 20,000 MAU ($3,200/mo). *Unknown:* every
  rate above those points, and all of Enterprise. The $0.07/MAU Essentials rate is flat across the
  published range but Auth0 does not commit to it beyond 50,000, so extrapolating to $7,000/mo would
  be a guess.
- **[A3]** *Known:* the $3,000/month base platform is mandatory at every scale, annual contract, and
  is identical whether you have 1,000 or 100,000 MAU. *Unknown:* the B2C Suite, which is MAU-metered
  on top and unpublished at every scale. The floor is therefore $36,000/year before the first MAU is
  priced.
- **[A4]** Workforce Identity is licensed per employee for federating *your staff into apps*. Pricing
  a consumer app on it is a category error — 100,000 consumers at Starter's $6/user/mo list would be
  $600,000/mo, which is precisely why Okta sells Customer Identity separately.
- **[A5]** Clerk Pro base $25/mo covers 50,000 MRU, so both 1,000 and 10,000 users sit inside the
  included allowance and the base price does not move. Added: SMS at 10% of actives × 1 message ×
  $0.01 = $1 and $10. **This assumes MRU = MAU at par, which overstates Clerk** — a user who signs up
  and never returns is not billed, so real MRU is below MAU by whatever your day-one churn is.
- **[A6]** Clerk Pro $25 + MRU overage (100,000 − 50,000 included) × $0.02 = $1,000 + SMS 10,000
  messages × $0.01 = $100. Total $1,125/mo. On annual billing the base drops to $20, giving $1,120.
- **[A7]** Database: a Neon Launch 0.25 CU autoscaling compute ≈ 0.25 × 730h × $0.106 = $19.35 plus a
  few GB at $0.35/GB-month ([neon.com/pricing](https://neon.com/pricing)) ≈ $20. Email: ~1,000–2,000
  messages/mo fits Resend's free 3,000 ([resend.com/pricing](https://resend.com/pricing)) = $0. SMS:
  100 messages × Twilio's US all-in $0.0118–$0.0133 ([twilio.com](https://www.twilio.com/en-us/sms/pricing/us))
  ≈ $1.30. Captcha (Turnstile) and HIBP breached-password checks = $0. Compute assumed marginal
  because auth runs inside an app you already host. **Total ≈ $21.**
- **[A8]** Database $25–40 (larger compute, more session-table write volume). Email: ~10,000–20,000
  messages → Resend Pro $20. SMS: 1,000 × $0.0118–$0.0133 ≈ $13. **Total ≈ $58–73.**
- **[A9]** Database $80–250 (session rows scale with MAU × devices × session lifetime; the range
  reflects whether cookie cache is enabled). Dedicated compute for the auth path $20–100 (scrypt
  hashing is CPU-bound on sign-in throughput). Email: ~100,000–200,000 messages → Resend $35–90.
  SMS: 10,000 × $0.0118–$0.0133 ≈ $130. **Total ≈ $245–570.**
- **[A10]** Infrastructure Pro is $20/mo flat plus audit-log overage. Assuming 3 audit events per MAU
  per month, 100,000 MAU = 300,000 events; (300,000 − 20,000 included) × $0.0001 = $28. **Total add-on
  ≈ $48.**
- **Not in any Better Auth row: engineering time.** Schema migrations on upgrade, security-advisory
  triage, and on-call for the auth path. As an illustration rather than a vendor figure: a quarter of
  an engineer-day per month at a fully loaded $100/hour is ~$200/mo, which exceeds the entire
  infrastructure bill at the 1,000 and 10,000 MAU scales.

#### Scenario B — B2B SaaS with enterprise SSO and organizations

**20 enterprise customers each needing SAML or OIDC SSO.** Organizations/multi-tenancy throughout, at
roughly 10 users per organization (so 100 / 1,000 / 10,000 organizations). Procurement requires a
SOC 2 report, and more than 3 people need dashboard access.

| | 1,000 MAU | 10,000 MAU | 100,000 MAU |
| --- | --- | --- | --- |
| **Auth0** (B2B Essentials + connections) | **$2,000** [B1] | **$3,800** [B1] | **Contact sales** [B2] |
| **Auth0** (B2B Professional + connections) | **$2,300** [B3] | **$3,900** [B3] | **Contact sales** [B2] |
| **Okta — Customer Identity** | **$3,000 known + B2B Suite contact sales** [B4] | **$3,000 known + B2B Suite contact sales** [B4] | **$3,000 known + B2B Suite contact sales** [B4] |
| **Clerk** (Business + B2B add-on + 20 connections) | **$1,750** [B5] | **$2,650** [B6] | **$11,750** [B7] |
| **Better Auth** (infrastructure only; SSO is free OSS) | **≈$21** [B8] | **≈$58–73** [B8] | **≈$245–570** [B8] |
| **Better Auth** + hosted self-service SSO for all 20 | **≈$991** [B9] | **≈$1,028–1,043** [B9] | **≈$1,215–1,540** [B9] |

**Footnotes — Scenario B**

- **[B1]** B2B Essentials at 1,000 MAU = $300/mo and includes 3 enterprise connections; 17 more at
  $100/mo = $1,700. Total $2,000. At 10,000 MAU the base is $2,100, so $2,100 + $1,700 = $3,800. Add
  $100/mo if you also need Enterprise MFA factors, which are an add-on on B2B Essentials. **There is
  no per-organization fee on any Auth0 plan**, and B2B Essentials includes unlimited Organizations —
  the org count in this scenario costs nothing.
- **[B2]** **Contact sales.** *Known:* enterprise connections remain $100/mo each with a **hard cap of
  30 total**, and B2B Essentials is published to 20,000 MAU ($3,800/mo). *Unknown:* the MAU rate above
  20,000 (Essentials) and above 10,000 (Professional), and all of Enterprise. A vendor with more than
  30 SSO customers cannot stay on self-service pricing at any price.
- **[B3]** B2B Professional at 1,000 MAU = $800 and includes 5 connections; 15 more at $100 = $1,500.
  Total $2,300. At 10,000 MAU the base is $2,400, so $2,400 + $1,500 = $3,900. Enterprise MFA factors
  are included here rather than an add-on. Note that **Security Center is Enterprise-only on the B2B
  table** even at these prices, and **no Auth0 plan below Enterprise carries an SLA**.
- **[B4]** *Known:* the mandatory $3,000/month base platform and its annual contract, unchanged at
  every scale. *Unknown:* the B2B Suite (which is where inbound federation, Identity Governance and
  Lifecycle Management live) and every add-on. Structurally, Okta charges **nothing per SSO
  connection** — the meter is users and suites, so 20 enterprise customers and 200 cost the same in
  connection terms.
- **[B5]** Clerk Business $300 (required here for the SOC 2 report and more than 3 dashboard seats) +
  B2B Authentication Enhanced $100 (required to attach enterprise connections to Organizations, and
  for verified domains, custom roles and orgs above 20 members) + 20 enterprise connections: 1
  included, connections 2–15 at $75 = $1,050, connections 16–20 at $60 = $300, so $1,350. MRO: 100
  organizations sits exactly at the included allowance, so $0. **Total $1,750.** On Pro instead of
  Business it would be $1,475, but Pro has no SOC 2 report and caps at 3 dashboard seats.
- **[B6]** $300 + $100 + $1,350 connections + MRO overage (1,000 − 100 included) × $1 = $900.
  **Total $2,650.**
- **[B7]** $300 + $100 + $1,350 connections + MRU overage (100,000 − 50,000) × $0.02 = $1,000 + MRO
  overage: 900 organizations at $1 = $900 and 9,000 at $0.90 = $8,100, so $9,000. **Total $11,750.**
  At this scale Clerk's committed-use Enterprise plan is the realistic path and its price is
  unpublished — the $11,750 is the list-price ceiling, not a quote. Note that the organization meter,
  not the user meter, contributes 77% of this bill.
- **[B8]** Identical to Scenario A's Better Auth infrastructure line, because **`@better-auth/sso` and
  `@better-auth/scim` are MIT and free** — 20 enterprise connections cost the same as zero. What this
  row does not buy at any price: an SLA, a SOC 2 report or a HIPAA BAA, none of which Better Auth
  publishes. In a B2B enterprise sale that is a procurement blocker rather than a pricing question.
- **[B9]** Only if you want *your customers* to configure their own SSO through Better Auth's hosted
  UI rather than configuring connections yourself: Infrastructure Pro $20 + 19 extra connections ×
  $50/mo = $950, so $970 on top of the infrastructure line. Building the equivalent self-service UI
  yourself is the $0 alternative and costs engineering time instead.

#### Enterprise SSO at 20 connections — the line item that dominates Scenario B

The four products price enterprise SSO on four different principles, and at 20 connections the spread
is roughly $0 to $1,700 per month for the *same* capability.

| Product | Model | Marginal cost of 20 enterprise SSO connections |
| --- | --- | --- |
| **Auth0 B2C** (Essentials / Professional) | Enterprise connections read *not available* | **Not purchasable at any price.** You must move to a B2B plan or to Enterprise |
| **Auth0 B2B Essentials** | Counted against the plan, then $100/mo each | 3 included, 17 × $100 = **$1,700/mo** ($18,700/yr). **Hard cap of 30** |
| **Auth0 B2B Professional** | Counted against the plan, then $100/mo each | 5 included, 15 × $100 = **$1,500/mo** ($16,500/yr). Same 30 cap |
| **Clerk Pro / Business** | Per connection, graduated | 1 included, 14 × $75 + 5 × $60 = **$1,350/mo**, plus **$100/mo** for B2B Authentication Enhanced to scope those connections to Organizations = **$1,450/mo** |
| **Okta Customer Identity** | Bundled into a per-user suite — no per-connection charge | **$0 marginal.** Inbound federation is part of the unpublished B2B Suite, on top of the $3,000/mo base. 20 customers and 200 cost the same |
| **Okta Workforce Identity** | n/a | Not applicable — Workforce SSO federates *your employees into apps*, not your customers into your product |
| **Better Auth** | Free OSS plugin | **$0.** `@better-auth/sso` is MIT with no connection limit. $970/mo only if you buy the hosted self-service configuration UI instead of building it |

Two consequences worth naming. First, Clerk is marginally cheaper than Auth0 per connection at 20,
but its **per-organization meter** then dominates at high org counts, where Auth0 charges nothing per
organization — the ranking inverts depending on whether your B2B customers are few and large or many
and small. Second, Auth0's hard cap of 30 connections and Clerk's continued $15–$30 tiers out to 500+
mean the two products stop being comparable above ~30 enterprise customers: one requires an
Enterprise contract, the other keeps metering.

### 21.7 Pricing gotchas across all four

1. **Four units, no common denominator.** MAU (Auth0), MRU plus a second MRO meter (Clerk), per user
   per month per SKU on an annual contract (Okta), and nothing-for-the-framework plus event metering
   (Better Auth). Headline numbers are not comparable without rebuilding them against your own usage
   shape, which is what section 21.6 does.
2. **MRU is structurally below MAU, so par-value comparisons flatter Clerk.** Clerk excludes a user
   who never returns after signup day; Auth0 counts silent authentication and refresh-token exchanges
   as activity. The gap between the two numbers is your day-one churn rate, which no vendor publishes
   for you.
3. **Tier-jump versus smooth overage.** Auth0 states "If usage falls between tiers, you are billed at
   the next tier up" — one user over the line takes 10,000 B2C Essentials MAU from $700 to $1,400.
   Clerk meters per unit. Okta is annual-committed, so overshoot is a true-up conversation rather than
   a line on next month's invoice.
4. **Every published ladder runs out before 100,000 users.** Auth0 publishes to 50,000 B2C Essentials
   MAU and 20,000 B2B Essentials MAU; Okta publishes $6/$14/$17 Workforce suites and a $3,000/mo CIAM
   base and nothing else; Clerk publishes overage rates but not Enterprise. At 100,000 users, all
   three commercial products have at least one "contact sales" component.
5. **Compliance artefacts are plan-gated, not usage-gated.** Clerk's SOC 2 report starts at Business
   ($250–300/mo) no matter how few users you have, and HIPAA is Enterprise-only. Auth0's SLA is
   Enterprise-only — Professional at $3,200/mo has none. Better Auth publishes no SLA, no SOC 2 and no
   HIPAA BAA at all. A procurement checklist can set your floor price independently of scale.
6. **Seats, tenants and organizations are separate meters from users.** Clerk's 4th dashboard seat
   forces Business, a ~$275/mo step; Auth0's tenant allowance is 1/3/12/unlimited; Clerk's MRO meter
   can exceed its MRU meter on a B2B bill. None of these appear in a per-user comparison.
7. **Log retention is the shared upsell across all four.** Auth0 runs 1/5/10/30 days with 0/1/2/2 log
   streams; Clerk Hobby is 1 day and Admin Logs are Business+; Better Auth Infrastructure is 1 day on
   Starter and 7 on Pro. If you need audit history, you are paying for retention or egress somewhere.
8. **Percentage add-ons scale with your bill, not with a fixed fee.** Auth0 for AI Agents is **+50% of
   base plan price**, so it grows with your MAU tier. Clerk Billing is 0.7% of billing volume on top
   of Stripe's 2.9% + $0.30. Better Auth's Stripe plugin takes 0%.
9. **Unpublished prices cluster exactly where the money is.** Auth0: FGA, Adaptive MFA, Bot Detection,
   Private Deployment, Highly Regulated Identity and all of Enterprise. Okta: every per-SKU price,
   both Customer Identity suites, DynamicScale, and Professional and Enterprise Workforce. Clerk:
   Enterprise and international SMS. Better Auth: Infrastructure Enterprise. The free and entry tiers
   are transparent; the tiers you graduate into are not.
10. **Annual discounts lock a year.** Auth0 annual is 11× monthly (one month free); Clerk annual is
    ~17% off ($20 vs $25, $250 vs $300, $85 vs $100 on add-ons); Okta is annual-only with a $1,500
    minimum and no month-to-month option at all.
11. **Bring-your-own SMS is not automatically cheaper.** Twilio's US all-in rate is $0.0118–$0.0133
    per message once carrier fees are added, *above* Clerk's flat $0.01. Better Auth's managed $0.09 is
    the outlier in the other direction. International SMS is unpublished at every vendor.
12. **Third-party price lists are systematically stale.** Clerk's three-"Enhanced"-add-on model was
    removed on 2026-02-05 and is still quoted widely; Okta stopped publishing per-SKU prices, so every
    circulating $2-SSO figure is folklore; Auth0's B2B plans were overhauled on 2026-02-12 and the
    pricing page was restructured into B2C/B2B toggles on 2026-07-17. Verify against the vendor page,
    dated.
13. **Free tiers are not comparable to each other.** Auth0 gives 25,000 MAU in production; Clerk gives
    50,000 MRU per app in production with a mandatory watermark and no MFA or SMS; Okta's Integrator
    plan is 10 users and non-production and cannot be grown into; Better Auth has no user limit
    because there is no meter. The same company (Okta) offers both the most and the least generous
    free tier here, under two different product names.
14. **Self-hosting moves cost off the invoice, not out of the budget.** Better Auth's $0 licence is
    real, but database, compute, email, SMS, abuse defence and — above all — engineering time for
    migrations, advisory triage and auth-path on-call are the actual cost, and only the first five of
    those ever appear as a number anyone can quote you.
