import ts from 'typescript';

import type {
  IStaticAnalysisModuleValueSource,
  IStaticAnalysisMutationAnalysis,
} from '../types.js';
import { hasLexicalBinding, isModuleBindingVisible, resolveLexicalBinding } from './bindings.js';
import { unwrapExpression } from './expressions.js';

/**
 * Indexes writes and call escapes to exact lexical bindings, including immutable aliases.
 * @param identifierUses Indexed source identifier uses.
 * @param lexicalBindings Indexed declarations by scope.
 * @returns Separate writes and escapes, with null representing an unknown or whole-value effect.
 */
export const indexBindingEffects = (
  identifierUses: ReadonlyMap<string, readonly ts.Identifier[]>,
  lexicalBindings: IStaticAnalysisModuleValueSource['lexicalBindings'],
): {
  mutations: ReadonlyMap<ts.Node, ReadonlySet<string | null>>;
  escapes: ReadonlyMap<ts.Node, ReadonlySet<string | null>>;
} => {
  const mutations = new Map<ts.Node, Set<string | null>>();
  const escapes = new Map<ts.Node, Set<string | null>>();
  const propagatedMutations = new WeakMap<ts.Node, Set<string | null>>();
  const propagatedEscapes = new WeakMap<ts.Node, Set<string | null>>();
  const analysis = { lexicalBindings };
  const add = (
    identifier: ts.Identifier,
    member: string | null,
    shouldPropagateToAliasSource = true,
    kind: 'mutation' | 'escape' = 'mutation',
  ): void => {
    const effects = kind === 'mutation' ? mutations : escapes;
    const propagatedEffects = kind === 'mutation' ? propagatedMutations : propagatedEscapes;
    let binding = resolveLexicalBinding(identifier, analysis);
    let changedMember = member;
    const visited = new Set<ts.Node>();
    while (binding !== null && !visited.has(binding)) {
      visited.add(binding);
      if (shouldPropagateToAliasSource) {
        // repeated member writes must not traverse an already-accounted alias chain again
        const propagatedMembers = propagatedEffects.get(binding) ?? new Set<string | null>();
        if (propagatedMembers.has(changedMember)) break;
        propagatedMembers.add(changedMember);
        propagatedEffects.set(binding, propagatedMembers);
      }
      const members = effects.get(binding) ?? new Set<string | null>();
      members.add(changedMember);
      effects.set(binding, members);
      // Rebinding an alias changes that variable; member writes can change the shared object.
      if (
        !shouldPropagateToAliasSource ||
        !ts.isVariableDeclaration(binding) ||
        binding.initializer === undefined
      )
        break;
      let initializer = unwrapExpression(binding.initializer);
      while (
        ts.isPropertyAccessExpression(initializer) ||
        ts.isElementAccessExpression(initializer)
      ) {
        changedMember = getStaticMemberName(initializer);
        initializer = unwrapExpression(initializer.expression);
      }
      if (!ts.isIdentifier(initializer)) break;
      binding = resolveLexicalBinding(initializer, analysis);
    }
  };
  for (const uses of identifierUses.values()) {
    for (const identifier of uses) {
      let target = skipTransparentParents(identifier);
      let firstMember: string | null = null;
      let hasMember = false;
      while (
        (ts.isPropertyAccessExpression(target.parent) ||
          ts.isElementAccessExpression(target.parent)) &&
        target.parent.expression === target
      ) {
        const member = getStaticMemberName(target.parent);
        if (!hasMember) firstMember = member;
        hasMember = true;
        target = skipTransparentParents(target.parent);
      }
      if (isMutatingTarget(target)) {
        add(identifier, firstMember, hasMember);
        continue;
      }
      const parent = target.parent;
      if (
        (!ts.isCallExpression(parent) && !ts.isNewExpression(parent)) ||
        parent.expression === target ||
        parent.arguments === undefined
      )
        continue;
      if (ts.isCallExpression(parent) && parent.arguments[0] === target) {
        const members = new Set<string>();
        const hasUnknownMutation = analyzeMutationCall(target, members, analysis);
        if (hasUnknownMutation !== null) {
          if (hasMember) {
            if (hasUnknownMutation || members.size > 0) add(identifier, firstMember);
          } else {
            if (hasUnknownMutation) add(identifier, null);
            for (const member of members) add(identifier, member);
          }
          continue;
        }
      }
      add(identifier, firstMember, true, 'escape');
    }
  }
  return { mutations, escapes };
};

