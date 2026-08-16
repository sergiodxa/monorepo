/**
 * `SecretsStoreSecret` binding whose answer is switchable. The platform reads a secret
 * asynchronously and throws when it is missing, so code that reads one has two paths worth
 * testing; this lets a single binding serve both without re-registering `env`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Options for {@link createSecretsStoreSecret}. */
export interface SecretsStoreSecretMockOptions {
	/** Secret name, used in the not-found error so a failure names the binding that failed. */
	name?: string;
	/** Value `get()` resolves with. Omitted, the secret reads as missing. */
	value?: string;
}

/** A `SecretsStoreSecret` binding whose value and failure are controllable per test. */
export interface SecretsStoreSecretMock extends SecretsStoreSecret {
	/**
	 * Times `get()` has been called.
	 *
	 * A secret is expected to be read lazily, at the point of use rather than when the
	 * binding is wired up, and this is what lets a test assert that.
	 */
	readonly reads: number;

	/**
	 * Makes subsequent reads resolve with a value.
	 * @param value Value `get()` resolves with.
	 */
	set(value: string): void;

	/**
	 * Makes subsequent reads reject.
	 * @param error Reason `get()` rejects with; defaults to the platform's not-found error.
	 */
	fail(error?: unknown): void;

	/**
	 * Restores the value the secret was created with and zeroes the read count.
	 *
	 * A binding installed once at module scope outlives the test that used it, so this is
	 * how a `beforeEach` gets back to the starting state without re-creating the `env` the
	 * code under test already captured.
	 */
	reset(): void;
}

/**
 * Creates a Secrets Store secret binding.
 *
 * The value is read through `get()` exactly as the platform requires, so code that awaits
 * the binding rather than treating it as a string is what passes.
 * @param options Secret name and initial value.
 * @returns A `SecretsStoreSecret` binding whose answer can be switched.
 * @example let token = createSecretsStoreSecret({ value: "polar_at_1" }); await token.get();
 * @example token.fail(); await expect(token.get()).rejects.toThrow();
 */
export function createSecretsStoreSecret(
	options?: SecretsStoreSecretMockOptions,
): SecretsStoreSecretMock {
	let name = options?.name ?? "SECRET";
	let initial = options?.value;

	let value = initial;
	let failure: unknown;
	let failing = false;
	let reads = 0;

	/** The error the platform raises for a secret that is not in the store. */
	function notFound(): Error {
		return new Error(`Secret "${name}" not found`);
	}

	return {
		get reads(): number {
			return reads;
		},

		set(next: string): void {
			value = next;
			failing = false;
			failure = undefined;
		},

		fail(error?: unknown): void {
			failing = true;
			failure = error;
		},

		reset(): void {
			value = initial;
			failing = false;
			failure = undefined;
			reads = 0;
		},

		/**
		 * Reads the secret.
		 * @returns The stored value.
		 * @throws When the secret was failed, or was never given a value.
		 */
		async get(): Promise<string> {
			reads++;

			if (failing) throw failure ?? notFound();
			if (value === undefined) throw notFound();

			return value;
		},
	};
}
