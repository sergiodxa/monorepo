/**
 * Parcelo's Shipments resource: the shipment object, then one page per endpoint that
 * creates, retrieves and lists shipments, each with its request fields, an example in three
 * languages, the response and the errors it answers with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PropsTable } from "@sdxc/ui/docs";

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Fields, Heading } from "~/resources/views/demo-docs/blocks";
import { Endpoint, ErrorCodes, RequestExample } from "~/resources/views/demo-docs/parcelo/endpoint";

/** The addresses of Parcelo's pages. */
const href = demoDocsHref("parcelo");

/** An address's fields, shared by a shipment's sender and recipient. */
const ADDRESS_ROWS: readonly PropsTable.Row[] = [
	{ name: "name", type: "string", required: true, description: "The person or company." },
	{ name: "line1", type: "string", required: true, description: "Street and number." },
	{ name: "line2", type: "string", description: "Apartment, suite or floor." },
	{ name: "city", type: "string", required: true },
	{ name: "postal_code", type: "string", required: true },
	{
		name: "country",
		type: "string",
		required: true,
		description: "ISO 3166-1 alpha-2, such as US.",
	},
];

/** A parcel's measurements, in the units the account is set to. */
const PARCEL_ROWS: readonly PropsTable.Row[] = [
	{
		name: "weight",
		type: "number",
		required: true,
		description: "Grams, or ounces on an imperial account.",
	},
	{ name: "length", type: "number", required: true },
	{ name: "width", type: "number", required: true },
	{ name: "height", type: "number", required: true },
];

/** Every field of the shipment object, which each shipment endpoint answers with. */
const SHIPMENT_ROWS: readonly PropsTable.Row[] = [
	{ name: "id", type: "string", required: true, description: "Starts with shp_." },
	{ name: "object", type: '"shipment"', required: true },
	{
		name: "status",
		type: '"created" | "purchased" | "in_transit" | "delivered" | "voided"',
		required: true,
		description: "Moves forward only; webhooks announce each change.",
	},
	{
		name: "from",
		type: "object",
		required: true,
		description: "The sender.",
		children: ADDRESS_ROWS,
	},
	{
		name: "to",
		type: "object",
		required: true,
		description: "The recipient.",
		children: ADDRESS_ROWS,
	},
	{ name: "parcel", type: "object", required: true, children: PARCEL_ROWS },
	{
		name: "rate",
		type: "object",
		description: "The rate bought; absent until the shipment is purchased.",
		children: [
			{
				name: "carrier",
				type: "string",
				required: true,
				description: "Such as ups or dhl_express.",
			},
			{ name: "service", type: "string", required: true, description: "Such as ground." },
			{
				name: "amount",
				type: "integer",
				required: true,
				description: "In the currency’s smallest unit.",
			},
			{ name: "currency", type: "string", required: true },
			{ name: "delivery_days", type: "integer", description: "The carrier’s estimate." },
		],
	},
	{ name: "label_url", type: "string", description: "A PDF of the label, once purchased." },
	{ name: "tracker_id", type: "string", description: "The tracker following the parcel." },
	{ name: "created", type: "integer", required: true, description: "Unix timestamp, in seconds." },
];

/** A purchased shipment as the API answers it. */
const SHIPMENT_JSON = `{
  "id": "shp_9Qx2LmT4",
  "object": "shipment",
  "status": "purchased",
  "from": { "name": "Lumen Coffee", "line1": "48 Harbour St", "city": "Portland", "postal_code": "97209", "country": "US" },
  "to": { "name": "Ada Byron", "line1": "12 Elm Ave", "city": "Austin", "postal_code": "78701", "country": "US" },
  "parcel": { "weight": 850, "length": 20, "width": 15, "height": 10 },
  "rate": { "carrier": "ups", "service": "ground", "amount": 1245, "currency": "usd", "delivery_days": 3 },
  "label_url": "https://files.parcelo.dev/labels/shp_9Qx2LmT4.pdf",
  "tracker_id": "trk_3Fh8Pq1Z",
  "created": 1793491200
}`;

