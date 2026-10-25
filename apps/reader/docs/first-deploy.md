# First deploy

What has to exist before `reader` is deployed to `reader.sergiodxa.com` for the first time, in
the order to do it. Later deploys need only the last section's three commands.

Run every command from `apps/reader`.

## 1. Create the Cloudflare resources

`wrangler.jsonc` names these resources. Two of their ids are placeholders, and wrangler
refuses to deploy against an id the account does not own.

| Resource                | Command                                                                                                           | Then                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| KV namespace `KV`       | `bunx wrangler kv namespace create reader`                                                                        | Paste the id into both `id` and `preview_id`                                 |
| D1 `reader-catalog`     | `bunx wrangler d1 create reader-catalog`                                                                          | Paste the id into `database_id`                                              |
| Unsubscribe signing key | `bunx wrangler secrets-store secret create <store_id> --name READER_UNSUBSCRIBE_SECRET --scopes workers --remote` | Keep the `store_id` in `secrets_store_secrets` if it is this account's store |
| Rate limiter            | None                                                                                                              | Confirm `namespace_id` `2001` is unused by another Worker on the account     |
| Queue `reader-jobs`     | `bunx wrangler queues create reader-jobs`                                                                         | Nothing; the binding names it                                                |

The two Durable Object classes, `UserDO` and `FeedDO` in `app/models/`, are created by the
deploy itself from the `migrations` block. Each object migrates its own SQLite the first time it boots, so the
`database/migrations` chain, `0018-push-vapid-key` included, needs no command.

The account also needs:

- **The `sergiodxa.com` zone**, so the deploy can attach the `reader.sergiodxa.com` custom
  domain.
- **Email sending verified for the domain `EMAIL_FROM` is on.** Without it the email channel
  stays dark; push and the rest of the app work.

## 2. Register the app with its outside services

- **Sign-in.** In the admin area of `auth.sergiodxa.com`, create a confidential client:
  - **Redirect URI** `https://reader.sergiodxa.com/auth`, where sign-in returns.
  - **Logout URI** `https://reader.sergiodxa.com/`, where signing out returns. The provider
    redirects back only to a client's registered logout URI, so without it a reader who signs
    out is left on the provider's page.
  - The scopes `openid`, `profile`, `email` and `offline_access`; the last earns the refresh
    token that keeps a reader signed in past the access token's hour.

  The id and the secret it reveals once are `CLIENT_ID` and `CLIENT_SECRET`.

- **Billing.** In Polar, create the paid and premium products, and add a webhook endpoint at
  `https://reader.sergiodxa.com/webhooks/billing` delivering `checkout.completed`,
  `subscription.activated`, `subscription.updated`, `subscription.canceled`,
  `subscription.revoked`, `order.paid` and `order.refunded`. Note the endpoint's signing secret
  and both product ids.

## 3. Generate the Web Push key pair

Browser notifications are signed with one P-256 key pair for the whole deployment. Generate it
once:

```bash
bun -e 'import { WebPush } from "@sdxc/web-push"; console.log(await WebPush.generateKeys())'
```

Treat the pair as permanent. Every browser subscription is bound to the public key it was made
with, and the app signs with the configured pair only: after a change, every registered browser
stops receiving notifications (its row is kept, and each skipped send is logged as
`push.rejected`) until its reader opens the settings page again, which re-subscribes it under
the new key.

`VAPID_SUBJECT` is a `mailto:` a push service contacts about this sender. Use a real address on
`sergiodxa.com`: Apple's push service refuses a subject it cannot use.

Leaving the three `VAPID_*` values unset is safe: the push channel stays dark, and the settings
page offers no browser to subscribe.

## 4. Set the secrets

Every value in `.env.example` is a Worker secret in production. Set each one; on the first
secret, wrangler offers to create the `reader` Worker so it has somewhere to keep it.

```bash
bunx wrangler secret put CLIENT_ID
```

| Secret                     | Value                                                                      |
| -------------------------- | -------------------------------------------------------------------------- |
| `CLIENT_ID`                | From the OAuth client in step 2                                            |
| `CLIENT_SECRET`            | From the OAuth client in step 2                                            |
| `COOKIE_SESSION_SECRET`    | `openssl rand -base64 32`                                                  |
| `POLAR_ACCESS_TOKEN`       | An organization access token from Polar                                    |
| `POLAR_WEBHOOK_SECRET`     | The webhook endpoint's signing secret from step 2                          |
| `POLAR_PAID_PRODUCT_ID`    | The paid product's id                                                      |
| `POLAR_PREMIUM_PRODUCT_ID` | The premium product's id                                                   |
| `VAPID_PUBLIC_KEY`         | `publicKey` from step 3                                                    |
| `VAPID_PRIVATE_KEY`        | `privateKey` from step 3                                                   |
| `VAPID_SUBJECT`            | `mailto:` an address on `sergiodxa.com`                                    |
| `APP_URL`                  | `https://reader.sergiodxa.com`                                             |
| `EMAIL_FROM`               | An address on the domain verified for sending                              |
| `MEDIA_PROXY_SECRET`       | `openssl rand -base64 32`                                                  |
| `AGENT_TOKEN_SECRET`       | `openssl rand -base64 32`; never the placeholder `.env.example` ships with |
| `WEB_BOT_AUTH_KEY`         | An Ed25519 private JWK, generated and set with the command below           |

`WEB_BOT_AUTH_KEY` signs every feed, discovery and article request with Web Bot Auth, and
`/.well-known/http-message-signatures-directory` publishes its public half. Generate it and set
it in one step, so the private key is never printed:

```bash
bun -e 'let { privateKey } = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]); console.log(JSON.stringify(await crypto.subtle.exportKey("jwk", privateKey)))' | bunx wrangler secret put WEB_BOT_AUTH_KEY
```

Left unset, requests go out unsigned and the directory answers 404.

`PUBLIC_URL` is a plain variable already set in `wrangler.jsonc`.

## 5. Build, migrate, deploy

```bash
sdxc deploy
```

It builds, lists the catalog migrations production lacks and asks before going on, applies
them, then uploads the Worker, so the code never runs against a catalog without its tables.
Every later deploy is this one command.

## 6. Check it works

- `https://reader.sergiodxa.com/health` answers `200` with `"status": "pass"`; a `503` names the
  failing binding or service in its `checks`. Point the uptime monitor at it.
- `https://reader.sergiodxa.com` answers, and signing in returns to the reading view.
- Following a feed adds it, and its posts appear.
- In settings, turning on browser notifications and pressing the button shows the browser's
  permission prompt; once allowed, the browser is listed under its push service's host.
- A test checkout in Polar changes the reader's plan, and the webhook delivery shows as
  succeeded in Polar's dashboard.
- Worker logs show the daily `17 4 * * *` billing reconciliation the morning after.
