"""Repository rule to fetch Bazel proto files without all the dependencies."""

def _bazel_protos_impl(ctx):
    """Implementation of the bazel_protos repository rule."""

    # Download the Bazel source archive
    ctx.download_and_extract(
        url = ["https://github.com/bazelbuild/bazel/archive/refs/tags/7.4.1.tar.gz"],
        stripPrefix = "bazel-7.4.1",
        sha256 = "eaf34e896d006949b45fb8653707144dca1223814c4259cf2b494c6bd04a6d89",
    )

    # Delete all BUILD files from the extracted source to avoid conflicts
    ctx.execute(["find", ".", "-name", "BUILD", "-delete"])
    ctx.execute(["find", ".", "-name", "BUILD.bazel", "-delete"])
    
    # Create a BUILD file that exposes just the proto files
    build_content = """
load("@rules_proto//proto:defs.bzl", "proto_library")

# Export specific proto files
exports_files([
    "src/main/protobuf/build.proto",
    "src/main/protobuf/spawn.proto",
    "src/main/protobuf/command_line.proto",
    "src/main/protobuf/analysis_v2.proto",
    "src/main/protobuf/command_server.proto",
    "src/main/protobuf/failure_details.proto",
    "src/main/protobuf/invocation_policy.proto",
    "src/main/protobuf/deps.proto",
    "src/main/protobuf/worker_protocol.proto",
    "src/main/protobuf/execution_statistics.proto",
    "src/main/protobuf/action_cache.proto",
    "src/main/protobuf/test_status.proto",
    "src/main/java/com/google/devtools/build/lib/buildeventstream/proto/build_event_stream.proto",
    "src/main/java/com/google/devtools/build/lib/packages/metrics/package_load_metrics.proto",
])

# Package load metrics proto (dependency of build_event_stream)
proto_library(
    name = "package_load_metrics_proto",
    srcs = ["src/main/java/com/google/devtools/build/lib/packages/metrics/package_load_metrics.proto"],
    visibility = ["//visibility:public"],
    deps = [
        "@com_google_protobuf//:duration_proto",
    ],
)

# Build Event Stream proto
proto_library(
    name = "build_event_stream_proto",
    srcs = ["src/main/java/com/google/devtools/build/lib/buildeventstream/proto/build_event_stream.proto"],
    visibility = ["//visibility:public"],
    deps = [
        "@com_google_protobuf//:any_proto",
        "@com_google_protobuf//:duration_proto",
        "@com_google_protobuf//:timestamp_proto",
        ":action_cache_proto",
        ":command_line_proto",
        ":failure_details_proto",
        ":invocation_policy_proto",
        ":package_load_metrics_proto",
    ],
)

# Build proto
proto_library(
    name = "build_proto",
    srcs = ["src/main/protobuf/build.proto"],
    visibility = ["//visibility:public"],
)

# Spawn proto
proto_library(
    name = "spawn_proto",
    srcs = ["src/main/protobuf/spawn.proto"],
    visibility = ["//visibility:public"],
    deps = [
        "@com_google_protobuf//:duration_proto",
        "@com_google_protobuf//:timestamp_proto",
    ],
)

# Option filters proto (dependency of command_line)
proto_library(
    name = "option_filters_proto",
    srcs = ["src/main/protobuf/option_filters.proto"],
    visibility = ["//visibility:public"],
)

# Command line proto
proto_library(
    name = "command_line_proto",
    srcs = ["src/main/protobuf/command_line.proto"],
    visibility = ["//visibility:public"],
    deps = [":option_filters_proto"],
)

# Analysis proto
proto_library(
    name = "analysis_v2_proto",
    srcs = ["src/main/protobuf/analysis_v2.proto"],
    visibility = ["//visibility:public"],
    deps = [":build_proto"],
)

# Command server proto
proto_library(
    name = "command_server_proto",
    srcs = ["src/main/protobuf/command_server.proto"],
    visibility = ["//visibility:public"],
    deps = [":failure_details_proto"],
)

# Failure details proto
proto_library(
    name = "failure_details_proto",
    srcs = ["src/main/protobuf/failure_details.proto"],
    visibility = ["//visibility:public"],
    deps = ["@com_google_protobuf//:descriptor_proto"],
)

# Invocation policy proto
proto_library(
    name = "invocation_policy_proto",
    srcs = ["src/main/protobuf/invocation_policy.proto"],
    visibility = ["//visibility:public"],
)

# Deps proto
proto_library(
    name = "deps_proto",
    srcs = ["src/main/protobuf/deps.proto"],
    visibility = ["//visibility:public"],
)

# Worker protocol proto
proto_library(
    name = "worker_protocol_proto",
    srcs = ["src/main/protobuf/worker_protocol.proto"],
    visibility = ["//visibility:public"],
)

# Execution statistics proto
proto_library(
    name = "execution_statistics_proto",
    srcs = ["src/main/protobuf/execution_statistics.proto"],
    visibility = ["//visibility:public"],
    deps = [
        "@com_google_protobuf//:duration_proto",
        "@com_google_protobuf//:timestamp_proto",
    ],
)

# Action cache proto
proto_library(
    name = "action_cache_proto",
    srcs = ["src/main/protobuf/action_cache.proto"],
    visibility = ["//visibility:public"],
)

# Test status proto
proto_library(
    name = "test_status_proto",
    srcs = ["src/main/protobuf/test_status.proto"],
    visibility = ["//visibility:public"],
)
"""
    
    ctx.file("BUILD.bazel", build_content)
    
    # Create a MODULE.bazel file to make it a valid module
    ctx.file("MODULE.bazel", 'module(name = "bazel_protos", version = "0.0.0")')

bazel_protos = repository_rule(
    implementation = _bazel_protos_impl,
    doc = "Downloads Bazel source and exposes just the proto files.",
)
