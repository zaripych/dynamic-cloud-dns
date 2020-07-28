import { dns_v2beta1, google } from 'googleapis';

function onceAsync<T>(fn: () => Promise<T>) {
  let result:
    | {
        value: T;
        hasResult: true;
      }
    | {
        hasResult: false;
      } = {
    hasResult: false,
  };
  let promise: Promise<T> | null = null;

  const fnOnce = async () => {
    if (result.hasResult) {
      return result.value;
    }
    if (promise) {
      return await promise;
    }
    try {
      promise = fn();
      const value = await promise;
      result = {
        value,
        hasResult: true,
      };
      return value;
    } finally {
      promise = null;
    }
  };

  return fnOnce;
}

const init = onceAsync(async () => {
  const auth = new google.auth.GoogleAuth({
    // Scopes can be specified either as an array or as a single, space-delimited string.
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/cloud-platform.read-only',
      'https://www.googleapis.com/auth/ndev.clouddns.readonly',
      'https://www.googleapis.com/auth/ndev.clouddns.readwrite',
    ],
  });

  // Acquire an auth client, and bind it to all future calls
  const authClient = await auth.getClient();
  const dns = new dns_v2beta1.Dns({
    auth: authClient,
  });

  const project =
    authClient.projectId ??
    process.env.PROJECT_ID ??
    process.env.GCLOUD_PROJECT;
  if (!project) {
    throw new Error(
      'No project id found (check PROJECT_ID or GCLOUD_PROJECT env vars)'
    );
  }

  const managedZone = process.env.ZONE;
  if (!managedZone) {
    throw new Error('Managed zone id not found (check ZONE env var)');
  }

  return {
    dns,
    project,
    managedZone,
  };
});

function assertExists<T>(value: T | null | undefined) {
  if (value == null) {
    throw new Error('value is null or undefined');
  }
  return value;
}

export async function listEntries(deps = { init }) {
  const { managedZone, project, dns } = await deps.init();
  const result = await dns.resourceRecordSets.list({
    managedZone,
    project,
  });
  return (
    result.data.rrsets?.map(({ name, type, ttl, rrdatas }) => ({
      name: assertExists(name),
      type: assertExists(type),
      ttl: assertExists(ttl),
      lines: assertExists(rrdatas),
    })) ?? []
  );
}

export async function updateEntry(name: string, ip: string) {
  const initResult = await init();

  // possibly requires pagination, but for home use case it's not required
  const entries = await listEntries({
    init: () => Promise.resolve(initResult),
  });

  const entryToDelete = entries.find(
    (entry) => entry.name === name && entry.type === 'A' && entry.ttl === 5
  );

  const { managedZone, project, dns } = initResult;

  if (entryToDelete?.lines.length === 1 && entryToDelete.lines[0] === ip) {
    console.log(
      'For',
      { project, managedZone },
      'record',
      entryToDelete,
      'doesnt need modifications'
    );
    return {
      status: 'not modified' as const,
    };
  }

  if (entryToDelete) {
    console.log(
      'Updating',
      { project, managedZone },
      'record',
      entryToDelete,
      'with',
      { name, ip }
    );
  } else {
    console.log('Creating', { project, managedZone }, 'record', { name, ip });
  }

  await dns.changes.create({
    managedZone,
    project,
    requestBody: {
      additions: [
        {
          name,
          type: 'A',
          ttl: 5,
          rrdatas: [ip],
        },
      ],
      deletions:
        (entryToDelete && [
          {
            name: entryToDelete.name,
            type: entryToDelete.type,
            ttl: entryToDelete.ttl,
            rrdatas: entryToDelete.lines,
          },
        ]) ||
        [],
    },
  });

  return {
    status: !entryToDelete ? 'created' : 'updated',
  };
}
