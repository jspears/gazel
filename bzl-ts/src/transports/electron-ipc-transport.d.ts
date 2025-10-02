/**
 * Electron IPC Transport for gRPC
 * Implements a gRPC transport layer over Electron's IPC mechanism
 */
import { EventEmitter } from 'events';
import type { IpcMain } from 'electron';
/**
 * Message types for IPC communication
 */
export declare enum IPCMessageType {
    UNARY_REQUEST = "grpc:unary:request",
    UNARY_RESPONSE = "grpc:unary:response",
    STREAM_START = "grpc:stream:start",
    STREAM_DATA = "grpc:stream:data",
    STREAM_END = "grpc:stream:end",
    STREAM_ERROR = "grpc:stream:error",
    SERVER_STREAM_START = "grpc:server-stream:start",
    SERVER_STREAM_DATA = "grpc:server-stream:data",
    CLIENT_STREAM_START = "grpc:client-stream:start",
    CLIENT_STREAM_DATA = "grpc:client-stream:data",
    DUPLEX_STREAM_START = "grpc:duplex:start",
    DUPLEX_STREAM_DATA = "grpc:duplex:data"
}
/**
 * IPC message structure
 */
export interface IPCMessage {
    id: string;
    type: IPCMessageType;
    method: string;
    data?: any;
    error?: {
        code: number;
        message: string;
        details?: any;
    };
    metadata?: Record<string, string>;
}
/**
 * Service method handler types
 */
export type UnaryHandler<TRequest, TResponse> = (request: TRequest, metadata?: Record<string, string>) => Promise<TResponse>;
export type ServerStreamHandler<TRequest, TResponse> = (request: TRequest, stream: ServerStream<TResponse>, metadata?: Record<string, string>) => void;
export type ClientStreamHandler<TRequest, TResponse> = (stream: ClientStream<TRequest>, metadata?: Record<string, string>) => Promise<TResponse>;
export type DuplexStreamHandler<TRequest, TResponse> = (stream: DuplexStream<TRequest, TResponse>, metadata?: Record<string, string>) => void;
/**
 * Stream interfaces
 */
export interface ServerStream<T> {
    write(data: T): void;
    end(): void;
    error(error: Error): void;
}
export interface ClientStream<T> extends EventEmitter {
    on(event: 'data', listener: (data: T) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
}
export interface DuplexStream<TRequest, TResponse> extends ServerStream<TResponse>, ClientStream<TRequest> {
}
/**
 * Main process gRPC server over IPC
 */
export declare class ElectronIPCServer extends EventEmitter {
    private ipcMain;
    private services;
    private activeStreams;
    constructor(ipcMain: IpcMain);
    /**
     * Register a service with its methods
     */
    addService(serviceName: string, implementation: Record<string, Function>): void;
    /**
     * Setup IPC handlers
     */
    private setupHandlers;
    /**
     * Handle unary request
     */
    private handleUnaryRequest;
    /**
     * Handle server stream start
     */
    private handleServerStreamStart;
    /**
     * Handle client stream start
     */
    private handleClientStreamStart;
    /**
     * Handle client stream data
     */
    private handleClientStreamData;
    /**
     * Handle duplex stream start
     */
    private handleDuplexStreamStart;
    /**
     * Handle duplex stream data
     */
    private handleDuplexStreamData;
    /**
     * Handle stream end
     */
    private handleStreamEnd;
    /**
     * Send stream error
     */
    private sendStreamError;
    /**
     * Close all active streams
     */
    close(): void;
}
//# sourceMappingURL=electron-ipc-transport.d.ts.map