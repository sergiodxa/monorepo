/**
 * Tests the flow check: several real HTTP requests through MSW, the assertions between them,
 * and the four things this app decides rather than the spec — which capabilities exist, which
 * hosts are reachable, how much a run may do, and whether a failure means the customer's flow
 * is broken or their monitor is.
 *
 * The last distinction is the one worth pinning: `down` goes into somebody's outage history
 * and `error` does not, so a spec that reaches a host it was never allowed must not read as
 * an outage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";

import { resolveAllowedHosts, runFlowCheck, specHosts } from "~/app/services/flow-check";

const DOMAIN = "example.test";
const HOST = `app.${DOMAIN}`;
const ORIGIN = `https://${HOST}`;

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A two-step sign-in flow: post a credential, read the token back, use it. */
function signInFlow(): string {
	return [
		"use http",
		'test "a member can sign in and read their profile" {',
		"\twhen {",
		`\t\tlet session = http.post "${ORIGIN}/login" { email: "monitor@example.test" }`,
		`\t\tlet profile = http.get "${ORIGIN}/me" bearer session.json.token`,
		"\t}",
		"\tthen {",
		"\t\texpect session.status 201",
		"\t\texpect profile.status 200",
		'\t\texpect profile.json.email "monitor@example.test"',
		"\t}",
		"}",
	].join("\n");
}

