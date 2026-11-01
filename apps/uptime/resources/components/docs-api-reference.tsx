/**
 * The components an API resource page draws its endpoints with: each endpoint as two
 * columns, prose and fields beside a request in cURL and JavaScript and its response,
 * with the method and path as a chip and the OpenAPI document's fields as expandable tables.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { RemixOptions } from "@sdxc/markdown/remix";
import type { Handle, RemixNode } from "remix/component";

import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, hstack, sticky, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, minIs, p, pbs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import { CodeBlock, CodeTabs, CopyButton, Disclosure, PropsTable } from "@sdxc/ui";

import type { FieldRow, OperationReference } from "~/app/http/openapi/reference";
import type { HandFieldRow } from "~/app/services/docs-api";

/** The container name an endpoint lays its columns out against. */
const ENDPOINT_CONTAINER = "api-endpoint";

/**
 * The endpoint width from which the request sits beside the prose; narrower, it follows
 * the prose, since two columns under it would each be too narrow to read.
 */
const TWO_COLUMNS = "52rem";

/** The role each method's chip is tinted with, so a reader tells reads from writes at a glance. */
const METHOD_COLORS = {
	GET: "brand",
	POST: "success",
	PUT: "warning",
	PATCH: "warning",
	DELETE: "danger",
	HEAD: "neutral",
} as const;

/** A method's chip tint, neutral for one the table lacks. */
function methodMix(method: string) {
	let color: (typeof METHOD_COLORS)[keyof typeof METHOD_COLORS] =
		method in METHOD_COLORS ? METHOD_COLORS[method as keyof typeof METHOD_COLORS] : "neutral";
	return [bg(`${color}.bg-tint`), fg(color)];
}

/** The line naming who may call an endpoint. */
function authLine(auth: OperationReference["auth"], t: Translate): RemixNode {
	if (auth.kind === "operator") return t("docs.api.operatorKey");
	if (auth.kind === "none") return t("docs.api.noAuth");
	return (
		<>
			<strong>{t("docs.api.requiredScope")}</strong>{" "}
			{auth.scopes.map((scope, index) => (
				<span key={scope}>
					{index > 0 ? ", " : null}
					<code>{scope}</code>
				</span>
			))}
		</>
	);
}

/** What the API components read: the translator and every operation's reference. */
export interface ApiReferenceLabels {
	t: Translate;
	operations: ReadonlyMap<string, OperationReference>;
	/** The language the reader last picked for request examples, read from its cookie. */
	language?: string;
}

/** The props an `endpoint-path` tag carries. */
interface PathProps {
	method: string;
	path: string;
	children?: RemixNode;
}

/** The props a `request` tag carries: the cURL as written and, when it reads, its `fetch`. */
interface RequestProps {
	curl: string;
	fetch?: string;
	children?: RemixNode;
}

/** An element id derived from a path, so one page renders the same ids on every request. */
function pathId(method: string, path: string): string {
	return `endpoint-${method}-${path}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/** Splits a description on backticks, drawing each quoted value as inline code. */
function inlineCode(value: string): RemixNode {
	return value
		.split("`")
		.map((part, index) => (index % 2 === 1 ? <code key={index}>{part}</code> : part));
}

/** Rows as the props table draws them, with backticked values as code. */
function tableRows(rows: readonly FieldRow[]): PropsTable.Row[] {
	return rows.map((row) => ({
		...row,
		description: row.description ? inlineCode(row.description) : undefined,
		children: row.children ? tableRows(row.children) : undefined,
	}));
}

/**
 * Builds the component map for an API resource page's endpoint tags.
 *
 * @param labels - The translator and the operations the page's placeholders name
 * @returns Components keyed by the tag they draw
 */
