# ADR-016: Hosted Sign-In UI and Branding

## Status

**Proposed** - 2026-09-18

## Background

The authorization endpoint redirects a request that carries no usable session to a page where a
person proves who they are. Every M1 flow arrives there: an authorization code exchange, a
sign-up, an address verification, a password reset, a consent grant. The endpoints that redirect
exist. The pages they redirect to do not.

Those pages are served by the Worker on the tenant's own hostname, under the tenant's own issuer.
They are the only part of the product an end user ever sees, they carry a tenant's name in front
of that tenant's customers, and a mistake on them is a password typed into a page that does not
look like the brand the person trusts.

## Context

### Branding wants a token overlay, not a template language

A customizable hosted page conventionally means a templating language: markup the customer writes,
interpolated and rendered by the vendor. That buys arbitrary layout and costs a parser, a sandbox,
an escaping contract on a credential page, and a language whose bugs belong to the platform.

What customers reach for that editor to change is almost always colour, logo, corner radius and
typeface. Those are values, not markup, and a design system whose every colour, radius and
measurement is already a CSS custom property turns the customization surface into a list of
declarations.

### A hosted page is a public form, or it is a cage

Hosted screens fit until they do not, and a component library shipped as the escape hatch is a
second product to version and support across every framework a customer might pick. The
alternative costs nothing extra: the endpoints the screens post to are the product's own public
interface, reachable from any origin a tenant controls, so a tenant that outgrows the screens
replaces them without asking for anything new.

### The pages must work before JavaScript does

A sign-in page that fails when a script does not load fails closed on the one flow the customer is
paying for. Server-rendered HTML with native form submission works behind a locked-down browser, a
corporate proxy, and the first paint of a slow connection. WebAuthn is the exception — a passkey
ceremony has no markup-only form — so it gets a hydrated island, with password and magic-link
sign-in still reachable when that island does not run.

## Decision

The screens are rendered by the Worker from `@sdxc/ui`, served under `/u/` on the tenant's
hostname. A tenant's identity is a record of design tokens in the control plane, applied as
custom-property declarations for the tenant whose entitlement grants branding.

### The screen set

| Path | Screen |
| --- | --- |
| `/u/sign-in` | Identifier and password, passkey, magic link, configured social providers |
| `/u/sign-up` | Registration, legal acknowledgement, the tenant's required profile fields |
| `/u/verify` | Address confirmation landing, and the resend control |
| `/u/reset` | Request a reset, and the set-a-new-password form the emailed link lands on |
| `/u/consent` | The scopes a client is asking for, granted or refused |
| `/u/error` | A terminal protocol failure with a correlation id |

Each screen is one `<form>` and one POST to its own path. The flow state a screen resumes into —
the pending authorization request, its redirect target, its PKCE challenge — stays server-side
against the session rather than in a field a person can edit.

### Built from `@sdxc/ui`

`@sdxc/ui` is the right basis and is used directly. It renders `remix/ui` components as server
HTML with no hydration; `Form` takes the issues from a `parseSafe` result and each field beneath
reads its own errors by name; overlays ride native `<dialog>` and the Popover API rather than a
script; and `prefers-reduced-motion`, `prefers-contrast` and `prefers-reduced-transparency` are
answered centrally. Its theme derives every `--ui-*` semantic variable from five palette scales,
which is exactly the surface branding needs. `@sdxc/u` covers the rare element the catalog has no
component for, and the passkey island is `@sdxc/passkey`'s browser client via `clientEntry`.

### The brand record is control-plane state

Branding is read on every page render and never in the context of a subject, so it lives in D1
beside the tenant registry and rides the hostname resolution cache in KV, leaving a sign-in page
with zero round trips to the tenant object.

```sql
tenant_brand(tenant_id PK, logo_key, favicon_key, palette_json, radius_scale,
             font_family, font_src, custom_css, updated_at)
tenant_brand_copy(tenant_id, locale, screen, key, value,
                  PRIMARY KEY(tenant_id, locale, screen, key))
```

`palette_json` holds the five scales the theme derives from — brand, neutral, danger, warning,
success — validated as `oklch()` triples on write. `logo_key` and `favicon_key` address objects in
R2 that the Worker serves from the tenant's hostname, so `img-src 'self'` holds and a brand asset
never invites a third-party origin onto the page.

`custom_css` is served as its own stylesheet at `/u/brand.css` and linked rather than inlined. It
is parsed and re-serialized on save, keeping declarations, `@media`, `@supports`, `@layer` and
`@font-face` and requiring every `url()` to be `https:`, so `style-src 'self'` needs no
`unsafe-inline`.

