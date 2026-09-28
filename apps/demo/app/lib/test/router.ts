/**
 * Drives the real application router — the same middleware chain, controllers and jobs the
 * worker builds — against a database holding the board's own schema. A test substitutes
 * nothing else, so what it asserts on is what a visitor gets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Database } from "remix/data-table";

import { localCaptcha } from "~/app/lib/captcha";
import application from "~/bootstrap/app";

/** The origin every test request is made against. */
export const ORIGIN = "https://demo.test";

/** The schema every test database starts from, read from the migration the app ships. */
const MIGRATION = readFileSync(
	new URL("../../../database/migrations/0001-init.sql", import.meta.url),
	"utf8",
);

/** Opens a fresh in-memory database with the board's schema applied. */
export async function createTestDatabase(): Promise<Database> {
	let binding = createD1Database();
	await binding.exec(MIGRATION.replaceAll("\n", " "));
	return new Database(createD1DatabaseAdapter(binding));
}

/**
 * Fetches a URL through the real router.
 *
 * @param db The database this request reads and writes through.
 * @param path A path or absolute URL to request.
 * @param init Request init. A non-GET request gets `origin` set to {@link ORIGIN} by
 * default, since cross-origin protection is part of the chain under test.
 * @returns The router's response.
 */
export async function fetchApp(
	db: Database,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	let headers = new Headers(init.headers);

	if (init.method && init.method !== "GET" && !headers.has("origin")) {
		headers.set("origin", ORIGIN);
	}

	if (init.body instanceof URLSearchParams && !headers.has("content-type")) {
		headers.set("content-type", "application/x-www-form-urlencoded");
	}

	let request = new Request(new URL(path, ORIGIN), { ...init, headers });

	return await application(() => db, localCaptcha()).fetch(request);
}
