/**
 * Seeding: the rows a fresh local database starts with, written by the seeders in
 * `database/seeders/` through the app's models and test factories, so seeded rows pass the
 * same rules the app's own writes do.
 */

import type { Factories } from "@sdxc/data-model/testing";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { createFactories } from "@sdxc/data-model/testing";
import { failure, success } from "@sdxc/result";

import registry from "~/app/models";

/** What a seeder writes with: the local database, the app's models bound to it, and factories. */
export interface SeedContext {
	db: Database;
	models: ReturnType<typeof registry.bind>;
	/** Factories over `models`, drawing from one fixed seed, so every seed run writes the same values. */
	factories: Factories;
}

/** Writes one set of rows; `database/seeders/index.ts` names each seeder and orders them. */
export interface Seeder {
	(ctx: SeedContext): Promise<void>;
}

/**
 * Runs each seeder in the order the record lists them, stopping at the first that throws, so
 * a seeder can rely on the rows the ones before it wrote.
 *
 * @param seeders The seeders by name, as `database/seeders/index.ts` exports them.
 * @param db The database the seeders write to, through the app's models bound to it.
 * @param onSeeded Told each seeder's name once it finishes.
 * @returns A failure naming the seeder that stopped the run.
 */
export async function runSeeders(
	seeders: Readonly<Record<string, Seeder>>,
	db: Database,
	onSeeded: (name: string) => void = () => {},
): Promise<Result<void, Error>> {
	let models = registry.bind({ db });
	let factories = createFactories(models, { seed: 1 });
	for (let [name, seeder] of Object.entries(seeders)) {
		try {
			await seeder({ db, models, factories });
		} catch (error) {
			return failure(new Error(`The ${name} seeder failed`, { cause: error }));
		}
		onSeeded(name);
	}
	return success(undefined);
}
