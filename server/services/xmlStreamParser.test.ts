import { parseXmlToJson } from './xmlStreamParser.js';

// Sample Bazel XML output
const sampleXml = `<?xml version="1.1" encoding="UTF-8" standalone="no"?>
<query version="2">
  <rule class="cc_library" location="/Users/test/project/lib/BUILD.bazel:1:1" name="//lib:math">
    <string name="name" value="math"/>
    <list name="srcs">
      <label value="//lib:math.cc"/>
    </list>
    <list name="hdrs">
      <label value="//lib:math.h"/>
    </list>
    <rule-input name="//lib:math.cc"/>
    <rule-input name="//lib:math.h"/>
  </rule>
  <rule class="cc_library" location="/Users/test/project/lib/BUILD.bazel:8:1" name="//lib:advanced_math">
    <string name="name" value="advanced_math"/>
    <list name="deps">
      <label value="//lib:math"/>
    </list>
    <rule-input name="//lib:math"/>
    <rule-input name="//lib:advanced_math.cc"/>
    <rule-input name="//lib:advanced_math.h"/>
  </rule>
  <rule class="cc_binary" location="/Users/test/project/app/BUILD.bazel:1:1" name="//app:main">
    <string name="name" value="main"/>
    <list name="deps">
      <label value="//lib:advanced_math"/>
      <label value="//lib:math"/>
    </list>
    <rule-input name="//lib:advanced_math"/>
    <rule-input name="//lib:math"/>
    <rule-input name="//app:main.cc"/>
  </rule>
</query>`;

async function testParser() {
  console.log('Testing XML Stream Parser...\n');
  
  try {
    const result = await parseXmlToJson(sampleXml);
    
    console.log('Parsed Rules:');
    console.log('=============');
    result.rules.forEach(rule => {
      console.log(`- ${rule.name} (${rule.class})`);
      if (rule.dependencies && rule.dependencies.length > 0) {
        console.log(`  Dependencies: ${rule.dependencies.join(', ')}`);
      }
    });
    
    console.log('\nParsed Edges:');
    console.log('=============');
    result.edges.forEach(edge => {
      console.log(`- ${edge.source} -> ${edge.target}`);
    });
    
    console.log('\nSummary:');
    console.log('=========');
    console.log(`Total rules: ${result.rules.length}`);
    console.log(`Total edges: ${result.edges.length}`);
    
    // Verify expected results
    const expectedRules = 3;
    const expectedEdges = 8; // Based on the rule-input elements
    
    if (result.rules.length === expectedRules) {
      console.log(`✓ Rule count matches expected (${expectedRules})`);
    } else {
      console.log(`✗ Rule count mismatch. Expected ${expectedRules}, got ${result.rules.length}`);
    }
    
    if (result.edges.length === expectedEdges) {
      console.log(`✓ Edge count matches expected (${expectedEdges})`);
    } else {
      console.log(`✗ Edge count mismatch. Expected ${expectedEdges}, got ${result.edges.length}`);
    }
    
  } catch (error) {
    console.error('Parser test failed:', error);
  }
}

// Run the test
testParser();
