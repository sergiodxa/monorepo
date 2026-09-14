/**
 * The one evaluation all eight client methods are wrappers over: merge the
 * context, run the stages, call the resolver, check the type it answered with,
 * and answer with the default value whenever any of that goes wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import type { EvaluationContext } from "../core/context.js";
import type { EvaluationDetails, ResolutionDetails } from "../core/details.js";
import type { ErrorCode } from "../core/error.js";
import type { Hook, HookHints } from "../core/hook.js";
import type { ClientMetadata } from "../core/metadata.js";
import type { FlagValue, FlagValueType } from "../core/value.js";
import type { Provider } from "../provider/provider.js";

import { ProviderError } from "../provider/error.js";

import type { Binding } from "./binding.js";
import type { Subject } from "./hooks.js";

import { merge } from "./context.js";
import { prepare, runAfter, runBefore, runError, runFinally } from "./hooks.js";

/** Everything one evaluation needs, gathered by the client that was called. */
export interface Evaluation<T extends FlagValue> {
	key: string;
	type: FlagValueType;
	defaultValue: T;
	/** Required for a structure, which is the only type `typeof` cannot check. */
	schema?: StandardSchemaV1<unknown, T>;
	binding: Binding;
	clientMetadata: ClientMetadata;
	globalContext: EvaluationContext;
	transactionContext?: EvaluationContext;
	clientContext?: EvaluationContext;
	invocationContext?: EvaluationContext;
	apiHooks: Hook[];
	clientHooks: Hook[];
	invocationHooks?: Hook[];
	hints?: HookHints;
}

/**
 * Answers with the evaluation details, always. A failure anywhere — an unready
 * provider, a resolver that threw, a value of the wrong shape — comes back as
 * the default value with the code and reason that explain it.
 */
export async function evaluate<T extends FlagValue>(
	evaluation: Evaluation<T>,
): Promise<EvaluationDetails<T>> {
	let { binding } = evaluation;
	await binding.initialize(evaluation.globalContext);

	let provider = binding.provider;
	let hints = Object.freeze({ ...evaluation.hints });
	let runs = prepare(
		evaluation.apiHooks,
		evaluation.clientHooks,
		evaluation.invocationHooks,
		provider.hooks,
	);

	let subject: Subject = {
		flagKey: evaluation.key,
		flagValueType: evaluation.type,
		defaultValue: evaluation.defaultValue,
		clientMetadata: evaluation.clientMetadata,
		providerMetadata: Object.freeze({ ...provider.metadata }),
	};

	let context = merge(
		evaluation.globalContext,
		evaluation.transactionContext,
		evaluation.clientContext,
		evaluation.invocationContext,
	);

	let details: EvaluationDetails<T>;
	let thrown: unknown;

	try {
		context = await runBefore(runs, subject, context, hints);
		guard(binding);

		let resolution = await resolve(provider, evaluation, context);

		if (resolution.errorCode !== undefined) {
			thrown = new ProviderError(resolution.errorCode, resolution.errorMessage);
			details = errorDetails(evaluation, resolution.errorCode, resolution.errorMessage, resolution);
		} else {
			details = {
				...resolution,
				value: await checked(evaluation, resolution.value),
				flagKey: evaluation.key,
				flagMetadata: Object.freeze({ ...resolution.flagMetadata }),
			};
		}
	} catch (error) {
		thrown = error;
		details = errorDetails(evaluation, codeOf(error), messageOf(error));
	}

	if (thrown === undefined) {
		try {
			await runAfter(runs, subject, context, details, hints);
		} catch (error) {
			thrown = error;
			details = errorDetails(evaluation, codeOf(error), messageOf(error));
		}
	}

	if (thrown !== undefined) await runError(runs, subject, context, thrown, hints);
	await runFinally(runs, subject, context, details, hints);

	return details;
}

/** A provider that never became ready, or cannot recover, says so rather than resolving. */
function guard(binding: Binding): void {
	if (binding.placeholder) return;

	if (binding.status === "NOT_READY") {
		throw new ProviderError("PROVIDER_NOT_READY", "The provider has not become ready.");
	}

	if (binding.status === "FATAL") {
		throw new ProviderError("PROVIDER_FATAL", "The provider is in an irrecoverable state.");
	}
}

function resolve<T extends FlagValue>(
	provider: Provider,
	evaluation: Evaluation<T>,
	context: EvaluationContext,
): Promise<ResolutionDetails<FlagValue>> | ResolutionDetails<FlagValue> {
	let { key, defaultValue } = evaluation;

	if (evaluation.type === "boolean") {
		return provider.resolveBoolean(key, defaultValue as boolean, context);
	}
	if (evaluation.type === "string")
		return provider.resolveString(key, defaultValue as string, context);
	if (evaluation.type === "number")
		return provider.resolveNumber(key, defaultValue as number, context);
	return provider.resolveObject(key, defaultValue, context);
}

/**
 * Confirms the provider answered with the type that was asked for, since the
 * value crossed a boundary the application does not control on the way in.
 */
async function checked<T extends FlagValue>(
	evaluation: Evaluation<T>,
	value: FlagValue,
): Promise<T> {
	if (evaluation.type !== "object") {
		if (typeof value !== evaluation.type) {
			throw new ProviderError(
				"TYPE_MISMATCH",
				`Expected a ${evaluation.type} for "${evaluation.key}", the provider resolved ${typeof value}.`,
			);
		}
		return value as T;
	}

	if (!evaluation.schema) {
		throw new ProviderError("TYPE_MISMATCH", `No schema was supplied for "${evaluation.key}".`);
	}

	let outcome = await validate(value, evaluation.schema);
	if (isFailure(outcome)) throw new ProviderError("TYPE_MISMATCH", outcome.error.message);

	return outcome.data;
}

function errorDetails<T extends FlagValue>(
	evaluation: Evaluation<T>,
	errorCode: ErrorCode,
	errorMessage: string | undefined,
	resolution?: ResolutionDetails<FlagValue>,
): EvaluationDetails<T> {
	let details: EvaluationDetails<T> = {
		flagKey: evaluation.key,
		value: evaluation.defaultValue,
		reason: "ERROR",
		errorCode,
		flagMetadata: Object.freeze({ ...resolution?.flagMetadata }),
	};

	if (errorMessage !== undefined) details.errorMessage = errorMessage;

	return details;
}

function codeOf(error: unknown): ErrorCode {
	return error instanceof ProviderError ? error.code : "GENERAL";
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
