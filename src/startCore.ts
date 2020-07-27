import * as http from 'http';
import { expressApp } from './expressApp';

export async function startCore() {
  const server = http.createServer();
  const app = expressApp();

  server.addListener('request', app);

  const port = Number(process.env.PORT ?? 8080);

  if (typeof port !== 'number' || !Number.isInteger(port) || port > 65536) {
    throw new Error('Invalid port');
  }

  await new Promise((res, rej) => {
    server.once('error', rej);
    server.once('listening', () => {
      console.log(`  Listening on ${port}...`);
      res();
    });
    server.listen(port);
  });

  return async () => {
    server.removeListener('request', app);
    await new Promise((res, rej) => {
      server.close((err) => {
        if (err) {
          rej(err);
        } else {
          res();
        }
      });
    });
  };
}
