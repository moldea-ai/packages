import type { IUpstreamTarget } from './types.ts';

// exact npm tarball integrity values are reviewed alongside the tagged source and SDK versions
export const PINNED_UPSTREAM_TARGETS: readonly IUpstreamTarget[] = Object.freeze([
  {
    companionPackages: ['zod@4.3.6'],
    family: 'ai-sdk',
    fixture: 'minimum',
    integrity:
      'sha512-wBUyoCYF3GVr+62nelBgR8YbpTSsMZrzFyOOjiwijylNSM2TFCW35C+Pml2vc59/WLMpyhS/LWZ55M+B9DAcSg==',
    packageName: 'ai',
    sourceReference: 'https://registry.npmjs.org/ai/7.0.66',
    version: '7.0.66',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'ai-sdk',
    fixture: 'current',
    integrity:
      'sha512-gmkVGPzTNPcJixBiG9zUvP3gmvwko85dHiKrxFKK0zcVJIIu1FP6YDo3jna+ZrC2twMAsUPLr5htCwZjCINH3Q==',
    packageName: 'ai',
    sourceReference: 'https://registry.npmjs.org/ai/7.0.116',
    version: '7.0.116',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'anthropic',
    fixture: 'minimum',
    integrity:
      'sha512-Yn2QlXfyCiKJ5YGCOOay7ZE78ISvII2XY621WMCiflmG8IYgwx59IBwPExxki3Xk9jKUtnD/Sj6UvplWr0rZxg==',
    packageName: '@anthropic-ai/sdk',
    sourceReference: 'https://github.com/anthropics/anthropic-sdk-typescript/tree/sdk-v0.117.1',
    version: '0.117.1',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'anthropic',
    fixture: 'current',
    integrity:
      'sha512-tl5cBFZC1jVFrTuQyvQObA4WmuNgcYVeXfriqOumgtLAHUm4gPUj18YnszBW60v0PrjDB8nBDOC6wd9CmHQFlA==',
    packageName: '@anthropic-ai/sdk',
    sourceReference: 'https://github.com/anthropics/anthropic-sdk-typescript/tree/sdk-v0.128.0',
    version: '0.128.0',
  },
  {
    companionPackages: [
      '@anthropic-ai/sdk@0.128.0',
      '@modelcontextprotocol/sdk@1.30.1',
      'zod@4.3.6',
    ],
    family: 'claude-agent-sdk',
    fixture: 'minimum',
    integrity:
      'sha512-988d+JfICQoIIDwcnQm9ivJ3CXfKUhDJ43XSQXiwa4PMnc/+NwAK71JUnOipXgGJNVu+znfzk42CV+wUeX25dg==',
    packageName: '@anthropic-ai/claude-agent-sdk',
    sourceReference: 'https://github.com/anthropics/claude-agent-sdk-typescript/tree/v0.3.234',
    version: '0.3.234',
  },
  {
    companionPackages: [
      '@anthropic-ai/sdk@0.128.0',
      '@modelcontextprotocol/sdk@1.30.1',
      'zod@4.3.6',
    ],
    family: 'claude-agent-sdk',
    fixture: 'current',
    integrity:
      'sha512-6UAerS1udzndLEx+0XW3gQWiICgfu/a+2fx/aLY3gUy+1JUQESbwYkhR40+D6d+yjueCslkLmvkPlZQFZDph6A==',
    packageName: '@anthropic-ai/claude-agent-sdk',
    sourceReference: 'https://github.com/anthropics/claude-agent-sdk-typescript/tree/v0.3.282',
    version: '0.3.282',
  },
  {
    companionPackages: ['agents@0.21.0', 'ai@7.0.66', 'zod@4.3.6'],
    family: 'cloudflare-think',
    fixture: 'minimum',
    integrity:
      'sha512-tnfMZSqSz1dhfBx0io/mXMJE2huwJc2kTPAkx55y1bTUQwt9A2uONBmN1FixNsI9DFp1zXJDzcO0juGFKfTyLQ==',
    packageName: '@cloudflare/think',
    sourceReference:
      'https://github.com/cloudflare/agents/releases/tag/%40cloudflare%2Fthink%400.17.0',
    version: '0.17.0',
  },
  {
    companionPackages: ['agents@0.23.0', 'ai@7.0.66', 'zod@4.3.6'],
    family: 'cloudflare-think',
    fixture: 'boundary',
    integrity:
      'sha512-eN3gZvO05UPucAaQ9GfIu5iKhMeRKqd+NzxfNdi3rhbAHhsTC3ckxPnXNlBmr8Pg0zcvaJK69KhWPv4AySeexQ==',
    packageName: '@cloudflare/think',
    sourceReference:
      'https://github.com/cloudflare/agents/releases/tag/%40cloudflare%2Fthink%400.18.0',
    version: '0.18.0',
  },
  {
    companionPackages: ['agents@0.24.0', 'ai@7.0.116', 'zod@4.3.6'],
    family: 'cloudflare-think',
    fixture: 'current',
    integrity:
      'sha512-7xYaVeQJA4Xnwuo2R5/zhbUjWftvKzVjdsZnOSYjo+BqJ+hbizemW8fCt1QTTP+TDixgXXiOQNlOmyNJXjTYUw==',
    packageName: '@cloudflare/think',
    sourceReference:
      'https://github.com/cloudflare/agents/releases/tag/%40cloudflare%2Fthink%400.19.0',
    version: '0.19.0',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'eve',
    fixture: 'minimum',
    integrity:
      'sha512-HTd1A3/GsRKNpJ+6WEW4OEPAhWAId5IZ769hjuY3eJqj3cWeaEvBUDZSjUFjSDit63aqbfur0u7AH1m0JNr7EQ==',
    packageName: 'eve',
    sourceReference: 'https://registry.npmjs.org/eve/0.39.1',
    version: '0.39.1',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'eve',
    fixture: 'agent-options-boundary',
    integrity:
      'sha512-FM3aC2A3SCKQxtyhSNR5+CaIVlKJmTGb7rCqcuHEhZShDKo1IXCTt/F7r4toqkLDG6lW7VcStTku77KWiosLfg==',
    packageName: 'eve',
    sourceReference: 'https://registry.npmjs.org/eve/0.52.2',
    version: '0.52.2',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'eve',
    fixture: 'visibility-boundary',
    integrity:
      'sha512-YTOPZXZAQSL1/sG8MEoAeZESGfvMaaCniMeKI2Whhst5Buj8PG37Fh2Po2SjXXdvP0NtqdrbmG38L9ZX2llTBw==',
    packageName: 'eve',
    sourceReference: 'https://registry.npmjs.org/eve/0.59.1',
    version: '0.59.1',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'eve',
    fixture: 'exposure-before',
    integrity:
      'sha512-hiKqy326LtGjL9vG23FlIm+8X2GPH+ZPzdH1CFvYMWvybV95coRc4tYWUKiVtLYijOoocdq2HCu54U0S+LPC+Q==',
    packageName: 'eve',
    sourceReference: 'https://registry.npmjs.org/eve/0.60.1',
    version: '0.60.1',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'eve',
    fixture: 'exposure-boundary',
    integrity:
      'sha512-el9Mm7VZW4QibR3WwUM3LsWDaqiyVJtv5JieREflVcTR3WkEn0kqeJ/wcbaZJ6+goTbi6yYO2tpEdWOhkIJQIg==',
    packageName: 'eve',
    sourceReference: 'https://registry.npmjs.org/eve/0.61.0',
    version: '0.61.0',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'eve',
    fixture: 'defaults-boundary',
    integrity:
      'sha512-16dcyvpucnMp6f1TKZROvRrDAYWIlV7ulZfEMK+IuK1AVXMQPoLLOrGuLT/qI1TjIkxZt9g1JcXXOv/uu3yjdQ==',
    packageName: 'eve',
    sourceReference: 'https://github.com/vercel/eve/releases/tag/eve%400.65.0',
    version: '0.65.0',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'eve',
    fixture: 'exclusion-boundary',
    integrity:
      'sha512-GPvfl78stQLocxM7Mq6Bzpiwlooiofb577OrhtyLx7wZSvgPg/L6wddRZTyIkbVLhoZYWYvnetAnwU+H448n7Q==',
    packageName: 'eve',
    sourceReference: 'https://github.com/vercel/eve/releases/tag/eve%400.66.2',
    version: '0.66.2',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'eve',
    fixture: 'current',
    integrity:
      'sha512-oJkQdVrlmb1GFeaSUNY6IF71ttXjQdFnkKQP+84Qlvs/M+fUqMjGTqnwevQ+qFvc8KCswo3cbBohKOCGdgZPFg==',
    packageName: 'eve',
    sourceReference: 'https://github.com/vercel/eve/releases/tag/eve%400.66.3',
    version: '0.66.3',
  },
  {
    companionPackages: [],
    family: 'google-genai',
    fixture: 'minimum',
    integrity:
      'sha512-CdZ3M/titoH81hXXkvOikrOW26bC9IXh9iYT7u+r+5p7wi1LnMEnB0AbJfDeWAkjuneP4oJ299BtCt6twmORWg==',
    packageName: '@google/genai',
    sourceReference: 'https://github.com/googleapis/js-genai/tree/v2.17.1',
    version: '2.17.1',
  },
  {
    companionPackages: [],
    family: 'google-genai',
    fixture: 'current',
    integrity:
      'sha512-bIu5eoxF1AaPWs9ivmUJGp1RpDHyapoODvWvnkzRDx2CTIW6UJXFhDdjj0BlRve3ZHMMuEkQBVrA/ALqpW4apA==',
    packageName: '@google/genai',
    sourceReference: 'https://github.com/googleapis/js-genai/tree/v2.24.0',
    version: '2.24.0',
  },
  {
    companionPackages: ['@langchain/core@1.2.8', 'zod@4.3.6'],
    family: 'langchain',
    fixture: 'minimum',
    integrity:
      'sha512-267IPLnoCtyMbIl1ABedQHlJDUqboW7dUWYCQS0HXjUvQnUaYV+l7OIXaQnJUaodS+fDtk774Oo03n1NLHrPFA==',
    packageName: 'langchain',
    sourceReference: 'https://registry.npmjs.org/langchain/1.5.9',
    version: '1.5.9',
  },
  {
    companionPackages: ['@langchain/core@1.2.12', 'zod@4.3.6'],
    family: 'langchain',
    fixture: 'current',
    integrity:
      'sha512-cWNsKiRLyv0NN1e9IR+0CUyS4cBn1LSJ7OhqTa0RQGK735cb4l1+wd4/lQJz4imJ4sojOl+VfHw6kKZwWFNYlQ==',
    packageName: 'langchain',
    sourceReference: 'https://registry.npmjs.org/langchain/1.5.12',
    version: '1.5.12',
  },
  {
    companionPackages: ['@langchain/core@1.2.9', 'zod@4.3.6'],
    family: 'langgraph',
    fixture: 'minimum',
    integrity:
      'sha512-63iH/igH5Fh5fHqmWp09YYWaDKKB9v4RCmYNJBrnQ224rFRbjebgyYW6o5RCczN5FZxIhQj+xT51rrNmG0zi5A==',
    packageName: '@langchain/langgraph',
    sourceReference: 'https://registry.npmjs.org/@langchain%2Flanggraph/1.4.12',
    version: '1.4.12',
  },
  {
    companionPackages: ['@langchain/core@1.2.12', 'zod@4.3.6'],
    family: 'langgraph',
    fixture: 'boundary',
    integrity:
      'sha512-jwD/V5mJwCMyGH+Rg/3I2RACJKuaM0ZRRDaNMOSsu7+juw9tSH55Vc7zCKwsxjhHCf0EcGEdLbG7ex/BxbypjQ==',
    packageName: '@langchain/langgraph',
    sourceReference: 'https://registry.npmjs.org/@langchain%2Flanggraph/1.4.16',
    version: '1.4.16',
  },
  {
    companionPackages: ['@langchain/core@1.2.12', 'zod@4.3.6'],
    family: 'langgraph',
    fixture: 'current',
    integrity:
      'sha512-yrMMJ9hk2NVMD2xU2WoVrgFawAU6s/RzEl/dX9BhlyxZHazo1wHY35z4K2BIBzTUh4z3giCzrUoqRAqW2CWpWg==',
    packageName: '@langchain/langgraph',
    sourceReference: 'https://registry.npmjs.org/@langchain%2Flanggraph/1.4.18',
    version: '1.4.18',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'openai',
    fixture: 'minimum',
    integrity:
      'sha512-+C9Muit5x8j9R8ej8ZzVgKcrVDtqFqTy9gxFdov0EItLgU68zrJtF9ZeT0cyqJQW9S3PCJkdFgADtRGquRBtew==',
    packageName: 'openai',
    sourceReference: 'https://github.com/openai/openai-node/tree/v7.4.0',
    version: '7.4.0',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'openai',
    fixture: 'current',
    integrity:
      'sha512-0ecOXnFSMNWZq6cUBcTV6Lf93y+fm8BH/+QzFvpoP1UGNOE5pnytRa6HAPGCw+3IS9SIAW7rc1M8yyzN1PiBAQ==',
    packageName: 'openai',
    sourceReference: 'https://github.com/openai/openai-node/tree/v7.23.0',
    version: '7.23.0',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'openai-agents-sdk',
    fixture: 'minimum',
    integrity:
      'sha512-L1ROwfXhoqiLCwtOp1E2tEluK2GRmq/LsQyoRGGFN/BjYYbyNMtLn6afuaULEIOdFC6treHdNtiEQaCt5I6rdg==',
    packageName: '@openai/agents',
    sourceReference: 'https://registry.npmjs.org/@openai%2Fagents/0.16.1',
    version: '0.16.1',
  },
  {
    companionPackages: ['zod@4.3.6'],
    family: 'openai-agents-sdk',
    fixture: 'current',
    integrity:
      'sha512-i0dIeN8PsqLfEgfMLrmpcJPvgltY2fUxr2+CftBCvX6g1GgWdoiCKpbf+labmJJPqwidN7HfXkgBszM2CHg/IA==',
    packageName: '@openai/agents',
    sourceReference: 'https://registry.npmjs.org/@openai%2Fagents/0.18.0',
    version: '0.18.0',
  },
]);