describe("runFlowCheck", () => {
	test("a flow whose every assertion holds is up, and reports what it spent", async () => {
		server.use(
			http.post(`${ORIGIN}/login`, () => HttpResponse.json({ token: "t0ken" }, { status: 201 })),
			http.get(`${ORIGIN}/me`, ({ request }) => {
				if (request.headers.get("authorization") !== "Bearer t0ken") {
					return new HttpResponse(null, { status: 401 });
				}
				return HttpResponse.json({ email: "monitor@example.test" });
			}),
		);

		let result = await runFlowCheck({ source: signInFlow(), verifiedDomains: [DOMAIN] });

		expect(result.status).toBe("up");
		expect(result.testsTotal).toBe(1);
		expect(result.testsPassed).toBe(1);
		expect(result.requestsMade).toBe(2);
		expect(result.failureDetail).toBeNull();
		expect(result.errorMessage).toBeNull();
		expect(result.durationMs).not.toBeNull();
	});

	test("the second step failing is down, and says which assertion and which line", async () => {
		server.use(
			http.post(`${ORIGIN}/login`, () => HttpResponse.json({ token: "t0ken" }, { status: 201 })),
			// The endpoint the token authorises has stopped honouring it — exactly the failure a
			// single-request monitor on either URL would report as healthy.
			http.get(`${ORIGIN}/me`, () => new HttpResponse(null, { status: 500 })),
		);

		let result = await runFlowCheck({ source: signInFlow(), verifiedDomains: [DOMAIN] });

		expect(result.status).toBe("down");
		expect(result.testsFailed).toBe(1);
		expect(result.failedTest).toBe("a member can sign in and read their profile");
		// `expect profile.status 200` is the ninth line of the source above.
		expect(result.failedAtLine).toBe(9);
		expect(result.failureDetail).toContain("200");
		expect(result.failureDetail).toContain("500");
	});

	test("a host no verified domain covers is refused before anything is sent", async () => {
		let result = await runFlowCheck({
			source: [
				'test "reaches somebody else\'s site" {',
				"\twhen {",
				'\t\tlet response = http.get "https://victim.invalid.test/login"',
				"\t}",
				"}",
			].join("\n"),
			verifiedDomains: [DOMAIN],
		});

		// No MSW handler is registered for that host and `onUnhandledRequest: "error"` would fail
		// the test if anything were sent, so this also proves the refusal happens before the
		// request rather than after it. This is the property that stops the feature being a way
		// to automate a domain the team does not own.
		expect(result.status).toBe("error");
		expect(result.requestsMade).toBe(0);
		expect(result.errorMessage).toContain("victim.invalid.test");
		expect(result.errorMessage).toContain("verified domain");
	});

	test("one unverified host among several verified ones refuses the whole run", async () => {
		server.use(http.get(`${ORIGIN}/health`, () => HttpResponse.json({ ok: true })));

		let result = await runFlowCheck({
			source: [
				"use http",
				'test "mostly ours" {',
				"\twhen {",
				`\t\tlet ours = http.get "${ORIGIN}/health"`,
				'\t\tlet theirs = http.get "https://victim.invalid.test/login"',
				"\t}",
				"}",
			].join("\n"),
			verifiedDomains: [DOMAIN],
		});

		// Not "run the parts we can": a flow is a sequence, so a partially authorised one is a
		// monitor to fix rather than a check to attempt.
		expect(result.status).toBe("error");
		expect(result.requestsMade).toBe(0);
	});

	test("a capability this run does not register is an error, not an outage", async () => {
		let result = await runFlowCheck({
			source: [
				'test "writes a file" {',
				"\tgiven {",
				'\t\tfs.write "out.txt" "hi"',
				"\t}",
				"}",
			].join("\n"),
			verifiedDomains: [DOMAIN],
		});

		expect(result.status).toBe("error");
		expect(result.requestsMade).toBe(0);
	});

	test("a spec that will not parse is an error carrying the parse failure", async () => {
		let result = await runFlowCheck({ source: 'test "unclosed" {', verifiedDomains: [DOMAIN] });

		expect(result.status).toBe("error");
		expect(result.errorMessage).toContain("flow.spec");
		expect(result.testsTotal).toBe(0);
	});

	test("a team with no verified domain can run nothing, and sends nothing", async () => {
		let result = await runFlowCheck({ source: signInFlow(), verifiedDomains: [] });

		expect(result.status).toBe("error");
		expect(result.errorMessage).toContain("verified domain");
		expect(result.requestsMade).toBe(0);
	});

	test("a spec that names no host at all is an error rather than a run that reaches nothing", async () => {
		let result = await runFlowCheck({
			source: ['test "asserts on nothing" {', "\tthen {", "\t\texpect true", "\t}", "}"].join("\n"),
			verifiedDomains: [DOMAIN],
		});

		expect(result.status).toBe("error");
		expect(result.errorMessage).toContain("names no host");
	});

	test("a run stops at its request ceiling, and reports that as an error", async () => {
		server.use(http.get(`${ORIGIN}/step`, () => HttpResponse.json({ ok: true })));

		let result = await runFlowCheck({
			source: [
				"use http",
				'test "walks a catalogue by hand" {',
				"\twhen {",
				`\t\tlet a = http.get "${ORIGIN}/step"`,
				`\t\tlet b = http.get "${ORIGIN}/step"`,
				`\t\tlet c = http.get "${ORIGIN}/step"`,
				"\t}",
				"}",
			].join("\n"),
			verifiedDomains: [DOMAIN],
			maxRequests: 2,
		});

		expect(result.status).toBe("error");
		expect(result.requestsMade).toBe(2);
		expect(result.failureDetail).toContain("too many requests");
	});

	test("a run past its deadline stops, and that is the flow being down", async () => {
		server.use(
			http.get(`${ORIGIN}/slow`, async () => {
				await delay(40);
				return HttpResponse.json({ ok: true });
			}),
		);

		let result = await runFlowCheck({
			source: [
				"use http",
				'test "waits too long" {',
				"\twhen {",
				`\t\tlet first = http.get "${ORIGIN}/slow"`,
				`\t\tlet second = http.get "${ORIGIN}/slow"`,
				"\t}",
				"}",
			].join("\n"),
			verifiedDomains: [DOMAIN],
			timeoutMs: 20,
		});

		expect(result.status).toBe("down");
		// The first request was allowed and the second was refused once the deadline had
		// passed, which is what bounds the run without abandoning work still in flight.
		expect(result.requestsMade).toBe(1);
		expect(result.failureDetail).toContain("ran out of time");
	});

	test("several tests in one spec each report, and any failure makes the monitor down", async () => {
		server.use(
			http.get(`${ORIGIN}/up`, () => HttpResponse.json({ ok: true })),
			http.get(`${ORIGIN}/broken`, () => new HttpResponse(null, { status: 503 })),
		);

		let result = await runFlowCheck({
			source: [
				"use http",
				'test "the healthy endpoint answers" {',
				"\twhen {",
				`\t\tlet response = http.get "${ORIGIN}/up"`,
				"\t}",
				"\tthen {",
				"\t\texpect response.status 200",
				"\t}",
				"}",
				'test "the broken endpoint answers" {',
				"\twhen {",
				`\t\tlet response = http.get "${ORIGIN}/broken"`,
				"\t}",
				"\tthen {",
				"\t\texpect response.status 200",
				"\t}",
				"}",
			].join("\n"),
			verifiedDomains: [DOMAIN],
		});

		expect(result.status).toBe("down");
		expect(result.testsTotal).toBe(2);
		expect(result.testsPassed).toBe(1);
		expect(result.testsFailed).toBe(1);
		expect(result.failedTest).toBe("the broken endpoint answers");
	});
});

