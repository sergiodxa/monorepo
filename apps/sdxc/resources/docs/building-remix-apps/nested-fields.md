---
title: Read nested query strings and forms
description: Read bracket keys like filter[status][] and items[0][quantity] into typed objects and arrays, from a URL or a form post, and write them back.
section:
    title: Building Remix apps
    order: 3
order: 8
lastUpdated: 2026-09-30
---

`URLSearchParams` and `FormData` are flat: a name maps to strings. A list page's filters and
a form with repeated rows are not flat, and the convention browsers and servers share for them
is bracket syntax. [`@sdxc/bracket-params`](/api/bracket-params) reads those keys into nested
objects and arrays, validates the result against your schema in the same call, and writes a
value back as a query string or a form.

```bash
npm add remix @sdxc/bracket-params @sdxc/result @sdxc/ui
```

The examples assume the router from
[Wire the router](/docs/building-remix-apps/wire-the-router): its `formData()` middleware has
already parsed the body into `ctx.formData`, and its database middleware publishes `ctx.db`.
`Task` and `Invoice` stand for your own models.

## How keys read

Every value is read as a string, and the schema decides its type. A group whose keys are all
indices, or `[]` pushes, becomes an array.

| Field names                         | Value                                       |
| ----------------------------------- | ------------------------------------------- |
| `q=bug`                             | `{ q: "bug" }`                              |
| `filter[status]=open`               | `{ filter: { status: "open" } }`            |
| `tags[]=a&tags[]=b`                 | `{ tags: ["a", "b"] }`                      |
| `tags=a&tags=b`                     | `{ tags: ["a", "b"] }`                      |
| `items[0][name]=A&items[1][name]=B` | `{ items: [{ name: "A" }, { name: "B" }] }` |
| `items[1][name]=B&items[0][name]=A` | the same array, ordered by index            |

A key used both as a value and as a group (`a=1&a[b]=2`) fails the parse. So do a key nested
more than five brackets deep and a source with more than 1,000 entries, since a URL is input
anyone can write. Both limits are options of `parse`.

## Filter a list from the query string

A list page keeps its state in the URL, so a filtered view can be bookmarked, shared and
reloaded. Describe the whole query as one schema, with a default for everything a bare `/tasks`
leaves out:

```typescript {% title="app/http/validators/task-query.ts" %}
import * as s from "remix/data-schema";
import { min } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

export const STATUSES = ["open", "blocked", "done"] as const;

export const TaskQuerySchema = s.object({
	q: s.defaulted(s.string(), ""),
	filter: s.defaulted(
		s.object({ status: s.defaulted(s.array(s.enum_(STATUSES)), []) }),
		{ status: [] },
	),
	sort: s.defaulted(
		s.object({ field: s.enum_(["due", "title"]), dir: s.enum_(["asc", "desc"]) }),
		{ field: "due", dir: "asc" },
	),
	page: s.defaulted(coerce.number().pipe(min(1)), 1),
});

export type TaskQuery = s.InferOutput<typeof TaskQuerySchema>;
```

`parse(source, schema)` reads a `URL` directly, and it also takes a query string, a
`URLSearchParams` or an `@sdxc/location` `Location`. It returns a `Result`: the schema's
output, or a `ValidationError` whose issues carry each path. A query the page cannot read is a
URL that names nothing, so it gets the router's 404:

```tsx {% title="app/http/controllers/tasks.tsx" %}
import { parse } from "@sdxc/bracket-params";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Task from "~/app/data/task";
import defaultHandler from "~/app/http/controllers/default-handler";
import { TaskQuerySchema } from "~/app/http/validators/task-query";
import { TasksPage } from "~/resources/views/tasks";
import routes from "~/routes/web";

export default createAction(routes.tasks, async (ctx) => {
	let query = parse(ctx.url, TaskQuerySchema);
	if (isFailure(query)) return defaultHandler(ctx);

	let tasks = await Task.search(ctx.db, query.data);
	return ctx.render(<TasksPage query={query.data} tasks={tasks} />);
});
```

`?q=invoice&filter[status][]=open&filter[status][]=blocked&sort[field]=title&sort[dir]=desc&page=2`
arrives as:

```typescript
{
	q: "invoice",
	filter: { status: ["open", "blocked"] },
	sort: { field: "title", dir: "desc" },
	page: 2,
}
```

### Write the filters as a form

