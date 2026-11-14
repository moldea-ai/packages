// types
export type {
  IDiagnosticGroup,
  IFindingCategory,
  IInspectionPresentation,
  IInspectionSeverity,
  IInspectionTone,
  IInspectionJsonValue,
  IInspectionMetadataIcon,
  IInspectionMetadataItem,
  IInspectionBindingView,
  IInspectionEvidence,
  IInspectionFindingView,
  IInspectionResultView,
} from './types.js';

// presentation roles
export {
  DIAGNOSTIC_GROUP_PRESENTATIONS,
  FINDING_CATEGORY_PRESENTATIONS,
  INSPECTION_IMPACT_PRESENTATIONS,
  INSPECTION_METADATA_ICONS,
  INSPECTION_RELATIONSHIP_PRESENTATIONS,
  INSPECTION_BINDING_PRESENTATIONS,
} from './constants.js';

// transformations
export {
  getInspectionImpact,
  getInspectionPresentation,
  getInspectionRelationship,
  groupInspectionFindings,
} from './utilities.js';
