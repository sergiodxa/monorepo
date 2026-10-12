/**
 * The type of the `GeoFetchDO` object behind the `GEO_FETCH` binding, read off the binding's
 * generated type, so a test stubs the namespace with the same object shape production binds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The Durable Object class `createDurableObjectNamespace<GeoFetchDO>()` stubs. */
export type GeoFetchDO =
	Cloudflare.Env["GEO_FETCH"] extends DurableObjectNamespace<
		infer Target extends Rpc.DurableObjectBranded
	>
		? Target
		: never;
