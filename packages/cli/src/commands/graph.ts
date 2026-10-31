import { DevosApiClient } from '../api.js';

export interface GraphOptions {
  analysisId: string;
  apiUrl?: string;
  json?: boolean;
}

export async function runGraph(options: GraphOptions): Promise<number> {
  if (!options.analysisId) {
    process.stderr.write('Error: Analysis ID is required. Usage: devos graph <analysisId>\n');
    return 2;
  }

  const client = new DevosApiClient(options.apiUrl);
  const graph = await client.getGraph(options.analysisId);

  if (options.json) {
    process.stdout.write(JSON.stringify(graph, null, 2) + '\n');
    return 0;
  }

  process.stdout.write(`\nDependency Graph for Analysis: ${options.analysisId}\n`);
  process.stdout.write('--------------------------------------------------\n');
  process.stdout.write(`Nodes: ${graph.nodes?.length || 0}\n`);
  process.stdout.write(`Edges: ${graph.edges?.length || 0}\n\n`);

  if (graph.nodes && graph.nodes.length > 0) {
    process.stdout.write('Sample Nodes:\n');
    for (const n of graph.nodes.slice(0, 10)) {
      process.stdout.write(`  [${n.nodeType}] ${n.name} (${n.path || n.nodeKey})\n`);
    }
  }

  if (graph.edges && graph.edges.length > 0) {
    process.stdout.write('\nSample Relationships:\n');
    for (const e of graph.edges.slice(0, 10)) {
      process.stdout.write(`  ${e.from} --(${e.kind})--> ${e.to}\n`);
    }
  }
  process.stdout.write('\n');
  return 0;
}

