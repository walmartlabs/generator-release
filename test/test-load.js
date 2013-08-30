/*global describe, beforeEach, it*/
'use strict';

var assert  = require('assert');

describe('release generator', function () {
  it('can be imported without blowing up', function () {
    var generator = require('../release');
    assert(generator !== undefined);

    generator = require('../notes');
    assert(generator !== undefined);
  });
});