/** The shipment object: every field, then one as the API answers it. */
export const SHIPMENT_OBJECT: DemoDocsPage = {
	title: "The shipment object",
	description:
		"A shipment is one parcel from a sender to a recipient, with the rate bought for it and the label to print.",
	updated: "2026-10-28",
	toc: [
		{ id: "fields", text: "Fields", level: 2 },
		{ id: "example", text: "Example", level: 2 },
		{ id: "lifecycle", text: "Lifecycle", level: 2 },
	],
	next: [
		{
			title: "Create a shipment",
			href: href("shipments/create"),
			description: "Buy a label in one request.",
		},
		{
			title: "Webhook events",
			href: href("webhooks/events"),
			description: "Hear about every status change as it happens.",
		},
	],
	render: () => (
		<>
			<Heading id="fields">Fields</Heading>
			<Fields label="The shipment object" rows={SHIPMENT_ROWS} />

			<Heading id="example">Example</Heading>
			<Code title="The shipment object" language="json" code={SHIPMENT_JSON} />

			<Heading id="lifecycle">Lifecycle</Heading>
			<p>
				A shipment starts <code>created</code> when you quote it, becomes <code>purchased</code>{" "}
				when a rate is bought, and then follows the carrier: <code>in_transit</code>, then{" "}
				<code>delivered</code>. A purchased label voided within 24 hours is refunded and the
				shipment ends <code>voided</code>.
			</p>
		</>
	),
};

/** Create a shipment: the body, the example, the response and its errors. */
export const CREATE_SHIPMENT: DemoDocsPage = {
	title: "Create a shipment",
	description:
		"Quote a parcel and, with purchase set, buy the cheapest or a chosen rate and get its label in the same request.",
	updated: "2026-10-30",
	toc: [
		{ id: "request", text: "Request", level: 2 },
		{ id: "example-request", text: "Example request", level: 2 },
		{ id: "response", text: "Response", level: 2 },
		{ id: "errors", text: "Errors", level: 2 },
	],
	next: [
		{
			title: "Retrieve a shipment",
			href: href("shipments/retrieve"),
			description: "Read the shipment back, with its label and tracker.",
		},
		{
			title: "Retrieve a tracker",
			href: href("tracking/retrieve"),
			description: "Follow the parcel once the carrier scans it.",
		},
	],
	render: () => (
		<>
			<Endpoint method="POST" path="/v1/shipments" />

			<Heading id="request">Request</Heading>
			<p>Send the body as JSON. Addresses are verified before any rate is quoted.</p>
			<Fields
				label="Body parameters"
				rows={[
					{
						name: "from",
						type: "object",
						required: true,
						description: "The sender.",
						children: ADDRESS_ROWS,
					},
					{
						name: "to",
						type: "object",
						required: true,
						description: "The recipient.",
						children: ADDRESS_ROWS,
					},
					{ name: "parcel", type: "object", required: true, children: PARCEL_ROWS },
					{
						name: "purchase",
						type: "object",
						description: "Buys a rate in the same request; without it the shipment is only quoted.",
						children: [
							{
								name: "strategy",
								type: '"cheapest" | "fastest" | "service"',
								default: '"cheapest"',
								description: "How the rate is chosen.",
							},
							{
								name: "service",
								type: "string",
								description: "The carrier service to buy, with strategy service.",
							},
						],
					},
					{
						name: "metadata",
						type: "object",
						description: "Up to 20 string pairs of your own, such as your order id.",
					},
				]}
			/>

			<Heading id="example-request">Example request</Heading>
			<RequestExample
				method="POST"
				path="/v1/shipments"
				body={{
					from: {
						name: "Lumen Coffee",
						line1: "48 Harbour St",
						city: "Portland",
						postal_code: "97209",
						country: "US",
					},
					to: {
						name: "Ada Byron",
						line1: "12 Elm Ave",
						city: "Austin",
						postal_code: "78701",
						country: "US",
					},
					parcel: { weight: 850, length: 20, width: 15, height: 10 },
					purchase: { strategy: "cheapest" },
				}}
			/>
			<Aside kind="tip">
				Send an <code>Idempotency-Key</code> header with your order id, so a retried request never
				buys a second label.
			</Aside>

			<Heading id="response">Response</Heading>
			<p>
				Answers <code>201</code> with the shipment object. With <code>purchase</code> set, its{" "}
				<code>rate</code>, <code>label_url</code> and <code>tracker_id</code> are filled in.
			</p>
			<Code title="201 Created" language="json" code={SHIPMENT_JSON} />

			<Heading id="errors">Errors</Heading>
			<ErrorCodes
				codes={[
					{ status: 400, code: "address_unverified", when: "An address doesn’t match a real one." },
					{
						status: 400,
						code: "parcel_too_heavy",
						when: "No carrier on the account takes the weight.",
					},
					{
						status: 402,
						code: "balance_insufficient",
						when: "The account’s balance can’t cover the rate.",
					},
					{
						status: 502,
						code: "carrier_unavailable",
						when: "The carrier failed to quote or sell.",
					},
				]}
			/>
		</>
	),
};

