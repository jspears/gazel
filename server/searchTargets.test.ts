import './loader.js';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createRouterTransport } from '@connectrpc/connect';
import { createClient } from '@connectrpc/connect';
import { GazelService } from '@speajus/gazel-proto';
import { GazelServiceImpl } from './server.js';

describe('GazelService.searchTargets', () => {
  it('should stream target results and complete', async () => {
    // Create service instance
    const serviceImpl = new GazelServiceImpl();

    // Create router transport with the service implementation
    const transport = createRouterTransport(({ service }) => {
      service(GazelService, serviceImpl);
    });

    // Create client
    const client = createClient(GazelService, transport);

    // Call the streaming method with a limited query to avoid too many results
    const results: Array<{ data: { case: string; value?: unknown } }> = [];

    try {
      // Use a more specific query to limit results
      for await (const response of client.searchTargets({ query: '//server:*' })) {
        results.push(response);
        // Break if we get a completion message
        if (response.data.case === 'complete') break;
        // Safety limit
        if (results.length > 100) break;
      }
    } catch (error) {
      // If there's an error (e.g., bazel not available), check if we got an error response
      if (results.length > 0 && results[0].data.case === 'error') {
        // This is expected if bazel isn't configured
        console.log('Got expected error response:', results[0].data.value);
        return;
      }
      throw error;
    }

    // Verify we got at least one response
    assert.ok(results.length > 0, 'Should have at least one response');

    // Check that the last message is a completion message
    const lastResult = results[results.length - 1];
    assert.strictEqual(lastResult.data.case, 'complete', 'Last message should be complete');

    const completeValue = lastResult.data.value as { total?: number; query?: string };
    assert.ok(completeValue.total !== undefined, 'Complete message should have total');
    assert.strictEqual(completeValue.query, '//server:*', 'Complete message should have query');
  });

  it('should handle empty query with error', async () => {
    const serviceImpl = new GazelServiceImpl();

    const transport = createRouterTransport(({ service }) => {
      service(GazelService, serviceImpl);
    });

    const client = createClient(GazelService, transport);

    // Call without query
    const results: Array<{ data: { case: string; value?: unknown } }> = [];
    for await (const response of client.searchTargets({ query: '' })) {
      results.push(response);
    }

    // Should get an error response
    assert.strictEqual(results.length, 1, 'Should have exactly one response');
    assert.strictEqual(results[0].data.case, 'error', 'Response should be an error');
    
    const errorValue = results[0].data.value as string;
    assert.ok(errorValue.includes('Query is required'), 'Error should mention query is required');
  });

  it('should stream with type filter', async () => {
    const serviceImpl = new GazelServiceImpl();

    const transport = createRouterTransport(({ service }) => {
      service(GazelService, serviceImpl);
    });

    const client = createClient(GazelService, transport);

    // Call with type filter - use a limited query
    const results: Array<{ data: { case: string; value?: unknown } }> = [];

    try {
      for await (const response of client.searchTargets({
        query: '//server:*',
        type: 'js_library'
      })) {
        results.push(response);
        // Break if we get a completion message
        if (response.data.case === 'complete') break;
        // Safety limit
        if (results.length > 100) break;
      }
    } catch (error) {
      // If there's an error, check if we got an error response
      if (results.length > 0 && results[0].data.case === 'error') {
        console.log('Got expected error response:', results[0].data.value);
        return;
      }
      throw error;
    }

    // Verify we got at least a completion message
    assert.ok(results.length > 0, 'Should have at least one response');

    // Check that the last message is a completion message
    const lastResult = results[results.length - 1];
    assert.strictEqual(lastResult.data.case, 'complete', 'Last message should be complete');
  });
});

