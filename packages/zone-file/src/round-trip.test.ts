/**
 * The round-trip guarantee as a property: seeded zone files spanning every typed type,
 * relative and absolute names, escapes, TTL forms, class order, parentheses and comments
 * parse, print in both `relative` modes, and parse back to the same records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "@sdxc/random";

import { createRandom } from "@sdxc/random";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type * as ZoneFile from "./types.js";

import { parse } from "./parse.js";
import { stringify } from "./stringify.js";

/** Seeds the property runs over; a failing case names its seed. */
const SEEDS = Array.from({ length: 200 }, (_, index) => `zone-${index}`);

/** Labels, including escaped dots, spaces, decimal escapes, mixed case and non-ASCII octets. */
const LABELS = [
	"www",
	"mail",
	"a",
	"_sip",
	"_tcp",
	"*",
	"x-1",
	"Up",
	"a\\.b",
	"q\\032r",
	"\\065bc",
	"caf\\195\\169",
];

/** TTL spellings: plain seconds and BIND's unit forms. */
const TTLS = ["300", "3600", "1h30m", "2W", "45s", "1d"];

/** Character-strings with the characters a TXT value must escape or quote. */
const STRINGS = [
	'"v=spf1 include:_spf.example.net -all"',
	'"a; b (c)"',
	'"say \\"hi\\""',
	'"caf\\195\\169"',
	'""',
	"bare",
];

/** One to two labels. */
function relative(random: Random): string {
	return Array.from({ length: random.int(1, 2) }, () => random.pick(LABELS)).join(".");
}

/** A name as a zone file may write it: `@`, relative, absolute in the zone, or outside it. */
function name(random: Random): string {
	switch (random.int(0, 3)) {
		case 0:
			return "@";
		case 1:
			return relative(random);
		case 2:
			return `${relative(random)}.example.com.`;
		default:
			return `${relative(random)}.example.net.`;
	}
}

/** A 16-bit value. */
function u16(random: Random): number {
	return random.int(0, 65535);
}

/** A type and its RDATA in presentation form. */
function rdata(random: Random): string {
	switch (random.int(0, 12)) {
		case 0:
			return `A ${random.int(1, 223)}.${random.int(0, 255)}.${random.int(0, 255)}.${random.int(0, 255)}`;
		case 1:
			return `AAAA 2001:DB8:0:0:${u16(random).toString(16)}:0:0:${u16(random).toString(16)}`;
		case 2:
			return `${random.pick(["CNAME", "NS", "PTR", "DNAME"])} ${name(random)}`;
		case 3:
			return `MX ${u16(random)} ${name(random)}`;
		case 4:
			return `TXT ${Array.from({ length: random.int(1, 3) }, () => random.pick(STRINGS)).join(" ")}`;
		case 5:
			return `CAA ${random.pick([0, 128, 1])} ${random.pick(["issue", "ISSUEWILD", "iodef"])} ${random.pick(['"letsencrypt.org"', '"pki.goog; cansignhttpexchanges=yes"', '";"', "mailto:a@example.com"])}`;
		case 6:
			return `SRV ${u16(random)} ${u16(random)} ${u16(random)} ${name(random)}`;
		case 7:
			return `SOA ${name(random)} ${name(random)} ( ${random.int(0, 2 ** 32 - 1)} ; serial\n\t${random.int(0, 99999)} ${random.int(0, 99999)}\n\t${random.int(0, 9999999)} ${random.int(0, 99999)} )`;
		case 8:
			return "A \\# 4 C0000201";
		case 9:
			return 'HINFO "PC" "Linux"';
		case 10:
			return `TYPE${random.int(1000, 2000)} \\# 2 abcd`;
		case 11:
			return "TXT \\# 6 02 68 69 02 6f 6b";
		default:
			return `RP admin.${relative(random)} txt`;
	}
}

/** A zone file of mixed entries, directives included. */
function zoneText(random: Random): string {
	let lines: string[] = [];
	let owned = false;
	for (let index = random.int(1, 25); index > 0; index--) {
		let roll = random.int(0, 19);
		if (roll === 0) {
			lines.push(`$TTL ${random.pick(TTLS)}`);
			continue;
		}
		if (roll === 1) {
			lines.push(`$ORIGIN ${random.pick(["sub", "example.com.", "other.example."])}`);
			continue;
		}

		let owner = owned && random.bool(0.2) ? "\t" : name(random);
		owned = true;
		let fields = [owner];
		let ttl = random.bool(0.6) ? random.pick(TTLS) : null;
		let recordClass = random.bool(0.5) ? random.pick(["IN", "in", "CLASS1"]) : null;
		let ordered = random.bool() ? [ttl, recordClass] : [recordClass, ttl];
		for (let field of ordered) if (field !== null) fields.push(field);
		fields.push(rdata(random));

		let line = fields.join(" ");
		if (random.bool(0.3)) line += ` ; note ${random.int(0, 9)}`;
		lines.push(line);
	}
	return lines.join("\n");
}

/** A record without where it was read, which a printed copy does not keep. */
function content(record: ZoneFile.Record): Partial<ZoneFile.Record> {
	let { file: _file, line: _line, endLine: _endLine, ...rest } = record;
	return rest;
}

describe("parse(stringify(zone)) yields zone's records", () => {
	test.each(SEEDS)("seed %s", (seed) => {
		let text = zoneText(createRandom(seed));
		let zone = unwrap(parse(text, { origin: "example.com" }));
		expect(zone.rejected, text).toEqual([]);

		for (let relativeNames of [false, true]) {
			let printed = stringify(zone, { relative: relativeNames });
			let reread = unwrap(parse(printed, { origin: "example.com" }));
			expect(reread.rejected, printed).toEqual([]);
			expect(reread.records.map(content), printed).toEqual(zone.records.map(content));
		}
	});
});
