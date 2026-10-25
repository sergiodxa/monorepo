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

	test("lets every layer read route contracts, and handlers read the views they render", () => {
		expect(allowsDependency("app/http/controllers/home.tsx", "routes/web.ts")).toBe(true);
		expect(allowsDependency("app/emails/links.ts", "routes/web.ts")).toBe(true);
		expect(
			allowsDependency("app/http/controllers/home.tsx", "resources/layouts/document.tsx"),
		).toBe(true);
		expect(allowsDependency("resources/views/home.tsx", "app/initializers/seo.ts")).toBe(true);
		expect(allowsDependency("resources/views/home.tsx", "app/http/controllers/home.tsx")).toBe(
			false,
		);
		expect(allowsDependency("routes/web.ts", "app/models/post.ts")).toBe(false);
	});

	test("lets initializers read declarations and the middleware a router composes", () => {
		expect(allowsDependency("app/initializers/cli.ts", "app/commands/index.ts")).toBe(true);
		expect(allowsDependency("app/initializers/dispatcher.ts", "app/jobs/index.ts")).toBe(true);
		expect(allowsDependency("app/initializers/router.tsx", "app/http/middleware/timing.ts")).toBe(
			true,
		);
		expect(allowsDependency("app/initializers/cli.ts", "app/commands/about.ts")).toBe(false);
		expect(allowsDependency("app/models/post.ts", "app/http/middleware/timing.ts")).toBe(false);
	});

	test("allows same-layer and unranked imports", () => {
		expect(allowsDependency("app/services/a.ts", "app/services/b.ts")).toBe(true);
		expect(allowsDependency("app/models/a.ts", "config/site.ts")).toBe(true);
	});
});
