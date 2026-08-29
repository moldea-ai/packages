import type { IEvaluationReplayPathTreeNode, IEvaluationReplayWorkspaceChange } from './types.js';

interface IMutablePathTreeNode {
  readonly children: Map<string, IMutablePathTreeNode>;
  readonly kind: IEvaluationReplayPathTreeNode['kind'];
  readonly name: string;
  readonly path: string;
}

/** Validates one portable repository-relative path before public replay rendering. */
const validateReplayPath = (path: string): readonly string[] => {
  const segments = path.split('/');
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    throw new Error(`Evaluation replay path ${JSON.stringify(path)} is not repository-relative.`);
  }

  return segments;
};

/** Converts an internal tree node into its public immutable representation. */
const createPublicNode = (node: IMutablePathTreeNode): IEvaluationReplayPathTreeNode => {
  const children = [...node.children.values()]
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .map(createPublicNode);
  const changeCount =
    node.kind === 'folder' ? children.reduce((sum, child) => sum + child.changeCount, 0) : 1;

  return {
    changeCount,
    children,
    kind: node.kind,
    name: node.name,
    path: node.path,
  };
};

/**
 * Builds a deterministic structural folder tree from recorded file and symlink changes.
 * @param changes Recorded path-only workspace changes.
 * @returns A stable structural tree containing every changed path.
 * @throws
 * - If a path is unsafe, duplicated, or structurally contradictory
 */
export const buildEvaluationReplayPathTree = (
  changes: readonly IEvaluationReplayWorkspaceChange[],
): readonly IEvaluationReplayPathTreeNode[] => {
  const root = new Map<string, IMutablePathTreeNode>();
  const seenPaths = new Set<string>();

  for (const change of changes) {
    const segments = validateReplayPath(change.path);
    if (seenPaths.has(change.path)) {
      throw new Error(`Evaluation replay path ${JSON.stringify(change.path)} is duplicated.`);
    }
    seenPaths.add(change.path);

    let siblings = root;
    let currentPath = '';
    for (const [index, segment] of segments.entries()) {
      currentPath = currentPath.length === 0 ? segment : `${currentPath}/${segment}`;
      const isLeaf = index === segments.length - 1;
      const expectedKind = isLeaf ? change.type : 'folder';
      const existingNode = siblings.get(segment);
      if (existingNode !== undefined && existingNode.kind !== expectedKind) {
        throw new Error(
          `Evaluation replay path ${JSON.stringify(change.path)} conflicts with ${JSON.stringify(currentPath)}.`,
        );
      }

      const node =
        existingNode ??
        ({
          children: new Map<string, IMutablePathTreeNode>(),
          kind: expectedKind,
          name: segment,
          path: currentPath,
        } satisfies IMutablePathTreeNode);
      siblings.set(segment, node);
      siblings = node.children;
    }
  }

  return [...root.values()]
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    .map(createPublicNode);
};
