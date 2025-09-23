import xml2js from 'xml2js';
import { promisify } from 'util';
import type { BazelTarget, BazelQueryResult, ParsedTarget } from '../types/index.js';

const parseXml = promisify(xml2js.parseString);

interface XmlRule {
  name?: string;
  class?: string;
  location?: string;
  string?: any[];
  list?: any[];
  boolean?: any[];
  integer?: any[];
  ruleinput?: any[];
  ruleoutput?: any[];
}

interface XmlSourceFile {
  name?: string;
  location?: string;
  visibilitylabel?: any;
}

interface XmlGeneratedFile {
  name?: string;
  location?: string;
  generatingrule?: string;
}

interface XmlPackageGroup {
  name?: string;
  location?: string;
  packagespecs?: any;
  includes?: any;
}

interface XmlQuery {
  rule?: XmlRule | XmlRule[];
  sourcefile?: XmlSourceFile | XmlSourceFile[];
  generatedfile?: XmlGeneratedFile | XmlGeneratedFile[];
  packagegroup?: XmlPackageGroup | XmlPackageGroup[];
}

class ParserService {
  /**
   * Parse XML output from Bazel query
   */
  async parseXmlOutput(xmlString: string): Promise<BazelQueryResult> {
    try {
      const result = await parseXml(xmlString, {
        explicitArray: false,
        mergeAttrs: true,
        normalizeTags: true
      });
      
      return this.transformXmlResult(result);
    } catch (error: any) {
      console.error('Failed to parse XML:', error);
      throw new Error(`Failed to parse Bazel XML output: ${error.message}`);
    }
  }

  /**
   * Transform parsed XML to a more usable format
   */
  private transformXmlResult(result: any): BazelQueryResult {
    if (!result || !result.query) {
      return { targets: [] };
    }

    const query: XmlQuery = result.query;
    const targets: BazelTarget[] = [];

    // Handle different rule types
    if (query.rule) {
      const rules = Array.isArray(query.rule) ? query.rule : [query.rule];
      rules.forEach(rule => {
        targets.push(this.parseRule(rule));
      });
    }

    // Handle source files
    if (query.sourcefile) {
      const files = Array.isArray(query.sourcefile) ? query.sourcefile : [query.sourcefile];
      files.forEach(file => {
        targets.push(this.parseSourceFile(file));
      });
    }

    // Handle generated files
    if (query.generatedfile) {
      const files = Array.isArray(query.generatedfile) ? query.generatedfile : [query.generatedfile];
      files.forEach(file => {
        targets.push(this.parseGeneratedFile(file));
      });
    }

    // Handle package groups
    if (query.packagegroup) {
      const groups = Array.isArray(query.packagegroup) ? query.packagegroup : [query.packagegroup];
      groups.forEach(group => {
        targets.push(this.parsePackageGroup(group));
      });
    }

    return { targets };
  }

  /**
   * Parse a rule element
   */
  private parseRule(rule: XmlRule): BazelTarget {
    const target: BazelTarget = {
      type: 'rule',
      name: rule.name || '',
      class: rule.class,
      location: rule.location,
      attributes: {}
    };

    // Parse attributes
    if (rule.string) {
      const strings = Array.isArray(rule.string) ? rule.string : [rule.string];
      strings.forEach(attr => {
        if (target.attributes) {
          target.attributes[attr.name] = attr.value || attr._;
        }
      });
    }

    if (rule.list) {
      const lists = Array.isArray(rule.list) ? rule.list : [rule.list];
      lists.forEach(attr => {
        const values: string[] = [];
        if (attr.label) {
          const labels = Array.isArray(attr.label) ? attr.label : [attr.label];
          labels.forEach((label: any) => {
            values.push(label.value || label);
          });
        }
        if (target.attributes) {
          target.attributes[attr.name] = values;
        }
      });
    }

    if (rule.boolean) {
      const booleans = Array.isArray(rule.boolean) ? rule.boolean : [rule.boolean];
      booleans.forEach(attr => {
        if (target.attributes) {
          target.attributes[attr.name] = attr.value === 'true';
        }
      });
    }

    if (rule.integer) {
      const integers = Array.isArray(rule.integer) ? rule.integer : [rule.integer];
      integers.forEach(attr => {
        if (target.attributes) {
          target.attributes[attr.name] = parseInt(attr.value, 10);
        }
      });
    }

    // Parse rule inputs and outputs
    if (rule.ruleinput) {
      const inputs = Array.isArray(rule.ruleinput) ? rule.ruleinput : [rule.ruleinput];
      target.inputs = inputs.map(input => input.name || input);
    }

    if (rule.ruleoutput) {
      const outputs = Array.isArray(rule.ruleoutput) ? rule.ruleoutput : [rule.ruleoutput];
      target.outputs = outputs.map(output => output.name || output);
    }

    return target;
  }

