Expressive [![Build Status](http://img.shields.io/travis/dhleong/expressive.svg?style=flat)](https://travis-ci.org/dhleong/expressive)
==========

A minimalist framework for 
[Alexa Skills Kit](https://developer.amazon.com/public/solutions/alexa/alexa-skills-kit) 
apps running on [Amazon Lambda](http://aws.amazon.com/lambda)
(or as a web service),
inspired by the syntax of [Express.js](http://expressjs.com).

### Usage

[![NPM](https://nodei.co/npm/echo-expressive.png?mini=true)](https://nodei.co/npm/echo-expressive/)

```javascript
var expressive = require('echo-expressive');
var app = expressive(MY_APP_ID); // app id is optional, but filters requests

// install a middleware, they way you'd expect
app.use(function(req, res, next) {
    // read session attributes with the key
    if (req.attr('user')) {
        // it's already set, move along
        next();
        return;
    }

    // asynchronous processing
    User.find(req.session.user.userId, function(err, user) {
        if (err) return next(err);

        // set session attributes with key and value
        req.attr('user', user);
        next();
    });
});

// if you want to process slots for intent requests,
//  you can do that, too
app.slot('recipient-name', function(req, res, next, name) {
    // This will be called after the above, as expected,
    //  and only when the `recipient-name` slot was provided
    //  in an IntentRequest.

    User.findByName(name, function(err, recipient) {
        if (err) return next(err);

        req.attr('recipient', recipient);
        next();
    });
});


// instead of get() or post(), use Echo verbs.
// start(), launch(), intent(), and end()
app.start(function(req) {
    // this is called when a new Session has started
    // You can use it to prepare any resources
});

app.launch(function(req, res) {
    // LaunchRequest received
    res.tell("Welcome to my app");
});

app.intent('SendIntent', function(req, res) {
    // specific IntentRequest received
    res.ask("What would you like to send?");
});

app.intent('SendWithMessageIntent', function(req, res) {
    // specific IntentRequest received
    res.tell("Message sent!");
});

app.end(function(req) {
    // this is called when a Session has ended.
    // You can use it to clean up any resources
});

// install for use on Lambda
app.handle(module.exports);
// or, listen like a web service
app.listen(8080);
```

### Future Work

- Abstract routes further so sets of routes can be mounted like in Express
