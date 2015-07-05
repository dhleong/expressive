
/*
 * Shared testing utils
 */

var chai = require('chai')
  , _ = chai.util
  , Assertion = chai.Assertion;

Assertion.addMethod('attr', function(key, val) {
    var obj = this._obj;

    new Assertion(obj.sessionAttributes)
        .to.be.an('object')
        .that.has.property(key, val);
});

Assertion.addMethod('tell', function(text) {
    var obj = this._obj;

    var propName = 'response.outputSpeech.text';

    new Assertion(obj)
        .to.be.an('object')
        .that.has.deep.property(propName, text);
});

Assertion.addProperty('errorLike', function() {
    var obj = this._obj;

    var errorDesc = _.inspect(obj);
    if (obj instanceof Error) {
        // clean up the stack
        var lines = obj.stack.split('\n');
        var filtered = lines.filter(function(line) {
            return !~line.indexOf('modules/mocha');
        });
        errorDesc = filtered.join('\n');
    }

    this.assert(
        !(obj === null || obj === undefined),
        "Expected an error but was #{act}",
        "Expected no error, but got:\n " + errorDesc
    );
});

global.dispatch = function(app, req, callback) {
    var context = {
        fail: function(err, resp) {
            setTimeout(function() {
                callback(err, resp);
            }, 0);
        },

        succeed: function(resp) {
            setTimeout(function() {
                callback(null, resp);
            }, 0);
        }
    }
    var exports = {};
    app.handle(exports);
    exports.handler(req, context);
}

global.itWithJson = function(json, description, callback) {
    it(description, function(done) {
        this.dispatch(json, function(err, resp) {
            try {
                callback(err, resp);
                done();
            } catch (e) {
                // go ahead and provide the callback for testing
                callback(e, resp);
                done();
            }
        });
    });
}
