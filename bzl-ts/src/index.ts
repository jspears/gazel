/**
 * bzl-ts: TypeScript gRPC client generator for Bazel proto files
 */

export * from './generator';

// Re-export commonly used gRPC types
export { credentials, Metadata, CallOptions, Client } from '@grpc/grpc-js';
export { Options as ProtoLoaderOptions } from '@grpc/proto-loader';
