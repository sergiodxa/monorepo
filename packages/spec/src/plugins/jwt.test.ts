/**
 * Tests for the built-in `jwt` plugin. `jwt.decode` is exercised against a
 * known literal token with no network. `jwt.verify` is exercised against a real
 * ES256 keypair: the test generates the keypair with WebCrypto, hand-signs
 * tokens, and serves the matching JWKS from an in-process HTTP server, so a
 * genuine signature verification — valid, tampered, expired, wrong-key — runs
 * end to end without any external service.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createServer } from "node:http";

import type { Result } from "@pkg/result";

import { failure, isFailure, success, unwrap } from "@pkg/result";
import { beforeAll, describe, expect, test } from "vitest";

import type { SpecError } from "../errors";
import type { PermissionSet } from "../permissions";
import type { ToolContext } from "../plugin";
import type { ToolArg, Value, ValueObject } from "../values";
import type { Workspace } from "../workspace";

import { PermissionDeniedError } from "../errors";

import { createJwtPlugin } from "./jwt";

const PLUGIN = createJwtPlugin();

/** A public JWK plus the private key that signs tokens verifiable against it. */
interface Signer {
	/** The public JWK as published in a JWKS `keys` array (kty/crv/x/y). */
	jwk: { kty: string; crv: string; x: string; y: string };
	/** The private key used to sign, never published. */
	privateKey: CryptoKey;
}

/** A running JWKS endpoint and the URL a spec would point `jwt.verify` at. */
interface JwksServer {
	/** The absolute `.well-known/jwks.json` URL. */
	url: string;
	/**
	 * Stop the server, dropping live sockets first: the plugin's fetch may
	 * leave a keep-alive connection open, which `close` alone would wait on.
	 */
	stop(): void;
}

let signerOne: Signer;
let signerTwo: Signer;

beforeAll(async () => {
	signerOne = await makeSigner();
	signerTwo = await makeSigner();
});

/** Generate an ES256 keypair and export its public JWK (kty/crv/x/y only). */
async function makeSigner(): Promise<Signer> {
	let pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
		"sign",
		"verify",
	]);
	let full = await crypto.subtle.exportKey("jwk", pair.publicKey);
	return {
		jwk: { kty: String(full.kty), crv: String(full.crv), x: String(full.x), y: String(full.y) },
		privateKey: pair.privateKey,
	};
}

/** base64url-encode raw bytes, unpadded. */
function b64urlBytes(bytes: Uint8Array): string {
	let binary = "";
	for (let byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url-encode a UTF-8 string, unpadded. */
function b64urlString(text: string): string {
	return b64urlBytes(new TextEncoder().encode(text));
}

/** Build a JWT header/payload pair into its two encoded segments. */
function segments(header: ValueObject, payload: ValueObject): string {
	return `${b64urlString(JSON.stringify(header))}.${b64urlString(JSON.stringify(payload))}`;
}

/** Sign a real ES256 token: header carries the kid, signature covers h.p. */
async function sign(
	signer: Signer,
	kid: string,
	payload: ValueObject,
	alg = "ES256",
): Promise<string> {
	let input = segments({ alg, kid }, payload);
	let signature = new Uint8Array(
		await crypto.subtle.sign(
			{ name: "ECDSA", hash: "SHA-256" },
			signer.privateKey,
			new TextEncoder().encode(input),
		),
	);
	return `${input}.${b64urlBytes(signature)}`;
}

/** Seconds since the epoch, offset by `delta`. */
function epoch(delta = 0): number {
	return Math.floor(Date.now() / 1000) + delta;
}

/**
 * Serve a JWKS body containing the given keys (each already carrying a kid) on
 * an ephemeral port. Resolves only once the port is known, so the URL it hands
 * back is immediately fetchable.
 */
async function serveJwks(keys: object[]): Promise<JwksServer> {
	let server = createServer((_request, response) => {
		response.writeHead(200, { "content-type": "application/json" });
		response.end(JSON.stringify({ keys }));
	});
	let port = await new Promise<number>((settle) => {
		server.listen(0, () => {
			let address = server.address();
			settle(typeof address === "object" && address !== null ? address.port : 0);
		});
	});
	return {
		url: `http://localhost:${port}/.well-known/jwks.json`,
		stop: () => {
			server.closeAllConnections();
			server.close();
		},
	};
}

/** Wrap a runtime value as a positional value argument. */
function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

/** A permission set that grants everything, for happy-path verify calls. */
function allowAll(): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		grantedEnvNames: () => [],
	};
}

