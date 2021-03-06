/* global dispatch, itWithJson */

var chai = require('chai')
  , expect = chai.expect

  , expressive = require('../')
  , endJson = require('./end.json')
  , errJson = require('./err.json')
  , launchJson = require('./launch.json')
  , fooJson = require('./FooIntent.json')
  , noSlotJson = require('./NoSlotIntent.json');

require('./testing-util')
chai.should();


beforeEach(function() {
    this.app = expressive();
    this.app.use(function(req, res, next) {
        req.attr('middleware', true);
        next();
    });

    this.app.slot('error', function(req, res, next, id) {
        req.attr('error-handler', true);
        next(new Error("We got an error? " + id));
    });

    this.app.slot('username', function(req, res, next, id) {
        req.attr('got-username', id);
        next();
    });

    this.app.end(function(req) {
        req.attr('Ended', true);
    });

    this.app.launch(function(req, res) {
        res.tell("Launched");
    });

    this.app.intent('Foo', function(req, res) {
        res.tell("Foo");
    });

    this.app.intent('NoSlot', function(req, res) {
        res.tell("NoSlot");
    });

    this.app.start(function(req) {
        req.attr('StartSession', true);
    });

    this.dispatch = dispatch.bind(dispatch, this.app);
});

describe("Global middleware and routing", function() {

    itWithJson(launchJson, "is called on launch", function(err, res) {
        expect(err).to.not.be.errorLike
        res.should.have.attr('middleware', true);
        res.should.tell('Launched');
    });

    itWithJson(launchJson, "is called with start session handler", function(err, res) {
        expect(err).to.not.be.errorLike
        res.should.have.attr('middleware', true);
        res.should.have.attr('StartSession', true);
        res.should.tell('Launched');
    });

    itWithJson(fooJson, "is called on Foo Intent", function(err, res) {
        expect(err).to.not.be.errorLike
        res.should.have.attr('middleware', true);
        res.should.tell('Foo');
    });

    itWithJson(endJson, "is called with end session handler", function(err, res) {
        expect(err).to.not.be.errorLike
        res.should.have.attr('middleware', true);
        res.should.have.attr('Ended', true);
    });

    itWithJson(errJson, "is stops on error in middleware", function(err, res) {
        expect(err).to.be.errorLike
        res.should.have.attr('middleware', true);
        res.should.have.attr('error-handler', true);
        res.should.not.tell;
    });

});

describe("Slot Handler", function() {
    itWithJson(fooJson, "is called on Foo Intent", function(err, res) {
        expect(err).to.not.be.errorLike

        res.should.have.attr('got-username', 'myUsername');
    });

    itWithJson(noSlotJson, "doesn't barf when no slots", function(err, res) {
        expect(err).to.not.be.errorLike

        res.should.tell('NoSlot');
    });
});
