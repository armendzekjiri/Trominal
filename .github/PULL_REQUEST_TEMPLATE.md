## Summary

<!-- 1-3 sentences describing what changed -->

## Phase

<!-- Which phase from PROJECT_BRIEF.md §9 does this belong to? -->

## Linked issue

Closes #

## Test plan

<!-- How can a reviewer verify this works locally? -->

## Screenshots / GIFs

<!-- If UI changed, include before/after -->

## Breaking changes

<!-- List any, with migration path. Otherwise: "None" -->

## Security checklist

> Required if this PR touches auth, crypto, network, storage, or input validation.

- [ ] No secrets logged (keys, passwords, tokens, AI keys)
- [ ] No new env vars without `.env.example` update
- [ ] Validation via Form Request / zod schema
- [ ] Authorization via Policy / route guard
- [ ] Audit log entry for sensitive operations
- [ ] Crypto changes have failing-test-first proof in commit history
- [ ] No new dependencies, OR new dep is justified in commit message
- [ ] Threat model in `SECURITY.md` updated if attack surface changed

## Reviewer notes

<!-- Anything the reviewer should pay extra attention to -->
