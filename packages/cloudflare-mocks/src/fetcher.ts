/**
 * `Fetcher` binding backed by a handler, for service bindings and the static-asset
 * binding. Requests are recorded, so a test can assert what the Worker asked its
 * neighbour for and not only what came back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/**
 * Answers one request the way the bound Worker would.
 * @param request The request the caller made, already normalized to a `Request`.
 */
export type FetcherHandler = (request: Request) => Response | Promise<Response>;

/** A `Fetcher` binding that records the requests it answered. */
export interface FetcherMock extends Fetcher {
	/** Requests received so far, oldest first. */
	readonly requests: readonly Request[];

	/**
	 * Discards every recorded request, as if nothing had been fetched.
	 *
	 * A binding installed once at module scope outlives the test that used it, so this is
	 * how a `beforeEach` starts from an empty log without re-creating the `env` the code
	 * under test already captured.
	 */
	reset(): void;
}

/**
 * Creates a fetcher binding from a handler.
 *
 * The handler receives a real `Request` whatever the caller passed — a URL, a string, or
 * a `Request` — so assertions on method, path, and headers read the same as they would
 * against the deployed Worker.
 * @param handler Produces the response for each request.
 * @returns A `Fetcher` binding that records requests.
 * @example let assets = createFetcher(() => new Response(null, { status: 404 }));
 * @example expect(assets.requests[0]?.url).toBe("https://example.com/logo.png");
 */
export function createFetcher(handler: FetcherHandler): FetcherMock {
	let requests: Request[] = [];

	return {
		get requests(): readonly Request[] {
			return [...requests];
		},

		reset(): void {
			requests.length = 0;
		},

		/**
		 * Answers a request through the handler, recording it first.
		 * @param input Request, URL, or URL string, as the platform accepts.
		 * @param init Request options applied when `input` is not already a `Request`.
		 * @returns Whatever the handler returned.
		 */
		async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
			// Normalized unconditionally: the constructor copies method, headers, and body from
			// a `Request` input, so one path covers every shape the platform accepts. Annotated
			// because the constructor's `cf` type parameters are otherwise left uninstantiated.
			let request: Request = new Request(input as RequestInfo, init);

			// Recorded before the handler runs so a handler that throws still leaves evidence
			// of what was asked for. The cast is forced by the workspace seeing both the DOM
			// and Workers `Request` declarations: they merge, and the merged `clone()` reports
			// its type parameters uninstantiated. Runtime behaviour is unaffected.
			requests.push(request.clone() as Request);

			return handler(request);
		},

		/** Rejects raw socket connections, which have no in-memory equivalent. */
		connect(): Socket {
			throw new Error("Fetcher.connect is not implemented by @pkg/cloudflare-mocks");
		},
	};
}
