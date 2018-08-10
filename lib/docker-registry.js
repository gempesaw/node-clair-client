const drc = require('docker-registry-client');
const debug = require('debug')('Clair.DockerRegistry');
const AppError = require('./error');

const DockerError = class extends AppError {};

class DockerRegistry {
  constructor(imageRef, username, password, insecure) {
    this.imageRef = imageRef;
    this.username = username;
    this.password = password;
    this.insecure = insecure;

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
          debug(err);
          reject(new Error(`error trying to retrieve manifest for image ${this.imageRef}: ${err.message || err.body.code}`));
        }
        else {
          debug('retrieved manifest for layer %o', this.imageRef);
          debug('%j', manifest);
          resolve(this.buildLayers(manifest));
        }
      })
    );
  }

  buildLayers({ config: { digest: prefix }, layers }) {
    debug('building layers');
    const { index: { name }, remoteName: imageName } = this.repoAndRef;

    const dockerHub = 'registry.hub.docker.com';
    const registryUrl = name === 'docker.io'
      ? dockerHub
      : name;
    const base = `${registryUrl}/v2/${imageName}`;

    const proto = this.insecure
      ? 'http'
      : 'https';

    return layers.map(({ digest }) => ({
      Name: `${prefix}${digest}`.replace(/sha256:/g, ''),
      Path: `${proto}://${base}/blobs/${digest}`
    }));
  }
}

module.exports = DockerRegistry;
