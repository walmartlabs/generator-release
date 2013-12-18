var _ = require('underscore'),
    childProcess = require('child_process'),
    Config = require('../lib/config'),
    fs = require('fs'),
    git = require('../lib/git'),
    request = require('request'),
    util = require('util'),
    semver = require('semver'),
    yeoman = require('yeoman-generator');

var PublishVersion = module.exports = function PublishVersion(args, options, config) {
  yeoman.generators.Base.apply(this, arguments);

  this.sourceRoot('.');

  this.argument('type', {desc: 'Deploy type. May be one of {cdnjs, components}', required: true});
  this.argument('name', {desc: 'Project repository name', required: true});
  this.argument('buildDir', {desc: 'Directory containing artifacts to deploy', required: true});
};

util.inherits(PublishVersion, yeoman.generators.Base);

PublishVersion.prototype.readVersions = function() {
  var bowerConfig,
      packageConfig;

  try {
    bowerConfig = JSON.parse(fs.readFileSync('bower.json'));
  } catch (err) {
    /* NOP */
  }
  try {
    packageConfig = JSON.parse(fs.readFileSync('package.json'));
  } catch (err) {
    /* NOP */
  }

  this.version = (bowerConfig || packageConfig).version;
};

PublishVersion.prototype.configure = function() {
  if (this.type === 'cdnjs') {
    this.repo = 'cdnjs/cdnjs';
    this.commitDir = './ajax/libs/' + this.name;
    this.path = this.commitDir + '/' + this.version;
    this.packagePath = this.commitDir + '/package.json';
    this.commitMsg = '[author] Update ' + this.name + ' to v' + this.version;
  } else if (this.type === 'components') {
    this.repo = 'components/' + this.name;
    this.commitDir = this.path = './';
    this.commitMsg = 'Update to v' + this.version;
  } else {
    throw new Error('First argument must be one of {cdnjs, components}');
  }
};

PublishVersion.prototype.determineRepo = git.findWritable;

PublishVersion.prototype.fork = git.fork;
PublishVersion.prototype.clone = git.clone;

PublishVersion.prototype.ensureClean = git.ensureClean;
PublishVersion.prototype.ensureFetched = git.ensureFetched;

PublishVersion.prototype.checkBranch = function() {
  if (this.isFork) {
    this.branchName = this.name + '-v' + this.version;
  } else {
    this.branch = function() {};
    this.pullRequest = function() {};
  }
};
PublishVersion.prototype.branch = git.branch;

PublishVersion.prototype.updateFiles = function() {
  this.directory(this.buildDir, this.path);

  if (this.packagePath) {
    var packageConfig = JSON.parse(fs.readFileSync(this.packagePath));
    packageConfig.version = this.version;
    fs.writeFileSync(this.packagePath, JSON.stringify(packageConfig, undefined, 4) + '\n');
  }
};

PublishVersion.prototype.add = function() {
  git.addCommit(this, this.commitDir, this.commitMsg);
};

PublishVersion.prototype.tag = function() {
  if (!this.isFork && this.type === 'components') {
    git.tag(this, 'v' + this.version);
  }
};

PublishVersion.prototype.push = git.push;

PublishVersion.prototype.pullRequest = git.pullRequest;

PublishVersion.prototype.reset = git.reset;
