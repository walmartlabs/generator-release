'use strict';
var childProcess = require('child_process'),
    fs = require('fs'),
    dateFormat = require('dateformat'),
    git = require('../lib/git'),
    path = require('path'),
    util = require('util'),
    semver = require('semver'),
    yeoman = require('yeoman-generator');

var ReleaseNotesGenerator = module.exports = function ReleaseNotesGenerator(args, options, config) {
  yeoman.generators.Base.apply(this, arguments);

  this.date = dateFormat(new Date(), 'mmmm dS, yyyy');

  this.option('dry-run', {
    desc: 'Finds the changes that will be recorded and log to the console rather than disk',
    type: 'Boolean'
  });
  this.dryRun = options['dry-run'];

  this.option('rebuild', {
    desc: 'Specifes that we want to create notes for the existing version',
    type: 'Boolean'
  });
  this.rebuild = options.rebuild;
};

util.inherits(ReleaseNotesGenerator, yeoman.generators.Base);

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
      try {
        this.existing = fs.readFileSync('CHANGELOG.md');
        this.notesName = 'CHANGELOG.md';
      } catch (err) {
        this.notesName = 'release-notes.md';
      }
    }
  }

  if (this.existing) {
    this.existing = this.existing.toString();
    this.firstCommit = this.priorVersion;
  }
};

ReleaseNotesGenerator.prototype.checkRebuild = function() {
  if (this.rebuild) {
    if (!this.firstCommit) {
      throw new Error('Rebuild specified but no existing release notes found');
    }

    var matcher = new RegExp('/([^/]*)\\.\\.\\.' + this.firstCommit.replace(/\./g, '\\.')),
        priorVersion = (matcher.exec(this.existing) || [])[1];
    if (!priorVersion) {
      throw new Error('Unable to find previous version in release notes');
    }

    this.lastCommit = this.firstCommit;
    this.firstCommit = priorVersion;
  }
};

ReleaseNotesGenerator.prototype.originName = git.originName;
ReleaseNotesGenerator.prototype.findFirstCommit = git.findFirstCommit;
ReleaseNotesGenerator.prototype.commitTime = git.commitTime;
ReleaseNotesGenerator.prototype.findChanges = git.findChanges;

ReleaseNotesGenerator.prototype.generateNotes = function() {
  var self = this;
  this.notesContent = this.engine(this.read('_log.md'), this);

  if (process.env.EDITOR) {
    var temp = require('temp');
    var done = this.async();

    temp.track();
    temp.open('notes', function(err, info) {
      if (err) {
        throw err;
      }

      fs.writeSync(info.fd, self.notesContent);
      fs.closeSync(info.fd);

      childProcess.spawn(process.env.EDITOR, [info.path], {
        stdio: [
          process.stdin,
          process.stdout,
          process.stderr
        ]
      })
      .on('error', function(err) {
          throw err;
      })
      .on('exit', function() {

        self.notesContent = fs.readFileSync(info.path).toString();
        if (!self.notesContent) {
          throw new Error('No content entered for notes');
        }

        self.commit = true;
        done();
      });
    });
  }
};

ReleaseNotesGenerator.prototype.askVersions = function() {
  var self = this,
      done = this.async();

  this.prompt({
    type: 'list',
    name: 'increment',
    message: 'Version increment',
    choices: ['major', 'minor', 'patch', 'prerelease', 'custom']
  }, function(props) {
    self.increment = props.increment;

    if (props.increment === 'custom') {
      self.prompt({
        name: 'custom',
        message: 'Please enter new version',
        default: self.priorVersion
      }, function(props) {
        if (!semver.valid(props.custom)) {
          throw new Error('"' + props.custom + '" is not a valid version');
        }
        if (!semver.gt(props.custom, self.priorVersion)) {
          throw new Error('"' + props.custom + '" must be larger than "' + self.priorVersion + '"');
        }
        if (/^v(.*)$/.test(props.custom)) {
          props.custom = RegExp.$1;
        }

        self.version = 'v' + props.custom;
        done();
      });
    } else {
      self.version = 'v' + semver.inc(self.priorVersion, self.increment || 'patch');
      done();
    }
  });
};

ReleaseNotesGenerator.prototype.updateNotes = function() {
  if (this.dryRun) {
    this.log.write(this.notesContent);
    return;
  }

  this.notesContent = this.engine(this.read('_version.md'), this) + this.notesContent;

  var notes = this.existing;
  if (!notes) {
    notes = this.engine(this.read('_release-notes.md'), this);
  }

  notes = notes.replace(/\.\.\.master/, '...' + this.version);
  notes = notes.replace(/## Development\n/, '## Development\n' + this.notesContent);
  fs.writeFileSync(this.notesName, notes);
};

ReleaseNotesGenerator.prototype.notes = function() {
  if (!this.dryRun) {
    if (this.commit) {
      git.addCommit(this, this.notesName, 'Update release notes');
    } else {
      console.log(this.notesName + ' updated with latest release notes. Please review and commit prior to final release.');
    }
  }
};

ReleaseNotesGenerator.prototype.recordIncrement = function() {
  if (!this.dryRun) {
    fs.writeFileSync('.generator-release', JSON.stringify({increment: this.increment, version: this.version}));
  }
};
