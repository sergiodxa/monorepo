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
	 * A binding installed once at module scope outlives the tests that use it, so
	 * `beforeEach` can reset the log while keeping the same `env`.
	 */
	reset(): void;
}

/**
 * Creates a fetcher binding from a handler.
 *
 * The handler always receives a real `Request`, however the caller passed it, so
 * assertions on method, path, and headers match those against the deployed Worker.
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
		 * Answers a request through the handler.
		 *
		 * Recording happens first so a handler that throws still leaves evidence of
		 * what was asked for; every input passes through the `Request` constructor.
		 * @param input Request, URL, or URL string, as the platform accepts.
		 * @param init Request options applied when `input` is not already a `Request`.
		 * @returns Whatever the handler returned.
		 */
		async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
			let request: Request = new Request(input as RequestInfo, init);

			requests.push(request.clone() as Request);

			return handler(request);
		},

		/** Rejects raw socket connections, which have no in-memory equivalent. */
		connect(): Socket {
			throw new Error("Fetcher.connect is not implemented by @pkg/cloudflare-mocks");
		},
	};
}
