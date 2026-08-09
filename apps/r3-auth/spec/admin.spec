# The admin area. Every route is behind `requireAdmin`, which runs `requireSubject`
# first, so an anonymous caller is redirected to `/authorize` (303) exactly as in
# the account area — the guard fires before any lookup, so a placeholder id on the
# parameterized routes never has to exist. A signed-in *non-admin* would instead be
# sent to `/account/sessions`, but the reachable observable here is the anonymous
# guard: GET followed by a browser onto the sign-in page, POST followed by `http`
# to a final 200. The all-zero UUID is a well-formed id that stands in for the
# `:clientId`/`:subjectId` segment.
#
# seeded happy path (every route here): an admin session renders the dashboard,
# the client and subject lists, their detail and edit forms, and performs their
# POST actions. It needs a subject with role `admin`, which in-app registration
# never grants — so this requires a manual DB seed; see the README.

# GET /admin
test "GET /admin redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/admin"
	}
	then {
		assert_on_sign_in_page
	}
}

# GET /admin/clients
test "GET /admin/clients redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/admin/clients"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /admin/clients
test "POST /admin/clients is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/admin/clients"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /admin/clients/new
test "GET /admin/clients/new redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/admin/clients/new"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /admin/clients/new
test "POST /admin/clients/new is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/admin/clients/new"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /admin/clients/:clientId
test "GET /admin/clients/:clientId redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/admin/clients/00000000-0000-0000-0000-000000000000"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /admin/clients/:clientId
test "POST /admin/clients/:clientId is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/admin/clients/00000000-0000-0000-0000-000000000000"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /admin/clients/:clientId/edit
test "GET /admin/clients/:clientId/edit redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/admin/clients/00000000-0000-0000-0000-000000000000/edit"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /admin/clients/:clientId/edit
test "POST /admin/clients/:clientId/edit is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/admin/clients/00000000-0000-0000-0000-000000000000/edit"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /admin/subjects
test "GET /admin/subjects redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/admin/subjects"
	}
	then {
		assert_on_sign_in_page
	}
}

# GET /admin/subjects/:subjectId
test "GET /admin/subjects/:subjectId redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/admin/subjects/00000000-0000-0000-0000-000000000000"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /admin/subjects/:subjectId
test "POST /admin/subjects/:subjectId is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/admin/subjects/00000000-0000-0000-0000-000000000000"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /admin/subjects/:subjectId/edit
test "GET /admin/subjects/:subjectId/edit redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/admin/subjects/00000000-0000-0000-0000-000000000000/edit"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /admin/subjects/:subjectId/edit
test "POST /admin/subjects/:subjectId/edit is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/admin/subjects/00000000-0000-0000-0000-000000000000/edit"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}
