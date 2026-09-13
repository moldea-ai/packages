// virtual files used only by deterministic documentation tests
export interface IDocumentationExampleFile {
  path: string;
  content: string;
  type: 'file';
}

/**
 * Reads the single marked file set without executing code or accessing its virtual paths.
 * @param markdown The complete package-owned example document.
 * @returns The exact fenced file contents, including their final newline.
 * @throws
 * - The documentation example must contain one complete marked file set.
 * - The documentation example contains an invalid or duplicate file path.
 * - The documentation example contains malformed file blocks.
 */
export const parseDocumentationExample = (markdown: string): IDocumentationExampleFile[] => {
  const source = markdown.replace(/\r\n/gu, '\n');
  const start = '<!-- example:start -->';
  const end = '<!-- example:end -->';
  const starts = source.split(start);
  const ends = source.split(end);
  if (starts.length !== 2 || ends.length !== 2 || source.indexOf(start) > source.indexOf(end)) {
    throw new Error('The documentation example must contain one complete marked file set.');
  }

  const body = source.slice(source.indexOf(start) + start.length, source.indexOf(end));
  const files: IDocumentationExampleFile[] = [];
  const paths = new Set<string>();
  const block = /^### (\/[^\n]+)\n\n(`{3,4})(?:json|yaml|typescript|markdown)\n([\s\S]*?)^\2$/gmu;
  let consumed = 0;
  for (const match of body.matchAll(block)) {
    const filePath = match[1]!;
    const segments = filePath.slice(1).split('/');
    if (
      !/^\/[a-z0-9._/-]+$/u.test(filePath) ||
      filePath.length > 160 ||
      segments.some(
        (segment) =>
          segment.length === 0 ||
          segment.length > 64 ||
          segment === '.' ||
          segment === '..' ||
          segment.endsWith('.') ||
          /^_(?:archives?|backups?)$/u.test(segment) ||
          /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/u.test(segment),
      ) ||
      paths.has(filePath)
    ) {
      throw new Error('The documentation example contains an invalid or duplicate file path.');
    }
    if (body.slice(consumed, match.index).trim() !== '') {
      throw new Error('The documentation example contains malformed file blocks.');
    }
    paths.add(filePath);
    files.push({ path: filePath, content: match[3]!, type: 'file' });
    consumed = match.index + match[0].length;
  }
  if (files.length === 0 || body.slice(consumed).trim() !== '') {
    throw new Error('The documentation example contains malformed file blocks.');
  }
  return files;
};
