const debug = require('debug')('Clair.Client');
const assert = require('assert-plus');
const rp = require('request-promise-native');
const DockerRegistry = require('./docker-registry');
const AppError = require('./error');

const ClairError = class extends AppError {};

class Clair {
  constructor({
    clairAddress,
    headers = {},
    dockerUsername = null,
    dockerPassword = null,
    dockerInsecure = false
  }) {
    assert.string(clairAddress, 'clairAddress');

    this.clairAddress = clairAddress;
    this.dockerUsername = dockerUsername;
    this.dockerPassword = dockerPassword;
    this.dockerInsecure = dockerInsecure;

    this.userHeaders = headers;
    this.rp = rp.defaults({
      baseUrl: this.clairAddress,
      json: true
    });
  }

  static get apiV1() {
    return {
      uploadLayer: '/v1/layers',
      getLayer: '/v1/layers'
    };
  }

  // use the authorization from the docker registry client because it
  // already knows how to create the unauthenticated bearer token
  async getHeaders(registry) {
    const ua = 'node-clair-docker/1.0.0';

    return { ...this.userHeaders, 'User-Agent': ua, authorization: await registry.getAuthorization() };
  }

  async prepareLayers({ registry, layers }) {
    const Headers = await this.getHeaders(registry);
    return layers
      .map((layer, index, array) => ({ ...layer, ParentName: index === 0 ? '' : array[index - 1].Name }))
      .map((layer) => ({ Layer: { ...layer, Headers, Format: 'Docker' } }));
  }

  async uploadLayers(image, layers) {
    const method = 'POST';
    const uri = Clair.apiV1.uploadLayer;

    // layer analysis must be done sequentially, in order of layers,
    // one at a time, as per the docs:
    //
    // https://coreos.com/clair/docs/latest/api_v1.html#post-layers
    for (const body of layers) { // eslint-disable-line no-restricted-syntax
      try {
        debug('%o: uploading layer...', body.Layer.Name);
        debug('%j', body);
        // eslint-disable-next-line no-await-in-loop
        const ret = await this.rp({ method, uri, body });
        debug('%o: upload success', body.Layer.Name);
        debug('%j', ret);
      }
      catch (err) {
        debug(err);
        throw new ClairError(`error uploading layers for image '${image}': ${err.message}`);
      }
    }
  }

  async getAnalysis(image, preparedLayers) {
    const qs = 'features=true&vulnerabilities=true';
    const last = preparedLayers[preparedLayers.length - 1];
    const uri = `${Clair.apiV1.getLayer}/${last.Layer.Name}?${qs}`;
    try {
      debug('getting analysis for %o', image);
      const ret = await this.rp({ uri });
      const vulnerabilities = ret.Layer.Features.reduce((acc, feature) => {
        if (feature.Vulnerabilities) {
          acc.push(feature);
        }

        return acc;
      }, []);

      return { ...ret, vulnerabilities };
    }
    catch (err) {
      throw new ClairError(`error retrieving analysis for image '${image}': ${err.message}`);
    }
  }

  async analyze({
    image,
    resolveWithFullResponse = false,
    registry: argRegistry
  }) {
    assert.string(image, 'image');
    assert.bool(resolveWithFullResponse);

    debug('analyzing image %o', image);
    const { dockerUsername, dockerPassword, dockerInsecure } = this;

    const registry = argRegistry || new DockerRegistry(
      image,
      dockerUsername,
      dockerPassword,
      dockerInsecure
    );
    const layers = await registry.getLayers();
    const preparedLayers = await this.prepareLayers({ registry, layers });

    await this.uploadLayers(image, preparedLayers);
    const { vulnerabilities, ...fullResponse } = await this.getAnalysis(image, preparedLayers);

    if (resolveWithFullResponse) {
      return fullResponse;
    }

    return {
      isVulnerable: !!vulnerabilities.length,
      image,
      layers,
      vulnerabilities
    };
  }
}

module.exports = Clair;
