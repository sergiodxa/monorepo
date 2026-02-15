# @pkg/types

Shared TypeScript utility types for the monorepo.

## Usage

```typescript
import type { ResolvedType } from "@pkg/types";

async function fetchData(): Promise<{ id: string }> { ... }

type Data = ResolvedType<typeof fetchData>; // { id: string }
```
