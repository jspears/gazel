/**
 * Utility functions for generating links to Bazel rule documentation
 */

interface RuleDocumentation {
  url: string;
  source: 'bazel' | 'rules_cc' | 'rules_python' | 'rules_go' | 'rules_rust' | 'rules_java' | 'rules_nodejs' | 'rules_proto' | 'aspect_rules_js' | 'aspect_rules_ts' | 'unknown';
}

/**
 * Get the documentation URL for a Bazel rule type
 */
export function getRuleDocumentationUrl(ruleKind: string): RuleDocumentation | null {
  if (!ruleKind) return null;

  // Remove 'rule' suffix if present (e.g., "cc_binary rule" -> "cc_binary")
  const ruleName = ruleKind.replace(/\s+rule$/, '').trim();

  // Built-in Bazel rules
  const bazelBuiltinRules: Record<string, string> = {
    'filegroup': 'https://bazel.build/reference/be/general#filegroup',
    'genrule': 'https://bazel.build/reference/be/general#genrule',
    'test_suite': 'https://bazel.build/reference/be/general#test_suite',
    'alias': 'https://bazel.build/reference/be/general#alias',
    'config_setting': 'https://bazel.build/reference/be/general#config_setting',
    'exports_files': 'https://bazel.build/reference/be/functions#exports_files',
    'glob': 'https://bazel.build/reference/be/functions#glob',
  };

  if (bazelBuiltinRules[ruleName]) {
    return { url: bazelBuiltinRules[ruleName], source: 'bazel' };
  }

  // C/C++ rules
  if (ruleName.startsWith('cc_')) {
    const ccRules: Record<string, string> = {
      'cc_binary': 'https://bazel.build/reference/be/c-cpp#cc_binary',
      'cc_library': 'https://bazel.build/reference/be/c-cpp#cc_library',
      'cc_test': 'https://bazel.build/reference/be/c-cpp#cc_test',
      'cc_import': 'https://bazel.build/reference/be/c-cpp#cc_import',
      'cc_proto_library': 'https://bazel.build/reference/be/c-cpp#cc_proto_library',
      'cc_toolchain': 'https://bazel.build/reference/be/c-cpp#cc_toolchain',
      'cc_toolchain_suite': 'https://bazel.build/reference/be/c-cpp#cc_toolchain_suite',
    };
    if (ccRules[ruleName]) {
      return { url: ccRules[ruleName], source: 'rules_cc' };
    }
  }

  // Python rules
  if (ruleName.startsWith('py_')) {
    const pyRules: Record<string, string> = {
      'py_binary': 'https://bazel.build/reference/be/python#py_binary',
      'py_library': 'https://bazel.build/reference/be/python#py_library',
      'py_test': 'https://bazel.build/reference/be/python#py_test',
      'py_runtime': 'https://bazel.build/reference/be/python#py_runtime',
    };
    if (pyRules[ruleName]) {
      return { url: pyRules[ruleName], source: 'rules_python' };
    }
  }

  // Java rules
  if (ruleName.startsWith('java_')) {
    const javaRules: Record<string, string> = {
      'java_binary': 'https://bazel.build/reference/be/java#java_binary',
      'java_library': 'https://bazel.build/reference/be/java#java_library',
      'java_test': 'https://bazel.build/reference/be/java#java_test',
      'java_import': 'https://bazel.build/reference/be/java#java_import',
      'java_plugin': 'https://bazel.build/reference/be/java#java_plugin',
      'java_proto_library': 'https://bazel.build/reference/be/java#java_proto_library',
    };
    if (javaRules[ruleName]) {
      return { url: javaRules[ruleName], source: 'rules_java' };
    }
  }

  // Shell rules
  if (ruleName.startsWith('sh_')) {
    const shRules: Record<string, string> = {
      'sh_binary': 'https://bazel.build/reference/be/shell#sh_binary',
      'sh_library': 'https://bazel.build/reference/be/shell#sh_library',
      'sh_test': 'https://bazel.build/reference/be/shell#sh_test',
    };
    if (shRules[ruleName]) {
      return { url: shRules[ruleName], source: 'bazel' };
    }
  }

  // Protocol Buffer rules
  if (ruleName.includes('proto')) {
    const protoRules: Record<string, string> = {
      'proto_library': 'https://bazel.build/reference/be/protocol-buffer#proto_library',
      'proto_lang_toolchain': 'https://bazel.build/reference/be/protocol-buffer#proto_lang_toolchain',
    };
    if (protoRules[ruleName]) {
      return { url: protoRules[ruleName], source: 'rules_proto' };
    }
  }

  // Go rules (rules_go)
  if (ruleName.startsWith('go_')) {
    const goRules: Record<string, string> = {
      'go_binary': 'https://github.com/bazelbuild/rules_go/blob/master/docs/go/core/rules.md#go_binary',
      'go_library': 'https://github.com/bazelbuild/rules_go/blob/master/docs/go/core/rules.md#go_library',
      'go_test': 'https://github.com/bazelbuild/rules_go/blob/master/docs/go/core/rules.md#go_test',
      'go_proto_library': 'https://github.com/bazelbuild/rules_go/blob/master/docs/go/core/rules.md#go_proto_library',
    };
    if (goRules[ruleName]) {
      return { url: goRules[ruleName], source: 'rules_go' };
    }
  }

  // Rust rules (rules_rust)
  if (ruleName.startsWith('rust_')) {
    const rustRules: Record<string, string> = {
      'rust_binary': 'https://bazelbuild.github.io/rules_rust/defs.html#rust_binary',
      'rust_library': 'https://bazelbuild.github.io/rules_rust/defs.html#rust_library',
      'rust_test': 'https://bazelbuild.github.io/rules_rust/defs.html#rust_test',
      'rust_proc_macro': 'https://bazelbuild.github.io/rules_rust/defs.html#rust_proc_macro',
    };
    if (rustRules[ruleName]) {
      return { url: rustRules[ruleName], source: 'rules_rust' };
    }
  }

  // Aspect Rules JS
  if (ruleName.startsWith('js_') || ruleName === 'npm_package') {
    const jsRules: Record<string, string> = {
      'js_library': 'https://docs.aspect.build/rulesets/aspect_rules_js/docs/js_library',
      'js_binary': 'https://docs.aspect.build/rulesets/aspect_rules_js/docs/js_binary',
      'js_test': 'https://docs.aspect.build/rulesets/aspect_rules_js/docs/js_test',
      'npm_package': 'https://docs.aspect.build/rulesets/aspect_rules_js/docs/npm_package',
    };
    if (jsRules[ruleName]) {
      return { url: jsRules[ruleName], source: 'aspect_rules_js' };
    }
  }

  // Aspect Rules TS
  if (ruleName.startsWith('ts_')) {
    const tsRules: Record<string, string> = {
      'ts_project': 'https://docs.aspect.build/rulesets/aspect_rules_ts/docs/ts_project',
      'ts_config': 'https://docs.aspect.build/rulesets/aspect_rules_ts/docs/tsconfig',
    };
    if (tsRules[ruleName]) {
      return { url: tsRules[ruleName], source: 'aspect_rules_ts' };
    }
  }

  // Vite rules
  if (ruleName.includes('vite')) {
    return {
      url: 'https://docs.aspect.build/rulesets/aspect_rules_js/docs/vite',
      source: 'aspect_rules_js'
    };
  }

  // Docker/Container rules
  if (ruleName.startsWith('container_') || ruleName.startsWith('oci_')) {
    const containerRules: Record<string, string> = {
      'container_image': 'https://github.com/bazelbuild/rules_docker#container_image',
      'container_push': 'https://github.com/bazelbuild/rules_docker#container_push',
      'oci_image': 'https://github.com/bazel-contrib/rules_oci/blob/main/docs/image.md',
      'oci_push': 'https://github.com/bazel-contrib/rules_oci/blob/main/docs/push.md',
    };
    if (containerRules[ruleName]) {
      return { url: containerRules[ruleName], source: 'unknown' };
    }
  }

  // Kotlin rules
  if (ruleName.startsWith('kt_')) {
    const ktRules: Record<string, string> = {
      'kt_jvm_binary': 'https://github.com/bazelbuild/rules_kotlin/blob/master/docs/kotlin.md#kt_jvm_binary',
      'kt_jvm_library': 'https://github.com/bazelbuild/rules_kotlin/blob/master/docs/kotlin.md#kt_jvm_library',
      'kt_jvm_test': 'https://github.com/bazelbuild/rules_kotlin/blob/master/docs/kotlin.md#kt_jvm_test',
    };
    if (ktRules[ruleName]) {
      return { url: ktRules[ruleName], source: 'unknown' };
    }
  }

  // Scala rules
  if (ruleName.startsWith('scala_')) {
    const scalaRules: Record<string, string> = {
      'scala_binary': 'https://github.com/bazelbuild/rules_scala#scala_binary',
      'scala_library': 'https://github.com/bazelbuild/rules_scala#scala_library',
      'scala_test': 'https://github.com/bazelbuild/rules_scala#scala_test',
    };
    if (scalaRules[ruleName]) {
      return { url: scalaRules[ruleName], source: 'unknown' };
    }
  }

  // If no specific documentation found, return null
  return null;
}

/**
 * Get a human-readable source name for the rule
 */
export function getRuleSourceName(source: RuleDocumentation['source']): string {
  const sourceNames: Record<RuleDocumentation['source'], string> = {
    'bazel': 'Bazel',
    'rules_cc': 'C/C++ Rules',
    'rules_python': 'Python Rules',
    'rules_go': 'Go Rules',
    'rules_rust': 'Rust Rules',
    'rules_java': 'Java Rules',
    'rules_nodejs': 'Node.js Rules',
    'rules_proto': 'Protocol Buffer Rules',
    'aspect_rules_js': 'Aspect Rules JS',
    'aspect_rules_ts': 'Aspect Rules TS',
    'unknown': 'Unknown',
  };
  return sourceNames[source] || 'Unknown';
}