  /**
   * Parse a source file element
   */
  private parseSourceFile(file: XmlSourceFile): BazelTarget {
    return {
      type: 'source_file',
      name: file.name || '',
      location: file.location,
      attributes: {
        visibility: this.parseVisibility(file.visibilitylabel)
      }
    };
  }

  /**
   * Parse a generated file element
   */
  private parseGeneratedFile(file: XmlGeneratedFile): BazelTarget {
    return {
      type: 'generated_file',
      name: file.name || '',
      location: file.location,
      attributes: {
        generatingRule: file.generatingrule
      }
    };
  }

  /**
   * Parse a package group element
   */
  private parsePackageGroup(group: XmlPackageGroup): BazelTarget {
    return {
      type: 'package_group',
      name: group.name || '',
      location: group.location,
      attributes: {
        packages: this.parsePackageSpecs(group.packagespecs),
        includes: this.parseIncludes(group.includes)
      }
    };
  }

  /**
   * Parse visibility labels
   */
  private parseVisibility(visibilityLabel: any): string[] {
    if (!visibilityLabel) return [];
    
    const labels = Array.isArray(visibilityLabel) ? visibilityLabel : [visibilityLabel];
    return labels.map((label: any) => label.name || label);
  }

  /**
   * Parse package specs
   */
  private parsePackageSpecs(specs: any): string[] {
    if (!specs || !specs.packagespec) return [];
    
    const packageSpecs = Array.isArray(specs.packagespec) ? specs.packagespec : [specs.packagespec];
    return packageSpecs.map((spec: any) => spec.value || spec);
  }

  /**
   * Parse includes
   */
  private parseIncludes(includes: any): string[] {
    if (!includes || !includes.label) return [];
    
    const labels = Array.isArray(includes.label) ? includes.label : [includes.label];
    return labels.map((label: any) => label.value || label);
  }

  /**
   * Parse label output (simple list of targets)
   */
  parseLabelOutput(output: string): ParsedTarget[] {
    const lines = output.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const trimmed = line.trim();
      // Parse target format: //package:target
      const match = trimmed.match(/^(\/\/[^:]+):(.+)$/);
      if (match) {
        return {
          package: match[1],
          target: match[2],
          full: trimmed
        };
      }
      return { full: trimmed };
    });
  }

  /**
   * Parse label_kind output (target with rule type)
   */
  parseLabelKindOutput(output: string): ParsedTarget[] {
    const lines = output.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const trimmed = line.trim();

      // Parse format: rule_type rule //package:target or rule_type rule //:target (for root package)
      // The target path is everything after "rule "
      const ruleMatch = trimmed.match(/^(\S+)\s+rule\s+(.+)$/);
      if (ruleMatch) {
        const ruleType = ruleMatch[1];
        const fullTarget = ruleMatch[2];

        // Parse the full target path
        // Handle both //package:target and //:target formats
        const targetMatch = fullTarget.match(/^(\/\/[^:]*):(.+)$/);
        if (targetMatch) {
          return {
            ruleType: ruleType,
            package: targetMatch[1],
            target: targetMatch[2],
            full: fullTarget,
            name: targetMatch[2]  // Add name field for compatibility
          };
        } else {
          // If we can't parse it, return the full target as-is
          return {
            ruleType: ruleType,
            full: fullTarget,
            name: fullTarget
          };
        }
      }

      // Try to parse source file format
      const sourceMatch = trimmed.match(/^source file\s+(\/\/.+)$/);
      if (sourceMatch) {
        return {
          ruleType: 'source_file',
          full: sourceMatch[1],
          name: sourceMatch[1]
        };
      }

      // Try to parse generated file format
      const genMatch = trimmed.match(/^generated file\s+(\/\/.+)$/);
      if (genMatch) {
        return {
          ruleType: 'generated_file',
          full: genMatch[1],
          name: genMatch[1]
        };
      }

      return {
        full: trimmed,
        name: trimmed
      };
    });
  }

  /**
   * Parse build file content
   */
  parseBuildFile(content: string): Array<{ruleType: string; name: string; line: number}> {
    const targets: Array<{ruleType: string; name: string; line: number}> = [];
    const lines = content.split('\n');
    
    // Simple regex-based parsing for common rule patterns
    const rulePattern = /^(\w+)\s*\(\s*name\s*=\s*["']([^"']+)["']/;
    
    lines.forEach((line, index) => {
      const match = line.match(rulePattern);
      if (match) {
        targets.push({
          ruleType: match[1],
          name: match[2],
          line: index + 1
        });
      }
    });
    
    return targets;
  }
}

export default new ParserService();
