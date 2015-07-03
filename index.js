
/**
 * Expressive is a minimalist framework for
 *  Alexa Skill Kit apps running on Amazon Lambda,
 *  inspired by the syntax of Express.js
 */

var GLOBAL_MIDDLEWARES = '!_global';

function Response(session, context) {
    this._session = session;
    this._context = context;
}

Response.prototype.tell = function(speechOutput) {
    this._succeed({
        output: speechOutput,
        shouldEndSession: true
    });
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
 * @return a `function(req, res)` that applies the
 *  whole chain of middleware befor efinally calling
 *  the finalHandler
 */
function buildRequestChain(middleware, finalHandler) {
    if (!finalHandler) throw new Error("No handler installed");
    if (!middleware.length) return finalHandler;

    return function(req, res) {
        var next;
        next = function() {
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

        // install a convenience
        event.attr = function(key, val) {
            if (val === undefined) {
                return event.session.attributes[key];
            } else {
                event.session.attributes[key] = val;
            }
        };

        try {
            myHandler.call(self, event, new Response(event.session, context));
        } catch (e) {
            console.error("Error handling", event, e);
            context.fail(e);
        }
    };
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


// mimic express
module.exports = function expressive(appId) {
    return new Expressive(appId);
}

