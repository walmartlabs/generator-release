module.exports = function(generator) {
  var path = generator.options.config || '~/.config/generator-release';
  path = path.replace(/^~\//, getUserHome() + '/');
  return require(path);
};

// http://stackoverflow.com/questions/9080085/node-js-find-home-directory-in-platform-agnostic-way
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}