### The tier split

The brand record is editable, validated and stored on every tier including Free; the entitlement
gates whether the render applies it, so a downgrade stops painting a tenant's colours and destroys
none of their configuration.

| | Free | Pro | Premium |
| --- | --- | --- | --- |
| The six screens, every flow | Yes | Yes | Yes |
| Localization, RTL, accessibility | Yes | Yes | Yes |
| Tenant name and default theme | Yes | Yes | Yes |
| Platform attribution in the footer | Shown | Dropped | Dropped |
| Logo, favicon, palette, radius, typeface | Stored | Stored | Applied |
| Custom stylesheet and per-screen copy | Stored | Stored | Applied |

Two predicates read the entitlement projection published by *Entitlements as Feature Flags*:
`unbranded_pages` drops the platform's name from the footer, and `branding` paints the brand record
over the default theme. Until that ADR lands the projection grants nothing, which is the Free
rendering. Security behaviour is identical across tiers: the screens paywall appearance, never a
factor.

### Localization and accessibility

`@sdxc/i18n` middleware publishes the request's i18next instance and `context.locale`, and every
visible string comes from `app/locales`. The locale resolves in one order: the authorization
request's `ui_locales`, the subject's stored preference once known, `Accept-Language`, the
tenant's default, then `en`. A tenant's `tenant_brand_copy` rows merge over the shipped bundle per
locale, so an override replaces one string. `<html lang>` and `dir` follow the resolved locale and
layout is written in logical properties, so a right-to-left locale mirrors.

WCAG 2.2 AA is the target and the screens are tested against it. Every control is a native one
with a `<label>`; supporting copy and validation messages reach it through `aria-describedby` with
stable ids; a failed submission renders an error summary that takes focus and links to the first
invalid field; and the credential fields carry their `autocomplete` tokens.

### Full control, and what the object is asked for

The platform publishes no UI package. Every hosted screen posts to an endpoint that is part of the
documented public interface, with documented field names, error codes and redirect behaviour. A
tenant that wants every pixel hosts its own pages against those same endpoints, giving up nothing
but the screens, which are privileged over no other client of that interface.

This ADR adds no methods to the tenant object. The screens render control-plane state and submit
to the operations owned by *Password Credentials*, *Passkeys*, *Sessions* and *Consent and
Scopes*; a screen wanting a method of its own would be holding logic that belongs behind the
boundary.

## Consequences

### Positive

- The most-requested page in the product renders from the Worker and KV alone.
- Customization has no language to parse, sandbox or version: a brand is a list of validated
  values, rejected at the edit rather than at the render.
- The screens work with scripts disabled, on the browsers least likely to be the customer's own.
- A tenant outgrows the hosted screens through a documented interface, not a component library.
- A downgrade stops applying a brand and preserves it, so a lapsed renewal is not a data loss.

### Negative

- A design-token surface cannot express a layout a customer imagines; the answer to "move the logo
  above the card" is the escape hatch rather than a setting.
- A tenant stylesheet brings a parser that has to stay correct: a permissive bug in it is a
  stored-content problem on a page that receives passwords.
- Serving brand assets from the tenant hostname adds R2 to the platform's storage surface.
- A locale a tenant needs and the platform has not shipped is a copy override per string.

### Neutral

- The passkey island is the one place a screen depends on client JavaScript, and it degrades to
  the other factors rather than to an error.

## Alternatives Considered

**A templating language on the hosted page.** Liquid or Handlebars over the page markup, which is
what the incumbents offer and what a customer migrating from one expects. It costs a parser, an
escaping contract on a credential page, and a language the platform versions forever. Rejected in
favour of tokens, with the public form contract answering anyone who needs more.

**A published component library.** Drop-in components rendered inside the customer's own
application, with no redirect. It means shipping a UI package per framework, and it moves the
credential input into the customer's XSS surface. Rejected: the redirect is what lets a new factor
appear without any customer shipping code.

**Branding in the tenant object.** Keeps all tenant configuration behind one boundary, at the cost
of a round trip on the most-requested page in the product, for state never read in the context of
a subject. Rejected.

**Arbitrary HTML and JavaScript on the page.** The most complete customization. Running
tenant-authored script on the origin that receives passwords turns a compromised dashboard
account into a credential harvester. Rejected.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md)
- [ADR-002: Rebuild Path and Implementation Order](./ADR-002-rebuild-path-and-implementation-order.md)
- [ADR-017: Transactional Email](./ADR-017-transactional-email.md) — paints its messages from this brand record
