# plan.md

## Objective
Set up the E2E test runner, write opaque-box test cases for Tiers 1-4, verify, and publish TEST_READY.md.

## Decomposed Plan

### Milestone 1: Test Infrastructure
- [ ] Determine the testing framework and tool availability (Node test runner, JSDOM/Playwright/Puppeteer, etc.).
- [ ] Set up the test runner configuration and environment variables.
- [ ] Design custom test helpers to mock Next.js server actions, routing, and database connections.
- [ ] Verify test runner can run a simple mock test.

### Milestone 2: Tier 1 & 2 Tests
- [ ] Implement Tier 1 (Feature Coverage) tests: 5 tests per feature for F1-F8. (Total >= 40 tests)
- [ ] Implement Tier 2 (Boundary & Corner Cases) tests: 5 tests per feature for F1-F8. (Total >= 40 tests)
- [ ] Verify execution and correctness of Tier 1 & 2 tests.

### Milestone 3: Tier 3 & 4 Tests
- [ ] Implement Tier 3 (Cross-Feature Combinations) tests: >= 8 pairwise test cases. (Total >= 8 tests)
- [ ] Implement Tier 4 (Real-World Application Scenarios) tests: >= 5 integrated user flows. (Total >= 5 tests)
- [ ] Verify execution and correctness of Tier 3 & 4 tests.

### Milestone 4: Publish Readiness
- [ ] Finalize the E2E test runner command and entry point.
- [ ] Execute all tests and ensure they pass.
- [ ] Generate and publish `TEST_READY.md` to the project root.
- [ ] Publish `TEST_INFRA.md` to the project root.
