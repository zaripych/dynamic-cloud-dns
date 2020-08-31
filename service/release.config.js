'use strict';

module.exports = {
  "branches": [
    "+([0-9])?(.{+([0-9]),x}).x",
    {
      "name": "master"
    },
    {
      "name": "alpha",
      "prerelease": true
    },
    {
      "name": "beta",
      "prerelease": true
    }
  ],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    '@semantic-release/npm',
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'yarn run ci-build-docker',
      },
    ],
    [
      '@semantic-release/exec',
      {
        verifyReleaseCmd:
          'echo $DOCKER_PASSWORD | docker login -u=$DOCKER_USERNAME --password-stdin',
        publishCmd:
          'docker tag zaripych/dynamic-cloud-dns:latest zaripych/dynamic-cloud-dns:${nextRelease.version} && docker push zaripych/dynamic-cloud-dns:${nextRelease.version} && docker tag zaripych/dynamic-cloud-dns:latest zaripych/dynamic-cloud-dns:${nextRelease.channel || "latest"} && docker push zaripych/dynamic-cloud-dns:${nextRelease.channel || "latest"} ',
      },
    ],
    [
      '@semantic-release/exec',
      {
        publishCmd:
        'echo \'{ "version": "${nextRelease.version}", channel: "${nextRelease.channel}" }\' > released.json',
      },
    ],
    '@semantic-release/github',
  ],
};
