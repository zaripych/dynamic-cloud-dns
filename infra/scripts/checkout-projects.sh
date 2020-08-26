#!/bin/bash
bucket=gs://dcdsb-bbfabiukk5tshphiqyxqmck-e8b5c85
gsutil cp $bucket/Pulumi.prod.yaml ./Pulumi.prod.yaml
gsutil cp $bucket/Pulumi.alpha.yaml ./Pulumi.alpha.yaml