describe("specHosts", () => {
	test("collects every host the spec's own text names, sorted and deduplicated", () => {
		expect(
			specHosts(
				[
					"use http",
					'test "spans two hosts" {',
					"\twhen {",
					'\t\tlet a = http.get "https://second.example.test/one"',
					'\t\tlet b = http.get "https://first.example.test/two"',
					'\t\tlet c = http.get "https://second.example.test/three"',
					"\t}",
					"}",
				].join("\n"),
			),
		).toEqual(["first.example.test", "second.example.test"]);
	});

	test("keeps a non-default port, because a grant scope is host:port", () => {
		expect(
			specHosts(
				[
					'test "hits a port" {',
					"\twhen {",
					'\t\tlet a = http.get "https://app.example.test:8443/health"',
					"\t}",
					"}",
				].join("\n"),
			),
		).toEqual(["app.example.test:8443"]);
	});

	test("reaches a URL held in a fixture's returned object", () => {
		expect(
			specHosts(
				[
					"fixture endpoints {",
					'\treturn { health: "https://fixtured.example.test/health" }',
					"}",
					'test "uses the fixture" {',
					"\twhen {",
					"\t\tlet where = fixture endpoints",
					"\t\tlet response = http.get where.health",
					"\t}",
					"}",
				].join("\n"),
			),
		).toEqual(["fixtured.example.test"]);
	});

	test("a URL in a comment names nothing, because a comment is not a literal", () => {
		expect(
			specHosts(
				[
					"use http",
					'test "mentions a host it never calls" {',
					"\twhen {",
					"\t\t# was https://commented.example.test/health",
					'\t\tlet a = http.get "https://real.example.test/health"',
					"\t}",
					"}",
				].join("\n"),
			),
		).toEqual(["real.example.test"]);
	});

	test("strings that are not absolute HTTP URLs are ignored", () => {
		expect(
			specHosts(
				[
					"use http",
					'test "asserts on strings" {',
					"\twhen {",
					'\t\tlet a = http.get "https://real.example.test/health"',
					"\t}",
					"\tthen {",
					'\t\texpect a.json.name "not-a-url"',
					'\t\texpect a.json.scheme "ftp://files.example.test"',
					"\t}",
					"}",
				].join("\n"),
			),
		).toEqual(["real.example.test"]);
	});

	test("an unparseable spec names no hosts, rather than guessing at them", () => {
		expect(specHosts('test "unclosed" {')).toEqual([]);
	});
});

describe("resolveAllowedHosts", () => {
	test("a verified domain covers itself and its subdomains", () => {
		let resolved = resolveAllowedHosts(
			["example.test", "app.example.test", "api.staging.example.test"],
			["example.test"],
		);

		expect(resolved.allowed).toBe("example.test,app.example.test,api.staging.example.test");
		expect(resolved.refused).toEqual([]);
	});

	test("the allowance is the hosts the spec asks for, not the whole domain", () => {
		// A wildcard is not expressible as a grant scope, and it should not be: a flow authorised
		// for `app.` must not also reach `internal.` just because the team owns the zone.
		expect(resolveAllowedHosts(["app.example.test"], ["example.test"]).allowed).toBe(
			"app.example.test",
		);
	});

	test("a name that merely ends with the domain's text is refused", () => {
		let resolved = resolveAllowedHosts(
			["notexample.test", "example.test.invalid.test"],
			["example.test"],
		);

		expect(resolved.allowed).toBe("");
		expect(resolved.refused).toEqual(["notexample.test", "example.test.invalid.test"]);
	});

	test("a port rides along, since ownership is a property of the name", () => {
		expect(resolveAllowedHosts(["app.example.test:8443"], ["example.test"]).allowed).toBe(
			"app.example.test:8443",
		);
	});

	test("matching ignores case, on both sides", () => {
		expect(resolveAllowedHosts(["APP.Example.Test"], ["example.TEST"]).allowed).toBe(
			"APP.Example.Test",
		);
	});

	test("no verified domains refuses everything", () => {
		expect(resolveAllowedHosts(["app.example.test"], []).refused).toEqual(["app.example.test"]);
	});
});
