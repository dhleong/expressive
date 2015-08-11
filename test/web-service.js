var request = require('supertest')

  , expressive = require('../')
  , launchJson = require('./launch.json');


beforeEach(function() {
    this.app = expressive();
    this.app.use(function(req, res, next) {
        req.attr('middleware', true);
        next();
    });

    this.app.slot('username', function(req, res, next, id) {
        req.attr('got-username', id);
        next();
    });

    this.app.launch(function(req, res) {
        res.tell("Launched");
    });

    this.app.listen();
});

afterEach(function() {
    this.app.close();
});

describe("Web service", function() {

    it("routes launch with middleware", function(done) {
        request(this.app.server)
        .post('/')
        .type('application/json')
        .send(launchJson)
        .expect({
            response: {
                outputSpeech: {
                    text: "Launched",
                    type: "PlainText"
                },
                shouldEndSession: true
            },
            sessionAttributes: {
                StartSession: true,
                middleware: true
            },
            version: "1.0"
        })
        .end(done);
    });

});

