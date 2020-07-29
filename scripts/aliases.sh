#!/bin/bash

pulumi() {
  CMD="pulumi $@"
  docker run --rm --network host \
         -v $HOME:/opt/home \
         -v $(pwd):/opt/cwd \
         -e HOME=/opt/home \
         -e PULUMI_ACCESS_TOKEN \
         -w /opt/cwd \
         --entrypoint bash \
         -ti pulumi/pulumi -c $CMD
}