A `GET` form writes the query for you. Name each input with the key it fills: every checked
box submits one `filter[status][]`, so the statuses arrive as an array, and none checked falls
back to the schema's `[]`. The current sort travels along in hidden inputs, so filtering keeps
it.

```tsx {% title="resources/views/tasks.tsx" %}
import type { Handle } from "remix/ui";

import { Button, Checkbox, CheckboxGroup, Label, TextField } from "@sdxc/ui";

import type { TaskRow } from "~/app/data/task";
import type { TaskQuery } from "~/app/http/validators/task-query";

import { STATUSES } from "~/app/http/validators/task-query";

interface Props {
	query: TaskQuery;
	tasks: TaskRow[];
}

export function TasksPage(handle: Handle<Props>) {
	return () => {
		let { query } = handle.props;

		return (
			<form method="get">
				<TextField
					label="Search"
					name="q"
					type="search"
					defaultValue={query.q}
				/>

				<CheckboxGroup
					aria-labelledby="status-label"
					orientation="horizontal"
				>
					<Label id="status-label">Status</Label>
					{STATUSES.map((status) => (
						<Checkbox
							name="filter[status][]"
							value={status}
							defaultChecked={query.filter.status.includes(status)}
						>
							{status}
						</Checkbox>
					))}
				</CheckboxGroup>

				<input type="hidden" name="sort[field]" value={query.sort.field} />
				<input type="hidden" name="sort[dir]" value={query.sort.dir} />

				<Button type="submit">Filter</Button>
			</form>
		);
	};
}
```

The form leaves `page` out on purpose: a new filter starts again from the first page.

### Link to another page of the same view

A sort header or a pager link changes one part of the query and keeps the rest. `stringify`
writes a nested value back in the syntax `parse` reads, so a link is the current query with one
field replaced:

```tsx {% title="resources/views/task-links.tsx" %}
import type { Handle } from "remix/ui";

import { stringify } from "@sdxc/bracket-params";
import { Link } from "@sdxc/ui";

import type { TaskQuery } from "~/app/http/validators/task-query";

import routes from "~/routes/web";

export function TaskLinks(handle: Handle<{ query: TaskQuery }>) {
	return () => {
		let { query } = handle.props;
		let href = (next: Partial<TaskQuery>) =>
			`${routes.tasks.href()}?${stringify({ ...query, ...next })}`;

		return (
			<nav>
				<Link href={href({ sort: { field: "title", dir: "asc" }, page: 1 })}>
					Sort by title
				</Link>
				<Link href={href({ page: query.page + 1 })}>Next page</Link>
			</nav>
		);
	};
}
```

`stringify` returns the encoded string without its `?`, so `new URLSearchParams(stringify(value))`
gives the object form when an API wants one. Arrays are written with indices
(`filter[status][0]=open`), which `parse` reads back as the same array.

## Read a form with nested fields

A form that edits a document with parts, such as an invoice with a customer, repeated line items
and attachments, names its inputs after the path each value takes. The schema then reads like
the document rather than a list of flat names:

```typescript {% title="app/http/validators/invoice.ts" %}
import * as s from "remix/data-schema";
import { email, min, minLength } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

export const InvoiceSchema = s.object({
	customer: s.object({
		name: s.string().pipe(minLength(2)),
		email: s.string().pipe(email()),
	}),
	items: s.array(
		s.object({
			description: s.string().pipe(minLength(1)),
			quantity: coerce.number().pipe(min(1)),
		}),
	),
	attachments: s
		.defaulted(s.array(s.instanceof_(File)), [])
		.transform((files) => files.filter((file) => file.size > 0)),
});
```

A file input the visitor left empty still submits one nameless, empty `File`, which is why
`attachments` drops files with no bytes.

### Name the inputs

The customer's fields are written out, so the syntax is visible. The line items are generated,
and `fieldName(path)` writes a path as its bracket name: `fieldName(["items", 0, "quantity"])`
is `items[0][quantity]`. The file input submits one `attachments[]` per chosen file.

