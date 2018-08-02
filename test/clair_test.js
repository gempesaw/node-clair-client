const { expect } = require('chai');
const express = require('express');
const Clair = require('..');

describe('Clair', () => {
  let server; // fakeClair() writes the server to this global variable
              // so we can close it afterwards. awk!

  const fakeClair = ({
    analysis = { Layer: { Features: [] } },
    upload = (req, res, next) => { res.statusCode = 201; res.json({ done: 'done' }); }
  } = {}) => new Promise((resolve, reject) => {
    const app = express();
    app.post('*', upload);

    app.get('/v1/layers/name', (req, res, next) => res.json(analysis));

    server = app.listen(0, (err) => {
      if (err) {
        reject(err);
      }

      const { port } = server.address();
      resolve(`http://0.0.0.0:${port}`);
    });
  });

  it('should analyze images without vulnerabilities', async () => {
    const clairAddress = await fakeClair();
    const clair = new Clair({ clairAddress });

    const { isVulnerable } = await clair.analyze({
      image: 'image',
      registry: fakeRegistry
    });

    expect(isVulnerable).to.equal(false);
  });

  it('should analyze images and return the full response', async () => {
    const clairAddress = await fakeClair();
    const clair = new Clair({ clairAddress });

    const ret = await clair.analyze({
      image: 'image',
      registry: fakeRegistry,
      resolveWithFullResponse: true
    });


    expect(ret).to.eql({ Layer: { Features: [] } });
  });

  it('should analyze images with vulnerabilities', async () => {
    const clairAddress = await fakeClair({
      analysis: {
        Layer: {
          Features: [
            { Vulnerabilities: [{ hi: 'hi' } ] }
          ]
        }
      }
    });
    const clair = new Clair({ clairAddress });

    const analysis = await clair.analyze({
      image: 'image',
      registry: fakeRegistry
    });

    expect(analysis.isVulnerable).to.equal(true);
    expect(analysis.vulnerabilities).to.eql([{ Vulnerabilities: [{ hi: 'hi' } ] }]);
  });

  it('should throw an error when the uploads fail', async () => {
    const clairAddress = await fakeClair({
      upload: (req, res, next) => {
        res.statusCode = 404;
        res.json({ upload: 'fail' });
      }
    });

    try {
      const clair = new Clair({ clairAddress });
      const analysis = await clair.analyze({
        image: 'image',
        registry: fakeRegistry
      });
    }
    catch (err) {
      expect(err.message).to.include('error uploading layers for image \'image\'');
      expect(err.message).to.match(/upload.*fail/);
    }
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });
});

const fakeRegistry = {
  getLayers: () => ([{  Name: 'first-name', Path: 'first-path' }, {  Name: 'name', Path: 'path' }])
};
