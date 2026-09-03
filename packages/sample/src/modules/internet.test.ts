/**
 * Tests for addresses, handles, and links: that every generated address is
 * unroutable, that a handle survives an accented or punctuated name, and that a
 * password avoids the characters people misread.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { en } from "../data/en";
import { createRandom } from "../random";

import { createInternetModule } from "./internet";

const RESERVED = /^example\.(com|org|net)$/;

/** Decode one base64url segment of a token into the object it carries. */
function segment(value: string | undefined): Record<string, string | number> {
	let text = atob((value ?? "").replace(/-/g, "+").replace(/_/g, "/"));
	return JSON.parse(text) as Record<string, string | number>;
}

function module(seed: string) {
	return createInternetModule(createRandom(seed), en);
}

describe("email", () => {
	test("lands on a domain reserved for documentation", () => {
		let internet = module("addresses");

		for (let count = 0; count < 300; count++) {
			let domain = internet.email().split("@").at(1) as string;
			expect(domain).toMatch(RESERVED);
		}
	});

	test("carries the name it was given", () => {
		let internet = module("named");

		expect(internet.email({ firstName: "Ana", lastName: "Moreau" })).toMatch(
			/^ana\.moreau\d{1,2}@example\.(com|org|net)$/,
		);
	});

	test("varies the address between calls", () => {
		let internet = module("varies");
		let seen = new Set(Array.from({ length: 200 }, () => internet.email()));

		expect(seen.size).toBeGreaterThan(150);
	});
});

describe("username", () => {
	test("joins a first and last name with a dot", () => {
		expect(module("handles").username({ firstName: "Ana", lastName: "Moreau" })).toBe("ana.moreau");
	});

	test("folds accents onto their base letter", () => {
		let internet = module("handles");

		expect(internet.username({ firstName: "Lucía", lastName: "Ibáñez" })).toBe("lucia.ibanez");
		expect(internet.username({ firstName: "Álvaro", lastName: "Müller" })).toBe("alvaro.muller");
	});

	test("drops the punctuation a name can carry", () => {
		let internet = module("handles");

		expect(internet.username({ firstName: "Anne-Marie", lastName: "O'Brien" })).toBe(
			"annemarie.obrien",
		);
	});

	test("holds only characters an address can carry", () => {
		let internet = module("charset");

		for (let count = 0; count < 200; count++) {
			expect(internet.username()).toMatch(/^[a-z0-9]+\.[a-z0-9]+$/);
		}
	});
});

describe("domainName and url", () => {
	test("returns only reserved domains", () => {
		let internet = module("domains");
		let seen = new Set(Array.from({ length: 200 }, () => internet.domainName()));

		for (let domain of seen) expect(domain).toMatch(RESERVED);
		expect(seen.size).toBe(3);
	});

	test("builds a link on a reserved domain", () => {
		let internet = module("links");

		for (let count = 0; count < 100; count++) {
			expect(internet.url()).toMatch(/^https:\/\/[a-z0-9]+\.example\.(com|org|net)$/);
		}
	});
});

describe("password", () => {
	test("runs to sixteen characters by default", () => {
		expect(module("passwords").password()).toHaveLength(16);
	});

	test("runs to the length asked for", () => {
		expect(module("passwords").password({ length: 40 })).toHaveLength(40);
	});

	test("leaves out the characters people misread", () => {
		let internet = module("legible");
		let drawn = Array.from({ length: 200 }, () => internet.password({ length: 32 })).join("");

		for (let character of ["l", "I", "1", "O", "0"]) {
			expect(drawn).not.toContain(character);
		}
	});
});

describe("protocol values", () => {
	test("returns an HTTP verb and a status code", () => {
		let internet = module("http");

		expect(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).toContain(
			internet.httpMethod(),
		);
		let status = internet.httpStatusCode();
		expect(status).toBeGreaterThanOrEqual(100);
		expect(status).toBeLessThan(600);
	});

	test("returns a scheme and a port above the well-known range", () => {
		let internet = module("net");

		expect(["http", "https"]).toContain(internet.protocol());
		let port = internet.port();
		expect(port).toBeGreaterThanOrEqual(1024);
		expect(port).toBeLessThanOrEqual(65535);
	});

	test("writes addresses in each family", () => {
		let internet = module("addresses");

		expect(internet.ipv4()).toMatch(/^(\d{1,3}\.){3}\d{1,3}$/);
		expect(internet.ipv6()).toMatch(/^([0-9a-f]{4}:){7}[0-9a-f]{4}$/);
		expect(internet.mac()).toMatch(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/);

		for (let count = 0; count < 50; count++) {
			expect(internet.ip()).toMatch(/[.:]/);
		}
	});

	test("keeps every ipv4 octet inside a byte", () => {
		let internet = module("octets");

		for (let count = 0; count < 100; count++) {
			for (let octet of internet.ipv4().split(".")) {
				expect(Number(octet)).toBeLessThanOrEqual(255);
			}
		}
	});
});

describe("tokens and agents", () => {
	test("names an algorithm the repository signs with", () => {
		let internet = module("algorithms");

		for (let count = 0; count < 30; count++) {
			expect(["ES256", "RS256", "EdDSA"]).toContain(internet.jwtAlgorithm());
		}
	});

	test("writes a token of three segments whose claims decode", () => {
		let token = module("jwt").jwt();
		let [header, payload, signature] = token.split(".");

		expect(signature).toMatch(/^[0-9a-f]{64}$/);
		let decoded = segment(payload);

		expect(segment(header).typ).toBe("JWT");
		expect(String(decoded.sub)).toMatch(/^[a-z0-9]+\.[a-z0-9]+$/);
		expect(Number(decoded.exp)).toBeGreaterThan(Number(decoded.iat));
	});

	test("merges the claims it is given", () => {
		let token = module("jwt").jwt({ payload: { sub: "known" }, algorithm: "ES256" });
		let [header, payload] = token.split(".");

		expect(segment(header).alg).toBe("ES256");
		expect(segment(payload).sub).toBe("known");
	});

	test("writes a browser user agent", () => {
		expect(module("agents").userAgent()).toMatch(/^Mozilla\/5\.0 \(.+\).+\/[\d.]+/);
	});

	test("returns an emoji and a display name", () => {
		let internet = module("profile");

		expect(en.emojis).toContain(internet.emoji());
		expect(internet.displayName({ firstName: "Ada", lastName: "Lovelace" })).toBe("Ada L.");
	});

	test("returns a domain suffix and a domain word", () => {
		let internet = module("domains");

		expect(["com", "org", "net"]).toContain(internet.domainSuffix());
		expect(internet.domainWord()).toMatch(/^[a-z0-9]+$/);
	});

	test("appends a slash and honors a protocol on request", () => {
		let internet = module("urls");

		expect(internet.url({ appendSlash: true }).endsWith("/")).toBe(true);
		expect(internet.url({ protocol: "http" }).startsWith("http://")).toBe(true);
	});
});
