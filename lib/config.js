var _ = require('underscore');

module.exports = function(generator) {
  var path = generator.options.config || '~/.config/generator-release';
  path = path.replace(/^~\//, getUserHome() + '/');

  var config = _.clone(require(path)),
      host = generator.host;
  if (host && config.hosts && config.hosts[host]) {
    _.extend(config, config.hosts[host]);
  }
  return config;
};

// http://stackoverflow.com/questions/9080085/node-js-find-home-directory-in-platform-agnostic-way
function getUserHome() {
  return process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
}