/**
 * Checks whether writes invalidate one selected binding or member.
 * @param identifier The exact lexical use being inspected.
 * @param analysis Indexed source facts.
 * @param member A relevant member, or an empty string for the callable binding itself.
 * @returns Whether an observed write prevents a static proof.
 */
export const hasBindingMutation = (
  identifier: ts.Identifier,
  analysis: Pick<IStaticAnalysisModuleValueSource, 'lexicalBindings' | 'bindingMutations'>,
  member?: string,
): boolean => {
  const binding = resolveLexicalBinding(identifier, analysis);
  if (binding === null) return false;
  const mutations = analysis.bindingMutations.get(binding);
  return (
    mutations !== undefined &&
    (mutations.has(null) || (member === undefined ? mutations.size > 0 : mutations.has(member)))
  );
};

const skipTransparentParents = (node: ts.Node): ts.Node => {
  let current = node;

  while (
    ts.isAsExpression(current.parent) ||
    ts.isParenthesizedExpression(current.parent) ||
    ts.isSatisfiesExpression(current.parent) ||
    ts.isNonNullExpression(current.parent) ||
    ts.isTypeAssertionExpression(current.parent)
  ) {
    current = current.parent;
  }

  return current;
};

const isAssignmentOperator = (kind: ts.SyntaxKind): boolean =>
  kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

const isMutatingTarget = (expression: ts.Node): boolean => {
  const candidate = skipTransparentParents(expression);
  const parent = candidate.parent;

  return (
    (ts.isBinaryExpression(parent) &&
      parent.left === candidate &&
      isAssignmentOperator(parent.operatorToken.kind)) ||
    ((ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) &&
      parent.operand === candidate &&
      (parent.operator === ts.SyntaxKind.PlusPlusToken ||
        parent.operator === ts.SyntaxKind.MinusMinusToken)) ||
    (ts.isDeleteExpression(parent) && parent.expression === candidate) ||
    ((ts.isForInStatement(parent) || ts.isForOfStatement(parent)) &&
      parent.initializer === candidate)
  );
};

