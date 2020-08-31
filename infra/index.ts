import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import * as docker from '@pulumi/docker';
import { PushDockerImage } from './pushDockerImage';

const config = new pulumi.Config();

const stack = pulumi.getStack();

function createName(name: string) {
  if (stack === 'prod') {
    return name;
  }
  return [name, stack].join('-');
}

const iamService = new gcp.projects.Service('iam-service', {
  service: 'iam.googleapis.com',
  disableOnDestroy: false,
});

const runService = new gcp.projects.Service('run-service', {
  service: 'run.googleapis.com',
  disableOnDestroy: false,
});

const secretsService = new gcp.projects.Service('secrets-service', {
  service: 'secretmanager.googleapis.com',
  disableOnDestroy: false,
});

const serviceAccount = new gcp.serviceAccount.Account('service-account', {
  accountId: createName('record-update-sa'),
  displayName: 'Dynamic DNS Records Update Service',
  description:
    'Service Account used by Cloud Run service which updates DNS records',
});

const dnsAccessForAccount = new gcp.projects.IAMMember(
  'service-account-dns-access',
  {
    role: 'roles/dns.admin',
    member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
  }
);

const secret = new gcp.secretmanager.Secret('secret', {
  secretId: createName('record-update-secret'),
  replication: {
    automatic: true,
  },
});

const secretValue = new gcp.secretmanager.SecretVersion('secret-value', {
  secret: secret.id,
  secretData: config.requireSecret('dnsEntryUpdateSecret'),
});

const secretValueAccessForAccount = new gcp.secretmanager.SecretIamMember(
  'secret-value-access',
  {
    secretId: secret.id,
    member: pulumi.interpolate`serviceAccount:${serviceAccount.email}`,
    role: 'roles/secretmanager.secretAccessor',
  }
);

const location = config.get('location') ?? 'us-east1';

const imageLocation = config.get('imageLocation') ?? 'gcr.io';

const imageTag =
  config.get('serviceImageTag') ?? stack === 'prod' ? 'latest' : stack;

const imageName = `zaripych/dynamic-cloud-dns:${imageTag}`;

const latestPublicImage = pulumi.output(
  docker.getRegistryImage({
    name: imageName,
  })
);

const pushedDockerImage = new PushDockerImage('remote-docker-image', {
  sourceImage: imageName,
  pullTriggers: [latestPublicImage.sha256Digest],
  targetImage: pulumi.interpolate`${imageLocation}/${
    gcp.config.project
  }/dynamic-cloud-dns:${imageTag}-${latestPublicImage.sha256Digest.apply(
    (sha) => sha.substring(7, 20)
  )}`,
});

const service = new gcp.cloudrun.Service('service', {
  location,
  template: {
    spec: {
      containers: [
        {
          image: pushedDockerImage.imageNameWithDigest,
          envs: [
            {
              name: 'PROJECT_ID',
              value: gcp.config.project,
            },
            {
              name: 'ZONE',
              value: config.require('dnsZone'),
            },
            {
              name: 'SECRET',
              value: secretValue.id,
            },
          ],
        },
      ],
      serviceAccountName: serviceAccount.accountId,
    },
  },
});

const servicePublicAccess = new gcp.cloudrun.IamMember(
  'service-public-access',
  {
    service: service.name,
    location,
    role: 'roles/run.invoker',
    member: 'allUsers',
  }
);

const dnsZone = gcp.dns.getManagedZone({
  name: config.require('dnsZone'),
});

function removeTrailingDot(dnsName: string) {
  return dnsName.replace(/\.$/, '');
}

const serviceSubDomain = config.get('serviceSubDomain');

const serviceDomainMapping =
  (!!serviceSubDomain &&
    new gcp.cloudrun.DomainMapping('cloudrun-service-domain', {
      location,
      name: dnsZone.then(
        (zone) => `${serviceSubDomain}.${removeTrailingDot(zone.dnsName)}`
      ),
      spec: {
        routeName: service.name,
      },
      metadata: {
        namespace: gcp.config.project!,
      },
    })) ||
  null;

const serviceDomainMappingRecords =
  (serviceDomainMapping &&
    serviceDomainMapping.status.resourceRecords &&
    serviceDomainMapping.status.resourceRecords.apply((records) =>
      (records ?? []).map(
        (record) =>
          new gcp.dns.RecordSet('service-domain-entries', {
            managedZone: config.require('dnsZone'),
            name: dnsZone.then((zone) => `${record.name}.${zone.dnsName}`),
            ttl: 5 * 60,
            type: record.type ?? 'CNAME',
            rrdatas: [record.rrdata],
          })
      )
    )) ??
  null;

export const directUrl = service.status.url;
export const domainMappedUrl =
  serviceDomainMapping &&
  pulumi.interpolate`https://${serviceDomainMapping.name}`;
export const secretValueId = secretValue.id;
