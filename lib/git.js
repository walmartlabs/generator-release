var _ = require('underscore'),
    async = require('async'),
    request = require('request'),
    childProcess = require('child_process'),
    dateFormat = require('dateformat'),
    fs = require('fs'),
    Github = require('github-api');

var config;

module.exports = {
  originName: function() {
    var cb = this.async(),
        self = this;
    childProcess.exec('git remote show -n origin', function(err, stdout, stderr) {
      if (err) {
        throw new Error('originName: ' + err.message);
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
        throw new Error('findFirstCommit: ' + err.message);
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
        throw new Error('commitTime: ' + err.message);
      }


      if (/Date:\s*(.*)/.exec(stdout)) {
        self.firstCommitTime = dateFormat(new Date(RegExp.$1), 'isoUtcDateTime');
      }
      cb();
    });
  },

  findChanges: function() {
    initConfig(this);

    var cb = this.async(),
        github = new Github(config),
        self = this;

    childProcess.exec('git log --oneline ' + this.firstCommit + '...' + (this.lastCommit || 'HEAD'), function(err, stdout, stderr) {
      if (err) {
        throw new Error('findChanges.log: ' + err.message);
      }

      var commits = _.compact(_.map(stdout.trim().split('\n'), function(line) {
            var info = /(\S+) (.*)/.exec(line);
            // Remove PR merge commits from the output since they don't add any value
            if (!info || info[2] && (info[2].indexOf('Merge pull request') === 0)) {
              return;
            }

            return {
              sha: info[1],
              title: info[2]
            };
          })),
          pulls = [],
          issues = [],
          links = [];

      var nameInfo = self.repoName.split('/'),
          repo = github.getRepo(nameInfo[0], nameInfo[1]);

      repo.listIssues({state: 'closed', since: self.firstCommitTime}, function(err, issuesQuery) {
        if (err) {
          console.log(err);
          throw new Error('findChanges.issues: ' + err.message);
        }
        _.each(issuesQuery, function(issue, index) {issue.index = index;});

        async.each(issuesQuery, function(issue, callback) {
            if (!issue.pull_request || !issue.pull_request.html_url) {
              // Include all non-pull request. The author can remove irrelevante ones.
              github.getIssue(nameInfo[0], nameInfo[1], issue.number).events(function(err, data) {
                if (err) {
                  console.log(err, data);
                  throw new Error(': ' + err.message);
                }

                var commitEvents = _.compact(_.filter(data, function(data) { return data.commit_id; }));
                if (commitEvents.length) {
                  if (listHasSha(commits, _.last(commitEvents).commit_id)) {
                    // Treat "Fixes" issues as pull requests
                    commitEvents = _.pluck(commitEvents, 'commit_id');
                    commits = _.filter(commits, function(commit) {
                      return !listHasSha(commitEvents, commit.sha);
                    });

                    pulls[issue.index] = _.defaults({
                      user: commitEvents[0].actor,

                      // Provide the info needed to do pingbacks
                      base: {
                        user: {
                          login: nameInfo[0]
                        },
                        repo: {
                          name: nameInfo[1]
                        }
                      }
                    }, issue);
                    links = extractLinks(issue.body, links);
                  }
                } else {
                  issues[issue.index] = issue;
                  links = extractLinks(issue.body, links);
                }
                callback();
              });
              return;
            }

            repo.getPull(issue.number, function(err, pull) {
              if (err) {
                console.log(err, issue);
                throw new Error('findChanges.pull: ' + err.message);
              }

              if (listHasSha(commits, pull.head.sha)) {
                // If we see the head commit for the pull in our history then add it to our list
                // and remove all commits from the pull from the list of commits
                pulls[issue.index] = pull;
                links = extractLinks(pull.body, links);

                fetchGithub(pull.commits_url, function(data) {
                  var pullCommits = _.pluck(data, 'sha');
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
              throw new Error('findChanges: ' + err.message);
            }

            self.commits = commits;
            self.pulls = _.compact(pulls);
            self.issues = _.compact(issues);
            self.links = links;
            cb();
          });
      });
    });
  },

  pingPullRequests: function() {
    initConfig(this);

    var github = new Github(config),
        self = this,
        cb = this.async();

    if (this.pulls.length) {
      self.log('Commenting on ' + _.pluck(this.pulls, 'number').join(', '));
    }

    async.forEachSeries(this.pulls, function(pull, cb) {
        var base = pull.base,
            issue = github.getIssue(base.user.login, base.repo.name, pull.number);
        issue.comment('Released in ' + self.version, function(err, msg) {
          if (err) {
            console.error(err);
            throw new Error(': ' + err.message);
          }
          self.log('  Commented on #' + pull.number);
          cb();
        });
      },
      cb);
  },

  findWritable: function() {
    initConfig(this);

    var github = new Github(config),
        self = this,
        cb = this.async();

    var repo = this.repo.split('/');
    repo = github.getRepo(repo[0], repo[1]);

    repo.show(function(err, data) {
      if (err) {
        throw new Error('findWritable: ' + err.message);
      }

      if (data.permissions.push) {
        self.pushRepo = data.ssh_url;
        cb();
      } else {
        self.upstreamRepo = data.ssh_url;

        // Check our own user to see if we have a repo that is a fork of this repo
        var user = github.getUser();
        user.repos(function(err, repos) {
          if (err) {
            throw new Error('findWritable.repos: ' + err.message);
          }

          async.map(repos, function(repo, cb) {
              if (repo.fork) {
                var components = repo.full_name.split('/');
                github.getRepo(components[0], components[1]).show(cb);
              } else {
                cb();
              }
            },
            function(err, repos) {
              if (err) {
                throw new Error('findWritable.get: ' + err.message);
              }

              var fork = _.find(repos, function(repo) {
                return repo && repo.parent && repo.parent.full_name === self.repo;
              });

              if (fork) {
                self.pushRepo = fork.ssh_url;
                self.isFork = true;
              }
              cb();
            });
        });
      }
    });
  },

  pullRequest: function() {
    initConfig(this);

    if (!this.isFork) {
      return;
    }

    var github = new Github(config),
        self = this,
        cb = this.async();

    var repo = this.repo.split('/'),
        source = this.pushRepo.replace(/.*:(.*)\/(.*)\.git/, '$1:') + this.branchName;
    repo = github.getRepo(repo[0], repo[1]);
    repo.createPullRequest({
        title: this.commitMsg,
        base: 'master',
        head: source
      },
      function(err, data) {
        if (err) {
          console.log(err);
          throw new Error('pullRequest: ' + err.message);
        }

        console.log('Created pull request #' + data.number);
        console.log(data.html_url);
        cb();
      });
  },

  fork: function() {
    if (this.pushRepo) {
      return;
    }

    initConfig(this);
    var github = new Github(config),
        self = this,
        cb = this.async();

    var repo = this.repo.split('/');
    repo = github.getRepo(repo[0], repo[1]);
    repo.fork(function(err, data) {
      if (err) {
        throw new Error('fork: ' + err.message);
      }

      // Arbitrary timeout to aboid race condtion with github apis
      setTimeout(function() {
        self.pushRepo = data.ssh_url;
        self.isFork = true;
        cb();
      }, 10000);
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

  clone: function() {
    initConfig(this);

    var repoPath = (config.staging || '/tmp') + '/' + this.repo.replace('/', '_'),
        cb = this.async(),
        self = this;

    if (!fs.existsSync(repoPath + '/.git')) {
      execSeries(this, [['git', ['clone', this.pushRepo, repoPath]]],
        function() {
          self.destinationRoot(repoPath);

          if (self.isFork) {
            execSeries(self, [['git', ['remote', 'add', 'upstream', self.upstreamRepo]]], cb);
          } else {
            cb();
          }
        });
    } else {
      this.destinationRoot(repoPath);

      var operations = [
        ['git', ['pull', '--ff-only']]
      ];
      if (this.isFork) {
        operations.push(['git', ['fetch', 'upstream']]);
        operations.push(['git', ['merge', 'upstream/master']]);
        operations.push(['git', ['push']]);
      }
      execSeries(this, operations, cb);
    }
  },

  reset: function() {
    initConfig(this);

    var cb = this.async();

    execSeries(this, [
        ['git', ['checkout', 'master']]
      ],
      cb);
  },

  branch: function() {
    if (!this.branchName) {
      return;
    }

    initConfig(this);

    var cb = this.async();

    execSeries(this, [
        ['git', ['checkout', '-b', this.branchName]]
      ],
      cb);
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
          throw new Error('tag: ' + err.message);
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
        throw new Error('ensureClean: ' + err.message);
      }

      if (stdout.length) {
        throw new Error('Git repository "' + process.cwd() + '" must be clean');
      } else {
        cb();
      }
    });
  },

  ensureFetched: function() {
    var cb = this.async();
    childProcess.exec('git fetch', function(err, stdout, stderr) {
      if (err) {
        throw new Error('ensureFetched.fetch: ' + err.message);
      }

      childProcess.exec('git branch -v --no-color | grep -e "^\\*"', function(err, stdout, stderr) {
        if (err) {
          throw new Error('ensureFetched.branch: ' + err.message);
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

    var push = ['push'];
    if (this.branchName) {
      push.push('-u', 'origin', this.branchName);
    }

    execSeries(this, [
        ['git', push],
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
            throw new Error('Failed executing ' + args + '\n  cwd: ' + process.cwd() + '\n' + err);
          })
          .on('exit', function(code) {
            if (code) {
              throw new Error('Failed executing ' + args + '\n  cwd: ' + process.cwd() + '\n');
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
  });
}

function fetchGithub(url, callback) {
  var options = {
    url: url,
    headers: {
      'User-Agent': 'generator-release',
      'Authorization': 'token '+ config.token
    }
  };

  request(options, function (error, response, body) {
    if (error) {
      console.log(error, url);
      throw new Error('fetchGithub ' + url + ': ' + error.message);
    }
    callback(JSON.parse(body));
  });
}

function initConfig(generator) {
  config = require('./config')(generator);
}

function extractLinks(text, links) {
  // WARN: Must be used after initConfig has veen called.
  if (!text || !config.linkFilter) {
    return links;
  }

  var foundLinks = [];

  // Pull out any explicit markdown links
  text = text.replace(/(!)?\[([^\]\n]*)\]\(([^\)\n]*)\)/g, function(match, img, title, url) {
    if (!img) {
      foundLinks.push({title: title, url: url});
    }

    // Remove from the list
    return '';
  });

  // Scan the rest for things that might look like urls.
  _.each(text.split(/[\s\(\)\[\]"']+/), function(token) {
    if (/:\/\//.exec(token)) {
      foundLinks.push({title: token, url: token});
    }
  });

  if (config.linkFilter) {
    foundLinks = _.filter(foundLinks, config.linkFilter);
  }

  var union = {};
  _.each(links, function(v) {
    union[v.url] = v.title;
  });
  _.each(foundLinks, function(v) {
    union[v.url] = v.title;
  });
  
  return _.sortBy(_.map(union, function(value, key) {return {title: value, url: key};}), 'title');
}
