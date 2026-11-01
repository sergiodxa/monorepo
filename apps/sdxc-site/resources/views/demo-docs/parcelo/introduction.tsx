/**
 * Parcelo's introduction pages: how a request authenticates, what an error looks like and
 * which statuses the API answers, and how list endpoints page through results. Every
 * endpoint page assumes what these say.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Fields, Heading } from "~/resources/views/demo-docs/blocks";
import { RequestExample, TEST_KEY } from "~/resources/views/demo-docs/parcelo/endpoint";

/** The addresses of Parcelo's pages. */
const href = demoDocsHref("parcelo");

/** Authentication: keys, test and live modes, and the header every request sends. */
export const AUTHENTICATION: DemoDocsPage = {
	title: "Authentication",
	description:
		"Every request carries a secret key in its Authorization header. Test keys buy no postage; live keys do.",
	updated: "2026-10-26",
	toc: [
		{ id: "api-keys", text: "API keys", level: 2 },
		{ id: "send-the-key", text: "Send the key", level: 2 },
		{ id: "test-and-live", text: "Test and live mode", level: 2 },
	],
	next: [
		{
			title: "Create a shipment",
			href: href("shipments/create"),
			description: "Make your first authenticated request and buy a label.",
		},
		{
			title: "Errors",
			href: href("introduction/errors"),
			description: "What a request with a missing or revoked key answers.",
		},
	],
	render: () => (
		<>
			<p>
				Parcelo authenticates each request by the secret key it sends. There are no sessions and no
				cookies: a request without a valid key answers <code>401</code>.
			</p>

			<Heading id="api-keys">API keys</Heading>
			<p>
				Create keys in the dashboard under Developers → API keys. A key starts with{" "}
				<code>sk_test_</code> or <code>sk_live_</code>, and it is shown once; store it in your
				server’s secrets.
			</p>
			<Aside kind="danger" title="Keep secret keys on the server">
				A secret key can buy postage on your account. Never ship one in a browser bundle or a mobile
				app; call Parcelo from your own backend instead.
			</Aside>

			<Heading id="send-the-key">Send the key</Heading>
			<p>
				Send the key as a bearer token. Every example in these docs uses a test key, so you can
				paste them as they are.
			</p>
			<RequestExample method="GET" path="/v1/shipments" query={{ limit: "1" }} />

			<Heading id="test-and-live">Test and live mode</Heading>
			<p>
				A test key works against the same endpoints, but labels it buys are marked <code>VOID</code>{" "}
				and carriers never see them. Objects created in one mode are invisible to the other.
			</p>
			<Code title=".env" language="sh" code={`PARCELO_SECRET_KEY=${TEST_KEY}`} />
		</>
	),
};

