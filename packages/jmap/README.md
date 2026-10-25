# @sdxc/jmap

A typed JMAP client: session, batched method calls with result references, mail and contacts, blobs and push.

[JMAP](https://jmap.io) ([RFC 8620](https://www.rfc-editor.org/rfc/rfc8620)) replaces IMAP and
CardDAV round trips with JSON method calls sent in batches. This client reads the Session, sends
batches typed by method name, lets one call take its arguments from an earlier call's result,
and covers [RFC 8621](https://www.rfc-editor.org/rfc/rfc8621) mail and
[RFC 9610](https://www.rfc-editor.org/rfc/rfc9610) contacts. Every failure is returned as a
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), never thrown.

## Installation

```sh
npm add @sdxc/jmap remix
```

`remix` is a peer dependency: responses are checked with `remix/data-schema`.

## Usage

### Connect to a server

Pass the Session URL and a bearer token. With [Fastmail](https://www.fastmail.com/dev/), the
token is an API token from the account's Privacy & Security settings.

```typescript
import { JMAP } from "@sdxc/jmap";

let jmap = new JMAP({ url: "https://api.fastmail.com/jmap/session", token: fastmailToken });
```

A URL with only an origin, such as `https://jmap.example.com`, reads that host's
`/.well-known/jmap`. The Session is fetched on first use and fetched again after a response
reports a new `sessionState`.

### Read the latest emails in the inbox

Calls added to a `Batch` run in order in one request. `call.ref(path)` passes part of an earlier
call's response as a whole argument, so the query and the fetch of what it found need one round
trip. Read each call's outcome from the response with the call.

```typescript
import { Batch, CAPABILITIES } from "@sdxc/jmap";
import { unwrap } from "@sdxc/result";

let session = await unwrap(jmap.session());
let accountId = session.primaryAccounts[CAPABILITIES.mail] ?? "";

let mailboxes = new Batch();
let inbox = mailboxes.call("Mailbox/query", { accountId, filter: { role: "inbox" } });
let inboxId = unwrap(unwrap(await jmap.send(mailboxes)).get(inbox)).ids[0] ?? "";

let batch = new Batch();
let query = batch.call("Email/query", {
	accountId,
	filter: { inMailbox: inboxId },
	sort: [{ property: "receivedAt", isAscending: false }],
	limit: 10,
});
let emails = batch.call("Email/get", {
	accountId,
	ids: query.ref("/ids"),
	properties: ["from", "subject", "receivedAt", "preview"],
});

let response = await unwrap(jmap.send(batch));
for (let email of unwrap(response.get(emails)).list) console.log(email.subject);
```

### Handle failures

`jmap.send()` fails with a `JMAPRequestError` when the request as a whole was rejected; each
call's outcome is read separately and fails with a `JMAPMethodError`.

```typescript
import { isFailure } from "@sdxc/result";

let response = await jmap.send(batch);
if (isFailure(response)) {
	if (response.error.type === "limit") console.log(response.error.limit); // "maxCallsInRequest"
	throw response.error;
}

let result = response.data.get(emails);
if (isFailure(result) && result.error.retryable) {
	/* serverUnavailable: send the call again later */
}
```

### Change records

`/set` takes patches keyed by property path. Each record that failed is in `notCreated`,
`notUpdated` or `notDestroyed` with its `SetError`.

```typescript
let batch = new Batch();
let seen = batch.call("Email/set", {
	accountId,
	update: { [emailId]: { "keywords/$seen": true } },
});

let result = unwrap(unwrap(await jmap.send(batch)).get(seen));
let failed = result.notUpdated?.[emailId]; // { type: "notFound" }, or undefined
```

### Upload and download blobs

```typescript
let uploaded = await unwrap(jmap.upload(accountId, file, "image/png"));

let download = await unwrap(
	jmap.download({ accountId, blobId: uploaded.blobId, name: "photo.png", type: "image/png" }),
);
let bytes = await download.arrayBuffer();
```

### Listen for changes

`jmap.events()` opens the Session's event-source stream. A StateChange carries each changed
type's new state; compare it with yours and call that type's `/changes`.

```typescript
let events = await unwrap(jmap.events({ types: ["Email", "Mailbox"] }));

for await (let event of events) {
	if (event.type === "state") console.log(event.change.changed[accountId]);
}
```

A push service delivering to a `PushSubscription` POSTs the same objects; read the body with
`parsePush()`.

## API

### `new JMAP(options: JMAP.Options)`

- `options.url`: the Session resource, or an origin whose `/.well-known/jmap` serves it.
- `options.token`: the bearer token sent as `Authorization` on every request.

`JMAP` extends [`@sdxc/api-client`](https://www.npmjs.com/package/@sdxc/api-client)'s
`APIClient`, so every request carries the running W3C trace.

### `jmap.session(): Promise<Result<Session, JMAPRequestError>>`

The Session, cached until an API response reports a different `sessionState`.

### `jmap.send(batch: Batch): Promise<Result<BatchResponse, JMAPRequestError>>`

Posts the batch to the Session's `apiUrl`.

### `jmap.upload(accountId, body, type): Promise<Result<UploadedBlob, JMAPRequestError>>`

Posts the bytes to the expanded `uploadUrl`. The result's `blobId` is what later calls reference.

### `jmap.download(options: DownloadOptions): Promise<Result<Response, JMAPRequestError>>`

GETs the expanded `downloadUrl` for `accountId`, `blobId`, `name` and `type`, and returns the
streaming response.

### `jmap.events(options?: EventsOptions): Promise<Result<AsyncGenerator<PushEvent>, JMAPRequestError>>`

Opens the expanded `eventSourceUrl`. Options: `types` (every type by default), `closeAfter`
(`"no"` by default), `ping` in seconds (300 by default), `lastEventId` and `signal`.

### `new Batch(options?: BatchOptions)`

- `options.using`: capabilities to name beyond the ones the called methods need, such as a
  vendor extension's. Core, mail, submission, vacation response and contacts are added from the
  method names.
- `options.createdIds`: creation ids from an earlier request.

### `batch.call(name, args, options?): Call`

Adds a call typed by `Methods[name]`. Any argument may be a `ResultReference`, sent as
`"#" + name`. `options.id` sets the call id; the default is the call's position, `"0"`, `"1"`…

### `call.ref(path: string | (string | number)[], name?: string): ResultReference`

A reference to the call's response at a JSON Pointer, where `*` maps through an array. Pass
segments to have them escaped. `name` reads another response the call produced, such as the
`Email/set` an `EmailSubmission/set` adds.

### `response.get(call, name?): Result<ResponseOf<Name>, JMAPMethodError>`

The call's response, or its `error`. A call the server left unanswered fails as `serverFail`.
`response.responses(call)` returns every invocation the call produced.

### `JMAPRequestError`

`code` is `problem` (an HTTP error with problem details in `problem`), `http`, `network` or
`invalid-response` (also a Session URL template RFC 6570 rejects, with the
[`@sdxc/uri-template`](https://www.npmjs.com/package/@sdxc/uri-template) error as `cause`). `status` is the HTTP status; `type` is the JMAP problem type without its URN
prefix (`unknownCapability`, `notJSON`, `notRequest`, `limit`) and `limit` the limit a `limit`
problem names.

### `JMAPMethodError`

`type` is the method error type (`unknownMethod`, `invalidArguments`, `stateMismatch`…, and
`serverFail` for one the client does not know), with `description`, `callId`, every error
`arguments` member, `uri` (the registered `urn:ietf:params:jmap:error:` name) and `retryable`.

### `resolveReference(methodResponses, reference): Result<unknown, JMAPMethodError>`

Evaluates a result reference the way the server does, failing with `invalidResultReference`.

### `parsePush(body: unknown): Promise<Result<StateChange | PushVerification, ValidationError>>`

Reads a push service's JSON body.

### `readPushEvents(stream)` and `readEventStream(stream)`

Read a `text/event-stream` body as JMAP `state` and `ping` events, or as raw server-sent events.

### `CAPABILITIES`

The capability URIs: `core`, `mail`, `submission`, `vacationResponse`, `contacts` and `webSocket`.

### Types

- Session: `Session`, `Account`, `Capabilities`, `CoreCapabilities`, `AccountCapabilities`.
- Standard methods: `GetArguments`, `GetResponse`, `ChangesArguments`, `ChangesResponse`,
  `SetArguments`, `SetResponse`, `SetError`, `CopyArguments`, `CopyResponse`, `QueryArguments`,
  `QueryResponse`, `QueryChangesArguments`, `QueryChangesResponse`, `FilterOperator`, `Comparator`.
- Mail: `Mailbox`, `Thread`, `Email`, `EmailBodyPart`, `EmailAddress`, `SearchSnippet`,
  `Identity`, `EmailSubmission`, `VacationResponse`, with their filter conditions and comparators.
- Contacts: `AddressBook` and `ContactCard`, a JSContact Card with `id` and `addressBookIds`.
- Push: `StateChange`, `PushVerification`, `PushSubscription`, `PushEvent`.
- `Methods`: the registry of method names to `{ arguments, response }`.

## Pattern: Typing Another Capability's Methods

Augment `Methods` and name the capability in the batch; calls to the new methods are then
typed like the built-in ones.

```typescript
import type { GetArguments, GetResponse, Method } from "@sdxc/jmap";

import { Batch } from "@sdxc/jmap";

interface Calendar {
	id: string;
	name: string;
}

declare module "@sdxc/jmap" {
	interface Methods {
		"Calendar/get": Method<GetArguments<keyof Calendar>, GetResponse<Calendar>>;
	}
}

let batch = new Batch({ using: ["urn:ietf:params:jmap:calendars"] });
let calendars = batch.call("Calendar/get", { accountId, ids: null });
```

## Pattern: Syncing A Mailbox List

Keep each type's `state` from `/get`, and when a StateChange reports a new one, fetch only what
changed: the `/changes` ids feed two `/get` calls in the same request.

```typescript
let batch = new Batch();
let changes = batch.call("Mailbox/changes", { accountId, sinceState: state });
let created = batch.call("Mailbox/get", { accountId, ids: changes.ref("/created") });
let updated = batch.call("Mailbox/get", {
	accountId,
	ids: changes.ref("/updated"),
	properties: changes.ref("/updatedProperties"),
});
```

A `cannotCalculateChanges` error on `changes` means the state is too old: fetch everything with
`ids: null` instead.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/jmap": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
