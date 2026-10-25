/**
 * Covers RFC 8935 push delivery: `transmitSet` reading a recipient's `202` and the RFC's
 * `400` error figures against MSW, and `setReceiver` answering every verification failure
 * with the error code a transmitter acts on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT, SecurityEventToken } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { SecurityEvents } from "../../security-events.js";

import {
	AUTHENTICATION_FAILED_ERROR,
	INVALID_ISSUER_ERROR,
	INVALID_KEY_ERROR,
} from "../../fixtures/security-events.js";

import { SecurityEventError, TransmissionError } from "./errors.js";
import { setAccepted, setReceiver, setRejected, transmitSet } from "./push.js";

const ENDPOINT = "https://notify.rp.example.com/Events";
const ISSUER = "https://idp.example.com/";
const AUDIENCE = "636C69656E745F6964";
const ACCOUNT_DISABLED = "https://schemas.openid.net/secevent/risc/event-type/account-disabled";

const server = setupServer();

let keys: JWK.KeyPair[];
let otherKeys: JWK.KeyPair[];

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	otherKeys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

/**
 * The RISC account-disabled SET RFC 8935 Figure 1 transmits, signed with `signingKeys`.
 *
 * @param claims - Claims to change from the RFC's
 * @param signingKeys - The keys to sign with
 */
function riscSet(claims: JWT.Payload = {}, signingKeys = keys): Promise<string> {
	return new SecurityEventToken({
		iss: ISSUER,
		jti: "756E69717565206964656E746966696572",
		iat: 1508184845,
		aud: AUDIENCE,
		events: {
			[ACCOUNT_DISABLED]: {
				subject: { subject_type: "iss-sub", iss: ISSUER, sub: "7375626A656374" },
				reason: "hijacking",
			},
		},
		...claims,
	}).sign(JWK.Algorithm.ES256, signingKeys);
}

describe("transmitSet", () => {
	test("POSTs the SET as RFC 8935 Figure 1 does and reads 202 as delivered", async () => {
		let set = await riscSet();
		let seen: Request | undefined;
		server.use(
			http.post(ENDPOINT, ({ request }) => {
				seen = request.clone();
				return new HttpResponse(null, { status: 202 });
			}),
		);

		let result = await transmitSet(ENDPOINT, set, { headers: { Authorization: "Bearer t" } });

		expect(isFailure(result)).toBe(false);
		expect(seen?.headers.get("Content-Type")).toBe("application/secevent+jwt");
		expect(seen?.headers.get("Accept")).toBe("application/json");
		expect(seen?.headers.get("Authorization")).toBe("Bearer t");
		expect(await seen?.text()).toBe(set);
	});

	test.each([
		["Figure 3", INVALID_KEY_ERROR],
		["Figure 4", AUTHENTICATION_FAILED_ERROR],
		["Figure 5", INVALID_ISSUER_ERROR],
	])("reads the 400 of %s as the recipient's refusal", async (_, body) => {
		server.use(
			http.post(ENDPOINT, () =>
				HttpResponse.json(body, { status: 400, headers: { "Content-Language": "en-US" } }),
			),
		);

		let result = await transmitSet(ENDPOINT, await riscSet());

		expect(isFailure(result) && result.error).toBeInstanceOf(SecurityEventError);
		expect(isFailure(result) && result.error).toMatchObject({
			code: body.err,
			description: body.description,
		});
	});

	test("reads a 400 without an error code as no verdict", async () => {
		server.use(http.post(ENDPOINT, () => new HttpResponse("Bad Request", { status: 400 })));

		let result = await transmitSet(ENDPOINT, await riscSet());

		expect(isFailure(result) && result.error).toBeInstanceOf(TransmissionError);
		expect(isFailure(result) && result.error).toMatchObject({ status: 400 });
	});

	test.each([200, 500, 503])("reads a %i as no verdict", async (status) => {
		server.use(http.post(ENDPOINT, () => new HttpResponse(null, { status })));

		let result = await transmitSet(ENDPOINT, await riscSet());

		expect(isFailure(result) && result.error).toMatchObject({ name: "TransmissionError", status });
	});

	test("reads a network failure as no verdict with no status", async () => {
		server.use(http.post(ENDPOINT, () => HttpResponse.error()));

		let result = await transmitSet(ENDPOINT, await riscSet());

		expect(isFailure(result) && result.error).toMatchObject({
			name: "TransmissionError",
			status: null,
		});
	});
});

