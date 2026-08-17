/**
 * Corrects the `bun:test` declarations for the asynchronous matcher chains. `resolves` and
 * `rejects` are declared as the synchronous `Matchers`, whose assertions return `void`, but
 * at runtime every assertion on those chains returns a promise the caller has to await.
 *
 * Without this, `await expect(p).rejects.toThrow()` reads as awaiting a non-thenable and the
 * type-aware `await-thenable` rule flags it. Dropping the `await` would silence the rule and
 * keep passing under `bun:test`, which settles those chains itself — but Vitest, which
 * ADR-035 migrates to, only auto-awaits a hanging assertion as a deprecated courtesy and
 * warns that it "will cause the test to fail in the next Vitest major". So the `await` is
 * correct and the declaration is what needed fixing.
 *
 * Shared rather than duplicated per workspace: every workspace with a rejection assertion
 * adds this file to its tsconfig `include`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
declare module "bun:test" {
	/** The matcher set of an async chain, with every assertion returning the promise it really is. */
	type AsyncMatchers<T> = {
		[Key in keyof MatchersBuiltin<T>]: MatchersBuiltin<T>[Key] extends (...args: infer Args) => void
			? (...args: Args) => Promise<void>
			: MatchersBuiltin<T>[Key];
	};

	// Narrowing these two to promise-returning matchers is deliberately an incompatible
	// override of what `MatchersBuiltin` declares — that incompatibility is the correction.
	// tsgolint reports it as TS2430; `tsc` does not, so `@ts-expect-error` would fail `tsc`
	// with TS2578 for an unused directive, and `oxlint-disable` cannot suppress a TS
	// diagnostic at all. `@ts-ignore` is the only directive both tools accept.
	// @ts-ignore -- see above
	interface Matchers<T> {
		resolves: AsyncMatchers<Awaited<T>>;
		rejects: AsyncMatchers<unknown>;
	}
}

export {};
