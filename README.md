***
# NOTICE:

## This repository has been archived and is not supported.

[![No Maintenance Intended](http://unmaintained.tech/badge.svg)](http://unmaintained.tech/)
***
NOTICE: SUPPORT FOR THIS PROJECT HAS ENDED 

This projected was owned and maintained by Walmart. This project has reached its end of life and Walmart no longer supports this project.

We will no longer be monitoring the issues for this project or reviewing pull requests. You are free to continue using this project under the license terms or forks of this project at your own risk. This project is no longer subject to Walmart's bug bounty program or other security monitoring.


## Actions you can take

We recommend you take the following action:

  * Review any configuration files used for build automation and make appropriate updates to remove or replace this project
  * Notify other members of your team and/or organization of this change
  * Notify your security team to help you evaluate alternative options

## Forking and transition of ownership

For [security reasons](https://www.theregister.co.uk/2018/11/26/npm_repo_bitcoin_stealer/), Walmart does not transfer the ownership of our primary repos on Github or other platforms to other individuals/organizations. Further, we do not transfer ownership of packages for public package management systems.

If you would like to fork this package and continue development, you should choose a new name for the project and create your own packages, build automation, etc.

Please review the licensing terms of this project, which continue to be in effect even after decommission.

# generator-release

Yeoman generator for handling Bower/NPM releases.

## Installation

```
npm install -g yo generator-release
```

A config file, `~/.config/generator-release`, needs to be created. This is standard CommonJS module exporting github authentication [options](https://github.com/michael/github#usage). The easiest way to configure the authentication is to go to the GitHub admin panel and create a [Personal Access Token](https://github.com/settings/tokens/new), then set it as the `token` in your config. 

Optionally the module may export a `linkFilter` method that allows for parsing of links included in the body of notes issues and pull requests.

### Example

```javascript
module.exports = {
  auth: 'oauth',
  token: 'GitHub OAuth token',

  linkFilter: function(link) {
    return /atlassian\.net/.test(link.url);
  }
};
```

### Enterprise hosts

generator-release can work against GitHub enterprise hosts when defined in the `hosts` key.

```javascript
module.exports = {
  auth: 'oauth',
  token: 'GitHub OAuth token',

  hosts: {
    'my.host': {
      token: 'Enterprise GitHub OAuth token',
      apiUrl: 'https://my.host/api/v3'
    }
  }
};

```

When operating against a matching host, the entire object will be used to extend the base config object, allowing for any config object to be overridden per host. In the example above this is akin to `_.extend(module.exports, module.exports.hosts['my.host'])`.

## Usage

### Generating release notes
```
yo release:notes
```

Will generate a template for the release notes including:
- Github issues closed since the last release
- Gitub pull requests closed since the last release
- Commits not associated with pull requests

This should be manually edited to ensure that only relevant content is display and any additional gotchas and upgrade concerns noted. If the `$EDITOR` environment variable is setup the generator will automate the checkin of the updated notes.

**Additional options**:
* `--dry-run` — finds the changes that will be recorded and log to the console rather than disk.
* `--rebuild` - specifes that we want to create notes for the existing version


### Releasing

```
yo release:release [major|minor|patch|prerelease]
```

Will increment the release version per the semver action passed in and tag and pushes to the upstream repository.

If publishing to npm the `npm publish` command is still required.

The increment parameter is optional and not recommended if the release notes were just updated for the project.

**Additional options**:
* `--skip-tests` — skips tests (**this is not recommended but can be used to work around environmental issues**)

### Single Command Release

```
yo release
```

Shorthand for the tasks above. Will execute both the notes and release tasks via a single command. Note that the `$EDITOR` environment variable must be set to a supporting editor to use this mode.

### Comparing NPM and Bower collections
npm
```
yo release:collect-versions npm > oldVersion.json
yo release:diff oldVersion.json npm
```
bower
```
yo release:collect-versions bower > oldVersion.json
yo release:diff oldVersion.json bower
```

Generates a report of the versions that have changed for all packages. Includes release notes for packages that include them.

Note that the arguments to `release:diff` may be any combination of files or `npm`/`bower` meta commands.

### Publishing
```
yo release:publish [cdnjs|components] projectName sourceDir
```

Pushes a particular directory of artifacts to cdnjs or the github components project, optionally creating pull requests if the executing user does not have adequate permissions to directly push.

Note that at this time only frontend publishing is possible. NPM publishing should still be done directly through the `npm publish` command.

Enterprise hosts may be published to using the `--host=$server` option.
