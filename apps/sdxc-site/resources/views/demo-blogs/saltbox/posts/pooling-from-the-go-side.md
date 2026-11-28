---
title: Connection pooling from the Go side
description: Postgres gives every connection its own process, and Go will happily open as many as you let it. How I size a pool, read its numbers, and decide when PgBouncer earns a place in front of the database.
kind: articles
date: "2026-11-04"
tags: [go, postgres, observability]
featured: true
---

Every Go service I have taken over in the last few years had the same line somewhere near `main`: a call to `sql.Open`, and nothing after it. No pool limits, no lifetimes, no metrics. It works on a laptop and in staging. Then a deploy doubles the replica count, or a slow query backs up the request queue, and Postgres starts refusing connections with `FATAL: sorry, too many clients already`.

The fix is rarely more connections. It is usually fewer, held on purpose. This is how I reason about a [connection pool](/showcase/saltbox/demo/glossary/connection-pool) now, from the side of the service that owns it.

## Why Postgres connections are expensive

Postgres forks one backend process per connection. Each one carries its own memory for caches and, during a query, for sorts and hashes sized by `work_mem`. A hundred idle connections cost far less than a hundred busy ones, but even idle ones take part in every snapshot the server builds, because [MVCC](/showcase/saltbox/demo/glossary/mvcc) has to know which transactions are in flight.

The default `max_connections` is 100, and managed providers often set it lower on small instances. That number is shared by every replica of every service, every cron job, your migration tool and the psql session you left open over lunch.

> [!NOTE]
> Raising `max_connections` is a restart, and it raises the ceiling on memory as well as clients. Treat it as the last knob, not the first.

## What database/sql does by default

The standard library's `*sql.DB` is a pool, not a connection. Out of the box it has no limit on open connections and keeps at most two idle ones. Under load that means it opens a new connection for every concurrent query, then closes most of them as soon as the burst ends, and opens them again on the next burst.

Set all four limits explicitly, every time:

```go {% title="internal/db/open.go" %}
package db

import (
	"database/sql"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func Open(dsn string) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(20)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)
	return db, nil
}
```

Matching idle to open keeps warm connections around between bursts, so a request never pays for a TLS handshake and a backend fork. The lifetime limit recycles connections slowly, which lets a failover or a load balancer change take effect without a restart. The idle limit hands connections back to Postgres when traffic drops at night.

## Sizing the pool with arithmetic, not hope

The number of connections a service needs is its query rate multiplied by how long each query holds a connection. That is Little's law, and it is the most useful sentence in capacity planning.

A service doing 1,500 queries a second at 4 ms each keeps six connections busy on average. Give it room for bursts and for the occasional slow query, and twenty is generous. Two hundred would not make it faster; it would only let a pile-up reach the database instead of waiting in the service, where you can see it.

Then do the sum across the fleet:

1. Count every replica of every service that connects, at its maximum scale.
2. Multiply each by its pool's maximum open connections.
3. Add the jobs, the migration tool and a handful for humans.
4. Keep the total comfortably under `max_connections`, with superuser slots spare.

If the total does not fit, the answer is a smaller pool per replica or a pooler in front of Postgres. It is almost never a bigger database.

> [!TIP]
> Hold a connection for the shortest stretch you can. Do the HTTP call to the payment provider before you begin the transaction, not inside it.

## pgxpool, when you can use pgx directly

If the service uses pgx directly rather than through `database/sql`, `pgxpool` gives the same controls with clearer names. Its default maximum is the larger of four and the number of CPUs, which is sensible for one process and wrong for forty.

```go {% title="internal/db/pool.go" %}
func NewPool(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 20
	cfg.MinConns = 2
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	return pgxpool.NewWithConfig(ctx, cfg)
}
```

The same settings can live in the connection string, as `pool_max_conns=20`, which is handy when the platform hands you a URL and nothing else.

## Read the pool's numbers

A pool that is too small does not error. It makes requests wait, and the wait shows up as latency with no slow query to blame. Both pools count that wait, so export it.

```go {% title="internal/db/stats.go" %}
func logPoolStats(ctx context.Context, pool *pgxpool.Pool) {
	s := pool.Stat()
	slog.InfoContext(ctx, "db pool",
		"total", s.TotalConns(),
		"acquired", s.AcquiredConns(),
		"idle", s.IdleConns(),
		"empty_acquires", s.EmptyAcquireCount(),
		"acquire_wait", s.AcquireDuration(),
	)
}
```

`EmptyAcquireCount` is the one I watch: it counts the times a caller asked for a connection and had to wait because none was idle. For `database/sql`, `db.Stats()` reports the same thing as `WaitCount` and `WaitDuration`. A steady climb in either means the pool is the bottleneck; a flat line with high latency means the queries are.

### Give every acquire a deadline

Waiting for a connection respects the context you pass. A request with a two-second deadline should not wait four seconds for a connection and then run a query nobody is waiting for. Pass the request's context all the way down, and the pool gives up when the caller does.

## When PgBouncer earns its place

A pooler multiplexes many client connections onto a few server connections. In transaction mode, PgBouncer hands a server connection to a client for one transaction and takes it back at `COMMIT`, so five hundred idle clients can share twenty backends.

```ini {% title="pgbouncer.ini" %}
[databases]
app = host=127.0.0.1 port=5432 dbname=app

[pgbouncer]
pool_mode = transaction
default_pool_size = 20
max_client_conn = 1000
max_prepared_statements = 200
```

The price is session state. Anything that lives on a connection between transactions, such as `SET` without `LOCAL`, advisory locks taken outside a transaction or `LISTEN`, will land on a different backend next time.

> [!WARNING]
> pgx prepares and caches statements by default. Against PgBouncer older than 1.21, or with `max_prepared_statements` at zero, that fails with errors about prepared statements that do not exist. Upgrade PgBouncer, or set `default_query_exec_mode=exec` in the connection string.

I reach for PgBouncer when the fleet sum stops fitting: many replicas, serverless functions, or a team that cannot agree on pool sizes. For one service on one box, a well-sized pool in the process is simpler and has one less thing to restart.

## The checklist I leave behind

When I hand a service back, these are true:

- Every pool sets maximum open, maximum idle, lifetime and idle time.
- The fleet's maximum connections add up to less than the server allows.
- Pool wait counts are exported next to request latency.
- Every query takes the request's context.
- Transactions never wrap network calls to other services.

None of it is clever. It is the difference between a database that degrades slowly under load and one that falls over at the exact moment you need it.
