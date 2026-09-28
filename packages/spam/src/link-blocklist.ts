/**
 * The link-blocklist check: looks each linked domain up in DNS URI blocklists (Spamhaus DBL,
 * SURBL, URIBL) over DNS-over-HTTPS, so a domain reported by the wider mail and web community
 * scores here even when the submission's text looks innocent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DoH } from "@sdxc/doh";
import type { Result } from "@sdxc/result";

import { NameNotFoundError, resolve } from "@sdxc/doh";
import { failure, isFailure, success } from "@sdxc/result";

import type { Signal, SpamCheck } from "./check.js";

import { SpamCheckError } from "./check.js";
import { extractLinks } from "./lib/text.js";

/**
 * Second-level labels under a country-code TLD that registries sell names beneath, such as
 * `co.uk` or `com.br`, so `shop.example.co.uk` reduces to `example.co.uk`.
 */
const SECOND_LEVEL_LABELS: ReadonlySet<string> = new Set([
	"ac",
	"co",
	"com",
	"edu",
	"gob",
	"gov",
	"go",
	"ltd",
	"me",
	"ne",
	"net",
	"nom",
	"or",
	"org",
	"plc",
]);

/** How strongly one answer points to spam, before it becomes a score. */
type Strength = "listed" | "weak";

/** One zone's reading of a single `A` answer. */
type Reading = { kind: "listed"; strength: Strength; label: string } | { kind: "error" };

/** How to query a zone and read its return codes. */
interface ZoneSpec {
	title: string;
	queryName(host: string, dqsKey: string | undefined): string;
	/** Reads one answered address, already known to sit in 127.0.0.0/8. */
	read(address: number[]): Reading;
}

/**
 * Spamhaus DBL categories by the last octet of `127.0.1.x`; the same code plus 100 (`127.0.1.102`
 * and on) is that category on a legitimate domain that was abused, a weaker reason to hold a post.
 */
const SPAMHAUS_CODES: Record<number, string> = {
	2: "spam",
	3: "spammed redirector",
	4: "phishing",
	5: "malware",
	6: "botnet C&C",
};

/** SURBL `multi` list bits in the last octet. */
const SURBL_BITS: ReadonlyArray<[number, string]> = [
	[8, "phishing"],
	[16, "malware"],
	[64, "abuse"],
	[128, "cracked site"],
];

/** URIBL `multi` list bits in the last octet; black and red are listings, grey is weak. */
const URIBL_BITS: ReadonlyArray<[number, string]> = [
	[2, "black"],
	[4, "grey"],
	[8, "red"],
];

/**
 * The supported zones. Every one answers NXDOMAIN for a clean name and a 127.0.0.0/8 address
 * for a listed one, and each reserves some of those addresses to say the query itself was
 * refused, which reads as a misconfiguration rather than a listing.
 */
const ZONES: Record<linkBlocklist.Zone, ZoneSpec> = {
	spamhaus: {
		title: "Spamhaus DBL",
		queryName: (host, dqsKey) => `${host}.${dqsKey}.dbl.dq.spamhaus.net`,
		read([, second, third, fourth]) {
			if (second === 255 && third === 255) return { kind: "error" };
			if (third !== 1 || fourth === 255) return { kind: "error" };
			let label = SPAMHAUS_CODES[(fourth ?? 0) % 100] ?? "listed";
			if ((fourth ?? 0) >= 100)
				return { kind: "listed", strength: "weak", label: `abused ${label}` };
			return { kind: "listed", strength: "listed", label };
		},
	},
	surbl: {
		title: "SURBL",
		queryName: (host) => `${host}.multi.surbl.org`,
		read([, second, third, fourth]) {
			if (second !== 0 || third !== 0 || fourth === 1) return { kind: "error" };
			let labels = bitLabels(fourth ?? 0, SURBL_BITS);
			return { kind: "listed", strength: "listed", label: labels || "listed" };
		},
	},
	uribl: {
		title: "URIBL",
		queryName: (host) => `${host}.multi.uribl.com`,
		read([, second, third, fourth]) {
			if (second !== 0 || third !== 0 || fourth === 1) return { kind: "error" };
			let bits = fourth ?? 0;
			let strength: Strength = (bits & 0b1010) !== 0 ? "listed" : "weak";
			return { kind: "listed", strength, label: bitLabels(bits, URIBL_BITS) || "listed" };
		},
	},
};

/**
 * Scores the content's links and the author's URL by DNS blocklist listings. Each distinct
 * domain, up to `maxHosts`, is looked up in every zone in parallel; IP literals are skipped.
 * When any lookup finds a listing the signals are returned; otherwise a refused or failed
 * lookup fails the check, so an incomplete answer never passes for a clean one.
 *
 * @example linkBlocklist({ dqsKey: env.SPAMHAUS_DQS_KEY })
 */