const getStaticMemberName = (
  member: ts.PropertyAccessExpression | ts.ElementAccessExpression,
): string | null => {
  if (ts.isPropertyAccessExpression(member)) {
    return member.name.text;
  }

  const argument = member.argumentExpression;
  return argument !== undefined &&
    (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
    ? argument.text
    : null;
};

const isIgnoredIdentifier = (identifier: ts.Identifier, declarationName: ts.Identifier): boolean =>
  identifier === declarationName ||
  ts.isImportSpecifier(identifier.parent) ||
  (ts.isPropertyAccessExpression(identifier.parent) && identifier.parent.name === identifier) ||
  (ts.isPropertyAssignment(identifier.parent) && identifier.parent.name === identifier);

const addObjectMutationMembers = (
  object: ts.ObjectLiteralExpression,
  mutatedMembers: Set<string>,
): boolean => {
  let hasUnknownMutation = false;

  for (const property of object.properties) {
    if (
      (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) ||
      ts.isComputedPropertyName(property.name)
    ) {
      hasUnknownMutation = true;
      continue;
    }

    const propertyName =
      ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
        ? property.name.text
        : null;

    if (propertyName === null) {
      hasUnknownMutation = true;
    } else {
      mutatedMembers.add(propertyName);
    }
  }

  return hasUnknownMutation;
};

/**
 * Classifies direct built-in mutator calls without guessing the effects of other calls.
 * @returns Null for other calls, or whether the known write can affect unknown members.
 */
const analyzeMutationCall = (
  target: ts.Node,
  mutatedMembers: Set<string>,
  analysis: Pick<IStaticAnalysisModuleValueSource, 'lexicalBindings'>,
): boolean | null => {
  const candidate = skipTransparentParents(target);
  const parent = candidate.parent;

  if (!ts.isCallExpression(parent) || parent.arguments[0] !== candidate) {
    return null;
  }

  const callee = unwrapExpression(parent.expression);
  if (!ts.isPropertyAccessExpression(callee) && !ts.isElementAccessExpression(callee)) {
    return null;
  }
  const owner = unwrapExpression(callee.expression);
  if (!ts.isIdentifier(owner) || hasLexicalBinding(owner, analysis)) return null;
  const ownerName = owner.text;
  const methodName = getStaticMemberName(callee);

  if (ownerName === 'Object' && methodName === 'assign') {
    let hasUnknownMutation = parent.arguments.length < 2;

    for (const source of parent.arguments.slice(1)) {
      const assignmentSource = unwrapExpression(source);

      if (!ts.isObjectLiteralExpression(assignmentSource)) {
        hasUnknownMutation = true;
      } else if (addObjectMutationMembers(assignmentSource, mutatedMembers)) {
        hasUnknownMutation = true;
      }
    }

    return hasUnknownMutation;
  }

  if (ownerName === 'Object' && methodName === 'defineProperties') {
    const descriptors = parent.arguments[1];
    if (descriptors === undefined) return true;
    const descriptorObject = unwrapExpression(descriptors);
    return ts.isObjectLiteralExpression(descriptorObject)
      ? addObjectMutationMembers(descriptorObject, mutatedMembers)
      : true;
  }

  if (
    ((ownerName === 'Object' || ownerName === 'Reflect') && methodName === 'defineProperty') ||
    (ownerName === 'Reflect' && methodName === 'set')
  ) {
    const argument = parent.arguments[1];
    const member = argument === undefined ? undefined : unwrapExpression(argument);

    if (
      member !== undefined &&
      (ts.isStringLiteral(member) || ts.isNoSubstitutionTemplateLiteral(member))
    ) {
      mutatedMembers.add(member.text);
      return false;
    }

    return true;
  }

  return (ownerName === 'Object' || ownerName === 'Reflect') && methodName === 'setPrototypeOf'
    ? true
    : null;
};

/**
 * Classifies module-local mutations and escapes for one returned object value.
 * @param analysis The indexed source containing the binding.
 * @param declaration The module-local constant declaration.
 * @param allowedReferences Bare identifier uses proven to be supported registrations or targets.
 * @param safeMethodCalls Read-only method calls that preserve the value's runtime configuration.
 * @returns Member-specific mutations and whether an unknown use can affect every relationship.
 */
export const analyzeModuleValueMutations = (
  analysis: IStaticAnalysisModuleValueSource,
  declaration: ts.VariableDeclaration,
  allowedReferences: ReadonlySet<ts.Identifier>,
  safeMethodCalls: ReadonlySet<string> = new Set(),
): IStaticAnalysisMutationAnalysis => {
  if (!ts.isIdentifier(declaration.name)) {
    return Object.freeze({ hasUnknownMutation: true, mutatedMembers: new Set<string>() });
  }

  const indexedMutations = analysis.bindingMutations.get(declaration);
  const mutatedMembers = new Set<string>(
    [...(indexedMutations ?? [])].filter((member): member is string => member !== null),
  );
  let hasUnknownMutation = indexedMutations?.has(null) === true;

  for (const identifier of analysis.identifierUses.get(declaration.name.text) ?? []) {
    if (
      isIgnoredIdentifier(identifier, declaration.name) ||
      !isModuleBindingVisible(identifier, analysis) ||
      allowedReferences.has(identifier)
    ) {
      continue;
    }

    const expression = skipTransparentParents(identifier);
    const parent = expression.parent;
    const member =
      (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
      parent.expression === expression
        ? parent
        : null;

    if (member !== null) {
      const memberName = getStaticMemberName(member);

      if (memberName === null) {
        hasUnknownMutation = true;
      } else if (isMutatingTarget(member)) {
        mutatedMembers.add(memberName);
      } else {
        const memberExpression = skipTransparentParents(member);
        const memberParent = memberExpression.parent;

        if (
          (ts.isPropertyAccessExpression(memberParent) ||
            ts.isElementAccessExpression(memberParent)) &&
          memberParent.expression === memberExpression &&
          ts.isCallExpression(skipTransparentParents(memberParent).parent)
        ) {
          mutatedMembers.add(memberName);
        } else if (
          ts.isCallExpression(memberParent) &&
          memberParent.expression === memberExpression
        ) {
          if (!safeMethodCalls.has(memberName)) {
            mutatedMembers.add(memberName);
          }
        }
      }

      continue;
    }

    if (isMutatingTarget(identifier)) {
      hasUnknownMutation = true;
      continue;
    }

    const mutationCall = analyzeMutationCall(identifier, mutatedMembers, analysis);
    hasUnknownMutation ||= mutationCall ?? true;
  }

  return Object.freeze({
    hasUnknownMutation,
    mutatedMembers: new Set(mutatedMembers),
  });
};
