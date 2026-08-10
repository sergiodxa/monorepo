/**
 * The wrapper every multi-field layout starts from: a native `<form>` laying
 * its children out in a single spaced column, and the point where a parsed
 * validation result enters the tree. Set `issues` from a `parseSafe` (or any
 * other Standard Schema compliant) result and every field beneath it can
 * pick out its own errors by name through component context, with no
 * `issues` prop threaded down by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { flex, flexCol, gap } from "@pkg/u/layout";

/** {@link Form.Props.issues} fallback for a first, not-yet-submitted render. */
const DEFAULT_ISSUES: ReadonlyArray<Form.Issue> = [];

/** Shared empty result {@link Form.Context.getIssues} returns for a field with no matching issue. */
const NO_ISSUES: ReadonlyArray<Form.Issue> = [];

/**
 * Prop types for {@link Form} and the context value it provides to
 * descendant fields.
 */
export namespace Form {
	/**
	 * A single validation failure as reported by a Standard Schema compliant
	 * validator. `path` locates the field the issue belongs to — a plain key,
	 * an index, or a `{ key }` segment — and is omitted for an issue that
	 * describes the form as a whole rather than one field.
	 */
	export interface Issue {
		/** Human-readable failure message, rendered verbatim by a field's `FieldError`. */
		readonly message: string;
		/** Field location of the issue, e.g. `["email"]` or `["address", "zip"]`. Omitted for a form-level issue. */
		readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
	}

	/**
	 * Value {@link Form} stores in component context. A field reads it with
	 * `handle.context.get(Form)` to find its own issues by name and learn
	 * whether it's the field that should carry `autofocus` on this render.
	 */
	export interface Context {
		/**
		 * Every issue whose `path` resolves to `name` (segments joined with
		 * `"."`, e.g. `"address.zip"`), or an empty array when the field has
		 * none.
		 *
		 * @param name Field name to look up, matching its `name` attribute.
		 * @returns The issues addressed to that field, in {@link Form.Props.issues} order.
		 */
		getIssues(name: string): ReadonlyArray<Issue>;
		/**
		 * `true` for the single field name that comes first among
		 * {@link Form.Props.issues}, so exactly one invalid field renders
		 * `autofocus` and the browser lands keyboard focus on it after a
		 * server round-trip re-render.
		 *
		 * @param name Field name to check, matching its `name` attribute.
		 * @returns Whether `name` is the first invalid field this render.
		 */
		isFirstInvalid(name: string): boolean;
	}

	/**
	 * Props accepted by {@link Form}.
	 */
	export interface Props extends TagProps<"form"> {
		/**
		 * Validation issues from a `parseSafe` (or equivalent Standard Schema)
		 * result, provided to every descendant field through component
		 * context. Defaults to no issues, matching a first,
		 * not-yet-submitted render.
		 *
		 * @example
		 * let result = parseSafe(ContactSchema, await request.formData());
		 * if (!result.success) return ctx.render(<ContactPage issues={result.issues} />, { status: 400 });
		 */
		issues?: ReadonlyArray<Issue>;
	}
}

/**
 * Resolves the flat field name an issue's `path` addresses, joining every
 * segment with `"."` (`["address", "zip"]` becomes `"address.zip"`).
 *
 * @param path Issue path to resolve, or `undefined` for a form-level issue.
 * @returns The joined field name, or `undefined` when `path` is missing or empty.
 */
function resolveFieldName(path: Form.Issue["path"]): string | undefined {
	if (!path || path.length === 0) return undefined;

	return path
		.map((segment) => (typeof segment === "object" ? String(segment.key) : String(segment)))
		.join(".");
}

/**
 * Groups `issues` by the field name each one's `path` resolves to, dropping
 * form-level issues that carry no path.
 *
 * @param issues Issues to group, typically {@link Form.Props.issues} as-is.
 * @returns A map from field name to every issue addressed to it, in `issues` order.
 */
function groupIssuesByField(issues: ReadonlyArray<Form.Issue>): Map<string, Form.Issue[]> {
	let byField = new Map<string, Form.Issue[]>();

	for (let issue of issues) {
		let name = resolveFieldName(issue.path);
		if (name === undefined) continue;

		let bucket = byField.get(name);
		if (bucket) bucket.push(issue);
		else byField.set(name, [issue]);
	}

	return byField;
}