export function apiReferenceComponents(
	labels: ApiReferenceLabels,
): NonNullable<RemixOptions["components"]> {
	let { t, operations } = labels;
	let propsLabels: PropsTable.Labels = {
		name: t("docs.api.fields.name"),
		type: t("docs.api.fields.type"),
		default: t("docs.api.fields.default"),
		required: t("docs.api.fields.required"),
		description: t("docs.api.fields.description"),
		yes: t("docs.api.fields.yes"),
		no: t("docs.api.fields.no"),
		showChildren: t("docs.api.fields.showChildren"),
		hideChildren: t("docs.api.fields.hideChildren"),
	};

	/**
	 * One endpoint: a rule above it, then its prose and its code side by side once the
	 * block is wide enough, the code column staying in view while the prose scrolls.
	 */
	function Endpoint(handle: Handle<{ children?: RemixNode }>) {
		return () => (
			<section
				data-slot="api-endpoint"
				mix={[
					container(ENDPOINT_CONTAINER),
					m("3rem", 0, 0, 0),
					pbs("3rem"),
					borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" }),
				]}
			>
				<div
					data-slot="api-endpoint-grid"
					mix={[
						raw({ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "2rem" }),
						at(
							TWO_COLUMNS,
							ENDPOINT_CONTAINER,
							raw({
								gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
								columnGap: "2.5rem",
								alignItems: "start",
							}),
						),
					]}
				>
					{handle.props.children}
				</div>
			</section>
		);
	}

	/**
	 * The prose column: heading, chip, scope, hand-written tables, then generated fields. Its
	 * heading drops its top margin, marked important to outrank the prose styles' later layer,
	 * so it lines up with the code column's first block.
	 */
	function EndpointMain(handle: Handle<{ children?: RemixNode }>) {
		return () => (
			<div
				data-slot="api-endpoint-main"
				mix={[minIs(0), when("& > h2:first-child", raw({ marginBlockStart: "0 !important" }))]}
			>
				{handle.props.children}
			</div>
		);
	}

	/** The code column, held in view under the sticky header while the prose beside it scrolls. */
	function EndpointCode(handle: Handle<{ children?: RemixNode }>) {
		return () => (
			<div
				data-slot="api-endpoint-code"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					minIs(0),
					at(TWO_COLUMNS, ENDPOINT_CONTAINER, [
						sticky(),
						raw({
							insetBlockStart: "var(--ui-docs-scroll-margin)",
							maxBlockSize: "calc(100dvh - var(--ui-docs-scroll-margin) - 1rem)",
							overflowY: "auto",
							overscrollBehavior: "contain",
						}),
					]),
					when("& pre", raw({ maxBlockSize: "28rem" })),
				]}
			>
				{handle.props.children}
			</div>
		);
	}

	/** A small caps label naming what the block below it is ("Response", "cURL"). */
	function CodeLabel(handle: Handle<{ text: string; children?: RemixNode }>) {
		return () => (
			<p
				data-slot="api-code-label"
				mix={[
					m("0.5rem", 0, 0, 0),
					font("mono"),
					text("xs"),
					weight("medium"),
					textTransform("uppercase"),
					tracking("wider"),
					fg("neutral.muted"),
				]}
			>
				{handle.props.text}
			</p>
		);
	}

	/** The method as a tinted chip and the path in mono, with a button that copies the path. */
	function EndpointPath(handle: Handle<PathProps>) {
		return () => {
			let { method, path } = handle.props;
			let id = pathId(method, path);
			return (
				<div
					data-slot="api-endpoint-path"
					mix={[
						hstack({ gap: 2, align: "center" }),
						m("0.75rem", 0, "1.25rem", 0),
						p(1, 1, 1, 1),
						rounded("md"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						bg("neutral.bg-tint"),
						raw({ maxInlineSize: "100%" }),
					]}
				>
					<span
						mix={[
							methodMix(method),
							p(0.5, 2),
							rounded("sm"),
							font("mono"),
							text("xs"),
							weight("semibold"),
							raw({ flexShrink: 0 }),
						]}
					>
						{method}
					</span>
					<code
						id={id}
						mix={[
							minIs(0),
							font("mono"),
							text("sm"),
							fg("neutral.emphasis"),
							raw({ overflowWrap: "anywhere", background: "transparent", padding: 0, border: 0 }),
						]}
					>
						{path}
					</code>
					<span mix={[raw({ marginInlineStart: "auto", flexShrink: 0 })]}>
						<CopyButton
							target={id}
							label={t("docs.api.copyPath")}
							copiedLabel={t("docs.code.copied")}
						/>
					</span>
				</div>
			);
		};
	}

	/** Who may call the endpoint, in one line under its chip. */
	function Operation(handle: Handle<{ name: string; children?: RemixNode }>) {
		return () => {
			let reference = operations.get(handle.props.name);
			if (!reference) return null;
			return <p data-slot="api-endpoint-auth">{authLine(reference.auth, t)}</p>;
		};
	}

	/**
	 * What closes the prose column: the problems the endpoint answers with, then its request
	 * body and response fields, each in a disclosure so the column stays short.
	 */
	function OperationDetails(
		handle: Handle<{ name: string; request?: boolean; children?: RemixNode }>,
	) {
		return () => {
			let reference = operations.get(handle.props.name);
			if (!reference) return null;
			return (
				<div
					data-slot="api-endpoint-details"
					mix={[vstack({ gap: 3, align: "stretch" }), m("1.5rem", 0, 0, 0)]}
				>
					{reference.errors.length > 0 ? (
						<Disclosure>
							<Disclosure.Trigger>
								{t("docs.api.errors", { count: reference.errors.length })}
							</Disclosure.Trigger>
							<Disclosure.Panel>
								<table>
									<thead>
										<tr>
											<th>{t("docs.api.status")}</th>
											<th>{t("docs.api.type")}</th>
											<th>{t("docs.api.meaning")}</th>
										</tr>
									</thead>
									<tbody>
										{reference.errors.map((error) => (
											<tr key={error.slug}>
												<td>{error.status}</td>
												<td>
													<a href="/docs/api/errors">
														<code>{error.slug}</code>
													</a>
												</td>
												<td>{error.title}</td>
											</tr>
										))}
									</tbody>
								</table>
							</Disclosure.Panel>
						</Disclosure>
					) : null}
					{handle.props.request !== false && reference.request && reference.request.length > 0 ? (
						<Disclosure>
							<Disclosure.Trigger>{t("docs.api.requestFields")}</Disclosure.Trigger>
							<Disclosure.Panel>
								<PropsTable
									rows={tableRows(reference.request)}
									labels={propsLabels}
									aria-label={t("docs.api.requestFields")}
								/>
							</Disclosure.Panel>
						</Disclosure>
					) : null}
					{reference.responses.map((response) =>
						response.fields.length > 0 ? (
							<Disclosure key={response.status}>
								<Disclosure.Trigger>
									{t("docs.api.responseFields", { status: response.status })}
								</Disclosure.Trigger>
								<Disclosure.Panel>
									<PropsTable
										rows={tableRows(response.fields)}
										labels={propsLabels}
										aria-label={t("docs.api.responseFields", { status: response.status })}
									/>
								</Disclosure.Panel>
							</Disclosure>
						) : null,
					)}
				</div>
			);
		};
	}

	/**
	 * A request example as tabs, cURL and JavaScript, that follow the reader's last pick
	 * across the page and across visits. A cURL with no `fetch` twin draws alone.
	 */
	function Request(handle: Handle<RequestProps>) {
		return () => {
			let { curl, fetch } = handle.props;
			let codeLabels = { copy: t("docs.code.copy"), copied: t("docs.code.copied") };
			let curlBlock = (
				<CodeBlock code={curl} language="bash" title="Terminal" labels={codeLabels} />
			);
			if (!fetch) return curlBlock;
			return (
				<CodeTabs
					aria-label={t("docs.api.language")}
					syncKey="api-language"
					persist="cookie"
					selected={labels.language}
					tabs={[
						{ label: "cURL", value: "curl", children: curlBlock },
						{
							label: "JavaScript",
							value: "javascript",
							children: (
								<CodeBlock code={fetch} language="js" title="request.js" labels={codeLabels} />
							),
						},
					]}
				/>
			);
		};
	}

	/**
	 * A hand-written fields table drawn as a props table, which stacks into one card per
	 * field in a narrow column so every description stays readable.
	 */
	function Fields(handle: Handle<{ rows: HandFieldRow[]; children?: RemixNode }>) {
		return () => (
			<PropsTable
				rows={handle.props.rows.map((row) => ({
					name: row.name,
					type: row.type,
					required: row.required,
					description: row.description ? inlineCode(row.description) : undefined,
				}))}
				labels={propsLabels}
			/>
		);
	}

	return {
		endpoint: Endpoint,
		fields: Fields,
		"endpoint-main": EndpointMain,
		"endpoint-code": EndpointCode,
		"endpoint-path": EndpointPath,
		"code-label": CodeLabel,
		operation: Operation,
		"operation-details": OperationDetails,
		request: Request,
	};
}
