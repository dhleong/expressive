
/**
 * Expressive is a minimalist framework for
 *  Alexa Skill Kit apps running on Amazon Lambda,
 *  inspired by the syntax of Express.js
 */

var GLOBAL_MIDDLEWARES = '!_global';

function Response(session, context) {
    this._session = session;
    this._context = context;
    this._errored = false;
}

Response.prototype.tell = function(speechOutput) {
    this._succeed({
        output: speechOutput,
        shouldEndSession: true
    });
}

Response.prototype._error = function(err) {
    // NB: we provide a response fo better testing
    this._errored = true;
    this._context.fail(err, this._response({}));
}

Response.prototype._succeed = function(args) {
    this._context.succeed(this._response(args));
}

Response.prototype._response = function(args) {
    var alexaResponse = {
        outputSpeech: {
            type: 'PlainText',
            text: args.output
        },
        shouldEndSession: args.shouldEndSession
    };
    if (args.reprompt) {
        alexaResponse.reprompt = {
            outputSpeech: {
                type: 'PlainText',
                text: args.reprompt
            }
        };
    }
    if (args.cardTitle && args.cardContent) {
        alexaResponse.card = {
            type: "Simple",
            title: args.cardTitle,
            content: args.cardContent
        };
    }
    var returnResult = {
        version: '1.0',
        response: alexaResponse
    };
    if (this._session.attributes) {
        returnResult.sessionAttributes = this._session.attributes;
    }
    return returnResult;
}


/**
 * Special wrapper for a slot() handler
 */
function SlotHandler(slotName, handler) {
    this.slotName = slotName;
    this.handler = handler;

    this.length = handler.length;
}

SlotHandler.prototype.call = function(_, req, res, next) {
    var value = req.slot(this.slotName);
    if (!value) return next(); // nothing to do

    this.handler.call(this.handler, req, res, next, value);
}


/**
 * @return a `function(req, res)` that applies the
 *  whole chain of middleware befor efinally calling
 *  the finalHandler
 */
function buildRequestChain(middleware, finalHandler) {
    if (!finalHandler) throw new Error("No handler installed");
    if (!middleware.length) return finalHandler;

    return function(req, res) {
        var next;
        next = function(err) {
            if (err) {
                // middleware error; pass through
                res._error(err);
                return;
            }

            var current = next._index++;
            if (current >= middleware.length) {
                return finalHandler(req, res);
            }

            middleware[current].call(this, req, res, next);
        };
        next._index = 0;

        // invoke the first middleware
        next();
    };
}


/**
 * Constructor for an Expressive skill
 */
function Expressive(appId) {
    this._appId = appId;

    this._middlewares = {};
    this._intents = {};
}

/**
 * Install this skill on the main exports
 */
Expressive.prototype.handle = function(exports) {
    var self = this;
    exports.handler = function(event, context) {
        // Validate that this request originated from authorized source.
        if (self._appId && event.session.application.applicationId !== self._appId) {
            console.log("The applicationIds don't match : " + event.session.application.applicationId + " and "
                + self._appId);
            context.fail(new Error("Invalid applicationId"));
            return;
        }

        var myHandler = self['_on' + event.request.type];
        if (!myHandler) {
            context.fail(new Error("No handler for " + event.request.type));
            return;
        }

        // install conveniences
        event.attr = function(key, val) {
            if (val === undefined) {
                return event.session.attributes[key];
            } else {
                event.session.attributes[key] = val;
            }
        };

        event.slot = function(key) {
            var intent = event.request.intent;
            if (intent) {
                var entry = intent.slots[key];
                if (entry) return entry.value;
            }
        }

        // start session handler
        try {
            var res = new Response(event.session, context);

            if (event.session.new) {
                self._onSessionStartedRequest.call(self, event, res);

                if (res._errored) return;
            }

            myHandler.call(self, event, res);
        } catch (e) {
            console.error("Error handling", event, e);
            res._error(e);
        }
    };
}

/**
 * Install the handler for when a Session ends
 */
Expressive.prototype.end = function(handler) {
    this._onEndSession = handler;
}

/**
 * Install an intent handler
 */
Expressive.prototype.intent = function(intentName, handler) {
    this._intents[intentName] = handler;
}

/**
 * Install the LaunchIntent handler
 */
Expressive.prototype.launch = function(handler) {
    this._onLaunch = handler;
}

/**
 * Install a middleware to handle an intent slot,
 *  like app.param() in Express.
 * @param handler A `function(req, res, next, slotValue)`
 */
Expressive.prototype.slot = function(slotName, handler) {
    var self = this;
    if (Array.isArray(slotName)) {
        slotName.forEach(function(name) {
            self.slot(name, handler);
        });
        return;
    }

    this._mid().push(new SlotHandler(slotName, handler));
}


/**
 * Install the handler for when a new Session starts
 */
Expressive.prototype.start = function(handler) {
    this._onStartSession = handler;
}

/**
 * Install a new middleware.
 * @param intentName (optional) The Intent name to use
 *                   this middleware with. If not provided,
 *                   the middleware will apply globally
 * @param handler A `function(req, res, next)`
 */
Expressive.prototype.use = function(intentName, handler) {
    if (!handler) {
        handler = intentName;
        intentName = GLOBAL_MIDDLEWARES;
    }

    this._mid(intentName).push(handler);
}

Expressive.prototype._mid = function(path) {
    var existing = this._middlewares[path || GLOBAL_MIDDLEWARES];
    if (existing) return existing;

    var newList = [];
    this._middlewares[path] = newList;
    return newList;
}

Expressive.prototype._onLaunchRequest = function(req, res) {
    var chain = buildRequestChain(this._mid(), this._onLaunch);
    chain(req, res);
}

Expressive.prototype._onIntentRequest = function(req, res) {
    var intentName = req.request.intent.name;
    var middleware = this._mid().concat(this._mid(intentName));
    var chain = buildRequestChain(middleware, this._intents[intentName]);
    chain(req, res);
}

Expressive.prototype._onSessionEndedRequest = function(req, res) {
    if (!this._onEndSession) {
        // no end session handler, but that's okay
        res._succeed({}); // response is unnecessary, but helps testing
        return;
    }

    var self = this;
    var chain = buildRequestChain(this._mid(), function(req, res) {
        // end session request is special and doesn't
        //  do any response
        if (self._onEndSession.length == 1) {
            // easy
            self._onEndSession(req);
            res._succeed({});
        } else {
            // fancy (middleware style, or if they do async work)
            self._onEndSession(req, res._succeed.bind(res, {}));
        }
    });
    chain(req, res);
}

Expressive.prototype._onSessionStartedRequest = function(req, res) {
    // started shouldn't get the response, but we need
    //  it to handle errors in middleware
    var chain = buildRequestChain(this._mid(), this._onStartSession);
    chain(req, res);
}

// mimic express
module.exports = function expressive(appId) {
    return new Expressive(appId);
}