```tsx {% title="resources/views/new-invoice.tsx" %}
import type { Handle } from "remix/ui";

import { fieldName } from "@sdxc/bracket-params";
import { Button, FileTrigger, Form, TextField } from "@sdxc/ui";

interface Props {
	issues?: ReadonlyArray<Form.Issue>;
	submitted?: FormData;
	rows?: number;
}

export function NewInvoicePage(handle: Handle<Props>) {
	return () => {
		let { issues, submitted, rows = 3 } = handle.props;
		let value = (name: string) => String(submitted?.get(name) ?? "");

		return (
			<Form method="post" encType="multipart/form-data" issues={issues}>
				<TextField
					label="Customer name"
					name="customer[name]"
					defaultValue={value("customer[name]")}
					required
				/>
				<TextField
					label="Customer email"
					name="customer[email]"
					type="email"
					defaultValue={value("customer[email]")}
					required
				/>

				{Array.from({ length: rows }, (_, index) => {
					let description = fieldName(["items", index, "description"]);
					let quantity = fieldName(["items", index, "quantity"]);

					return (
						<fieldset>
							<legend>Line {index + 1}</legend>
							<TextField
								label="Description"
								name={description}
								defaultValue={value(description)}
							/>
							<TextField
								label="Quantity"
								name={quantity}
								type="number"
								defaultValue={value(quantity) || "1"}
							/>
						</fieldset>
					);
				})}

				<FileTrigger name="attachments[]" multiple accept="application/pdf">
					Attach PDFs
				</FileTrigger>

				<Button type="submit">Create invoice</Button>
			</Form>
		);
	};
}
```

The form needs `encType="multipart/form-data"` for the files to be sent at all; without files,
the default URL-encoded body reads the same way.

### Validate in the action

`parse` reads `ctx.formData` like it reads a URL, and a `File` arrives as a value unchanged:

```tsx {% title="app/http/controllers/invoices-new.tsx" %}
import { fieldName, parse } from "@sdxc/bracket-params";
import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createController } from "remix/router";

import Invoice from "~/app/data/invoice";
import { InvoiceSchema } from "~/app/http/validators/invoice";
import { NewInvoicePage } from "~/resources/views/new-invoice";
import routes from "~/routes/web";

export default createController(routes.invoices.new, {
	actions: {
		index: (ctx) => ctx.render(<NewInvoicePage />),

		action: async (ctx) => {
			let result = parse(ctx.formData, InvoiceSchema);

			if (isFailure(result)) {
				let issues = result.error.issues.map((issue) =>
					issue.path?.length
						? { ...issue, path: [fieldName(issue.path)] }
						: issue,
				);
				let page = (
					<NewInvoicePage issues={issues} submitted={ctx.formData} />
				);
				return ctx.render(page, { status: 400 });
			}

			let invoice = await Invoice.create(ctx.db, result.data);
			return redirect(routes.invoices.show.href({ id: invoice.id }), {
				status: redirect.Status.SeeOther,
			});
		},
	},
});
```

An issue's `path` is the structural path, `["items", 0, "quantity"]`. `@sdxc/ui`'s `Form`
finds a field's issues by its `name`, so the action rewrites each path into the one-segment
bracket name the input carries, and the message lands beside `items[0][quantity]`. An issue with
no path is about the form as a whole and passes through unchanged. Indices match as long as the
rows are numbered from `0` without gaps, which is how the view writes them.

A refused post answers with the same page, its issues and what the visitor typed, and a 400; an
accepted one redirects with a 303. [Validate forms and route params](/docs/building-remix-apps/forms-and-params)
explains why each outcome answers the way it does.

## Submit a nested form from code

`toFormData(value)` writes an object as `FormData` with the same keys the view names, appending
each `File` as its own field. It is how a test posts to the action without spelling every key:

```typescript {% title="app/http/controllers/invoices-new.test.ts" %}
import { toFormData } from "@sdxc/bracket-params";

import application from "~/bootstrap/app";

let body = toFormData({
	customer: { name: "Ada Lovelace", email: "ada@example.com" },
	items: [
		{ description: "Design review", quantity: 2 },
		{ description: "Implementation", quantity: 5 },
	],
	attachments: [new File(["%PDF-1.7"], "brief.pdf", { type: "application/pdf" })],
});

let response = await application().fetch(
	new Request("https://example.com/invoices/new", { method: "POST", body }),
);
```

The same call builds the body of a `fetch` from a client script. Numbers and booleans are
written as text and a `Date` as its ISO string. `null` and `undefined` are skipped, so an
optional field can be passed as-is.

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params): flat forms,
  route params and JSON bodies, with `@sdxc/validate`.
- [Build the interface with remix/ui](/docs/building-remix-apps/interface-with-remix-ui): the
  components the forms above are built from.
- [Paginate lists](/docs/http-apis/paginate-lists): cursors and page links for the list the
  filters narrow.
