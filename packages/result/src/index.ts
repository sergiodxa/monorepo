import ms from "ms";

export interface Success<T> {
	status: "success";
	data: T;
}

export interface Failure<E extends Error> {
	status: "failure";
	error: E;
}

export type Result<T, E extends Error> = Success<T> | Failure<E>;

export function success<T>(data: T): Success<T> {
	return { status: "success", data };
}

export function failure<E extends Error>(error: E): Failure<E> {
	return { status: "failure", error };
}

export function isSuccess<T, E extends Error>(result: Result<T, E>): result is Success<T> {
	return result.status === "success";
}

export function isFailure<T, E extends Error>(result: Result<T, E>): result is Failure<E> {
	return result.status === "failure";
}

export function succeeded<T, E extends Error>(
	result: Result<T, E>,
	message = "Result is a failure",
): asserts result is Success<T> {
	if (isFailure(result)) throw new Error(message, { cause: result.error });
}

export function failed<T, E extends Error>(
	result: Result<T, E>,
	message = "Result is a success",
): asserts result is Failure<E> {
	if (isSuccess(result)) throw new Error(message, { cause: result.data });
}

/**
 * Extract the success value from a Result.
 * - If the Result is a success, returns the data.
 * - If the Result is a failure and no fallback is provided, throws the error.
 * - If the Result is a failure and a fallback is provided, calls the fallback with the error.
 *
 * Accepts both sync and async Results.
 */
export function unwrap<T, E extends Error>(result: Result<T, E>, fallback?: (error: E) => T): T;
export function unwrap<T, E extends Error>(
	result: Promise<Result<T, E>>,
	fallback?: (error: E) => T,
): Promise<T>;
export function unwrap<T, E extends Error>(
	result: Result<T, E> | Promise<Result<T, E>>,
	fallback?: (error: E) => T,
): T | Promise<T> {
	if (result instanceof Promise) return result.then((res) => unwrap(res, fallback));
	if (isSuccess(result)) return result.data;
	if (fallback) return fallback(result.error);
	throw result.error;
}

/**
 * Pattern match on a Result, calling the appropriate handler based on the status.
 *
 * Accepts both sync and async Results.
 */
export function match<T, E extends Error, R>(
	result: Result<T, E>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): R;
export function match<T, E extends Error, R>(
	result: Promise<Result<T, E>>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): Promise<R>;
export function match<T, E extends Error, R>(
	result: Result<T, E> | Promise<Result<T, E>>,
	handlers: { success: (data: T) => R; failure: (error: E) => R },
): R | Promise<R> {
	if (result instanceof Promise) return result.then((res) => match(res, handlers));
	if (isSuccess(result)) return handlers.success(result.data);
	return handlers.failure(result.error);
}

export namespace retry {
	export interface Options<E extends Error> {
		/** Maximum number of retry attempts */
		times: number;
		/** Delay between retries. Can be a number (ms) or a string parsed by ms (e.g. "100ms", "1s") */
		delay: number | ms.StringValue;
		/** Backoff strategy. Default: "exponential" */
		backoff?: "constant" | "linear" | "exponential";
		/** Optional predicate to determine if a retry should be attempted. Receives the error and attempt number. */
		when?: (error: E, attempts: number) => boolean;
	}
}

/**
 * Retry a Result-returning async function with configurable backoff.
 *
 * - Retries until success, `times` is exceeded, or `when` returns false.
 * - Delay calculation:
 *   - constant: delay
 *   - linear: delay * attempt
 *   - exponential: delay * 2^(attempt-1)
 */
export async function retry<T, E extends Error>(
	fn: () => Promise<Result<T, E>>,
	options: retry.Options<E>,
): Promise<Result<T, E | RetryError>> {
	if (options.times <= 0) throw new RangeError("Retry times must be greater than 0");
	if (typeof options.delay !== "number" && typeof options.delay !== "string") {
		throw new TypeError("Delay must be a number or a string");
	}

	let attempts = 0;

	while (attempts < options.times) {
		let result = await fn();
		if (isSuccess(result)) return result;
		attempts++;
		if (options.when && !options.when(result.error, attempts)) break;

		let delay: number;
		if (options.backoff === "constant") {
			if (typeof options.delay === "number") delay = options.delay;
			else if (typeof options.delay === "string") delay = ms(options.delay);
			else throw new TypeError("Delay must be a number or a string");
		}

		if (options.backoff === "linear") {
			if (typeof options.delay === "number") delay = options.delay * attempts;
			else if (typeof options.delay === "string") delay = ms(options.delay) * attempts;
			else throw new TypeError("Delay must be a number or a string");
		}

		if (options.backoff === "exponential" || !options.backoff) {
			if (typeof options.delay === "number") delay = options.delay * 2 ** (attempts - 1);
			else if (typeof options.delay === "string") delay = ms(options.delay) * 2 ** (attempts - 1);
			else throw new TypeError("Delay must be a number or a string");
		}

		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	return failure(new RetryError(attempts));
}

export class RetryError extends Error {
	override name = "RetryError";
	constructor(attempts: number) {
		super(`Failed after ${attempts} attempts`);
	}
}

/**
 * Wrap a throwing function into a Result-returning function.
 * - If the function succeeds, returns success(value).
 * - If the function throws, returns failure(error).
 *
 * Handles both sync and async functions.
 */
export function wrap<T>(fn: () => T): wrap.ReturnType<T>;
export function wrap(fn: () => unknown): Result<unknown, Error> | Promise<Result<unknown, Error>> {
	try {
		let result = fn();
		if (result instanceof Promise) return result.then(success).catch(failure);
		return success(result);
	} catch (error) {
		if (error instanceof Error) return failure(error);
		return failure(new Error(String(error)));
	}
}

export namespace wrap {
	export type IsAny<T> = 0 extends 1 & T ? true : false;

	export type ReturnType<T> =
		IsAny<T> extends true
			? Result<any, Error>
			: [T] extends [never]
				? Result<never, Error>
				: T extends PromiseLike<infer U>
					? Promise<Result<U, Error>>
					: Result<T, Error>;
}

/**
 * Split an array of Results into a tuple of [successValues, failureErrors].
 * Single pass through the array.
 */
export function partition<T, E extends Error>(results: Result<T, E>[]): [T[], E[]] {
	let { successes, failures } = results.reduce(
		(sets, result) => {
			if (isSuccess(result)) sets.successes.add(result);
			if (isFailure(result)) sets.failures.add(result);
			return sets;
		},
		{ successes: new Set<Success<T>>(), failures: new Set<Failure<E>>() },
	);

	return [
		Array.from(successes, (result) => result.data),
		Array.from(failures, (result) => result.error),
	];
}
