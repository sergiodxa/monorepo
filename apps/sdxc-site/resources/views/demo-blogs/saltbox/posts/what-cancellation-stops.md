---
title: What context cancellation actually stops
description: Cancelling a context.Context does not stop anything by itself. It closes a channel, and only the code that watches that channel stops. A tour of what listens and what keeps running.
kind: articles
date: "2026-04-15"
tags: [go, concurrency]
---

The most common misunderstanding I see in Go code review is the belief that cancelling a context stops work. It does not. Calling `cancel()` closes the channel `ctx.Done()` returns and records an error, and that is all. Work stops only where someone is looking.

## Who is looking

The standard library looks in the places that block. An HTTP request made with `http.NewRequestWithContext` is abandoned, a `database/sql` query is cancelled on the server where the driver supports it, and `net.Dialer.DialContext` gives up dialling. Each of those checks the context because each can wait for a long time.

Your own loops are not looking unless you make them:

```go {% title="worker.go" %}
for _, item := range batch {
	if err := ctx.Err(); err != nil {
		return err
	}
	process(item)
}
```

Without that check, a batch of ten thousand items keeps going long after the request that started it has gone.

## Goroutines do not inherit an exit

Starting a goroutine with a context does not tie its life to that context. If the goroutine blocks on a channel send that nobody will ever receive, it stays blocked forever, a [goroutine leak](/showcase/saltbox/demo/glossary/goroutine-leak). Every blocking operation inside it needs a `select` with `ctx.Done()` as one of the cases.

## Cancel what you create

`context.WithTimeout` starts a timer, and `go vet` complains when you drop the cancel function for a reason: until it is called or the timer fires, the context holds resources. `defer cancel()` on the next line is the habit worth keeping, even when the parent will be cancelled anyway.

Cancellation is cooperative. Treat it as a request your code has promised to honour, and check for it wherever your code can wait.
