const DockerRegistry = require('./docker-registry');
const assert = require('assert-plus');
const rp = require('request-promise-native');
const debug = require('debug')('Clair.Client');
const AppError = require('./error');

const ClairError = class extends AppError {};

class Clair {
  constructor({
    clairAddress,
    headers = {},
    dockerUsername = null,
    dockerPassword = null
  }) {
    assert.string(clairAddress, 'clairAddress');

    this.clairAddress = clairAddress;
    this.dockerUsername = dockerUsername;
    this.dockerPassword = dockerPassword;

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

  get Headers() {
    const { dockerUsername, dockerPassword, userHeaders } = this;
    const ua = 'node-clair-docker/1.0.0';

    if (dockerUsername && dockerPassword) {
      const token = Buffer.from(`${dockerUsername}:${dockerPassword}`, 'utf-8').toString('base64');

      return {
        ...this.userHeaders,
        Authorization: `Basic ${token}`,
        'User-Agent': ua
      };
    }

    return { ...this.userHeaders, 'User-Agent': ua };
  }

  prepareLayers(layers) {
    const { Headers } = this;
    return layers
      .map((layer, index, array) => ({ ...layer, ParentName: index === 0 ? null : array[index - 1].Name }))
      .map((layer) => ({ Layer: { ...layer, Headers, Format: 'Docker' } }));
  }

  async uploadLayers(image, layers) {
    const { clairAddress } = this;
    const method = 'POST';
    const uri = Clair.apiV1.uploadLayer;

    // layer analysis must be done sequentially, in order of layers,
    // one at a time, as per the docs:
    //
    // https://coreos.com/clair/docs/latest/api_v1.html#post-layers
    for (const body of layers) {
      try {
        debug('%o: uploading layer...', body.Layer.Name);
        const ret = await this.rp({ method, uri, body });
        debug('%o: upload success');
      }
      catch (err) {
        debug(err);
        throw new Error(`error uploading layers for image '${image}': ${err.message}`);
      }
    }
  }

  async getAnalysis(image, preparedLayers) {
    const { clairAddress } = this;

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
      throw new Error(`error retrieving analysis for image '${image}': ${err.message}`);
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
    const { dockerUsername, dockerPassword } = this;

    const registry = argRegistry || new DockerRegistry(image, dockerUsername, dockerPassword);
    const layers = await registry.getLayers();
    const preparedLayers = this.prepareLayers(layers);

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
