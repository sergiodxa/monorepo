# @pkg/data-table-d1

A `remix/data-table` `DatabaseAdapter` backed by Cloudflare D1. Lets
`remix/data-table` models run against a D1 database.

```ts
import { createDatabase } from "remix/data-table";
import { createD1DatabaseAdapter } from "@pkg/data-table-d1";

let db = createDatabase(createD1DatabaseAdapter(env.DB));
```

Extracted from `apps/auth-saas` so self-hosted workers and other D1-backed apps
can share one adapter. See
[ADR-011](../../docs/adr/ADR-011-oidc-provider-engine-package.md).
