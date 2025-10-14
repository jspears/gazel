  import type { BazelTarget } from '@speajus/gazel-proto';

export function toFull(target: {package:string, name:string}, prefix = "//"): string {
    // If the package already contains a colon, it's likely a full target path
    if (target.package.includes(':')) {
        // Return as-is, just ensure it starts with //
        return target.package.startsWith('//') ? target.package : `${prefix}${target.package}`;
    }

    // Remove any leading // from package to avoid duplication
    const cleanPackage = target.package.startsWith('//')
        ? target.package.substring(2)
        : target.package;

    // Construct the full target path
    return `${prefix}${cleanPackage}:${target.name}`;
}

export function isExecutableTarget(target: BazelTarget): boolean {
    return /_(binary|test)$/.test(target.kind);
}
export function isTest(target: BazelTarget): boolean {
    return /_test$/.test(target.kind);
}
  
const outputPatterns = {
      'cc_binary': 'Executable binary file',
      'cc_library': 'Static library (.a) and/or shared library (.so)',
      'cc_test': 'Test executable',
      'py_binary': 'Python executable or .pex file',
      'py_library': 'Python source files and compiled .pyc files',
      'py_test': 'Python test executable',
      'java_binary': 'JAR file and/or executable wrapper',
      'java_library': 'JAR file with compiled classes',
      'java_test': 'Test JAR and test runner',
      'go_binary': 'Go executable',
      'go_library': 'Go archive file (.a)',
      'go_test': 'Go test executable',
      'rust_binary': 'Rust executable',
      'rust_library': 'Rust library (.rlib)',
      'proto_library': 'Protocol buffer descriptor sets',
      'filegroup': 'Collection of files',
      'genrule': 'Custom generated files defined by the rule'
    } as const;


    export   function getExpectedOutputs(ruleType: string): string {

    return outputPatterns[ruleType] || 'Target outputs';
  }