
import { getClient } from '../client/client.js';

(async () => {
    console.log('Starting test...');
    const client = getClient();
    console.log('api:', client);
    try {
        let count = 0;
        for await (const message of client.searchTargets({ query: '//...' })) {
            if (message.data.case === 'target') {
                const target = message.data.value;
                console.log(`Target ${++count}: ${target.label} (${target.kind})`);
            } else if (message.data.case === 'complete') {
                console.log(`Complete: ${message.data.value.total} targets`);
            } else if (message.data.case === 'error') {
                console.log(`Error: ${message.data.value}`);
            }
        }
        console.log('Done!');
    } catch (error) {
        // Don't log the error object itself - just the message
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : '';
        console.error('Caught error - Message:', errorMessage);
        console.error('Caught error - Stack:', errorStack);
    }
})();