## Summary

Please describe what changed and why.

## OpenAPI Impact

- [ ] No API contract change
- [ ] API contract changed and I ran breaking detector

If API changed, include command and output summary path:

- Command:
  - npx swagger-sentinel breaking old-api.yaml new-api.yaml --summary breaking-summary.md
- Summary file:
  - breaking-summary.md
- Recommended bump:
  - major / minor / patch / none
- Risk level:
  - high / medium / low

## Validation Checklist

- [ ] npm test passed
- [ ] Lint/type-check passed
- [ ] README/docs updated (if behavior changed)

## Notes for Reviewer

Anything you want reviewers to focus on.
