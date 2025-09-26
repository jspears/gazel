#!/bin/bash
# Script to fetch Bazel proto files for gRPC stub generation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROTO_DIR="$SCRIPT_DIR/../protos"
BAZEL_VERSION="7.4.1"

echo "Creating proto directory..."
mkdir -p "$PROTO_DIR/bazel"

echo "Fetching Bazel proto files..."

# Core build event stream proto
curl -L -o "$PROTO_DIR/bazel/build_event_stream.proto" \
  "https://raw.githubusercontent.com/bazelbuild/bazel/$BAZEL_VERSION/src/main/java/com/google/devtools/build/lib/buildeventstream/proto/build_event_stream.proto"

# Remote execution proto
curl -L -o "$PROTO_DIR/bazel/remote_execution.proto" \
  "https://raw.githubusercontent.com/bazelbuild/remote-apis/main/build/bazel/remote/execution/v2/remote_execution.proto"

# Command line proto
curl -L -o "$PROTO_DIR/bazel/command_line.proto" \
  "https://raw.githubusercontent.com/bazelbuild/bazel/$BAZEL_VERSION/src/main/protobuf/command_line.proto"

# Invocation policy proto
curl -L -o "$PROTO_DIR/bazel/invocation_policy.proto" \
  "https://raw.githubusercontent.com/bazelbuild/bazel/$BAZEL_VERSION/src/main/protobuf/invocation_policy.proto"

# Analysis proto
curl -L -o "$PROTO_DIR/bazel/analysis_v2.proto" \
  "https://raw.githubusercontent.com/bazelbuild/bazel/$BAZEL_VERSION/src/main/protobuf/analysis_v2.proto"

# Build proto
curl -L -o "$PROTO_DIR/bazel/build.proto" \
  "https://raw.githubusercontent.com/bazelbuild/bazel/$BAZEL_VERSION/src/main/protobuf/build.proto"

echo "Proto files fetched successfully to $PROTO_DIR"
