/**
 * Wraps a data-table driver so a test can fail one kind of statement on demand and count the
 * statements a call runs, which is how the meta write's failure ordering and the cost of a
 * paged read are observed without changing the adapter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DatabaseDriver, DataManipulationOperation } from "remix/data-table";

import { getTableName } from "remix/data-table";

/** A driver under test control. */
export interface InterceptedDriver {
	driver: DatabaseDriver;
	/** Every operation run so far, by kind and table. */
	operations: Array<{ kind: string; table: string | undefined }>;
	/** Fails every later operation `rule` matches, until `heal()`. */
	failWhen: (rule: (kind: string, table: string | undefined) => boolean) => void;
	heal: () => void;
}

/** The table an operation targets, when it targets one. */
function tableOf(operation: DataManipulationOperation): string | undefined {
	return "table" in operation ? getTableName(operation.table) : undefined;
}

/** Wraps `driver`, forwarding everything but `execute` untouched. */
export function intercept(driver: DatabaseDriver): InterceptedDriver {
	let rule: ((kind: string, table: string | undefined) => boolean) | null = null;
	let operations: InterceptedDriver["operations"] = [];

	let wrapped = new Proxy(driver, {
		get(target, property) {
			if (property === "execute") {
				return async (request: Parameters<DatabaseDriver["execute"]>[0]) => {
					let table = tableOf(request.operation);
					operations.push({ kind: request.operation.kind, table });
					if (rule?.(request.operation.kind, table)) throw new Error("Injected failure");
					return target.execute(request);
				};
			}
			let value: unknown = Reflect.get(target, property, target);
			return typeof value === "function" ? (value as () => unknown).bind(target) : value;
		},
	});

	return {
		driver: wrapped,
		operations,
		failWhen: (next) => {
			rule = next;
		},
		heal: () => {
			rule = null;
		},
	};
}
