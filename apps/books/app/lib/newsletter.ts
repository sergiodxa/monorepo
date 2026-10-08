/**
 * The newsletter this funnel subscribes readers to: one Buttondown list built at
 * module scope. It is the only place the vendor is named, so every route reaches
 * the list through `context.newsletter` and a test installs a memory list instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Newsletter } from "@sdxc/newsletter";

import { ButtondownNewsletter } from "@sdxc/newsletter/buttondown";
import { env } from "cloudflare:workers";

/**
 * The configured list. An unset `BUTTONDOWN_API_KEY` fails each call with
 * `unauthenticated` rather than the isolate, so `/healthcheck` still answers.
 */
export const buttondown: Newsletter = new ButtondownNewsletter({
	apiKey: env.BUTTONDOWN_API_KEY,
});
