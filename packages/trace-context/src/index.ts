/**
 * W3C Trace Context bound to the running invocation: start or continue a trace, read it from
 * incoming headers, write it into outgoing ones, and name the fields a wide event carries.
 * Header grammar lives in `./traceparent` and `./tracestate`; router middleware in `./middleware`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { TraceContext, TraceFields } from "./context.js";

export {
	continueTrace,
	extract,
	inject,
	startTrace,
	toTraceParent,
	traceFields,
	withTrace,
} from "./context.js";
export { currentTrace, runWithTrace } from "./current.js";
