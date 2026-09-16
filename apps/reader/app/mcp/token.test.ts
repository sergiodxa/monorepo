/**
 * Checks the credential an agent presents: that a token this deployment minted names the
 * reader it was minted for, that anything else names nobody, and that what a row keeps
 * about it is a digest rather than something that could be presented again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { agentTokenHash, mintAgentToken, readAgentToken, TOKEN_PREFIX } from "~/app/mcp/token";

/** One reader's OIDC subject, which is the name of the object a token resolves to. */
const SUBJECT = "01J0READER0000000000000000";

describe("minting", () => {
	test("hands back a token under this app's own prefix", async () => {
		let minted = await mintAgentToken(SUBJECT);

		expect(minted.token.startsWith(TOKEN_PREFIX)).toBe(true);
	});

	test("names a row whose id says what kind of thing it is", async () => {
		let minted = await mintAgentToken(SUBJECT);

		expect(minted.tokenId.startsWith("tok_")).toBe(true);
	});

	/** Two tokens minted for one reader are two rows, so neither revokes the other. */
	test("mints a fresh row id every time", async () => {
		let [first, second] = await Promise.all([mintAgentToken(SUBJECT), mintAgentToken(SUBJECT)]);

		expect(first.tokenId).not.toBe(second.tokenId);
		expect(first.token).not.toBe(second.token);
	});

	test("keeps a digest rather than anything that could be presented again", async () => {
		let minted = await mintAgentToken(SUBJECT);

		expect(minted.hash).toMatch(/^[\da-f]{64}$/);
		expect(minted.token).not.toContain(minted.hash);
	});

	test("hashes a presented token to what its row holds", async () => {
		let minted = await mintAgentToken(SUBJECT);

		expect(await agentTokenHash(minted.token)).toBe(minted.hash);
	});
});

describe("reading", () => {
	test("resolves a token this app minted to the reader and row it names", async () => {
		let minted = await mintAgentToken(SUBJECT);

		expect(await readAgentToken(minted.token)).toEqual({
			subject: SUBJECT,
			tokenId: minted.tokenId,
		});
	});

	test.each([
		["a wrong signature", (token: string) => `${token.slice(0, -2)}xy`],
		["a truncated signature", (token: string) => token.slice(0, token.indexOf(".") + 4)],
		["no signature at all", (token: string) => token.slice(0, token.indexOf("."))],
		["another prefix", (token: string) => token.replace(TOKEN_PREFIX, "api_")],
		["nothing at all", () => ""],
		["a value that is not a token", () => "not a token"],
	])("refuses %s", async (_label, mangle) => {
		let minted = await mintAgentToken(SUBJECT);

		expect(await readAgentToken(mangle(minted.token))).toBeNull();
	});

	/**
	 * The payload is readable without the key, so the signature is what stops a caller
	 * rewriting the subject and reaching somebody else's object.
	 */
	test("refuses a payload rewritten to name another reader", async () => {
		let minted = await mintAgentToken(SUBJECT);
		let other = await mintAgentToken("01J0OTHER00000000000000000");

		let [, signature = ""] = minted.token.slice(TOKEN_PREFIX.length).split(".");
		let [payload = ""] = other.token.slice(TOKEN_PREFIX.length).split(".");

		expect(await readAgentToken(`${TOKEN_PREFIX}${payload}.${signature}`)).toBeNull();
	});
});
