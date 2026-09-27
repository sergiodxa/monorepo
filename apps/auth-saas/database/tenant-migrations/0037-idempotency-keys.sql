-- Records each management request that carried an Idempotency-Key: the claim
-- while it runs, then the stored response a retry is answered with until
-- expires_at. Kept in the tenant's own object, next to the data the requests
-- change, so a claim and the write it guards share one consistent store.
create table idempotency_keys (
	id text primary key,
	fingerprint text,
	lease text not null,
	state text not null,
	response text,
	lease_expires_at integer not null,
	expires_at integer not null
);

create index idempotency_keys_expires_at_idx on idempotency_keys (expires_at);
