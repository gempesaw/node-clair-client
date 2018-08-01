const drc = require('docker-registry-client');
const debug = require('debug')('Clair.DockerRegistry');

class DockerRegistry {
  constructor(imageRef, username, password) {
    this.imageRef = imageRef;
    this.username = username;
    this.password = password;

    this.repoAndRef = drc.parseRepoAndRef(this.imageRef);
    this.registry = drc.createClientV2({
      repo: this.repoAndRef,
      ...this.clientArgs
    });
  }

  get clientArgs() {
    const { username, password } = this;
    if (username && password) {
      debug('authorizing to docker registry as %o', username);
      return { username, password };
    }

    debug('not using authorization for docker registry');
    return {};
  }

  getLayers() {
    debug('getting layers for %o', this.imageRef);
    const ref = this.repoAndRef.tag || this.repoAndRef.digest;
    const maxSchemaVersion = 2;

    return new Promise((resolve, reject) =>
      this.registry.getManifest({ ref, maxSchemaVersion: 2}, (err, manifest) => {
        if (err) {
          reject(err);
        }

        resolve(this.buildLayers(manifest));
      })
    );
  }

  buildLayers({ config: { digest: prefix }, layers }) {
    const { index: { name: registryUrl }, remoteName: imageName } = this.repoAndRef;
    const base = `${registryUrl}/v2/${imageName}`;

    return layers.map(({ digest }) => ({
      Name: `${prefix}${digest}`.replace(/sha256:/g, ''),
      Path: `${base}/${digest}`
    }));
  }
}

module.exports = DockerRegistry;
