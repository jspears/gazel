import * as sax from 'sax';
import { Transform } from 'stream';

export interface BazelRule {
  name: string;
  class: string;
  location?: string;
  dependencies?: string[];
  srcs?: string[];
  hdrs?: string[];
  visibility?: string[];
  outputs?: string[];
}

export interface ParsedDependencyData {
  rules: BazelRule[];
  edges: Array<{ source: string; target: string }>;
}

/**
 * Creates a streaming XML to JSON transformer for Bazel query output
 */
export function createXmlToJsonStream(): Transform {
  const parser = sax.createStream(true, {
    trim: true,
    normalize: true,
    lowercase: true
  });

 

  let currentRule: Partial<BazelRule> | null = null;

  // Track if we've started sending data
  let hasStarted = false;

  const transform = new Transform({
    writableObjectMode: false,
    readableObjectMode: false,
    transform(chunk, _encoding, callback) {
      // Pass the chunk to the SAX parser
      parser.write(chunk);
      callback();
    },
    flush(callback) {
      // End the SAX parser
      parser.end();
      
      // Send the final closing bracket
      this.push('\n]');
      callback();
    }
  });

  parser.on('opentag', (node) => {
    if (node.name === 'rule') {
      currentRule = {
        name: node.attributes.name as string,
        class: node.attributes.class as string,
        location: node.attributes.location as string,
        dependencies: []
      };
    } else if (node.name === 'rule-input' && currentRule) {
      // rule-input has a name attribute with the dependency
      const source = node.attributes.name as string;

      if (source) {
        // Add dependency
        if (!currentRule.dependencies) {
          currentRule.dependencies = [];
        }
        currentRule.dependencies.push(source);

        // Also emit an edge
        if (currentRule.name) {
          if (!hasStarted) {
            transform.push('[\n');
            hasStarted = true;
          } else {
            transform.push(',\n');
          }

          transform.push(JSON.stringify({
            type: 'edge',
            data: {
              source: source,
              target: currentRule.name
            }
          }));
        }
      }
    }
  });

  parser.on('closetag', (tagName) => {
    if (tagName === 'rule' && currentRule && currentRule.name) {
      // Send the rule as JSON
      if (!hasStarted) {
        transform.push('[\n');
        hasStarted = true;
      } else {
        transform.push(',\n');
      }

      transform.push(JSON.stringify({
        type: 'rule',
        data: currentRule
      }));

      currentRule = null;
    }
  });

  parser.on('error', (err) => {
    transform.destroy(err);
  });

  // Pipe the transform to the parser
  transform.on('pipe', () => {
    // Initialize the JSON array when piping starts
    if (!hasStarted) {
      transform.push('[\n');
      hasStarted = true;
    }
  });

  return transform;
}

/**
 * Creates a streaming XML to simplified JSON transformer
 * This version outputs a more compact format suitable for the frontend
 */
export function createCompactXmlToJsonStream(): Transform {
  const parser = sax.createStream(true, {
    trim: true,
    normalize: true,
    lowercase: true
  });

  let currentRule: Partial<BazelRule> | null = null;
  let currentText = '';
  
  // Track unique rules and edges to avoid duplicates
  const seenRules = new Set<string>();
  const seenEdges = new Set<string>();
  
  // Track if we've started sending data
  let needsComma = false;

  const transform = new Transform({
    writableObjectMode: false,
    readableObjectMode: false,
    transform(chunk, _encoding, callback) {
      parser.write(chunk);
      callback();
    },
    flush(callback) {
      parser.end();
      
      // Close the JSON structure
      this.push('\n  ],\n  "edges": [\n');
      
      // Note: Edges were already sent inline, so we just close the array
      this.push('  ]\n}');
      callback();
    }
  });

  // Start the JSON structure
  transform.push('{\n  "rules": [\n');

  parser.on('opentag', (node) => {
    
    if (node.name === 'rule') {
      const ruleName = node.attributes.name as string;
      
      if (!seenRules.has(ruleName)) {
        seenRules.add(ruleName);
        
        currentRule = {
          name: ruleName,
          class: node.attributes.class as string,
          location: node.attributes.location as string,
          dependencies: []
        };
        
        // Output the rule
        if (needsComma) {
          transform.push(',\n');
        }
        transform.push('    ' + JSON.stringify({
          name: currentRule.name,
          class: currentRule.class,
          location: currentRule.location
        }));
        needsComma = true;
      } else {
        currentRule = { name: ruleName };
      }
    }
  });

  parser.on('text', (text) => {
    if (text.trim()) {
      currentText += text;
    }
  });

  parser.on('closetag', (tagName) => {
    if (tagName === 'rule') {
      currentRule = null;
    } else if (tagName === 'rule-input' && currentRule && currentText) {
      const source = currentText.trim();
      const target = currentRule.name!;
      const edgeKey = `${source}->${target}`;
      
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        // We'll collect edges and output them at the end
        // For now, just track them
      }
      
      currentText = '';
    }
    
  });

  parser.on('error', (err) => {
    transform.destroy(err);
  });

  return transform;
}

/**
 * Parse XML string to JSON (non-streaming version for smaller inputs)
 */
export function parseXmlToJson(xmlString: string): Promise<ParsedDependencyData> {
  return new Promise((resolve, reject) => {
    const parser = sax.parser(true, {
      trim: true,
      normalize: true,
      lowercase: true
    });

    const result: ParsedDependencyData = {
      rules: [],
      edges: []
    };

    let currentRule: Partial<BazelRule> | null = null;
    const seenRules = new Set<string>();

    parser.onopentag = (node) => {
      if (node.name === 'rule') {
        const ruleName = node.attributes.name as string;

        if (!seenRules.has(ruleName)) {
          seenRules.add(ruleName);
          currentRule = {
            name: ruleName,
            class: node.attributes.class as string,
            location: node.attributes.location as string,
            dependencies: []
          };
          result.rules.push(currentRule as BazelRule);
        } else {
          // Find existing rule
          currentRule = result.rules.find(r => r.name === ruleName) || null;
        }
      } else if (node.name === 'rule-input' && currentRule) {
        // rule-input has a name attribute with the dependency
        const source = node.attributes.name as string;

        if (source) {
          if (!currentRule.dependencies) {
            currentRule.dependencies = [];
          }
          currentRule.dependencies.push(source);

          result.edges.push({
            source: source,
            target: currentRule.name!
          });
        }
      }
    };

    parser.onclosetag = (tagName) => {
      if (tagName === 'rule') {
        currentRule = null;
      }
    };

    parser.onerror = (err) => {
      reject(err);
    };

    parser.onend = () => {
      resolve(result);
    };

    parser.write(xmlString).close();
  });
}
