/**
 * Layer ranks and the dependency rule: outer kinds may import inner ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { allowsDependency, layerOf } from "./layers.js";

describe("layerOf", () => {
	test("maps layout folders to layers", () => {
		expect(layerOf("app/models/post.ts")).toBe("models");
		expect(layerOf("app/http/controllers/posts.ts")).toBe("http");
		expect(layerOf("resources/pages/home.tsx")).toBe("resources");
		expect(layerOf("config/site.ts")).toBeNull();
	});
});

describe("allowsDependency", () => {
	test("lets http import models and refuses the reverse", () => {
		expect(allowsDependency("app/http/controllers/a.ts", "app/models/a.ts")).toBe(true);
		expect(allowsDependency("app/models/a.ts", "app/http/controllers/a.ts")).toBe(false);
	});

	test("allows same-layer and unranked imports", () => {
		expect(allowsDependency("app/services/a.ts", "app/services/b.ts")).toBe(true);
		expect(allowsDependency("app/models/a.ts", "config/site.ts")).toBe(true);
	});
});
