/**
 * Tests for target-util.ts
 * 
 * Run with: node --loader tsx client/components/target-util.test.ts
 */

import { toFull } from './target-util.js';

interface TestCase {
  name: string;
  input: { package: string; name: string };
  expected: string;
}

const testCases: TestCase[] = [
  {
    name: 'Normal package + name',
    input: { package: 'services/api', name: 'server' },
    expected: '//services/api:server'
  },
  {
    name: 'Package with leading //',
    input: { package: '//services/api', name: 'server' },
    expected: '//services/api:server'
  },
  {
    name: 'Package is already full target path',
    input: { package: '//services/api:server', name: 'unused' },
    expected: '//services/api:server'
  },
  {
    name: 'Package is full target path without //',
    input: { package: 'services/api:server', name: 'unused' },
    expected: '//services/api:server'
  },
  {
    name: 'Empty package (root)',
    input: { package: '', name: 'server' },
    expected: '//:server'
  },
  {
    name: 'Complex nested package',
    input: { package: 'services/request_insight/example_exporter', name: 'image.layer' },
    expected: '//services/request_insight/example_exporter:image.layer'
  },
  {
    name: 'Complex nested package with //',
    input: { package: '//services/request_insight/example_exporter', name: 'image.layer' },
    expected: '//services/request_insight/example_exporter:image.layer'
  },
  {
    name: 'Full target path with complex name',
    input: { package: '//services/request_insight/example_exporter:image', name: 'layer' },
    expected: '//services/request_insight/example_exporter:image'
  }
];

function runTests() {
  console.log('Running toFull() tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    const result = toFull(testCase.input);
    const success = result === testCase.expected;
    
    if (success) {
      console.log(`✅ ${testCase.name}`);
      console.log(`   Input: { package: "${testCase.input.package}", name: "${testCase.input.name}" }`);
      console.log(`   Result: "${result}"`);
      passed++;
    } else {
      console.log(`❌ ${testCase.name}`);
      console.log(`   Input: { package: "${testCase.input.package}", name: "${testCase.input.name}" }`);
      console.log(`   Expected: "${testCase.expected}"`);
      console.log(`   Got: "${result}"`);
      failed++;
    }
    console.log('');
  }
  
  console.log('='.repeat(50));
  console.log(`Total: ${testCases.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(50));
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };

