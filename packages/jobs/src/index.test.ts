import { describe, test } from "bun:test";

import { ExecutionContext, Message } from "@cloudflare/workers-types";

import { Job } from "./index";

class MyJob extends Job {
	static identifier = "MyJob";
	async perform(): Promise<void> {
		this.logger.info("Running MyJob:", { message: this.message });
	}
}

describe(Job, () => {
	test("should run MyJob and log the message", async () => {
		let message = {
			id: crypto.randomUUID(),
			timestamp: new Date(),
			body: "Hello, World!",
			attempts: 0,
			retry() {},
			async ack() {},
		} satisfies Message;

		let ctx = {
			waitUntil() {},
			passThroughOnException() {},
			props: {},
		} satisfies ExecutionContext;

		await MyJob.now(message, ctx);
	});
});