/** A permission set denying net, recording the host and port it was asked about. */
function denyNet(calls: { host: string; port: number | undefined }[]): PermissionSet {
	return {
		...allowAll(),
		checkNet: (host, port) => {
			calls.push({ host, port });
			return failure(new PermissionDeniedError("net", host, `spec run --allow-net=${host}`));
		},
	};
}

/** A workspace stub; jwt tools operate entirely on the token and JWKS URL. */
function stubWorkspace(): Workspace {
	return {
		root: "/tmp/spec-jwt-tests",
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
}

/** Build a tool context from a permission set (defaults to allow-all). */
function buildContext(permissions: PermissionSet = allowAll()): ToolContext {
	return { workspace: stubWorkspace(), permissions };
}

/** Read a result value as an object, failing the test when it is not one. */
function asObject(data: Value | undefined): ValueObject {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error(`expected an object value, got ${JSON.stringify(data)}`);
	}
	return data;
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
}

describe(createJwtPlugin.name, () => {
	test("describes decode (permissionless observable) and verify (net action)", () => {
		expect(PLUGIN.namespace).toBe("jwt");
		let tools = PLUGIN.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["decode", "verify"]);
		let decode = tools.find((tool) => tool.name === "decode");
		expect(decode?.kind).toBe("observable");
		expect(decode?.requires).toBeUndefined();
		expect(decode?.params.map((param) => [param.name, param.required])).toEqual([["token", true]]);
		let verify = tools.find((tool) => tool.name === "verify");
		expect(verify?.kind).toBe("action");
		expect(verify?.requires).toBe("net");
		expect(verify?.params.map((param) => [param.name, param.required])).toEqual([
			["token", true],
			["jwks_url", true],
		]);
	});

	test("decode splits a known token into its header and payload, no signature check", async () => {
		let token = `${segments({ alg: "ES256", kid: "k1" }, { sub: "user-1", aud: "client-1" })}.c2ln`;
		let decoded = asObject(unwrap(await PLUGIN.call("decode", [value(token)], buildContext())));
		expect(asObject(decoded.header)).toEqual({ alg: "ES256", kid: "k1" });
		expect(asObject(decoded.payload)).toEqual({ sub: "user-1", aud: "client-1" });
	});

	test("decode needs no permissions", async () => {
		let token = `${segments({ alg: "ES256" }, { sub: "x" })}.sig`;
		let calls: { host: string; port: number | undefined }[] = [];
		let decoded = asObject(
			unwrap(await PLUGIN.call("decode", [value(token)], buildContext(denyNet(calls)))),
		);
		expect(asObject(decoded.payload).sub).toBe("x");
		expect(calls).toEqual([]);
	});

	test("decode of a token without three parts is a tool error", async () => {
		let error = unwrapError(await PLUGIN.call("decode", [value("only.two")], buildContext()));
		expect(error.code).toBe("tool-error");
	});

	test("decode of a non-JSON segment is a tool error", async () => {
		let error = unwrapError(
			await PLUGIN.call("decode", [value("bm90anNvbg.bm90anNvbg.sig")], buildContext()),
		);
		expect(error.code).toBe("tool-error");
	});

	test("verify returns the payload for a genuinely signed token", async () => {
		let jwks = await serveJwks([{ ...signerOne.jwk, kid: "k1" }]);
		try {
			let token = await sign(signerOne, "k1", {
				sub: "user-1",
				iss: "auth.sergiodxa.com",
				aud: "client-1",
				exp: epoch(3600),
			});
			let payload = asObject(
				unwrap(await PLUGIN.call("verify", [value(token), value(jwks.url)], buildContext())),
			);
			expect(payload.sub).toBe("user-1");
			expect(payload.iss).toBe("auth.sergiodxa.com");
			expect(payload.aud).toBe("client-1");
		} finally {
			jwks.stop();
		}
	});

	test("verify rejects a tampered token as a signature tool error", async () => {
		let jwks = await serveJwks([{ ...signerOne.jwk, kid: "k1" }]);
		try {
			let token = await sign(signerOne, "k1", { sub: "user-1", exp: epoch(3600) });
			let parts = token.split(".");
			let payloadSeg = parts[1] ?? "";
			let flipped = payloadSeg.slice(0, -1) + (payloadSeg.endsWith("A") ? "B" : "A");
			let tampered = `${parts[0]}.${flipped}.${parts[2]}`;
			let error = unwrapError(
				await PLUGIN.call("verify", [value(tampered), value(jwks.url)], buildContext()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message.toLowerCase()).toContain("signature");
		} finally {
			jwks.stop();
		}
	});

	test("verify without a net grant is denied before the JWKS is fetched", async () => {
		let jwks = await serveJwks([{ ...signerOne.jwk, kid: "k1" }]);
		try {
			let token = await sign(signerOne, "k1", { sub: "user-1", exp: epoch(3600) });
			let calls: { host: string; port: number | undefined }[] = [];
			let error = unwrapError(
				await PLUGIN.call("verify", [value(token), value(jwks.url)], buildContext(denyNet(calls))),
			);
			expect(error).toBeInstanceOf(PermissionDeniedError);
			expect(error.code).toBe("permission-denied");
			expect(calls[0]?.host).toBe("localhost");
		} finally {
			jwks.stop();
		}
	});

	test("verify rejects an expired token", async () => {
		let jwks = await serveJwks([{ ...signerOne.jwk, kid: "k1" }]);
		try {
			let token = await sign(signerOne, "k1", { sub: "user-1", exp: epoch(-10) });
			let error = unwrapError(
				await PLUGIN.call("verify", [value(token), value(jwks.url)], buildContext()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message.toLowerCase()).toContain("expired");
		} finally {
			jwks.stop();
		}
	});

	test("verify rejects a token whose kid is not in the JWKS", async () => {
		let jwks = await serveJwks([
			{ ...signerOne.jwk, kid: "k1" },
			{ ...signerTwo.jwk, kid: "k2" },
		]);
		try {
			let token = await sign(signerOne, "k3", { sub: "user-1", exp: epoch(3600) });
			let error = unwrapError(
				await PLUGIN.call("verify", [value(token), value(jwks.url)], buildContext()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("k3");
		} finally {
			jwks.stop();
		}
	});

	test("verify selects the right key by kid among several", async () => {
		let jwks = await serveJwks([
			{ ...signerOne.jwk, kid: "k1" },
			{ ...signerTwo.jwk, kid: "k2" },
		]);
		try {
			let token = await sign(signerTwo, "k2", { sub: "user-2", exp: epoch(3600) });
			let payload = asObject(
				unwrap(await PLUGIN.call("verify", [value(token), value(jwks.url)], buildContext())),
			);
			expect(payload.sub).toBe("user-2");
		} finally {
			jwks.stop();
		}
	});

	test("verify rejects a non-ES256 algorithm", async () => {
		let jwks = await serveJwks([{ ...signerOne.jwk, kid: "k1" }]);
		try {
			let token = await sign(signerOne, "k1", { sub: "user-1", exp: epoch(3600) }, "HS256");
			let error = unwrapError(
				await PLUGIN.call("verify", [value(token), value(jwks.url)], buildContext()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message).toContain("ES256");
		} finally {
			jwks.stop();
		}
	});

	test("verify wrong signing key fails the signature check", async () => {
		let jwks = await serveJwks([{ ...signerOne.jwk, kid: "k1" }]);
		try {
			let token = await sign(signerTwo, "k1", { sub: "user-1", exp: epoch(3600) });
			let error = unwrapError(
				await PLUGIN.call("verify", [value(token), value(jwks.url)], buildContext()),
			);
			expect(error.code).toBe("tool-error");
			expect(error.message.toLowerCase()).toContain("signature");
		} finally {
			jwks.stop();
		}
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let error = unwrapError(await PLUGIN.call("sign", [value("x")], buildContext()));
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("decode, verify");
	});
});
