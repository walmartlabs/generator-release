var _ = require('underscore'),
    bower = require('bower'),
    childProcess = require('child_process'),
    CollectVersions = require('../collect-versions'),
    fs = require('fs'),
    request = require('request'),
    util = require('util'),
    semver = require('semver'),
    yeoman = require('yeoman-generator');

var DiffGenerator = module.exports = function DiffGenerator(args, options, config) {
  yeoman.generators.Base.apply(this, arguments);

  this.argument('previous', {'desc': 'Previous version information', required: true});
  this.argument('current', {'desc': 'Current version information', required: true});
};

util.inherits(DiffGenerator, yeoman.generators.Base);


DiffGenerator.prototype.collectPrevious = collect('previous');
DiffGenerator.prototype.collectCurrent = collect('current');

DiffGenerator.prototype.dataCheck = function() {
  if (this.previous[0].bowerRoot !== this.current[0].bowerRoot
      || this.previous[0].npmRoot !== this.current[0].npmRoot) {
    throw new Error('Bower/NPM mismatch');
  }

  this.isBower = this.previous[0].bowerRoot;
};

DiffGenerator.prototype.diffVersions = function() {
  function byName(coll, name) {
    return _.findWhere(coll, {name: name});
  }

  var added = [],
      changed = [],
      removed = [];
  _.each(this.previous, function(previous) {
    var current = byName(this.current, previous.name);
    if (previous.version !== (current && current.version)) {
      if (current) {
        changed.push({ name: previous.name, previous: previous.version, current: current.version, bowerRoot: previous.bowerRoot, npmRoot: previous.npmRoot });
      } else {
        removed.push(previous);
      }
    }
  }, this);
  _.each(this.current, function(current) {
    if (!byName(this.previous, current.name) && !byName(changed, current.name)) {
      added.push(current);
    }
  }, this);

  this.added = added;
  this.changed = changed;
  this.removed = removed;
};

DiffGenerator.prototype.findNotes = function() {
  var self = this;
  _.each(this.changed, function(change) {
    var packageDir, notes;

    if (self.isBower) {
      packageDir = change.bowerRoot ? '' : bower.config.directory + '/' + change.name + '/';
    } else {
      packageDir = change.npmRoot ? '' : 'node_modules/' + change.name.replace(/\//g, '/node_modules/') + '/';
    }

    try {
      notes = fs.readFileSync(packageDir + 'RELEASE.md');
    } catch (err) {
      try {
        notes = fs.readFileSync(packageDir + 'release-notes.md');
      } catch (err) {
        try{
          notes = fs.readFileSync(packageDir + 'CHANGELOG.md');
        } catch (err) {
          notes = '';
        }
      }
    }

    notes = notes.toString().split(/## /g);
    notes = _.map(notes, function(note) {
      var version = (/^(\S+)/.exec(note) || [])[1];

      try {
        if (semver.gt(version, change.previous)) {
          return '## ' + note;
        }
      } catch (err) {
        /* NOP */
      }
    });
    change.notes = notes.join('');
  });
};

DiffGenerator.prototype.output = function() {
  var out = '',
      self = this;
  if (this.added.length) {
    _.each(this.added, function(added) {
      out += '# ' + added.name + '\n';
      out += 'Added at ' + added.version + '\n';
      out += '\n';
    });
  }
  if (this.changed.length) {
    _.each(this.changed, function(change) {
      out += '# ' + change.name + '\n';
      out += change.previous + ' -> ' + change.current + '\n';
      out += change.notes;
      out += '\n';
    });
  }
  if (this.removed.length) {
    out += '# Removed\n';
    _.each(this.removed, function(removed) {
      out += '# ' + removed.name + '\n';
      out += 'Removed. Was ' + removed.version + '\n';
      out += '\n';
    });
  }

  if (!out) {
    out = 'No changes';
  }

  console.log(out);
};

function collect(name) {
  return function() {
    if (this[name] === 'bower' || this[name] === 'npm' || /:/.test(this[name])) {
      var done = this.async(),
          self = this;

      var args = this[name].split(/:/);
      if (args.length > 2) {
        args = [args.shift(), args.join(':')];
      }
      var collect = this.env.create('release:collect-versions', {
        args: args
      });
      collect.quiet = true;

      collect.run(args, function() {
        self[name] = collect.versions;
        done();
      });
    } else {
      this[name] = JSON.parse(fs.readFileSync(this[name]));
    }
  };
}
