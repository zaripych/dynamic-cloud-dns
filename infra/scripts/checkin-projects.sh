#!/bin/bash
cmd=gsutil
bucket=gs://dcdsb-bbfabiukk5tshphiqyxqmck-e8b5c85
$cmd cp ./Pulumi.prod.yaml $bucket
$cmd cp ./Pulumi.alpha.yaml $bucket
