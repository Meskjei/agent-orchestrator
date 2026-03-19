export const TEST_PROJECTS = {
  simple: {
    name: 'Simple Test Project',
    goal: 'A simple test project for E2E testing',
    successCriteria: ['Tests pass'],
    constraints: []
  },
  multiAgent: {
    name: 'Multi-Agent Test Project',
    goal: 'A project with multiple agents',
    successCriteria: ['All agents complete tasks', 'No conflicts'],
    constraints: ['No breaking changes']
  },
  conflictTest: {
    name: 'Conflict Test Project',
    goal: 'Test conflict detection',
    successCriteria: ['Conflicts detected correctly'],
    constraints: []
  }
};

export type TestProjectKey = keyof typeof TEST_PROJECTS;