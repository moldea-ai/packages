// Node inspection contracts
export type {
  INodeInspectionAdapter,
  INodeProjectInspection,
  INodeProjectInspectionInput,
} from '../node-inspection/types.js';

// isolated project inspection
export { createNodeProjectInspection } from '../node-inspection/client.js';

// execution identity
export { NODE_INSPECTION_PROFILE } from '../node-inspection/constants.js';
