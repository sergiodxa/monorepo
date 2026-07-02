import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Runtime class or abstract class used as the lookup key for a service.
 *
 * @template T The concrete instance resolved by the container.
 */
export interface ServiceKey<T> {
	readonly prototype: T;
}

/**
 * Registers and resolves class-keyed application services.
 */
export interface Container {
	/**
	 * Registers an isolate-local instance reused by child request scopes.
	 *
	 * @param key Runtime class key for the service.
	 * @param factory Factory called once by the application container.
	 */
	singleton<T>(key: ServiceKey<T>, factory: (container: Container) => T): void;

	/**
	 * Registers a factory whose value is cached by the resolving request scope.
	 *
	 * @param key Runtime class key for the service.
	 * @param factory Factory called once per resolving scope.
	 */
	scoped<T>(key: ServiceKey<T>, factory: (container: Container) => T): void;

	/**
	 * Registers an already-constructed service in the current container.
	 *
	 * @param key Runtime class key for the value.
	 * @param value Concrete service value to return for this container.
	 */
	instance<T>(key: ServiceKey<T>, value: T): void;

	/**
	 * Resolves a service from the current scope or its parent containers.
	 *
	 * @param key Runtime class key for the requested service.
	 * @returns The resolved service instance.
	 */
	get<T>(key: ServiceKey<T>): T;

	/**
	 * Runs work inside an isolated child scope with async-local access.
	 *
	 * @param callback Work that should share scoped service instances.
	 * @returns The callback result.
	 */
	scope<T>(callback: () => T): T;
}

/**
 * Registers dependencies without performing request-specific work.
 */
export interface ServiceProvider {
	/**
	 * Adds service definitions to the application container.
	 *
	 * @param container Container receiving service registrations.
	 */
	register(container: Container): void;
}

interface Definition<T> {
	lifetime: "singleton" | "scoped";
	factory: (container: Container) => T;
}

let containerStorage = new AsyncLocalStorage<Container>();

/**
 * Error thrown when a service cannot be resolved by class key.
 */
export class ServiceNotFoundError extends Error {
	/**
	 * Creates an error with a readable service key name for diagnostics.
	 *
	 * @param key Runtime class key that was requested.
	 */
	constructor(key: ServiceKey<unknown>) {
		super(`Service not found: ${getServiceName(key)}`);
		this.name = "ServiceNotFoundError";
	}
}

/**
 * Error thrown when injection runs outside an active container scope.
 */
export class ServiceContainerScopeError extends Error {
	/**
	 * Creates an error describing the missing async-local container scope.
	 */
	constructor() {
		super("No active service container scope found");
		this.name = "ServiceContainerScopeError";
	}
}

/**
 * Small class-keyed service container with application and request lifetimes.
 */
export class ServiceContainer implements Container {
	#definitions = new Map<ServiceKey<unknown>, Definition<unknown>>();
	#instances = new Map<ServiceKey<unknown>, unknown>();

	/**
	 * Creates an application container or a child request scope.
	 *
	 * @param parent Parent container used for fallback lookups.
	 */
	constructor(private readonly parent?: ServiceContainer) {}

	/**
	 * Registers an isolate-local instance reused by child request scopes.
	 *
	 * @param key Runtime class key for the service.
	 * @param factory Factory called once by the application container.
	 */
	singleton<T>(key: ServiceKey<T>, factory: (container: Container) => T): void {
		let container = this.getRoot();
		container.#definitions.set(key, { lifetime: "singleton", factory });
		container.#instances.delete(key);
	}

	/**
	 * Registers a factory whose value is cached by the resolving request scope.
	 *
	 * @param key Runtime class key for the service.
	 * @param factory Factory called once per resolving scope.
	 */
	scoped<T>(key: ServiceKey<T>, factory: (container: Container) => T): void {
		this.#definitions.set(key, { lifetime: "scoped", factory });
		this.#instances.delete(key);
	}

	/**
	 * Registers an already-constructed service in the current container.
	 *
	 * @param key Runtime class key for the value.
	 * @param value Concrete service value to return for this container.
	 */
	instance<T>(key: ServiceKey<T>, value: T): void {
		this.#instances.set(key, value);
	}

	/**
	 * Resolves a service from the current scope or its parent containers.
	 *
	 * @param key Runtime class key for the requested service.
	 * @returns The resolved service instance.
	 */
	get<T>(key: ServiceKey<T>): T {
		if (this.#instances.has(key)) {
			return this.#instances.get(key) as T;
		}

		let definition = this.findDefinition(key);

		if (!definition) {
			throw new ServiceNotFoundError(key);
		}

		if (definition.lifetime === "singleton") {
			let container = this.getRoot();

			if (container.#instances.has(key)) {
				return container.#instances.get(key) as T;
			}

			let value = definition.factory(container);

			container.#instances.set(key, value);

			return value as T;
		}

		let value = definition.factory(this);

		this.#instances.set(key, value);

		return value as T;
	}

	/**
	 * Runs work inside an isolated child scope with async-local access.
	 *
	 * @param callback Work that should share scoped service instances.
	 * @returns The callback result.
	 */
	scope<T>(callback: () => T): T {
		let container = new ServiceContainer(this);

		return containerStorage.run(container, callback);
	}

	private findDefinition<T>(key: ServiceKey<T>): Definition<T> | undefined {
		return (
			(this.#definitions.get(key) as Definition<T> | undefined) ?? this.parent?.findDefinition(key)
		);
	}

	private getRoot(): ServiceContainer {
		return this.parent?.getRoot() ?? this;
	}
}

/**
 * Instances inferred from an ordered tuple of service keys.
 */
export type InferInstances<Dependencies extends readonly ServiceKey<unknown>[]> = {
	[Key in keyof Dependencies]: Dependencies[Key] extends ServiceKey<infer Instance>
		? Instance
		: never;
};

/**
 * Returns the service container bound to the current async execution.
 *
 * @returns The active service container.
 */
export function getServiceContainer(): Container {
	let container = containerStorage.getStore();

	if (!container) {
		throw new ServiceContainerScopeError();
	}

	return container;
}

/**
 * Creates a function that resolves dependencies from the active container.
 *
 * @param dependencies Ordered service keys resolved from the active container.
 * @param callback Callback receiving resolved services in dependency order.
 * @returns A function that resolves dependencies and returns the callback result.
 */
export function inject<Dependencies extends readonly ServiceKey<unknown>[], Return>(
	dependencies: Dependencies,
	callback: (...instances: InferInstances<Dependencies>) => Return,
): () => Return {
	return () => {
		let container = getServiceContainer();
		let instances = dependencies.map((dependency) => container.get(dependency));

		return callback(...(instances as InferInstances<Dependencies>));
	};
}

/**
 * Returns a readable class-key name for missing-service diagnostics.
 *
 * @param key Runtime class key requested by a caller.
 * @returns A stable display name when the key exposes one.
 */
function getServiceName(key: ServiceKey<unknown>): string {
	let namedKey = key as ServiceKey<unknown> & { name?: unknown };

	return typeof namedKey.name === "string" && namedKey.name.length > 0
		? namedKey.name
		: "anonymous service";
}
