import { getRegistrySnapshotEnvironment } from './index.mjs';

// prints KEY=value lines for $GITHUB_ENV so later consumer-install steps inherit the snapshot
for (const [name, value] of Object.entries(getRegistrySnapshotEnvironment())) {
  process.stdout.write(`${name}=${value}\n`);
}
