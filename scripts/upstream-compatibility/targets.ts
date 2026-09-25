import type { IUpstreamTarget } from './types.ts';

// exact npm tarball integrity values are reviewed alongside the tagged source and SDK versions
export const PINNED_UPSTREAM_TARGETS: readonly IUpstreamTarget[] = Object.freeze([
  {
    family: 'anthropic',
    fixture: 'minimum',
    integrity:
      'sha512-Yn2QlXfyCiKJ5YGCOOay7ZE78ISvII2XY621WMCiflmG8IYgwx59IBwPExxki3Xk9jKUtnD/Sj6UvplWr0rZxg==',
    packageName: '@anthropic-ai/sdk',
    sourceReference: 'https://github.com/anthropics/anthropic-sdk-typescript/tree/sdk-v0.117.1',
    version: '0.117.1',
  },
  {
    family: 'anthropic',
    fixture: 'current',
    integrity:
      'sha512-tl5cBFZC1jVFrTuQyvQObA4WmuNgcYVeXfriqOumgtLAHUm4gPUj18YnszBW60v0PrjDB8nBDOC6wd9CmHQFlA==',
    packageName: '@anthropic-ai/sdk',
    sourceReference: 'https://github.com/anthropics/anthropic-sdk-typescript/tree/sdk-v0.128.0',
    version: '0.128.0',
  },
  {
    family: 'google-genai',
    fixture: 'minimum',
    integrity:
      'sha512-CdZ3M/titoH81hXXkvOikrOW26bC9IXh9iYT7u+r+5p7wi1LnMEnB0AbJfDeWAkjuneP4oJ299BtCt6twmORWg==',
    packageName: '@google/genai',
    sourceReference: 'https://github.com/googleapis/js-genai/tree/v2.17.1',
    version: '2.17.1',
  },
  {
    family: 'google-genai',
    fixture: 'current',
    integrity:
      'sha512-bIu5eoxF1AaPWs9ivmUJGp1RpDHyapoODvWvnkzRDx2CTIW6UJXFhDdjj0BlRve3ZHMMuEkQBVrA/ALqpW4apA==',
    packageName: '@google/genai',
    sourceReference: 'https://github.com/googleapis/js-genai/tree/v2.24.0',
    version: '2.24.0',
  },
  {
    family: 'openai',
    fixture: 'minimum',
    integrity:
      'sha512-+C9Muit5x8j9R8ej8ZzVgKcrVDtqFqTy9gxFdov0EItLgU68zrJtF9ZeT0cyqJQW9S3PCJkdFgADtRGquRBtew==',
    packageName: 'openai',
    sourceReference: 'https://github.com/openai/openai-node/tree/v7.4.0',
    version: '7.4.0',
  },
  {
    family: 'openai',
    fixture: 'current',
    integrity:
      'sha512-0ecOXnFSMNWZq6cUBcTV6Lf93y+fm8BH/+QzFvpoP1UGNOE5pnytRa6HAPGCw+3IS9SIAW7rc1M8yyzN1PiBAQ==',
    packageName: 'openai',
    sourceReference: 'https://github.com/openai/openai-node/tree/v7.23.0',
    version: '7.23.0',
  },
]);