/**
 * Renders a native `<form>` that lays its children out in a single column
 * with a consistent gap, and provides {@link Form.Context} so every
 * descendant field can pick out its own validation issues by name instead of
 * receiving them as a prop of its own.
 *
 * A field reads the context with `handle.context.get(Form)`, calls
 * `getIssues(name)` for its `FieldError` message and `aria-invalid` state,
 * and `isFirstInvalid(name)` to decide whether it renders `autofocus` — the
 * canonical parse-then-re-render pattern lands keyboard focus on the first
 * problem with no client JavaScript involved.
 *
 * @param handle Runtime handle carrying the host `<form>`'s props and providing {@link Form.Context}.
 * @returns The render function producing the form's markup.
 * @example
 * let result = parseSafe(ContactSchema, formData);
 * <Form method="post" issues={result.success ? undefined : result.issues}>
 *   <TextField name="email" label={t("contact.email")} />
 *   <Button type="submit">{t("contact.submit")}</Button>
 * </Form>
 */
export function Form(handle: Handle<Form.Props, Form.Context>) {
	return () => {
		let { issues = DEFAULT_ISSUES, mix, ...rest } = handle.props;
		let byField = groupIssuesByField(issues);
		let firstInvalidField = issues
			.map((issue) => resolveFieldName(issue.path))
			.find((name) => name !== undefined);

		handle.context.set({
			getIssues(name) {
				return byField.get(name) ?? NO_ISSUES;
			},
			isFirstInvalid(name) {
				return name === firstInvalidField;
			},
		});

		return <form {...rest} mix={[flex(), flexCol(), gap(4), mix]} />;
	};
}

/**
 * What a field resolved for its own validation state this render, from its
 * own props and from whatever the enclosing {@link Form} knows about it.
 */
export interface FieldIssueState {
	/** Message the field renders through its `FieldError`, or `undefined` for a field with nothing to report. */
	errorMessage: RemixNode | undefined;
	/** Whether this is the field that should carry `autofocus`, so focus lands on the first problem after a server round-trip. */
	isFirstInvalid: boolean;
}

/**
 * Reads the {@link Form.Context} provided by the nearest ancestor
 * {@link Form}, guarded so a field rendered outside any Form at all resolves
 * to `undefined` rather than surfacing the failed lookup as a thrown error,
 * whichever way that absence happens to surface.
 *
 * @param handle Runtime handle of the field performing the lookup.
 * @returns The enclosing form's context, or `undefined` where no Form wraps the caller.
 */
export function readFormContext(handle: Handle<unknown, any>): Form.Context | undefined {
	try {
		return handle.context.get(Form) as Form.Context | undefined;
	} catch {
		return undefined;
	}
}

/**
 * Resolves the validation state a field renders: an explicit `errorMessage`
 * always wins, so a consumer holding its own message keeps full control;
 * otherwise the first issue the enclosing {@link Form} holds for `name`
 * supplies one, which is what makes `Form`'s `issues` reach a field with no
 * per-field prop threaded down by hand. A field with no `name`, or one
 * outside any Form, resolves to its own props alone.
 *
 * @param handle Runtime handle of the field resolving its state.
 * @param name The field's `name` attribute, used to look its issues up.
 * @param errorMessage An `errorMessage` passed directly to the field, if any.
 * @returns The message to render and whether this field carries `autofocus`.
 * @example
 * let { errorMessage, isFirstInvalid } = resolveFieldIssue(handle, "email", handle.props.errorMessage);
 */
export function resolveFieldIssue(
	handle: Handle<unknown, any>,
	name: string | undefined,
	errorMessage?: RemixNode,
): FieldIssueState {
	if (name === undefined) return { errorMessage, isFirstInvalid: false };

	let context = readFormContext(handle);
	if (!context) return { errorMessage, isFirstInvalid: false };

	let resolved = errorMessage ?? context.getIssues(name)[0]?.message;

	return {
		errorMessage: resolved,
		isFirstInvalid: Boolean(resolved) && context.isFirstInvalid(name),
	};
}
