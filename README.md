# node-clair-client

This module is a set of api bindings to
[coreos/clair@2.0.4][clair]. It uses the v1 Clair API endpoints, not
v3. Currently, it only implements the "upload layer" and "get layer"
endpoints; contributions are welcome.

## installation

```
npm i clair-client
```

## usage

To use this module, you need a clair server available somewhere - its
address must be passed in to the `clair-client` constructor.

For a public image,

```
const Clair = require('clair-client');

(async () => {
  const clairAddress = 'https://your.clair.server';
  const clair = new Clair({ clairAddress });
  const analysis = await clair.analyze({ image: 'alpine:3.2' });

  if (analysis.isVulnerable) {
    console.log(analysis.vulnerabilities);
  }
})();
```

To check an image in a private registry,

```
const Clair = require('clair-client');

(async () => {
  const clairAddress = 'https://your.clair.server';
  const dockerUsername = 'username';
  const dockerPassword = 'password';
  const clair = new Clair({ clairAddress, dockerUsername, dockerPassword });
  const analysis = await clair.analyze({ image: 'private.docker.registry/alpine:3.2' });

  if (analysis.isVulnerable) {
    console.log(analysis.vulnerabilities);
  }
})();
```

## debugging

clair-client uses [debug][] with the prefix `Clair.`, so set the
environment variable DEBUG to that value:

```
DEBUG=Clair.* node script.js
```

Note that this will log out your docker credentials, as they're part
of the POST body to the Clair server.

[clair]: https://github.com/coreos/clair/tree/v2.0.4
[debug]: https://www.npmjs.com/package/debug
