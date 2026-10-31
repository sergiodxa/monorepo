/**
 * The honeypot the docs contact form carries: every rendered form gets fields signed with
 * `HONEYPOT_SECRET`, and a submission whose trap is filled or whose token is forged never
 * reaches the inbox.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Honeypot } from "@sdxc/honeypot";
import { env } from "cloudflare:workers";

/** Issues the form's fields and verifies them on submit; a form older than a day is refused. */
export const honeypot = new Honeypot({ secret: env.HONEYPOT_SECRET, maxAge: 60 * 60 * 24 });
