import { describe, it } from 'node:test';
import assert from 'node:assert';
import { StreamManager } from './stream-manager.js';

// Mock IpcRenderer for testing
class MockIpcRenderer {
  private listeners: Map<string, Array<(event: unknown, ...args: unknown[]) => void>> = new Map();

  send(channel: string, ...args: unknown[]): void {
    const listeners = this.listeners.get(channel) || [];
    for (const listener of listeners) {
      listener({}, ...args);
    }
  }

  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    this.listeners.get(channel)!.push(listener);
  }

  removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }
}

describe('StreamManager', () => {
  it('should reconstruct async generator from event stream', async () => {
    const mockIpc = new MockIpcRenderer();
    const streamManager = new StreamManager(mockIpc as any);

    // Create a simple async generator
    async function* testGenerator() {
      yield 1;
      yield 2;
      yield 3;
    }

    // Start the stream
    const streamId = await streamManager.startStream(testGenerator, 'test');
    const channel = `stream:test:${streamId}`;

    // Collect values from the reconstructed generator
    const values: number[] = [];
    for await (const value of streamManager.fromEventStream<number>(channel)) {
      values.push(value);
    }

    // Verify we got all values
    assert.deepStrictEqual(values, [1, 2, 3]);
  });

  it('should handle errors in the stream', async () => {
    const mockIpc = new MockIpcRenderer();
    const streamManager = new StreamManager(mockIpc as any);

    // Create a generator that throws an error
    async function* errorGenerator() {
      yield 1;
      throw new Error('Test error');
    }

    const streamId = await streamManager.startStream(errorGenerator, 'error-test');
    const channel = `stream:error-test:${streamId}`;

    // Should throw the error
    await assert.rejects(
      async () => {
        for await (const value of streamManager.fromEventStream(channel)) {
          // Process values
        }
      },
      { message: 'Test error' }
    );
  });

  it('should handle empty generators', async () => {
    const mockIpc = new MockIpcRenderer();
    const streamManager = new StreamManager(mockIpc as any);

    // Create an empty generator
    async function* emptyGenerator() {
      // Yields nothing
    }

    const streamId = await streamManager.startStream(emptyGenerator, 'empty-test');
    const channel = `stream:empty-test:${streamId}`;

    const values: unknown[] = [];
    for await (const value of streamManager.fromEventStream(channel)) {
      values.push(value);
    }

    assert.deepStrictEqual(values, []);
  });

  it('should handle rapid value emission', async () => {
    const mockIpc = new MockIpcRenderer();
    const streamManager = new StreamManager(mockIpc as any);

    // Create a generator that yields many values quickly
    async function* rapidGenerator() {
      for (let i = 0; i < 100; i++) {
        yield i;
      }
    }

    const streamId = await streamManager.startStream(rapidGenerator, 'rapid-test');
    const channel = `stream:rapid-test:${streamId}`;

    const values: number[] = [];
    for await (const value of streamManager.fromEventStream<number>(channel)) {
      values.push(value);
    }

    // Verify we got all 100 values in order
    assert.strictEqual(values.length, 100);
    for (let i = 0; i < 100; i++) {
      assert.strictEqual(values[i], i);
    }
  });

  it('should support stream cancellation', async () => {
    const mockIpc = new MockIpcRenderer();
    const streamManager = new StreamManager(mockIpc as any);

    // Create a generator that yields many values
    async function* longGenerator() {
      for (let i = 0; i < 1000; i++) {
        yield i;
      }
    }

    const streamId = await streamManager.startStream(longGenerator, 'cancel-test');
    const channel = `stream:cancel-test:${streamId}`;

    const values: number[] = [];
    for await (const value of streamManager.fromEventStream<number>(channel)) {
      values.push(value);
      
      // Cancel after 10 values
      if (values.length >= 10) {
        streamManager.stopStream(streamId);
        break;
      }
    }

    // Should have stopped at 10 values
    assert.strictEqual(values.length, 10);
  });

  it('should handle async delays in generator', async () => {
    const mockIpc = new MockIpcRenderer();
    const streamManager = new StreamManager(mockIpc as any);

    // Create a generator with delays
    async function* delayedGenerator() {
      yield 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      yield 2;
      await new Promise(resolve => setTimeout(resolve, 10));
      yield 3;
    }

    const streamId = await streamManager.startStream(delayedGenerator, 'delay-test');
    const channel = `stream:delay-test:${streamId}`;

    const values: number[] = [];
    const startTime = Date.now();
    
    for await (const value of streamManager.fromEventStream<number>(channel)) {
      values.push(value);
    }

    const duration = Date.now() - startTime;

    // Verify we got all values
    assert.deepStrictEqual(values, [1, 2, 3]);
    
    // Verify it took at least 20ms (two 10ms delays)
    assert.ok(duration >= 20, `Duration ${duration}ms should be >= 20ms`);
  });

  it('should handle complex objects', async () => {
    const mockIpc = new MockIpcRenderer();
    const streamManager = new StreamManager(mockIpc as any);

    interface TestData {
      id: number;
      name: string;
      nested: { value: number };
    }

    // Create a generator with complex objects
    async function* objectGenerator() {
      yield { id: 1, name: 'first', nested: { value: 10 } };
      yield { id: 2, name: 'second', nested: { value: 20 } };
      yield { id: 3, name: 'third', nested: { value: 30 } };
    }

    const streamId = await streamManager.startStream(objectGenerator, 'object-test');
    const channel = `stream:object-test:${streamId}`;

    const values: TestData[] = [];
    for await (const value of streamManager.fromEventStream<TestData>(channel)) {
      values.push(value);
    }

    // Verify we got all objects correctly
    assert.strictEqual(values.length, 3);
    assert.strictEqual(values[0].id, 1);
    assert.strictEqual(values[0].name, 'first');
    assert.strictEqual(values[0].nested.value, 10);
    assert.strictEqual(values[2].id, 3);
  });
});

