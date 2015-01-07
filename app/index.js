var git = require('../lib/git'),
    util = require('util'),
    ReleaseGenerator = require('../release'),
    yeoman = require('yeoman-generator');

var AppGenerator = module.exports = function AppGenerator(args, options) {
  yeoman.generators.Base.apply(this, arguments);

  this.option('skip-tests', {
    desc: 'Skips tests. This is not recommended but can be used to work around environmental issues.',
    type: 'Boolean'
  });
  this.skipTests = options['skip-tests'];
};

util.inherits(AppGenerator, yeoman.generators.Base);

AppGenerator.prototype.ensureEditor = function() {
  if (!process.env.EDITOR) {
    throw new Error('$EDITOR environmental variable must be set when using `yo release` command.');
  }
};

AppGenerator.prototype.ensureClean = git.ensureClean;
AppGenerator.prototype.ensureFetched = git.ensureFetched;

AppGenerator.prototype.runTest = ReleaseGenerator.prototype.runTest;

AppGenerator.prototype.completeTests = function() {
  // We ran the tests in the prior step, if we are going do. Don't do it again.
  this.options['skip-tests'] = true;
};

AppGenerator.prototype.execNotes = exec('notes');
AppGenerator.prototype.execRelease = exec('release');

function exec(name) {
  return function() {
    var done = this.async();

    var collect = this.env.create('release:' + name, {
      args: this.args,
      options: this.options
    });
    collect.run(this.args, done);
  };
}
