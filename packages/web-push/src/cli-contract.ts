/**
 * The `sdxc-web-push` command line as a contract: `vapid keygen` for a new sender identity and
 * `send` for one test notification to a subscription file. Help, usage errors and each
 * handler's typed `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import { parse } from "@sdxc/duration";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

/**
 * A duration as `@sdxc/duration` reads it (`1 hour`, `30s`, `0`), in milliseconds, so a typo
 * is a usage error before any key is read.
 */
const DURATION: Schema<unknown, number> = s.createSchema(function validate(value, context) {
	let parsed = typeof value === "string" ? parse(value) : null;
	if (parsed === null || isFailure(parsed) || parsed.data < 0) {
		return s.fail(
			`expects a duration such as "1 hour" or "0"; got ${JSON.stringify(value)}`,
			context.path,
		);
	}
	return { value: parsed.data };
});

/** The `--json` flag every report-printing command takes. */
function json() {
	return flag.boolean("json", { description: "Print the result as JSON" });
}

/** Every command `sdxc-web-push` takes. */
export const WEB_PUSH_COMMANDS = commands({
	description: "sdxc-web-push — VAPID keys and test notifications for Web Push",
	vapid: commands({
		description: "Manage the VAPID identity a sender signs with",
		keygen: command({
			description:
				"Generate a P-256 key pair: the public key pages pass to subscribe, the private key the sender keeps secret",
			flags: { json: json() },
			examples: ["vapid keygen", "vapid keygen --json > vapid.json"],
		}),
	}),
	send: command({
		description:
			"Send one notification to a subscription, signed with keys from --keys-file or the environment",
		arguments: {
			subscription: argument(s.string(), {
				default: "-",
				description: "Path to the subscription JSON, or - for stdin",
			}),
		},
		flags: {
			subject: flag.string("subject", {
				required: true,
				valueName: "uri",
				description: "The mailto: or https: contact a push service reaches about this sender",
				heading: "Identity",
			}),
			keysFile: flag.string("keys-file", {
				valueName: "path",
				description: "A JSON file holding publicKey and privateKey, as vapid keygen --json prints",
				heading: "Identity",
			}),
			publicKeyEnv: flag.string("public-key-env", {
				valueName: "name",
				default: "VAPID_PUBLIC_KEY",
				description: "The environment variable holding the public key, without --keys-file",
				heading: "Identity",
			}),
			privateKeyEnv: flag.string("private-key-env", {
				valueName: "name",
				default: "VAPID_PRIVATE_KEY",
				description: "The environment variable holding the private key, without --keys-file",
				heading: "Identity",
			}),
			payload: flag.string("payload", {
				valueName: "text",
				default: JSON.stringify({ title: "Test notification", body: "Sent by sdxc-web-push" }),
				description: "The message body, sent as UTF-8",
				heading: "Message",
			}),
			ttl: flag.string("ttl", {
				valueName: "duration",
				schema: DURATION,
				description: "How long the push service holds it for an offline device (default 4 weeks)",
				heading: "Message",
			}),
			urgency: flag.string("urgency", {
				schema: s.enum_(["very-low", "low", "normal", "high"]),
				description: "very-low, low, normal or high (default normal)",
				heading: "Message",
			}),
			topic: flag.string("topic", {
				description: "Replaces an undelivered message with the same topic",
				heading: "Message",
			}),
			json: json(),
		},
		examples: [
			"send subscription.json --subject mailto:ops@example.com --keys-file vapid.json",
			'send - --subject mailto:ops@example.com --payload \'{"title":"Hi"}\' < subscription.json',
		],
	}),
});
