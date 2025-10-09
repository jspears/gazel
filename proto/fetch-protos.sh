#!/bin/bash
# Script to fetch Bazel proto files for gRPC stub generation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO_DIR="$SCRIPT_DIR/bazel-protos"
BAZEL_VERSION="8.4.2"

echo "Creating proto directory..."
mkdir -p "$PROTO_DIR/bazel"

echo "Fetching Bazel proto files..."

function fetch_proto() {
  name=$1
  outdir="$PROTO_DIR/$(dirname "$name")"
  if [ ! -f "$PROTO_DIR/$name" ]; then
    mkdir -p "$outdir"
    echo "Fetching $name into $PROTO_DIR/$name ..."
    url="https://raw.githubusercontent.com/bazelbuild/bazel/refs/tags/$BAZEL_VERSION/$name"
    echo "Fetching $url into $PROTO_DIR/$name ..."
    curl -L $url > "$PROTO_DIR/$name"

    for file in $(grep -E 'import ".*\.proto";' "$PROTO_DIR/$name" | sed 's/import "\(.*\.proto\)";/\1/' | grep -v 'google/'); do
      fetch_proto  ${file}
    done
  fi
}
FILES=("build" "stardoc_output")

#    "action_cache"
#    "bazel_flags"
#    "builtin"
#    "crash_debugging"
#    "crosstool_config"
#    "deps"
#    "desugar_deps"
#    "execution_statistics"
#    "extra_actions_base"
#    "java_compilation"
#    "memory_pressure"
#    "strategy_policy"
#    "test_status"
#    "worker_protocol"
#    "execution_graph"
#    "build"
#    "spawn"
#    "command_line"
#    "analysis_v2"
#    "command_server"
#    "failure_details"
#    "invocation_policy"
#    "build_event_stream"
#    "package_load_metrics"

for file in "${FILES[@]}"; do
  fetch_proto "src/main/protobuf/$file.proto"
done

echo "Proto files fetched successfully to $PROTO_DIR"