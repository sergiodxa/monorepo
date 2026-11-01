/**
 * Parcelo's tracking and webhooks pages: reading where a parcel is, and the events the API
 * posts as a shipment moves, with how to verify that a post came from Parcelo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Fields, Heading } from "~/resources/views/demo-docs/blocks";
import { Endpoint, ErrorCodes, RequestExample } from "~/resources/views/demo-docs/parcelo/endpoint";

/** The addresses of Parcelo's pages. */
const href = demoDocsHref("parcelo");

/** Retrieve a tracker: the path parameter, the example, the tracker and its events. */
export const RETRIEVE_TRACKER: DemoDocsPage = {
	title: "Retrieve a tracker",
	description:
		"Read where a parcel is: its current status, the carrier’s estimate and every scan so far.",
	updated: "2026-10-25",
	toc: [
		{ id: "request", text: "Request", level: 2 },
		{ id: "example-request", text: "Example request", level: 2 },
		{ id: "response", text: "Response", level: 2 },
		{ id: "errors", text: "Errors", level: 2 },
	],
	next: [
		{
			title: "Webhook events",
			href: href("webhooks/events"),
			description: "Get each scan pushed to you instead of polling.",
		},
	],
	render: () => (
		<>
			<Endpoint method="GET" path="/v1/trackers/{id}" />

			<Heading id="request">Request</Heading>
			<Fields
				label="Path parameters"
				rows={[
					{
						name: "id",
						type: "string",
						required: true,
						description: "The tracker’s id, from a shipment’s tracker_id.",
					},
				]}
			/>

			<Heading id="example-request">Example request</Heading>
			<RequestExample method="GET" path="/v1/trackers/trk_3Fh8Pq1Z" />

			<Heading id="response">Response</Heading>
			<Fields
				label="The tracker object"
				rows={[
					{ name: "id", type: "string", required: true },
					{ name: "status", type: "string", required: true, description: "The shipment’s status." },
					{ name: "eta", type: "string", description: "The carrier’s estimated delivery date." },
					{
						name: "events",
						type: "array",
						required: true,
						description: "Every scan, newest first.",
						children: [
							{ name: "time", type: "integer", required: true, description: "Unix timestamp." },
							{ name: "description", type: "string", required: true },
							{ name: "location", type: "string", description: "City and country of the scan." },
						],
					},
				]}
			/>
			<Code
				title="200 OK"
				language="json"
				code={
					'{\n  "id": "trk_3Fh8Pq1Z",\n  "object": "tracker",\n  "status": "in_transit",\n  "eta": "2026-11-03",\n  "events": [\n    { "time": 1793570400, "description": "Departed facility", "location": "Denver, US" },\n    { "time": 1793502000, "description": "Picked up", "location": "Portland, US" }\n  ]\n}'
				}
			/>

			<Heading id="errors">Errors</Heading>
			<ErrorCodes
				codes={[
					{ status: 404, code: "resource_missing", when: "No tracker has that id in this mode." },
				]}
			/>
		</>
	),
};

/** Webhook events: the event types, the payload, and verifying the signature. */
export const WEBHOOK_EVENTS: DemoDocsPage = {
	title: "Webhook events",
	description:
		"Parcelo posts an event to your endpoint each time a shipment changes, signed so you can tell it came from Parcelo.",
	updated: "2026-10-31",
	toc: [
		{ id: "event-types", text: "Event types", level: 2 },
		{ id: "the-event-object", text: "The event object", level: 2 },
		{ id: "verify-the-signature", text: "Verify the signature", level: 2 },
		{ id: "retries", text: "Retries", level: 2 },
	],
	next: [
		{
			title: "The shipment object",
			href: href("shipments/object"),
			description: "The object every shipment event carries.",
		},
		{
			title: "Errors",
			href: href("introduction/errors"),
			description: "What your endpoint’s answers mean to Parcelo’s retries.",
		},
	],
	render: () => (
		<>
			<p>
				Add an endpoint in the dashboard under Developers → Webhooks. Parcelo posts JSON to it and
				expects a <code>2xx</code> within ten seconds.
			</p>

			<Heading id="event-types">Event types</Heading>
			<table>
				<thead>
					<tr>
						<th>Type</th>
						<th>Sent when</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>shipment.purchased</code>
						</td>
						<td>A label is bought.</td>
					</tr>
					<tr>
						<td>
							<code>tracker.updated</code>
						</td>
						<td>The carrier scans the parcel.</td>
					</tr>
					<tr>
						<td>
							<code>shipment.delivered</code>
						</td>
						<td>The carrier confirms delivery.</td>
					</tr>
					<tr>
						<td>
							<code>shipment.voided</code>
						</td>
						<td>A label is voided and refunded.</td>
					</tr>
				</tbody>
			</table>

			<Heading id="the-event-object">The event object</Heading>
			<Fields
				label="The event object"
				rows={[
					{
						name: "id",
						type: "string",
						required: true,
						description: "Starts with evt_; use it to skip repeats.",
					},
					{ name: "type", type: "string", required: true },
					{
						name: "data",
						type: "object",
						required: true,
						children: [
							{
								name: "object",
								type: "object",
								required: true,
								description: "The shipment or tracker as it is after the change.",
							},
						],
					},
					{ name: "created", type: "integer", required: true },
				]}
			/>

			<Heading id="verify-the-signature">Verify the signature</Heading>
			<p>
				Each post carries a <code>Parcelo-Signature</code> header: an HMAC-SHA256 of the raw body
				with your endpoint’s signing secret. Compare it before trusting the event.
			</p>
			<Code
				title="app/webhooks/parcelo.js"
				language="js"
				highlight={[6, 7]}
				code={
					'import { createHmac, timingSafeEqual } from "node:crypto";\n\nexport async function handle(request) {\n\tlet body = await request.text();\n\tlet signature = request.headers.get("Parcelo-Signature") ?? "";\n\tlet expected = createHmac("sha256", process.env.PARCELO_WEBHOOK_SECRET).update(body).digest("hex");\n\tif (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return new Response(null, { status: 400 });\n\tlet event = JSON.parse(body);\n\treturn new Response(null, { status: 204 });\n}'
				}
			/>
			<Aside kind="warning">
				Hash the body exactly as it arrived. Parsing and re-serializing it changes the bytes, and
				every signature check fails.
			</Aside>

			<Heading id="retries">Retries</Heading>
			<p>
				An answer other than <code>2xx</code>, or none within ten seconds, is retried with backoff
				for three days. Events can arrive more than once and out of order, so key your handling on
				the event’s <code>id</code>.
			</p>
		</>
	),
};
