# Gazel API Protobufs


https://github.com/connectrpc/connect-es/blob/main/MIGRATING.md#update-plugin-options

## Generating TypeScript Stubs
Generates the TypeScript stubs for the Gazel API protobufs.  The generated files are copied to the client/lib/api/generated directory.
```sh
$ bazle build //proto:gazel_ts_proto
$ bazel run //proto:gazel_ts_proto.copy
$ bazel run //proto:logging_ts_proto.copy
```