/** Errors: the error object, and every status the API answers with. */
export const ERRORS: DemoDocsPage = {
	title: "Errors",
	description:
		"A failed request answers a 4xx or 5xx status with an error object naming what went wrong and which field caused it.",
	updated: "2026-10-22",
	toc: [
		{ id: "the-error-object", text: "The error object", level: 2 },
		{ id: "status-codes", text: "Status codes", level: 2 },
		{ id: "retrying", text: "Retrying safely", level: 2 },
	],
	next: [
		{
			title: "Create a shipment",
			href: href("shipments/create"),
			description: "See which of these a write can answer with.",
		},
		{
			title: "Pagination",
			href: href("introduction/pagination"),
			description: "How list endpoints page through results.",
		},
	],
	render: () => (
		<>
			<p>
				Parcelo answers <code>2xx</code> for success, <code>4xx</code> for a request it can’t fulfil
				as sent, and <code>5xx</code> for a fault on its side. Every error carries the same object,
				so one handler covers them all.
			</p>

			<Heading id="the-error-object">The error object</Heading>
			<Fields
				label="The error object"
				rows={[
					{
						name: "error",
						type: "object",
						required: true,
						description: "Wraps every field below.",
						children: [
							{
								name: "type",
								type: '"invalid_request" | "authentication" | "carrier" | "api"',
								required: true,
								description: "The family of error, which decides how to handle it.",
							},
							{
								name: "code",
								type: "string",
								required: true,
								description: "A stable identifier, such as address_unverified, to branch on.",
							},
							{
								name: "message",
								type: "string",
								required: true,
								description: "A sentence for a developer; don’t show it to customers as is.",
							},
							{
								name: "param",
								type: "string",
								description: "The request field that caused it, such as to.postal_code.",
							},
						],
					},
				]}
			/>
			<Code
				title="Response"
				language="json"
				code={
					'{\n  "error": {\n    "type": "invalid_request",\n    "code": "address_unverified",\n    "message": "The postal code does not match the city.",\n    "param": "to.postal_code"\n  }\n}'
				}
			/>

			<Heading id="status-codes">Status codes</Heading>
			<table>
				<thead>
					<tr>
						<th>Status</th>
						<th>Meaning</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>200, 201</td>
						<td>The request worked; 201 when it created an object.</td>
					</tr>
					<tr>
						<td>400</td>
						<td>A field is missing or invalid; param names it.</td>
					</tr>
					<tr>
						<td>401</td>
						<td>No key was sent, or the key was revoked.</td>
					</tr>
					<tr>
						<td>404</td>
						<td>No object with that id exists in this mode.</td>
					</tr>
					<tr>
						<td>409</td>
						<td>
							The request conflicts with the object’s state, such as voiding a delivered label.
						</td>
					</tr>
					<tr>
						<td>429</td>
						<td>Too many requests; wait for the Retry-After header’s seconds.</td>
					</tr>
					<tr>
						<td>502</td>
						<td>The carrier failed to answer; the type is carrier.</td>
					</tr>
				</tbody>
			</table>

			<Heading id="retrying">Retrying safely</Heading>
			<p>
				Retry a <code>429</code> or a <code>5xx</code> with an <code>Idempotency-Key</code> header.
				A retry carrying the same key answers the first request’s result instead of buying a second
				label.
			</p>
			<Aside kind="tip">
				Use the order id from your own system as the idempotency key, so a retry from any worker
				lands on the same shipment.
			</Aside>
		</>
	),
};

/** Pagination: the cursor parameters and the list object every list endpoint answers. */
export const PAGINATION: DemoDocsPage = {
	title: "Pagination",
	description:
		"List endpoints answer pages of up to 100 objects, newest first, and a cursor for the next page.",
	updated: "2026-10-15",
	toc: [
		{ id: "parameters", text: "Parameters", level: 2 },
		{ id: "the-list-object", text: "The list object", level: 2 },
		{ id: "read-every-page", text: "Read every page", level: 2 },
	],
	next: [
		{
			title: "List shipments",
			href: href("shipments/list"),
			description: "Page through every shipment on the account.",
		},
	],
	render: () => (
		<>
			<p>
				Every <code>GET</code> that lists objects pages with a cursor rather than an offset, so a
				page never repeats or skips an object created while you read.
			</p>

			<Heading id="parameters">Parameters</Heading>
			<Fields
				label="Pagination parameters"
				rows={[
					{
						name: "limit",
						type: "integer",
						default: "10",
						description: "How many objects a page holds, from 1 to 100.",
					},
					{
						name: "starting_after",
						type: "string",
						description: "An object id; the page starts with the object after it.",
					},
				]}
			/>

			<Heading id="the-list-object">The list object</Heading>
			<Code
				title="Response"
				language="json"
				code={
					'{\n  "object": "list",\n  "data": [{ "id": "shp_9Qx2", "object": "shipment" }],\n  "has_more": true,\n  "next_cursor": "shp_9Qx2"\n}'
				}
			/>

			<Heading id="read-every-page">Read every page</Heading>
			<Code
				title="scripts/export-shipments.js"
				language="js"
				code={
					'let cursor = undefined;\ndo {\n\tlet query = new URLSearchParams({ limit: "100" });\n\tif (cursor) query.set("starting_after", cursor);\n\tlet response = await fetch(`https://api.parcelo.dev/v1/shipments?${query}`, {\n\t\theaders: { Authorization: `Bearer ${process.env.PARCELO_SECRET_KEY}` },\n\t});\n\tlet page = await response.json();\n\tfor (let shipment of page.data) console.log(shipment.id);\n\tcursor = page.has_more ? page.next_cursor : undefined;\n} while (cursor);'
				}
			/>
		</>
	),
};
