/**
 * Tests for the `sdxc-doh` command line: what `lookup` prints on each stream and the exit code
 * it answers for records, a CNAME chain, NODATA, NXDOMAIN, SERVFAIL, an unreachable resolver
 * and bad flags, against resolvers served through MSW and driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { CLOUDFLARE, GOOGLE } from "./resolvers.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** One answer record as the JSON API writes it, `type` being the IANA code. */
interface WireRecord {
	name: string;
	type: number;
	TTL: number;
	data: string;
}

/** The JSON envelope Cloudflare and Google answer with, defaulting to an empty NOERROR reply. */
function envelope(
	name: string,
	type: number,
	fields: { Status?: number; Answer?: WireRecord[]; Authority?: WireRecord[] } = {},
) {
	return {
		Status: 0,
		TC: false,
		RD: true,
		RA: true,
		AD: false,
		CD: false,
		Question: [{ name, type }],
		...fields,
	};
}

/** Answers every query at `url` with `body`, recording the request URLs it saw. */
function answerWith(body: Record<string, unknown>, url = CLOUDFLARE.url) {
	let seen: URL[] = [];
	server.use(
		http.get(url, ({ request }) => {
			seen.push(new URL(request.url));
			return HttpResponse.json(body);
		}),
	);
	return seen;
}

/** Runs `sdxc-doh` with no terminal attached. */
function run(argv: string[]) {
	return invoke(cli, argv, { interactive: false });
}

describe("sdxc-doh lookup", () => {
	test("prints A records as a dig-style answer section", async () => {
		let seen = answerWith(
			envelope("example.com.", 1, {
				Answer: [{ name: "example.com.", type: 1, TTL: 300, data: "93.184.216.34" }],
			}),
		);

		let { code, stdout, stderr } = await run(["lookup", "example.com"]);

		expect(code).toBe(0);
		expect(stdout).toBe(";; ANSWER SECTION:\nexample.com.\t300\tIN\tA\t93.184.216.34\n");
		expect(stderr).toMatch(/^;; Query time: \d+ msec\n$/);
		expect(seen[0]?.searchParams.get("type")).toBe("A");
	});

	test("prints the CNAME chain before the records and reads --type in any case", async () => {
		let seen = answerWith(
			envelope("www.example.com.", 15, {
				Answer: [
					{ name: "www.example.com.", type: 5, TTL: 60, data: "example.com." },
					{ name: "example.com.", type: 15, TTL: 300, data: "10 mail.example.com." },
				],
			}),
		);

		let { code, stdout } = await run(["lookup", "www.example.com", "--type", "mx"]);

		expect(code).toBe(0);
		expect(stdout).toBe(
			";; ANSWER SECTION:\n" +
				"www.example.com.\t60\tIN\tCNAME\texample.com.\n" +
				"example.com.\t300\tIN\tMX\t10 mail.example.com.\n",
		);
		expect(seen[0]?.searchParams.get("type")).toBe("MX");
	});

	test("prints the typed answer with --json", async () => {
		answerWith(
			envelope("example.com.", 16, {
				Answer: [{ name: "example.com.", type: 16, TTL: 120, data: '"v=spf1 -all"' }],
			}),
		);

		let { code, stdout } = await run(["lookup", "example.com", "-t", "TXT", "--json"]);

		expect(code).toBe(0);
		let parsed = JSON.parse(stdout);
		expect(parsed).toMatchObject({
			name: "example.com",
			type: "TXT",
			ttl: 120,
			records: [{ type: "TXT", name: "example.com", ttl: 120, text: "v=spf1 -all" }],
			chain: [],
		});
	});

	test("exits 1 on an empty answer", async () => {
		answerWith(envelope("example.com.", 28));

		let { code, stdout, stderr } = await run(["lookup", "example.com", "--type", "AAAA"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain("example.com has no AAAA records (NODATA)");
	});

	test("exits 1 on NXDOMAIN, with the error as JSON under --json", async () => {
		answerWith(envelope("missing.example.com.", 1, { Status: 3 }));

		let text = await run(["lookup", "missing.example.com"]);
		let json = await run(["lookup", "missing.example.com", "--json"]);

		expect(text.code).toBe(1);
		expect(text.stderr).toContain("missing.example.com does not exist (NXDOMAIN)");
		expect(json.code).toBe(1);
		expect(JSON.parse(json.stdout)).toMatchObject({
			name: "missing.example.com",
			type: "A",
			error: { name: "NameNotFoundError", ttl: null },
		});
	});

	test("exits 1 on SERVFAIL", async () => {
		answerWith(envelope("broken.example.com.", 1, { Status: 2 }));

		let { code, stderr } = await run(["lookup", "broken.example.com"]);

		expect(code).toBe(1);
		expect(stderr).toContain("SERVFAIL");
	});

	test("exits 2 when the resolver answers with no DNS message", async () => {
		server.use(http.get(CLOUDFLARE.url, () => new HttpResponse(null, { status: 503 })));

		let { code } = await run(["lookup", "example.com"]);

		expect(code).toBe(2);
	});

	test("asks Google or any endpoint with --resolver", async () => {
		let google = answerWith(
			envelope("example.com.", 1, {
				Answer: [{ name: "example.com.", type: 1, TTL: 300, data: "93.184.216.34" }],
			}),
			GOOGLE.url,
		);
		let custom = answerWith(
			envelope("example.com.", 1, {
				Answer: [{ name: "example.com.", type: 1, TTL: 300, data: "93.184.216.34" }],
			}),
			"https://doh.sergiodxa.com/dns-query",
		);

		let byName = await run(["lookup", "example.com", "--resolver", "google"]);
		let byUrl = await run([
			"lookup",
			"example.com",
			"--resolver",
			"https://doh.sergiodxa.com/dns-query",
		]);

		expect(byName.code).toBe(0);
		expect(byUrl.code).toBe(0);
		expect(google).toHaveLength(1);
		expect(custom).toHaveLength(1);
	});

	test("exits 2 on an unknown type or a resolver that is not https", async () => {
		let type = await run(["lookup", "example.com", "--type", "NOPE"]);
		let resolver = await run(["lookup", "example.com", "--resolver", "http://dns.sergiodxa.com"]);
		let missing = await run(["lookup"]);

		expect(type.code).toBe(2);
		expect(type.stderr).toContain("expects a record type");
		expect(resolver.code).toBe(2);
		expect(resolver.stderr).toContain("expects cloudflare, google or an https:// URL");
		expect(missing.code).toBe(2);
	});
});