/** Retrieve a shipment: the path parameter, the example and the response. */
export const RETRIEVE_SHIPMENT: DemoDocsPage = {
	title: "Retrieve a shipment",
	description: "Read one shipment by its id, with its current status, label and tracker.",
	updated: "2026-10-20",
	toc: [
		{ id: "request", text: "Request", level: 2 },
		{ id: "example-request", text: "Example request", level: 2 },
		{ id: "response", text: "Response", level: 2 },
		{ id: "errors", text: "Errors", level: 2 },
	],
	next: [
		{
			title: "List shipments",
			href: href("shipments/list"),
			description: "Read many shipments at once, filtered by status.",
		},
	],
	render: () => (
		<>
			<Endpoint method="GET" path="/v1/shipments/{id}" />

			<Heading id="request">Request</Heading>
			<Fields
				label="Path parameters"
				rows={[
					{ name: "id", type: "string", required: true, description: "The shipment’s id, shp_…." },
				]}
			/>

			<Heading id="example-request">Example request</Heading>
			<RequestExample method="GET" path="/v1/shipments/shp_9Qx2LmT4" />

			<Heading id="response">Response</Heading>
			<p>
				Answers <code>200</code> with the <a href={href("shipments/object")}>shipment object</a>.
			</p>
			<Code title="200 OK" language="json" code={SHIPMENT_JSON} />

			<Heading id="errors">Errors</Heading>
			<ErrorCodes
				codes={[
					{ status: 404, code: "resource_missing", when: "No shipment has that id in this mode." },
				]}
			/>
		</>
	),
};

/** List shipments: the filters, the example and the list object. */
export const LIST_SHIPMENTS: DemoDocsPage = {
	title: "List shipments",
	description: "Page through the account’s shipments, newest first, filtered by status or date.",
	updated: "2026-10-20",
	toc: [
		{ id: "request", text: "Request", level: 2 },
		{ id: "example-request", text: "Example request", level: 2 },
		{ id: "response", text: "Response", level: 2 },
		{ id: "errors", text: "Errors", level: 2 },
	],
	next: [
		{
			title: "Pagination",
			href: href("introduction/pagination"),
			description: "How the cursor works, with a loop that reads every page.",
		},
	],
	render: () => (
		<>
			<Endpoint method="GET" path="/v1/shipments" />

			<Heading id="request">Request</Heading>
			<Fields
				label="Query parameters"
				rows={[
					{ name: "status", type: "string", description: "Only shipments in this status." },
					{
						name: "created",
						type: "object",
						description: "Only shipments created in a range of Unix timestamps.",
						children: [
							{ name: "gte", type: "integer", description: "On or after." },
							{ name: "lt", type: "integer", description: "Before." },
						],
					},
					{ name: "limit", type: "integer", default: "10", description: "From 1 to 100." },
					{ name: "starting_after", type: "string", description: "The cursor from the last page." },
				]}
			/>

			<Heading id="example-request">Example request</Heading>
			<RequestExample
				method="GET"
				path="/v1/shipments"
				query={{ status: "in_transit", limit: "2" }}
			/>

			<Heading id="response">Response</Heading>
			<Code
				title="200 OK"
				language="json"
				code={
					'{\n  "object": "list",\n  "data": [\n    { "id": "shp_9Qx2LmT4", "object": "shipment", "status": "in_transit" },\n    { "id": "shp_7Kd1RwB8", "object": "shipment", "status": "in_transit" }\n  ],\n  "has_more": true,\n  "next_cursor": "shp_7Kd1RwB8"\n}'
				}
			/>

			<Heading id="errors">Errors</Heading>
			<ErrorCodes
				codes={[
					{
						status: 400,
						code: "parameter_invalid",
						when: "A filter’s value isn’t one it accepts.",
					},
				]}
			/>
		</>
	),
};
