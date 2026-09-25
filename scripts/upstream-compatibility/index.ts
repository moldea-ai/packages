import { runUpstreamCompatibility } from './runner.ts';

const mode = process.argv[2];

if (mode !== undefined && mode !== 'latest') {
  throw new Error('Expected no argument or the latest maintenance mode.');
}

const results = await runUpstreamCompatibility(mode === 'latest');

for (const result of results) {
  process.stdout.write(
    `${result.family} ${result.version} ${result.integrity} typecheck=passed request-preparation=${result.requestPreparationChecked ? 'passed' : 'not-applicable'}\n`,
  );
}
