---
title: Connection pool
description: A set of open database connections a process keeps and lends out, so each query skips the cost of connecting and the server sees a bounded number of clients.
kind: glossary
date: "2026-11-02"
tags: [postgres, go]
---

In Go, `*sql.DB` and `pgxpool.Pool` are both pools: a query borrows a connection, uses it and returns it. The pool's maximum is a promise to the database about how many clients this process will ever be.

A pool that is too small makes requests wait; one that is too large lets a burst reach Postgres all at once. [Connection pooling from the Go side](/showcase/saltbox/demo/articles/pooling-from-the-go-side) covers how to size one.
