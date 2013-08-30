# generator-release

Yeoman generator for handling Bower/NPM releases.

## Installation

```
npm install -g yo generator-release
```

A config file needs to be created in `~/.config/generator-release`. This is standard CommonJS module exporting github authentication [options](https://github.com/michael/github#usage).

### Example

```javascript
module.exports = {
  auth: 'oauth',
  token: 'OAuth Token generated from GitHub Admin'
};
```

## Usage

### Generating release notes
```
yo release:notes [major|minor|patch|prerelease]
```

Will generate a template for the release notes including:
- Github issues closed since the last release
- Gitub pull requests closed since the last release
- Commits not associated with pull requests

This should be manually edited to ensure that only relevant content is display and any additional gotchas and upgrade concerns noted.


### Releasing

```
yo release:release [major|minor|patch|prerelease]
```

Will increment the release version per the semver action passed in and tag and pushes to the upstream repository.

If publishing to npm the `npm publish` command is still required.
