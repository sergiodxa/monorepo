---
title: Flow Monitors
description: Check a sequence of requests instead of one. Sign in, carry the token, call the endpoint it authorises — and assert on what comes back at every step.
section:
  title: Concepts
  order: 2
order: 5
lastUpdated: 2026-08-31
---

A flow monitor runs a **multi-step API check**. An HTTP monitor asks one question — did this URL answer the way it should? A flow monitor asks whether a sequence still works: that signing in returns a token, that the token is accepted by the endpoint it authorises, and that the endpoint answers with the data it is supposed to.

The whole configuration is a block of source you write. There is no URL field, no host field and no region selector — **every address the flow requests is written in the source itself**, which is what makes it possible to check where a flow is allowed to go before it goes there.

The source is written in an executable-spec language: `test` blocks that arrange, act and assert. The monitor is **up** when every test in the source passes, and **down** when any test fails. The first failure is the detail you get.

## What a Flow Can and Cannot Do

These limits are stated first because a flow monitor is only as useful as your understanding of what it covers. None of them are oversights — they are the shape of the feature.

- **There is no browser.** Nothing clicks, fills in a form field, runs JavaScript or renders a page. A flow drives HTTP requests. A check that depends on what a page looks like is not something a flow can answer.
- **A flow can bring new data on every run.** [`sample`](#sample) gives it a fresh name, address or identifier per check, which is what a sign-up flow needs. A flow that signs _in_ still needs a fixed account you keep for the purpose, since the credential has to exist before the run.
- **There is no branching and no computation.** No conditionals, no loops, no arithmetic, no string building. A flow is a straight line of requests and assertions.
- **Assertions are equality and truthiness only.** There is no substring match, no regular expression, no comparison and no numeric range.
- **The only retry vocabulary is `eventually`, and it cannot retry a request.** See [Waiting for something to become true](#waiting-for-something-to-become-true).
- **There is no file access, no shell and no database access.** The four tools below are the whole vocabulary.
- **The fastest interval is 15 minutes.** A flow makes several requests and costs accordingly. If you need to know within a minute that something broke, put an HTTP monitor on the endpoint the flow depends on — that is what 1-minute resolution is for — and let the flow cover the sequence.

## Verified Domains

**A flow may only reach hosts covered by your team's verified domains.** This is checked before the flow runs, on every run, and it is the rule to understand first.

The reason is worth stating plainly. An HTTP monitor sends a single request that any stranger could have sent anyway. A flow drives a sequence — it signs in, it carries a token, it calls the endpoint that token authorises. Without a gate on where it can point, the feature would be a way to automate somebody else's site.

### Verifying a domain

Verification is a DNS TXT record. For the hostname you are verifying, publish:

```
_ping-verification.example.com.  TXT  "ping_<your team domain id>"
```

The record is re-checked every 10 minutes. See [Domains](/docs/team/domains).

### What a verified domain covers

Ownership extends **one label boundary deep**. Verifying `example.com` covers:

- `example.com` itself
- `app.example.com`, `api.example.com`
- `api.staging.example.com`

It does not cover `notexample.com`, and it does not cover `example.com.evil.test`. A name that merely ends in your domain's text is not your domain.

The grant is resolved against **the exact hosts your source names**. A flow written to request `app.example.com` is granted `app.example.com` — not everything your team has verified. If the same flow later reaches `internal.example.com`, it is refused, even though the team owns that name too.

The allowance is resolved fresh on every run and is never stored on the monitor. Un-verifying a domain stops its flows at the very next check, with no cache to wait out.

### When a flow is refused

Two refusals happen before any request is sent:

> This flow reaches {hosts}, which no verified domain on this team covers. A flow monitor can only drive a domain the team has verified.

> This flow names no host to reach. Every URL it requests has to be written in the spec, so it can be checked against the team's verified domains.

Both record a result with status **Error**, not Down — nothing was found out about your service, so nothing about your service is being reported.

**A team with no verified domains cannot create a flow monitor at all.** Verify a domain first.

## Writing a Flow

### Tests and phases

A source holds one or more `test` blocks. Each test has up to three phases, in this order:

| Phase   | Purpose                              |
| ------- | ------------------------------------ |
| `given` | Arrange — set up what the test needs |
| `when`  | Act — make the requests              |
| `then`  | Assert — check what came back        |

Every phase is optional, but the **order is enforced**. A `given` after a `when`, or a second `when` after a `then`, is a parse error rather than a quietly reordered run.

```
test "the health endpoint answers" {
	when {
		let response = http.get "https://api.example.com/health"
	}
	then {
		expect response.status 200
		expect response.json.ok true
	}
}
```

Lines beginning with `#` are comments.

### Statements

Inside a phase you can write:

- `let name = …` — run something and bind its result under a name
- `expect …` — assert
- `eventually { … }` — retry an assertion until it holds
- a bare tool or command call — run it for its effect, binding nothing
- `return …` — inside a `command` or `fixture` body, to give back its value

### Reusable steps and data

`command` defines a reusable step, `fixture` reusable data. Both are named once and usable from any test in the source.

```
fixture monitor_account {
	return { email: "uptime-monitor@example.com", password: "the monitor account's password" }
}
```

A fixture's value is read with `let creds = fixture monitor_account`. A command is called by name with its arguments, and what a test asserts about it is its effect, not a returned value.

### Chaining steps

There is no string interpolation and there are no operators. A step uses an earlier step's result by **reaching into the bound value by path**:

```
let session = http.post "https://app.example.com/api/sessions" form {
	email: "uptime-monitor@example.com"
	password: "the monitor account's password"
}
let account = http.get "https://api.example.com/v1/account" bearer session.json.token
```

One rule catches everyone once: **a bare word in tool-argument position is a symbol, not a variable.** `bearer token` passes the word `token`; `bearer session.json.token` passes the value. If you are holding a value under a plain name and need to pass it, box it into an object and read it back through a dotted reference:

```
let at = { url: landing }
let code = url.query at.url "code"
```

## Tools

Four namespaces are available. There is nothing else.

### http

`http.get`, `http.post`, `http.put`, `http.patch` and `http.delete`. The URL is a quoted absolute `http` or `https` address.

Options are word-tagged, order-independent, and combinable:

| Option                | Effect                                              |
| --------------------- | --------------------------------------------------- |
| `headers { … }`       | Request headers                                     |
| `form { … }`          | Body encoded as `application/x-www-form-urlencoded` |
| `json <value>`        | Body encoded as `application/json`                  |
| `text "<string>"`     | Body sent as a plain string                         |
| `bearer <token>`      | `Authorization: Bearer …`                           |
| `basic <user> <pass>` | HTTP Basic credentials                              |

At most one body, one `headers` block and one auth option per request. A body on a `GET` is an error.

A response is a value with `status`, `ok`, `headers`, `text` and `json`, read by path:

```
expect response.status 201
expect response.ok true
expect response.json.id
expect response.headers.location "/v1/orders/1"
```

**An HTTP error status is a normal value, not a failure.** A 500 does not abort the flow; it lands in `response.status` where you can assert on it, which is what lets a flow check that a protected endpoint refuses an unauthenticated caller. Only a network-level failure — the connection never completing — is an error.

Redirects are followed, one hop at a time, and **each target is re-checked against your verified domains before the request is sent**. A redirect off your domain is refused rather than followed.

### url

`url.query <url> <name>`, `url.fragment <url> <name>`, `url.path <url>` and `url.host <url>`. Pure parsing, no network. These exist for the shape that comes up constantly in authentication: pulling the `code` or the `state` out of a redirect address.

```
let code = url.query granted.json.redirect_to "code"
let landed = url.host granted.json.redirect_to
```

### jwt

`jwt.decode <token>` returns `{ header, payload }` and checks **no signature**. Use it to look at a token you already trust.

`jwt.verify <token> <jwks_url>` fetches the issuer's JWKS, selects the key by `kid`, verifies an ES256 signature and the token's expiry, and returns the verified payload. Claims read out of it are issuer-attested rather than merely well-formed.

`jwt.verify` reaches the network, so **the JWKS host has to be covered by a verified domain too**.

### sample

Input a flow generates for itself, for the steps that have to send something new every time — a person, a place, an identifier, a file name, a date. Generating is free: only the requests your flow makes count against its limit.

Each kind of data is one tool that returns a record. Bind it once, then read the fields you need:

```
let who = sample.person
let where = sample.location
```

| Tool              | Fields on the record                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sample.person`   | `first_name`, `last_name`, `full_name`, `prefix`, `suffix`, `sex`, `gender`, `zodiac_sign`, `job_title`, `bio`, `email`, `username`, `phone`                            |
| `sample.internet` | `email`, `username`, `url`, `domain_name`, `password`, `ip`, `ipv4`, `ipv6`, `mac`, `port`, `protocol`, `http_method`, `http_status_code`, `jwt`, `user_agent`, `emoji` |
| `sample.location` | `country`, `city`, `country_code`, `state`, `county`, `street`, `street_address`, `zip_code`, `postal_address`, `latitude`, `longitude`, `time_zone`                    |
| `sample.company`  | `name`, `catch_phrase`, `buzz_phrase`, and the words they are built from                                                                                                |
| `sample.lorem`    | `word`, `words`, `sentence`, `paragraph`, `lines`, `slug`, `text`                                                                                                       |
| `sample.date`     | `past`, `future`, `recent`, `soon`, `anytime`, `birthdate`, `month`, `weekday`, `time_zone` — dates as ISO timestamps                                                   |
| `sample.string`   | `uuid`, `ulid`, `nanoid`, `alpha`, `alphanumeric`, `numeric`, `hexadecimal`, `binary`, `octal`, `symbol`                                                                |
| `sample.number`   | `int`, `float`, `hex`, `binary`, `octal`, `roman_numeral`, `big_int`                                                                                                    |
| `sample.color`    | `human`, `hex`, `rgb`, `hsl`, `space`, `css_function`                                                                                                                   |
| `sample.datatype` | `boolean`                                                                                                                                                               |
| `sample.git`      | `branch`, `commit_sha`, `short_sha`, `commit_message`, `commit_date`, `commit_entry`                                                                                    |
| `sample.hacker`   | `abbreviation`, `adjective`, `noun`, `verb`, `ingverb`, `phrase`                                                                                                        |
| `sample.phone`    | `number`, `national`, `international`, `imei`                                                                                                                           |
| `sample.system`   | `file_name`, `file_ext`, `file_type`, `mime_type`, `directory_path`, `file_path`, `network_interface`, `semver`, `cron`                                                 |

A record's fields agree with each other: a person's address matches their name, and a location's postal address names its own city and country.

Five more tools take an argument, or stand alone:

| Tool                          | Returns                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `sample.int <min> <max>`      | A whole number between the two, both included                                |
| `sample.float <min> <max>`    | A number between the two, to two decimals                                    |
| `sample.words <count>`        | That many words of filler text                                               |
| `sample.pick <list>`          | One item of a list a step returned, such as `sample.pick catalog.json.plans` |
| `sample.email`, `sample.uuid` | An address, and a UUID                                                       |

```
use http
use sample

test "a visitor can sign up" {
	given {
		let person = sample.person
	}
	when {
		let created = http.post "https://app.example.com/signup" form {
			email: person.email
			name: person.full_name
		}
	}
	then {
		expect created.status 201
	}
}
```

**The values change on every run**, which is what makes a sign-up flow possible: the same address posted every five minutes would pass once and fail on every check after it.

Two things follow for how you write the flow.

**Assert on what the step proved, not on the value you generated.** `expect created.status 201` holds for any address. `expect created.json.email "ana.moreau35@example.com"` pins a value your monitor invented for one run, and fails on the next.

**Remember the flow really runs.** A sign-up flow creates a real account on every check, at whatever interval you set. Point it at something that tolerates that — a staging environment, a tenant you prune, or a sign-up that expires unconfirmed registrations by itself.

Generated addresses are always on `example.com`, `example.org` or `example.net`, the domains reserved for documentation. Treat them as write-only: a sign-up whose last step is a confirmation link wants an endpoint that can confirm the account directly.

A generated value is a step, like a request: it belongs in `given` or `when`.

## Assertions

`expect` has three forms.

**Two values** — deep structural equality:

```
expect response.status 201
expect claims.aud "uptime-flow"
```

**One value** — it must be true (a present, truthy value):

```
expect response.ok
expect session.json.token
```

**An observable call** — a read-only tool as the head. The tool is called with the remaining arguments and its result has to hold:

```
expect url.host "https://app.example.com/callback"
```

The `url` tools and `jwt.decode` are read-only and can be used this way. `http.get` and its siblings, and `jwt.verify`, are actions and cannot. In practice you will bind a read-only result with `let` and use the two-value form, which says more:

```
let landed = url.host granted.json.redirect_to
expect landed "app.example.com"
```

Equality is structural, so objects and arrays compare by their contents. There is no `contains`, no regex, no `greater than` and no range. When you need to assert on part of a response, reach into the part: `expect response.json.user.plan "pro"`.

## Waiting for Something to Become True

Some things are true a moment after the request that caused them. `eventually` retries an assertion until it holds:

```
then {
	eventually within 2s {
		expect status.json.state "ready"
	}
}
```

The default window is **5 seconds**, polled every **100 milliseconds**. `eventually` is valid only inside `then`, and only assertions and observable calls may appear inside it.

**An HTTP request cannot be retried by `eventually`.** `http.get` and its siblings are actions, not observations, and putting an action inside `eventually` is an error. There is no polling-until-the-endpoint-answers in a flow: the request happens once, in `when`, and `eventually` can only retry an assertion over a result that is already in hand. If your flow needs an asynchronous process to finish before the next step, a flow monitor is not the tool for it.

## Examples

### Signing in and calling a protected endpoint

The flow every team writes first: prove that credentials still mint a token, and that the token is still accepted by the endpoint it authorises.

```
# The account this flow drives. Created for monitoring, read-only, and shared by
# every test in this source.
fixture monitor_account {
	return { email: "uptime-monitor@example.com", password: "the monitor account's password" }
}

test "signing in returns a token the account endpoint accepts" {
	given {
		let creds = fixture monitor_account
	}
	when {
		let session = http.post "https://app.example.com/api/sessions" form {
			email: creds.email
			password: creds.password
		}
		# The token is passed by dotted reference; `bearer token` would send the
		# word `token`, not the value.
		let account = http.get "https://api.example.com/v1/account" bearer session.json.token
		# The same endpoint without the token, to prove the door is actually locked.
		let refused = http.get "https://api.example.com/v1/account"
	}
	then {
		expect session.status 201
		expect session.json.token
		expect account.status 200
		expect account.ok
		# Not merely a 200: the token resolved to the right subject.
		expect account.json.email "uptime-monitor@example.com"
		expect account.json.plan "pro"
		# A 401 is a value, not an error, so it can be asserted on directly.
		expect refused.status 401
	}
}
```

Both hosts, `app.example.com` and `api.example.com`, are covered by a verified `example.com`.

### Signing up as a new visitor every run

The journey a fixed account cannot cover: registration itself. `sample.person` gives each run its own visitor, so the flow is not fighting the account the last run created.

```
test "a visitor can register and land signed in" {
	given {
		# One person, consistent across every field: the address matches the name,
		# and both are new on every run.
		let visitor = sample.person
	}
	when {
		let created = http.post "https://app.example.com/api/registrations" form {
			email: visitor.email
			name: visitor.full_name
			password: "a fixed password is fine; the address is what has to be new"
		}
		# The session the registration handed back is what proves the journey
		# finished, rather than a row having been written somewhere.
		let profile = http.get "https://app.example.com/api/me" bearer created.json.token
	}
	then {
		expect created.status 201
		expect created.json.token
		expect profile.status 200
		# Assert on what the step proved — that the profile belongs to whoever just
		# registered — never on the generated address itself, which changes each run.
		expect profile.json.name visitor.full_name
	}
}
```

Note what is asserted and what is not. `expect profile.json.name visitor.full_name` compares the response against the value the flow sent, which holds on every run. Writing `expect profile.json.email "ana.moreau35@example.com"` would pin a value the monitor invented for one run, and fail on the next.

This flow leaves an account behind on every check. At the 15-minute floor that is 96 accounts a day, so point it at a staging environment, a tenant you prune, or a registration that expires unconfirmed sign-ups on its own.

### An OAuth exchange, with the token verified against the JWKS

Reading a `code` out of a redirect address and spending it, then checking that the `id_token` it bought was really signed by your issuer. This test sits in the same source as the one above, so the `monitor_account` fixture is already in scope — definitions are shared across every test in the flow.

```
fixture oauth_client {
	return { id: "uptime-flow", secret: "the monitoring client's secret" }
}

test "an authorization code exchanges for an id_token this issuer signed" {
	given {
		let client = fixture oauth_client
		let creds = fixture monitor_account
	}
	when {
		let session = http.post "https://app.example.com/api/sessions" form {
			email: creds.email
			password: creds.password
		}
		# Authorizing as that signed-in user. The endpoint answers with the redirect
		# target in its body, so the code can be read out of it.
		let granted = http.post "https://app.example.com/oauth/authorize" json {
			client_id: client.id
			redirect_uri: "https://app.example.com/callback"
			response_type: "code"
			scope: "openid email"
			state: "flow-check"
		} bearer session.json.token
		let code = url.query granted.json.redirect_to "code"
		let state = url.query granted.json.redirect_to "state"
		let landing = url.host granted.json.redirect_to
		let tokens = http.post "https://api.example.com/oauth/token" form {
			grant_type: "authorization_code"
			code: code
			redirect_uri: "https://app.example.com/callback"
		} basic client.id client.secret
		# Verified against the live JWKS: the payload comes back only if the token
		# is genuinely signed by this issuer's key and has not expired.
		let claims = jwt.verify tokens.json.id_token "https://api.example.com/.well-known/jwks.json"
	}
	then {
		expect session.status 201
		expect granted.status 200
		# The state that went out came back: the round trip is this request's.
		expect state "flow-check"
		expect landing "app.example.com"
		expect tokens.status 200
		expect tokens.json.token_type "Bearer"
		expect tokens.json.access_token
		# Read out of the JWKS-verified payload, so these are issuer-attested.
		expect claims.iss "https://api.example.com"
		expect claims.aud "uptime-flow"
		expect claims.email "uptime-monitor@example.com"
	}
}
```

`jwt.verify` fetches the JWKS over the network, so `api.example.com` has to be covered by a verified domain for that step as well as for the token request.

## Configuration Options

### Source

The flow itself, up to **20,000 characters**. Every test in the source runs on every check, and every test has to pass for the monitor to be up.

### Check Interval

Seven fixed values: **15 minutes, 30 minutes, 1 hour, 3 hours, 6 hours, 12 hours and 1 day.** The default is **1 hour**. Nothing else is accepted.

It is a fixed list rather than a number you type because each step down roughly doubles what a run costs. The interval is a spending decision as much as a detection one, so it is presented as a short list of choices rather than a box that will accept `30` and quietly mean thirty seconds.

There are **no regions** — a flow runs once, from one place. There are also **no monitor-level retries**: a failed run is down immediately, with no confirmation re-check and no flap suppression. A flow asserts on a sequence you control, so a failure is usually a real one.

## Limits on a Run

Three caps apply to each run:

| Cap           | Limit                                       |
| ------------- | ------------------------------------------- |
| Wall clock    | 30 seconds                                  |
| HTTP requests | 20, counted across every test in the source |
| Source length | 20,000 characters                           |

Only HTTP requests count against the request cap. `url`, `jwt.decode` and `sample` calls are free — they reach nothing. (`jwt.verify` fetches the issuer's JWKS, so it does make a request.)

Both runtime caps are checked before each request the flow makes, so a run that has spent its budget stops at the next request it tries to send, and reports why:

> This flow ran out of time: a run may take at most 30000ms.

> This flow made too many requests: a run may make at most 20.

Both produce **Error**, not Down. A flow that outgrew its budget is a monitor problem, not an outage, and it should not page anyone as though your service were down.

## Monitor Statuses

| Status    | Meaning                                                                                                                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Up**    | Every test passed.                                                                                                                                    |
| **Down**  | A test failed — an assertion did not hold. Your service answered, and it answered wrongly.                                                            |
| **Error** | The flow could not run: the source will not parse, a host is not covered by a verified domain, the run ran out of time, or it made too many requests. |

**Error is deliberately not an outage.** It is the app failing to find out, which is a different fact from your service being down. Keeping the two apart is what stops a mistyped source from paging your on-call, and it is why the pass rate on the monitor's page is computed over passing and failing runs only, excluding errors. A run that never happened is not evidence either way.

## Results

Each run records one row: its status, how many tests ran, passed and failed, how many HTTP requests it made, the name of the failing test, that test's line number in your source, the failure detail, the run's duration, and any error message.

Results are kept for **90 days** — longer than the 7 days HTTP monitor results are kept. A flow runs at most four times an hour and each run says something specific, so the history stays small enough to be worth keeping and useful enough to read months later.

**No per-step timings and no screenshots are stored.** During an incident the readable thing is which assertion broke and where, not a waterfall.

The monitor's page shows:

- Pass rate, average duration and total runs
- A **Last failure** block naming the failing test and its line, with the failure detail formatted
- Your source rendered as a numbered listing, with the failing line marked
- A table of recent runs: Time, Status, Tests, Requests, Duration

**Run now** runs the flow inline and reports the outcome straight back, which is how you check a source you just edited without waiting out the interval.

## Alerting

A flow alerts when it goes **down**, and again when it **recovers**. It uses the same alerts, the same maintenance windows and the same cooldowns as every other monitor type, so an alert scoped to your whole team already covers your flows. See [Alerts](/docs/concepts/alerts).

**Error never alerts.** A flow that cannot run has not detected anything.

## Billing

A flow run is metered as **one ping per HTTP request it made**, drawn from the same monthly ping allowance as every other check — because that is what a flow is: several pings with assertions between them. A five-request flow on an hourly interval spends 3,360 pings a month.

A run refused before it starts — an unverified host, a source that will not parse — makes no requests and costs nothing, while still recording a visible result so you can see it happened.

## A Note on Credentials

**A password in a flow is stored as part of the source text.** There is no separate secret store today, so a login flow's credentials are written in the source and visible to anyone on your team who can read the monitor.

Use a dedicated account created for monitoring, with the least privilege that still exercises the flow. Never point a flow at a real user's credentials, and never at an account that can change anything you would mind being changed.

## Best Practices

### Assert on the thing the step proved

`expect response.status 200` says the request completed. `expect account.json.email "uptime-monitor@example.com"` says the token was accepted and resolved to the right subject. The second assertion is why you wrote a flow instead of an HTTP monitor.

### Keep the flow short

Twenty requests is the cap, but a flow you can read in one screen is the one you will actually fix at 3am. Cover one journey per monitor — sign-in in one, checkout in another — so a failure names itself.

### Sign in as a fixed account, sign up as a generated one

A flow that signs _in_ needs an account that exists before the run and still exists after it — the credential has to be written in the source, so it cannot be invented. Prefer those flows to read rather than write; where one must write, have it write something it can overwrite next time.

A flow that signs _up_ is the opposite: give it `sample.person` and let every run bring its own address. What needs thinking about there is not the data but the accounts it leaves behind — see [sample](#sample).

### Let HTTP monitors do the fast detection

A flow at 15 minutes is not your outage detector. Put HTTP monitors on the endpoints the flow depends on for minute-resolution detection, and let the flow tell you the thing they cannot: that the sequence still holds together.

### Verify the domain before you write the flow

The source has to name the hosts it reaches, and those hosts have to be covered when the monitor is created. Verifying first — including any separate API or JWKS host the flow touches — turns a refusal into a non-event.

### Treat Error as your problem

Down means your service broke. Error means the flow did. An error streak is a source to fix, a domain to re-verify, or a budget to raise — and nothing about it is a reason to distrust the up and down results either side of it.
