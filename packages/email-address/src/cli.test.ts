/**
 * Tests for the `sdxc-email-address` command line, driven through `invoke()` against DoH
 * answers served with MSW: the human line per address, a list on stdin with one lookup per
 * domain, `--json`, `--skip-mx`, and the exit codes for passing, failing and missing input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { CLOUDFLARE } from "@sdxc/doh";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The IANA codes of the record types `checkMailServer` asks for. */
const TYPE_CODES: Record<string, number> = { A: 1, MX: 15, AAAA: 28 };

/** One domain's answers by record type; a missing domain answers NXDOMAIN, a missing type NODATA. */
type Zone = Record<string, Partial<Record<"MX" | "A" | "AAAA", string[]>>>;

/**
 * Serves `zone` at the Cloudflare DoH endpoint and records each `name type` query asked.
 *
 * @returns The queries, in the order they arrived
 */
function serveZone(zone: Zone): string[] {
	let asked: string[] = [];
	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let params = new URL(request.url).searchParams;
			let name = (params.get("name") ?? "").replace(/\.$/, "");
			let type = params.get("type") ?? "";
			asked.push(`${name} ${type}`);
			let records = zone[name];
			let code = TYPE_CODES[type] ?? 0;
			let data = records?.[type as "MX" | "A" | "AAAA"] ?? [];
			return HttpResponse.json({
				Status: records === undefined ? 3 : 0,
				TC: false,
				RD: true,
				RA: true,
				AD: false,
				CD: false,
				Question: [{ name, type: code }],
				Answer: data.map((value) => ({ name: `${name}.`, type: code, TTL: 300, data: value })),
			});
		}),
	);
	return asked;
}

describe("sdxc-email-address check", () => {
	test("prints the normalized address and its mail hosts, and exits 0", async () => {
		serveZone({ "example.com": { MX: ["10 mail.example.com."] } });
		let run = await invoke(cli, ["check", "  Jane@Example.COM "]);
		expect(run.code).toBe(0);
		expect(run.stderr).toBe("");
		expect(run.stdout).toBe("✓ Jane@example.com  mail via mail.example.com\n");
	});

	test("reports a domain whose own address receives mail", async () => {
		serveZone({ "example.org": { A: ["192.0.2.1"] } });
		let run = await invoke(cli, ["check", "jane@example.org"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("✓ jane@example.org  mail via example.org (no MX, its own address)\n");
	});

	test("exits 1 on an address that does not parse, without a lookup", async () => {
		let asked = serveZone({});
		let run = await invoke(cli, ["check", "jane.example.com"]);
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("✗ jane.example.com  invalid: missing-at-sign\n");
		expect(asked).toEqual([]);
	});

	test("exits 1 on a disposable domain", async () => {
		serveZone({ "inbox.mailinator.com": { MX: ["10 mail.mailinator.com."] } });
		let run = await invoke(cli, ["check", "jane@inbox.mailinator.com"]);
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("✗ jane@inbox.mailinator.com  disposable domain (mailinator.com)\n");
	});

	test("exits 1 on a null MX and on a domain that does not exist", async () => {
		serveZone({ "example.net": { MX: ["0 ."] } });
		let nullMx = await invoke(cli, ["check", "jane@example.net"]);
		expect(nullMx.code).toBe(1);
		expect(nullMx.stdout).toBe("✗ jane@example.net  domain refuses mail (null MX)\n");

		let missing = await invoke(cli, ["check", "jane@missing.example.com"]);
		expect(missing.code).toBe(1);
		expect(missing.stdout).toBe("✗ jane@missing.example.com  domain does not exist\n");
	});

	test("checks one address per stdin line, looking each domain up once", async () => {
		let asked = serveZone({ "example.com": { MX: ["10 mail.example.com."] } });
		let run = await invoke(cli, ["check"], {
			stdin: "jane@example.com\n\nJOHN@example.com\r\nnot-an-address\n",
		});
		expect(run.code).toBe(1);
		expect(run.stdout).toBe(
			[
				"✓ jane@example.com  mail via mail.example.com",
				"✓ JOHN@example.com  mail via mail.example.com",
				"✗ not-an-address  invalid: missing-at-sign",
				"",
				"2 passed, 1 failed",
				"",
			].join("\n"),
		);
		expect(asked).toEqual(["example.com MX"]);
	});

	test("leaves the lookup out with --skip-mx", async () => {
		let asked = serveZone({});
		let run = await invoke(cli, ["check", "-", "--skip-mx"], { stdin: "jane@example.com\n" });
		expect(run.code).toBe(0);
		expect(run.stdout).toBe("✓ jane@example.com\n");
		expect(asked).toEqual([]);
	});

	test("prints the report as JSON with --json", async () => {
		serveZone({ "mailinator.com": {} });
		let run = await invoke(cli, ["check", "Jane@Mailinator.com", "--json"]);
		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			ok: false,
			results: [
				{
					input: "Jane@Mailinator.com",
					ok: false,
					address: "Jane@mailinator.com",
					canonical: "jane@mailinator.com",
					domain: "mailinator.com",
					invalid: null,
					disposable: "mailinator.com",
					mailServers: null,
					mailServerError: "no-mail-server",
				},
			],
		});
	});

	test("exits 2 when stdin holds no address", async () => {
		let run = await invoke(cli, ["check"], { stdin: "\n  \n" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("No addresses on stdin");
		expect(run.stdout).toBe("");
	});
});
