/**
 * The `sdxc-doh` command line as a contract: `lookup` asks a DNS-over-HTTPS resolver for one
 * name's records of one type. Help, usage errors and the handler's typed `ctx.arguments` and
 * `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import { canonicalType, typeCode } from "@sdxc/zone-file";
import * as s from "remix/data-schema";

/**
 * A record type as a mnemonic or `TYPEnnn`, answered in its canonical spelling, so `mx` and
 * `TYPE15` both query MX and an unknown mnemonic is a usage error naming what was typed.
 */
const RECORD_TYPE: Schema<unknown, string> = s.createSchema(function validate(value, context) {
	if (typeof value === "string" && typeCode(value) !== null) {
		return { value: canonicalType(value) };
	}
	return s.fail(
		`expects a record type such as A, AAAA, MX or TYPE65; got ${JSON.stringify(value)}`,
		context.path,
	);
});

/**
 * A resolver as `cloudflare`, `google` or an `https:` DoH endpoint URL; the names come back
 * lowercased and a URL as typed.
 */
const RESOLVER: Schema<unknown, string> = s.createSchema(function validate(value, context) {
	if (typeof value === "string") {
		let lower = value.toLowerCase();
		if (lower === "cloudflare" || lower === "google") return { value: lower };
		if (URL.canParse(value) && new URL(value).protocol === "https:") return { value };
	}
	return s.fail(
		`expects cloudflare, google or an https:// URL; got ${JSON.stringify(value)}`,
		context.path,
	);
});

/** Every command `sdxc-doh` takes. */
export const DOH_COMMANDS = commands({
	description: "sdxc-doh — typed DNS over HTTPS lookups",
	lookup: command({
		description:
			"Look up a name's records of one type and print them as a dig-style answer section. Exits 1 on NXDOMAIN, an empty answer or a resolver error, and 2 when the resolver cannot be reached.",
		arguments: {
			name: argument(s.string(), {
				description: "The domain name, in its ASCII (punycode) form",
			}),
		},
		flags: {
			type: flag.string("type", {
				short: "t",
				valueName: "type",
				default: "A",
				schema: RECORD_TYPE,
				description: "The record type: A, AAAA, MX, TXT, CNAME, NS, CAA, SOA, HTTPS, …",
			}),
			resolver: flag.string("resolver", {
				short: "r",
				valueName: "url",
				default: "cloudflare",
				schema: RESOLVER,
				description: "cloudflare, google or a DoH endpoint URL",
			}),
			wire: flag.boolean("wire", {
				description:
					"Speak RFC 8484 wire format instead of the JSON API, which also reports extended DNS errors",
			}),
			dnssec: flag.boolean("dnssec", {
				description: "Set the DO bit, asking for DNSSEC records alongside the answer",
			}),
			json: flag.boolean("json", {
				description:
					"Print the answer as JSON: { name, type, records, unparsed, chain, ttl, authenticated, … }, or { name, type, error } on failure",
			}),
		},
		examples: [
			"lookup example.com",
			"lookup example.com --type MX",
			"lookup _dmarc.example.com --type TXT --json",
			"lookup example.com --type AAAA --resolver google --wire",
		],
	}),
});