describe("setReceiver", () => {
	/**
	 * A push endpoint at `POST /Events` that echoes the verified SET's `jti`.
	 *
	 * @param options - Changes to the recipient's verification options
	 */
	function recipient(options: Partial<SecurityEvents.VerifyOptions> = {}) {
		let router = createRouter();
		router.post("/Events", {
			middleware: [setReceiver({ issuers: { [ISSUER]: keys }, audience: AUDIENCE, ...options })],
			handler(ctx) {
				received.push(ctx.securityEvent);
				return setAccepted();
			},
		});
		return router;
	}

	/**
	 * An RFC 8935 push of `body`.
	 *
	 * @param body - The request body
	 * @param contentType - The `Content-Type` it is sent as
	 */
	function push(body: string, contentType = "application/secevent+jwt"): Request {
		return new Request(ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": contentType, Accept: "application/json" },
			body,
		});
	}

	/**
	 * The RFC 8935 error code a response carries, after checking its §2.3 shape.
	 *
	 * @param response - The recipient's answer
	 */
	async function errorCode(response: Response): Promise<string> {
		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Language")).toBe("en");
		expect(response.headers.get("Content-Type")).toContain("application/json");
		let body = (await response.json()) as SecurityEvents.ErrorBody;
		expect(body.description).toEqual(expect.any(String));
		return body.err;
	}

	let received: SecurityEventToken[] = [];
	afterEach(() => {
		received = [];
	});

	test("verifies the SET, publishes it, and answers an empty 202", async () => {
		let response = await recipient().fetch(push(await riscSet()));

		expect(response.status).toBe(202);
		expect(await response.text()).toBe("");
		expect(received).toHaveLength(1);
		expect(received[0]).toBeInstanceOf(SecurityEventToken);
		expect(Object.keys(received[0]?.events ?? {})).toEqual([ACCOUNT_DISABLED]);
	});

	test("accepts a SET sent with line breaks around it", async () => {
		let response = await recipient().fetch(push(`\n${await riscSet()}\n`));

		expect(response.status).toBe(202);
	});

	test("looks the issuer's keys up through a resolver", async () => {
		let response = await recipient({
			issuers: (issuer) => (issuer === ISSUER ? keys : null),
		}).fetch(push(await riscSet()));

		expect(response.status).toBe(202);
	});

	test("verifies as the token class it is given", async () => {
		/** A RISC profile token. */
		class RiscToken extends SecurityEventToken {}

		await recipient({ token: RiscToken }).fetch(push(await riscSet()));

		expect(received[0]).toBeInstanceOf(RiscToken);
	});

	test.each([
		["a body of another media type", async () => push(await riscSet(), "application/jwt")],
		["a body that is not a JWT", async () => push("not a token")],
		["a JWT that is not typed as a SET", async () => push(await untypedSet())],
		["a SET carrying exp", async () => push(await riscSet({ exp: 4102444800 }))],
		["a SET with no events", async () => push(await riscSet({ events: {} }))],
	])("answers invalid_request to %s", async (_, request) => {
		expect(await errorCode(await recipient().fetch(await request()))).toBe("invalid_request");
		expect(received).toHaveLength(0);
	});

	test("answers invalid_issuer to a SET from an issuer it does not accept", async () => {
		let response = await recipient().fetch(
			push(await riscSet({ iss: "https://iss.example.com/" })),
		);

		expect(await errorCode(response)).toBe("invalid_issuer");
	});

	test("answers invalid_key to a SET signed by a key the issuer does not hold", async () => {
		let response = await recipient().fetch(push(await riscSet({}, otherKeys)));

		expect(await errorCode(response)).toBe("invalid_key");
	});

	test("answers invalid_key to a SET signed with an algorithm it does not accept", async () => {
		let response = await recipient({ algorithms: [JWK.Algorithm.RS256] }).fetch(
			push(await riscSet()),
		);

		expect(await errorCode(response)).toBe("invalid_key");
	});

	test("answers invalid_audience to a SET addressed to another recipient", async () => {
		let response = await recipient().fetch(push(await riscSet({ aud: "someone-else" })));

		expect(await errorCode(response)).toBe("invalid_audience");
	});

	test("answers 503 when the issuer's keys cannot be read, so the transmitter retries", async () => {
		let response = await recipient({
			issuers: () => {
				throw new Error("JWKS fetch failed");
			},
		}).fetch(push(await riscSet()));

		expect(response.status).toBe(503);
	});

	test("lets the handler refuse a valid SET with an error of its own", async () => {
		let router = createRouter();
		router.post("/Events", {
			middleware: [setReceiver({ issuers: { [ISSUER]: keys }, audience: AUDIENCE })],
			handler: () => setRejected(new SecurityEventError("access_denied", "Not subscribed")),
		});

		let response = await router.fetch(push(await riscSet()));

		expect(await errorCode(response)).toBe("access_denied");
	});
});

/** The RISC claims signed as a plain JWT, typed `JWT` rather than `secevent+jwt`. */
async function untypedSet(): Promise<string> {
	let set = SecurityEventToken.decode(await riscSet());
	return new JWT(set.payload).sign(JWK.Algorithm.ES256, keys);
}
