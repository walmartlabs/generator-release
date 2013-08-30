'use strict';
var fs = require('fs'),
    git = require('../lib/git'),
    path = require('path'),
    util = require('util'),
    semver = require('semver'),
    yeoman = require('yeoman-generator');

var ReleaseGenerator = module.exports = function ReleaseGenerator(args, options, config) {
  yeoman.generators.NamedBase.apply(this, arguments);
  if (this.name !== 'major' && this.name !== 'minor' && this.name !== 'patch') {
    throw new Error('"' + this.name + '" must be one of {major, minor, patch}');
  }
};

util.inherits(ReleaseGenerator, yeoman.generators.NamedBase);

ReleaseGenerator.prototype.ensureClean = git.ensureClean;
ReleaseGenerator.prototype.ensureFetched = git.ensureFetched;

ReleaseGenerator.prototype.runTest = function() {
  if (!fs.existsSync('package.json')) {
    return;
  }

  var cb = this.async();

  this.spawnCommand('npm', ['test'])
      .on('error', function(err) {
        throw err;
      })
      .on('exit', function(code) {
        if (code) {
          throw new Error('Tests failed');
        } else {
          cb();
        }
      });
};

ReleaseGenerator.prototype.readVersions = function() {
  var bowerConfig = JSON.parse(fs.readFileSync('bower.json'));

  this.bowerConfig = bowerConfig;
  this.priorVersion = bowerConfig.version;
  this.version = semver.inc(this.priorVersion, this.name);
};

ReleaseGenerator.prototype.incrementVersion = function() {
  console.log('Incrementing ' + this.priorVersion.yellow + ' to ' + this.version.yellow);
  this.bowerConfig.version = this.version;
  fs.writeFileSync('bower.json', JSON.stringify(this.bowerConfig, undefined, 2) + '\n');

  git.addCommit(this, 'bower.json', 'v' + this.version);
};

ReleaseGenerator.prototype.tag = function() {
  git.tag(this, 'v' + this.version);
};

ReleaseGenerator.prototype.push = git.push;
