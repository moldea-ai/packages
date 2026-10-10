// bindings
export {
  indexImports,
  indexLexicalBindings,
  resolveLexicalBinding,
  indexModuleDeclarations,
  isBoundIdentifier,
  isModuleBindingVisible,
  resolveBindingReferences,
  resolveInstructionCallReferences,
  resolveImportCandidatePaths,
} from './bindings.js';

// expressions
export {
  getClosedObjectProperties,
  getDirectCall,
  getStaticString,
  isNullLiteral,
  isStaticLiteralValue,
  isStrictLiteral,
  unwrapExpression,
} from './expressions.js';

// requests
export {
  analyzeClientRequests,
  analyzeObjectRelationships,
  getClosedArrayIdentifiers,
  indexSafeModuleArrayNames,
} from './requests.js';

// module values
export {
  getSafeModuleConstLiteral,
  isModuleConstValueSafe,
  isModuleValueBindingSafe,
} from './module-values.js';

// mutations
export { analyzeModuleValueMutations } from './mutations.js';

// static strings
export { resolveStaticString } from './static-strings.js';

// source analysis
export {
  analyzeSource,
  analyzeTypeScriptModule,
  getCallableExportState,
  getConstExport,
  getRuntimeExport,
  isSupportedTypeScriptSourcePath,
} from './source-analysis.js';
export { indexBindingEffects, hasBindingMutation } from './mutations.js';
