/**
 * Parse XML string to JavaScript object using browser's DOMParser
 */
export function parseXmlString(xml: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');

      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        reject(new Error('XML parsing error: ' + parserError.textContent));
        return;
      }

      // Convert XML DOM to JavaScript object
      const result = xmlToJs(xmlDoc.documentElement);
      resolve({ query: result });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convert XML DOM to JavaScript object
 */
function xmlToJs(node: Element): any {
  const obj: any = {};

  // Handle attributes
  if (node.attributes && node.attributes.length > 0) {
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      obj[attr.name] = attr.value;
    }
  }

  // Handle child nodes
  if (node.childNodes && node.childNodes.length > 0) {
    const children: any = {};

    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];

      if (child.nodeType === Node.ELEMENT_NODE) {
        const element = child as Element;
        const tagName = element.tagName.toLowerCase();

        const childObj = xmlToJs(element);

        if (children[tagName]) {
          // Convert to array if multiple elements with same tag
          if (!Array.isArray(children[tagName])) {
            children[tagName] = [children[tagName]];
          }
          children[tagName].push(childObj);
        } else {
          children[tagName] = childObj;
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) {
          obj.value = text;
        }
      }
    }

    // Merge children into object
    Object.assign(obj, children);
  }

  return obj;
}

/**
 * Extract dependency information from parsed Bazel XML
 */
export function extractDependencyGraph(parsedXml: any): {
  nodes: Array<{ id: string; label: string; type: string; }>;
  edges: Array<{ source: string; target: string; }>;
} {
  const nodes: Array<{ id: string; label: string; type: string; }> = [];
  const edges: Array<{ source: string; target: string; }> = [];
  const nodeSet = new Set<string>();
  
  if (!parsedXml.query) {
    return { nodes, edges };
  }
  
  const rules = Array.isArray(parsedXml.query.rule) 
    ? parsedXml.query.rule 
    : parsedXml.query.rule 
    ? [parsedXml.query.rule]
    : [];
  
  // Process each rule
  rules.forEach((rule: any) => {
    if (!rule.name) return;
    
    // Add node if not already present
    if (!nodeSet.has(rule.name)) {
      nodeSet.add(rule.name);
      nodes.push({
        id: rule.name,
        label: formatTargetLabel(rule.name),
        type: rule.class || 'unknown'
      });
    }
    
    // Extract dependencies
    if (rule.list) {
      const lists = Array.isArray(rule.list) ? rule.list : [rule.list];
      lists.forEach((list: any) => {
        if (list.name === 'deps' && list.label) {
          const labels = Array.isArray(list.label) ? list.label : [list.label];
          labels.forEach((label: any) => {
            const depName = label.value || label;
            if (typeof depName === 'string') {
              // Add dependency node if not present
              if (!nodeSet.has(depName)) {
                nodeSet.add(depName);
                nodes.push({
                  id: depName,
                  label: formatTargetLabel(depName),
                  type: 'dependency'
                });
              }
              
              // Add edge
              edges.push({
                source: rule.name,
                target: depName
              });
            }
          });
        }
      });
    }
  });
  
  return { nodes, edges };
}

/**
 * Format a Bazel target label for display
 */
function formatTargetLabel(fullName: string): string {
  // Remove leading // and show only the target name for brevity
  const parts = fullName.split(':');
  if (parts.length > 1) {
    const targetName = parts[parts.length - 1];
    const packagePath = parts[0].replace(/^\/\//, '').split('/').pop();
    return `${packagePath}:${targetName}`;
  }
  return fullName.replace(/^\/\//, '');
}
