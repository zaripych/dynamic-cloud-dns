# Your own Dynamic DNS Service in GCP

## Intro

This is inspired by a post [here](https://www.davd.io/build-your-own-dynamic-dns-in-5-minutes/). I got tired of domain name expiration emails from `no-ip.com` and decided to spin-up my own service for good.

Instead of running a server constantly though, I've decided to go with managed DNS service from Google and manage record entries using a custom service running in Cloud Run. Such a serverless solution should be cheaper than running your own machine.

## Structure

- infra - infrastructure as code for the project using Pulumi
- service - Node.js express web service which uses GCP Api's to manage DNS records

## Want your own dynamic DNS?

TODO: Scripts using pulumi docker
```
```
