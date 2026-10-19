/**
 * The access check `make controller --resource` writes into a controller: which of the
 * resource's abilities its method implies, the route pattern that check needs, and the guard
 * statements a resource stub places at the top of each handler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Name } from "./names.js";

import { camel } from "./names.js";

/** One of the abilities `make policy` declares for a resource. */
export type ResourceAction = "create" | "read" | "update" | "delete";

/** The ability each `--method` checks: a page reads, a form creates, the rest write as named. */
const METHOD_ACTIONS: Readonly<Record<string, ResourceAction>> = {
	get: "read",
	form: "create",
	post: "create",
	put: "update",
	patch: "update",
	delete: "delete",
};

/** What a guarded controller checks and the placeholder values its stub renders it with. */
export interface Guard {
	/** The ability's dot-joined path in the catalog, such as `billing.invoice.update`. */
	ability: string;
	/** The resource's key path in the catalog, which `make policy` declares. */
	catalogPath: string[];
	/** The route pattern, which holds `:id` whenever the check needs one row. */
	pattern: string | undefined;
	/** The guard answering a refusal with an empty 404 or 403 response. */
	access: string;
	/** The guard rendering the not-found page for a hidden or missing row. */
	pageAccess: string;
}

/**
 * Plans the guard for a controller named `controller` that `method` routes, checked against the
 * abilities of `resource`. A read, update or delete checks one row, so its route takes
 * `/<controller>/:id` by default and a `pattern` without `:id` is refused. With `model`, the row
 * is the model's, and a missing one is a 404 like a hidden one; without it, the row is its id.
 *
 * @param checked - The ability to check instead of the one `method` implies, such as `update`
 * for an edit form
 */
export function planGuard(
	controller: Name,
	resource: Name,
	method: string,
	pattern: string | undefined,
	model: boolean,
	checked?: ResourceAction,
): Result<Guard, Error> {
	let action = checked ?? METHOD_ACTIONS[method] ?? "read";
	let catalogPath = [...resource.segments.slice(0, -1).map(camel), resource.key];
	let path = `abilities.${catalogPath.join(".")}`;
	let ability = `${catalogPath.join(".")}.${action}`;
	if (action === "create") {
		let refused = [
			`if (!ctx.access.can(${path}.create)) {`,
			"\treturn new Response(null, { status: 403 });",
			"}",
		].join("\n");
		return success({ ability, catalogPath, pattern, access: refused, pageAccess: refused });
	}
	if (pattern !== undefined && !/(^|\/):id(\/|$)/.test(pattern)) {
		return failure(
			new Error(
				`--resource ${resource.segments.join("/")} checks ${ability} against one ${resource.title.toLowerCase()}, so the route needs an :id param; pass a --path holding one, such as ${pattern.replace(/\/$/, "")}/:id`,
			),
		);
	}
	let { key } = resource;
	let load = model
		? `let row = await ctx.models.${key}.find(ctx.params.id);`
		: "let row = { id: ctx.params.id };";
	let hidden = `${model ? "row === null || " : ""}!ctx.access.can(${path}.read, { ${key}: row })`;
	let write =
		action === "read"
			? []
			: [
					`if (!ctx.access.can(${path}.${action}, { ${key}: row })) {`,
					"\treturn new Response(null, { status: 403 });",
					"}",
				];
	let guard = (notFound: string[]) =>
		[load, `if (${hidden}) {`, ...notFound.map((line) => `\t${line}`), "}", ...write].join("\n");
	return success({
		ability,
		catalogPath,
		pattern: pattern ?? `/${controller.segments.join("/")}/:id`,
		access: guard(["return new Response(null, { status: 404 });"]),
		pageAccess: guard([
			'let missing = ctx.intl.t("notFound.title");',
			"return ctx.render(",
			"\t<DocumentLayout assets={ctx.assets} intl={ctx.intl} url={ctx.url} title={missing}>",
			"\t\t<h1>{missing}</h1>",
			"\t</DocumentLayout>,",
			"\t{ status: 404 },",
			");",
		]),
	});
}
