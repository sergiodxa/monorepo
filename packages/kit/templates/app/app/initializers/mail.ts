/**
 * Where the app's email goes: Cloudflare's `send_email` binding, which `bun dev` simulates and
 * a deploy delivers through Email Routing. The router publishes a mailer over it as `ctx.email`;
 * a job builds its own with `new Mailer({ transport, from: MAIL_FROM })` and awaits `send()`.
 */

import { CloudflareTransport } from "@sdxc/mail/cloudflare";
import { env } from "cloudflare:workers";

/** Sends through the `EMAIL` binding, from an address on a domain Email Routing verified. */
export const transport = new CloudflareTransport(env.EMAIL);
