// contracts
export type {
  IRuntimeAdapterOutputBudget,
  IRuntimeAdapterRecordCollector,
  IRuntimeAdapterResultCollector,
} from './types.js';

// bounded result construction
export {
  createRuntimeAdapterOutputBudget,
  createRuntimeAdapterResultCollector,
} from './collection.js';
