/**
 * Unit tests for the raw TCP connectivity check. `cloudflare:sockets` only exists
 * inside the Workers runtime, so it's stubbed via `mock.module` with a fake
 * `connect()` that returns a controllable fake socket, letting every status
 * (up, down, timeout) be exercised deterministically without a live socket.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, mock, test } from "bun:test";

/** A minimal stand-in for the Workers `Socket` shape `checkTcpConnection` relies on. */
interface FakeSocket {
	opened: Promise<void>;
	close: () => Promise<void>;
}

let nextSocket: FakeSocket;
let closeCalls: FakeSocket[] = [];

/** Builds a fake socket that records whether it was closed. */
function fakeSocket(opened: Promise<void>): FakeSocket {
	let socket: FakeSocket = {
		opened,
		close: async () => {
			closeCalls.push(socket);
		},
	};
	return socket;
}

mock.module("cloudflare:sockets", () => ({
	connect: mock(() => nextSocket),
}));

let { checkTcpConnection } = await import("~/app/services/tcp-check");

describe("checkTcpConnection", () => {
	test("is up when the socket opens before the timeout", async () => {
		nextSocket = fakeSocket(Promise.resolve());

		let result = await checkTcpConnection("example.com", 443, 1000);

		expect(result.status).toBe("up");
		expect(result.errorMessage).toBeUndefined();
		expect(typeof result.responseTimeMs).toBe("number");
	});

	test("closes the socket after a successful connection", async () => {
		closeCalls = [];
		nextSocket = fakeSocket(Promise.resolve());

		await checkTcpConnection("example.com", 443, 1000);

		expect(closeCalls).toHaveLength(1);
	});

	test("is down when the socket fails to open", async () => {
		nextSocket = fakeSocket(Promise.reject(new Error("Connection refused")));

		let result = await checkTcpConnection("example.com", 9999, 1000);

		expect(result.status).toBe("down");
		expect(result.errorMessage).toBe("Connection refused");
		expect(typeof result.responseTimeMs).toBe("number");
	});

	test("closes the socket after a failed connection", async () => {
		closeCalls = [];
		nextSocket = fakeSocket(Promise.reject(new Error("Connection refused")));

		await checkTcpConnection("example.com", 9999, 1000);

		expect(closeCalls).toHaveLength(1);
	});

	test("is timeout when the socket doesn't open within the timeout window", async () => {
		nextSocket = fakeSocket(new Promise(() => {}));

		let result = await checkTcpConnection("example.com", 443, 5);

		expect(result.status).toBe("timeout");
		expect(result.errorMessage).toBe("Connection timed out after 5ms");
	});

	test("closes the socket after a timeout", async () => {
		closeCalls = [];
		nextSocket = fakeSocket(new Promise(() => {}));

		await checkTcpConnection("example.com", 443, 5);

		expect(closeCalls).toHaveLength(1);
	});

	test("does not throw when closing the socket itself fails", async () => {
		nextSocket = {
			opened: Promise.resolve(),
			close: async () => {
				throw new Error("already closed");
			},
		};

		let result = await checkTcpConnection("example.com", 443, 1000);

		expect(result.status).toBe("up");
	});
});
