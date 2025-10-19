import type { IncomingMessage } from 'http';

export function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';

    const handleData = (chunk: Buffer) => {
      data += chunk.toString();
    };
    const handleEnd = () => {
      cleanup();
      resolve(data);
    };
    const handleAbort = () => {
      cleanup();
      reject(new Error('Request aborted'));
    };
    const handleError = (err?: Error) => {
      cleanup();
      reject(err ?? new Error('Request failed'));
    };
    const cleanup = () => {
      req.off('data', handleData);
      req.off('end', handleEnd);
      req.off('aborted', handleAbort);
      req.off('error', handleError);
      req.off('close', handleAbort);
    };

    req.on('data', handleData);
    req.once('end', handleEnd);
    req.once('aborted', handleAbort);
    req.once('close', handleAbort);
    req.once('error', handleError);
  });
}
