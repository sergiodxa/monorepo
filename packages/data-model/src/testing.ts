/**
 * Test factories over models. Values come from `@sdxc/sample`, so a run reproduces from its
 * seed, and records are written through the bound model, so callbacks, constraints and meta
 * behave in a fixture exactly as they do in production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Sample, SampleOptions } from "@sdxc/sample";

import { isFailure } from "@sdxc/result";
import { createSample } from "@sdxc/sample";

import type { AnyBoundModels, AnyModel, CreateValues, ModelRow } from "./types.js";

import { bindModel } from "./bound.js";
import { configOf, SESSION } from "./session.js";

/** What an attribute function receives. */
export interface AttributeContext {
	/** A generator of this factory's own, so adding calls elsewhere leaves its values unchanged. */
	sample: Sample;
	/** Counts this factory's builds from one, for values that must be unique. */
	sequence: number;
	/** Creates another record, for an attribute that needs one, such as an author. */
	create: Factories["create"];
}

/** One attribute: a value, or a function of the build computing it. */
export type Attribute<Value> = Value | ((context: AttributeContext) => Value | Promise<Value>);

/** A factory's attributes, typed by what the model's `create()` takes. */
export type Attributes<M extends AnyModel> = {
	[Key in keyof CreateValues<M>]?: Attribute<CreateValues<M>[Key]>;
};

/** What a call passes after the factory: trait names, and overrides applied after them. */
export type FactoryArgument<M extends AnyModel, Traits extends string> =
	| Traits
	| Partial<CreateValues<M>>;

/**
 * A factory for one model, with named traits.
 *
 * @template M The model it builds.
 * @template Traits The trait names `trait()` declared.
 */
export interface Factory<M extends AnyModel, Traits extends string = never> {
	/** Names the factory's sample stream, so it stays put as other factories change. */
	readonly name: string;
	readonly model: M;
	readonly attributes: Attributes<M>;
	readonly traits: Readonly<Record<string, Attributes<M>>>;
	/**
	 * A factory with one more trait: a named set of attributes applied, in the order the call
	 * names them, before the call's own overrides.
	 */
	trait<Name extends string>(name: Name, attributes: Attributes<M>): Factory<M, Traits | Name>;
}

/** How a factory is named. */
export interface DefineFactoryOptions {
	/**
	 * The factory's name, which its sample stream is derived from.
	 *
	 * @default The model's name, such as `users` or `posts.article`.
	 */
	name?: string;
}

/**
 * Defines a factory: attributes for every value a create needs, each a value or a function of
 * `{ sample, sequence, create }` that runs only when the call does not override it.
 *
 * @param model The model the factory writes through.
 * @param attributes Its default attributes.
 * @param options The factory's name.
 * @example
 * defineFactory(Users, { email: ({ sequence }) => `user${sequence}@example.com` }).trait("admin", { role: "admin" });
 */
export function defineFactory<M extends AnyModel>(
	model: M,
	attributes: Attributes<M>,
	options?: DefineFactoryOptions,
): Factory<M> {
	return build(model, options?.name ?? model.name, attributes, {});
}

/** Builds a factory value, which `trait()` copies with one more trait. */
function build<M extends AnyModel, Traits extends string>(
	model: M,
	name: string,
	attributes: Attributes<M>,
	traits: Record<string, Attributes<M>>,
): Factory<M, Traits> {
	return {
		name,
		model,
		attributes,
		traits,
		trait: (trait, extra) => build(model, name, attributes, { ...traits, [trait]: extra }),
	};
}

/** Builds and writes records through a bound registry. */
export interface Factories {
	/** Resolves a factory's values without writing; nested `create` calls in attributes still write. */
	build<M extends AnyModel, Traits extends string>(
		factory: Factory<M, Traits>,
		...args: FactoryArgument<M, Traits>[]
	): Promise<CreateValues<M>>;
	/**
	 * Builds and creates one record through the model in the registry's binding.
	 *
	 * @throws {Error} When the write fails, with the write's `ValidationError` as `cause`.
	 */
	create<M extends AnyModel, Traits extends string>(
		factory: Factory<M, Traits>,
		...args: FactoryArgument<M, Traits>[]
	): Promise<ModelRow<M>>;
	/** Creates `count` records in order. */
	createMany<M extends AnyModel, Traits extends string>(
		factory: Factory<M, Traits>,
		count: number,
		...args: FactoryArgument<M, Traits>[]
	): Promise<ModelRow<M>[]>;
}

/** What factories draw their values from. */
export interface CreateFactoriesOptions {
	/** The run's seed; each factory derives its own stream from it by name. */
	seed: SampleOptions["seed"];
	/** The instant `sample.date` measures from, the current time by default. */
	now?: Date;
}

/** A bound model's write, as factories call it. */
type Writer = {
	create(values: unknown): Promise<{ status: string; data?: unknown; error?: unknown }>;
};

/**
 * Creates the factories for one bound registry. Each factory writes through the registry's
 * binding, with its host, so a test that set a service on that host observes what the
 * callbacks did with it.
 *
 * @param models A registry bound with `createModels(...).bind(...)`.
 * @param options The seed every value is drawn from.
 */
export function createFactories(
	models: AnyBoundModels,
	options: CreateFactoriesOptions,
): Factories {
	let root = createSample({ seed: options.seed, now: options.now });
	let samples = new Map<string, Sample>();
	let sequences = new Map<string, number>();
	let writers = new Map<object, Writer>();

	let sampleFor = (name: string) => {
		let sample = samples.get(name) ?? root.derive(name);
		samples.set(name, sample);
		return sample;
	};

	let writerFor = (model: AnyModel): Writer => {
		let config = configOf(model);
		if (config === undefined) throw new TypeError("A factory needs a model made by createModel");
		let writer = writers.get(config);
		if (writer !== undefined) return writer;

		let session = (models as unknown as { [SESSION]: Parameters<typeof bindModel>[1] })[SESSION];
		writer = bindModel(config, session) as unknown as Writer;
		writers.set(config, writer);
		return writer;
	};

	let factories: Factories = {
		async build(factory, ...args) {
			let sequence = (sequences.get(factory.name) ?? 0) + 1;
			sequences.set(factory.name, sequence);
			let context: AttributeContext = {
				sample: sampleFor(factory.name),
				sequence,
				create: (factory, ...rest) => factories.create(factory, ...rest),
			};

			let layers: Array<Record<string, unknown>> = [factory.attributes];
			let overrides: Record<string, unknown> = {};
			for (let argument of args) {
				if (typeof argument === "string") {
					let trait = factory.traits[argument];
					if (trait === undefined)
						throw new TypeError(`${factory.name} has no trait "${argument}"`);
					layers.push(trait);
				} else {
					Object.assign(overrides, argument);
				}
			}

			let merged: Record<string, unknown> = Object.assign({}, ...layers);
			let values: Record<string, unknown> = {};
			for (let [key, attribute] of Object.entries(merged)) {
				if (key in overrides) continue;
				values[key] = typeof attribute === "function" ? await attribute(context) : attribute;
			}

			return { ...values, ...overrides } as never;
		},

		async create(factory, ...args) {
			let values = await factories.build(factory, ...args);
			let result = await writerFor(factory.model).create(values);
			if (isFailure(result as never)) {
				throw new Error(`Could not create a ${factory.name} record`, { cause: result.error });
			}
			return result.data as never;
		},

		async createMany(factory, count, ...args) {
			let rows: Array<ModelRow<AnyModel>> = [];
			for (let index = 0; index < count; index++)
				rows.push(await factories.create(factory, ...args));
			return rows as never;
		},
	};

	return factories;
}
