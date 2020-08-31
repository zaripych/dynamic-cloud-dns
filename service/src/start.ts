import { startCore } from './startCore';

let shutdownRequests = 0;

export function start(): void {
  function handleError(exc: unknown) {
    console.error('💥  ', exc);
    process.exit(1);
  }

  function finish() {
    process.exitCode = 0;
  }

  async function run() {
    process.setUncaughtExceptionCaptureCallback(handleError);

    process.on('SIGINT', () => {
      console.log('\nShutting down due to SIGINT...\n');

      shutdown().then(finish).catch(handleError);

      shutdownRequests += 1;
      if (shutdownRequests > 1) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        import('wtfnode').then((mod) => {
          console.log('== Open Handles ==');
          mod.dump();
          console.log(' ');
        });
      }
      if (shutdownRequests > 5) {
        process.exit(1);
      }
    });

    process.on('SIGTERM', () => {
      console.log('\nShutting down due to SIGTERM...\n');

      shutdown().then(finish).catch(handleError);
    });

    const teardown = await startCore();

    let isShuttingDown = false;
    const shutdown = async () => {
      if (isShuttingDown) {
        return;
      }
      isShuttingDown = true;
      await teardown();
    };
  }

  run().catch(handleError);
}

start();
