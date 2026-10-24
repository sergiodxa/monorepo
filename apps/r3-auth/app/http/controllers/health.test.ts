/**
 * Router-level tests of `GET /health`: the passing report, a missing signing key failing
 * it with a 503, and a third-party outage only warning. Polar, GitHub and the breach
 * lookup are intercepted with MSW, so the real probe requests run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/test/http";

import { createTestApp } from "~/app/test/http";
import { ORIGIN } from "~/app/test/seed";
import routes from "~/routes/web";

/**
 * Every third party answering the way it does when it is up. The probes judge only the
 * status, so each answer is bodiless: the runner then has no body to cancel, a step that
 * stays pending forever on a response MSW builds under Node.
 */
const PROVIDERS_UP = [
	http.get("https://api.polar.sh/healthz", () => new HttpResponse(null, { status: 200 })),
	http.get("https://api.github.com/rate_limit", () => new HttpResponse(null, { status: 200 })),
	http.get(
		"https://api.pwnedpasswords.com/range/:prefix",
		() => new HttpResponse(null, { status: 200 }),
	),
];

let server = setupServer(...PROVIDERS_UP);
let app: TestApp;

/** Requests the report and reads its body, which every assertion below inspects. */
async function report() {
	let response = await app.fetch(new Request(`${ORIGIN}${routes.health.href()}`));
	let body = (await response.json()) as {
		status: string;
		serviceId: string;
		releaseId: string;
		checks: Record<string, { status: string; output?: string }[]>;
	};
	return { response, body };
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Each instance starts with an empty bucket, and dropping the held keys makes a JWKS read
 * mint into that bucket instead of serving the previous instance's keys.
 */
beforeEach(async () => {
	app = await createTestApp();
	let { invalidateSigningKeys } = await import("~/app/services/signing-keys");
	invalidateSigningKeys();
});

describe("GET /health", () => {
	/** Reading the JWKS mints the first signing key, which the passing report requires. */
	test("passes when every dependency answers", async () => {
		await app.fetch(new Request(`${ORIGIN}${routes.wellKnown.jwks.href()}`));

		let { response, body } = await report();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/health+json");
		expect(body.status).toBe("pass");
		expect(body.serviceId).toBe("auth");
		expect(body.releaseId).toBe("test-version-id");
		expect(new Set(Object.keys(body.checks))).toEqual(
			new Set([
				"database:responseTime",
				"github:responseTime",
				"kv:responseTime",
				"polar-secret:responseTime",
				"polar:responseTime",
				"pwned-passwords:responseTime",
				"signing-keys:responseTime",
			]),
		);
	});

	test("fails with a 503 when no signing key is stored", async () => {
		let { response, body } = await report();

		expect(response.status).toBe(503);
		expect(body.status).toBe("fail");
		expect(body.checks["signing-keys:responseTime"]?.[0]?.status).toBe("fail");
	});

	test("only warns when a third party is down", async () => {
		await app.fetch(new Request(`${ORIGIN}${routes.wellKnown.jwks.href()}`));
		server.use(
			http.get("https://api.polar.sh/healthz", () => new HttpResponse(null, { status: 503 })),
		);

		let { response, body } = await report();

		expect(response.status).toBe(200);
		expect(body.status).toBe("warn");
		expect(body.checks["polar:responseTime"]?.[0]).toMatchObject({
			status: "warn",
			output: "HTTP 503",
		});
	});
});
