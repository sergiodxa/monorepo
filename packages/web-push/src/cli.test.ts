/**
 * Drives `sdxc-web-push` through `invoke()`: the key pair `vapid keygen` prints in both forms,
 * and `send` against a push service MSW stands in for, covering where keys and subscriptions
 * come from, the reports it prints and the exit code each outcome maps to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { Base64Url } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

import type { VapidKeyPair } from "./index.js";

import { WebPush } from "./index.js";

/** A subscription on Firebase with RFC 8291's example client keys, as a browser reports it. */
const SUBSCRIPTION = {
	endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
	expirationTime: null,
	keys: {
		p256dh:
			"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
		auth: "BTBZMqHH6r4Tts7J_aSIgg",
	},
};

/** The contact every send names. */
const SUBJECT = "mailto:ops@example.com";

/** What the push service received, in order. */
let received: Request[] = [];

/** A scratch directory holding this test's subscription and keys files. */
let directory = "";

/** A fresh pair, written to `keys.json` in `directory`. */
let keys: VapidKeyPair;

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	received = [];
	answer(201);
	directory = await mkdtemp(join(tmpdir(), "sdxc-web-push-"));
	keys = await WebPush.generateKeys();
	await writeFile(join(directory, "keys.json"), JSON.stringify(keys));
	await writeFile(join(directory, "subscription.json"), JSON.stringify(SUBSCRIPTION));
	return () => rm(directory, { recursive: true, force: true });
});

/** Answers every push with one status, recording what arrived. */
function answer(status: number): void {
	server.use(
		http.post(/.*/u, ({ request }) => {
			received.push(request.clone());
			return new HttpResponse(null, { status });
		}),
	);
}

/** Runs `send` from the scratch directory with the given extra arguments. */
function send(argv: string[], options: { stdin?: string; env?: Record<string, string> } = {}) {
	return invoke(cli, ["send", ...argv, "--subject", SUBJECT], { cwd: directory, ...options });
}

describe("vapid keygen", () => {
	test("prints the pair as environment lines", async () => {
		let run = await invoke(cli, ["vapid", "keygen"]);

		expect(run.code).toBe(0);
		let match = /^VAPID_PUBLIC_KEY=(\S+)\nVAPID_PRIVATE_KEY=(\S+)\n$/u.exec(run.stdout);
		expect(match).not.toBeNull();
		expect(unwrap(Base64Url.decode(match?.[1] ?? ""))).toHaveLength(65);
		expect(unwrap(Base64Url.decode(match?.[2] ?? ""))).toHaveLength(32);
	});

	test("prints the pair as the JSON send --keys-file reads", async () => {
		let run = await invoke(cli, ["vapid", "keygen", "--json"]);

		expect(run.code).toBe(0);
		let printed = JSON.parse(run.stdout) as VapidKeyPair;
		expect(printed).toEqual({ publicKey: expect.any(String), privateKey: expect.any(String) });
		expect(unwrap(Base64Url.decode(printed.publicKey))).toHaveLength(65);
	});

	test("prints a new pair on every run", async () => {
		let first = await invoke(cli, ["vapid", "keygen"]);
		let second = await invoke(cli, ["vapid", "keygen"]);

		expect(first.stdout).not.toBe(second.stdout);
	});
});

describe("send", () => {
	test("delivers to the subscription with keys from a file", async () => {
		let run = await send(["subscription.json", "--keys-file", "keys.json", "--topic", "deploys"]);

		expect(run).toMatchObject({ code: 0, stdout: "Sent: the push service answered 201\n" });
		expect(received).toHaveLength(1);
		expect(received[0]?.url).toBe(SUBSCRIPTION.endpoint);
		expect(received[0]?.headers.get("authorization")).toContain(`k=${keys.publicKey}`);
		expect(received[0]?.headers.get("topic")).toBe("deploys");
	});

	test("reads the subscription from stdin and the keys from named variables", async () => {
		let run = await send(["--json", "--private-key-env", "PUSH_SECRET", "--ttl", "1 hour"], {
			stdin: JSON.stringify(SUBSCRIPTION),
			env: { VAPID_PUBLIC_KEY: keys.publicKey, PUSH_SECRET: keys.privateKey },
		});

		expect(run).toMatchObject({ code: 0, stdout: '{"sent":true,"status":201}\n' });
		expect(received[0]?.headers.get("ttl")).toBe("3600");
	});

	test("exits 1 and says the subscription is gone on a 410", async () => {
		answer(410);
		let run = await send(["subscription.json", "--keys-file", "keys.json"]);

		expect(run.code).toBe(1);
		expect(run.stderr).toContain("(gone)");
	});

	test("reports a refusal as JSON", async () => {
		answer(429);
		let run = await send(["subscription.json", "--keys-file", "keys.json", "--json"]);

		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			sent: false,
			code: "rate-limited",
			retryable: true,
			host: "fcm.googleapis.com",
			status: 429,
			retryAfter: null,
		});
	});

	test("exits 2 without a request when no keys are given", async () => {
		let run = await send(["subscription.json"]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY");
		expect(received).toEqual([]);
	});

	test("exits 2 when the keys do not form a pair", async () => {
		let other = await WebPush.generateKeys();
		let run = await send(["subscription.json"], {
			env: { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: other.privateKey },
		});

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("(invalid-vapid)");
		expect(received).toEqual([]);
	});

	test("exits 2 on a subscription missing its keys", async () => {
		let run = await send(["-", "--keys-file", "keys.json"], {
			stdin: JSON.stringify({ endpoint: SUBSCRIPTION.endpoint }),
		});

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("The subscription is invalid at keys");
	});

	test("exits 2 on a file that does not exist", async () => {
		let run = await send(["missing.json", "--keys-file", "keys.json"]);

		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Could not read the subscription at missing.json");
	});

	test("exits 2 on a duration it cannot read", async () => {
		let run = await send(["subscription.json", "--keys-file", "keys.json", "--ttl", "soon"]);

		expect(run.code).toBe(2);
		expect(received).toEqual([]);
	});
});
