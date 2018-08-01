const { expect } = require('chai');
const DockerRegistry = require('../lib/docker-registry.js');

describe('docker registry', () => {
  let registry;
  let realGetManifest;

  it('should construct client args partial with credentials', () => {
    registry = new DockerRegistry('alpine', 'username', 'password');
    expect(registry.clientArgs).to.eql({ username: 'username', password: 'password' });
  });

  it('should construct client args without creds', () => {
    registry = new DockerRegistry('alpine');
    expect(registry.clientArgs).to.eql({});
  });

  it('should get manifests for a public registry image', async () => {
    registry = new DockerRegistry('image:tag');
    realGetManifest = registry.registry.getManifest;
    registry.registry.getManifest = (opts, cb) => cb(null, { layers: [{ digest: 'some-blob' }] });
    const layers = await registry.getLayers();
    expect(layers).to.eql([ 'docker.io/v2/library/image/some-blob' ]);
  });

  it('should get manifests for a private registry image', async () => {
    registry = new DockerRegistry('some.private.registry/image:tag');
    realGetManifest = registry.registry.getManifest;
    registry.registry.getManifest = (opts, cb) => cb(null, { layers: [{ digest: 'some-blob' }] });
    const layers = await registry.getLayers();
    expect(layers).to.eql([ 'some.private.registry/v2/image/some-blob' ]);
  });

  // generally skipped to avoid a network call
  it.skip('should actually successfully look up an actual docker image', async () => {
    registry = new DockerRegistry('alpine');
    const layers = await registry.getLayers();
    expect(layers).to.eql([
      'docker.io/v2/library/alpine/sha256:8e3ba11ec2a2b39ab372c60c16b421536e50e5ce64a0bc81765c2e38381bcff6'
    ]);
  });

  afterEach(() => {
    if (realGetManifest) {
      registry.registry.getManifest = realGetManifest;
      realGetManifest = null;
    }
  });
});
