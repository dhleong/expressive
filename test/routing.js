/* global dispatch, itWithJson */

var chai = require('chai')
  , expect = chai.expect

  , expressive = require('../')
  , launchJson = require('./launch.json')
  , fooJson = require('./FooIntent.json');

require('./testing-util')
chai.should();

describe("Global middleware", function() {

    beforeEach(function() {
        this.app = expressive();
        this.app.use(function(req, res, next) {
            req.attr('middleware', true);
            next();
        });

        this.app.launch(function(req, res) {
            res.tell("Launched");
        });

        this.app.intent('Foo', function(req, res) {
            res.tell("Foo");
        });


        this.dispatch = dispatch.bind(dispatch, this.app);
    });

    itWithJson(launchJson, "is called on launch", function(err, res) {
        expect(err).to.not.be.errorLike
        res.should.have.attr('middleware', true);
        res.should.tell('Launched');
    });

    itWithJson(fooJson, "is called on Foo", function(err, res) {
        expect(err).to.not.be.errorLike
        res.should.have.attr('middleware', true);
        res.should.tell('Foo');
    });

});
