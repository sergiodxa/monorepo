import { describe, expect, test } from "vitest";

import type { Result } from "./types.js";

import { failure } from "./failure.js";
import { partition } from "./partition.js";
import { success } from "./success.js";

describe(partition, () => {
	test("separates successes and failures", () => {
		let results: Result<number, Error>[] = [
			success(1),
			failure(new Error("Error 1")),
			success(2),
			failure(new Error("Error 2")),
			success(3),
		];

		let [successes, failures] = partition(results);

		expect(successes).toEqual([1, 2, 3]);
		expect(failures.map((e) => e.message)).toEqual(["Error 1", "Error 2"]);
	});

	test("returns empty arrays for empty input", () => {
		let [successes, failures] = partition([]);
		expect(successes).toEqual([]);
		expect(failures).toEqual([]);
	});

	test("handles all successes", () => {
		let results: Result<number, Error>[] = [success(1), success(2), success(3)];

		let [successes, failures] = partition(results);

		expect(successes).toEqual([1, 2, 3]);
		expect(failures).toEqual([]);
	});

	test("handles all failures", () => {
		let results: Result<number, Error>[] = [
			failure(new Error("Error 1")),
			failure(new Error("Error 2")),
		];

		let [successes, failures] = partition(results);

		expect(successes).toEqual([]);
		expect(failures.map((e) => e.message)).toEqual(["Error 1", "Error 2"]);
	});

	test("preserves order within each group", () => {
		let results: Result<string, Error>[] = [
			success("a"),
			success("b"),
			failure(new Error("x")),
			success("c"),
			failure(new Error("y")),
		];

		let [successes, failures] = partition(results);

		expect(successes).toEqual(["a", "b", "c"]);
		expect(failures.map((e) => e.message)).toEqual(["x", "y"]);
	});

	test("works with complex types", () => {
		interface User {
			id: number;
			name: string;
		}

		let results: Result<User, Error>[] = [
			success({ id: 1, name: "Alice" }),
			failure(new Error("User not found")),
			success({ id: 2, name: "Bob" }),
		];

		let [users, errors] = partition(results);

		expect(users).toEqual([
			{ id: 1, name: "Alice" },
			{ id: 2, name: "Bob" },
		]);
		expect(errors).toHaveLength(1);
	});

	test("can be used after Promise.all", async () => {
		async function fetchUser(id: number): Promise<Result<{ id: number }, Error>> {
			if (id === 2) {
				return failure(new Error(`User ${id} not found`));
			}
			return success({ id });
		}

		let results = await Promise.all([fetchUser(1), fetchUser(2), fetchUser(3)]);
		let [users, errors] = partition(results);

		expect(users).toEqual([{ id: 1 }, { id: 3 }]);
		expect(errors).toHaveLength(1);
	});
});
