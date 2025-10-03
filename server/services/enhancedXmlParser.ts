import * as sax from 'sax';
import { Transform } from 'node:stream';

export interface EnhancedBazelRule {
  name: string;
  class: string;
  location?: string;
  deps?: string[];        // From <list name="deps">
  srcs?: string[];        // From <list name="srcs">
  hdrs?: string[];        // From <list name="hdrs">
  visibility?: string[];  // From <list name="visibility">
  inputs?: string[];      // From <rule-input>
  outputs?: string[];     // From <rule-output>
  attributes?: Record<string, any>; // Other attributes
}

export interface EnhancedDependencyData {
  rules: EnhancedBazelRule[];
  edges: Array<{
    source: string;
    target: string;
    type: 'deps' | 'srcs' | 'hdrs' | 'input' | 'output';
  }>;
}

/**
 * Enhanced parser that extracts more detailed information from Bazel XML
 */
export function parseEnhancedXmlToJson(xmlString: string): Promise<EnhancedDependencyData> {
  return new Promise((resolve, reject) => {
    const parser = sax.parser(true, {
      trim: true,
      normalize: true,
      lowercase: true
    });

    const result: EnhancedDependencyData = {
      rules: [],
      edges: []
    };

    let currentRule: EnhancedBazelRule | null = null;
    let currentList: string | null = null;
    let inList = false;

    parser.onopentag = (node) => {

      if (node.name === 'rule') {
        // Start a new rule
        currentRule = {
          name: node.attributes.name as string,
          class: node.attributes.class as string,
          location: node.attributes.location as string,
          deps: [],
          srcs: [],
          hdrs: [],
          visibility: [],
          inputs: [],
          outputs: [],
          attributes: {}
        };
        result.rules.push(currentRule);
      } else if (node.name === 'list' && currentRule) {
        // Track which list we're in
        currentList = node.attributes.name as string;
        inList = true;
      } else if (node.name === 'label' && inList && currentList && currentRule) {
        // Extract label values from lists
        const value = node.attributes.value as string;
        
        switch (currentList) {
          case 'deps':
            currentRule.deps!.push(value);
            // Create dependency edge
            result.edges.push({
              source: value,
              target: currentRule.name,
              type: 'deps'
            });
            break;
          case 'srcs':
            currentRule.srcs!.push(value);
            result.edges.push({
              source: value,
              target: currentRule.name,
              type: 'srcs'
            });
            break;
          case 'hdrs':
            currentRule.hdrs!.push(value);
            result.edges.push({
              source: value,
              target: currentRule.name,
              type: 'hdrs'
            });
            break;
          case 'visibility':
            currentRule.visibility!.push(value);
            break;
          default:
            // Store other lists in attributes
            if (!currentRule.attributes![currentList]) {
              currentRule.attributes![currentList] = [];
            }
            currentRule.attributes![currentList].push(value);
        }
      } else if (node.name === 'string' && currentRule) {
        // Store string attributes
        const name = node.attributes.name as string;
        const value = node.attributes.value as string;
        currentRule.attributes![name] = value;
      } else if (node.name === 'rule-input' && currentRule) {
        // Handle rule inputs
        const inputName = node.attributes.name as string;
        if (inputName) {
          currentRule.inputs!.push(inputName);
          
          // Only create edges for non-tool inputs
          if (!inputName.startsWith('@bazel_tools') && 
              !inputName.startsWith('@@platforms')) {
            result.edges.push({
              source: inputName,
              target: currentRule.name,
              type: 'input'
            });
          }
        }
      } else if (node.name === 'rule-output' && currentRule) {
        // Handle rule outputs
        const outputName = node.attributes.name as string;
        if (outputName) {
          currentRule.outputs!.push(outputName);
          result.edges.push({
            source: currentRule.name,
            target: outputName,
            type: 'output'
          });
        }
      }
    };

    parser.onclosetag = (tagName) => {
      if (tagName === 'rule') {
        // Clean up empty arrays
        if (currentRule) {
          if (currentRule.deps?.length === 0) delete currentRule.deps;
          if (currentRule.srcs?.length === 0) delete currentRule.srcs;
          if (currentRule.hdrs?.length === 0) delete currentRule.hdrs;
          if (currentRule.visibility?.length === 0) delete currentRule.visibility;
          if (currentRule.inputs?.length === 0) delete currentRule.inputs;
          if (currentRule.outputs?.length === 0) delete currentRule.outputs;
          if (Object.keys(currentRule.attributes!).length === 0) delete currentRule.attributes;
        }
        currentRule = null;
      } else if (tagName === 'list') {
        currentList = null;
        inList = false;
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

/**
 * Create a streaming enhanced XML parser
 */
export function createEnhancedXmlStream(): Transform {
  const parser = sax.createStream(true, {
    trim: true,
    normalize: true,
    lowercase: true
  });

  let currentRule: EnhancedBazelRule | null = null;
  let currentList: string | null = null;
  let inList = false;
  let hasStarted = false;

  const transform = new Transform({
    writableObjectMode: false,
    readableObjectMode: false,
    transform(chunk, _encoding, callback) {
      parser.write(chunk);
      callback();
    },
    flush(callback) {
      parser.end();
      this.push('\n]}');
      callback();
    }
  });

  // Start JSON structure
  transform.push('{"rules":[');

  parser.on('opentag', (node) => {
    if (node.name === 'rule') {
      currentRule = {
        name: node.attributes.name as string,
        class: node.attributes.class as string,
        location: node.attributes.location as string,
        deps: [],
        srcs: [],
        hdrs: [],
        visibility: [],
        inputs: [],
        outputs: [],
        attributes: {}
      };
    } else if (node.name === 'list' && currentRule) {
      currentList = node.attributes.name as string;
      inList = true;
    } else if (node.name === 'label' && inList && currentList && currentRule) {
      const value = node.attributes.value as string;
      
      switch (currentList) {
        case 'deps':
          currentRule.deps!.push(value);
          break;
        case 'srcs':
          currentRule.srcs!.push(value);
          break;
        case 'hdrs':
          currentRule.hdrs!.push(value);
          break;
        case 'visibility':
          currentRule.visibility!.push(value);
          break;
        default:
          if (!currentRule.attributes![currentList]) {
            currentRule.attributes![currentList] = [];
          }
          currentRule.attributes![currentList].push(value);
      }
    } else if (node.name === 'string' && currentRule) {
      const name = node.attributes.name as string;
      const value = node.attributes.value as string;
      currentRule.attributes![name] = value;
    } else if (node.name === 'rule-input' && currentRule) {
      const inputName = node.attributes.name as string;
      if (inputName && !inputName.startsWith('@bazel_tools') && 
          !inputName.startsWith('@@platforms')) {
        currentRule.inputs!.push(inputName);
      }
    } else if (node.name === 'rule-output' && currentRule) {
      const outputName = node.attributes.name as string;
      if (outputName) {
        currentRule.outputs!.push(outputName);
      }
    }
  });

  parser.on('closetag', (tagName) => {
    if (tagName === 'rule' && currentRule) {
      // Clean up empty arrays
      if (currentRule.deps?.length === 0) delete currentRule.deps;
      if (currentRule.srcs?.length === 0) delete currentRule.srcs;
      if (currentRule.hdrs?.length === 0) delete currentRule.hdrs;
      if (currentRule.visibility?.length === 0) delete currentRule.visibility;
      if (currentRule.inputs?.length === 0) delete currentRule.inputs;
      if (currentRule.outputs?.length === 0) delete currentRule.outputs;
      if (Object.keys(currentRule.attributes!).length === 0) delete currentRule.attributes;

      // Emit the rule
      if (hasStarted) {
        transform.push(',\n');
      }
      transform.push(JSON.stringify(currentRule));
      hasStarted = true;
      
      currentRule = null;
    } else if (tagName === 'list') {
      currentList = null;
      inList = false;
    }
  });

  parser.on('error', (err) => {
    transform.destroy(err);
  });

  // When we start getting edges, switch to edges array
  let edgesStarted = false;
  parser.on('closetag', (tagName) => {
    if (tagName === 'query' && !edgesStarted) {
      transform.push('],\n"edges":[');
      edgesStarted = true;
    }
  });

  return transform;
}
