/**
 * The shapes of the Health Check Response Format for HTTP APIs: a report as a reader receives
 * it, normalized, and the options that configure a check. Kept in one namespace so a consumer
 * names them `Health.Report`, `Health.Options` and so on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export namespace Health {
	/** The three verdicts every alias the format allows (`ok`, `up`, `error`, `down`, any case) reduces to. */
	export type Status = "pass" | "warn" | "fail";

	/** A link relation (a registered name or a URI) mapped to the URI it points at. */
	export type Links = Record<string, string>;

	/**
	 * One node of one dependency. Every field is optional, as the format makes them; `output`
	 * and `affectedEndpoints` describe a check that is not passing.
	 */
	export interface Check {
		componentId?: string;
		/** `datastore`, `component`, `system`, or a URI naming another type. */
		componentType?: string;
		status?: Status;
		/** Any JSON value; `observedUnit` names its unit. */
		observedValue?: unknown;
		observedUnit?: string;
		/** When `observedValue` was recorded, as an ISO 8601 date-time. */
		time?: string;
		output?: string;
		/** URI templates (RFC 6570) of the endpoints this dependency breaks. */
		affectedEndpoints?: string[];
		links?: Links;
		[key: string]: unknown;
	}

	/**
	 * A whole report, with every status normalized. `checks` is keyed `component:measurement`,
	 * each value one entry per node; keys the format leaves to an implementation are kept.
	 */
	export interface Report {
		status: Status;
		version?: string;
		releaseId?: string;
		serviceId?: string;
		description?: string;
		notes?: string[];
		output?: string;
		checks?: Record<string, Check[]>;
		links?: Links;
		[key: string]: unknown;
	}

	/** A check of one dependency, settled by what it resolves to, rejects with, or how long it takes. */
	export type Probe<Context> = (context: Context, signal: AbortSignal) => unknown;

	/** How a check runs, and the report fields that describe the service as a whole. */
	export interface Options {
		/**
		 * Milliseconds each probe may take before it fails as `timeout`.
		 * @default 2000
		 */
		timeout?: number;
		serviceId?: string;
		description?: string;
		version?: string;
		/** The deployed release, e.g. the Worker's version-metadata id. */
		releaseId?: string;
		notes?: string[];
		/** `self` names the health URL, `about` the service's documentation. */
		links?: Links;
		/**
		 * Seconds a report stays fresh, sent as `Cache-Control: max-age`.
		 * @default 0
		 */
		maxAge?: number;
		/**
		 * The HTTP status of a `fail` report, between 400 and 599.
		 * @default 503
		 */
		failStatus?: number;
		/**
		 * Puts error messages in each failing check's `output`. Off, `output` names only the
		 * kind of failure, since the report is usually public; the log carries the message.
		 * @default false
		 */
		exposeErrors?: boolean;
	}

	/** How one probe is judged, and the check fields that describe the dependency. */
	export interface ProbeOptions {
		/**
		 * Whether this dependency failing fails the service. `false` reports its failure as `warn`.
		 * @default true
		 */
		critical?: boolean;
		/** Overrides the check's `timeout` for this probe, in milliseconds. */
		timeout?: number;
		componentType?: string;
		componentId?: string;
		links?: Links;
		/** URI templates of the routes this dependency breaks, sent only while it is not passing. */
		affectedEndpoints?: string[];
	}
}
