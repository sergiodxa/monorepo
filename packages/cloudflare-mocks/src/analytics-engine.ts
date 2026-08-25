/**
 * Recording `AnalyticsEngineDataset` binding. Data points are captured with their
 * blobs, doubles, and indexes so a test can assert what a Worker reported, and the
 * platform's cardinality and size limits raise real errors here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/** Blobs the platform accepts per data point. */
const MAXIMUM_BLOBS = 20;

/** Doubles the platform accepts per data point. */
const MAXIMUM_DOUBLES = 20;

/** Indexes the platform accepts per data point. */
const MAXIMUM_INDEXES = 1;

/** Combined byte budget for a data point's blobs (5 KiB). */
const MAXIMUM_BLOB_BYTES = 5120;

/** Byte budget for a single index value (96 bytes). */
const MAXIMUM_INDEX_BYTES = 96;

/** An `AnalyticsEngineDataset` binding that records every reported data point. */
export interface AnalyticsEngineMock extends AnalyticsEngineDataset {
	/** Data points written so far, oldest first. */
	readonly dataPoints: AnalyticsEngineDataPoint[];

	/**
	 * Discards every recorded data point, as if the dataset were new.
	 *
	 * A binding installed once at module scope outlives the test that used it;
	 * `reset` empties it for a `beforeEach` while keeping the `env` already captured.
	 */
	reset(): void;
}

/**
 * Creates a recording Analytics Engine dataset.
 *
 * `writeDataPoint` is fire-and-forget in production, so this mock raises an error
 * on an over-budget data point, turning a would-be silent loss into a test failure.
 * @returns An `AnalyticsEngineDataset` binding that records data points.
 * @example let analytics = createAnalyticsEngine(); analytics.writeDataPoint({ blobs: ["hit"] });
 */
export function createAnalyticsEngine(): AnalyticsEngineMock {
	let dataPoints: AnalyticsEngineDataPoint[] = [];

	return {
		get dataPoints(): AnalyticsEngineDataPoint[] {
			return dataPoints.map((point) => structuredClone(point));
		},

		reset(): void {
			dataPoints.length = 0;
		},

		/**
		 * Records one data point after validating its cardinality and size.
		 * @param event Blobs, doubles, and indexes to record; an omitted event records an
		 * empty data point, as the platform allows.
		 */
		writeDataPoint(event?: AnalyticsEngineDataPoint): void {
			let point = event ?? {};

			assertCount("blobs", point.blobs, MAXIMUM_BLOBS);
			assertCount("doubles", point.doubles, MAXIMUM_DOUBLES);
			assertCount("indexes", point.indexes, MAXIMUM_INDEXES);
			assertBlobBytes(point.blobs);
			assertIndexBytes(point.indexes);

			dataPoints.push(structuredClone(point));
		},
	};
}

/** Rejects a field with more entries than the platform accepts. */
function assertCount(field: string, values: unknown[] | undefined, maximum: number): void {
	if (values === undefined) return;

	if (values.length > maximum) {
		throw new Error(
			`Analytics Engine: ${String(values.length)} ${field} exceeds the limit of ${String(maximum)}`,
		);
	}
}

/** Rejects a data point whose blobs exceed the combined byte budget. */
function assertBlobBytes(blobs: ((ArrayBuffer | string) | null)[] | undefined): void {
	if (!blobs) return;

	let total = blobs.reduce((sum, blob) => sum + measure(blob), 0);

	if (total > MAXIMUM_BLOB_BYTES) {
		throw new Error(
			`Analytics Engine: blobs total ${String(total)} bytes, over the limit of ${String(MAXIMUM_BLOB_BYTES)}`,
		);
	}
}

/** Rejects an index value longer than the platform's per-index byte budget. */
function assertIndexBytes(indexes: ((ArrayBuffer | string) | null)[] | undefined): void {
	if (!indexes) return;

	for (let index of indexes) {
		let size = measure(index);

		if (size > MAXIMUM_INDEX_BYTES) {
			throw new Error(
				`Analytics Engine: index of ${String(size)} bytes exceeds the limit of ${String(MAXIMUM_INDEX_BYTES)}`,
			);
		}
	}
}

/** Byte length of a blob or index value, counting `null` as empty. */
function measure(value: (ArrayBuffer | string) | null): number {
	if (value === null) return 0;
	if (typeof value === "string") return new TextEncoder().encode(value).byteLength;
	return value.byteLength;
}
