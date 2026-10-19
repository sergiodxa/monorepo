/**
 * The rows a new database starts with, declared once per app: named steps that write through
 * the app's models, with static values or with factories, and run in order against whatever
 * database the caller binds, so a seed command and a test share one definition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { ModelRegistry } from "./registry.js";
import type { Factories } from "./testing.js";
import type {
	BindOptions,
	BoundModels,
	ContextHost,
	RegistryContextInit,
	RegistryEntries,
} from "./types.js";

import { createFactories } from "./testing.js";

/**
 * What a step writes with: the registry bound to the run's database, and factories over it.
 *
 * @template Entries The registry's entries, so `models.post` is typed.
 */
export interface SeedContext<Entries extends RegistryEntries> {
	models: BoundModels<Entries>;
	/** Draws from the run's seed, so two runs with the same seed write the same values. */
	factories: Factories;
}

/**
 * Writes one set of rows; a step may read the rows the steps before it wrote. What it resolves
 * to is discarded, so a step can return the rows `factories.createMany` answers.
 *
 * @template Entries The registry's entries.
 */
export interface SeedStep<Entries extends RegistryEntries> {
	(ctx: SeedContext<Entries>): Promise<unknown>;
}

/** How one run binds the models and draws factory values. */
export interface SeedOptions extends BindOptions {
	/**
	 * The seed factory values are drawn from.
	 *
	 * @default 1
	 */
	seed?: number;
	/** The instant `sample.date` measures from, the current time by default. */
	now?: Date;
	/** What model callbacks' `get` and `require` read through to. */
	host?: ContextHost;
}

/**
 * An app's seed: its steps, and a way to run them against a database.
 *
 * @template Entries The registry's entries.
 */
export interface Seeder<Entries extends RegistryEntries> {
	/** The steps in run order, by the name a failure and the run's result report. */
	readonly steps: Readonly<Record<string, SeedStep<Entries>>>;
	/**
	 * Runs every step in order, stopping at the first that throws.
	 *
	 * @param context The model context to bind the registry with, such as `{ db }`.
	 * @param options The factory seed, the callbacks' host and the bind options.
	 * @returns The names of the steps that ran; a failure names the step that stopped the run.
	 */
	run(
		context: RegistryContextInit<Entries>,
		options?: SeedOptions,
	): Promise<Result<string[], Error>>;
}

/**
 * Declares an app's seed over its registry. Each step is a function of `{ models, factories }`,
 * so it writes fixed rows with `models.tag.create(…)` or generated ones with
 * `factories.createMany(…)`, and every write runs the model's callbacks and constraints.
 *
 * @param registry The app's models, which each run binds to its database.
 * @param steps The steps by name, in run order.
 * @example export default defineSeed(models, { posts: ({ factories }) => factories.createMany(PostFactory, 10) });
 * @example let ran = await seeder.run({ db: ctx.db });
 */
export function defineSeed<Entries extends RegistryEntries>(
	registry: ModelRegistry<Entries>,
	steps: Readonly<Record<string, SeedStep<Entries>>>,
): Seeder<Entries> {
	return {
		steps,
		async run(context, options = {}) {
			let { seed = 1, now, host, ...bind } = options;
			let models = registry.bind(context, host, bind);
			let factories = createFactories(models, { seed, now });
			let ran: string[] = [];
			for (let [name, step] of Object.entries(steps)) {
				try {
					await step({ models, factories });
				} catch (error) {
					return failure(new Error(`The ${name} seed step failed`, { cause: error }));
				}
				ran.push(name);
			}
			return success(ran);
		},
	};
}
