import { setTimeout } from "node:timers/promises";

/**
 * A utility function to retry a given asynchronous operation.
 * @param delay - The delay in milliseconds before retrying the operation
 * @param operation - An asynchronous function that takes a context object with `retry`, `stop`, and `attempts` properties.
 * @example
 * let payload = await retry(500, async ({ retry, stop, attempts }) => {
 *   if (attempts > 3) stop("Too many attempts");
 *   let result = await doSomethingAsync()
 *   if (result.status === "success") return result.payload;
 *   if (result.status === "error") stop("Operation failed");
 *   retry(); // it's still pending
 * })
 */
export default async function retry<T>(
	delay: number,
	operation: (context: {
		retry(): never;
		stop(reason: string): never;
		attempts: number;
	}) => Promise<T>,
): Promise<T> {
	const RETRY_SIGNAL = Symbol("RETRY_SIGNAL");

	async function attempt(attempts: number): Promise<T> {
		try {
			return await operation({
				attempts,
				retry() {
					throw RETRY_SIGNAL;
				},
				stop(reason) {
					throw new Error(reason);
				},
			});
		} catch (exception) {
			if (exception instanceof Error && exception.message) {
				throw exception;
			}

			if (exception === RETRY_SIGNAL) {
				await setTimeout(delay);
				return attempt(attempts + 1);
			}

			// Retry on any other exception
			await setTimeout(delay);
			return attempt(attempts + 1);
		}
	}

	return attempt(0);
}
