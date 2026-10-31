export interface CommitMessageResult {
  conventionalMessage: string;
  type: string;
  scope: string | null;
  summary: string;
  bullets: string[];
  preview: string;
}

export interface CommitAssistantInput {
  changedFiles: Array<{
    path: string;
    changeType: string;
    oldPath?: string | null;
  }>;
  changedSymbols?: Array<{
    name: string;
    kind: string;
    file: string;
    isExported?: boolean;
  }>;
  repositoryName?: string;
}

export function inferCommitScope(files: string[]): string | null {
  if (files.length === 0) return null;

  const scopes = files.map((file) => {
    const clean = file.replace(/^(apps\/[a-zA-Z0-9_-]+\/src\/|packages\/[a-zA-Z0-9_-]+\/src\/|src\/)/, '');
    const parts = clean.split('/');
    if (parts.length > 1) {
      return parts[0].toLowerCase();
    }
    const base = parts[0].split('.')[0].toLowerCase();
    return base;
  });

  const scopeCounts = new Map<string, number>();
  for (const s of scopes) {
    scopeCounts.set(s, (scopeCounts.get(s) ?? 0) + 1);
  }

  let dominantScope = scopes[0];
  let maxCount = 0;
  for (const [s, count] of scopeCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      dominantScope = s;
    }
  }

  return dominantScope || null;
}

export function generateSmartCommitMessage(input: CommitAssistantInput): CommitMessageResult {
  const { changedFiles, changedSymbols = [] } = input;

  if (changedFiles.length === 0) {
    const fallbackMessage = 'chore: empty commit with no detected changes';
    return {
      conventionalMessage: fallbackMessage,
      type: 'chore',
      scope: null,
      summary: 'empty commit with no detected changes',
      bullets: [],
      preview: fallbackMessage,
    };
  }

  const paths = changedFiles.map((f) => f.path);
  const scope = inferCommitScope(paths);

  const hasDocs = paths.every((p) => p.endsWith('.md') || p.startsWith('docs/'));
  const hasTestsOnly = paths.every((p) => p.includes('test') || p.includes('spec'));
  const hasAdded = changedFiles.some((f) => f.changeType === 'added');
  const hasDeletions = changedFiles.some((f) => f.changeType === 'deleted');
  const hasRenames = changedFiles.some((f) => f.changeType === 'renamed');

  let type = 'chore';
  if (hasDocs) {
    type = 'docs';
  } else if (hasTestsOnly) {
    type = 'test';
  } else if (hasAdded || changedSymbols.some((s) => s.isExported)) {
    type = 'feat';
  } else if (hasRenames || (hasDeletions && !hasAdded)) {
    type = 'refactor';
  } else {
    type = 'fix';
  }

  let summary = '';
  if (type === 'docs') {
    summary = `update documentation${scope ? ` for ${scope}` : ''}`;
  } else if (type === 'test') {
    summary = `add unit and integration tests${scope ? ` for ${scope}` : ''}`;
  } else if (type === 'feat') {
    const exportedSym = changedSymbols.find((s) => s.isExported);
    if (exportedSym) {
      summary = `implement ${exportedSym.name} in ${scope ?? 'core'}`;
    } else if (hasAdded) {
      const addedFile = changedFiles.find((f) => f.changeType === 'added')?.path.split('/').pop()?.split('.')[0];
      summary = `add ${addedFile ?? 'new capability'}${scope ? ` to ${scope}` : ''}`;
    } else {
      summary = `enhance ${scope ?? 'component'} functionality`;
    }
  } else if (type === 'refactor') {
    summary = `restructure ${scope ?? 'codebase'} components`;
  } else {
    const primarySym = changedSymbols[0]?.name;
    if (primarySym) {
      summary = `resolve issue in ${primarySym}`;
    } else {
      summary = `update ${scope ?? 'core'} logic`;
    }
  }

  const bullets: string[] = [];
  for (const f of changedFiles.slice(0, 10)) {
    const fileName = f.path.split('/').pop() ?? f.path;
    const relatedSymbols = changedSymbols.filter((s) => s.file === f.path).map((s) => s.name);

    if (f.changeType === 'added') {
      bullets.push(
        relatedSymbols.length > 0
          ? `- Add ${fileName} introducing ${relatedSymbols.join(', ')}`
          : `- Add ${fileName}`
      );
    } else if (f.changeType === 'deleted') {
      bullets.push(`- Remove deprecated ${fileName}`);
    } else if (f.changeType === 'renamed') {
      bullets.push(`- Rename ${f.oldPath ?? fileName} to ${fileName}`);
    } else {
      bullets.push(
        relatedSymbols.length > 0
          ? `- Update ${fileName} modifying ${relatedSymbols.join(', ')}`
          : `- Update ${fileName}`
      );
    }
  }

  if (changedFiles.length > 10) {
    bullets.push(`- Additional modifications across ${changedFiles.length - 10} files`);
  }

  const header = `${type}${scope ? `(${scope})` : ''}: ${summary}`;
  const conventionalMessage = `${header}\n\n${bullets.join('\n')}`;

  return {
    conventionalMessage,
    type,
    scope,
    summary,
    bullets,
    preview: conventionalMessage,
  };
}
