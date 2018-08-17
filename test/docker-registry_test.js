const { expect } = require('chai');
const DockerRegistry = require('../lib/docker-registry');

describe('docker registry', () => {
  let registry;
  let realGetManifest;

  it('should construct client args partial with credentials', () => {
    registry = new DockerRegistry('some.private.registry/alpine', 'username', 'password');
    expect(registry.clientArgs).to.eql({ username: 'username', password: 'password' });
  });

  it('should construct client args without creds', () => {
    registry = new DockerRegistry('alpine');
    expect(registry.clientArgs).to.eql({});
  });

  it('should not use passed in creds for public images', () => {
    registry = new DockerRegistry('alpine', 'username', 'password');
    expect(registry.clientArgs).to.eql({ });
  });

  it('should retrieve authorization', async () => {
    registry = new DockerRegistry('alpine');
    registry.registry = {
      _headers: {
        authorization: 'expected'
      },
      login: (cb) => cb(null)
    };

    expect(await registry.getAuthorization()).to.eql('expected');
  });

  it('should get manifests for a public registry image', async () => {
    registry = new DockerRegistry('image:tag');
    realGetManifest = registry.registry.getManifest;
    const manifest = {
      schemaVersion: 2,
      config: { digest: 'sha256:digest' },
      layers: [{
        digest: 'sha256:some-blob1'
      }, {
        digest: 'sha256:some-blob2'
      }]
    };
    registry.registry.getManifest = (opts, cb) => cb(null, manifest);
    const layers = await registry.getLayers();
    expect(layers).to.eql([{
      Name: 'digestsome-blob1',
      Path: 'https://registry.hub.docker.com/v2/library/image/blobs/sha256:some-blob1'
    }, {
      Name: 'digestsome-blob2',
      Path: 'https://registry.hub.docker.com/v2/library/image/blobs/sha256:some-blob2'
    }]);
  });

  it('should get manifests via a v1 schema', async () => {
    registry = new DockerRegistry('image:tag');
    realGetManifest = registry.registry.getManifest;
    const manifest = {
      schemaVersion: 1,
      fsLayers: [
        { blobSum: 'sha256:some-blob2' },
        { blobSum: 'sha256:some-blob1' }
      ]
    };
    registry.registry.getManifest = (opts, cb) => cb(null, manifest);
    const layers = await registry.getLayers(1);
    expect(layers).to.eql([{
      Name: 'some-blob1',
      Path: 'https://registry.hub.docker.com/v2/library/image/blobs/sha256:some-blob1'
    }, {
      Name: 'some-blob2',
      Path: 'https://registry.hub.docker.com/v2/library/image/blobs/sha256:some-blob2'
    }]);
  });

  it('should get manifests for a private registry image', async () => {
    registry = new DockerRegistry('some.private.registry/image:tag');
    realGetManifest = registry.registry.getManifest;
    const manifest = {
      schemaVersion: 2,
      config: { digest: 'digest' },
      layers: [{ digest: 'some-blob' }]
    };
    registry.registry.getManifest = (opts, cb) => cb(null, manifest);

    const layers = await registry.getLayers();
    expect(layers).to.eql([{
      Name: 'digestsome-blob',
      Path: 'https://some.private.registry/v2/image/blobs/some-blob'
    }]);
  });

  it('should throw a decent error', async () => {
    registry = new DockerRegistry('some.private.registry/image:tag');
    realGetManifest = registry.registry.getManifest;
    registry.registry.getManifest = (opts, cb) => cb({ message: 'unauthorized' });
    try {
      await registry.getLayers();
      expect(true).to.equal(false);
    }
    catch (err) {
      expect(err.message).to.include('unauthorized');
    }
  });


  it('should actually successfully look up an actual docker image', async () => {
    // generally skipped to avoid a network call
    if (process.env.INTEGRATION) {
      registry = new DockerRegistry('alpine');
      const layers = await registry.getLayers();
      expect(layers).to.eql([{
        Name: '11cd0b38bc3ceb958ffb2f9bd70be3fb317ce7d255c8a4c3f4af30e298aa1aab8e3ba11ec2a2b39ab372c60c16b421536e50e5ce64a0bc81765c2e38381bcff6',
        Path: 'https://registry.hub.docker.com/v2/library/alpine/blobs/sha256:8e3ba11ec2a2b39ab372c60c16b421536e50e5ce64a0bc81765c2e38381bcff6'
      }]);
    }
  });

  it('should actually successfully look up an actual docker image', async () => {
    // generally skipped to avoid a network call
    if (process.env.INTEGRATION) {
      registry = new DockerRegistry('quay.io/coreos/clair');
      const layers = await registry.getLayers(1);
      expect(layers[0]).to.eql({
        Name: 'ff3a5c916c92643ff77519ffa742d3ec61b7f591b6b7504599d95a4a41134e28',
        Path: 'https://quay.io/v2/coreos/clair/blobs/sha256:ff3a5c916c92643ff77519ffa742d3ec61b7f591b6b7504599d95a4a41134e28'
      });
    }
  });

  afterEach(() => {
    if (realGetManifest) {
      registry.registry.getManifest = realGetManifest;
      realGetManifest = null;
    }
  });
});
