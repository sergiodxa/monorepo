/**
 * Exercises `checkMailServer` against DoH JSON answers served through MSW: MX hosts in
 * preference order, the RFC 7505 null MX, the RFC 5321 implicit MX through A and AAAA,
 * a domain with no mail host, NXDOMAIN, SERVFAIL, and a resolver that never answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { CLOUDFLARE, NameNotFoundError, ServerFailureError, TransportError } from "@sdxc/doh";
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { MailServerReason } from "./mail-server.js";

import { checkMailServer, MailServerError } from "./mail-server.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The IANA codes of the record types the check asks for. */
const TYPE_CODES: Record<string, number> = { A: 1, MX: 15, AAAA: 28 };

/** How one query type is answered: its records' data, a DNS status, or a failed request. */
type Reply = string[] | { Status: number } | "network-error";

/**
 * Answers each query at the Cloudflare endpoint by its `type`, recording which types were
 * asked; a type with no reply is NODATA.
 */
function answer(name: string, replies: Partial<Record<"MX" | "A" | "AAAA", Reply>>) {
	let asked: string[] = [];
	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let type = new URL(request.url).searchParams.get("type") ?? "";
			asked.push(type);
			let reply = replies[type as "MX" | "A" | "AAAA"] ?? [];
			if (reply === "network-error") return HttpResponse.error();

			let code = TYPE_CODES[type] ?? 0;
			let status = Array.isArray(reply) ? 0 : reply.Status;
			let records = Array.isArray(reply) ? reply : [];
			return HttpResponse.json({
				Status: status,
				TC: false,
				RD: true,
				RA: true,
				AD: false,
				CD: false,
				Question: [{ name, type: code }],
				Answer: records.map((data) => ({ name: `${name}.`, type: code, TTL: 300, data })),
			});
		}),
	);
	return asked;
}

/** The reason `checkMailServer` fails with, or `null` when it succeeds. */
async function reasonFor(domain: string): Promise<MailServerReason | null> {
	let result = await checkMailServer(domain);
	return isFailure(result) ? result.error.reason : null;
}

describe("checkMailServer", () => {
	test("returns the MX hosts in preference order", async () => {
		let asked = answer("example.com", {
			MX: ["20 backup.example.com.", "10 Mail.example.com."],
		});

		let servers = unwrap(await checkMailServer("example.com"));

		expect(servers).toEqual({
			domain: "example.com",
			hosts: ["mail.example.com", "backup.example.com"],
			implicit: false,
			ttl: 300,
		});
		expect(asked).toEqual(["MX"]);
	});

	test("refuses a domain publishing the RFC 7505 null MX", async () => {
		answer("example.com", { MX: ["0 ."], A: ["192.0.2.1"] });
		expect(await reasonFor("example.com")).toBe("null-mx");
	});

	test("ignores a null MX published beside real hosts", async () => {
		answer("example.com", { MX: ["0 .", "10 mail.example.com."] });
		expect(unwrap(await checkMailServer("example.com")).hosts).toEqual(["mail.example.com"]);
	});

	test("falls back to the domain's A record as its implicit MX", async () => {
		let asked = answer("example.com", { A: ["192.0.2.1"] });

		let servers = unwrap(await checkMailServer("example.com"));

		expect(servers).toEqual({
			domain: "example.com",
			hosts: ["example.com"],
			implicit: true,
			ttl: 300,
		});
		expect(asked.sort()).toEqual(["A", "AAAA", "MX"]);
	});

	test("falls back to the domain's AAAA record when it has no A record", async () => {
		answer("example.com", { AAAA: ["2001:db8::1"] });
		expect(unwrap(await checkMailServer("example.com")).implicit).toBe(true);
	});

	test("refuses a domain with no MX, A or AAAA record", async () => {
		answer("example.com", {});
		expect(await reasonFor("example.com")).toBe("no-mail-server");
	});

	test("refuses a domain that does not exist", async () => {
		answer("nope.example", { MX: { Status: 3 } });

		let result = await checkMailServer("nope.example");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(MailServerError);
		expect(result.error.reason).toBe("domain-not-found");
		expect(result.error.cause).toBeInstanceOf(NameNotFoundError);
	});

	test("reports a SERVFAIL as a lookup failure, keeping the resolver's error", async () => {
		answer("example.com", { MX: { Status: 2 } });

		let result = await checkMailServer("example.com");

		expect(isFailure(result) && result.error.reason).toBe("lookup-failed");
		expect(isFailure(result) && result.error.cause).toBeInstanceOf(ServerFailureError);
	});

	test("reports a resolver that never answers as a lookup failure", async () => {
		answer("example.com", { MX: "network-error" });

		let result = await checkMailServer("example.com");

		expect(isFailure(result) && result.error.reason).toBe("lookup-failed");
		expect(isFailure(result) && result.error.cause).toBeInstanceOf(TransportError);
	});

	test("reports a failed fallback lookup as a lookup failure, not a missing server", async () => {
		answer("example.com", { A: { Status: 2 } });
		expect(await reasonFor("example.com")).toBe("lookup-failed");
	});

	test("accepts the fallback when one address family answers and the other fails", async () => {
		answer("example.com", { A: ["192.0.2.1"], AAAA: "network-error" });
		expect(await reasonFor("example.com")).toBeNull();
	});
});
