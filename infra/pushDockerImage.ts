import * as pulumi from '@pulumi/pulumi';
import { spawn } from 'child_process';
import { format } from 'util';

type PushDockerImageInputArgs = {
  sourceImage: pulumi.Input<string>;
  pullTriggers: pulumi.Input<pulumi.Input<string>[]>;
  targetImage: pulumi.Input<string>;
};

type InputArgs = {
  sourceImage: string;
  pullTriggers: string[];
  targetImage: string;
};

type OutputArgs = {
  sourceImage: string;
  pullTriggers: string[];
  targetImage: string;
  shaDigest: string;
  imageNameWithDigest: string;
};

function log(
  { verbose = false },
  ...parameters: Parameters<typeof console.log>
) {
  if (verbose) {
    pulumi.log.info(format(...parameters));
  } else {
    pulumi.log.debug(format(...parameters));
  }
}

async function runDocker(args: string[], { verbose = false } = {}) {
  return new Promise<{ stdout: string; stderr: string }>((res, rej) => {
    const child = spawn('docker', args);
    const output: string[] = [];
    const errors: string[] = [];
    child.once('close', (code, signal) => {
      if (code === 0) {
        pulumi.log.info(`Successfully run "docker ${args.join(' ')}"`);
        res({
          stdout: output.join('\n'),
          stderr: errors.join('\n'),
        });
      } else {
        rej(
          typeof code === 'number'
            ? new Error(`Docker process quit with ${code} code`)
            : new Error(`Docker process was terminated with ${signal}`)
        );
      }
    });
    child.once('error', (err) => rej(err));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      log({ verbose }, chunk);
      output.push(chunk);
    });
    child.once('error', (err) => rej(err));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      log({ verbose }, chunk);
      errors.push(chunk);
    });
  });
}

function pullImage(imageName: string) {
  return runDocker(['pull', imageName], { verbose: true });
}

function tagImage(fromName: string, toName: string) {
  return runDocker(['tag', fromName, toName], { verbose: true });
}

function pushImage(imageName: string) {
  return runDocker(['push', imageName], { verbose: true });
}

async function getSha(imageName: string) {
  const result = await runDocker(['inspect', imageName]);
  const data = JSON.parse(result.stdout) as Array<{
    Id?: string;
    RepoDigests?: string[];
  }>;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(
      'Docker inspect command returned something unusual: ' + result.stdout
    );
  }
  const imageNameLookup = /([^@:]+)(@|:)?/.exec(imageName);
  if (!imageNameLookup) {
    throw new Error('Image name is not ok: ' + imageName);
  }
  const repoDigest =
    data[0].RepoDigests?.filter((item) => item.startsWith(item))[0] ?? '';
  const shaLookup = /sha256:.*/.exec(repoDigest);
  if (!shaLookup) {
    throw new Error(
      'Docker inspect command returned something unusual: ' + result.stdout
    );
  }
  const shaDigest = shaLookup[0];
  const imageNameWithDigest = `${imageNameLookup[1]}@${shaDigest}`;
  return {
    shaDigest,
    imageNameWithDigest,
  };
}

class PushDockerImageResourceProvider
  implements pulumi.dynamic.ResourceProvider {
  constructor(private name: string) {}

  async check(
    olds: InputArgs,
    news: InputArgs
  ): Promise<pulumi.dynamic.CheckResult> {
    if (
      olds.sourceImage === news.sourceImage &&
      olds.targetImage === news.targetImage
    ) {
      return {
        inputs: news,
      };
    }

    const failures: pulumi.dynamic.CheckFailure[] = [];
    if (news.sourceImage === news.targetImage) {
      failures.push({
        property: 'sourceImage',
        reason: 'Source image and target image cannot be equal',
      });
    }

    if (!news.sourceImage) {
      failures.push({
        property: 'sourceImage',
        reason: 'Source image is mandatory',
      });
    }

    if (!news.targetImage) {
      failures.push({
        property: 'targetImage',
        reason: 'Target image is mandatory',
      });
    }

    // TODO: validate if source and target images are valid

    if (failures.length > 0) {
      return { failures };
    }

    return {
      inputs: news,
    };
  }

  async diff(
    _id: string,
    olds: InputArgs,
    news: InputArgs
  ): Promise<pulumi.dynamic.DiffResult> {
    const replaces: string[] = [];

    if (news.pullTriggers?.length !== olds.pullTriggers?.length) {
      replaces.push('pullTriggers');
    } else {
      if (
        news.pullTriggers?.some(
          (trigger, i) => trigger !== olds.pullTriggers[i]
        )
      ) {
        replaces.push('pullTriggers');
      }
    }

    if (news.targetImage !== olds.targetImage) {
      replaces.push('targetImage');
    }
    if (news.sourceImage !== olds.sourceImage) {
      replaces.push('sourceImage');
    }

    return {
      replaces,
      changes: replaces.length > 0,
    };
  }

  async create(inputs: InputArgs): Promise<pulumi.dynamic.CreateResult> {
    await pullImage(inputs.sourceImage);
    await tagImage(inputs.sourceImage, inputs.targetImage);
    await pushImage(inputs.targetImage);
    const { shaDigest, imageNameWithDigest } = await getSha(inputs.targetImage);
    return {
      id: `zaripych:docker:PushDockerImage:${this.name}`,
      outs: {
        sourceImage: inputs.sourceImage,
        targetImage: inputs.targetImage,
        shaDigest,
        imageNameWithDigest,
      },
    };
  }

  async read(
    id: string,
    props?: OutputArgs
  ): Promise<pulumi.dynamic.ReadResult> {
    return {
      id,
      props,
    };
  }

  async update(
    _id: string,
    olds: OutputArgs,
    news: InputArgs
  ): Promise<pulumi.dynamic.UpdateResult> {
    await pullImage(olds.sourceImage);
    await tagImage(news.sourceImage, news.targetImage);
    await pushImage(news.targetImage);
    const { shaDigest, imageNameWithDigest } = await getSha(news.targetImage);
    return {
      outs: {
        sourceImage: news.sourceImage,
        targetImage: news.targetImage,
        shaDigest,
        imageNameWithDigest,
      },
    };
  }

  async delete(_id: string, props: OutputArgs): Promise<void> {
    // should we cleanup the target repo here?
    // what if there are other services still using older image versions?
  }
}

export class PushDockerImage extends pulumi.dynamic.Resource {
  constructor(
    name: string,
    args: PushDockerImageInputArgs,
    opts?: pulumi.CustomResourceOptions
  ) {
    super(
      new PushDockerImageResourceProvider(name),
      `zaripych:docker:PushDockerImage:${name}`,
      { ...args, shaDigest: undefined, imageNameWithDigest: undefined },
      opts
    );
  }
}

export declare interface PushDockerImage {
  readonly sourceImage: pulumi.Output<string>;
  readonly targetImage: pulumi.Output<string>;
  readonly shaDigest: pulumi.Output<string>;
  readonly imageNameWithDigest: pulumi.Output<string>;
}
