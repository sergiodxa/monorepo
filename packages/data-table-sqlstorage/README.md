# @pkg/data-table-sqlstorage

A `remix/data-table` `DatabaseAdapter` backed by a Cloudflare Durable Object
`SqlStorage`. Lets `remix/data-table` models run against a Durable Object's
embedded SQLite.

```ts
import { createDatabase } from "remix/data-table";
import { createSQLStorageDatabaseAdapter } from "@pkg/data-table-sqlstorage";

// inside a DurableObject
let db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));
```

Extracted from `apps/auth-saas` so both the multi-tenant platform (tenant Durable
Object) and any other Durable-Object host can share one adapter. See
[ADR-011](../../docs/adr/ADR-011-oidc-provider-engine-package.md).