export function linkBlocklist(options: linkBlocklist.Options = {}): SpamCheck {
	let zones: readonly linkBlocklist.Zone[] =
		options.zones ?? (options.dqsKey ? ["spamhaus", "surbl", "uribl"] : ["surbl", "uribl"]);
	let maxHosts = options.maxHosts ?? 10;
	let listedScore = options.listedScore ?? 6;
	let weakScore = options.weakScore ?? 2;
	let maxScore = options.maxScore ?? 12;

	return {
		name: "link-blocklist",
		stage: "remote",
		async check(submission, { signal }): Promise<Result<Signal[], SpamCheckError>> {
			if (zones.includes("spamhaus") && !options.dqsKey) {
				return failure(new SpamCheckError("misconfigured", "Spamhaus DBL needs a dqsKey"));
			}
			let links = extractLinks(`${submission.content} ${submission.author?.url ?? ""}`);
			let hosts = [...new Set(links.flatMap((url) => registrableHost(url.hostname) ?? []))];
			hosts = hosts.slice(0, maxHosts);
			if (hosts.length === 0 || zones.length === 0) return success([]);

			let lookups = await Promise.all(
				hosts.flatMap((host) =>
					zones.map(async (zone) => ({
						host,
						zone,
						outcome: await lookUp(ZONES[zone], zone, host, options, signal),
					})),
				),
			);

			let signals: Signal[] = [];
			let total = 0;
			let firstError: SpamCheckError | null = null;
			for (let { host, zone, outcome } of lookups) {
				if (isFailure(outcome)) {
					firstError ??= outcome.error;
					continue;
				}
				if (outcome.data === null) continue;
				let base = outcome.data.strength === "listed" ? listedScore : weakScore;
				let score = Math.min(base, maxScore - total);
				if (score <= 0) continue;
				total += score;
				signals.push({
					check: `link-blocklist.${zone}`,
					score,
					detail: `${host} is listed by ${ZONES[zone].title} (${outcome.data.label})`,
				});
			}
			if (signals.length === 0 && firstError !== null) return failure(firstError);
			return success(signals);
		},
	};
}

/** The options {@link linkBlocklist} takes. */
export namespace linkBlocklist {
	/** A supported blocklist: Spamhaus DBL, SURBL `multi` or URIBL `multi`. */
	export type Zone = "spamhaus" | "surbl" | "uribl";

	/** Zones, credentials and weights for the link-blocklist check. */
	export interface Options {
		/**
		 * The zones to query. Spamhaus refuses queries relayed by public resolvers, so it needs
		 * `dqsKey` and is included by default only when one is given.
		 *
		 * @default ["surbl", "uribl"], plus "spamhaus" first when `dqsKey` is set
		 */
		zones?: readonly Zone[];
		/** A Spamhaus Data Query Service key, which the DBL query name embeds. */
		dqsKey?: string;
		/**
		 * The DoH resolver every query goes through; point it at a resolver the zones accept when
		 * the default one is refused.
		 *
		 * @default Cloudflare's 1.1.1.1
		 */
		resolver?: DoH.Resolver;
		/**
		 * Distinct domains looked up per submission, bounding the queries a link-stuffed post costs.
		 *
		 * @default 10
		 */
		maxHosts?: number;
		/**
		 * The score of each zone listing a domain.
		 *
		 * @default 6
		 */
		listedScore?: number;
		/**
		 * The score of a low-confidence listing: URIBL grey, or a Spamhaus listing of an abused
		 * legitimate domain.
		 *
		 * @default 2
		 */
		weakScore?: number;
		/** @default 12 */
		maxScore?: number;
	}
}

/**
 * Queries one zone for one host. NXDOMAIN and an answer with no address mean not listed
 * (`null`); a reserved error code is `misconfigured`, an address outside 127.0.0.0/8 is
 * `invalid-response`, and a resolver failure is `unavailable`.
 */
async function lookUp(
	spec: ZoneSpec,
	zone: linkBlocklist.Zone,
	host: string,
	options: linkBlocklist.Options,
	signal: AbortSignal,
): Promise<Result<{ strength: Strength; label: string } | null, SpamCheckError>> {
	let answer = await resolve(spec.queryName(host, options.dqsKey), "A", {
		resolver: options.resolver,
		signal,
	});
	if (isFailure(answer)) {
		if (answer.error instanceof NameNotFoundError) return success(null);
		return failure(new SpamCheckError("unavailable", `${zone}: ${answer.error.message}`));
	}

	let strongest: { strength: Strength; label: string } | null = null;
	for (let record of answer.data.records) {
		let octets = record.address.split(".").map(Number);
		if (octets[0] !== 127) {
			return failure(new SpamCheckError("invalid-response", `${zone} answered ${record.address}`));
		}
		let reading = spec.read(octets);
		if (reading.kind === "error") {
			return failure(
				new SpamCheckError("misconfigured", `${zone} refused the query (${record.address})`),
			);
		}
		if (strongest === null || reading.strength === "listed") strongest = reading;
	}
	return success(strongest);
}

/**
 * The domain a blocklist indexes for `hostname`: its last two labels, or three under a
 * registry second level such as `co.uk`. IP literals and single-label names give `null`.
 */
function registrableHost(hostname: string): string | null {
	let host = hostname.toLowerCase().replace(/\.$/, "");
	if (host.startsWith("[") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
	let labels = host.split(".");
	if (labels.length < 2) return null;
	let tld = labels[labels.length - 1] ?? "";
	let second = labels[labels.length - 2] ?? "";
	let keep = labels.length > 2 && tld.length === 2 && SECOND_LEVEL_LABELS.has(second) ? 3 : 2;
	return labels.slice(-keep).join(".");
}

/** The names of the bits set in `value`, comma-separated. */
function bitLabels(value: number, bits: ReadonlyArray<[number, string]>): string {
	return bits
		.filter(([bit]) => (value & bit) !== 0)
		.map(([, label]) => label)
		.join(", ");
}
