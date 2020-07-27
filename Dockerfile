FROM node:10-alpine as install-dev-deps

COPY scripts/clean.js /opt/app/scripts/
COPY scripts/build.js /opt/app/scripts/
COPY yarn.lock /opt/app/
COPY package.json /opt/app/

# Cache yarn install in a layer for quicker builds (e.g. if src/* changes we start from here)
RUN cd /opt/app \
  && yarn install --frozen-lockfile \
    && true

FROM install-dev-deps as install-prod-deps

RUN cd /opt/app \
  # Delete the DEV dependencies to start from scratch but reuse yarn cache
    && rm -rf node_modules \
      && yarn install --frozen-lockfile --production \
        && true

FROM install-dev-deps as install-dev

# Now build the whole app
COPY . /opt/app

RUN cd /opt/app \
  && yarn build \
    && ls /opt/app \
      && true

FROM install-prod-deps as install-prod

# Copy already compiled sources from the dev layer
COPY --from=install-dev /opt/app/lib /opt/app/lib
COPY --from=install-dev /opt/app/.yarnrc /opt/app/.yarnrc

# Final runnable image
FROM node:10-alpine as app-container

RUN apk add --no-cache tini \
  && true

COPY --from=install-prod /opt/app/node_modules /opt/app/node_modules
COPY --from=install-prod /opt/app/lib /opt/app/lib
COPY --from=install-prod /opt/app/.yarnrc /opt/app/.yarnrc
COPY --from=install-prod /opt/app/package.json /opt/app/package.json
COPY --from=install-prod /opt/app/yarn.lock /opt/app/yarn.lock

WORKDIR /opt/app
ENV PORT 8080
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--"]
CMD [ "node", "./lib/start.js" ]