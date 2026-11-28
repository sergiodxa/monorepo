---
title: errgroup.WithContext cancels the siblings
description: The first error from a group cancels the context every other goroutine shares.
kind: notes
date: "2026-05-27"
tags: [go, concurrency]
---

Fetching three upstreams in parallel with `errgroup.WithContext` from `golang.org/x/sync`: when the first one fails, the group cancels the derived context, so the other two requests are abandoned instead of finishing for nothing. `g.Wait()` returns that first error. The catch is that only work which watches the context stops, which is the whole point of [what cancellation actually stops](/showcase/saltbox/demo/articles/what-cancellation-stops). Use `g.SetLimit(n)` when the fan-out comes from user input.
