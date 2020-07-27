'use strict';

module.exports = {
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
          'docker login -u=$DOCKER_USERNAME -p=$DOCKER_PASSWORD',
        publishCmd:
          'docker tag zaripych/dynamic-cloud-dns:latest zaripych/dynamic-cloud-dns:${nextRelease.version} && docker push zaripych/dynamic-cloud-dns:${nextRelease.version} && docker tag zaripych/dynamic-cloud-dns:latest zaripych/dynamic-cloud-dns:${nextRelease.channel || "latest"} && docker push zaripych/dynamic-cloud-dns:${nextRelease.channel || "latest"} ',
      },
    ],
    '@semantic-release/github',
  ],
};
