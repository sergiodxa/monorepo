/**
 * Tests for the Privacy Pass provider behind the `captcha` middleware, redeeming the
 * published RFC 9578 token for a shared challenge: a request without a token is challenged
 * with a 401, a token passes once, and a replay is challenged again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Base64Url, Hex } from "@sdxc/crypto";
import { MemoryRedemptionStore, PrivacyPass, importTokenKey } from "@sdxc/privacy-pass";
import { isFailure, success, unwrap } from "@sdxc/result";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { captcha } from "./middleware.js";
import { PrivacyPassCaptcha } from "./privacy-pass.js";

/** The issuer key RFC 9578 Appendix A.2 signs every token with. */
const TOKEN_KEY =
	"30820152303d06092a864886f70d01010a3030a00d300b0609608648016503040202a11a301806092a864886f70d010108300b0609608648016503040202a2030201300382010f003082010a0282010100cb1aed6b6a95f5b1ce013a4cfcab25b94b2e64a23034e4250a7eab43c0df3a8c12993af12b111908d4b471bec31d4b6c9ad9cdda90612a2ee903523e6de5a224d6b02f09e5c374d0cfe01d8f529c500a78a2f67908fa682b5a2b430c81eaf1af72d7b5e794fc98a3139276879757ce453b526ef9bf6ceb99979b8423b90f4461a22af37aab0cf5733f7597abe44d31c732db68a181c6cbbe607d8c0e52e0655fd9996dc584eca0be87afbcd78a337d17b1dba9e828bbd81e291317144e7ff89f55619709b096cbb9ea474cead264c2073fe49740c01f00e109106066983d21e5f83f086e2e823c879cd43cef700d2a352a9babd612d03cad02db134b7e225a5f0203010001";

/** RFC 9578 Appendix A.2 vector 2: a token for `issuer.example`, `origin.example`, no context. */
const TOKEN =
	"000298c1345ff38a554b429b428b0f206cfe4f3892f8041995f2c24873d90e84488d11e15c91a7c2ad02abd66645802373db1d823bea80f08d452541fb2b62b5898bca572f8982a9ca248a3056186322d93ca147266121ddeb5632c07f1f71cd27083350a206c5e9b7c0898f97611ce0bb8d74d310bb194ab67e094e32ff6da90886924b1b9e7b569402c1101d896d2fc3a7371ef77f02310db1dc9f81c8535828c2d0e9d9051720d182cd54e1c2c3bf417da2fc7aa72bb70ccc834ef274a2e809c9821b3d395d6535423f7428b3f29175d6eb840b4b7685336e57e2b6afeaabc0c17ea4f557e8a9cc2f624e245c6ccd7cbdd6c32c97c5c6974e802f688e2d25f0aba4215f609f692244517d5d3407e0172273982c001c158f5fcbe1b5d2447c26a87e89f5a9e72b498b0c59ce749823d2cf253d3cf6cd4e64fa0e434d95e488789247a9ceed756ff4ff33a8d2402c0db381236d331092838b608a42002552092897";

/**
 * A provider redeeming tokens for RFC 9578's shared challenge.
 *
 * @returns The provider
 */
async function provider(): Promise<PrivacyPassCaptcha> {
	let key = unwrap(await importTokenKey(unwrap(Hex.decode(TOKEN_KEY))));
	return new PrivacyPassCaptcha(
		new PrivacyPass({
			issuer: "issuer.example",
			originInfo: ["origin.example"],
			redemptionContext: "empty",
			keys: { keys: async () => success([key]) },
			store: new MemoryRedemptionStore(),
		}),
	);
}

/**
 * A POST to the guarded route.
 *
 * @param authorization - The `Authorization` value to send, if any
 * @returns The request
 */
function post(authorization?: string): Request {
	return new Request("https://origin.example.com/sign-up", {
		method: "POST",
		headers: authorization === undefined ? {} : { Authorization: authorization },
	});
}

/** The credentials carrying the vector's token. */
let credentials = `PrivateToken token="${Base64Url.encode(unwrap(Hex.decode(TOKEN)))}"`;

describe("PrivacyPassCaptcha", () => {
	test("challenges a request without a token with a 401", async () => {
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(await provider())],
			handler: () => new Response("Welcome"),
		});

		let response = await router.fetch(post());

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toMatch(
			/^PrivateToken challenge="AAIADmlzc3Vlci5leGFtcGxlAAAOb3JpZ2luLmV4YW1wbGU=", token-key="MIIBUjA9/,
		);
	});

	test("passes a token once and challenges its replay", async () => {
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(await provider())],
			handler: (ctx) => Response.json(ctx.captcha),
		});

		let first = await router.fetch(post(credentials));
		let replay = await router.fetch(post(credentials));

		expect(first.status).toBe(200);
		expect(await first.json()).toEqual({ status: "success", data: {} });
		expect(replay.status).toBe(401);
	});

	test("reports the Privacy Pass code to an onFailure that answers", async () => {
		let router = createRouter();
		router.post("/sign-up", {
			middleware: [captcha(await provider(), { onFailure: () => null })],
			handler: (ctx) =>
				Response.json(isFailure(ctx.captcha) ? ctx.captcha.error : null, { status: 403 }),
		});

		let response = await router.fetch(post('PrivateToken token="AAIA"'));

		expect(await response.json()).toMatchObject({
			code: "rejected",
			providerCodes: ["malformed-token"],
		});
	});

	test("reads only PrivateToken credentials", async () => {
		let instance = await provider();

		expect(instance.readToken(post("Bearer abc"))).toBeNull();
		expect(instance.readToken(post(credentials))).toBe(credentials);
	});
});
