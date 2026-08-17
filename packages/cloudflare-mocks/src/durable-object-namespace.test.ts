/**
 * Tests for the Durable Object namespace mock: a name routes to the same object every
 * time, an id derived from a name reaches that same object, and the stub the caller
 * supplied is what answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createDurableObjectNamespace } from "./durable-object-namespace";

describe("createDurableObjectNamespace", () => {
	test("routes to the stub the factory built", async () => {
		let namespace = createDurableObjectNamespace((name) => () => new Response(name));

		let response = await namespace.getByName("acme").fetch("https://do/");

		expect(await response.text()).toBe("acme");
	});

	test("accepts an object stub, so RPC methods survive", async () => {
		let namespace = createDurableObjectNamespace(() => ({
			fetch: async () => new Response("ok"),
			async publish(slug: string): Promise<string> {
				return `published:${slug}`;
			},
		}));

		let stub = namespace.getByName("acme");

		// Reached through a cast because the namespace was not parameterized with a branded
		// Durable Object type; a binding taken from a generated `Env` types these directly.
		let rpc = stub as unknown as { publish(slug: string): Promise<string> };

		expect(await rpc.publish("hello")).toBe("published:hello");
		expect(await (await stub.fetch("https://do/")).text()).toBe("ok");
	});

	test("hands back the same object for the same name", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		expect(namespace.getByName("acme")).toBe(namespace.getByName("acme"));
	});

	test("hands back different objects for different names", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		expect(namespace.getByName("acme")).not.toBe(namespace.getByName("globex"));
	});

	test("an id derived from a name reaches the object that name reaches", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		let id = namespace.idFromName("acme");

		expect(namespace.get(id)).toBe(namespace.getByName("acme"));
	});

	test("a stub carries the identity it was resolved under", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		let stub = namespace.getByName("acme");

		expect(stub.name).toBe("acme");
		expect(stub.id.toString()).toBe("acme");
	});

	test("ids compare by the object they address", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		expect(namespace.idFromName("acme").equals(namespace.idFromName("acme"))).toBe(true);
		expect(namespace.idFromName("acme").equals(namespace.idFromName("globex"))).toBe(false);
	});

	test("a unique id addresses an object no name reaches", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		let first = namespace.newUniqueId();

		expect(namespace.get(first)).toBe(namespace.get(first));
		expect(namespace.get(first)).not.toBe(namespace.getByName("acme"));
	});

	test("records the names it resolved, once each", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		namespace.getByName("acme");
		namespace.getByName("globex");
		namespace.getByName("acme");

		expect(namespace.names).toEqual(["acme", "globex"]);
	});

	test("builds the stub once per name", () => {
		let built = 0;
		let namespace = createDurableObjectNamespace(() => {
			built++;
			return () => new Response("ok");
		});

		namespace.getByName("acme");
		namespace.getByName("acme");

		expect(built).toBe(1);
	});

	test("reset forgets the stubs, so the next resolution builds a fresh one", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		let before = namespace.getByName("acme");
		namespace.reset();

		expect(namespace.names).toEqual([]);
		expect(namespace.getByName("acme")).not.toBe(before);
	});

	test("records each resolution, including repeats", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		namespace.getByName("acme");
		namespace.getByName("acme");

		expect(namespace.resolutions).toEqual([{ name: "acme" }, { name: "acme" }]);
	});

	test("records the region a caller asked for", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		namespace.getByName("acme", { locationHint: "weur" });
		namespace.get(namespace.idFromName("globex"), { locationHint: "apac" });

		expect(namespace.resolutions).toEqual([
			{ name: "acme", locationHint: "weur" },
			{ name: "globex", locationHint: "apac" },
		]);
	});

	test("records the jurisdiction a scoped view resolved through", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		namespace.jurisdiction("eu").getByName("acme", { locationHint: "weur" });

		expect(namespace.resolutions).toEqual([
			{ name: "acme", locationHint: "weur", jurisdiction: "eu" },
		]);
	});

	test("a scoped view addresses the same objects as the namespace", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		expect(namespace.jurisdiction("eu").getByName("acme")).toBe(namespace.getByName("acme"));
	});

	test("refuses an id minted outside the view's jurisdiction", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		let unscoped = namespace.idFromName("acme");

		expect(() => namespace.jurisdiction("eu").get(unscoped)).toThrow(
			"belongs to jurisdiction none, but the namespace is scoped to eu",
		);
	});

	test("refuses an id minted under a different jurisdiction", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		let european = namespace.jurisdiction("eu").idFromName("acme");

		expect(() => namespace.jurisdiction("us").get(european)).toThrow(
			"belongs to jurisdiction eu, but the namespace is scoped to us",
		);
	});

	test("accepts an id minted under the same jurisdiction", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));
		let european = namespace.jurisdiction("eu");

		expect(european.get(european.idFromName("acme"))).toBe(european.getByName("acme"));
	});

	test("reset clears the recorded resolutions", () => {
		let namespace = createDurableObjectNamespace(() => () => new Response("ok"));

		namespace.getByName("acme");
		namespace.reset();

		expect(namespace.resolutions).toEqual([]);
	});
});
