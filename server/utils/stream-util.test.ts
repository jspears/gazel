/**
 * Example usage with a child process
 */
import {childToStream,} from "./stream-util";
import {spawn} from "node:child_process";
import { test,  } from "node:test";
import assert from 'node:assert';

test("[childToStream] spawning with timeout", async function () {
    // Example: spawning a process that outputs JSON lines
    const child = spawn('node', ['-e', `
    console.log(JSON.stringify({ id: 1, message: 'First' }));
    console.log(JSON.stringify({ id: 2, message: 'Second' }));
    setTimeout(() => {
      console.log(JSON.stringify({ id: 3, message: 'Third' }));
    }, 100);
  `]);

    // Convert stdout to async generator
    const result = [];
    // Consume the generator
    for await (const data of childToStream(child)) {
        result.push(data);
    }
    assert.deepStrictEqual(result, [
        {case:'json', value:{ id: 1, message: 'First' }},
        {case:'json', value:{ id: 2, message: 'Second' }},
        {case:'json', value:{ id: 3, message: 'Third' }},
        {case:'result', exitCode:0}
    ]);
});
