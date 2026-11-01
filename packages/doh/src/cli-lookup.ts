/**
 * The `sdxc-doh lookup` handler: one `resolve` call printed as a dig-style answer section, or
 * as JSON. NXDOMAIN, an empty answer and a resolver error exit 1; a resolver that never
 * answered exits 2, since the lookup itself could not run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";
import { formatRecordData } from "@sdxc/zone-file";

import type { DoHError } from "./errors.js";
import type { DoH } from "./types.js";

import { DOH_COMMANDS } from "./cli-contract.js";
import { TransportError } from "./errors.js";
import { resolve } from "./resolve.js";
import { CLOUDFLARE, CLOUDFLARE_WIRE, GOOGLE, GOOGLE_WIRE } from "./resolvers.js";

/**
 * The resolver a `--resolver` value and `--wire` name: the public ones by name, in the format
 * asked for, and any other value as an endpoint URL.
 */
function pickResolver(resolver: string, wire: boolean): DoH.Resolver {
	if (resolver === "cloudflare") return wire ? CLOUDFLARE_WIRE : CLOUDFLARE;
	if (resolver === "google") return wire ? GOOGLE_WIRE : GOOGLE;
	return { url: resolver, format: wire ? "wire" : "json" };
}

/** One record as a zone-file line: absolute owner, TTL, class, type and canonical data. */
function line(record: DoH.RecordFor<DoH.RecordType>): string {
	let data = formatRecordData(record);
	return `${record.name}.\t${record.ttl}\tIN\t${record.type}\t${data}`;
}

/** A failure as data: its class name, message and the own fields a script may branch on (`ttl`, `rcode`, `status`, …). */
function describeError(error: DoHError): Record<string, unknown> {
	return { name: error.name, message: error.message, ...Object.fromEntries(Object.entries(error)) };
}

/**
 * Prints the chain, the records and any unparsed records in answer order; the answer section
 * goes to stdout and the closing summary to stderr, so piping keeps only records.
 */
export default createCommand(DOH_COMMANDS.lookup, async (ctx) => {
	let { name } = ctx.arguments;
	let { type, json } = ctx.flags;
	let answer = await resolve(name, type, {
		resolver: pickResolver(ctx.flags.resolver, ctx.flags.wire === true),
		dnssec: ctx.flags.dnssec === true,
		signal: ctx.signal,
	});

	if (isFailure(answer)) {
		let code = answer.error instanceof TransportError ? 2 : 1;
		if (json) {
			ctx.stdout(
				`${JSON.stringify({ name, type, error: describeError(answer.error) }, null, 2)}\n`,
			);
			return exit(code);
		}
		return exit(code, answer.error.message);
	}

	let { records, unparsed, chain } = answer.data;
	let empty = records.length === 0 && unparsed.length === 0;
	if (json) {
		ctx.stdout(`${JSON.stringify(answer.data, null, 2)}\n`);
		return empty ? exit(1) : success();
	}
	if (empty) return exit(1, `${answer.data.name} has no ${type} records (NODATA)`);

	let lines = [...chain, ...records, ...unparsed].map(line);
	ctx.stdout(`;; ANSWER SECTION:\n${lines.join("\n")}\n`);
	ctx.stderr(`;; Query time: ${Math.round(answer.data.durationMs)} msec\n`);
	return success();
});
