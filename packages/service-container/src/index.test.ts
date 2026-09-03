/**
 * Verifies ServiceContainer's singleton, scoped, and instance registrations
 * resolve correctly across parent/child scopes, and that `inject()` binds
 * dependencies for Remix controller actions.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ContextEntries, RequestContext } from "remix/router";

import { asyncContext } from "remix/middleware/async-context";
import { renderWith } from "remix/middleware/render";
import { createController } from "remix/router";
import { route } from "remix/routes";
import { describe, expect, test } from "vitest";

import {
	getServiceContainer,
	inject,
	ServiceContainer,
	ServiceContainerScopeError,
	ServiceNotFoundError,
} from "./index.js";

class Database {
	constructor(readonly id: number) {}

	async query(_sql: string): Promise<number[]> {
		return [this.id];
	}
}

class Logger {
	readonly messages: string[] = [];

	info(message: string) {
		this.messages.push(message);
	}
}

class MissingService {}

interface TestContext {
	name: string;
}

interface JobContext {
	jobName: string;
}

/**
 * The context a controller action receives once `renderWith()` has run: route
 * params plus the installed renderer. Entries stay open (`ContextEntries`) so the
 * middleware stack's own entry list still satisfies it.
 */
interface ControllerContext extends RequestContext<Record<string, string>, ContextEntries> {
	render(data: unknown): Response;
}

describe(ServiceContainer.name, () => {
	test("reuses singleton instances across request scopes", () => {
		let container = new ServiceContainer();
		let calls = 0;

		container.singleton(Database, () => new Database(++calls));

		let first = container.scope(() => inject([Database] as const, (database) => database)());
		let second = container.scope(() => inject([Database] as const, (database) => database)());

		expect(first).toBe(second);
		expect(calls).toBe(1);
	});

	test("reuses scoped instances inside the resolving scope", () => {
		let container = new ServiceContainer();
		let calls = 0;

		container.scoped(Database, () => new Database(++calls));

		let same = container.scope(() => {
			let first = inject([Database] as const, (database) => database)();
			let second = inject([Database] as const, (database) => database)();

			return first === second;
		});

		expect(same).toBe(true);
		expect(calls).toBe(1);
	});

	test("isolates scoped instances between request scopes", () => {
		let container = new ServiceContainer();

		container.scoped(Database, () => new Database(Math.random()));

		let first = container.scope(() => inject([Database] as const, (database) => database)());
		let second = container.scope(() => inject([Database] as const, (database) => database)());

		expect(first).not.toBe(second);
	});

	test("uses parent registrations from child scopes", () => {
		let container = new ServiceContainer();

		container.scoped(Database, () => new Database(1));

		expect(
			container.scope(() => inject([Database] as const, (database) => database)()),
		).toBeInstanceOf(Database);
	});

	test("returns instances registered on the container", () => {
		let container = new ServiceContainer();
		let logger = new Logger();

		container.instance(Logger, logger);

		expect(container.get(Logger)).toBe(logger);
	});

	test("resolves parent instance registrations from child scopes", () => {
		/**
		 * Registers a pre-constructed value with `instance()` on the container,
		 * then wraps request work in `scope()` so it resolves via `inject()` or
		 * `getServiceContainer()` — the pattern for per-request dependencies.
		 */
		let container = new ServiceContainer();
		let database = new Database(7);

		container.instance(Database, database);

		let direct = container.scope(() => getServiceContainer().get(Database));
		let injected = container.scope(() => inject([Database] as const, (db) => db)());

		expect(direct).toBe(database);
		expect(injected).toBe(database);
	});

	test("prefers a child scope instance over a parent registration", () => {
		let container = new ServiceContainer();
		let parentDatabase = new Database(1);
		let childDatabase = new Database(2);

		container.instance(Database, parentDatabase);

		let resolved = container.scope(() => {
			getServiceContainer().instance(Database, childDatabase);

			return getServiceContainer().get(Database);
		});

		expect(resolved).toBe(childDatabase);
		expect(container.get(Database)).toBe(parentDatabase);
	});

	test("throws a diagnostic error for missing registrations", () => {
		let container = new ServiceContainer();

		expect(() => container.get(MissingService)).toThrow(ServiceNotFoundError);
		expect(() => container.get(MissingService)).toThrow("Service not found: MissingService");
	});
});

describe(inject.name, () => {
	test("resolves dependencies from the active service container", () => {
		let container = new ServiceContainer();
		let database = new Database(1);
		let logger = new Logger();
		let context: TestContext = { name: "test" };

		container.singleton(Database, () => database);
		container.singleton(Logger, () => logger);

		let result = container.scope(() =>
			inject([Database, Logger] as const, (db, log) => {
				log.info("loaded");

				return { contextName: context.name, id: db.id };
			})(),
		);

		expect(result).toEqual({ contextName: "test", id: 1 });
		expect(logger.messages).toEqual(["loaded"]);
	});

	test("supports callbacks that close over any context shape", () => {
		let container = new ServiceContainer();
		let database = new Database(1);
		let context: JobContext = { jobName: "sync-items" };

		container.singleton(Database, () => database);

		let result = container.scope(() => {
			return inject([Database] as const, (db) => `${context.jobName}:${db.id}`)();
		});

		expect(result).toBe("sync-items:1");
	});

	test("forwards one runtime argument after injected dependencies", () => {
		let container = new ServiceContainer();
		let database = new Database(1);
		let context: TestContext = { name: "controller" };

		container.singleton(Database, () => database);

		let result = container.scope(() => {
			let handler = inject([Database] as const, (db, ctx: TestContext) => {
				return `${ctx.name}:${db.id}`;
			});

			return handler(context);
		});

		expect(result).toBe("controller:1");
	});

	test("requires an active service container scope", () => {
		let handler = inject([Database] as const, () => new Response());

		expect(() => handler()).toThrow(ServiceContainerScopeError);
	});

	test("keeps Remix controller context as the handler context", () => {
		let container = new ServiceContainer();
		let database = new Database(1);
		let logger = new Logger();
		let routes = route({ something: { index: "/" } });

		container.singleton(Database, () => database);
		container.singleton(Logger, () => logger);

		let action = inject([Database, Logger] as const, async (db, log, ctx: ControllerContext) => {
			log.info("Handling index action");
			let users = await db.query("SELECT * FROM users");
			return ctx.render({ users });
		});

		let controller = createController(routes.something, {
			middleware: [
				asyncContext(),
				renderWith(() => (data: unknown) => new Response(JSON.stringify(data))),
			],
			actions: { index: action },
		});

		let _action: (ctx: ControllerContext) => Promise<Response> = action;

		expect(container.scope(() => typeof _action)).toBe("function");
		expect(controller).toBeDefined();
	});
});
