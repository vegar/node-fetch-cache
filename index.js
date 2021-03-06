const fetch = require('node-fetch');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function getResponse(cacheDirPath, requestArguments, bodyFunctionName) {
  const [url, requestInit, ...rest] = requestArguments;
  const requestParams = requestInit.body
    ? Object.assign({}, requestInit, {body: typeof requestInit.body === 'object' ? requestInit.body.toString() : requestInit.body})
    : requestInit;

  const cacheHash = md5(JSON.stringify([url, requestParams, ...rest]) + bodyFunctionName);
  const cachedFilePath = path.join(cacheDirPath, `${cacheHash}.json`);

  try {
    const body = JSON.parse(await fs.promises.readFile(cachedFilePath));
    if (bodyFunctionName === 'buffer') {
      return Buffer.from(body);
    }

    return body;
  } catch (err) {
    const fetchResponse = await fetch(...requestArguments);
    const bodyResponse = await fetchResponse[bodyFunctionName]();
    await fs.promises.writeFile(cachedFilePath, JSON.stringify(bodyResponse));
    return bodyResponse;
  }
}

class ResponseWrapper {
  constructor(cacheDirPath, requestArguments) {
    this.cacheDirPath = cacheDirPath;
    this.requestArguments = requestArguments;
  }

  text() {
    return getResponse(this.cacheDirPath, this.requestArguments, this.text.name);
  }

  json() {
    return getResponse(this.cacheDirPath, this.requestArguments, this.json.name);
  }

  buffer() {
    return getResponse(this.cacheDirPath, this.requestArguments, this.buffer.name);
  }

  textConverted() {
    return getResponse(this.cacheDirPath, this.requestArguments, this.textConverted.name);
  }
}

function createFetch(cacheDirPath) {
  let madeDir = false;

  return async (...args) => {
    if (!madeDir) {
      try {
        await fs.promises.mkdir(cacheDirPath, { recursive: true });
      } catch (err) {
        // Ignore.
      }

      madeDir = true;
    }

    return new ResponseWrapper(cacheDirPath, args);
  };
}

module.exports = createFetch;
