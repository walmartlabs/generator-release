var async = require('async'),
    childProcess = require('child_process'),
    dateFormat = require('dateformat'),
    fs = require('fs');

module.exports = {
  originName: function() {
    var cb = this.async(),
        self = this;
    childProcess.exec('git remote show -n origin', function(err, stdout, stderr) {
      if (err) {
        throw err;
      }

      if (/Fetch URL: .*github.com[:\/]?(.*)\.git/.exec(stdout)) {
        self.repoName = RegExp.$1;
      }
      cb();
    });
  },
  findFirstCommit: function() {
    if (this.firstCommit) {
      return;
    }

    var cb = this.async(),
        self = this;
    childProcess.exec('git rev-list HEAD --max-parents=0 --abbrev-commit', function(err, stdout, stderr) {
      if (err) {
        throw err;
      }

      self.firstCommit = stdout.split('\n')[0];
      cb();
    });
  },

  commitTime: function() {
    var cb = this.async(),
        self = this;
    childProcess.exec('git show ' + this.firstCommit, function(err, stdout, stderr) {
      if (err) {
        throw err;
      }


      if (/Date:\s*(.*)/.exec(stdout)) {
        self.firstCommitTime = dateFormat(new Date(RegExp.$1), 'isoUtcDateTime');
      }
      cb();
    });
  },

  initialCommit: function() {
    if (!fs.existsSync('.git')) {
      var cb = this.async();
      execSeries(this, [
          ['git', ['init']],
          ['git', ['add'].concat(fs.readdirSync(this.destinationRoot()))],
          ['git', ['commit', '-m', 'Initial commit']]
        ],
        cb);
    }
  },

  addCommit: function(task, path, message) {
    var cb = task.async();

    execSeries(task, [
        ['git', ['add'].concat(path)],
        ['git', ['commit', '-m', message]]
      ],
      cb);
  },

  tag: function(task, name) {
    var cb = task.async();

    task.spawnCommand('git', ['tag', '-a', '--message=' + name, name])
        .on('error', function(err) {
          throw err;
        })
        .on('exit', function(code) {
          if (code) {
            throw new Error('Failed tagging ' + name + ' code: ' + code);
          } else {
            cb();
          }
        });
  },

  ensureClean: function() {
    var cb = this.async();
    childProcess.exec('git diff-index --name-only HEAD --', function(err, stdout, stderr) {
      if (err) {
        throw err;
      }

      if (stdout.length) {
        throw new Error('Git repository must be clean');
      } else {
        cb();
      }
    });
  },

  ensureFetched: function() {
    var cb = this.async();
    childProcess.exec('git fetch', function(err, stdout, stderr) {
      if (err) {
        throw err;
      }

      childProcess.exec('git branch -v --no-color | grep -e "^\\*"', function(err, stdout, stderr) {
        if (err) {
          throw err;
        }

        if (/\[behind (.*)\]/.test(stdout)) {
          throw new Error('Your repo is behind by ' + RegExp.$1 + ' commits');
        }

        cb();
      });
    });
  },

  push: function() {
    var cb = this.async();

    execSeries(this, [
        ['git', ['push']],
        ['git', ['push', '--tags']]
      ],
      cb);
  }
};


function execSeries(self, args, cb) {
  async.eachSeries(
    args,
    function(args, callback) {
      self.spawnCommand.apply(self, args)
          .on('error', function(err) {
            throw err;
          })
          .on('exit', function(code) {
            if (code) {
              throw new Error('Failed executing ' + args);
            } else {
              callback();
            }
          });
    },
    cb);
}
