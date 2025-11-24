import { ProcessedData, RawNode, RawLink } from '../types';

export const generateDefaultData = (count: number = 200): ProcessedData => {
  const nodes: RawNode[] = [];
  const links: RawLink[] = [];

  for (let i = 0; i < count; i++) {
    nodes.push({
      id: `id_${i}`,
      name: `Gene-${i + 1}`,
      val: Math.random(),
    });
  }

  for (let i = 0; i < count; i++) {
    const neighborCount = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < neighborCount; k++) {
      const targetIndex = (i + 1 + k) % count;
      const score = Math.random();
      links.push({
        source: `id_${i}`,
        target: `id_${targetIndex}`,
        score: score,
      });
    }
  }

  return { nodes, links };
};

export const parseTSV = (text: string): ProcessedData | null => {
  const lines = text.trim().split('\n');
  const links: RawLink[] = [];
  const nodeSet = new Set<string>();
  let startIndex = 0;

  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    if (
      firstLine.includes('source') ||
      firstLine.includes('target') ||
      (firstLine.includes('gene') && firstLine.includes('gene'))
    ) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\t+/);

    if (parts.length >= 2) {
      const source = parts[0].trim();
      const target = parts[1].trim();
      let score = 0.5;

      if (parts.length >= 3) {
        const val = parseFloat(parts[2]);
        if (!isNaN(val)) score = val;
      }

      if (source && target) {
        links.push({ source, target, score });
        nodeSet.add(source);
        nodeSet.add(target);
      }
    }
  }

  const nodes: RawNode[] = Array.from(nodeSet).map((id) => ({ id: id, name: id }));
  
  if (nodes.length === 0) return null;
  return { nodes, links };
};
