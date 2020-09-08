# Your own Dynamic DNS Service in GCP

## Intro

This is inspired by a post [here](https://www.davd.io/build-your-own-dynamic-dns-in-5-minutes/). I got tired of domain name expiration emails from `no-ip.com` and decided to spin-up my own service for good.

Instead of running a server constantly though, I've decided to go with managed DNS service from Google and manage record entries using a custom service running in Cloud Run. Such a serverless solution should be cheaper than running your own machine.

## Structure

- infra - infrastructure as code for the project using Pulumi
- service - Node.js express web service which uses GCP Api's to manage DNS records

## Want your own dynamic DNS?

1. Login to GCP and [create a project](https://cloud.google.com/resource-manager/docs/creating-managing-projects). Remember your project id as you will need it later.

1. [Create Cloud DNS zone](https://cloud.google.com/dns/docs/zones). Remember your zone id as you will need it later.

1. If you have Docker installed and familiar with it, you can use bash shell aliases below in your `.zshrc` or `.bashrc` files. Otherwise, install Pulimi CLI and GCloud as documented: [pulumi](https://www.pulumi.com/docs/get-started/gcp/) and [gcloud](https://cloud.google.com/sdk/gcloud/). 

```
gcloud() {
  CMD="gcloud $@"
  docker run --rm \
         --network host \
         -v $HOME/docker-gcloud:/opt/home \
         -v $(pwd):/opt/cwd \
         -e HOME=/opt/home \
         --workdir /opt/cwd \
         -ti google/cloud-sdk $CMD
}

pulumi() {
  CMD="pulumi $@"
  docker run --rm --network host \
         -v $HOME/docker-gcloud:/opt/home \
         -v $(pwd):/opt/cwd \
         -v /var/run/docker.sock:/var/run/docker.sock \
         -e HOME=/opt/home \
         -e PULUMI_ACCESS_TOKEN \
         -w /opt/cwd/${PULUMI_ROOT} \
         --entrypoint bash \
         -ti pulumi/pulumi -c $CMD
}
```

1. Login to [GCloud](https://www.pulumi.com/docs/intro/cloud-providers/gcp/setup/)

1. Run following commands to login to Pulumi, create your stack and spin-up everything:

```
mkdir gcp-ddns && cd gcp-ddns
pulumi new https://github.com/zaripych/dynamic-cloud-dns/infra -s prod
pulumi up
```

1. Now, if everything is successfull, your Dynamic DNS can be updated using Cloud Run function. Run `pulumi stack output directUrl -s prod` to know the URL you should use to access your service.

1. Test if your service works by running:

```
curl $URL/version
curl $URL/update?secret=$SECRET&domain=$DOMAIN&ip=$IP
```
