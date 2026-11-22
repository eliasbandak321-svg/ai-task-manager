/*
  The in-memory workspace client used by UI tests. It lives in src/demo/ because the portfolio
  demo (M11) runs on the same code; this name is kept for the tests.
*/
export { createInMemoryWorkspaceClient as createFakeWorkspaceClient } from '../demo/inMemoryWorkspace'
export type { InMemoryWorkspaceOptions as FakeWorkspaceOptions } from '../demo/inMemoryWorkspace'
