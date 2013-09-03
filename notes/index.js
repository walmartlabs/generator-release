'use strict';
var fs = require('fs'),
    dateFormat = require('dateformat'),
    git = require('../lib/git'),
    path = require('path'),
    util = require('util'),
    semver = require('semver'),
    yeoman = require('yeoman-generator');

var ReleaseNotesGenerator = module.exports = function ReleaseNotesGenerator(args, options, config) {
  yeoman.generators.NamedBase.apply(this, arguments);

  this.option('dry-run', {
    desc: 'Finds the changes that will be recorded and log to the console rather than disk',
    type: 'Boolean'
  });
  this.dryRun = options['dry-run'];

  this.date = dateFormat(new Date(), 'mmmm dS, yyyy');

  if (this.name !== 'major' && this.name !== 'minor' && this.name !== 'patch') {
    throw new Error('"' + this.name + '" must be one of {major, minor, patch}');
  }
};

util.inherits(ReleaseNotesGenerator, yeoman.generators.NamedBase);

ReleaseNotesGenerator.prototype.ensureClean = git.ensureClean;
ReleaseNotesGenerator.prototype.ensureFetched = git.ensureFetched;

ReleaseNotesGenerator.prototype.readVersions = function() {
  var config;
  try {
    config = JSON.parse(fs.readFileSync('bower.json'));
  } catch (err) {
    config = JSON.parse(fs.readFileSync('package.json'));
  }

  this.priorVersion = 'v' + config.version;
  this.version = 'v' + semver.inc(this.priorVersion, this.name);
};

ReleaseNotesGenerator.prototype.loadNotes = function() {
  try {
    this.existing = fs.readFileSync('RELEASE.md');
    this.notesName = 'RELEASE.md';
  } catch (err) {
    try {
      this.existing = fs.readFileSync('release-notes.md');
      this.notesName = 'release-notes.md';
    } catch (err) {
      /* NOP */
    }
  }

  if (this.existing) {
    this.existing = this.existing.toString();
    this.firstCommit = this.priorVersion;
  }
};

ReleaseNotesGenerator.prototype.originName = git.originName;
ReleaseNotesGenerator.prototype.findFirstCommit = git.findFirstCommit;
ReleaseNotesGenerator.prototype.commitTime = git.commitTime;
ReleaseNotesGenerator.prototype.findChanges = git.findChanges;

ReleaseNotesGenerator.prototype.updateNotes = function() {
  if (this.dryRun) {
    this.log.write(this.engine(this.read('_version.md'), this));
    return;
  }

  var notes = this.existing;
  if (!notes) {
    notes = this.engine(this.read('_release-notes.md'), this);
  }

  notes = notes.replace(/\.\.\.master/, '...' + this.version);
  notes = notes.replace(/## Development\n/, '## Development\n' + this.engine(this.read('_version.md'), this));
  fs.writeFileSync(this.notesName || 'release-notes.md', notes);
};
