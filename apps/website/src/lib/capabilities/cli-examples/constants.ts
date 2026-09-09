import type { IFixtureFile } from '../fixture-workspace/index.ts';

// tracked, untracked, and ignored canonical files distinguish Git selection from directory selection
export const CLI_FIXTURE_FILES: IFixtureFile[] = [
  {
    path: '/moldea/moldea.yaml',
    content: 'version: 1\ncontext:\n  /moldea/project.md:\n    affectedBy: [/src/returns/**]\n',
  },
  {
    path: '/moldea/project.md',
    content: '# Return policy\n\nCustomers can return an order within **30 days** of delivery.\n',
  },
  {
    path: '/moldea/context/tracked.md',
    content: 'The tracked return policy stays selected even when its path is ignored.\n',
  },
  {
    path: '/moldea/context/untracked.md',
    content: 'A newly authored return policy is selected before it is committed.\n',
  },
  {
    path: '/moldea/context/ignored.md',
    content: 'This ignored draft is not part of the selected knowledge.\n',
  },
  {
    path: '/moldea/context/long-policy.md',
    content: 'Return eligibility is measured from the delivery date.\n'.repeat(128),
  },
  {
    path: '/src/returns/policy.ts',
    content: 'export const canReturn = (daysSinceDelivery: number) => daysSinceDelivery <= 30;\n',
  },
  {
    path: '/.gitignore',
    content: '/moldea/context/tracked.md\n/moldea/context/ignored.md\n/git-settings/\n',
  },
  { path: '/git-settings/empty.conf', content: '' },
];
