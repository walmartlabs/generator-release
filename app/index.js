var _ = require('underscore'),
    bower = require('bower'),
    childProcess = require('child_process'),
    CollectVersions = require('../collect-versions'),
    fs = require('fs'),
    request = require('request'),
    util = require('util'),
    semver = require('semver'),
    yeoman = require('yeoman-generator');

var AppGenerator = module.exports = function AppGenerator(args, options, config) {
  yeoman.generators.Base.apply(this, arguments);
};

util.inherits(AppGenerator, yeoman.generators.Base);

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
