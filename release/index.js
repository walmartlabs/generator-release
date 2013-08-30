'use strict';
var fs = require('fs'),
    git = require('../lib/git'),
    path = require('path'),
    util = require('util'),
    semver = require('semver'),
    yeoman = require('yeoman-generator');

var ReleaseGenerator = module.exports = function ReleaseGenerator(args, options, config) {
  yeoman.generators.NamedBase.apply(this, arguments);
  if (this.name !== 'major' && this.name !== 'minor' && this.name !== 'patch' && this.name !== 'prerelease') {
    throw new Error('"' + this.name + '" must be one of {major, minor, patch, prerelease}');
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
  try {
    this.bowerConfig = JSON.parse(fs.readFileSync('bower.json'));
  } catch (err) {
    /* NOP */
  }
  try {
    this.packageConfig = JSON.parse(fs.readFileSync('package.json'));
  } catch (err) {
    /* NOP */
  }

  this.priorVersion = (this.bowerConfig || this.packageConfig).version;
  this.version = semver.inc(this.priorVersion, this.name);
};

ReleaseGenerator.prototype.incrementVersion = function() {
  console.log('Incrementing ' + this.priorVersion.yellow + ' to ' + this.version.yellow);

  var files = [];
  if (this.bowerConfig) {
    this.bowerConfig.version = this.version;
    fs.writeFileSync('bower.json', JSON.stringify(this.bowerConfig, undefined, 2) + '\n');
    files.push('bower.json');
  }
  if (this.packageConfig) {
    this.packageConfig.version = this.version;
    fs.writeFileSync('package.json', JSON.stringify(this.packageConfig, undefined, 2) + '\n');
    files.push('package.json');
  }

  if (files.length) {
    git.addCommit(this, files, 'v' + this.version);
  } else {
    throw new Error('No config files written');
  }
};

ReleaseGenerator.prototype.tag = function() {
  git.tag(this, 'v' + this.version);
};

ReleaseGenerator.prototype.push = git.push;
