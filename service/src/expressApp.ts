import express, { ErrorRequestHandler } from 'express';
import { updateEntry } from './updateDns';
import { readSecret } from './readSecret';
import { readJson } from 'fs-extra';

function validateParams(req: express.Request) {
  const secret = req.query.secret;
  if (typeof secret !== 'string' || !secret) {
    throw new Error('invalid request');
  }

  const domain = req.query.domain;
  if (typeof domain !== 'string' || !domain) {
    throw new Error('invalid request');
  }

  const ip = req.query.ip;
  if (typeof ip !== 'string' || !ip) {
    throw new Error('invalid request');
  }

  return {
    secret,
    domain,
    ip,
  };
}

export function expressApp() {
  const app = express();

  app.get('/update', processAsyncResponse(updateDnsRecord));
  app.get('/version', processAsyncResponse(sendVersion));
  app.use(((err, _req, res, next) => {
    if (err) {
      console.error(err);

      const error = err as Error & {
        code?: number;
        errors?: Array<{
          message?: string;
        }>;
      };

      res.status(500).send({
        status: error.code ?? 500,
        message:
          (Array.isArray(error.errors) && error.errors[0].message) ||
          'unexpected something',
      });
      next();
    } else {
      next(err);
    }
  }) as ErrorRequestHandler);

  return app;
}

async function sendVersion(_req: express.Request) {
  const pkg = (await readJson('./package.json')) as { version?: string };
  return (res: express.Response) => {
    res.status(200).send(pkg.version);
  };
}

async function updateDnsRecord(req: express.Request) {
  const params = validateParams(req);

  const secret = await readSecret();

  if (params.secret !== secret) {
    return (res: express.Response) => {
      res.status(403).send({
        status: 403,
        message: 'unauthorized',
      });
    };
  }

  const result = await updateEntry(params.domain, params.ip);

  console.log(result);

  return (res: express.Response) => {
    res.status(200).send({
      status: 200,
      message: result.status,
    });
  };
}

const processAsyncResponse = (fn: typeof updateDnsRecord) => (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  fn(req)
    .then((handler) => handler(res))
    .catch(next);
};
