const pkg = require('../package.json');

function getVersion() {
  return pkg.version;
}

function isBeta() {
  return process.env.BETA || pkg.beta > 0;
}

exports.getVersion = getVersion;
exports.isBeta = isBeta;
