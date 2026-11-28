---
title: Structured logs with log/slog
description: Replace Printf logging with key-value records, attach request fields once with a handler, and get JSON a log search can actually filter.
kind: tutorials
date: "2026-01-28"
tags: [go, observability]
---

Since Go 1.21, the standard library ships `log/slog`, and there is little reason left to pull in a logging dependency for a small service.

## Step 1: Pick a handler at startup

Text for a terminal, JSON for production:

```go {% title="cmd/api/main.go" %}
var handler slog.Handler = slog.NewTextHandler(os.Stderr, nil)
if os.Getenv("LOG_FORMAT") == "json" {
	handler = slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo})
}
slog.SetDefault(slog.New(handler))
```

## Step 2: Log fields, not sentences

```go {% title="orders.go" %}
slog.InfoContext(ctx, "order placed", "order_id", order.ID, "total_cents", order.Total)
```

A search for `order_id=4812` now finds every line about that order, which a formatted sentence never allowed.

## Step 3: Attach request fields once

Create a child logger in middleware and keep it in the context, so every line in a request carries its id:

```go {% title="middleware.go" %}
func withLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		logger := slog.With("request_id", r.Header.Get("X-Request-Id"), "path", r.URL.Path)
		ctx := context.WithValue(r.Context(), loggerKey{}, logger)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
```

> [!TIP]
> Use the `slog.Int`, `slog.String` and `slog.Duration` constructors in hot paths. They skip the reflection the alternating key-value form needs.
