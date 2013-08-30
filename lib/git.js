var _ = require('underscore'),
    async = require('async'),
    childProcess = require('child_process'),
    dateFormat = require('dateformat'),
    fs = require('fs'),
    Github = require('github-api');

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

  findChanges: function() {
    var cb = this.async(),
        github = new Github(require(getUserHome() + '/.config/generator-release')),
        self = this;

    childProcess.exec('git log --max-parents=1 --oneline ' + this.firstCommit + '...HEAD', function(err, stdout, stderr) {
      if (err) {
        throw err;
      }

      var commits = _.map(stdout.trim().split('\n'), function(line) {
            var info = /(\S+) (.*)/.exec(line);
            return {
              sha: info[1],
              title: info[2]
            };
          }),
          pulls = [],
          issues = [];

      var nameInfo = self.repoName.split('/'),
          repo = github.getRepo(nameInfo[0], nameInfo[1]);

      repo.listIssues({state: 'closed', since: self.firstCommitTime}, function(err, issuesQuery) {
        if (err) {
          throw err;
        }

        async.each(issuesQuery, function(issue, callback) {
            if (!issue.pull_request || !issue.pull_request.html_url) {
              // Include all non-pull request. The author can remove irrelevante ones.
              issues.push(issue);
              return callback();
            }

            repo.getPull(issue.number, function(err, pull) {
              if (err) {
                console.log(err, issue);
                throw err;
              }

              if (listHasSha(commits, pull.head.sha)) {
                // If we see the head commit for the pull in our history then add it to our list
                // and remove all commits from the pull from the list of commits
                pulls.push(pull);
                childProcess.exec('git rev-list ' + pull.base.sha + '...' + pull.head.sha, function(err, stdout, stderr) {
                  var pullCommits = stdout.trim().split('\n');
                  commits = _.filter(commits, function(commit) {
                    return !listHasSha(pullCommits, commit.sha);
                  });

                  callback();
                });
              } else {
                callback();
              }
            });
          },
          function(err) {
            if (err) {
              throw err;
            }

            self.commits = commits;
            self.pulls = pulls;
            self.issues = issues;
            cb();
          });
      });
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

function listHasSha(list, sha) {
  return _.find(list, function(commit) {
    commit = commit.sha || commit;

    if (commit.length < sha.length) {
      return sha.indexOf(commit) === 0;
    } else {
      return commit.indexOf(sha) === 0;
    }
    return ret;
  });
}

// http://stackoverflow.com/questions/9080085/node-js-find-home-directory-in-platform-agnostic-way
function getUserHome() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}
