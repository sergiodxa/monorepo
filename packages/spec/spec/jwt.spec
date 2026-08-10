use fs
use cli

# jwt.verify reaches the network to read the JWKS, so it is gated by the net
# family exactly like the http verbs. This meta-test proves that denial without
# standing up a JWKS server: it writes an inner one-file suite that calls
# jwt.verify, runs the real `spec` CLI against it as a child with no --allow-net,
# and asserts the child stopped at the permission gate before any fetch. The
# permissionless half of the capability (jwt.decode) is covered by the passing
# cases in jwt-decode.spec.

test "jwt.verify without a net grant is denied and names the tool" {
	given {
		write "spec/jwt-verify-denied.spec" """
			use jwt

			test "verifying a token needs the net grant" {
				when {
					let claims = jwt.verify "a.b.c" "http://localhost:3002/.well-known/jwks.json"
				}
			}
		"""
	}
	when {
		# No --allow-net: the net family is denied outright, so the runtime's
		# central gate refuses jwt.verify before the plugin fetches the JWKS.
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Permission denied: net"
		output_contains result.stdout "jwt.verify"
		output_contains result.stdout "--allow-net"
	}
}
