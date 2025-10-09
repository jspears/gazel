import { spawn } from 'child_process';
import { Readable } from 'stream';
import {ChildProcess} from "node:child_process";

/**
 * Converts a stdout stream to an async generator that yields parsed JSON objects
 * @param stream - The readable stream (e.g., process.stdout)
 */
async function* streamToGenerator(stream: Readable): AsyncGenerator<any> {
   const promise = new Promise<number>(res=> stream.on('close', res));
    let buffer = '';

    for await (const chunk of stream) {
        buffer += chunk.toString();

        // Split by newlines
        const lines = buffer.split('\n');

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        // Process complete lines
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) {
               yield trimmed;
            }
        }
    }

    // Process any remaining data in buffer
    const result = buffer.trim();
    if (result) {
        yield result;
    }

    await promise;
}
``
export async function *spawnToStream(cmd:string,
                                     args:string[],
                                     parser= JSON.parse,
                                     ): AsyncGenerator<{case:'json', value:ReturnType<typeof parser>} | {case:'stderr', value:string} | {case:'result', exitCode:number} > {
   yield* childToStream(spawn(cmd, args), parser);
}

export async function *childToStream(child:ChildProcess, parser= JSON.parse,
    ): AsyncGenerator<{case:'json', value:ReturnType<typeof parser>} | {case:'stderr', value:string} | {case:'result', exitCode:number} > {

    const promise = new Promise<number>((res)=> child.on('exit', res));

    for await (const out of combinedStreamProcessor(child)) {
        if (out.type === 'stderr') {
            yield {value:out.data, case:'stderr'};
            continue;
        }
        yield {value:parser(out.data), case:'json'};
    }
    const exitCode = await promise;
    return {exitCode, case:'result'};
}
async function spawnToStreamWithTimeout(cmd:string, args:string[],
    timeoutMs:number = 50000) {
    const child = spawn(cmd, args);
    const results: any[] = [];

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    );

    const streamPromise = (async () => {
        for await (const json of streamToGenerator(child.stdout)) {
            results.push(json);
        }
        return results;
    })();

    try {
        return await Promise.race([streamPromise, timeoutPromise]);
    } catch (error) {
        child.kill();
        throw error;
    }
}

type StreamMessage = {
    index: number;
    data: string;
};
type ChildMessage = {type:'stdout', data:string } |  {type:'stderr', data:string };

async function* combinedStreamProcessor(child:ChildProcess): AsyncGenerator<ChildMessage> {
    for await (const message of mergeTagged(streamToGenerator(child.stdout), streamToGenerator(child.stderr))){
        yield {
            type: message.index == 0 ? 'stdout' : 'stderr',
            data: message.value,
        }
    }
}

export async function* mergeTagged<T>(
    ...gens: AsyncGenerator<T>[]
): AsyncGenerator<{value:T, index: number}> {

    // Track active generators with their original indices using Maps
    const activeGenerators = new Map<number, AsyncGenerator<T>>();
    gens.forEach((gen, idx) => activeGenerators.set(idx, gen));

    // Create initial promises for all generators
    const pendingPromises = new Map<number, Promise<{ result: IteratorResult<T>, idx: number }>>();
    activeGenerators.forEach((gen, idx) => {
        pendingPromises.set(idx, gen.next().then(result => ({ result, idx })));
    });

    while (pendingPromises.size > 0) {
        // Race all pending promises
        const racePromises = Array.from(pendingPromises.entries()).map(
            async ([idx, promise]) => promise
        );

        const { result, idx } = await Promise.race(racePromises);

        // Remove the completed promise from pending
        pendingPromises.delete(idx);

        if (!result.done) {
            // Yield the value with its original generator index
            yield { index: idx, value: result.value };

            // Queue the next iteration for this generator
            const gen = activeGenerators.get(idx);
            if (gen) {
                pendingPromises.set(idx, gen.next().then(result => ({ result, idx })));
            }
        } else {
            // Generator completed, remove from active generators
            activeGenerators.delete(idx);
        }
    }
}