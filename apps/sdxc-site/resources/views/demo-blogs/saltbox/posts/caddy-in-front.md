---
title: "Self-hosting a Go service: Caddy in front, TLS included"
description: Part two. Put Caddy between the internet and the binary, get certificates without thinking about them, and keep the Go service on localhost.
kind: tutorials
date: "2026-08-19"
tags: [self-hosting, linux, go]
series: Self-hosting a Go service
part: 2
---

In [part one](/showcase/saltbox/demo/tutorials/static-binary-and-systemd) the service ran under systemd on port 8080. Now we make it reachable over HTTPS, without the Go code knowing anything about certificates.

## Step 1: Bind the service to localhost

Only Caddy should talk to the binary. Listen on the loopback address so nothing outside the machine can reach it directly:

```go {% title="cmd/notes/main.go" %}
srv := &http.Server{
	Addr:              "127.0.0.1:8080",
	Handler:           mux,
	ReadHeaderTimeout: 5 * time.Second,
}
log.Fatal(srv.ListenAndServe())
```

## Step 2: Point a domain at the server

Create an `A` record (and `AAAA` for IPv6) for `notes.example.com` pointing at the server's address. Caddy needs it to resolve before it can prove you own the name.

## Step 3: Write the Caddyfile

```text {% title="/etc/caddy/Caddyfile" %}
notes.example.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080
}
```

That is the whole file. On reload, Caddy obtains a certificate, renews it before it expires, and redirects plain HTTP to HTTPS.

> [!NOTE]
> Ports 80 and 443 must be open to the internet for the certificate challenge. A firewall that only allows 443 breaks the HTTP challenge, though Caddy can fall back to the TLS-ALPN one.

## Step 4: Reload and check

```sh {% title="Terminal" %}
sudo systemctl reload caddy
curl -I https://notes.example.com
```

A `200` with an `alt-svc` header means you are done. [Part three](/showcase/saltbox/demo/tutorials/nightly-postgres-backups) makes sure the data survives the server.
