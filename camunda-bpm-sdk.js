!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.CamSDK=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
'use strict';

// var HttpClient = require('./http-client');
var Q = _dereq_('q');
var Events = _dereq_('./../events');
var BaseClass = _dereq_('./../base-class');

/**
 * No-Op callback
 */
function noop() {}

/**
 * Abstract class for resources
 *
 * @class
 * @augments {CamSDK.BaseClass}
 * @memberof CamSDK.client
 *
 * @borrows CamSDK.Events.on                        as on
 * @borrows CamSDK.Events.once                      as once
 * @borrows CamSDK.Events.off                       as off
 * @borrows CamSDK.Events.trigger                   as trigger
 *
 * @borrows CamSDK.Events.on                        as prototype.on
 * @borrows CamSDK.Events.once                      as prototype.once
 * @borrows CamSDK.Events.off                       as prototype.off
 * @borrows CamSDK.Events.trigger                   as prototype.trigger
 *
 *
 * @example
 *
 * // create a resource Model
 * var Model = AbstractClientResource.extend({
 *   apiUri: 'path-to-the-endpoint'
 *   doSomethingOnInstance: function() {
 *     //
 *   }
 * }, {
 *   somethingStatic: {}
 * });
 *
 * // use the generated Model statically
 * // with events
 * Model.on('eventname', function(results) {
 *   // You probably have something like
 *   var total = results.count;
 *   var instances = results.items;
 * });
 * Model.list({ nameLike: '%call%' });
 *
 * // or alternatively by using a callback
 * Model.list({ nameLike: '%call%' }, function(err, results) {
 *   if (err) {
 *     throw err;
 *   }
 *
 *   var total = results.count;
 *   var instances = results.items;
 * });
 *
 * var instance = new Model();
 * instance.claim(function(err, result) {
 *
 * });
 */
var AbstractClientResource = BaseClass.extend(
/** @lends AbstractClientResource.prototype */
  {
  /**
   * Initializes a AbstractClientResource instance
   *
   * This method is aimed to be overriden by other implementations
   * of the AbstractClientResource.
   *
   * @method initialize
   */
    initialize: function() {
    // do something to initialize the instance
    // like copying the Model http property to the "this" (instanciated)
      this.http = this.constructor.http;
    }
  },


/** @lends AbstractClientResource */
  {
  /**
   * Path used by the resource to perform HTTP queries
   *
   * @abstract
   * @memberOf CamSDK.client.AbstractClientResource
   */
    path: '',

  /**
   * Object hosting the methods for HTTP queries.
   *
   * @abstract
   * @memberof CamSDK.client.AbstractClientResource
   */
    http: {},



  /**
   * Create an instance on the backend
   *
   * @abstract
   * @memberOf CamSDK.client.AbstractClientResource
   *
   * @param  {!Object|Object[]}  attributes
   * @param  {requestCallback} [done]
   */
    create: function() {},


  /**
   * Fetch a list of instances
   *
   * @memberof CamSDK.client.AbstractClientResource
   *
   * @fires CamSDK.AbstractClientResource#error
   * @fires CamSDK.AbstractClientResource#loaded
   *
   * @param  {?Object.<String, String>} params
   * @param  {requestCallback} [done]
   */
    list: function(params, done) {
    // allows to pass only a callback
      if (typeof params === 'function') {
        done = params;
        params = {};
      }
      params = params || {};
      done = done || noop;

    // var likeExp = /Like$/;
      var self = this;
      var results = {
        count: 0,
        items: []
      };

      var combinedPromise = Q.defer();

      var countFinished = false;
      var listFinished = false;

      var checkCompletion = function() {
        if(listFinished && countFinished) {
          self.trigger('loaded', results);
          combinedPromise.resolve(results);
          done(null, results);
        }
      };

    // until a new webservice is made available,
    // we need to perform 2 requests.
    // Since they are independent requests, make them asynchronously
      self.count(params, function(err, count) {
        if(err) {
          self.trigger('error', err);
          combinedPromise.reject(err);
          done(err);
        } else {
          results.count = count;
          countFinished = true;
          checkCompletion();
        }
      });

      self.http.get(self.path, {
        data: params,
        done: function(err, itemsRes) {
          if (err) {
            self.trigger('error', err);
            combinedPromise.reject(err);
            done(err);
          } else {
            results.items = itemsRes;
          // QUESTION: should we return that too?
            results.firstResult = parseInt(params.firstResult || 0, 10);
            results.maxResults = results.firstResult + parseInt(params.maxResults || 10, 10);
            listFinished = true;
            checkCompletion();
          }
        }
      });

      return combinedPromise.promise;
    },

  /**
   * Fetch a count of instances
   *
   * @memberof CamSDK.client.AbstractClientResource
   *
   * @fires CamSDK.AbstractClientResource#error
   * @fires CamSDK.AbstractClientResource#loaded
   *
   * @param  {?Object.<String, String>} params
   * @param  {requestCallback} [done]
   */
    count: function(params, done) {
    // allows to pass only a callback
      if (typeof params === 'function') {
        done = params;
        params = {};
      }
      params = params || {};
      done = done || noop;
      var self = this;
      var deferred = Q.defer();

      this.http.get(this.path +'/count', {
        data: params,
        done: function(err, result) {
          if (err) {
          /**
           * @event CamSDK.AbstractClientResource#error
           * @type {Error}
           */
            self.trigger('error', err);

            deferred.reject(err);
            done(err);
          } else {
            deferred.resolve(result.count);
            done(null, result.count);
          }
        }
      });

      return deferred.promise;
    },


  /**
   * Update one or more instances
   *
   * @abstract
   * @memberof CamSDK.AbstractClientResource
   *
   * @param  {!String|String[]}     ids
   * @param  {Object.<String, *>}   attributes
   * @param  {requestCallback} [done]
   */
    update: function() {},



  /**
   * Delete one or more instances
   *
   * @abstract
   * @memberof CamSDK.AbstractClientResource
   *
   * @param  {!String|String[]}  ids
   * @param  {requestCallback} [done]
   */
    delete: function() {}
  });


Events.attach(AbstractClientResource);

module.exports = AbstractClientResource;

},{"./../base-class":31,"./../events":32,"q":55}],2:[function(_dereq_,module,exports){
exports.createSimpleGetQueryFunction = function(urlSuffix) {
  return function(params, done) {
    var url = this.path + urlSuffix;

    if (typeof params === 'function') {
      done = params;
      params = {};
    }

    return this.http.get(url, {
      data: params,
      done: done
    });
  };
};

},{}],3:[function(_dereq_,module,exports){
(function (Buffer){
'use strict';

var request = _dereq_('superagent');
var Q = _dereq_('q');
var Events = _dereq_('./../events');
var utils = _dereq_('./../utils');

/**
 * No-Op callback
 */
function noop() {}

/**
 * HttpClient
 *
 * A HTTP request abstraction layer to be used in node.js / browsers environments.
 *
 * @class
 * @memberof CamSDK.client
 */
var HttpClient = function(config) {
  config = config || {};

  config.headers = config.headers || {};
  if (!config.headers.Accept) {
    config.headers.Accept = 'application/hal+json, application/json; q=0.5';
  }

  if (!config.baseUrl) {
    throw new Error('HttpClient needs a `baseUrl` configuration property.');
  }

  Events.attach(this);

  this.config = config;
};

function end(self, done, deferred) {
  done = done || noop;
  return function(err, response) {
    // TODO: investigate the possible problems related to response without content
    if (err || (!response.ok && !response.noContent)) {
      err = err || response.error || new Error('The '+ response.req.method +' request on '+ response.req.url +' failed');
      if (response && response.body) {
        if (response.body.message) {
          err.message = response.body.message;
        }
      }
      self.trigger('error', err);
      if(deferred) {deferred.reject(err);}
      return done(err);
    }

    // superagent puts the parsed data into a property named "body"
    // and the "raw" content in property named "text"
    // and.. it does not parse the response if it does not have
    // the "application/json" type.
    if (response.type === 'application/hal+json') {
      if (!response.body || Object.keys(response.body).length === 0) {
        response.body = JSON.parse(response.text);
      }

      // and process embedded resources
      response.body = utils.solveHALEmbedded(response.body);
    }

    if(deferred) {deferred.resolve(response.body ? response.body : (response.text ? response.text : ''));}
    done(null, response.body ? response.body : (response.text ? response.text : ''));
  };
}

/**
 * Performs a POST HTTP request
 */
HttpClient.prototype.post = function(path, options) {
  options = options || {};
  var done = options.done || noop;
  var self = this;
  var deferred = Q.defer();
  var url = this.config.baseUrl + (path ? '/'+ path : '');
  var req = request.post(url);

  // Buffer object is only available in node.js environement
  if (typeof Buffer !== 'undefined') {
    Object.keys(options.fields || {}).forEach(function(field) {
      req.field(field, options.fields[field]);
    });
    (options.attachments || []).forEach(function(file, idx) {
      req.attach('data_'+idx, new Buffer(file.content), file.name);
    });
  }
  else if (!!options.fields || !!options.attachments) {
    var err = new Error('Multipart request is only supported in node.js environement.');
    done(err);
    return deferred.reject(err);
  }

  req
    .set(this.config.headers)
    .send(options.data || {})
    .query(options.query || {});

  req.end(end(self, done, deferred));
  return deferred.promise;
};


/**
 * Performs a GET HTTP request
 */
HttpClient.prototype.get = function(path, options) {
  var url = this.config.baseUrl + (path ? '/'+ path : '');
  return this.load(url, options);
};

/**
 * Loads a resource using http GET
 */
HttpClient.prototype.load = function(url, options) {
  options = options || {};
  var done = options.done || noop;
  var self = this;
  var deferred = Q.defer();

  var accept = options.accept || this.config.headers.Accept;

  var req = request
    .get(url)
    .set(options.headers || this.config.headers)
    .set('Accept', accept)
    .query(options.data || {});

  req.end(end(self, done, deferred));
  return deferred.promise;
};


/**
 * Performs a PUT HTTP request
 */
HttpClient.prototype.put = function(path, options) {
  options = options || {};
  var done = options.done || noop;
  var self = this;
  var deferred = Q.defer();
  var url = this.config.baseUrl + (path ? '/'+ path : '');

  var req = request
    .put(url)
    .set(options.headers || this.config.headers)
    .send(options.data || {});

  req.end(end(self, done,deferred));
  return deferred.promise;
};



/**
 * Performs a DELETE HTTP request
 */
HttpClient.prototype.del = function(path, options) {
  options = options || {};
  var done = options.done || noop;
  var self = this;
  var deferred = Q.defer();
  var url = this.config.baseUrl + (path ? '/'+ path : '');

  var req = request
    .del(url)
    .set(options.headers || this.config.headers)
    .send(options.data || {});

  req.end(end(self, done, deferred));
  return deferred.promise;
};



/**
 * Performs a OPTIONS HTTP request
 */
HttpClient.prototype.options = function(path, options) {
  options = options || {};
  var done = options.done || noop;
  var self = this;
  var deferred = Q.defer();
  var url = this.config.baseUrl + (path ? '/'+ path : '');

  var req = request('OPTIONS', url)
    .set(options.headers || this.config.headers);

  req.end(end(self, done, deferred));
  return deferred.promise;
};


module.exports = HttpClient;

}).call(this,_dereq_("buffer").Buffer)
},{"./../events":32,"./../utils":44,"buffer":45,"q":55,"superagent":56}],4:[function(_dereq_,module,exports){
'use strict';
var Events = _dereq_('./../events');

/**
 * For all API client related
 * @namespace CamSDK.client
 */

/**
 * For the resources implementations
 * @namespace CamSDK.client.resource
 */

/**
 * Entry point of the module
 *
 * @class CamundaClient
 * @memberof CamSDK.client
 *
 * @param  {Object} config                  used to provide necessary configuration
 * @param  {String} [config.engine=default] false to define absolute apiUri
 * @param  {String} config.apiUri
 * @param  {String} [config.headers]        Headers that should be used for all Http requests.
 */
function CamundaClient(config) {
  if (!config) {
    throw new Error('Needs configuration');
  }

  if (!config.apiUri) {
    throw new Error('An apiUri is required');
  }

  Events.attach(this);

  // use 'default' engine
  config.engine = typeof config.engine !== 'undefined'
    ? config.engine
    : 'default';

  // mock by default.. for now
  config.mock =  typeof config.mock !== 'undefined' ? config.mock : true;

  config.resources = config.resources || {};

  this.HttpClient = config.HttpClient || CamundaClient.HttpClient;

  this.baseUrl = config.apiUri;
  if (config.engine) {
    this.baseUrl += (this.baseUrl.slice(-1) !== '/' ? '/' : '');
    this.baseUrl += 'engine/'+ config.engine;
  }

  this.config = config;

  this.initialize();
}

/**
 * [HttpClient description]
 * @memberof CamSDK.client.CamundaClient
 * @name HttpClient
 * @type {CamSDK.client.HttpClient}
 */
CamundaClient.HttpClient = _dereq_('./http-client');

// provide an isolated scope
(function(proto) {
  /**
   * configuration storage
   * @memberof CamSDK.client.CamundaClient.prototype
   * @name  config
   * @type {Object}
   */
  proto.config = {};

  var _resources = {};

  /**
   * @memberof CamSDK.client.CamundaClient.prototype
   * @name initialize
   */
  proto.initialize = function() {
    /* jshint sub: true */
    _resources['authorization']       = _dereq_('./resources/authorization');
    _resources['batch']               = _dereq_('./resources/batch');
    _resources['deployment']          = _dereq_('./resources/deployment');
    _resources['external-task']       = _dereq_('./resources/external-task');
    _resources['filter']              = _dereq_('./resources/filter');
    _resources['history']             = _dereq_('./resources/history');
    _resources['process-definition']  = _dereq_('./resources/process-definition');
    _resources['process-instance']    = _dereq_('./resources/process-instance');
    _resources['task']                = _dereq_('./resources/task');
    _resources['task-report']         = _dereq_('./resources/task-report');
    _resources['variable']            = _dereq_('./resources/variable');
    _resources['case-execution']      = _dereq_('./resources/case-execution');
    _resources['case-instance']       = _dereq_('./resources/case-instance');
    _resources['case-definition']     = _dereq_('./resources/case-definition');
    _resources['user']                = _dereq_('./resources/user');
    _resources['group']               = _dereq_('./resources/group');
    _resources['tenant']              = _dereq_('./resources/tenant');
    _resources['incident']            = _dereq_('./resources/incident');
    _resources['job-definition']      = _dereq_('./resources/job-definition');
    _resources['job']                 = _dereq_('./resources/job');
    _resources['metrics']             = _dereq_('./resources/metrics');
    _resources['decision-definition'] = _dereq_('./resources/decision-definition');
    _resources['execution']           = _dereq_('./resources/execution');
    _resources['migration']           = _dereq_('./resources/migration');
    _resources['drd']                 = _dereq_('./resources/drd');
    _resources['modification']        = _dereq_('./resources/modification');
    /* jshint sub: false */
    var self = this;

    function forwardError(err) {
      self.trigger('error', err);
    }

    // create global HttpClient instance
    this.http = new this.HttpClient({baseUrl: this.baseUrl, headers: this.config.headers});

    // configure the client for each resources separately,
    var name, conf, resConf, c;
    for (name in _resources) {

      conf = {
        name:     name,
        // use the SDK config for some default values
        mock:     this.config.mock,
        baseUrl:  this.baseUrl,
        headers:  this.config.headers
      };
      resConf = this.config.resources[name] || {};

      for (c in resConf) {
        conf[c] = resConf[c];
      }

      // instanciate a HTTP client for the resource
      _resources[name].http = new this.HttpClient(conf);

      // forward request errors
      _resources[name].http.on('error', forwardError);
    }
  };

  /**
   * Allows to get a resource from SDK by its name
   * @memberof CamSDK.client.CamundaClient.prototype
   * @name resource
   *
   * @param  {String} name
   * @return {CamSDK.client.AbstractClientResource}
   */
  proto.resource = function(name) {
    return _resources[name];
  };
}(CamundaClient.prototype));


module.exports = CamundaClient;


/**
 * A [universally unique identifier]{@link en.wikipedia.org/wiki/Universally_unique_identifier}
 * @typedef {String} uuid
 */


/**
 * This callback is displayed as part of the Requester class.
 * @callback requestCallback
 * @param {?Object} error
 * @param {CamSDK.AbstractClientResource|CamSDK.AbstractClientResource[]} [results]
 */


/**
 * Function who does not perform anything
 * @callback noopCallback
 */

},{"./../events":32,"./http-client":3,"./resources/authorization":5,"./resources/batch":6,"./resources/case-definition":7,"./resources/case-execution":8,"./resources/case-instance":9,"./resources/decision-definition":10,"./resources/deployment":11,"./resources/drd":12,"./resources/execution":13,"./resources/external-task":14,"./resources/filter":15,"./resources/group":16,"./resources/history":17,"./resources/incident":18,"./resources/job":20,"./resources/job-definition":19,"./resources/metrics":21,"./resources/migration":22,"./resources/modification":23,"./resources/process-definition":24,"./resources/process-instance":25,"./resources/task":27,"./resources/task-report":26,"./resources/tenant":28,"./resources/user":29,"./resources/variable":30}],5:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * Authorization Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Authorization = AbstractClientResource.extend();

/**
 * API path for the process definition resource
 * @type {String}
 */
Authorization.path = 'authorization';




/**
 * Fetch a list of authorizations
 *
 * @param {Object} params
 * @param {Object} [params.id]            Authorization by the id of the authorization.
 * @param {Object} [params.type]          Authorization by the type of the authorization.
 * @param {Object} [params.userIdIn]      Authorization by a comma-separated list of userIds
 * @param {Object} [params.groupIdIn]     Authorization by a comma-separated list of groupIds
 * @param {Object} [params.resourceType]  Authorization by resource type
 * @param {Object} [params.resourceId]    Authorization by resource id.
 * @param {Object} [params.sortBy]        Sort the results lexicographically by a given criterion.
 *                                        Valid values are resourceType and resourceId.
 *                                        Must be used with the sortOrder parameter.
 * @param {Object} [params.sortOrder]     Sort the results in a given order.
 *                                        Values may be "asc" or "desc".
 *                                        Must be used in conjunction with the sortBy parameter.
 * @param {Object} [params.firstResult]   Pagination of results.
 *                                        Specifies the index of the first result to return.
 * @param {Object} [params.maxResults]    Pagination of results.
 *                                        Specifies the maximum number of results to return.
 * @param {Function} done
 */
Authorization.list = function(params, done) {
  return this.http.get(this.path, {
    data: params,
    done: done
  });
};



/**
 * Retrieve a single authorization
 *
 * @param  {uuid}     authorizationId     of the authorization to be requested
 * @param  {Function} done
 */
Authorization.get = function(authorizationId, done) {
  return this.http.get(this.path +'/'+ authorizationId, {
    done: done
  });
};


/**
 * Creates an authorization
 *
 * @param  {Object}   authorization       is an object representation of an authorization
 * @param  {Function} done
 */
Authorization.create = function(authorization, done) {
  return this.http.post(this.path +'/create', {
    data: authorization,
    done: done
  });
};


/**
 * Update an authorization
 *
 * @param  {Object}   authorization       is an object representation of an authorization
 * @param  {Function} done
 */
Authorization.update = function(authorization, done) {
  return this.http.put(this.path +'/'+ authorization.id, {
    data: authorization,
    done: done
  });
};



/**
 * Save an authorization
 *
 * @see Authorization.create
 * @see Authorization.update
 *
 * @param  {Object}   authorization   is an object representation of an authorization,
 *                                    if it has an id property, the authorization will be updated,
 *                                    otherwise created
 * @param  {Function} done
 */
Authorization.save = function(authorization, done) {
  return Authorization[authorization.id ? 'update' : 'create'](authorization, done);
};



/**
 * Delete an authorization
 *
 * @param  {uuid}     id   of the authorization to delete
 * @param  {Function} done
 */
Authorization.delete = function(id, done) {
  return this.http.del(this.path +'/'+ id, {
    done: done
  });
};

Authorization.check = function(authorization, done) {
  return this.http.get(this.path + '/check', {
    data: authorization,
    done: done
  });
};



module.exports = Authorization;


},{"./../abstract-client-resource":1}],6:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * Batch Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Batch = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Batch.path = 'batch';

/**
 * Retrieves a single batch according to the Batch interface in the engine.
 */
Batch.get = function(id, done) {
  return this.http.get(this.path + '/' + id, {
    done: done
  });
};

Batch.suspended = function(params, done) {
  return this.http.put(this.path + '/' + params.id + '/suspended', {
    data: {
      suspended: !!params.suspended
    },
    done: done
  });
};

Batch.statistics = function(params, done) {
  return this.http.get(this.path + '/statistics/', {
    data: params,
    done: done
  });
};

Batch.statisticsCount = function(params, done) {
  return this.http.get(this.path + '/statistics/count', {
    data: params,
    done: done
  });
};

Batch.delete = function(params, done) {
  var path = this.path + '/' + params.id;

  if(params.cascade) {
    path += '?cascade=true';
  }

  return this.http.del(path, {
    done: done
  });
};

module.exports = Batch;

},{"./../abstract-client-resource":1}],7:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');

/**
 * No-Op callback
 */
function noop() {}

/**
 * CaseDefinition Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var CaseDefinition = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
CaseDefinition.path = 'case-definition';



/**
 * Retrieve a single case definition
 *
 * @param  {uuid}     id    of the case definition to be requested
 * @param  {Function} done
 */
CaseDefinition.get = function(id, done) {
  return this.http.get(this.path +'/'+ id, {
    done: done
  });
};


/**
 * Retrieve a single cace definition
 *
 * @param  {String}   key    of the case definition to be requested
 * @param  {Function} done
 */
CaseDefinition.getByKey = function(key, done) {
  return this.http.get(this.path +'/key/'+ key, {
    done: done
  });
};

CaseDefinition.list = function(params, done) {
  return this.http.get(this.path, {
    data: params,
    done: done
  });
};

/**
 * Instantiates a given case definition.
 *
 * @param {Object} [params]
 * @param {String} [params.id]              The id of the case definition to be instantiated. Must be omitted if key is provided.
 * @param {String} [params.key]             The key of the case definition (the latest version thereof) to be instantiated. Must be omitted if id is provided.
 * @param {String} [params.variables]       A JSON object containing the variables the case is to be initialized with. Each key corresponds to a variable name and each value to a variable value.
 * @param {String} [params.businessKey]     The business key the case instance is to be initialized with. The business key identifies the case instance in the context of the given case definition.
 */
CaseDefinition.create = function(params, done) {
  var url = this.path + '/';

  if (params.id) {
    url = url + params.id;
  } else {
    url = url + 'key/' + params.key;

    if (params.tenantId) {
      url = url + '/tenant-id/' + params.tenantId;
    }
  }

  return this.http.post(url + '/create', {
    data: params,
    done: done
  });
};


/**
 * Retrieves the CMMN XML of this case definition.
 * @param  {uuid}     id   The id of the case definition.
 * @param  {Function} done
 */
CaseDefinition.xml = function(data, done) {
  var path = this.path +'/'+ (data.id ? data.id : 'key/'+ data.key) +'/xml';
  return this.http.get(path, {
    done: done || noop
  });
};


/**
* Instantiates a given process definition.
*
* @param {String} [id]                        The id of the process definition to activate or suspend.
* @param {Object} [params]
* @param {Number} [params.historyTimeToLive]  New value for historyTimeToLive field of process definition. Can be null.
*/
CaseDefinition.updateHistoryTimeToLive = function(id, params, done) {
  var url = this.path + '/' + id + '/history-time-to-live';

  return this.http.put(url, {
    data: params,
    done: done
  });
};

module.exports = CaseDefinition;

},{"./../abstract-client-resource":1}],8:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');
var utils = _dereq_('../../utils');

/**
 * No-Op callback
 */
function noop() {}

/**
 * CaseExecution Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var CaseExecution = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
CaseExecution.path = 'case-execution';

CaseExecution.list = function(params, done) {
  done = done || noop;
  return this.http.get(this.path, {
    data: params,
    done: done
  });
};

CaseExecution.disable = function(executionId, params, done) {
  return this.http.post(this.path + '/' + executionId + '/disable', {
    data: params,
    done: done
  });
};

CaseExecution.reenable = function(executionId, params, done) {
  return this.http.post(this.path + '/' + executionId + '/reenable', {
    data: params,
    done: done
  });
};

CaseExecution.manualStart = function(executionId, params, done) {
  return this.http.post(this.path + '/' + executionId + '/manual-start', {
    data: params,
    done: done
  });
};

CaseExecution.complete = function(executionId, params, done) {
  return this.http.post(this.path + '/' + executionId + '/complete', {
    data: params,
    done: done
  });
};

/**
 * Deletes a variable in the context of a given case execution. Deletion does not propagate upwards in the case execution hierarchy.
 */
CaseExecution.deleteVariable = function(data, done) {
  return this.http.del(this.path + '/' + data.id + '/localVariables/' + utils.escapeUrl(data.varId), {
    done: done
  });
};


/**
 * Updates or deletes the variables in the context of an execution.
 * The updates do not propagate upwards in the execution hierarchy.
 * Deletion precede updates.
 * So, if a variable is updated AND deleted, the updates overrides the deletion.
 */
CaseExecution.modifyVariables = function(data, done) {
  return this.http.post(this.path + '/' + data.id + '/localVariables', {
    data: data,
    done: done
  });
};

module.exports = CaseExecution;

},{"../../utils":44,"./../abstract-client-resource":1}],9:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');
var utils = _dereq_('../../utils');

/**
 * CaseInstance Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var CaseInstance = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
CaseInstance.path = 'case-instance';



CaseInstance.get = function(instanceId, done) {
  return this.http.get(this.path +'/'+ instanceId, {
    done: done
  });
};

CaseInstance.list = function(params, done) {
  return this.http.get(this.path, {
    data: params,
    done: done
  });
};

CaseInstance.close = function(instanceId, params, done) {
  return this.http.post(this.path + '/' + instanceId + '/close', {
    data: params,
    done: done
  });
};

CaseInstance.terminate = function(instanceId, params, done) {
  return this.http.post(this.path + '/' + instanceId + '/terminate', {
    data: params,
    done: done
  });
};

/**
 * Sets a variable of a given case instance by id.
 *
 * @see http://docs.camunda.org/manual/develop/reference/rest/case-instance/variables/put-variable/
 *
 * @param   {uuid}              id
 * @param   {Object}            params
 * @param   {requestCallback}   done
 */
CaseInstance.setVariable = function(id, params, done) {
  var url = this.path + '/' + id + '/variables/' + utils.escapeUrl(params.name);
  return this.http.put(url, {
    data: params,
    done: done
  });
};

module.exports = CaseInstance;

},{"../../utils":44,"./../abstract-client-resource":1}],10:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * DecisionDefinition Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var DecisionDefinition = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
DecisionDefinition.path = 'decision-definition';


/**
 * Fetch a list of decision definitions
 * @param  {Object} params                        Query parameters as follow
 * @param  {String} [params.decisionDefinitionId] Filter by decision definition id.
 * @param  {String} [params.decisionDefinitionIdIn] Filter by decision definition ids.
 * @param  {String} [params.name]                 Filter by name.
 * @param  {String} [params.nameLike]             Filter by names that the parameter is a substring of.
 * @param  {String} [params.deploymentId]         Filter by the deployment the id belongs to.
 * @param  {String} [params.key]                  Filter by key, i.e. the id in the DMN 1.0 XML. Exact match.
 * @param  {String} [params.keyLike]              Filter by keys that the parameter is a substring of.
 * @param  {String} [params.category]             Filter by category. Exact match.
 * @param  {String} [params.categoryLike]         Filter by categories that the parameter is a substring of.
 * @param  {String} [params.version]              Filter by version.
 * @param  {String} [params.latestVersion]        Only include those decision definitions that are latest versions.
 *                                                Values may be "true" or "false".
 * @param  {String} [params.resourceName]         Filter by the name of the decision definition resource. Exact match.
 * @param  {String} [params.resourceNameLike]     Filter by names of those decision definition resources that the parameter is a substring of.
 *
 * @param  {String} [params.sortBy]               Sort the results lexicographically by a given criterion.
 *                                                Valid values are category, "key", "id", "name", "version" and "deploymentId".
 *                                                Must be used in conjunction with the "sortOrder" parameter.
 *
 * @param  {String} [params.sortOrder]            Sort the results in a given order.
 *                                                Values may be asc for ascending "order" or "desc" for descending order.
 *                                                Must be used in conjunction with the sortBy parameter.
 *
 * @param  {Integer} [params.firstResult]         Pagination of results. Specifies the index of the first result to return.
 * @param  {Integer} [params.maxResults]          Pagination of results. Specifies the maximum number of results to return.
 *                                                Will return less results, if there are no more results left.
 * @param {Function} done
 */
DecisionDefinition.list = function(params, done) {
  return this.http.get(this.path, {
    data: params,
    done: done
  });
};

/**
 * Retrieves a single decision definition according to the DecisionDefinition interface in the engine.
 * @param  {uuid}     id   The id of the decision definition to be retrieved.
 * @param  {Function} done
 */
DecisionDefinition.get = function(id, done) {
  return this.http.get(this.path +'/'+ id, {
    done: done
  });
};

/**
 * Retrieves the DMN 1.0 XML of this decision definition.
 * @param  {uuid}     id   The id of the decision definition.
 * @param  {Function} done
 */
DecisionDefinition.getXml = function(id, done) {
  return this.http.get(this.path +'/'+ id + '/xml', {
    done: done
  });
};

/**
 * Evaluates a given decision.
 *
 * @param {Object} [params]
 * @param {String} [params.id]              The id of the decision definition to be evaluated. Must be omitted if key is provided.
 * @param {String} [params.key]             The key of the decision definition (the latest version thereof) to be evaluated. Must be omitted if id is provided.
 * @param {String} [params.variables]       A JSON object containing the input variables of the decision. Each key corresponds to a variable name and each value to a variable value.
 */
DecisionDefinition.evaluate = function(params, done) {
  return this.http.post(this.path +'/'+ (params.id ? params.id : 'key/'+params.key ) + '/evaluate', {
    data: params,
    done: done
  });
};

/**
* Instantiates a given process definition.
*
* @param {String} [id]                        The id of the process definition to activate or suspend.
* @param {Object} [params]
* @param {Number} [params.historyTimeToLive]  New value for historyTimeToLive field of process definition. Can be null.
*/
DecisionDefinition.updateHistoryTimeToLive = function(id, params, done) {
  var url = this.path + '/' + id + '/history-time-to-live';

  return this.http.put(url, {
    data: params,
    done: done
  });
};

module.exports = DecisionDefinition;

},{"./../abstract-client-resource":1}],11:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * Deployment Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Deployment = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Deployment.path = 'deployment';


/**
 * Create a deployment
 * @param  {Object} options
 *
 * @param  {Array} options.files
 *
 * @param  {String} options.deploymentName
 * @param  {String} [options.deploymentSource]
 * @param  {String} [options.enableDuplicateFiltering]
 * @param  {String} [options.deployChangedOnly]
 * @param	 {String} [options.tenantId]
 * @param  {Function} done
 */
Deployment.create = function(options, done) {
  var fields = {
    'deployment-name': options.deploymentName
  };

  var files = Array.isArray(options.files) ?
              options.files :
              [options.files];

  if (options.deploymentSource) {
    fields['deployment-source'] = options.deploymentSource;
  }

  if (options.enableDuplicateFiltering) {
    fields['enable-duplicate-filtering'] = 'true';
  }

  if (options.deployChangedOnly) {
    fields['deploy-changed-only'] = 'true';
  }

  if (options.tenantId) {
    fields['tenant-id'] = options.tenantId;
  }

  return this.http.post(this.path +'/create', {
    data:         {},
    fields:       fields,
    attachments:  files,
    done:         done
  });
};

/**
 * Deletes a deployment
 *
 * @param  {String}  id
 *
 * @param  {Object}  options
 *
 * @param  {Boolean} [options.cascade]
 * @param  {Boolean} [options.skipCustomListeners]
 *
 * @param  {Function} done
 */
Deployment.delete = function(id, options, done) {
  var path = this.path + '/' + id;

  if (options) {

    var queryParams = [];
    for(var key in options) {
      var value = options[key];
      queryParams.push(key + '=' + value);
    }

    if (queryParams.length) {
      path += '?' + queryParams.join('&');
    }
  }

  return this.http.del(path, {
    done: done
  });
};

/**
 * Lists the deployments
 * @param  {Object}   params                An object containing listing options.
 * @param  {uuid}     [params.id]           Filter by deployment id.
 * @param  {String}   [params.name]         Filter by the deployment name. Exact match.
 * @param  {String}   [params.nameLike]     Filter by the deployment name that the parameter is a
 *                                          substring of. The parameter can include the wildcard %
 *                                          to express like-strategy such as: starts with (%name),
 *                                          ends with (name%) or contains (%name%).
 * @param  {String}   [params.after]        Restricts to all deployments after the given date.
 *                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss,
 *                                          e.g., 2013-01-23T14:42:45
 * @param  {String}   [params.before]       Restricts to all deployments before the given date.
 *                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss,
 *                                          e.g., 2013-01-23T14:42:45
 * @param  {String}   [params.sortBy]       Sort the results lexicographically by a given criterion.
 *                                          Valid values are id, name and deploymentTime. Must be
 *                                          used in conjunction with the sortOrder parameter.
 * @param  {String}   [params.sortOrder]    Sort the results in a given order. Values may be asc for
 *                                          ascending order or desc for descending order. Must be
 *                                          used in conjunction with the sortBy parameter.
 * @param  {Integer}  [params.firstResult]  Pagination of results. Specifies the index of the first
 *                                          result to return.
 * @param  {Integer}  [params.maxResults]   Pagination of results. Specifies the maximum number of
 *                                          results to return. Will return less results if there are
 *                                          no more results left.
 * @param  {Function} done
 */
Deployment.list = function() {
  return AbstractClientResource.list.apply(this, arguments);
};

/**
 * Returns information about a deployment resources for the given deployment.
 */
Deployment.get = function(id, done) {
  return this.http.get(this.path + '/' + id, {
    done: done
  });
};

/**
 * Returns a list of deployment resources for the given deployment.
 */
Deployment.getResources = function(id, done) {
  return this.http.get(this.path + '/' + id + '/resources', {
    done: done
  });
};

/**
 * Returns a deployment resource for the given deployment and resource id.
 */
Deployment.getResource = function(deploymentId, resourceId, done) {
  return this.http.get(this.path + '/' + deploymentId + '/resources/' + resourceId, {
    done: done
  });
};

/**
 * Returns the binary content of a single deployment resource for the given deployment.
 */
Deployment.getResourceData = function(deploymentId, resourceId, done) {
  return this.http.get(this.path + '/' + deploymentId + '/resources/' + resourceId + '/data', {
    accept: '*/*',
    done: done
  });
};

/**
 * Redeploy a deployment

 * @param  {Object} options
 * @param  {String} options.id
 * @param  {Array} [options.resourceIds]
 * @param  {Array} [options.resourceNames]
 * @param  {Function} done
 */
Deployment.redeploy = function(options, done) {
  var id = options.id;
  delete options.id;

  return this.http.post(this.path + '/' + id + '/redeploy', {
    data: options,
    done: done || function() {}
  });
};

module.exports = Deployment;

},{"./../abstract-client-resource":1}],12:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('../abstract-client-resource');
var utils = _dereq_('../../utils');

/**
 * DRD (Decision Requirements Definition) Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var DRD = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
DRD.path = 'decision-requirements-definition';

/**
 * Fetch a  count of DRD's
 * @param  {Object} params                          Query parameters as follow
 * @param  {String} [params.decisionDefinitionId]   Filter by decision definition id.
 * @param  {String} [params.decisionDefinitionIdIn] Filter by decision definition ids.
 * @param  {String} [params.name]                   Filter by name.
 * @param  {String} [params.nameLike]               Filter by names that the parameter is a substring of.
 * @param  {String} [params.deploymentId]           Filter by the deployment the id belongs to.
 * @param  {String} [params.key]                    Filter by key, i.e. the id in the DMN 1.0 XML. Exact match.
 * @param  {String} [params.keyLike]                Filter by keys that the parameter is a substring of.
 * @param  {String} [params.category]               Filter by category. Exact match.
 * @param  {String} [params.categoryLike]           Filter by categories that the parameter is a substring of.
 * @param  {String} [params.version]                Filter by version.
 * @param  {String} [params.latestVersion]          Only include those decision definitions that are latest versions.
 *                                                  Values may be "true" or "false".
 * @param  {String} [params.resourceName]           Filter by the name of the decision definition resource. Exact match.
 * @param  {String} [params.resourceNameLike]       Filter by names of those decision definition resources that the parameter is a substring of.
 *
 * @param  {String} [params.tenantIdInIdLn]         Filter by a comma-separated list of tenant ids. A decision requirements definition
 *                                                  must have one of the given tenant ids.
 *
 * @param  {Boolean} [params.withoutTenantId]       Only include decision requirements definitions which belongs to no tenant.
 *                                                  Value may only be true, as false is the default behavior.
 *
 * @param  {String} [params.includeDecisionRequirementsDefinitionsWithoutTenantId] Include decision requirements definitions which belongs to no tenant.
 *                                                  Can be used in combination with tenantIdIn. Value may only be true, as false is the default behavior.
 * @param {Function} done
 */
DRD.count = function(params, done) {
  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(this.path + '/count', {
    data: params,
    done: done
  });
};

/**
 * Fetch a list of decision definitions
 * @param  {Object} params                        Query parameters as follow
 * @param  {String} [params.decisionDefinitionId] Filter by decision definition id.
 * @param  {String} [params.decisionDefinitionIdIn] Filter by decision definition ids.
 * @param  {String} [params.name]                 Filter by name.
 * @param  {String} [params.nameLike]             Filter by names that the parameter is a substring of.
 * @param  {String} [params.deploymentId]         Filter by the deployment the id belongs to.
 * @param  {String} [params.key]                  Filter by key, i.e. the id in the DMN 1.0 XML. Exact match.
 * @param  {String} [params.keyLike]              Filter by keys that the parameter is a substring of.
 * @param  {String} [params.category]             Filter by category. Exact match.
 * @param  {String} [params.categoryLike]         Filter by categories that the parameter is a substring of.
 * @param  {String} [params.version]              Filter by version.
 * @param  {String} [params.latestVersion]        Only include those decision definitions that are latest versions.
 *                                                Values may be "true" or "false".
 * @param  {String} [params.resourceName]         Filter by the name of the decision definition resource. Exact match.
 * @param  {String} [params.resourceNameLike]     Filter by names of those decision definition resources that the parameter is a substring of.
 *
 * @param  {String} [params.tenantIdInIdLn]       Filter by a comma-separated list of tenant ids. A decision requirements definition
 *                                                must have one of the given tenant ids.
 *
 * @param  {Boolean} [params.withoutTenantId]     Only include decision requirements definitions which belongs to no tenant.
 *                                                Value may only be true, as false is the default behavior.
 *
 * @param  {String} [params.includeDecisionRequirementsDefinitionsWithoutTenantId] Include decision requirements definitions which belongs to no tenant.
 *                                                  Can be used in combination with tenantIdIn. Value may only be true, as false is the default behavior.
 *
 * @param  {String} [params.sortBy]               Sort the results lexicographically by a given criterion.
 *                                                Valid values are category, "key", "id", "name", "version" and "deploymentId".
 *                                                Must be used in conjunction with the "sortOrder" parameter.
 *
 * @param  {String} [params.sortOrder]            Sort the results in a given order.
 *                                                Values may be asc for ascending "order" or "desc" for descending order.
 *                                                Must be used in conjunction with the sortBy parameter.
 *
 * @param  {Integer} [params.firstResult]         Pagination of results. Specifies the index of the first result to return.
 * @param  {Integer} [params.maxResults]          Pagination of results. Specifies the maximum number of results to return.
 *                                                Will return less results, if there are no more results left.
 * @param {Function} done
 */
DRD.list = function(params, done) {
  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(this.path, {
    data: params,
    done: done
  });
};

function createIdUrl(path, id) {
  return path + '/' + utils.escapeUrl(id);
}

/**
 * Retrieves a single decision requirements definition.
 * @param  {uuid}     id   The id of the decision definition to be retrieved.
 * @param  {Function} done
 */
DRD.get = function(id, done) {
  return this.http.get(createIdUrl(this.path, id), {
    done: done
  });
};

function createKeyTenantUrl(path, key, tenantId) {
  var url = path + '/key/' + utils.escapeUrl(key);

  if (typeof tenantId !== 'function') {
    url += '/tenant-id/' + utils.escapeUrl(tenantId);
  }

  return url;
}

/**
 * Retrieves a single decision requirements definition.
 * @param  {string}     key   The key of the decision requirements definition (the latest version thereof) to be retrieved.
 * @param  {uuid}     [tenantId]   The id of the tenant to which the decision requirements definition belongs to.
 * @param  {Function} done
 */
DRD.getByKey = function(key, tenantId, done) {
  var url = createKeyTenantUrl(this.path, key, tenantId);

  if (typeof tenantId === 'function') {
    done = tenantId;
  }

  return this.http.get(url, {
    done: done
  });
};


/**
 * Retrieves the DMN XML of this decision requirements definition.
 * @param  {uuid}     id   The id of the decision definition to be retrieved.
 * @param  {Function} done
 */
DRD.getXML = function(id, done) {
  return this.http.get(createIdUrl(this.path, id) + '/xml', {
    done: done
  });
};

/**
 * Retrieves the DMN XML of this decision requirements definition.
 * @param  {string}     key   The key of the decision requirements definition (the latest version thereof) to be retrieved.
 * @param  {uuid}     [tenantId]   The id of the tenant to which the decision requirements definition belongs to.
 * @param  {Function} done
 */
DRD.getXMLByKey = function(key, tenantId, done) {
  var url = createKeyTenantUrl(this.path, key, tenantId) + '/xml';

  if (typeof tenantId === 'function') {
    done = tenantId;
  }

  return this.http.get(url, {
    done: done
  });
};


module.exports = DRD;

},{"../../utils":44,"../abstract-client-resource":1}],13:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');
var utils = _dereq_('../../utils');



/**
 * Execution Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Execution = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Execution.path = 'execution';

/**
 * Deletes a variable in the context of a given execution. Deletion does not propagate upwards in the execution hierarchy.
 */
Execution.deleteVariable = function(data, done) {
  return this.http.del(this.path + '/' + data.id + '/localVariables/' + utils.escapeUrl(data.varId), {
    done: done
  });
};

/**
 * Updates or deletes the variables in the context of an execution.
 * The updates do not propagate upwards in the execution hierarchy.
 * Updates precede deletions.
 * So, if a variable is updated AND deleted, the deletion overrides the update.
 */
Execution.modifyVariables = function(data, done) {
  return this.http.post(this.path + '/' + data.id + '/localVariables', {
    data: data,
    done: done
  });
};

module.exports = Execution;


},{"../../utils":44,"./../abstract-client-resource":1}],14:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');

/**
 * ExternalTask Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var ExternalTask = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
ExternalTask.path = 'external-task';

/**
 * Retrieves a single external task corresponding to the ExternalTask interface in the engine.
 *
 * @param {Object} [params]
 * @param {String} [params.id]      The id of the external task to be retrieved.
 */
ExternalTask.get = function(params, done) {
  return this.http.get(this.path+ '/' + params.id, {
    data: params,
    done: done
  });
};

/**
 * Query for external tasks that fulfill given parameters in the form of a json object. This method is slightly more
 * powerful than the GET query because it allows to specify a hierarchical result sorting.
 *
 * @param {Object} [params]
 * @param {String} [params.externalTaskId]    Filter by an external task's id.
 * @param {String} [params.topicName]         Filter by an external task topic.
 * @param {String} [params.workerId]          Filter by the id of the worker that the task was most recently locked by.
 * @param {String} [params.locked]            Only include external tasks that are currently locked (i.e. they have a lock time and it has not expired). Value may only be true, as false matches any external task.
 * @param {String} [params.notLocked]         Only include external tasks that are currently not locked (i.e. they have no lock or it has expired). Value may only be true, as false matches any external task.
 * @param {String} [params.withRetriesLeft]	  Only include external tasks that have a positive (> 0) number of retries (or null). Value may only be true, as false matches any external task.
 * @param {String} [params.noRetriesLeft]	    Only include external tasks that have 0 retries. Value may only be true, as false matches any external task.
 * @param {String} [params.lockExpirationAfter]	Restrict to external tasks that have a lock that expires after a given date. The date must have the format yyyy-MM-dd'T'HH:mm:ss, e.g., 2013-01-23T14:42:45.
 * @param {String} [params.lockExpirationBefore]	Restrict to external tasks that have a lock that expires before a given date. The date must have the format yyyy-MM-dd'T'HH:mm:ss, e.g., 2013-01-23T14:42:45.
 * @param {String} [params.activityId]	      Filter by the id of the activity that an external task is created for.
 * @param {String} [params.executionId]	      Filter by the id of the execution that an external task belongs to.
 * @param {String} [params.processInstanceId]	Filter by the id of the process instance that an external task belongs to.
 * @param {String} [params.processDefinitionId]	Filter by the id of the process definition that an external task belongs to.
 * @param {String} [params.active]	          Only include active tasks. Value may only be true, as false matches any external task.
 * @param {String} [params.suspended]	        Only include suspended tasks. Value may only be true, as false matches any external task.
 * @param {String} [params.sorting]           A JSON array of criteria to sort the result by. Each element of the array is a JSON object that specifies one ordering. The position in the array identifies the rank of an ordering, i.e. whether it is primary, secondary, etc. The ordering objects have the following properties:
 *                                            - sortBy	Mandatory. Sort the results lexicographically by a given criterion. Valid values are id, lockExpirationTime, processInstanceId, processDefinitionId, and processDefinitionKey.
 *                                            - sortOrder	Mandatory. Sort the results in a given order. Values may be asc for ascending order or desc for descending order.
 * @param {String} [params.firstResult]	      Pagination of results. Specifies the index of the first result to return.
 * @param {String} [params.maxResults]	      Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 */
ExternalTask.list = function(params, done) {
  var path = this.path +'/';

  // those parameters have to be passed in the query and not body
  path += '?firstResult='+ (params.firstResult || 0);
  path += '&maxResults='+ (params.maxResults || 15);

  return this.http.post(path, {
    data: params,
    done: done
  });
};

/**
 * Query for the number of external tasks that fulfill given parameters. Takes the same parameters as the get external tasks method.
 *
 * @param {Object} [params]
 * @param {String} [params.externalTaskId]    Filter by an external task's id.
 * @param {String} [params.topicName]         Filter by an external task topic.
 * @param {String} [params.workerId]          Filter by the id of the worker that the task was most recently locked by.
 * @param {String} [params.locked]            Only include external tasks that are currently locked (i.e. they have a lock time and it has not expired). Value may only be true, as false matches any external task.
 * @param {String} [params.notLocked]         Only include external tasks that are currently not locked (i.e. they have no lock or it has expired). Value may only be true, as false matches any external task.
 * @param {String} [params.withRetriesLeft]	  Only include external tasks that have a positive (> 0) number of retries (or null). Value may only be true, as false matches any external task.
 * @param {String} [params.noRetriesLeft]	    Only include external tasks that have 0 retries. Value may only be true, as false matches any external task.
 * @param {String} [params.lockExpirationAfter]	Restrict to external tasks that have a lock that expires after a given date. The date must have the format yyyy-MM-dd'T'HH:mm:ss, e.g., 2013-01-23T14:42:45.
 * @param {String} [params.lockExpirationBefore]	Restrict to external tasks that have a lock that expires before a given date. The date must have the format yyyy-MM-dd'T'HH:mm:ss, e.g., 2013-01-23T14:42:45.
 * @param {String} [params.activityId]	      Filter by the id of the activity that an external task is created for.
 * @param {String} [params.executionId]	      Filter by the id of the execution that an external task belongs to.
 * @param {String} [params.processInstanceId]	Filter by the id of the process instance that an external task belongs to.
 * @param {String} [params.processDefinitionId]	Filter by the id of the process definition that an external task belongs to.
 * @param {String} [params.active]	          Only include active tasks. Value may only be true, as false matches any external task.
 * @param {String} [params.suspended]	        Only include suspended tasks. Value may only be true, as false matches any external task.
 */
ExternalTask.count = function(params, done) {
  return this.http.post(this.path + '/count', {
    data: params,
    done: done
  });
};

/**
 * Query for the number of external tasks that fulfill given parameters. Takes the same parameters as the get external tasks method.
 *
 * @param {Object} [params]
 * @param {String} [params.workerId]         Mandatory. The id of the worker on which behalf tasks are fetched. The returned tasks are locked for that worker and can only be completed when providing the same worker id.
 * @param {String} [params.maxTasks]         Mandatory. The maximum number of tasks to return.
 * @param {String} [params.topics]           A JSON array of topic objects for which external tasks should be fetched. The returned tasks may be arbitrarily distributed among these topics.
 *
 * Each topic object has the following properties:
 *  Name	         Description
 *  topicName	   Mandatory. The topic's name.
 *  lockDuration	 Mandatory. The duration to lock the external tasks for in milliseconds.
 *  variables	   A JSON array of String values that represent variable names. For each result task belonging to this topic, the given variables are returned as well if they are accessible from the external task's execution.
 */
ExternalTask.fetchAndLock = function(params, done) {
  return this.http.post(this.path + '/fetchAndLock', {
    data: params,
    done: done
  });
};

/**
 * Complete an external task and update process variables.
 *
 * @param {Object} [params]
 * @param {String} [params.id]            The id of the task to complete.
 * @param {String} [params.workerId]      The id of the worker that completes the task. Must match the id of the worker who has most recently locked the task.
 * @param {String} [params.variables]     A JSON object containing variable key-value pairs.
 *
 * Each key is a variable name and each value a JSON variable value object with the following properties:
 *  Name	        Description
 *  value	        The variable's value. For variables of type Object, the serialized value has to be submitted as a String value.
 *                For variables of type File the value has to be submitted as Base64 encoded string.
 *  type	        The value type of the variable.
 *  valueInfo	    A JSON object containing additional, value-type-dependent properties.
 *                For serialized variables of type Object, the following properties can be provided:
 *                - objectTypeName: A string representation of the object's type name.
 *                - serializationDataFormat: The serialization format used to store the variable.
 *                For serialized variables of type File, the following properties can be provided:
 *                - filename: The name of the file. This is not the variable name but the name that will be used when downloading the file again.
 *                - mimetype: The mime type of the file that is being uploaded.
 *                - encoding: The encoding of the file that is being uploaded.
 */
ExternalTask.complete = function(params, done) {
  return this.http.post(this.path + '/' + params.id + '/complete', {
    data: params,
    done: done
  });
};

/**
 * Report a failure to execute an external task. A number of retries and a timeout until
 * the task can be retried can be specified. If retries are set to 0, an incident for this
 * task is created.
 *
 * @param {Object} [params]
 * @param {String} [params.id]                 The id of the external task to report a failure for.
 * @param {String} [params.workerId]           The id of the worker that reports the failure. Must match the id of the worker who has most recently locked the task.
 * @param {String} [params.errorMessage]       An message indicating the reason of the failure.
 * @param {String} [params.retries]            A number of how often the task should be retried. Must be >= 0. If this is 0, an incident is created and the task cannot be fetched anymore unless the retries are increased again. The incident's message is set to the errorMessage parameter.
 * @param {String} [params.retryTimeout]       A timeout in milliseconds before the external task becomes available again for fetching. Must be >= 0.
 */
ExternalTask.failure = function(params, done) {
  return this.http.post(this.path + '/' + params.id + '/failure', {
    data: params,
    done: done
  });
};

/**
 * Unlock an external task. Clears the task’s lock expiration time and worker id.
 *
 * @param {Object} [params]
 * @param {String} [params.id]          The id of the external task to unlock.
 */
ExternalTask.unlock = function(params, done) {
  return this.http.post(this.path + '/' + params.id + '/unlock', {
    data: params,
    done: done
  });
};

/**
 * Set the number of retries left to execute an external task. If retries are set to 0, an incident is created.
 *
 * @param {Object} [params]
 * @param {String} [params.id]           The id of the external task to unlock.
 * @param {String} [params.retries]      The number of retries to set for the external task. Must be >= 0. If this is 0, an incident is created and the task cannot be fetched anymore unless the retries are increased again.
 */
ExternalTask.retries = function(params, done) {
  return this.http.put(this.path + '/' + params.id + '/retries', {
    data: params,
    done: done
  });
};

/**
 * Set the number of retries left to execute an external task asynchronously. If retries are set to 0, an incident is created.
 *
 * @see https://docs.camunda.org/manual/latest/reference/rest/external-task/post-retries-async/
 *
 * @param   {Object}            params
 * @param   {requestCallback}   done
 */
ExternalTask.retriesAsync = function(params, done) {
  return this.http.post(this.path + '/retries-async', {
    data: params,
    done: done
  });
};

module.exports = ExternalTask;

},{"./../abstract-client-resource":1}],15:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * Filter Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Filter = AbstractClientResource.extend();

/**
 * API path for the filter resource
 * @type {String}
 */
Filter.path = 'filter';


/**
 * Retrieve a single filter
 *
 * @param  {uuid}     filterId   of the filter to be requested
 * @param  {Function} done
 */
Filter.get = function(filterId, done) {
  return this.http.get(this.path +'/'+ filterId, {
    done: done
  });
};


/**
 * Retrieve some filters
 *
 * @param  {Object}   data
 * @param  {Integer}  [data.firstResult]
 * @param  {Integer}  [data.maxResults]
 * @param  {String}   [data.sortBy]
 * @param  {String}   [data.sortOrder]
 * @param  {Bool}     [data.itemCount]
 * @param  {Function} done
 */
Filter.list = function(data, done) {
  return this.http.get(this.path, {
    data: data,
    done: done
  });
};


/**
 * Get the tasks result of filter
 *
 * @param  {(Object.<String, *>|uuid)}  data  uuid of a filter or parameters
 * @param  {uuid}     [data.id]               uuid of the filter to be requested
 * @param  {Integer}  [data.firstResult]
 * @param  {Integer}  [data.maxResults]
 * @param  {String}   [data.sortBy]
 * @param  {String}   [data.sortOrder]
 * @param  {Function} done
 */
Filter.getTasks = function(data, done) {
  var path = this.path +'/';

  if (typeof data === 'string') {
    path = path + data +'/list';
    data = {};
  }
  else {
    path = path + data.id +'/list';
    delete data.id;
  }

  // those parameters have to be passed in the query and not body
  path += '?firstResult='+ (data.firstResult || 0);
  path += '&maxResults='+ (data.maxResults || 15);

  return this.http.post(path, {
    data: data,
    done: done
  });
};


/**
 * Creates a filter
 *
 * @param  {Object}   filter   is an object representation of a filter
 * @param  {Function} done
 */
Filter.create = function(filter, done) {
  return this.http.post(this.path +'/create', {
    data: filter,
    done: done
  });
};


/**
 * Update a filter
 *
 * @param  {Object}   filter   is an object representation of a filter
 * @param  {Function} done
 */
Filter.update = function(filter, done) {
  return this.http.put(this.path +'/'+ filter.id, {
    data: filter,
    done: done
  });
};



/**
 * Save a filter
 *
 * @see Filter.create
 * @see Filter.update
 *
 * @param  {Object}   filter   is an object representation of a filter, if it has
 *                             an id property, the filter will be updated, otherwise created
 * @param  {Function} done
 */
Filter.save = function(filter, done) {
  return Filter[filter.id ? 'update' : 'create'](filter, done);
};


/**
 * Delete a filter
 *
 * @param  {uuid}     id   of the filter to delete
 * @param  {Function} done
 */
Filter.delete = function(id, done) {
  return this.http.del(this.path +'/'+ id, {
    done: done
  });
};


/**
 * Performs an authorizations lookup on the resource or entity
 *
 * @param  {uuid}     [id]   of the filter to get authorizations for
 * @param  {Function} done
 */
Filter.authorizations = function(id, done) {
  if (arguments.length === 1) {
    return this.http.options(this.path, {
      done: id,
      headers: {
        Accept: 'application/json'
      }
    });
  }

  return this.http.options(this.path +'/'+ id, {
    done: done,
    headers: {
      Accept: 'application/json'
    }
  });
};


module.exports = Filter;


},{"./../abstract-client-resource":1}],16:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');
var utils = _dereq_('../../utils');

/**
 * No-Op callback
 */
function noop() {}

/**
 * Group Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Group = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Group.path = 'group';


/**
 * Check resource access
 * @param  {Object}   options
 * @param  {String}   options.id
 * @param  {Function} done
 */
Group.options = function(options, done) {
  var id;

  if (arguments.length === 1) {
    done = options;
    id = '';

  } else {
    id = typeof options === 'string' ? options : options.id;
    if( id === undefined ) {
      id = '';
    }
  }

  return this.http.options(this.path + '/' + utils.escapeUrl(id), {
    done: done || noop,
    headers: {
      Accept: 'application/json'
    }
  });
};

/**
 * Creates a group
 *
 * @param  {Object}   group       is an object representation of a group
 * @param  {String}   group.id
 * @param  {String}   group.name
 * @param  {String}   group.type
 * @param  {Function} done
 */
Group.create = function(options, done) {
  return this.http.post(this.path +'/create', {
    data: options,
    done: done || noop
  });
};


/**
 * Query for groups using a list of parameters and retrieves the count
 *
 * @param {String} [options.id]        Filter by the id of the group.
 * @param {String} [options.name]      Filter by the name of the group.
 * @param {String} [options.nameLike]  Filter by the name that the parameter is a substring of.
 * @param {String} [options.type]      Filter by the type of the group.
 * @param {String} [options.member]    Only retrieve groups where the given user id is a member of.
 * @param  {Function} done
 */
Group.count = function(options, done) {
  if (arguments.length === 1) {
    done = options;
    options = {};
  }
  else {
    options = options || {};
  }

  return this.http.get(this.path + '/count', {
    data: options,
    done: done || noop
  });
};


/**
 * Retrieves a single group
 *
 * @param  {String} [options.id]    The id of the group, can be a property (id) of an object
 * @param  {Function} done
 */
Group.get = function(options, done) {
  var id = typeof options === 'string' ? options : options.id;

  return this.http.get(this.path + '/' + utils.escapeUrl(id), {
    data: options,
    done: done || noop
  });
};


/**
 * Query for a list of groups using a list of parameters.
 * The size of the result set can be retrieved by using the get groups count method
 *
 * @param {String} [options.id]           Filter by the id of the group.
 * @param {String} [options.name]         Filter by the name of the group.
 * @param {String} [options.nameLike]     Filter by the name that the parameter is a substring of.
 * @param {String} [options.type]         Filter by the type of the group.
 * @param {String} [options.member]       Only retrieve groups where the given user id is a member of.
 * @param {String} [options.sortBy]       Sort the results lexicographically by a given criterion.
 *                                        Valid values are id, name and type.
 *                                        Must be used in conjunction with the sortOrder parameter.
 * @param {String} [options.sortOrder]    Sort the results in a given order.
 *                                        Values may be asc for ascending order or desc for descending order.
 *                                        Must be used in conjunction with the sortBy parameter.
 * @param {String} [options.firstResult]  Pagination of results.
 *                                        Specifies the index of the first result to return.
 * @param {String} [options.maxResults]   Pagination of results.
 *                                        Specifies the maximum number of results to return.
 *                                        Will return less results if there are no more results left.
 *
 * @param  {Function} done
 */
Group.list = function(options, done) {
  if (arguments.length === 1) {
    done = options;
    options = {};
  }
  else {
    options = options || {};
  }

  return this.http.get(this.path, {
    data: options,
    done: done || noop
  });
};


/**
 * Add a memeber to a Group
 *
 * @param {String} [options.id]       The id of the group
 * @param {String} [options.userId]   The id of user to add to the group
 * @param  {Function} done
 */
Group.createMember = function(options, done) {
  return this.http.put(this.path +'/' + utils.escapeUrl(options.id) + '/members/' + utils.escapeUrl(options.userId), {
    data: options,
    done: done || noop
  });
};


/**
 * Removes a memeber of a Group
 *
 * @param {String} [options.id]       The id of the group
 * @param {String} [options.userId]   The id of user to add to the group
 * @param  {Function} done
 */
Group.deleteMember = function(options, done) {
  return this.http.del(this.path +'/' + utils.escapeUrl(options.id) + '/members/' + utils.escapeUrl(options.userId), {
    data: options,
    done: done || noop
  });
};


/**
 * Update a group
 *
 * @param  {Object}   group   is an object representation of a group
 * @param  {Function} done
 */
Group.update = function(options, done) {
  return this.http.put(this.path +'/' + utils.escapeUrl(options.id), {
    data: options,
    done: done || noop
  });
};


/**
 * Delete a group
 *
 * @param  {Object}   group   is an object representation of a group
 * @param  {Function} done
 */
Group.delete = function(options, done) {
  return this.http.del(this.path +'/' + utils.escapeUrl(options.id), {
    data: options,
    done: done || noop
  });
};

module.exports = Group;

},{"../../utils":44,"./../abstract-client-resource":1}],17:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('../abstract-client-resource');
var helpers = _dereq_('../helpers');



/**
 * History Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var History = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
History.path = 'history';


/**
 * Query for user operation log entries that fulfill the given parameters.
 *
 * @param {Object}   [params]
 * @param {String}   [params.processDefinitionId]   Filter by process definition id.
 * @param {String}   [params.processDefinitionKey]  Filter by process definition key.
 * @param {String}   [params.processInstanceId]     Filter by process instance id.
 * @param {String}   [params.executionId]           Filter by execution id.
 * @param {String}   [params.caseDefinitionId]      Filter by case definition id.
 * @param {String}   [params.caseInstanceId]        Filter by case instance id.
 * @param {String}   [params.caseExecutionId]       Filter by case execution id.
 * @param {String}   [params.taskId]                Only include operations on this task.
 * @param {String}   [params.userId]                Only include operations of this user.
 * @param {String}   [params.operationId]           Filter by the id of the operation. This allows fetching of multiple entries which are part of a composite operation.
 * @param {String}   [params.operationType]         Filter by the type of the operation like Claim or Delegate.
 * @param {String}   [params.entityType]            Filter by the type of the entity that was affected by this operation, possible values are Task, Attachment or IdentityLink.
 * @param {String}   [params.property]              Only include operations that changed this property, e.g. owner or assignee
 * @param {String}   [params.afterTimestamp]        Restrict to entries that were created after the given timestamp. The timestamp must have the format yyyy-MM-dd'T'HH:mm:ss, e.g. 2014-02-25T14:58:37
 * @param {String}   [params.beforeTimestamp]       Restrict to entries that were created before the given timestamp. The timestamp must have the format yyyy-MM-dd'T'HH:mm:ss, e.g. 2014-02-25T14:58:37
 * @param {String}   [params.sortBy]                Sort the results by a given criterion. At the moment the query only supports sorting based on the timestamp.
 * @param {String}   [params.sortOrder]             Sort the results in a given order. Values may be asc for ascending order or desc for descending order. Must be used in conjunction with the sortBy parameter.
 * @param {Number}   [params.firstResult]           Pagination of results. Specifies the index of the first result to return.
 * @param {Number}   [params.maxResults]            Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 * @param {Function} done
 */
History.userOperation = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.get(this.path + '/user-operation', {
    data: params,
    done: done
  });
};


/**
 * Query for historic process instances that fulfill the given parameters.
 *
 * @param  {Object}   [params]
 * @param  {uuid}     [params.processInstanceId]                Filter by process instance id.
 * @param  {uuid[]}   [params.processInstanceIds]               Filter by process instance ids.
 *                                                              Must be a json array process instance ids.
 * @param  {String}   [params.processInstanceBusinessKey]       Filter by process instance business key.
 * @param  {String}   [params.processInstanceBusinessKeyLike]   Filter by process instance business key that the parameter is a substring of.
 * @param  {uuid}     [params.superProcessInstanceId]           Restrict query to all process instances that are sub process instances of the given process instance.
 *                                                              Takes a process instance id.
 * @param  {uuid}     [params.subProcessInstanceId]             Restrict query to one process instance that has a sub process instance with the given id.
 * @param  {uuid}     [params.superCaseInstanceId]              Restrict query to all process instances that are sub process instances of the given case instance.
 *                                                              Takes a case instance id.
 * @param  {uuid}     [params.subCaseInstanceId]                Restrict query to one process instance that has a sub case instance with the given id.
 * @param  {uuid}     [params.caseInstanceId]                   Restrict query to all process instances that are sub process instances of the given case instance.
 *                                                              Takes a case instance id.
 * @param  {uuid}     [params.processDefinitionId]              Filter by the process definition the instances run on.
 * @param  {String}   [params.processDefinitionKey]             Filter by the key of the process definition the instances run on.
 * @param  {String[]} [params.processDefinitionKeyNotIn]        Exclude instances that belong to a set of process definitions.
 *                                                              Must be a json array of process definition keys.
 * @param  {String}   [params.processDefinitionName]            Filter by the name of the process definition the instances run on.
 * @param  {String}   [params.processDefinitionNameLike]        Filter by process definition names that the parameter is a substring of.
 * @param  {Boolean}  [params.finished]                         Only include finished process instances.
 *                                                              Values may be `true` or `false`.
 * @param  {Boolean}  [params.unfinished]                       Only include unfinished process instances.
 *                                                              Values may be `true` or `false`.
 * @param  {String}   [params.startedBy]                        Only include process instances that were started by the given user.
 * @param  {String}   [params.startedBefore]                    Restrict to instances that were started before the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.startedAfter]                     Restrict to instances that were started after the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.finishedBefore]                   Restrict to instances that were finished before the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.finishedAfter]                    Restrict to instances that were finished after the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {Object[]} [params.variables]                        A JSON array to only include process instances that have/had variables with certain values. The array consists of objects with the three properties name, operator and value. name (String) is the variable name, operator (String) is the comparison operator to be used and value the variable value.
 *                                                              `value` may be String, Number or Boolean.
 *                                                              Valid operator values are:
 *                                                              - `eq` - equal to
 *                                                              - `neq` - not equal to
 *                                                              - `gt` - greater than
 *                                                              - `gteq` - greater than or equal to
 *                                                              - `lt` - lower than
 *                                                              - `lteq` - lower than or equal to
 *                                                              - `like`
 * @param  {String}   [params.sortBy]                           Sort the results by a given criterion.
 *                                                              Valid values are instanceId, definitionId, businessKey, startTime, endTime, duration. Must be used in conjunction with the sortOrder parameter.
 * @param  {String}   [params.sortOrder]                        Sort the results in a given order.
 *                                                              Values may be asc for ascending order or desc for descending order. Must be used in conjunction with the sortBy parameter.
 * @param  {Number}   [params.firstResult]                      Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}   [params.maxResults]                       Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.

 * @param  {Function} done
 */
History.processInstance = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  var body = {};
  var query = {};
  var queryParams = ['firstResult', 'maxResults'];

  for (var p in params) {
    if (queryParams.indexOf(p) > -1) {
      query[p] = params[p];
    }
    else {
      body[p] = params[p];
    }
  }

  return this.http.post(this.path + '/process-instance', {
    data: body,
    query: query,
    done: done
  });
};


/**
 * Query for the number of historic process instances that fulfill the given parameters.
 * This method takes the same message body as `History.processInstance`.
 */
History.processInstanceCount = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.post(this.path + '/process-instance/count', {
    data: params,
    done: done
  });
};

/**
 * Delete finished process instances asynchronously. With creation of a batch operation.
 *
 * @param params - either list of process instance ID's or an object corresponding to a processInstances
 *                  POST request based query
 * @param done - a callback function
 * @returns {*}
 */
History.deleteProcessInstancesAsync = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.post(this.path + '/process-instance/delete', {
    data: params,
    done: done
  });
};



/**
 * Query for historic decision instances that fulfill the given parameters.
 *
 * @param  {Object}   [params]
 * @param  {uuid}     [params.decisionInstanceId]                 Filter by decision instance id.
 * @param  {String}   [params.decisionInstanceIdIn]               Filter by decision instance ids. Must be a comma-separated list of decision instance ids.
 * @param  {uuid}     [params.decisionDefinitionId]               Filter by the decision definition the instances belongs to.
 * @param  {String}   [params.decisionDefinitionKey]              Filter by the key of the decision definition the instances belongs to.
 * @param  {String}   [params.decisionDefinitionName]             Filter by the name of the decision definition the instances belongs to.
 * @param  {uuid}     [params.processDefinitionId]                Filter by the process definition the instances belongs to.
 * @param  {String}   [params.processDefinitionKey]               Filter by the key of the process definition the instances belongs to.
 * @param  {uuid}     [params.processInstanceId]                  Filter by the process instance the instances belongs to.
 * @param  {uuid}     [params.activityIdIn]                       Filter by the activity ids the instances belongs to. Must be a comma-separated list of acitvity ids.
 * @param  {String}   [params.activityInstanceIdIn]               Filter by the activity instance ids the instances belongs to. Must be a comma-separated list of acitvity instance ids.
 * @param  {String}   [params.evaluatedBefore]                    Restrict to instances that were evaluated before the given date. The date must have the format yyyy-MM-dd'T'HH:mm:ss, e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.evaluatedAfter]                     Restrict to instances that were evaluated after the given date. The date must have the format yyyy-MM-dd'T'HH:mm:ss, e.g., 2013-01-23T14:42:45.
 * @param  {Boolean}  [params.includeInputs]                      Include input values in the result. Value may only be true, as false is the default behavior.
 * @param  {Boolean}  [params.includeOutputs]                     Include output values in the result. Value may only be true, as false is the default behavior.
 * @param  {Boolean}  [params.disableBinaryFetching]              Disables fetching of byte array input and output values. Value may only be true, as false is the default behavior.
 * @param  {Boolean}  [params.disableCustomObjectDeserialization] Disables deserialization of input and output values that are custom objects. Value may only be true, as false is the default behavior.
 * @param  {String}   [params.sortBy]                             Sort the results by a given criterion.
 *                                                                Valid values are evaluationTime. Must be used in conjunction with the sortOrder parameter.
 * @param  {String}   [params.sortOrder]                          Sort the results in a given order.
 *                                                                Values may be asc for ascending order or desc for descending order. Must be used in conjunction with the sortBy parameter.
 * @param  {Number}   [params.firstResult]                        Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}   [params.maxResults]                         Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 * @param  {Function} done
 */
History.decisionInstance = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.get(this.path + '/decision-instance', {
    data: params,
    done: done
  });
};


/**
 * Query for the number of historic decision instances that fulfill the given parameters.
 * This method takes the same parameters as `History.decisionInstance`.
 */
History.decisionInstanceCount = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.get(this.path + '/decision-instance/count', {
    data: params,
    done: done
  });
};

/**
 * Query for historic batches that fulfill given parameters. Parameters may be the properties of batches, such as the id or type.
 * The size of the result set can be retrieved by using the GET query count.
 */
History.batch = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.get(this.path + '/batch', {
    data: params,
    done: done
  });
};

/**
 * Retrieves a single historic batch according to the HistoricBatch interface in the engine.
 */
History.singleBatch = function(id, done) {
  return this.http.get(this.path + '/batch/' + id, {
    done: done
  });
};

/**
 * Request the number of historic batches that fulfill the query criteria.
 * Takes the same filtering parameters as the GET query.
 */
History.batchCount = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.get(this.path + '/batch/count', {
    data: params,
    done: done
  });
};

History.batchDelete = function(id, done) {
  var path = this.path + '/batch/' + id;

  return this.http.del(path, {
    done: done
  });
};


/**
 * Query for process instance durations report.
 * @param  {Object}   [params]
 * @param  {Object}   [params.reportType]           Must be 'duration'.
 * @param  {Object}   [params.periodUnit]           Can be one of `month` or `quarter`, defaults to `month`
 * @param  {Object}   [params.processDefinitionIn]  Comma separated list of process definition IDs
 * @param  {Object}   [params.startedAfter]         Date after which the process instance were started
 * @param  {Object}   [params.startedBefore]        Date before which the process instance were started
 * @param  {Function} done
 */
History.report = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  params.reportType = params.reportType || 'duration';
  params.periodUnit = params.periodUnit || 'month';

  return this.http.get(this.path + '/process-instance/report', {
    data: params,
    done: done
  });
};

/**
 * Query for process instance durations report.
 * @param  {Object}   [params]
 * @param  {Object}   [params.reportType]           Must be 'duration'.
 * @param  {Object}   [params.periodUnit]           Can be one of `month` or `quarter`, defaults to `month`
 * @param  {Object}   [params.processDefinitionIn]  Comma separated list of process definition IDs
 * @param  {Object}   [params.startedAfter]         Date after which the process instance were started
 * @param  {Object}   [params.startedBefore]        Date before which the process instance were started
 * @param  {Function} done
 */
History.reportAsCsv = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  params.reportType = params.reportType || 'duration';
  params.periodUnit = params.periodUnit || 'month';

  return this.http.get(this.path + '/process-instance/report', {
    data: params,
    accept: 'text/csv',
    done: done
  });
};

/**
 * Query for historic task instances that fulfill the given parameters.
 *
 * @param  {Object}   [params]
 * @param  {uuid}     [params.taskId]                           Filter by taskId.
 * @param  {uuid}     [params.taskParentTaskId]                 Filter by parent task id.
 * @param  {uuid}     [params.processInstanceId]                Filter by process instance id.
 * @param  {uuid}     [params.executionId]                      Filter by the id of the execution that executed the task.
 * @param  {uuid}     [params.processDefinitionId]              Filter by process definition id.
 * @param  {String}   [params.processDefinitionKey]             Restrict to tasks that belong to a process definition with the given key.
 * @param  {String}   [params.processDefinitionName]            Restrict to tasks that belong to a process definition with the given name.
 * @param  {uuid}     [params.caseInstanceId]                   Filter by case instance id.

 * @param  {uuid}     [params.caseExecutionId]                  Filter by the id of the case execution that executed the task.
 * @param  {uuid}     [params.caseDefinitionId]                 Filter by case definition id.
 * @param  {String}   [params.caseDefinitionKey]                Restrict to tasks that belong to a case definition with the given key.
 * @param  {String}   [params.caseDefinitionName]               Restrict to tasks that belong to a case definition with the given name.
 * @param  {uuid[]}   [params.activityInstanceIdIn]             Only include tasks which belong to one of the passed activity instance ids.
 *                                                              Must be a json array of activity instance ids.
 * @param  {String}   [params.taskName]                         Restrict to tasks that have the given name.
 * @param  {String}   [params.taskNameLike]                     Restrict to tasks that have a name with the given parameter value as substring.
 * @param  {String}   [params.taskDescription]                  Restrict to tasks that have the given description.
 * @param  {String}   [params.taskDescriptionLike]              Restrict to tasks that have a description that has the parameter value as a substring.
 * @param  {String}   [params.taskDefinitionKey]                Restrict to tasks that have the given key.
 * @param  {String}   [params.taskDeleteReason]                 Restrict to tasks that have the given delete reason.
 * @param  {String}   [params.taskDeleteReasonLike]             Restrict to tasks that have a delete reason that has the parameter value as a substring.
 * @param  {String}   [params.taskAssignee]                     Restrict to tasks that the given user is assigned to.
 * @param  {String}   [params.taskAssigneeLike]                 Restrict to tasks that are assigned to users with the parameter value as a substring.
 * @param  {String}   [params.taskOwner]                        Restrict to tasks that the given user owns.
 * @param  {String}   [params.taskOwnerLike]                    Restrict to tasks that are owned by users with the parameter value as a substring.
 * @param  {String}   [params.taskPriority]                     Restrict to tasks that have the given priority.
 * @param  {String}   [params.assigned]                         If set to true, restricts the query to all tasks that are assigned.
 *                                                              Values may be `true` or `false`.
 * @param  {String}   [params.unassigned]                       If set to true, restricts the query to all tasks that are unassigned.
 *                                                              Values may be `true` or `false`.
 * @param  {String}   [params.finished]                         Only include finished tasks. Value may only be true, as false is the default behavior.
 * @param  {String}   [params.unfinished]                       Only include unfinished tasks. Value may only be true, as false is the default behavior.
 * @param  {String}   [params.processFinished]                  Only include tasks of finished processes. Value may only be true, as false is the default behavior.
 * @param  {String}   [params.processUnfinished]                Only include tasks of unfinished processes. Value may only be true, as false is the default behavior.
 * @param  {Date}     [params.taskDueDate]                      Restrict to tasks that are due on the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {Date}     [params.taskDueDateBefore]                RestRestrict to tasks that are due before the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {Date}     [params.taskDueDateAfter]                 Restrict to tasks that are due after the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {Date}     [params.taskFollowUpDate]                 ReRestrict to tasks that have a followUp date on the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {Date}     [params.taskFollowUpDateBefore]           Restrict to tasks that have a followUp date before the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {Date}     [params.taskFollowUpDateAfter]            Restrict to tasks that have a followUp date after the given date.
 *                                                              The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {uuid[]}   [params.tenantIdIn]                       Filter by a comma-separated list of tenant ids. A task instance must have one of the given tenant ids.
 *                                                              Must be a json array of tenant ids.
 * @param  {Object[]} [params.taskVariables]                    A JSON array to only include process instances that have/had variables with certain values. The array consists of objects with the three properties name, operator and value. name (String) is the variable name, operator (String) is the comparison operator to be used and value the variable value.
 *                                                              `value` may be String, Number or Boolean.
 *                                                              Valid operator values are:
 *                                                              - `eq` - equal to
 *                                                              - `neq` - not equal to
 *                                                              - `gt` - greater than
 *                                                              - `gteq` - greater than or equal to
 *                                                              - `lt` - lower than
 *                                                              - `lteq` - lower than or equal to
 *                                                              - `like`
 * @param  {Object[]} [params.processVariables]                 A JSON array to only include process instances that have/had variables with certain values. The array consists of objects with the three properties name, operator and value. name (String) is the variable name, operator (String) is the comparison operator to be used and value the variable value.
 *                                                              `value` may be String, Number or Boolean.
 *                                                              Valid operator values are:
 *                                                              - `eq` - equal to
 *                                                              - `neq` - not equal to
 *                                                              - `gt` - greater than
 *                                                              - `gteq` - greater than or equal to
 *                                                              - `lt` - lower than
 *                                                              - `lteq` - lower than or equal to
 *                                                              - `like`
 * @param  {String}   [params.taskInvolvedUser]                 Restrict on the historic identity links of any type of user.
 * @param  {String}   [params.taskInvolvedGroup]                Restrict on the historic identity links of any type of group.
 * @param  {String}   [params.taskHadCandidateUser]             Restrict on the historic identity links of type candidate user.
 * @param  {String}   [params.taskHadCandidateGroup]            Restrict on the historic identity links of type candidate group.
 * @param  {String}   [params.withCandidateGroups]              Only include tasks which have a candidate group. Value may only be true, as false is the default behavior.
 * @param  {String}   [params.withoutCandidateGroups]           Only include tasks which have no candidate group. Value may only be true, as false is the default behavior.
 * @param  {String}   [params.sortBy]                           Sort the results by a given criterion.
 *                                                              Valid values are taskId, activityInstanceID, processDefinitionId, processInstanceId, executionId,
 *                                                              duration, endTime, startTime, taskName, taskDescription, assignee, owner, dueDate, followUpDate,
 *                                                              deleteReason, taskDefinitionKey, priority, caseDefinitionId, caseInstanceId, caseExecutionId and
 *                                                              tenantId. Must be used in conjunction with the sortOrder parameter.
 * @param  {String}   [params.sortOrder]                        Sort the results in a given order.
 *                                                              Values may be asc for ascending order or desc for descending order. Must be used in conjunction with the sortBy parameter.
 * @param  {Number}   [params.firstResult]                      Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}   [params.maxResults]                       Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.

 * @param  {Function} done
 */
History.task = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  var body = {};
  var query = {};
  var queryParams = ['firstResult', 'maxResults'];

  for (var p in params) {
    if (queryParams.indexOf(p) > -1) {
      query[p] = params[p];
    }
    else {
      body[p] = params[p];
    }
  }

  return this.http.post(this.path + '/task', {
    data: body,
    query: query,
    done: done
  });
};

/**
 * Query for the number of historic task instances that fulfill the given parameters.
 * This method takes the same parameters as `History.task`.
 */
History.taskCount = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.post(this.path + '/task/count', {
    data: params,
    done: done
  });
};

/**
 * Query for a historic task instance duration report.
 *
 * @param  {Object}   [params]
 * @param  {Date}     [params.completedBefore]    Restrict to tasks which are completed before a given date.
 *                                                The date must have the format `yyyy-MM-dd'T'HH:mm:ss`,
 *                                                e.g., 2013-01-23T14:42:45.
 * @param  {Date}     [params.completedAfter]     Restrict to tasks which are completed after a given date.
 *                                                The date must have the format `yyyy-MM-dd'T'HH:mm:ss`,
 *                                                e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.periodUnit]         Can be one of `month` or `quarter`, defaults to `month`
 * @param  {Function}  done
 */
History.taskDurationReport = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  params.reportType = params.reportType || 'duration';
  params.periodUnit = params.periodUnit || 'month';

  return this.http.get(this.path + '/task/report', {
    data: params,
    done: done
  });
};

/**
 * Query for a completed task instance report
 *
 * @param  {Object}   [params]
 * @param  {Date}     [params.completedBefore]    Restrict to tasks which are completed before a given date.
 *                                                The date must have the format `yyyy-MM-dd'T'HH:mm:ss`,
 *                                                e.g., 2013-01-23T14:42:45.
 * @param  {Date}     [params.completedAfter]     Restrict to tasks which are completed after a given date.
 *                                                The date must have the format `yyyy-MM-dd'T'HH:mm:ss`,
 *                                                e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.groupBy]            Groups the task report by `taskDefinitionKey` (Default) or
 *                                                `processDefinitionKey`. Valid values are `taskDefinition` or
 *                                                `processDefinition`.
 * @param done
 * @returns {*}
 */
History.taskReport = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  params.reportType = params.reportType || 'count';

  return this.http.get(this.path + '/task/report', {
    data: params,
    done: done
  });
};

/**
 * Query for historic case instances that fulfill the given parameters.
 *
 * @param  {Object}   [params]
 * @param  {uuid}     [params.caseInstanceId]                Filter by case instance id.
 * @param  {uuid[]}   [params.caseInstanceIds]               Filter by case instance ids.
 *                                                           Must be a json array case instance ids.
 *
 * @param  {uuid}     [params.caseDefinitionId]              Filter by the case definition the instances run on.
 * @param  {String}   [params.caseDefinitionKey]             Filter by the key of the case definition the instances run on.
 * @param  {String[]} [params.caseDefinitionKeyNotIn]        Exclude instances that belong to a set of case definitions.
 *
 * @param  {String}   [params.caseDefinitionName]            Filter by the name of the case definition the instances run on.
 * @param  {String}   [params.caseDefinitionNameLike]        Filter by case definition names that the parameter is a substring of.
 *
 * @param  {String}   [params.caseInstanceBusinessKey]       Filter by case instance business key.
 * @param  {String}   [params.caseInstanceBusinessKeyLike]   Filter by case instance business key that the parameter is a substring of.
 *
 *
 * @param  {String}   [params.createdBefore]                 Restrict to instances that were created before the given date.
 *                                                           The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.createdAfter]                  Restrict to instances that were created after the given date.
 *                                                           The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 *
 * @param  {String}   [params.closedBefore]                  Restrict to instances that were closed before the given date.
 *                                                           The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.closedAfter]                   Restrict to instances that were closed after the given date.
 *                                                           The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 *
 * @param  {String}   [params.createdBy]                     Only include case instances that were created by the given user.
 *
 *
 * @param  {uuid}     [params.superCaseInstanceId]           Restrict query to all case instances that are sub case instances of the given case instance.
 *                                                           Takes a case instance id.
 * @param  {uuid}     [params.subCaseInstanceId]             Restrict query to one case instance that has a sub case instance with the given id.
 *
 * @param  {uuid}     [params.superProcessInstanceId]        Restrict query to all process instances that are sub case instances of the given process instance.
 *                                                           Takes a process instance id.
 * @param  {uuid}     [params.subProcessInstanceId]          Restrict query to one case instance that has a sub process instance with the given id.
 *
 * @param  {uuid}     [params.tenantIdIn]                    Filter by a comma-separated list of tenant ids. A case instance must have one of the given tenant ids.
 *
 * @param  {Boolean}  [params.active]                        Only include active case instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.completed]                     Only include completed case instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.terminated]                    Only include terminated case instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.closed]                        Only include closed case instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.notClosed]                     Only include not closed case instances.
 *                                                           Values may be `true` or `false`.
 *
 * @param  {Object[]} [params.variables]                     A JSON array to only include case instances that have/had variables with certain values. The array consists of objects with the three properties name, operator and value. name (String) is the variable name, operator (String) is the comparison operator to be used and value the variable value.
 *                                                           `value` may be String, Number or Boolean.
 *                                                           Valid operator values are:
 *                                                           - `eq` - equal to
 *                                                           - `neq` - not equal to
 *                                                           - `gt` - greater than
 *                                                           - `gteq` - greater than or equal to
 *                                                           - `lt` - lower than
 *                                                           - `lteq` - lower than or equal to
 *                                                           - `like`
 *
 * @param  {String}   [params.sortBy]                        Sort the results by a given criterion.
 *                                                           Valid values are instanceId, definitionId, businessKey, startTime, endTime, duration. Must be used in conjunction with the sortOrder parameter.
 * @param  {String}   [params.sortOrder]                     Sort the results in a given order.
 *                                                           Values may be asc for ascending order or desc for descending order. Must be used in conjunction with the sortBy parameter.
 * @param  {Number}   [params.firstResult]                   Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}   [params.maxResults]                    Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.

 * @param  {Function} done
 */
History.caseInstance = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  var body = {};
  var query = {};
  var queryParams = ['firstResult', 'maxResults'];

  for (var p in params) {
    if (queryParams.indexOf(p) > -1) {
      query[p] = params[p];
    }
    else {
      body[p] = params[p];
    }
  }

  return this.http.post(this.path + '/case-instance', {
    data: body,
    query: query,
    done: done
  });
};


/**
 * Query for the number of historic case instances that fulfill the given parameters.
 * This method takes the same parameters as `History.caseInstance`.
 */
History.caseInstanceCount = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.post(this.path + '/case-instance/count', {
    data: params,
    done: done
  });
};


/**
 * Query for historic case activty instances that fulfill the given parameters.
 *
 * @param  {Object}   [params]
 * @param  {uuid}     [params.caseActivityInstanceId]        Filter by case activity instance id.
 * @param  {String}   [params.caseExecutionId]               Filter by the id of the case execution that executed the case activity instance.
 * @param  {uuid}     [params.caseInstanceId]                Filter by case instance id.
 *
 * @param  {uuid}     [params.caseDefinitionId]              Filter by the case definition the instances run on.
 *
 * @param  {String}   [params.caseActivityId]                Filter by the case activity id.
 * @param  {String}   [params.caseActivityName]              Filter by the case activity name.
 * @param  {String}   [params.caseActivityType]              Filter by the case activity type.
 *
 * @param  {String}   [params.createdBefore]                 Restrict to instances that were created before the given date.
 *                                                           The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.createdAfter]                  Restrict to instances that were created after the given date.
 *                                                           The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 *
 * @param  {String}   [params.endedBefore]                   Restrict to instances that were ended before the given date.
 *                                                           The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 * @param  {String}   [params.endedAfter]                    Restrict to instances that were ended after the given date.
 *                                                           The date must have the format `yyyy-MM-dd'T'HH:mm:ss`, e.g., 2013-01-23T14:42:45.
 *
 * @param  {Boolean}  [params.required]                      Only include required case activity instances.
 *                                                           Values may be `true` or `false`.
 *
 * @param  {Boolean}  [params.finished]                      Only include finished case activity instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.unfinished]                    Only include unfinished case activity instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.available]                     Only include available case activity instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.enabled]                       Only include enabled case activity instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.disabled]                      Only include disabled case activity instances.
 *                                                           Values may be `true` or `false`.
 * @param  {Boolean}  [params.active]                        Only include active case activity instances.
 *                                                           Values may be `true` or `false`.
 *
 * @param  {Boolean}  [params.completed]                     Only include completed case activity instances.
 *                                                           Values may be `true` or `false`.
 *
 * @param  {Boolean}  [params.terminated]                    Only include terminated case activity instances.
 *                                                           Values may be `true` or `false`.
 *
 * @param  {uuid[]}   [params.tenantIdIn]                    Filter by a comma-separated list of tenant ids. A case activity instance must have one of the given tenant ids.
 *
 * @param  {String}   [params.sortBy]                        Sort the results by a given criterion.
 *                                                           Valid values are caseActivityInstanceId, caseInstanceId, caseExecutionId, caseActivityId, caseActivityName, createTime, endTime, duration,
 *                                                           caseDefinitionId and tenantId. Must be used in conjunction with the sortOrder parameter.
 * @param  {String}   [params.sortOrder]                     Sort the results in a given order.
 *                                                           Values may be asc for ascending order or desc for descending order. Must be used in conjunction with the sortBy parameter.
 * @param  {Number}   [params.firstResult]                   Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}   [params.maxResults]                    Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.

 * @param  {Function} done
 */
History.caseActivityInstance = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.get(this.path + '/case-activity-instance', {
    data: params,
    done: done
  });
};


/**
 * Query for the number of historic case activity instances that fulfill the given parameters.
 * This method takes the same parameters as `History.caseActivityInstance`.
 */
History.caseActivityInstanceCount = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.get(this.path + '/case-activity-instance/count', {
    data: params,
    done: done
  });
};


/**
 * Query for historic variable instances that fulfill the given parameters.
 *
 * @param  {Object}   [params]
 * @param  {uuid}     [params.variableName]                 Filter by variable name.
 * @param  {String}   [params.variableNameLike]             Restrict to variables with a name like the parameter.
 * @param  {uuid[]}   [params.variableValue]                Filter by variable value.
 *
 * @param  {uuid}     [params.processInstanceId]            Filter by the process instance the variable belongs to.
 * @param  {String[]} [params.executionIdIn]                Filter by the execution ids.
 * @param  {String}   [params.caseInstanceId]               Filter by the case instance id.
 * @param  {String[]} [params.caseExecutionIdIn]            Filter by the case execution ids.
 * @param  {String[]} [params.taskIdIn]                     Filter by the task ids.
 * @param  {String[]} [params.activityInstanceIdIn]         Filter by the activity instance ids.
 *
 * @param  {uuid[]}   [params.tenantIdIn]                    Filter by a comma-separated list of tenant ids. A case activity instance must have one of the given tenant ids.
 *
 * @param  {String}   [params.sortBy]                        Sort the results by a given criterion.
 *                                                           Valid values are instanceId, variableName and tenantId. Must be used in conjunction with the sortOrder parameter.
 * @param  {String}   [params.sortOrder]                     Sort the results in a given order.
 *                                                           Values may be asc for ascending order or desc for descending order. Must be used in conjunction with the sortBy parameter.
 * @param  {Number}   [params.firstResult]                   Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}   [params.maxResults]                    Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.

 * @param  {Function} done
 */
History.variableInstance = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  var body = {};
  var query = {};
  var queryParams = ['firstResult', 'maxResults', 'deserializeValues'];

  for (var p in params) {
    if (queryParams.indexOf(p) > -1) {
      query[p] = params[p];
    }
    else {
      body[p] = params[p];
    }
  }

  return this.http.post(this.path + '/variable-instance', {
    data: body,
    query: query,
    done: done
  });
};

/**
 * Query for the number of historic variable instances that fulfill the given parameters.
 * This method takes the same parameters as `History.variableInstance`.
 */
History.variableInstanceCount = function(params, done) {
  if (typeof params === 'function') {
    done = arguments[0];
    params = {};
  }

  return this.http.post(this.path + '/variable-instance/count', {
    data: params,
    done: done
  });
};


History.caseActivityStatistics = function(params, done) {

  var id = params.id || params;

  return this.http.get(this.path + '/case-definition/' + id + '/statistics', {
    done: done
  });
};

History.drdStatistics = function(id, params, done) {
  var url = this.path + '/decision-requirements-definition/' + id + '/statistics';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the history cleanup configuration
 */
History.cleanupConfiguration = function(params,done) {
  var url = this.path + '/cleanup/configuration';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the history cleanup job
 */
History.cleanupJob = function(params,done) {
  var url = this.path + '/cleanup/job';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query to start a history cleanup job
 * @param  {Object}      [params]
 * @param  {Boolean}     [params.executeAtOnce]        Execute job in nearest future
 */
History.cleanup = function(params,done) {
  var url = this.path + '/cleanup';


  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.post(url, {
    data: params,
    done: done
  });
};


/**
 * Query for the count of the finished historic process instances, cleanable process instances and basic process definition data - id, key, name and version
 * @param  {Object}      [params]
 * @param  {uuid[]}      [params.processDefinitionIdIn]        Array of processDefinition ids
 * @param  {uuid[]}      [params.processDefinitionKeyIn]       Array of processDefinition keys
 * @param  {Number}      [params.firstResult]                  Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}      [params.maxResults]                   Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 */
History.cleanableProcessCount = function(params, done) {
  var url = this.path + '/process-definition/cleanable-process-instance-report/count';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the report results about a process definition and finished process instances relevant to history cleanup
 * This method takes the same parameterers as 'History.cleanableProcessInstanceCount'
 */
History.cleanableProcess = function(params, done) {
  var url = this.path + '/process-definition/cleanable-process-instance-report';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the count of the finished historic case instances, cleanable case instances and basic case definition data - id, key, name and version.
 * @param  {uuid[]}      [params.caseDefinitionIdIn]           Array of caseDefinition ids
 * @param  {uuid[]}      [params.caseDefinitionKeyIn]          Array of caseDefinition keys
 * @param  {Number}      [params.firstResult]                  Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}      [params.maxResults]                   Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 */
History.cleanableCaseCount = function(params, done) {
  var url = this.path + '/case-definition/cleanable-case-instance-report/count';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the report results about a case definition and finished case instances relevant to history cleanup
 * This method takes the same parameterers as 'History.cleanableCaseInstanceCount '
 */
History.cleanableCase = function(params, done) {
  var url = this.path + '/case-definition/cleanable-case-instance-report';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the count of the finished historic decision instances, cleanable decision instances and basic decision definition data - id, key, name and version
 * @param  {Object}      [params]
 * @param  {uuid[]}      [params.decisionDefinitionIdIn]           Array of decisionDefinition ids
 * @param  {uuid[]}      [params.decisionDefinitionKeyIn]          Array of decisionDefinition keys
 * @param  {Number}      [params.firstResult]                      Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}      [params.maxResults]                       Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 */
History.cleanableDecisionCount = function(params, done) {
  var url = this.path + '/decision-definition/cleanable-decision-instance-report/count';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the report results about a decision definition and finished decision instances relevant to history cleanup
 * This method takes the same parameterers as 'History.cleanableDecisionInstanceCount '
 */
History.cleanableDecision = function(params, done) {
  var url = this.path + '/decision-definition/cleanable-decision-instance-report';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the count of report results about historic batch operations relevant to history cleanup
 * @param  {Object}      [params]
 * @param  {Number}      [params.firstResult]                      Pagination of results. Specifies the index of the first result to return.
 * @param  {Number}      [params.maxResults]                       Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 */
History.cleanableBatchCount = function(params, done) {
  var url = this.path + '/batch/cleanable-batch-report/count';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};

/**
 * Query for the report about historic batch operations relevant to history cleanup
 * This method takes the same parameterers as 'History.cleanableBatchCount'
 */
History.cleanableBatch = function(params, done) {
  var url = this.path + '/batch/cleanable-batch-report';

  if (typeof params === 'function') {
    done = params;
    params = {};
  }

  return this.http.get(url, {
    data: params,
    done: done
  });
};


History.externalTaskLogList = helpers.createSimpleGetQueryFunction('/external-task-log');
History.externalTaskLogCount = helpers.createSimpleGetQueryFunction('/external-task-log/count');

module.exports = History;

},{"../abstract-client-resource":1,"../helpers":2}],18:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * Incident Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Incident = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Incident.path = 'incident';


/**
 * Query for incidents that fulfill given parameters. The size of the result set can be retrieved by using the get incidents count method.
 *
 * @param  {Object}           params
 *
 * @param  {String}           [params.incidentId]           Restricts to incidents that have the given id.
 *
 * @param  {String}           [params.incidentType]         Restricts to incidents that belong to the given incident type.
 *
 * @param  {String}           [params.incidentMessage]      Restricts to incidents that have the given incident message.
 *
 * @param  {String}           [params.processDefinitionId]  Restricts to incidents that belong to a process definition with the given id.
 *
 * @param  {String}           [params.processInstanceId]    Restricts to incidents that belong to a process instance with the given id.
 *
 * @param  {String}           [params.executionId]          Restricts to incidents that belong to an execution with the given id.
 *
 * @param  {String}           [params.activityId]           Restricts to incidents that belong to an activity with the given id.
 *
 * @param  {String}           [params.causeIncidentId]      Restricts to incidents that have the given incident id as cause incident.
 *
 * @param  {String}           [params.rootCauseIncidentId]  Restricts to incidents that have the given incident id as root cause incident.
 *
 * @param  {String}           [params.configuration]        Restricts to incidents that have the given parameter set as configuration.
 *
 * @param  {String}           [params.sortBy]               Sort the results lexicographically by a given criterion. Valid values are
 *                                                          incidentId, incidentTimestamp, incidentType, executionId, activityId,
 *                                                          processInstanceId, processDefinitionId, causeIncidentId, rootCauseIncidentId
 *                                                          and configuration. Must be used in conjunction with the sortOrder parameter.
 *
 * @param  {String}           [params.sortOrder]            Sort the results in a given order. Values may be asc for ascending order or
 *                                                          desc for descending order. Must be used in conjunction with the sortBy parameter.
 *
 * @param  {String}           [params.firstResult]          Pagination of results. Specifies the
 *                                                          index of the first result to return.
 *
 * @param  {String}           [params.maxResults]           Pagination of results. Specifies the
 *                                                          maximum number of results to return.
 *                                                          Will return less results if there are no
 *                                                          more results left.
 *
 * @param  {RequestCallback}  done
 */
Incident.get = function(params, done) {
  return this.http.get(this.path, {
    data: params,
    done: done
  });
};

/**
 * Query for the number of incidents that fulfill given parameters. Takes the same parameters as the get incidents method.
 *
 * @param  {Object}           params
 *
 * @param  {String}           [params.incidentId]           Restricts to incidents that have the given id.
 *
 * @param  {String}           [params.incidentType]         Restricts to incidents that belong to the given incident type.
 *
 * @param  {String}           [params.incidentMessage]      Restricts to incidents that have the given incident message.
 *
 * @param  {String}           [params.processDefinitionId]  Restricts to incidents that belong to a process definition with the given id.
 *
 * @param  {String}           [params.processInstanceId]    Restricts to incidents that belong to a process instance with the given id.
 *
 * @param  {String}           [params.executionId]          Restricts to incidents that belong to an execution with the given id.
 *
 * @param  {String}           [params.activityId]           Restricts to incidents that belong to an activity with the given id.
 *
 * @param  {String}           [params.causeIncidentId]      Restricts to incidents that have the given incident id as cause incident.
 *
 * @param  {String}           [params.rootCauseIncidentId]  Restricts to incidents that have the given incident id as root cause incident.
 *
 * @param  {String}           [params.configuration]        Restricts to incidents that have the given parameter set as configuration.
 *
 * @param  {RequestCallback}  done
 */
Incident.count = function(params, done) {
  return this.http.get(this.path+'/count', {
    data: params,
    done: done
  });
};

module.exports = Incident;


},{"./../abstract-client-resource":1}],19:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



var JobDefinition = AbstractClientResource.extend();

JobDefinition.path = 'job-definition';

JobDefinition.setRetries = function(params, done) {
  return this.http.put(this.path + '/' + params.id + '/retries', {
    data: params,
    done: done
  });
};

module.exports = JobDefinition;

},{"./../abstract-client-resource":1}],20:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * Job Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Job = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Job.path = 'job';

/**
 * Query for jobs that fulfill given parameters.
 * @param  {Object}   params
 * @param  {String}   [params.jobId]                Filter by job id.
 * @param  {String}   [params.processInstanceId]    Only select jobs which exist for the given process instance.
 * @param  {String}   [params.executionId]          Only select jobs which exist for the given execution.
 * @param  {String}   [params.processDefinitionId]  Filter by the id of the process definition the jobs run on.
 * @param  {String}   [params.processDefinitionKey] Filter by the key of the process definition the jobs run on.
 * @param  {String}   [params.activityId]           Only select jobs which exist for an activity with the given id.
 * @param  {Bool}     [params.withRetriesLeft]      Only select jobs which have retries left.
 * @param  {Bool}     [params.executable]           Only select jobs which are executable, ie. retries > 0 and due date is null or due date is in the past.
 * @param  {Bool}     [params.timers]               Only select jobs that are timers. Cannot be used together with messages.
 * @param  {Bool}     [params.messages]             Only select jobs that are messages. Cannot be used together with timers.
 * @param  {String}   [params.dueDates]             Only select jobs where the due date is lower or higher than the given date. Due date expressions are comma-separated and are structured as follows:
 *                                                  A valid condition value has the form operator_value. operator is the comparison operator to be used and value the date value as string.
 *                                                  Valid operator values are: gt - greater than; lt - lower than.
 *                                                  value may not contain underscore or comma characters.
 * @param  {Bool}     [params.withException]        Only select jobs that failed due to an exception.
 * @param  {String}   [params.exceptionMessage]     Only select jobs that failed due to an exception with the given message.
 * @param  {Bool}     [params.noRetriesLeft]        Only select jobs which have no retries left.
 * @param  {Bool}     [params.active]               Only include active jobs.
 * @param  {Bool}     [params.suspended]            Only include suspended jobs.
 * @param  {Array}    [params.sorting]              A JSON array of criteria to sort the result by. Each element of the array is a JSON object that specifies one ordering. The position in the array identifies the rank of an ordering, i.e. whether it is primary, secondary, etc.
 * @param  {String}   params.sorting.sortBy         Sort the results lexicographically by a given criterion. Valid values are jobId, executionId, processInstanceId, jobRetries and jobDueDate.
 * @param  {String}   params.sorting.sortOrder      Sort the results in a given order. Values may be asc for ascending order or desc for descending order.
 * @param  {String}   [params.firstResult]          Pagination of results. Specifies the index of the first result to return.
 * @param  {String}   [params.maxResults]           Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 * @param  {Function} done
 */
Job.list = function(params, done) {

  var path = this.path;

  // those parameters have to be passed in the query and not body
  path += '?firstResult='+ (params.firstResult || 0);
  if(params.maxResults) {
    path += '&maxResults='+ (params.maxResults);
  }


  return this.http.post(path, {
    data: params,
    done: done
  });
};

/**
 * Sets the retries of the job to the given number of retries.
 * @param  {Object}   params
 * @param  {String}   params.is      The id of the job.
 * @param  {String}   params.retries The number of retries to set that a job has left.
 * @param  {Function} done
 */
Job.setRetries = function(params, done) {
  return this.http.put(this.path + '/' + params.id + '/retries', {
    data: params,
    done: done
  });
};

Job.delete = function(id, done) {
  return this.http.del(this.path + '/' + id, {
    done: done
  });
};

Job.stacktrace = function(id, done) {
  var url = this.path + '/' + id + '/stacktrace';
  return this.http.get(url, {
    accept: 'text/plain',
    done: done
  });
};

module.exports = Job;

},{"./../abstract-client-resource":1}],21:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * Job Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Metrics = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Metrics.path = 'metrics';

/**
 * Query for jobs that fulfill given parameters.
 * @param  {Object}   params
 * @param  {String}   [params.name]
 * @param  {String}   [params.startDate]
 * @param  {String}   [params.endDate]
 * @param  {Function} done
 */
Metrics.sum = function(params, done) {

  var path = this.path + '/' + params.name + '/sum';
  delete params.name;

  return this.http.get(path, { data: params, done: done });
};

/**
 * Retrieves a list of metrics, aggregated for a given interval.
 * @param  {Object}   params
 * @param  {String}   params.name          The name of the metric. Supported names: activity-instance-end, job-acquisition-attempt, job-acquired-success, job-acquired-failure, job-execution-rejected, job-successful, job-failed, job-locked-exclusive, executed-decision-elements
 * @param  {String}   [params.reporter]    The name of the reporter (host), on which the metrics was logged.
 * @param  {String}   [params.startDate]   The start date (inclusive).
 * @param  {String}   [params.endDate]     The end date (exclusive).
 * @param  {Integer}  [params.firstResult] The index of the first result, used for paging.
 * @param  {Integer}  [params.maxResults]  The maximum result size of the list which should be returned. The maxResults can't be set larger than 200. Default: 200
 * @param  {Integer}  [params.interval]    The interval for which the metrics should be aggregated. Time unit is seconds. Default: The interval is set to 15 minutes (900 seconds).
 * @param  {Function} done
 */
Metrics.byInterval = function(params, done) {
  return this.http.get(this.path, { data: params, done: done });
};

module.exports = Metrics;

},{"./../abstract-client-resource":1}],22:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');

/**
 * Migration Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Migration = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Migration.path = 'migration';

/**
 * Generate a migration plan for a given source and target process definition
 * @param  {Object}   params
 * @param  {String}   [params.sourceProcessDefinitionId]
 * @param  {String}   [params.targetProcessDefinitionId]
 * @param  {Function} done
 */
Migration.generate = function(params, done) {
  var path = this.path + '/generate';

  return this.http.post(path, {
    data: params,
    done: done
  });
};

/**
 * Execute a migration plan
 * @param  {Object}   params
 * @param  {String}   [params.migrationPlan]
 * @param  {String}   [params.processInstanceIds]
 * @param  {Function} done
 */
Migration.execute = function(params, done) {
  var path = this.path + '/execute';

  return this.http.post(path, {
    data: params,
    done: done
  });
};

/**
 * Execute a migration plan asynchronously
 * @param  {Object}   params
 * @param  {String}   [params.migrationPlan]
 * @param  {String}   [params.processInstanceIds]
 * @param  {Function} done
 */
Migration.executeAsync = function(params, done) {
  var path = this.path + '/executeAsync';

  return this.http.post(path, {
    data: params,
    done: done
  });
};

Migration.validate = function(params, done) {
  var path = this.path + '/validate';

  return this.http.post(path, {
    data: params,
    done: done
  });
};

module.exports = Migration;

},{"./../abstract-client-resource":1}],23:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');

/**
 * Modification Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Modification = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Modification.path = 'modification';

/**
 * Execute a modification
 * @param  {Object}   params
 * @param  {String}   [params.processDefinitionId]
 * @param  {String}   [params.skipCustomListeners]
 * @param  {String}   [params.skipIoMappings]
 * @param  {String}   [params.processInstanceIds]
 * @param  {String}   [params.processInstanceQuery]
 * @param  {String}   [params.instructions]
 * @param  {Function} done
 */
Modification.execute = function(params, done) {
  var path = this.path + '/execute';

  return this.http.post(path, {
    data: params,
    done: done
  });
};

/**
 * Execute a modification asynchronously
 * @param  {Object}   params
 * @param  {String}   [params.processDefinitionId]
 * @param  {String}   [params.skipCustomListeners]
 * @param  {String}   [params.skipIoMappings]
 * @param  {String}   [params.processInstanceIds]
 * @param  {String}   [params.processInstanceQuery]
 * @param  {String}   [params.instructions]
 * @param  {Function} done
 */
Modification.executeAsync = function(params, done) {
  var path = this.path + '/executeAsync';

  return this.http.post(path, {
    data: params,
    done: done
  });
};

module.exports = Modification;

},{"./../abstract-client-resource":1}],24:[function(_dereq_,module,exports){
'use strict';

var Q = _dereq_('q');
var AbstractClientResource = _dereq_('./../abstract-client-resource');

/**
 * No-Op callback
 */
function noop() {}

/**
 * Process Definition Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var ProcessDefinition = AbstractClientResource.extend(
/** @lends  CamSDK.client.resource.ProcessDefinition.prototype */
  {
  /**
   * Suspends the process definition instance
   *
   * @param  {Object.<String, *>} [params]
   * @param  {requestCallback}    [done]
   */
    suspend: function(params, done) {
    // allows to pass only a callback
      if (typeof params === 'function') {
        done = params;
        params = {};
      }
      params = params || {};
      done = done || noop;

      return this.http.post(this.path, {
        done: done
      });
    },


  /**
   * Retrieves the statistics of a process definition.
   *
   * @param  {Function} [done]
   */
    stats: function(done) {
      return this.http.post(this.path, {
        done: done || noop
      });
    },


  /**
   * Retrieves the BPMN 2.0 XML document of a process definition.
   *
   * @param  {Function} [done]
   */
  // xml: function(id, done) {
  //   return this.http.post(this.path + +'/xml', {
  //     done: done || noop
  //   });
  // },


  /**
   * Starts a process instance from a process definition.
   *
   * @param  {Object} [varname]
   * @param  {Function} [done]
   */
    start: function(done) {
      return this.http.post(this.path, {
        data: {},
        done: done
      });
    }
  },
/** @lends  CamSDK.client.resource.ProcessDefinition */
  {
  /**
   * API path for the process instance resource
   */
    path: 'process-definition',




  /**
   * Retrieve a single process definition
   *
   * @param  {uuid}     id    of the process definition to be requested
   * @param  {Function} done
   */
    get: function(id, done) {

    // var pointer = '';
    // if (data.key) {
    //   pointer = 'key/'+ data.key;
    // }
    // else if (data.id) {
    //   pointer = data.id;
    // }

      return this.http.get(this.path +'/'+ id, {
        done: done
      });
    },


  /**
   * Retrieve a single process definition
   *
   * @param  {String}   key    of the process definition to be requested
   * @param  {Function} done
   */
    getByKey: function(key, done) {
      return this.http.get(this.path +'/key/'+ key, {
        done: done
      });
    },


  /**
   * Get a list of process definitions
   * @param  {Object} params                        Query parameters as follow
   * @param  {String} [params.name]                 Filter by name.
   * @param  {String} [params.nameLike]             Filter by names that the parameter is a substring of.
   * @param  {String} [params.deploymentId]         Filter by the deployment the id belongs to.
   * @param  {String} [params.key]                  Filter by key, i.e. the id in the BPMN 2.0 XML. Exact match.
   * @param  {String} [params.keyLike]              Filter by keys that the parameter is a substring of.
   * @param  {String} [params.category]             Filter by category. Exact match.
   * @param  {String} [params.categoryLike]         Filter by categories that the parameter is a substring of.
   * @param  {String} [params.ver]                  Filter by version.
   * @param  {String} [params.latest]               Only include those process definitions that are latest versions.
   *                                                Values may be "true" or "false".
   * @param  {String} [params.resourceName]         Filter by the name of the process definition resource. Exact match.
   * @param  {String} [params.resourceNameLike]     Filter by names of those process definition resources that the parameter is a substring of.
   * @param  {String} [params.startableBy]          Filter by a user name who is allowed to start the process.
   * @param  {String} [params.active]               Only include active process definitions.
   *                                                Values may be "true" or "false".
   * @param  {String} [params.suspended]            Only include suspended process definitions.
   *                                                Values may be "true" or "false".
   * @param  {String} [params.incidentId]           Filter by the incident id.
   * @param  {String} [params.incidentType]         Filter by the incident type.
   * @param  {String} [params.incidentMessage]      Filter by the incident message. Exact match.
   * @param  {String} [params.incidentMessageLike]  Filter by the incident message that the parameter is a substring of.
   *
   * @param  {String} [params.sortBy]               Sort the results lexicographically by a given criterion.
   *                                                Valid values are category, "key", "id", "name", "version" and "deploymentId".
   *                                                Must be used in conjunction with the "sortOrder" parameter.
   *
   * @param  {String} [params.sortOrder]            Sort the results in a given order.
   *                                                Values may be asc for ascending "order" or "desc" for descending order.
   *                                                Must be used in conjunction with the sortBy parameter.
   *
   * @param  {Integer} [params.firstResult]         Pagination of results. Specifies the index of the first result to return.
   * @param  {Integer} [params.maxResults]          Pagination of results. Specifies the maximum number of results to return.
   *                                                Will return less results, if there are no more results left.

   * @param  {requestCallback} [done]
   *
   * @example
   * CamSDK.resource('process-definition').list({
   *   nameLike: 'Process'
   * }, function(err, results) {
   *   //
   * });
   */
    list: function() {
      return AbstractClientResource.list.apply(this, arguments);
    },


  /**
   * Fetch the variables of a process definition
   * @param  {Object.<String, *>} data
   * @param  {String}             [data.id]     of the process
   * @param  {String}             [data.key]    of the process
   * @param  {Array}              [data.names]  of variables to be fetched
   * @param  {Function}           [done]
   */
    formVariables: function(data, done) {
      var pointer = '';
      done = done || noop;
      if (data.key) {
        pointer = 'key/'+ data.key;
      }
      else if (data.id) {
        pointer = data.id;
      }
      else {
        var err = new Error('Process definition task variables needs either a key or an id.');
        done(err);
        return Q.reject(err);
      }

      var queryData = {
        deserializeValues: data.deserializeValues
      };

      if(data.names) {
        queryData.variableNames = (data.names || []).join(',');
      }

      return this.http.get(this.path +'/'+ pointer +'/form-variables', {
        data: queryData,
        done: done
      });
    },


  /**
   * Submit a form to start a process definition
   *
   * @param  {Object.<String, *>} data
   * @param  {String}             [data.key]            start the process-definition with this key
   * @param  {String}             [data.tenantId]       and the this tenant-id
   * @param  {String}             [data.id]             or: start the process-definition with this id
   * @param  {String}             [data.businessKey]    of the process to be set
   * @param  {Array}              [data.variables]      variables to be set
   * @param  {Function}           [done]
   */
    submitForm: function(data, done) {
      var pointer = '';
      done = done || noop;
      if (data.key) {
        pointer = 'key/'+ data.key;
        if (data.tenantId) {
          pointer += '/tenant-id/' + data.tenantId;
        }
      }
      else if (data.id) {
        pointer = data.id;
      }
      else {
        return done(new Error('Process definition task variables needs either a key or an id.'));
      }

      return this.http.post(this.path +'/'+ pointer +'/submit-form', {
        data: {
          businessKey : data.businessKey,
          variables: data.variables
        },
        done: done
      });
    },


  /**
   * Delete multiple process definitions by key or a single process definition by id
   *
   * @param  {Object.<String, *>} data
   * @param  {String}             [data.key]                        delete the process-definition with this key
   * @param  {String}             [data.tenantId]                   and the this tenant-id
   * @param  {String}             [data.id]                         or: delete the process-definition with this id
   * @param  {Boolean}            [data.cascade]                    All instances, including historic instances,
   *                                                                will also be deleted
   * @param  {Boolean}            [data.skipCustomListeners]        Skip execution listener invocation for
   *                                                                activities that are started or ended
   *                                                                as part of this request.
   * @param  {Function}           [done]
   */
    delete: function(data, done) {
      done = done || noop;

      var pointer = '';
      if (data.key) {
        pointer = 'key/'+ data.key;
        if (data.tenantId) {
          pointer += '/tenant-id/' + data.tenantId;
        }
        pointer += '/delete';
      } else if (data.id) {
        pointer = data.id;
      } else {
        return done(new Error('Process definition deletion needs either a key or an id.'));
      }

      var queryParams = '?';
      var param = 'cascade';
      if (data[param]) {
        queryParams += param + '=true';
      }

      param = 'skipCustomListeners';
      if (data[param]) {
        if (queryParams.length > 1) {
          queryParams += '&';
        }

        queryParams += param + '=true';
      }

      return this.http.del(this.path +'/'+ pointer + queryParams, {
        done: done
      });
    },

  /**
   * Retrieves the form of a process definition.
   * @param  {Function} [done]
   */
    startForm: function(data, done) {
      var path = this.path +'/'+ (data.key ? 'key/'+ data.key : data.id) +'/startForm';
      return this.http.get(path, {
        done: done || noop
      });
    },


  /**
   * Retrieves the form of a process definition.
   * @param  {Function} [done]
   */
    xml: function(data, done) {
      var path = this.path +'/'+ (data.id ? data.id : 'key/'+ data.key) +'/xml';
      return this.http.get(path, {
        done: done || noop
      });
    },

  /**
   * Retrieves runtime statistics of a given process definition grouped by activities
   * @param  {Function} [done]
   */
    statistics: function(data, done) {
      var path = this.path;

      if(data.id) {
        path += '/' + data.id;
      } else if (data.key) {
        path += '/key/'+ data.key;
      }

      path += '/statistics';

      return this.http.get(path, {
        data: data,
        done: done || noop
      });
    },


  /**
   * Submits the form of a process definition.
   *
   * @param  {Object} [data]
   * @param  {Function} [done]
   */
    submit: function(data, done) {
      var path = this.path;
      if (data.key) {
        path += '/key/'+ data.key;
      }
      else {
        path += '/'+ data.id;
      }
      path += '/submit-form';

      return this.http.post(path, {
        data: data,
        done: done
      });
    },


  /**
   * Suspends one or more process definitions
   *
   * @param  {String|String[]}    ids
   * @param  {Object.<String, *>} [params]
   * @param  {requestCallback}    [done]
   */
    suspend: function(ids, params, done) {
    // allows to pass only a callback
      if (typeof params === 'function') {
        done = params;
        params = {};
      }
      params = params || {};
      done = done || noop;
    // allows to pass a single ID
      ids = Array.isArray(ids) ? ids : [ids];

      return this.http.post(this.path, {
        done: done
      });
    },

  /**
   * Instantiates a given process definition.
   *
   * @param {Object} [params]
   * @param {String} [params.id]              The id of the process definition to be instantiated. Must be omitted if key is provided.
   * @param {String} [params.key]             The key of the process definition (the latest version thereof) to be instantiated. Must be omitted if id is provided.
   * @param {String} [params.tenantId]				The id of the tenant the process definition belongs to. Must be omitted if id is provided.
   * @param {String} [params.variables]       A JSON object containing the variables the process is to be initialized with. Each key corresponds to a variable name and each value to a variable value.
   * @param {String} [params.businessKey]     The business key the process instance is to be initialized with. The business key uniquely identifies the process instance in the context of the given process definition.
   * @param {String} [params.caseInstanceId]  The case instance id the process instance is to be initialized with.
   */
    start: function(params, done) {
      var url = this.path + '/';

      if (params.id) {
        url = url + params.id;
      } else {
        url = url + 'key/' + params.key;

        if (params.tenantId) {
          url = url + '/tenant-id/' + params.tenantId;
        }
      }

      return this.http.post(url + '/start', {
        data: params,
        done: done
      });
    },

    /**
    * Instantiates a given process definition.

    * @param {String} [id]                        The id of the process definition to activate or suspend.
    * @param {Object} [params]
    * @param {Number} [params.historyTimeToLive]  New value for historyTimeToLive field of process definition. Can be null.
    */
    updateHistoryTimeToLive: function(id, params, done) {
      var url = this.path + '/' + id + '/history-time-to-live';

      return this.http.put(url, {
        data: params,
        done: done
      });
    },

    restart: function(id, params, done) {
      var url = this.path + '/' + id + '/restart';

      return this.http.post(url, {
        data: params,
        done: done
      });
    },

    restartAsync: function(id, params, done) {
      var url = this.path + '/' + id + '/restart-async';

      return this.http.post(url, {
        data: params,
        done: done
      });
    }
  });


module.exports = ProcessDefinition;

},{"./../abstract-client-resource":1,"q":55}],25:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');
var utils = _dereq_('../../utils');

/**
 * Process Instance Resource
 *
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var ProcessInstance = AbstractClientResource.extend(
/** @lends  CamSDK.client.resource.ProcessInstance.prototype */
  {

  },

/** @lends  CamSDK.client.resource.ProcessInstance */
  {
  /**
   * API path for the process instance resource
   */
    path: 'process-instance',

  /**
   * Retrieve a single process instance
   *
   * @param  {uuid}     id    of the process instance to be requested
   * @param  {Function} done
   */
    get: function(id, done) {
      return this.http.get(this.path +'/'+ id, {
        done: done
      });
    },


  /**
   * Creates a process instance from a process definition
   *
   * @param  {Object}   params
   * @param  {String}   [params.id]
   * @param  {String}   [params.key]
   * @param  {Object.<String, *>} [params.variables]
   * @param  {requestCallback} [done]
   */
    create: function(params, done) {
      return this.http.post(params, done);
    },

    list: function(params, done) {
      var path = this.path;

    // those parameters have to be passed in the query and not body
      path += '?firstResult='+ (params.firstResult || 0);
      path += '&maxResults='+ (params.maxResults || 15);

      return this.http.post(path, {
        data: params,
        done: done
      });
    },

    count: function(params, done) {
      var path = this.path + '/count';

      return this.http.post(path, {
        data: params,
        done: done
      });
    },

  /**
   * Post process instance modifications
   * @see http://docs.camunda.org/api-references/rest/#process-instance-modify-process-instance-execution-state-method
   *
   * @param  {Object}           params
   * @param  {UUID}             params.id                     process instance UUID
   *
   * @param  {Array}            params.instructions           Array of instructions
   *
   * @param  {Boolean}          [params.skipCustomListeners]  Skip execution listener invocation for
   *                                                          activities that are started or ended
   *                                                          as part of this request.
   *
   * @param  {Boolean}          [params.skipIoMappings]       Skip execution of input/output
   *                                                          variable mappings for activities that
   *                                                          are started or ended as part of
   *                                                          this request.
   *
   * @param  {requestCallback}  done
   */
    modify: function(params, done) {
      return this.http.post(this.path + '/' + params.id + '/modification', {
        data: {
          instructions:         params.instructions,
          skipCustomListeners:  params.skipCustomListeners,
          skipIoMappings:       params.skipIoMappings
        },
        done: done
      });
    },

    /**
     * Delete multiple process instances asynchronously (batch).
     *
     * @see https://docs.camunda.org/manual/latest/reference/rest/process-instance/post-delete/
     *
     * @param   {Object}            payload
     * @param   {requestCallback}   done
     *
     */
    deleteAsync: function(payload, done) {
      return this.http.post(this.path + '/delete', {
        data: payload,
        done: done
      });
    },

    /**
     * Delete a set of process instances asynchronously (batch) based on a historic process instance query.
     *
     * @see https://docs.camunda.org/manual/latest/reference/rest/process-instance/post-delete-historic-query-based/
     *
     * @param   {Object}            payload
     * @param   {requestCallback}   done
     *
     */
    deleteAsyncHistoricQueryBased: function(payload, done) {
      return this.http.post(this.path + '/delete-historic-query-based', {
        data: payload,
        done: done
      });
    },

    /**
     * Set retries of jobs belonging to process instances asynchronously (batch).
     *
     * @see https://docs.camunda.org/manual/latest/reference/rest/process-instance/post-set-job-retries
     *
     * @param   {Object}            payload
     * @param   {requestCallback}   done
     *
     */
    setJobsRetriesAsync: function(payload, done) {
      return this.http.post(this.path + '/job-retries', {
        data: payload,
        done: done
      });
    },

    /**
     * Create a batch to set retries of jobs asynchronously based on a historic process instance query.
     *
     * @see https://docs.camunda.org/manual/latest/reference/rest/process-instance/post-set-job-retries-historic-query-based
     *
     * @param   {Object}            payload
     * @param   {requestCallback}   done
     *
     */
    setJobsRetriesAsyncHistoricQueryBased: function(payload, done) {
      return this.http.post(this.path + '/job-retries-historic-query-based', {
        data: payload,
        done: done
      });
    },

    /**
     * Activates or suspends process instances asynchronously with a list of process instance ids, a process instance query, and/or a historical process instance query
     *
     * @see https://docs.camunda.org/manual/latest/reference/rest/process-instance/post-activate-suspend-in-batch/
     *
     * @param   {Object}            payload
     * @param   {requestCallback}   done
     */
    suspendAsync: function(payload, done) {
      return this.http.post(this.path + '/suspended-async', {
        data: payload,
        done: done
      });
    },

    /**
     * Sets a variable of a given process instance by id.
     *
     * @see http://docs.camunda.org/manual/develop/reference/rest/process-instance/variables/put-variable/
     *
     * @param   {uuid}              id
     * @param   {Object}            params
     * @param   {requestCallback}   done
     */
    setVariable: function(id, params, done) {
      var url = this.path + '/' + id + '/variables/' + utils.escapeUrl(params.name);
      return this.http.put(url, {
        data: params,
        done: done
      });
    }

  });


module.exports = ProcessInstance;

},{"../../utils":44,"./../abstract-client-resource":1}],26:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');

/**
 * Task Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var TaskReport = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
TaskReport.path = 'task/report';


/**
 * Fetch the count of tasks grouped by candidate group.
 *
 * @param {Function} done
 */
TaskReport.countByCandidateGroup = function(done) {
  return this.http.get(this.path + '/candidate-group-count', {
    done: done
  });
};

/**
 * Query for process instance durations report.
 * @param  {Object}   [params]
 * @param  {Object}   [params.reportType]           Must be 'duration'.
 * @param  {Object}   [params.periodUnit]           Can be one of `month` or `quarter`, defaults to `month`
 * @param  {Object}   [params.processDefinitionIn]  Comma separated list of process definition IDs
 * @param  {Object}   [params.startedAfter]         Date after which the process instance were started
 * @param  {Object}   [params.startedBefore]        Date before which the process instance were started
 * @param  {Function} done
 */
TaskReport.countByCandidateGroupAsCsv = function(done) {
  return this.http.get(this.path + '/candidate-group-count', {
    accept: 'text/csv',
    done: done
  });
};

module.exports = TaskReport;


},{"./../abstract-client-resource":1}],27:[function(_dereq_,module,exports){
'use strict';

var Q = _dereq_('q');
var AbstractClientResource = _dereq_('./../abstract-client-resource');
var utils = _dereq_('../../utils');

/**
 * No-Op callback
 */
function noop() {}


/**
 * Task Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Task = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Task.path = 'task';


/**
 * Fetch a list of tasks
 * @param {Object} [params]
 * @param {String} [params.processInstanceId]               Restrict to tasks that belong to process instances with the given id.
 * @param {String} [params.processInstanceBusinessKey]      Restrict to tasks that belong to process instances with the given business key.
 * @param {String} [params.processInstanceBusinessKeyLike]  Restrict to tasks that have a process instance business key that has the parameter value as a substring.
 * @param {String} [params.processDefinitionId]             Restrict to tasks that belong to a process definition with the given id.
 * @param {String} [params.processDefinitionKey]            Restrict to tasks that belong to a process definition with the given key.
 * @param {String} [params.processDefinitionName]           Restrict to tasks that belong to a process definition with the given name.
 * @param {String} [params.processDefinitionNameLike]       Restrict to tasks that have a process definition name that has the parameter value as a substring.
 * @param {String} [params.executionId]                     Restrict to tasks that belong to an execution with the given id.
 * @param {String} [params.activityInstanceIdIn]            Only include tasks which belongs to one of the passed and comma-separated activity instance ids.
 * @param {String} [params.assignee]                        Restrict to tasks that the given user is assigned to.
 * @param {String} [params.assigneeLike]                    Restrict to tasks that have an assignee that has the parameter value as a substring.
 * @param {String} [params.owner]                           Restrict to tasks that the given user owns.
 * @param {String} [params.candidateGroup]                  Only include tasks that are offered to the given group.
 * @param {String} [params.candidateUser]                   Only include tasks that are offered to the given user.
 * @param {String} [params.involvedUser]                    Only include tasks that the given user is involved in.
 *                                                          A user is involved in a task if there exists an identity link between task and user (e.g. the user is the assignee).
 * @param {String} [params.unassigned]                      If set to true, restricts the query to all tasks that are unassigned.
 * @param {String} [params.taskDefinitionKey]               Restrict to tasks that have the given key.
 * @param {String} [params.taskDefinitionKeyLike]           Restrict to tasks that have a key that has the parameter value as a substring.
 * @param {String} [params.name]                            Restrict to tasks that have the given name.
 * @param {String} [params.nameLike]                        Restrict to tasks that have a name with the given parameter value as substring.
 * @param {String} [params.description]                     Restrict to tasks that have the given description.
 * @param {String} [params.descriptionLike]                 Restrict to tasks that have a description that has the parameter value as a substring.
 * @param {String} [params.priority]                        Restrict to tasks that have the given priority.
 * @param {String} [params.maxPriority]                     Restrict to tasks that have a lower or equal priority.
 * @param {String} [params.minPriority]                     Restrict to tasks that have a higher or equal priority.
 * @param {String} [params.due]                             Restrict to tasks that are due on the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.dueAfter]                        Restrict to tasks that are due after the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.dueBefore]                       Restrict to tasks that are due before the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.followUp]                        Restrict to tasks that have a followUp date on the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.followUpAfter]                   Restrict to tasks that have a followUp date after the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.followUpBefore]                  Restrict to tasks that have a followUp date before the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.created]                         Restrict to tasks that were created on the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.createdAfter]                    Restrict to tasks that were created after the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.createdBefore]                   Restrict to tasks that were created before the given date.
 *                                                          The date must have the format yyyy-MM-dd'T'HH:mm:ss, so for example 2013-01-23T14:42:45 is valid.
 * @param {String} [params.delegationState]                 Restrict to tasks that are in the given delegation state.
 *                                                          Valid values are "PENDING" and "RESOLVED".
 * @param {String} [params.candidateGroups]                 Restrict to tasks that are offered to any of the given candidate groups. Takes a comma-separated list of group names, so for example developers,support,sales.
 * @param {String} [params.active]                          Only include active tasks. Values may be true or false. suspended Only include suspended tasks.
 *                                                          Values may be "true" or "false".
 * @param {String} [params.taskVariables]                   Only include tasks that have variables with certain values. Variable tasking expressions are comma-separated and are structured as follows:
 *                                                          A valid parameter value has the form key_operator_value. key is the variable name, op is the comparison operator to be used and value the variable value. Note: Values are always treated as String objects on server side. Valid operator values are: eq - equals; neq - not equals; gt - greater than; gteq - greater than or equals; lt - lower than; lteq - lower than or equals; like. key and value may not contain underscore or comma characters.
 * @param {String} [params.processVariables]                Only include tasks that belong to process instances that have variables with certain values.
 *                                                          Variable tasking expressions are comma-separated and are structured as follows:
 *                                                          A valid parameter value has the form key_operator_value. "key" is the variable name, "op" is the comparison operator to be used and value the variable value.
 *                                                          Note: Values are always treated as String objects on server side.
 *                                                          Valid operator values are: "eq" - equals; "neq" - not equals; "gt" - greater than; "gteq" - greater than or equals; "lt" - lower than; "lteq" - lower than or equals; like.
 *                                                          "key" and "value" may not contain underscore or comma characters.
 *
 * @param {String} [params.sortBy]                          Sort the results lexicographically by a given criterion.
 *                                                          Valid values are "instanceId", "dueDate", "executionId", "assignee", "created", "description", "id", "name" and "priority".
 *                                                          Must be used in conjunction with the sortOrder parameter.
 * @param {String} [params.sortOrder]                       Sort the results in a given order. Values may be "asc" for ascending order or "desc" for descending order.
 *                                                          Must be used in conjunction with the sortBy parameter.
 *
 * @param {String} [params.firstResult]                     Pagination of results. Specifies the index of the first result to return.
 * @param {String} [params.maxResults]                      Pagination of results. Specifies the maximum number of results to return.
 *                                                          Will return less results, if there are no more results left.
 * @param {Function} done
 */
Task.list = function(params, done) {
  done = done || noop;
  var deferred = Q.defer();

  this.http.get(this.path, {
    data: params,
    done: function(err, data) {
      if (err) {
        done(err);
        return deferred.reject(err);
      }

      if (data._embedded) {
        // to ease the use of task data, we compile them here
        var tasks = data._embedded.task || data._embedded.tasks;
        var procDefs = data._embedded.processDefinition;

        for (var t in tasks) {
          var task = tasks[t];
          task._embedded = task._embedded || {};
          for (var p in procDefs) {
            if (procDefs[p].id === task.processDefinitionId) {
              task._embedded.processDefinition = [procDefs[p]];
              break;
            }
          }
        }
      }

      done(null, data);
      deferred.resolve(data);
    }
  });

  return deferred.promise;
};


/**
 * Retrieve a single task
 * @param  {uuid}     taskId   of the task to be requested
 * @param  {Function} done
 */
Task.get = function(taskId, done) {
  return this.http.get(this.path +'/'+ taskId, {
    done: done
  });
};

/**
 * Retrieve the comments for a single task
 * @param  {uuid}     taskId   of the task for which the comments are requested
 * @param  {Function} done
 */
Task.comments = function(taskId, done) {
  return this.http.get(this.path +'/'+ taskId + '/comment', {
    done: done
  });
};

/**
 * Retrieve the identity links for a single task
 * @param  {uuid}     taskId   of the task for which the identity links are requested
 * @param  {Function} done
 */
Task.identityLinks = function(taskId, done) {
  return this.http.get(this.path +'/'+ taskId + '/identity-links', {
    done: done
  });
};

/**
 * Add an identity link to a task
 * @param  {uuid}     taskId          of the task for which the identity link is created
 * @param  {Object} [params]
 * @param  {String} [params.userId]   The id of the user to link to the task. If you set this parameter, you have to omit groupId
 * @param  {String} [params.groupId]  The id of the group to link to the task. If you set this parameter, you have to omit userId
 * @param  {String} [params.type]     Sets the type of the link. Must be provided
 * @param  {Function} done
 */
Task.identityLinksAdd = function(taskId, params, done) {
  if (arguments.length === 2) {
    done = arguments[1];
    params = arguments[0];
    taskId = params.id;
  }
  return this.http.post(this.path +'/'+ taskId + '/identity-links', {
    data: params,
    done: done
  });
};

/**
 * Removes an identity link from a task.
 * @param  {uuid}     taskId          The id of the task to remove a link from
 * @param  {Object} [params]
 * @param  {String} [params.userId]   The id of the user being part of the link. If you set this parameter, you have to omit groupId.
 * @param  {String} [params.groupId]  The id of the group being part of the link. If you set this parameter, you have to omit userId.
 * @param  {String} [params.type]     Specifies the type of the link. Must be provided.
 * @param  {Function} done
 */
Task.identityLinksDelete = function(taskId, params, done) {
  if (arguments.length === 2) {
    done = arguments[1];
    params = arguments[0];
    taskId = params.id;
  }

  return this.http.post(this.path +'/'+ taskId + '/identity-links/delete', {
    data: params,
    done: done
  });
};

/**
 * Create a comment for a task.
 *
 * @param  {String}   taskId  The id of the task to add the comment to.
 * @param  {String}   message The message of the task comment to create.
 * @param  {Function} done
 */
Task.createComment = function(taskId, message, done) {
  return this.http.post(this.path +'/'+ taskId +'/comment/create', {
    data: {
      message: message
    },
    done: done
  });
};

/**
 * Creates a task
 *
 * @param  {Object}   task   is an object representation of a task
 * @param  {Function} done
 */
Task.create = function(task, done) {
  return this.http.post(this.path +'/create', {
    data: task,
    done: done
  });
};


/**
 * Update a task
 *
 * @param  {Object}   task   is an object representation of a task
 * @param  {Function} done
 */
Task.update = function(task, done) {
  return this.http.put(this.path +'/'+ task.id, {
    data: task,
    done: done
  });
};



// /**
//  * Save a task
//  *
//  * @see Task.create
//  * @see Task.update
//  *
//  * @param  {Object}   task   is an object representation of a task, if it has
//  *                             an id property, the task will be updated, otherwise created
//  * @param  {Function} done
//  */
// Task.save = function(task, done) {
//   return Task[task.id ? 'update' : 'create'](task, done);
// };

/**
 * Change the assignee of a task to a specific user.
 *
 * Note: The difference with claim a task is that
 * this method does not check if the task already has a user assigned to it
 *
 * Note: The response of this call is empty.
 *
 * @param  {String}   taskId
 * @param  {String}   userId
 * @param  {Function} done
 */
Task.assignee = function(taskId, userId, done) {
  var data = {
    userId: userId
  };

  if (arguments.length === 2) {
    taskId = arguments[0].taskId;
    data.userId = arguments[0].userId;
    done = arguments[1];
  }

  return this.http.post(this.path +'/'+ taskId +'/assignee', {
    data: data,
    done: done
  });
};



/**
 * Delegate a task to another user.
 *
 * Note: The response of this call is empty.
 *
 * @param  {String}   taskId
 * @param  {String}   userId
 * @param  {Function} done
 */
Task.delegate = function(taskId, userId, done) {
  var data = {
    userId: userId
  };

  if (arguments.length === 2) {
    taskId = arguments[0].taskId;
    data.userId = arguments[0].userId;
    done = arguments[1];
  }

  return this.http.post(this.path +'/'+ taskId +'/delegate', {
    data: data,
    done: done
  });
};


/**
 * Claim a task for a specific user.
 *
 * Note: The difference with set a assignee is that
 * here a check is performed to see if the task already has a user assigned to it.
 *
 * Note: The response of this call is empty.
 *
 * @param  {String}   taskId
 * @param  {String}   userId
 * @param  {Function} done
 */
Task.claim = function(taskId, userId, done) {
  var data = {
    userId: userId
  };

  if (arguments.length === 2) {
    taskId = arguments[0].taskId;
    data.userId = arguments[0].userId;
    done = arguments[1];
  }

  return this.http.post(this.path +'/'+ taskId +'/claim', {
    data: data,
    done: done
  });
};


/**
 * Resets a task's assignee. If successful, the task is not assigned to a user.
 *
 * Note: The response of this call is empty.
 *
 * @param  {String}   taskId
 * @param  {Function} done
 */
Task.unclaim = function(taskId, done) {
  if (typeof taskId !== 'string') {
    taskId = taskId.taskId;
  }

  return this.http.post(this.path +'/'+ taskId +'/unclaim', {
    done: done
  });
};


/**
 * Complete a task and update process variables using a form submit.
 * There are two difference between this method and the complete method:
 *
 * If the task is in state PENDING - ie. has been delegated before,
 * it is not completed but resolved. Otherwise it will be completed.
 *
 * If the task has Form Field Metadata defined,
 * the process engine will perform backend validation for any form fields which have validators defined.
 * See the Generated Task Forms section of the User Guide for more information.
 *
 * @param  {Object}   data
 * @param  {Function} done
 */
Task.submitForm = function(data, done) {
  done = done || noop;
  if (!data.id) {
    var err = new Error('Task submitForm needs a task id.');
    done(err);
    return Q.reject(err);
  }

  return this.http.post(this.path +'/'+ data.id +'/submit-form', {
    data: {
      variables: data.variables
    },
    done: done
  });
};

/**
 * Complete a task and update process variables.
 *
 * @param  {object}             [params]
 * @param  {uuid}               [params.id]           Id of the task. This value is mandatory.
 * @param  {Object.<String, *>} [params.variables]    Process variables which need to be updated.
 * @param  {Function} done
 */
Task.complete = function(params, done) {
  done = done || noop;

  if (!params.id) {
    var err = new Error('Task complete needs a task id.');
    done(err);
    return Q.reject(err);
  }

  return this.http.post(this.path + '/' + params.id + '/complete', {
    data: {
      variables: params.variables
    },
    done: done
  });
};

Task.formVariables = function(data, done) {
  done = done || noop;
  var pointer = '';
  if (data.key) {
    pointer = 'key/'+ data.key;
  }
  else if (data.id) {
    pointer = data.id;
  }
  else {
    var err = new Error('Task variables needs either a key or an id.');
    done(err);
    return Q.reject(err);
  }

  var queryData = {
    deserializeValues: data.deserializeValues
  };

  if(data.names) {
    queryData.variableNames = data.names.join(',');
  }

  return this.http.get(this.path +'/'+ pointer +'/form-variables', {
    data: queryData,
    done: done
  });
};

/**
 * Retrieve the form for a single task
 * @param  {uuid}     taskId   of the task for which the form is requested
 * @param  {Function} done
 */
Task.form = function(taskId, done) {
  return this.http.get(this.path +'/'+ taskId + '/form', {
    done: done
  });
};

/**
 * Sets a variable in the context of a given task.
 * @param {Object} [params]
 * @param {String} [params.id]         The id of the task to set the variable for.
 * @param {String} [params.varId]      The name of the variable to set.
 * @param {String} [params.value]      The variable's value. For variables of type Object, the serialized value has to be submitted as a String value.
 * @param {String} [params.type]       The value type of the variable.
 * @param {String} [params.valueInfo]  A JSON object containing additional, value-type-dependent properties.
 * @param {Function} done
 */
Task.localVariable = function(params, done) {
  return this.http.put(this.path +'/'+ params.id + '/localVariables/' + params.varId, {
    data: params,
    done: done
  });
};

/**
 * Retrieve the local variables for a single task
 * @param  {uuid}     taskId   of the task for which the variables are requested
 * @param  {Function} done
 */
Task.localVariables = function(taskId, done) {
  return this.http.get(this.path + '/' + taskId + '/localVariables', {
    done: done
  });
};

/**
 * Updates or deletes the variables in the context of a task.
 * Updates precede deletions.
 * So, if a variable is updated AND deleted, the deletion overrides the update.
 */
Task.modifyVariables = function(data, done) {
  return this.http.post(this.path + '/' + data.id + '/localVariables', {
    data: data,
    done: done
  });
};

/**
 * Removes a local variable from a task.
 */
Task.deleteVariable = function(data, done) {
  return this.http.del(this.path + '/' + data.id + '/localVariables/' + utils.escapeUrl(data.varId), {
    done: done
  });
};


module.exports = Task;


},{"../../utils":44,"./../abstract-client-resource":1,"q":55}],28:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');
var utils = _dereq_('../../utils');

/**
 * No-Op callback
 */
function noop() {}

/**
 * Group Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Tenant = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Tenant.path = 'tenant';

/**
 * Creates a tenant
 *
 * @param  {Object}   tenant       is an object representation of a group
 * @param  {String}   tenant.id
 * @param  {String}   tenant.name
 * @param  {Function} done
 */
Tenant.create = function(options, done) {
  return this.http.post(this.path +'/create', {
    data: options,
    done: done || noop
  });
};


/**
 * Query for tenants using a list of parameters and retrieves the count
 *
 * @param {String} [options.id]           Filter by the id of the tenant.
 * @param {String} [options.name]         Filter by the name of the tenant.
 * @param {String} [options.nameLike]     Filter by the name that the parameter is a substring of.
 * @param {String} [options.userMember]   Only retrieve tenants where the given user id is a member of.
 * @param {String} [options.groupMember]  Only retrieve tenants where the given group id is a member of.
 * @param  {Function} done
 */
Tenant.count = function(options, done) {
  if (arguments.length === 1) {
    done = options;
    options = {};
  }
  else {
    options = options || {};
  }

  return this.http.get(this.path + '/count', {
    data: options,
    done: done || noop
  });
};


/**
 * Retrieves a single tenant
 *
 * @param  {String} [options.id]    The id of the tenant, can be a property (id) of an object
 * @param  {Function} done
 */
Tenant.get = function(options, done) {
  var id;

  if (typeof options === 'string') {
    id = options;
    options = {};
  } else {
    id = options.id;
    delete options.id;
  }

  return this.http.get(this.path + '/' + utils.escapeUrl(id), {
    data: options,
    done: done || noop
  });
};


/**
 * Query for a list of tenants using a list of parameters.
 * The size of the result set can be retrieved by using the get tenants count method
 *
 * @param {String} [options.id]           Filter by the id of the tenant.
 * @param {String} [options.name]         Filter by the name of the tenant.
 * @param {String} [options.nameLike]     Filter by the name that the parameter is a substring of.
 * @param {String} [options.userMember]   Only retrieve tenants where the given user id is a member of.
 * @param {String} [options.grouprMember] Only retrieve tenants where the given group id is a member of.
 * @param {String} [options.sortBy]       Sort the results lexicographically by a given criterion.
 *                                        Valid values are id and name.
 *                                        Must be used in conjunction with the sortOrder parameter.
 * @param {String} [options.sortOrder]    Sort the results in a given order.
 *                                        Values may be asc for ascending order or desc for descending order.
 *                                        Must be used in conjunction with the sortBy parameter.
 * @param {String} [options.firstResult]  Pagination of results.
 *                                        Specifies the index of the first result to return.
 * @param {String} [options.maxResults]   Pagination of results.
 *                                        Specifies the maximum number of results to return.
 *                                        Will return less results if there are no more results left.
 *
 * @param  {Function} done
 */
Tenant.list = function(options, done) {
  if (arguments.length === 1) {
    done = options;
    options = {};
  } else {
    options = options || {};
  }

  return this.http.get(this.path, {
    data: options,
    done: done || noop
  });
};


/**
 * Add a user member to a tenant
 *
 * @param {String} [options.id]       The id of the tenant
 * @param {String} [options.userId]   The id of user to add to the tenant
 * @param  {Function} done
 */
Tenant.createUserMember = function(options, done) {
  return this.http.put(this.path +'/' + utils.escapeUrl(options.id) + '/user-members/' + utils.escapeUrl(options.userId), {
    data: options,
    done: done || noop
  });
};

/**
 * Add a group member to a tenant
 *
 * @param {String} [options.id]       The id of the tenant
 * @param {String} [options.groupId]   The id of group to add to the tenant
 * @param  {Function} done
 */
Tenant.createGroupMember = function(options, done) {
  return this.http.put(this.path +'/' + utils.escapeUrl(options.id) + '/group-members/' + utils.escapeUrl(options.groupId), {
    data: options,
    done: done || noop
  });
};

/**
 * Removes a user member of a tenant
 *
 * @param {String} [options.id]       The id of the tenant
 * @param {String} [options.userId]   The id of user to add to the tenant
 * @param  {Function} done
 */
Tenant.deleteUserMember = function(options, done) {
  return this.http.del(this.path +'/' + utils.escapeUrl(options.id) + '/user-members/' + utils.escapeUrl(options.userId), {
    data: options,
    done: done || noop
  });
};

/**
 * Removes a group member of a Tenant
 *
 * @param {String} [options.id]       The id of the tenant
 * @param {String} [options.groupId]   The id of group to add to the tenant
 * @param  {Function} done
 */
Tenant.deleteGroupMember = function(options, done) {
  return this.http.del(this.path +'/' + utils.escapeUrl(options.id) + '/group-members/' + utils.escapeUrl(options.groupId), {
    data: options,
    done: done || noop
  });
};

/**
 * Update a tenant
 *
 * @param  {Object}   tenant   is an object representation of a tenant
 * @param  {Function} done
 */
Tenant.update = function(options, done) {
  return this.http.put(this.path +'/' + utils.escapeUrl(options.id), {
    data: options,
    done: done || noop
  });
};


/**
 * Delete a tenant
 *
 * @param  {Object}   tenant   is an object representation of a tenant
 * @param  {Function} done
 */
Tenant.delete = function(options, done) {
  return this.http.del(this.path +'/' + utils.escapeUrl(options.id), {
    data: options,
    done: done || noop
  });
};

Tenant.options = function(options, done) {
  var id;

  if (arguments.length === 1) {
    done = options;
    id = '';

  } else {
    id = typeof options === 'string' ? options : options.id;
    if( id === undefined ) {
      id = '';
    }
  }

  return this.http.options(this.path + '/' + utils.escapeUrl(id), {
    done: done || noop,
    headers: {
      Accept: 'application/json'
    }
  });
};
module.exports = Tenant;

},{"../../utils":44,"./../abstract-client-resource":1}],29:[function(_dereq_,module,exports){
'use strict';

var Q = _dereq_('q');
var AbstractClientResource = _dereq_('./../abstract-client-resource');
var utils = _dereq_('../../utils');

/**
 * No-Op callback
 */
function noop() {}

/**
 * User Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var User = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
User.path = 'user';

/**
 * Check resource access
 * @param  {Object}   options
 * @param  {String}   options.id
 * @param  {Function} done
 */
User.options = function(options, done) {
  var id;

  if (arguments.length === 1) {
    done = options;
    id = '';

  } else {
    id = typeof options === 'string' ? options : options.id;
    if( id === undefined ) {
      id = '';
    }
  }

  return this.http.options(this.path + '/' + utils.escapeUrl(id), {
    done: done || noop,
    headers: {
      Accept: 'application/json'
    }
  });
};

/**
 * Creates a user
 * @param  {Object}   options
 * @param  {String}   options.id
 * @param  {String}   options.password
 * @param  {String}   options.firstName
 * @param  {String}   options.lastName
 * @param  {String}   [options.email]
 * @param  {Function} done
 */
User.create = function(options, done) {
  options = options || {};
  done = done || noop;

  var required = [
    'id',
    'firstName',
    'lastName',
    'password'
  ];
  for (var r in required) {
    var name = required[r];
    if (!options[name]) {
      var err = new Error('Missing ' + name + ' option to create user');
      done(err);
      return Q.reject(err);
    }
  }

  var data = {
    profile: {
      id: options.id,
      firstName: options.firstName,
      lastName: options.lastName
    },
    credentials: {
      password: options.password
    }
  };

  if (options.email) {
    data.profile.email = options.email;
  }

  return this.http.post(this.path +'/create', {
    data: data,
    done: done
  });
};


/**
 * List users
 * @param {Object} [options]
 * @param {String} [options.id]            Filter by the id of the user.
 * @param {String} [options.firstName]     Filter by the firstname of the user.
 * @param {String} [options.firstNameLike] Filter by the firstname that the parameter is a substring of.
 * @param {String} [options.lastName]      Filter by the lastname of the user.
 * @param {String} [options.lastNameLike]  Filter by the lastname that the parameter is a substring of.
 * @param {String} [options.email]         Filter by the email of the user.
 * @param {String} [options.emailLike]     Filter by the email that the parameter is a substring of.
 * @param {String} [options.memberOfGroup] Filter for users which are members of a group.
 * @param {String} [options.sortBy]        Sort the results lexicographically by a given criterion. Valid values are userId, firstName, lastName and email. Must be used in conjunction with the sortOrder parameter.
 * @param {String} [options.sortOrder]     Sort the results in a given order. Values may be asc for ascending order or desc for descending order. Must be used in conjunction with the sortBy parameter.
 * @param {String} [options.firstResult]   Pagination of results. Specifies the index of the first result to return.
 * @param {String} [options.maxResults]    Pagination of results. Specifies the maximum number of results to return. Will return less results if there are no more results left.
 * @param  {Function} done
 */
User.list = function(options, done) {
  if (arguments.length === 1) {
    done = options;
    options = {};
  }
  else {
    options = options || {};
  }

  return this.http.get(this.path, {
    data: options,
    done: done || noop
  });
};


/**
 * Count the amount of users
 * @param {String} [options.id]            id of the user.
 * @param {String} [options.firstName]     firstname of the user.
 * @param {String} [options.firstNameLike] firstname that the parameter is a substring of.
 * @param {String} [options.lastName]      lastname of the user.
 * @param {String} [options.lastNameLike]  lastname that the parameter is a substring of.
 * @param {String} [options.email]         email of the user.
 * @param {String} [options.emailLike]     email that the parameter is a substring of.
 * @param {String} [options.memberOfGroup] users which are members of a group.
 * @param  {Function} done
 */
User.count = function(options, done) {
  if (arguments.length === 1) {
    done = options;
    options = {};
  }
  else {
    options = options || {};
  }

  return this.http.get(this.path + '/count', {
    data: options,
    done: done || noop
  });
};


/**
 * Get the profile of a user
 * @param  {Object|uuid}  options
 * @param  {uuid}         options.id
 * @param  {Function} done
 */
User.profile = function(options, done) {
  var id = typeof options === 'string' ? options : options.id;

  return this.http.get(this.path + '/' + utils.escapeUrl(id) + '/profile', {
    done: done || noop
  });
};


/**
 * Updates the profile of a user
 * @param  {Object}   options
 * @param  {uuid}     options.id id of the user to be updated
 * @param  {String}   [options.firstName]
 * @param  {String}   [options.lastName]
 * @param  {String}   [options.email]
 * @param  {Function} done
 */
User.updateProfile = function(options, done) {
  options = options || {};
  done = done || noop;

  if (!options.id) {
    var err = new Error('Missing id option to update user profile');
    done(err);
    return Q.reject(err);
  }

  return this.http.put(this.path + '/' + utils.escapeUrl(options.id) + '/profile', {
    data: options,
    done: done
  });
};



/**
 * Update the credentials of a user
 * @param {Object} options
 * @param {uuid} options.id                           The user's (who will be updated) id
 * @param {String} options.password                     The user's new password.
 * @param {String} [options.authenticatedUserPassword]  The password of the authenticated user who changes the password of the user (ie. the user with passed id as path parameter).
 * @param  {Function} done
 */
User.updateCredentials = function(options, done) {
  options = options || {};
  done = done || noop;
  var err;

  if (!options.id) {
    err = new Error('Missing id option to update user credentials');
    done(err);
    return Q.reject(err);
  }

  if (!options.password) {
    err = new Error('Missing password option to update user credentials');
    done(err);
    return Q.reject(err);
  }

  var data = {
    password: options.password
  };

  if (options.authenticatedUserPassword) {
    data.authenticatedUserPassword = options.authenticatedUserPassword;
  }

  return this.http.put(this.path + '/' + utils.escapeUrl(options.id) + '/credentials', {
    data: data,
    done: done
  });
};


/**
 * Delete a user
 * @param  {Object|uuid} options You can either pass an object (with at least a id property) or the id of the user to be deleted
 * @param  {uuid} options.id
 * @param  {Function} done
 */
User.delete = function(options, done) {
  var id = typeof options === 'string' ? options : options.id;

  return this.http.del(this.path + '/' + utils.escapeUrl(id), {
    done: done || noop
  });
};

module.exports = User;

},{"../../utils":44,"./../abstract-client-resource":1,"q":55}],30:[function(_dereq_,module,exports){
'use strict';

var AbstractClientResource = _dereq_('./../abstract-client-resource');



/**
 * Variable Resource
 * @class
 * @memberof CamSDK.client.resource
 * @augments CamSDK.client.AbstractClientResource
 */
var Variable = AbstractClientResource.extend();

/**
 * Path used by the resource to perform HTTP queries
 * @type {String}
 */
Variable.path = 'variable-instance';


/**
 * Get variable instances
 *
 * @param  {Object}           params
 *
 * @param  {String}           [params.variableName]         Filter by variable instance name.
 *
 * @param  {String}           [params.variableNameLike]     Filter by the variable instance name.
 *                                                          The parameter can include the wildcard %
 *                                                          to express like-strategy such as:
 *                                                          - starts with (%name)
 *                                                          - ends with (name%)
 *                                                          - contains (%name%).
 *
 * @param  {String[]}         [params.processInstanceIdIn]  Only include variable instances which
 *                                                          belong to one of the passed and
 *                                                          comma-separated process instance ids.
 *
 * @param  {String[]}         [params.executionIdIn]        Only include variable instances which
 *                                                          belong to one of the passed and
 *                                                          comma-separated execution ids.
 *
 * @param  {String[]}         [params.caseInstanceIdIn]     Only include variable instances which
 *                                                          belong to one of the passed
 *                                                          case instance ids.
 *
 * @param  {String[]}         [params.caseExecutionIdIn]    Only include variable instances which
 *                                                          belong to one of the passed
 *                                                          case execution ids.
 *
 * @param  {String[]}         [params.taskIdIn]             Only include variable instances which
 *                                                          belong to one of the passed and
 *                                                          comma-separated task ids.
 *
 * @param  {String[]}         [params.activityInstanceIdIn] Only include variable instances which
 *                                                          belong to one of the passed and
 *                                                          comma-separated activity instance ids.
 *
 * @param  {String}           [params.variableValues]       Only include variable instances that
 *                                                          have the certain values. Value filtering
 *                                                          expressions are comma-separated and are
 *                                                          structured as follows:
 *                                                          A valid parameter value has the form
 *                                                          key_operator_value.
 *                                                          key is the variable name,
 *                                                          operator is the comparison operator to
 *                                                          be used and value the variable value.
 *                                                          *Note*: Values are always treated as
 *                                                          String objects on server side.
 *                                                          Valid operator values are:
 *                                                          - eq - equal to
 *                                                          - neq - not equal to
 *                                                          - gt - greater than
 *                                                          - gteq - greater than or equal to
 *                                                          - lt - lower than
 *                                                          - lteq - lower than or equal to
 *                                                          key and value may not contain underscore
 *                                                          or comma characters.
 *
 * @param  {String}           [params.sortBy]               Sort the results lexicographically by a
 *                                                          given criterion. Valid values are
 *                                                          variableName, variableType and
 *                                                          activityInstanceId.
 *                                                          Must be used in conjunction with the
 *                                                          sortOrder parameter.
 *
 * @param  {String}           [params.sortOrder]            Sort the results in a given order.
 *                                                          Values may be asc for ascending order or
 *                                                          desc for descending order.
 *                                                          Must be used in conjunction with the
 *                                                          sortBy parameter.
 *
 * @param  {String}           [params.firstResult]          Pagination of results. Specifies the
 *                                                          index of the first result to return.
 *
 * @param  {String}           [params.maxResults]           Pagination of results. Specifies the
 *                                                          maximum number of results to return.
 *                                                          Will return less results if there are no
 *                                                          more results left.
 *
 * @param  {String}           [params.deserializeValues]    Determines whether serializable variable
 *                                                          values (typically variables that store
 *                                                          custom Java objects) should be
 *                                                          deserialized on server side
 *                                                          (default true).
 *                                                          If set to true, a serializable variable
 *                                                          will be deserialized on server side and
 *                                                          transformed to JSON using
 *                                                          Jackson's POJO/bean property
 *                                                          introspection feature.
 *                                                          Note that this requires the Java classes
 *                                                          of the variable value to be on the
 *                                                          REST API's classpath.
 *                                                          If set to false, a serializable variable
 *                                                          will be returned in its serialized
 *                                                          format.
 *                                                          For example, a variable that is
 *                                                          serialized as XML will be returned as a
 *                                                          JSON string containing XML.
 *                                                          Note:While true is the default value for
 *                                                          reasons of backward compatibility, we
 *                                                          recommend setting this parameter to
 *                                                          false when developing web applications
 *                                                          that are independent of the Java process
 *                                                          applications deployed to the engine.
 *
 * @param  {RequestCallback}  done
 */
Variable.instances = function(params, done) {

  var body = {};
  var query = {};
  var queryParams = ['firstResult', 'maxResults', 'deserializeValues'];

  for (var p in params) {
    if (queryParams.indexOf(p) > -1) {
      query[p] = params[p];
    }
    else {
      body[p] = params[p];
    }
  }

  return this.http.post(this.path, {
    data: body,
    query: query,
    done: done
  });
};

module.exports = Variable;


},{"./../abstract-client-resource":1}],31:[function(_dereq_,module,exports){
'use strict';

var Events = _dereq_('./events');

function noop() {}

/**
 * Abstract class for classes
 *
 * @class
 * @memberof CamSDK
 *
 * @borrows CamSDK.Events.on                        as on
 * @borrows CamSDK.Events.once                      as once
 * @borrows CamSDK.Events.off                       as off
 * @borrows CamSDK.Events.trigger                   as trigger
 *
 * @borrows CamSDK.Events.on                        as prototype.on
 * @borrows CamSDK.Events.once                      as prototype.once
 * @borrows CamSDK.Events.off                       as prototype.off
 * @borrows CamSDK.Events.trigger                   as prototype.trigger
 */
function BaseClass() {
  this.initialize();
}




/**
 * Creates a new Resource Class, very much inspired from Backbone.Model.extend.
 * [Backbone helpers]{@link http://backbonejs.org/docs/backbone.html}
 *
 *
 * @param  {?Object.<String, *>} protoProps
 * @param  {Object.<String, *>} [staticProps]
 * @return {CamSDK.BaseClass}
 */
BaseClass.extend = function(protoProps, staticProps) {
  protoProps = protoProps || {};
  staticProps = staticProps || {};

  var parent = this;
  var child, Surrogate, s, i;

  if (protoProps && Object.hasOwnProperty.call(parent, 'constructor')) {
    child = protoProps.constructor;
  }
  else {
    child = function() { return parent.apply(this, arguments); };
  }

  for (s in parent) {
    child[s] = parent[s];
  }
  for (s in staticProps) {
    child[s] = staticProps[s];
  }

  Surrogate = function() { this.constructor = child; };
  Surrogate.prototype = parent.prototype;
  child.prototype = new Surrogate();

  for (i in protoProps) {
    child.prototype[i] = protoProps[i];
  }

  return child;
};


/**
 * Aimed to be overriden in order to initialize an instance.
 *
 * @memberof CamSDK.BaseClass.prototype
 * @method initialize
 */
BaseClass.prototype.initialize = noop;


Events.attach(BaseClass);



module.exports = BaseClass;

},{"./events":32}],32:[function(_dereq_,module,exports){
'use strict';

/**
 * Events handling utility which can be used on
 * any kind of object to provide `on`, `once`, `off`
 * and `trigger` functions.
 *
 * @exports CamSDK.Events
 * @mixin
 *
 * @example
 * var obj = {};
 * Events.attach(obj);
 *
 * obj.on('event:name', function() {});
 * obj.once('event:name', function() {});
 * obj.trigger('event:name', data, moreData, evenMoreData);
 */

var Events = {};


/**
 * Converts an object into array
 * @param  {*} obj
 * @return {Array}
 */
function toArray(obj) {
  var a, arr = [];
  for (a in obj) {
    arr.push(obj[a]);
  }
  return arr;
}

/**
 * Returns a function that will be executed
 * at most one time, no matter how often you call it.
 * @param  {Function} func
 * @return {Function}
 */
function once(func) {
  var ran = false, memo;
  return function() {
    if (ran) return memo;
    ran = true;
    memo = func.apply(this, arguments);
    func = null;
    return memo;
  };
}


/**
 * Ensure an object to have the needed _events property
 * @param  {*} obj
 * @param  {String} name
 */
function ensureEvents(obj, name) {
  obj._events = obj._events || {};
  obj._events[name] = obj._events[name] || [];
}


/**
 * Add the relevant Events methods to an object
 * @param  {*} obj
 */
Events.attach = function(obj) {
  obj.on      = this.on;
  obj.once    = this.once;
  obj.off     = this.off;
  obj.trigger = this.trigger;
  obj._events = {};
};


/**
 * Bind a callback to `eventName`
 * @param  {String}   eventName
 * @param  {Function} callback
 */
Events.on = function(eventName, callback) {
  ensureEvents(this, eventName);

  this._events[eventName].push(callback);

  return this;
};


/**
 * Bind a callback who will only be called once to `eventName`
 * @param  {String}   eventName
 * @param  {Function} callback
 */
Events.once = function(eventName, callback) {
  var self = this;
  var cb = once(function() {
    self.off(eventName, once);
    callback.apply(this, arguments);
  });
  cb._callback = callback;
  return this.on(eventName, cb);
};


/**
 * Unbind one or all callbacks originally bound to `eventName`
 * @param  {String}   eventName
 * @param  {Function} [callback]
 */
Events.off = function(eventName, callback) {
  ensureEvents(this, eventName);

  if (!callback) {
    delete this._events[eventName];
    return this;
  }

  var e, arr = [];
  for (e in this._events[eventName]) {
    if (this._events[eventName][e] !== callback) {
      arr.push(this._events[eventName][e]);
    }
  }
  this._events[eventName] = arr;

  return this;
};


/**
 * Call the functions bound to `eventName`
 * @param  {String} eventName
 * @param {...*} [params]
 */
Events.trigger = function() {
  var args = toArray(arguments);
  var eventName = args.shift();
  ensureEvents(this, eventName);

  var e;
  for (e in this._events[eventName]) {
    this._events[eventName][e](this, args);
  }

  return this;
};


module.exports = Events;

},{}],33:[function(_dereq_,module,exports){
'use strict';
/* global CamSDK, require, localStorage: false */

/**
 * For all API client related
 * @namespace CamSDK.form
 */

var moment = _dereq_('moment');

var $ = _dereq_('./dom-lib');

var VariableManager = _dereq_('./variable-manager');

var InputFieldHandler = _dereq_('./controls/input-field-handler');

var ChoicesFieldHandler = _dereq_('./controls/choices-field-handler');

var FileDownloadHandler = _dereq_('./controls/file-download-handler');

var BaseClass = _dereq_('./../base-class');

var constants = _dereq_('./constants');

var Events = _dereq_('./../events');


function extend(dest, add) {
  for (var key in add) {
    dest[key] = add[key];
  }
  return dest;
}


/**
 * A class to help handling embedded forms
 *
 * @class
 * @memberof CamSDk.form
 *
 * @param {Object.<String,*>} options
 * @param {Cam}               options.client
 * @param {String}            [options.taskId]
 * @param {String}            [options.processDefinitionId]
 * @param {String}            [options.processDefinitionKey]
 * @param {Element}           [options.formContainer]
 * @param {Element}           [options.formElement]
 * @param {Object}            [options.urlParams]
 * @param {String}            [options.formUrl]
 */
function CamundaForm(options) {
  if(!options) {
    throw new Error('CamundaForm need to be initialized with options.');
  }

  var done = options.done = options.done || function(err) { if(err) throw err; };

  if (options.client) {
    this.client = options.client;
  }
  else {
    this.client = new CamSDK.Client(options.clientConfig || {});
  }

  if (!options.taskId && !options.processDefinitionId && !options.processDefinitionKey) {
    return done(new Error('Cannot initialize Taskform: either \'taskId\' or \'processDefinitionId\' or \'processDefinitionKey\' must be provided'));
  }

  this.taskId = options.taskId;
  if(this.taskId) {
    this.taskBasePath = this.client.baseUrl + '/task/' + this.taskId;
  }
  this.processDefinitionId = options.processDefinitionId;
  this.processDefinitionKey = options.processDefinitionKey;

  this.formElement = options.formElement;
  this.containerElement = options.containerElement;
  this.formUrl = options.formUrl;

  if(!this.formElement && !this.containerElement) {
    return done(new Error('CamundaForm needs to be initilized with either \'formElement\' or \'containerElement\''));
  }

  if(!this.formElement && !this.formUrl) {
    return done(new Error('Camunda form needs to be intialized with either \'formElement\' or \'formUrl\''));
  }

  /**
   * A VariableManager instance
   * @type {VariableManager}
   */
  this.variableManager = new VariableManager({
    client: this.client
  });

  /**
   * An array of FormFieldHandlers
   * @type {FormFieldHandlers[]}
   */
  this.formFieldHandlers = options.formFieldHandlers || [
    InputFieldHandler,
    ChoicesFieldHandler,
    FileDownloadHandler
  ];

  this.businessKey = null;

  this.fields = [];

  this.scripts = [];

  this.options = options;

  // init event support
  Events.attach(this);

  this.initialize(done);
}

/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.initializeHandler = function(FieldHandler) {
  var self = this;
  var selector = FieldHandler.selector;

  $(selector, self.formElement).each(function() {
    self.fields.push(new FieldHandler(this, self.variableManager));
  });
};



/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.initialize = function(done) {
  done = done || function(err) { if(err) throw err; };
  var self = this;

  // check whether form needs to be loaded first
  if(this.formUrl) {

    this.client.http.load(this.formUrl, {
      accept: '*/*',
      done: function(err, result) {
        if(err) {
          return done(err);
        }

        try {
          self.renderForm(result);
          self.initializeForm(done);

        } catch (error) {
          done(error);
        }
      },
      data: extend({ noCache: Date.now() }, this.options.urlParams || {})
    });
  } else {

    try  {
      this.initializeForm(done);

    } catch (error) {
      done(error);
    }
  }
};



/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.renderForm = function(formHtmlSource) {

  // apppend the form html to the container element,
  // we also wrap the formHtmlSource to limit the risks of breaking
  // the structure of the document
  $(this.containerElement)
    .html('')
    .append('<div class="injected-form-wrapper">'+formHtmlSource+'</div>');

  // extract and validate form element
  var formElement = this.formElement = $('form', this.containerElement);
  if(formElement.length !== 1) {
    throw new Error('Form must provide exaclty one element <form ..>');
  }
  if(!formElement.attr('name')) {
    formElement.attr('name', '$$camForm');
  }
};



/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.initializeForm = function(done) {
  var self = this;

  // handle form scripts
  this.initializeFormScripts();

  // initialize field handlers
  this.initializeFieldHandlers();

  // execute the scripts
  this.executeFormScripts();

  // fire form loaded
  this.fireEvent('form-loaded');

  this.fetchVariables(function(err, result) {
    if (err) {
      throw err;
    }

    // merge the variables
    self.mergeVariables(result);

    // retain original server values for dirty checking
    self.storeOriginalValues(result);

    // fire variables fetched
    self.fireEvent('variables-fetched');

    // restore variables from local storage
    self.restore();

    // fire variables-restored
    self.fireEvent('variables-restored');

    // apply the variables to the form fields
    self.applyVariables();

    // fire variables applied
    self.fireEvent('variables-applied');

    // invoke callback
    done(null, self);
  });
};

CamundaForm.prototype.initializeFieldHandlers = function() {
  for(var FieldHandler in this.formFieldHandlers) {
    this.initializeHandler(this.formFieldHandlers[FieldHandler]);
  }
};

/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.initializeFormScripts = function() {
  var formScriptElements = $( 'script['+constants.DIRECTIVE_CAM_SCRIPT+']', this.formElement);
  for(var i = 0; i<formScriptElements.length; i++) {
    this.scripts.push(formScriptElements[i].text);
  }
};

CamundaForm.prototype.executeFormScripts = function() {
  for(var i = 0; i<this.scripts.length; i++) {
    this.executeFormScript(this.scripts[i]);
  }
};

CamundaForm.prototype.executeFormScript = function(script) {
  /*eslint-disable */
  /* jshint unused: false */
  (function(camForm) {

    /* jshint evil: true */
    eval(script);
    /* jshint evil: false */

  })(this);
  /*eslint-enable */
};



/**
 * @memberof CamSDK.form.CamundaForm.prototype
 *
 * Store the state of the form to localStorage.
 *
 * You can prevent further execution by hooking
 * the `store` event and set `storePrevented` to
 * something truthy.
 */
CamundaForm.prototype.store = function(callback) {
  var formId = this.taskId || this.processDefinitionId || this.caseInstanceId;

  if (!formId) {
    if(typeof callback === 'function') {
      return callback(new Error('Cannot determine the storage ID'));
    } else {
      throw new Error('Cannot determine the storage ID');
    }
  }

  this.storePrevented = false;
  this.fireEvent('store');
  if(this.storePrevented) {
    return;
  }

  try {
    // get values from form fields
    this.retrieveVariables();

    // build the local storage object
    var store = {date: Date.now(), vars: {}};
    for(var name in this.variableManager.variables) {
      if(this.variableManager.variables[name].type !== 'Bytes') {
        store.vars[name] = this.variableManager.variables[name].value;
      }
    }

    // store it
    localStorage.setItem('camForm:'+ formId, JSON.stringify(store));
  }
  catch (error) {
    if(typeof callback === 'function') {
      return callback(error);
    } else {
      throw error;
    }
  }
  this.fireEvent('variables-stored');
  if(typeof callback === 'function') {
    callback();
  }
};



/**
 * @memberof CamSDK.form.CamundaForm.prototype
 * @return {Boolean} `true` if there is something who can be restored
 */
CamundaForm.prototype.isRestorable = function() {
  var formId = this.taskId || this.processDefinitionId || this.caseInstanceId;

  if (!formId) {
    throw new Error('Cannot determine the storage ID');
  }

  // verify the presence of an entry
  if (!localStorage.getItem('camForm:'+ formId)) {
    return false;
  }

  // unserialize
  var stored = localStorage.getItem('camForm:'+ formId);
  try  {
    stored = JSON.parse(stored);
  }
  catch (error) {
    return false;
  }

  // check the content
  if (!stored || !Object.keys(stored).length) {
    return false;
  }

  return true;
};


/**
 * @memberof CamSDK.form.CamundaForm.prototype
 *
 * Restore the state of the form from localStorage.
 *
 * You can prevent further execution by hooking
 * the `restore` event and set `restorePrevented` to
 * something truthy.
 */
CamundaForm.prototype.restore = function(callback) {
  var stored;
  var vars = this.variableManager.variables;
  var formId = this.taskId || this.processDefinitionId || this.caseDefinitionId;

  if (!formId) {
    if(typeof callback === 'function') {
      return callback(new Error('Cannot determine the storage ID'));
    } else {
      throw new Error('Cannot determine the storage ID');
    }
  }


  // no need to go further if there is nothing to restore
  if (!this.isRestorable()) {
    if(typeof callback === 'function') {
      return callback();
    }
    return;
  }

  try {
    // retrieve the values from localStoarge
    stored = localStorage.getItem('camForm:'+ formId);
    stored = JSON.parse(stored).vars;
  }
  catch (error) {
    if(typeof callback === 'function') {
      return callback(error);
    } else {
      throw error;
    }
  }

  // merge the stored values on the variableManager.variables
  for (var name in stored) {
    if (vars[name]) {
      vars[name].value = stored[name];
    }
    else {
      vars[name] = {
        name: name,
        value: stored[name]
      };
    }
  }

  if(typeof callback === 'function') {
    callback();
  }

};


/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.submit = function(callback) {
  var formId = this.taskId || this.processDefinitionId;

  // fire submit event (event handler may prevent submit from being performed)
  this.submitPrevented = false;
  this.fireEvent('submit');
  if (this.submitPrevented) {
    var err = new Error('camForm submission prevented');
    this.fireEvent('submit-failed', err);
    return callback && callback(err);
  }

  try {
    // get values from form fields
    this.retrieveVariables();
  } catch (error) {
    return callback && callback(error);
  }

  var self = this;
  this.transformFiles(function() {
    // submit the form variables
    self.submitVariables(function(err, result) {
      if(err) {
        self.fireEvent('submit-failed', err);
        return callback && callback(err);
      }

      // clear the local storage for this form
      localStorage.removeItem('camForm:'+ formId);

      self.fireEvent('submit-success');
      return callback && callback(null, result);
    });
  });

};

CamundaForm.prototype.transformFiles = function(callback) {
  var that = this;
  var counter = 1;

  var callCallback = function() {
    if(--counter === 0) {
      callback();
    }
  };

  var bytesToSize = function(bytes) {
    if(bytes === 0) return '0 Byte';
    var k = 1000;
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
  };

  for (var i in this.fields) {
    var element = this.fields[i].element[0];
    if(element.getAttribute('type') === 'file') {
      if(typeof FileReader === 'function' && element.files.length > 0) {
        if(element.files[0].size > (parseInt(element.getAttribute('cam-max-filesize'),10) || 5000000)) {
          throw new Error('Maximum file size of ' + bytesToSize(parseInt(element.getAttribute('cam-max-filesize'),10) || 5000000) + ' exceeded.');
        }
        var reader = new FileReader();
        /* jshint ignore:start */
        reader.onloadend = (function(i, element) {
          return function(e) {
            var binary = '';
            var bytes = new Uint8Array( e.target.result );
            var len = bytes.byteLength;
            for (var j = 0; j < len; j++) {
              binary += String.fromCharCode( bytes[ j ] );
            }
            var fileVar = that.variableManager.variables[that.fields[i].variableName];
            fileVar.value = btoa(binary);

            // set file metadata as value info
            if(fileVar.type.toLowerCase() === 'file') {
              fileVar.valueInfo = {
                filename: element.files[0].name,
                mimeType: element.files[0].type
              };
            }

            callCallback();
          };
        })(i, element);
        /* jshint ignore:end */
        reader.readAsArrayBuffer(element.files[0]);
        counter++;
      } else {
        that.variableManager.variables[that.fields[i].variableName].value = null;
      }
    }
  }

  callCallback();

};

/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.fetchVariables = function(done) {
  done = done || function() {};
  var names = this.variableManager.variableNames();
  if (names.length) {

    var data = {
      names: names,
      deserializeValues: false
    };

    // pass either the taskId, processDefinitionId or processDefinitionKey
    if (this.taskId) {
      data.id = this.taskId;
      this.client.resource('task').formVariables(data, done);
    }
    else {
      data.id = this.processDefinitionId;
      data.key = this.processDefinitionKey;
      this.client.resource('process-definition').formVariables(data, done);
    }
  }
  else {
    done();
  }
};



/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.submitVariables = function(done) {
  done = done || function() {};

  var varManager = this.variableManager;
  var vars = varManager.variables;

  var variableData = {};
  for(var v in vars) {
    // only submit dirty variables
    // LIMITATION: dirty checking is not performed for complex object variables
    if(varManager.isDirty(v)) {
      var val = vars[v].value;
      // if variable is JSON, serialize

      if(varManager.isJsonVariable(v)) {
        val = JSON.stringify(val);
      }

      // if variable is Date, add timezone info
      if(val && varManager.isDateVariable(v)) {
        val = moment(val).format('YYYY-MM-DDTHH:mm:ss.SSSZZ');
      }

      variableData[v] = {
        value: val,
        type: vars[v].type,
        valueInfo: vars[v].valueInfo
      };
    }
  }

  var data = { variables: variableData };

  // pass either the taskId, processDefinitionId or processDefinitionKey
  if (this.taskId) {
    data.id = this.taskId;
    this.client.resource('task').submitForm(data, done);
  }
  else {
    var businessKey = this.businessKey || this.formElement.find('input[type="text"][cam-business-key]').val();
    if (businessKey) {
      data.businessKey = businessKey;
    }
    data.id = this.processDefinitionId;
    data.key = this.processDefinitionKey;
    this.client.resource('process-definition').submitForm(data, done);
  }
};

/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.storeOriginalValues = function(variables) {
  for(var v in variables) {
    this.variableManager.setOriginalValue(v, variables[v].value);
  }
};

/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.mergeVariables = function(variables) {

  var vars = this.variableManager.variables;

  for (var v in variables) {
    if (vars[v]) {
      for (var p in variables[v]) {
        vars[v][p] = vars[v][p] || variables[v][p];
      }
    }
    else {
      vars[v] = variables[v];
    }
    // check whether the variable provides JSON payload. If true, deserialize
    if(this.variableManager.isJsonVariable(v)) {
      vars[v].value = JSON.parse(variables[v].value);
    }

    // generate content url for file and bytes variables
    var type = vars[v].type;
    if(!!this.taskBasePath && (type === 'Bytes' || type === 'File')) {
      vars[v].contentUrl = this.taskBasePath + '/variables/'+ vars[v].name + '/data';
    }

    this.variableManager.isVariablesFetched = true;
  }
};



/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.applyVariables = function() {

  for (var i in this.fields) {
    this.fields[i].applyValue();
  }

};



/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.retrieveVariables = function() {
  for (var i in this.fields) {
    this.fields[i].getValue();
  }
};

/**
 * @memberof CamSDK.form.CamundaForm.prototype
 */
CamundaForm.prototype.fireEvent = function(eventName, obj) {
  this.trigger(eventName, obj);
};

/**
 * @memberof CamSDK.form.CamundaForm
 */
CamundaForm.$ = $;

CamundaForm.VariableManager = VariableManager;
CamundaForm.fields = {};
CamundaForm.fields.InputFieldHandler = InputFieldHandler;
CamundaForm.fields.ChoicesFieldHandler = ChoicesFieldHandler;

/**
 * @memberof CamSDK.form.CamundaForm
 */
CamundaForm.cleanLocalStorage = function(timestamp) {
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if(key.indexOf('camForm:') === 0) {
      var item = JSON.parse(localStorage.getItem(key));
      if(item.date < timestamp) {
        localStorage.removeItem(key);
        i--;
      }
    }
  }
};


/**
 * @memberof CamSDK.form.CamundaForm
 * @borrows CamSDK.BaseClass.extend as extend
 * @name extend
 * @type {Function}
 */
CamundaForm.extend = BaseClass.extend;

module.exports = CamundaForm;

},{"./../base-class":31,"./../events":32,"./constants":34,"./controls/choices-field-handler":36,"./controls/file-download-handler":37,"./controls/input-field-handler":38,"./dom-lib":39,"./variable-manager":42,"moment":54}],34:[function(_dereq_,module,exports){
'use strict';

module.exports = {
  DIRECTIVE_CAM_FORM : 'cam-form',
  DIRECTIVE_CAM_VARIABLE_NAME : 'cam-variable-name',
  DIRECTIVE_CAM_VARIABLE_TYPE : 'cam-variable-type',
  DIRECTIVE_CAM_FILE_DOWNLOAD : 'cam-file-download',
  DIRECTIVE_CAM_CHOICES : 'cam-choices',
  DIRECTIVE_CAM_SCRIPT : 'cam-script'
};

},{}],35:[function(_dereq_,module,exports){
'use strict';

var BaseClass = _dereq_('../../base-class');
var $ = _dereq_('./../dom-lib');

function noop() {}

/**
 * An abstract class for the form field controls
 *
 * @class AbstractFormField
 * @abstract
 * @memberof CamSDK.form
 *
 */
function AbstractFormField(element, variableManager) {
  this.element = $( element );
  this.variableManager = variableManager;

  this.variableName = null;

  this.initialize();
}

/**
 * @memberof CamSDK.form.AbstractFormField
 * @abstract
 * @name selector
 * @type {String}
 */
AbstractFormField.selector = null;


/**
 * @memberof CamSDK.form.AbstractFormField
 * @borrows CamSDK.BaseClass.extend as extend
 * @name extend
 * @type {Function}
 */
AbstractFormField.extend = BaseClass.extend;


/**
 * @memberof CamSDK.form.AbstractFormField.prototype
 * @abstract
 * @method initialize
 */
AbstractFormField.prototype.initialize = noop;


/**
 * Applies the stored value to a field element.
 *
 * @memberof CamSDK.form.AbstractFormField.prototype
 * @abstract
 * @method applyValue
 *
 * @return {CamSDK.form.AbstractFormField} Chainable method
 */
AbstractFormField.prototype.applyValue = noop;


/**
 * @memberof CamSDK.form.AbstractFormField.prototype
 * @abstract
 * @method getValue
 */
AbstractFormField.prototype.getValue = noop;

module.exports = AbstractFormField;


},{"../../base-class":31,"./../dom-lib":39}],36:[function(_dereq_,module,exports){
'use strict';

var constants = _dereq_('./../constants'),
    AbstractFormField = _dereq_('./abstract-form-field'),
    $ = _dereq_('./../dom-lib');


/**
 * A field control handler for choices
 * @class
 * @memberof CamSDK.form
 * @augments {CamSDK.form.AbstractFormField}
 */
var ChoicesFieldHandler = AbstractFormField.extend(
/** @lends CamSDK.form.ChoicesFieldHandler.prototype */
  {
  /**
   * Prepares an instance
   */
    initialize: function() {
    // read variable definitions from markup
      var variableName = this.variableName = this.element.attr(constants.DIRECTIVE_CAM_VARIABLE_NAME);
      var variableType = this.variableType = this.element.attr(constants.DIRECTIVE_CAM_VARIABLE_TYPE);
      var choicesVariableName = this.choicesVariableName = this.element.attr(constants.DIRECTIVE_CAM_CHOICES);

    // crate variable
      this.variableManager.createVariable({
        name: variableName,
        type: variableType,
        value: this.element.val() || null
      });

    // fetch choices variable
      if(choicesVariableName) {
        this.variableManager.fetchVariable(choicesVariableName);
      }

    // remember the original value found in the element for later checks
      this.originalValue = this.element.val() || null;

      this.previousValue = this.originalValue;

    // remember variable name
      this.variableName = variableName;
    },

  /**
   * Applies the stored value to a field element.
   *
   * @return {CamSDK.form.ChoicesFieldHandler} Chainable method.
   */
    applyValue: function() {

      var selectedIndex = this.element[0].selectedIndex;
    // if cam-choices variable is defined, apply options
      if(this.choicesVariableName) {
        var choicesVariableValue = this.variableManager.variableValue(this.choicesVariableName);
        if(choicesVariableValue) {
        // array
          if (choicesVariableValue instanceof Array) {
            for(var i = 0; i < choicesVariableValue.length; i++) {
              var val = choicesVariableValue[i];
              if(!this.element.find('option[text="'+val+'"]').length) {
                this.element.append($('<option>', {
                  value: val,
                  text: val
                }));
              }
            }
        // object aka map
          } else {
            for (var p in choicesVariableValue) {
              if(!this.element.find('option[value="'+p+'"]').length) {
                this.element.append($('<option>', {
                  value: p,
                  text: choicesVariableValue[p]
                }));
              }
            }
          }
        }
      }

    // make sure selected index is retained
      this.element[0].selectedIndex = selectedIndex;

    // select option referenced in cam-variable-name (if any)
      this.previousValue = this.element.val() || '';
      var variableValue = this.variableManager.variableValue(this.variableName);
      if (variableValue !== this.previousValue) {
      // write value to html control
        this.element.val(variableValue);
        this.element.trigger('camFormVariableApplied', variableValue);
      }

      return this;
    },

  /**
   * Retrieves the value from a field element and stores it
   *
   * @return {*} when multiple choices are possible an array of values, otherwise a single value
   */
    getValue: function() {
    // read value from html control
      var value;
      var multiple = this.element.prop('multiple');

      if (multiple) {
        value = [];
        this.element.find('option:selected').each(function() {
          value.push($(this).val());
        });
      }
      else {
        value = this.element.find('option:selected').attr('value');//.val();
      }

    // write value to variable
      this.variableManager.variableValue(this.variableName, value);

      return value;
    }

  },
/** @lends CamSDK.form.ChoicesFieldHandler */
  {
    selector: 'select['+ constants.DIRECTIVE_CAM_VARIABLE_NAME +']'

  });

module.exports = ChoicesFieldHandler;


},{"./../constants":34,"./../dom-lib":39,"./abstract-form-field":35}],37:[function(_dereq_,module,exports){
'use strict';

var constants = _dereq_('./../constants'),
    AbstractFormField = _dereq_('./abstract-form-field');

/**
 * A field control handler for file downloads
 * @class
 * @memberof CamSDK.form
 * @augments {CamSDK.form.AbstractFormField}
 */
var InputFieldHandler = AbstractFormField.extend(
  {
  /**
   * Prepares an instance
   */
    initialize: function() {

      this.variableName = this.element.attr(constants.DIRECTIVE_CAM_FILE_DOWNLOAD);

    // fetch the variable
      this.variableManager.fetchVariable(this.variableName);
    },

    applyValue: function() {

      var variable = this.variableManager.variable(this.variableName);

    // set the download url of the link
      this.element.attr('href', variable.contentUrl);

    // sets the text content of the link to the filename it the textcontent is empty
      if(this.element.text().trim().length === 0) {
        this.element.text(variable.valueInfo.filename);
      }

      return this;
    }

  },

  {

    selector: 'a['+ constants.DIRECTIVE_CAM_FILE_DOWNLOAD +']'

  });

module.exports = InputFieldHandler;


},{"./../constants":34,"./abstract-form-field":35}],38:[function(_dereq_,module,exports){
'use strict';

var constants = _dereq_('./../constants'),
    AbstractFormField = _dereq_('./abstract-form-field');

var isBooleanCheckbox = function(element) {
  return element.attr('type') === 'checkbox' && element.attr(constants.DIRECTIVE_CAM_VARIABLE_TYPE) === 'Boolean';
};

/**
 * A field control handler for simple text / string values
 * @class
 * @memberof CamSDK.form
 * @augments {CamSDK.form.AbstractFormField}
 */
var InputFieldHandler = AbstractFormField.extend(
/** @lends CamSDK.form.InputFieldHandler.prototype */
  {
  /**
   * Prepares an instance
   */
    initialize: function() {
    // read variable definitions from markup
      var variableName = this.element.attr(constants.DIRECTIVE_CAM_VARIABLE_NAME);
      var variableType = this.element.attr(constants.DIRECTIVE_CAM_VARIABLE_TYPE);

    // crate variable
      this.variableManager.createVariable({
        name: variableName,
        type: variableType
      });

    // remember the original value found in the element for later checks
      this.originalValue = this.element.val();

      this.previousValue = this.originalValue;

    // remember variable name
      this.variableName = variableName;

      this.getValue();
    },

  /**
   * Applies the stored value to a field element.
   *
   * @return {CamSDK.form.InputFieldHandler} Chainable method
   */
    applyValue: function() {
      this.previousValue = this.getValueFromHtmlControl() || '';
      var variableValue = this.variableManager.variableValue(this.variableName);
      if (variableValue !== this.previousValue) {
      // write value to html control
        this.applyValueToHtmlControl(variableValue);
        this.element.trigger('camFormVariableApplied', variableValue);
      }

      return this;
    },

  /**
   * Retrieves the value from an <input>
   * element and stores it in the Variable Manager
   *
   * @return {*}
   */
    getValue: function() {
      var value = this.getValueFromHtmlControl();

    // write value to variable
      this.variableManager.variableValue(this.variableName, value);

      return value;
    },

    getValueFromHtmlControl: function() {
      if(isBooleanCheckbox(this.element)) {
        return this.element.prop('checked');
      } else {
        return this.element.val();
      }
    },

    applyValueToHtmlControl: function(variableValue) {
      if(isBooleanCheckbox(this.element)) {
        this.element.prop('checked', variableValue);
      } else if(this.element[0].type !== 'file') {
        this.element.val(variableValue);
      }

    }

  },
/** @lends CamSDK.form.InputFieldHandler */
  {

    selector: 'input['+ constants.DIRECTIVE_CAM_VARIABLE_NAME +']'+
           ',textarea['+ constants.DIRECTIVE_CAM_VARIABLE_NAME +']'

  });

module.exports = InputFieldHandler;


},{"./../constants":34,"./abstract-form-field":35}],39:[function(_dereq_,module,exports){
(function (global){
'use strict';

(function(factory) {
  /* global global: false */
  factory(typeof window !== 'undefined' ? window : global);
}(function(root) {
  root = root || {};
  module.exports = root.jQuery ||
                   (root.angular ? root.angular.element : false) ||
                   root.Zepto;
}));

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],40:[function(_dereq_,module,exports){


module.exports = _dereq_('./camunda-form');

},{"./camunda-form":33}],41:[function(_dereq_,module,exports){
'use strict';

var INTEGER_PATTERN = /^-?[\d]+$/;

var FLOAT_PATTERN = /^(0|(-?(((0|[1-9]\d*)\.\d+)|([1-9]\d*))))([eE][-+]?[0-9]+)?$/;

var BOOLEAN_PATTERN = /^(true|false)$/;

var DATE_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(|\.[0-9]{0,4})$/;

var xmlParser = _dereq_('fast-xml-parser');

var isValidXML = function(value) {
  return value ? xmlParser.validate(value) : false;
};

var isValidJSON = function(value) {
  try {
    JSON.parse(value);
    return true;
  } catch (e) {
    return false;
  }
};

var isType = function(value, type) {
  switch(type) {
  case 'Integer':
  case 'Long':
  case 'Short':
    return INTEGER_PATTERN.test(value);
  case 'Float':
  case 'Double':
    return FLOAT_PATTERN.test(value);
  case 'Boolean':
    return BOOLEAN_PATTERN.test(value);
  case 'Date':
    return DATE_PATTERN.test(dateToString(value));
  case 'Xml':
    return isValidXML(value);
  case 'Json':
    return isValidJSON(value);
  }
};

var convertToType = function(value, type) {

  if(typeof value === 'string') {
    value = value.trim();
  }

  if(type === 'String' || type === 'Bytes' || type === 'File') {
    return value;
  } else if (isType(value, type)) {
    switch(type) {
    case 'Integer':
    case 'Long':
    case 'Short':
      return parseInt(value, 10);
    case 'Float':
    case 'Double':
      return parseFloat(value);
    case 'Boolean':
      return 'true' === value;
    case 'Date':
      return dateToString(value);
    }
  } else {
    throw new Error('Value \''+value+'\' is not of type '+type);
  }
};

/**
 * This reformates the date into a ISO8601 conform string which will mirror the selected date in local format.
 * TODO: Remove this when it is fixed by angularjs
 *
 * @see https://app.camunda.com/jira/browse/CAM-4746
 *
 */
var pad = function(number) {
  return ( number < 10 ) ?  '0' + number : number;
};

var dateToString = function(date) {
  if( typeof date === 'object' && typeof date.getFullYear === 'function' ) {
    var year    = date.getFullYear(),
        month   = pad( date.getMonth() + 1 ),
        day     = pad( date.getDate() ),
        hour    = pad( date.getHours() ),
        min = pad( date.getMinutes() ),
        sec = pad( date.getSeconds() );

    return year + '-' + month + '-' + day + 'T' + hour + ':' + min + ':' + sec;

  } else {
    return date;

  }
};

module.exports = {
  convertToType : convertToType,
  isType : isType,
  dateToString : dateToString
};

},{"fast-xml-parser":51}],42:[function(_dereq_,module,exports){
'use strict';

var convertToType = _dereq_('./type-util').convertToType;

/**
 * @class
 * the variable manager is responsible for managing access to variables.
 *
 * Variable Datatype
 *
 * A variable has the following properties:
 *
 *   name: the name of the variable
 *
 *   type: the type of the variable. The type is a "backend type"
 *
 *
 */
function VariableManager() {

  /** @member object containing the form fields. Initially empty. */
  this.variables = { };

  /** @member boolean indicating whether the variables are fetched */
  this.isVariablesFetched = false;

}

VariableManager.prototype.fetchVariable = function(variable) {
  if(this.isVariablesFetched) {
    throw new Error('Illegal State: cannot call fetchVariable(), variables already fetched.');
  }
  this.createVariable({ name: variable });
};

VariableManager.prototype.createVariable = function(variable) {
  if(!this.variables[variable.name]) {
    this.variables[variable.name] = variable;
  } else {
    throw new Error('Cannot add variable with name '+variable.name+': already exists.');
  }
};

VariableManager.prototype.destroyVariable = function(variableName) {
  if(this.variables[variableName]) {
    delete this.variables[variableName];
  } else {
    throw new Error('Cannot remove variable with name '+variableName+': variable does not exist.');
  }
};

VariableManager.prototype.setOriginalValue = function(variableName, value) {
  if(this.variables[variableName]) {
    this.variables[variableName].originalValue = value;
  } else {
    throw new Error('Cannot set original value of variable with name '+variableName+': variable does not exist.');
  }

};

VariableManager.prototype.variable = function(variableName) {
  return this.variables[variableName];
};

VariableManager.prototype.variableValue = function(variableName, value) {

  var variable = this.variable(variableName);

  if(typeof value === 'undefined' || value === null) {
    value = null;

  } else if(value === '' && variable.type !== 'String') {
    // convert empty string to null for all types except String
    value = null;

  } else if(typeof value === 'string' && variable.type !== 'String') {
    // convert string value into model value
    value = convertToType(value, variable.type);

  }

  if(arguments.length === 2) {
    variable.value = value;
  }

  return variable.value;
};

VariableManager.prototype.isDirty = function(name) {
  var variable = this.variable(name);
  if(this.isJsonVariable(name)) {
    return variable.originalValue !== JSON.stringify(variable.value);
  } else {
    return variable.originalValue !== variable.value || variable.type === 'Object';
  }
};

VariableManager.prototype.isJsonVariable = function(name) {
  var variable = this.variable(name);
  var type = variable.type;

  var supportedTypes = [ 'Object', 'json', 'Json' ];
  var idx = supportedTypes.indexOf(type);

  if (idx === 0) {
    return variable.valueInfo.serializationDataFormat.indexOf('application/json') !== -1;
  }

  return idx !== -1;
};

VariableManager.prototype.isDateVariable = function(name) {
  var variable = this.variable(name);
  return variable.type === 'Date';
};

VariableManager.prototype.variableNames = function() {
  // since we support IE 8+ (http://kangax.github.io/compat-table/es5/)
  return Object.keys(this.variables);
};

module.exports = VariableManager;

},{"./type-util":41}],43:[function(_dereq_,module,exports){
/** @namespace CamSDK */

module.exports = {
  Client: _dereq_('./api-client'),
  Form:   _dereq_('./forms'),
  utils:  _dereq_('./utils')
};


},{"./api-client":4,"./forms":40,"./utils":44}],44:[function(_dereq_,module,exports){
'use strict';


/**
 * @exports CamSDK.utils
 */
var utils = module.exports = {'typeUtils' : _dereq_('./forms/type-util')};

utils.solveHALEmbedded = function(results) {

  function isId(str) {
    if (str.slice(-2) !== 'Id') { return false; }

    var prop = str.slice(0, -2);
    var embedded = results._embedded;
    return !!(embedded[prop] && !!embedded[prop].length);
  }

  function keys(obj) {
    var arr = Object.keys(obj);

    for (var a in arr) {
      if (arr[a][0] === '_' || !isId(arr[a])) {
        arr.splice(a, 1);
      }
    }

    return arr;
  }

  var _embeddedRessources = Object.keys(results._embedded || {});
  for (var r in _embeddedRessources) {
    var name = _embeddedRessources[r];

    for (var i in results._embedded[name]) {
      results._embedded[name][i]._embedded = results._embedded[name][i]._embedded || {};

      var properties = keys(results._embedded[name][i]);

      for (var p in properties) {
        var prop = properties[p];
        if (results._embedded[name][i][prop]) {
          var embedded = results._embedded[prop.slice(0, -2)];
          for (var e in embedded) {
            if (embedded[e].id === results._embedded[name][i][prop]) {
              results._embedded[name][i]._embedded[prop.slice(0, -2)] = [embedded[e]];
            }
          }
        }
      }
    }
  }

  return results;
};


// the 2 folowing functions were borrowed from async.js
// https://github.com/caolan/async/blob/master/lib/async.js

function _eachSeries(arr, iterator, callback) {
  callback = callback || function() {};
  if (!arr.length) {
    return callback();
  }
  var completed = 0;
  var iterate = function() {
    iterator(arr[completed], function(err) {
      if (err) {
        callback(err);
        callback = function() {};
      }
      else {
        completed += 1;
        if (completed >= arr.length) {
          callback();
        }
        else {
          iterate();
        }
      }
    });
  };
  iterate();
}

/**
 * Executes functions in serie
 *
 * @param  {(Object.<String, Function>|Array.<Function>)} tasks object or array of functions
 *                                                              taking a callback
 *
 * @param  {Function} callback                                  executed at the end, first argument
 *                                                              will be an error (if error occured),
 *                                                              the second depends on "tasks" type
 *
 * @example
 * CamSDK.utils.series({
 *   a: function(cb) { setTimeout(function() { cb(null, 1); }, 1); },
 *   b: function(cb) { setTimeout(function() { cb(new Error('Bang!')); }, 1); },
 *   c: function(cb) { setTimeout(function() { cb(null, 3); }, 1); }
 * }, function(err, result) {
 *   // err will be passed
 *   // result will be { a: 1, b: undefined }
 * });
 */
utils.series = function(tasks, callback) {
  callback = callback || function() {};

  var results = {};
  _eachSeries(Object.keys(tasks), function(k, callback) {
    tasks[k](function(err) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (args.length <= 1) {
        args = args[0];
      }
      results[k] = args;
      callback(err);
    });
  }, function(err) {
    callback(err, results);
  });
};

/**
 * Escapes url string
 *
 * @param {string} string
 * @returns {string}
 */
utils.escapeUrl = function(string) {
  return encodeURIComponent(string)
    .replace(/\//g, '%2F')
    .replace(/%2F/g, '%252F')
    .replace(/\*/g, '%2A')
    .replace(/%5C/g, '%255C');
};

},{"./forms/type-util":41}],45:[function(_dereq_,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = _dereq_('base64-js')
var ieee754 = _dereq_('ieee754')
var isArray = _dereq_('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":46,"ieee754":47,"is-array":48}],46:[function(_dereq_,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],47:[function(_dereq_,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],48:[function(_dereq_,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],49:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],50:[function(_dereq_,module,exports){
(function (global){
/*! https://mths.be/he v1.1.1 by @mathias | MIT license */
;(function(root) {

	// Detect free variables `exports`.
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`.
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code,
	// and use it as `root`.
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	// All astral symbols.
	var regexAstralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
	// All ASCII symbols (not just printable ASCII) except those listed in the
	// first column of the overrides table.
	// https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides
	var regexAsciiWhitelist = /[\x01-\x7F]/g;
	// All BMP symbols that are not ASCII newlines, printable ASCII symbols, or
	// code points listed in the first column of the overrides table on
	// https://html.spec.whatwg.org/multipage/syntax.html#table-charref-overrides.
	var regexBmpWhitelist = /[\x01-\t\x0B\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g;

	var regexEncodeNonAscii = /<\u20D2|=\u20E5|>\u20D2|\u205F\u200A|\u219D\u0338|\u2202\u0338|\u2220\u20D2|\u2229\uFE00|\u222A\uFE00|\u223C\u20D2|\u223D\u0331|\u223E\u0333|\u2242\u0338|\u224B\u0338|\u224D\u20D2|\u224E\u0338|\u224F\u0338|\u2250\u0338|\u2261\u20E5|\u2264\u20D2|\u2265\u20D2|\u2266\u0338|\u2267\u0338|\u2268\uFE00|\u2269\uFE00|\u226A\u0338|\u226A\u20D2|\u226B\u0338|\u226B\u20D2|\u227F\u0338|\u2282\u20D2|\u2283\u20D2|\u228A\uFE00|\u228B\uFE00|\u228F\u0338|\u2290\u0338|\u2293\uFE00|\u2294\uFE00|\u22B4\u20D2|\u22B5\u20D2|\u22D8\u0338|\u22D9\u0338|\u22DA\uFE00|\u22DB\uFE00|\u22F5\u0338|\u22F9\u0338|\u2933\u0338|\u29CF\u0338|\u29D0\u0338|\u2A6D\u0338|\u2A70\u0338|\u2A7D\u0338|\u2A7E\u0338|\u2AA1\u0338|\u2AA2\u0338|\u2AAC\uFE00|\u2AAD\uFE00|\u2AAF\u0338|\u2AB0\u0338|\u2AC5\u0338|\u2AC6\u0338|\u2ACB\uFE00|\u2ACC\uFE00|\u2AFD\u20E5|[\xA0-\u0113\u0116-\u0122\u0124-\u012B\u012E-\u014D\u0150-\u017E\u0192\u01B5\u01F5\u0237\u02C6\u02C7\u02D8-\u02DD\u0311\u0391-\u03A1\u03A3-\u03A9\u03B1-\u03C9\u03D1\u03D2\u03D5\u03D6\u03DC\u03DD\u03F0\u03F1\u03F5\u03F6\u0401-\u040C\u040E-\u044F\u0451-\u045C\u045E\u045F\u2002-\u2005\u2007-\u2010\u2013-\u2016\u2018-\u201A\u201C-\u201E\u2020-\u2022\u2025\u2026\u2030-\u2035\u2039\u203A\u203E\u2041\u2043\u2044\u204F\u2057\u205F-\u2063\u20AC\u20DB\u20DC\u2102\u2105\u210A-\u2113\u2115-\u211E\u2122\u2124\u2127-\u2129\u212C\u212D\u212F-\u2131\u2133-\u2138\u2145-\u2148\u2153-\u215E\u2190-\u219B\u219D-\u21A7\u21A9-\u21AE\u21B0-\u21B3\u21B5-\u21B7\u21BA-\u21DB\u21DD\u21E4\u21E5\u21F5\u21FD-\u2205\u2207-\u2209\u220B\u220C\u220F-\u2214\u2216-\u2218\u221A\u221D-\u2238\u223A-\u2257\u2259\u225A\u225C\u225F-\u2262\u2264-\u228B\u228D-\u229B\u229D-\u22A5\u22A7-\u22B0\u22B2-\u22BB\u22BD-\u22DB\u22DE-\u22E3\u22E6-\u22F7\u22F9-\u22FE\u2305\u2306\u2308-\u2310\u2312\u2313\u2315\u2316\u231C-\u231F\u2322\u2323\u232D\u232E\u2336\u233D\u233F\u237C\u23B0\u23B1\u23B4-\u23B6\u23DC-\u23DF\u23E2\u23E7\u2423\u24C8\u2500\u2502\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C\u2550-\u256C\u2580\u2584\u2588\u2591-\u2593\u25A1\u25AA\u25AB\u25AD\u25AE\u25B1\u25B3-\u25B5\u25B8\u25B9\u25BD-\u25BF\u25C2\u25C3\u25CA\u25CB\u25EC\u25EF\u25F8-\u25FC\u2605\u2606\u260E\u2640\u2642\u2660\u2663\u2665\u2666\u266A\u266D-\u266F\u2713\u2717\u2720\u2736\u2758\u2772\u2773\u27C8\u27C9\u27E6-\u27ED\u27F5-\u27FA\u27FC\u27FF\u2902-\u2905\u290C-\u2913\u2916\u2919-\u2920\u2923-\u292A\u2933\u2935-\u2939\u293C\u293D\u2945\u2948-\u294B\u294E-\u2976\u2978\u2979\u297B-\u297F\u2985\u2986\u298B-\u2996\u299A\u299C\u299D\u29A4-\u29B7\u29B9\u29BB\u29BC\u29BE-\u29C5\u29C9\u29CD-\u29D0\u29DC-\u29DE\u29E3-\u29E5\u29EB\u29F4\u29F6\u2A00-\u2A02\u2A04\u2A06\u2A0C\u2A0D\u2A10-\u2A17\u2A22-\u2A27\u2A29\u2A2A\u2A2D-\u2A31\u2A33-\u2A3C\u2A3F\u2A40\u2A42-\u2A4D\u2A50\u2A53-\u2A58\u2A5A-\u2A5D\u2A5F\u2A66\u2A6A\u2A6D-\u2A75\u2A77-\u2A9A\u2A9D-\u2AA2\u2AA4-\u2AB0\u2AB3-\u2AC8\u2ACB\u2ACC\u2ACF-\u2ADB\u2AE4\u2AE6-\u2AE9\u2AEB-\u2AF3\u2AFD\uFB00-\uFB04]|\uD835[\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDD04\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDD6B]/g;
	var encodeMap = {'\xAD':'shy','\u200C':'zwnj','\u200D':'zwj','\u200E':'lrm','\u2063':'ic','\u2062':'it','\u2061':'af','\u200F':'rlm','\u200B':'ZeroWidthSpace','\u2060':'NoBreak','\u0311':'DownBreve','\u20DB':'tdot','\u20DC':'DotDot','\t':'Tab','\n':'NewLine','\u2008':'puncsp','\u205F':'MediumSpace','\u2009':'thinsp','\u200A':'hairsp','\u2004':'emsp13','\u2002':'ensp','\u2005':'emsp14','\u2003':'emsp','\u2007':'numsp','\xA0':'nbsp','\u205F\u200A':'ThickSpace','\u203E':'oline','_':'lowbar','\u2010':'dash','\u2013':'ndash','\u2014':'mdash','\u2015':'horbar',',':'comma',';':'semi','\u204F':'bsemi',':':'colon','\u2A74':'Colone','!':'excl','\xA1':'iexcl','?':'quest','\xBF':'iquest','.':'period','\u2025':'nldr','\u2026':'mldr','\xB7':'middot','\'':'apos','\u2018':'lsquo','\u2019':'rsquo','\u201A':'sbquo','\u2039':'lsaquo','\u203A':'rsaquo','"':'quot','\u201C':'ldquo','\u201D':'rdquo','\u201E':'bdquo','\xAB':'laquo','\xBB':'raquo','(':'lpar',')':'rpar','[':'lsqb',']':'rsqb','{':'lcub','}':'rcub','\u2308':'lceil','\u2309':'rceil','\u230A':'lfloor','\u230B':'rfloor','\u2985':'lopar','\u2986':'ropar','\u298B':'lbrke','\u298C':'rbrke','\u298D':'lbrkslu','\u298E':'rbrksld','\u298F':'lbrksld','\u2990':'rbrkslu','\u2991':'langd','\u2992':'rangd','\u2993':'lparlt','\u2994':'rpargt','\u2995':'gtlPar','\u2996':'ltrPar','\u27E6':'lobrk','\u27E7':'robrk','\u27E8':'lang','\u27E9':'rang','\u27EA':'Lang','\u27EB':'Rang','\u27EC':'loang','\u27ED':'roang','\u2772':'lbbrk','\u2773':'rbbrk','\u2016':'Vert','\xA7':'sect','\xB6':'para','@':'commat','*':'ast','/':'sol','undefined':null,'&':'amp','#':'num','%':'percnt','\u2030':'permil','\u2031':'pertenk','\u2020':'dagger','\u2021':'Dagger','\u2022':'bull','\u2043':'hybull','\u2032':'prime','\u2033':'Prime','\u2034':'tprime','\u2057':'qprime','\u2035':'bprime','\u2041':'caret','`':'grave','\xB4':'acute','\u02DC':'tilde','^':'Hat','\xAF':'macr','\u02D8':'breve','\u02D9':'dot','\xA8':'die','\u02DA':'ring','\u02DD':'dblac','\xB8':'cedil','\u02DB':'ogon','\u02C6':'circ','\u02C7':'caron','\xB0':'deg','\xA9':'copy','\xAE':'reg','\u2117':'copysr','\u2118':'wp','\u211E':'rx','\u2127':'mho','\u2129':'iiota','\u2190':'larr','\u219A':'nlarr','\u2192':'rarr','\u219B':'nrarr','\u2191':'uarr','\u2193':'darr','\u2194':'harr','\u21AE':'nharr','\u2195':'varr','\u2196':'nwarr','\u2197':'nearr','\u2198':'searr','\u2199':'swarr','\u219D':'rarrw','\u219D\u0338':'nrarrw','\u219E':'Larr','\u219F':'Uarr','\u21A0':'Rarr','\u21A1':'Darr','\u21A2':'larrtl','\u21A3':'rarrtl','\u21A4':'mapstoleft','\u21A5':'mapstoup','\u21A6':'map','\u21A7':'mapstodown','\u21A9':'larrhk','\u21AA':'rarrhk','\u21AB':'larrlp','\u21AC':'rarrlp','\u21AD':'harrw','\u21B0':'lsh','\u21B1':'rsh','\u21B2':'ldsh','\u21B3':'rdsh','\u21B5':'crarr','\u21B6':'cularr','\u21B7':'curarr','\u21BA':'olarr','\u21BB':'orarr','\u21BC':'lharu','\u21BD':'lhard','\u21BE':'uharr','\u21BF':'uharl','\u21C0':'rharu','\u21C1':'rhard','\u21C2':'dharr','\u21C3':'dharl','\u21C4':'rlarr','\u21C5':'udarr','\u21C6':'lrarr','\u21C7':'llarr','\u21C8':'uuarr','\u21C9':'rrarr','\u21CA':'ddarr','\u21CB':'lrhar','\u21CC':'rlhar','\u21D0':'lArr','\u21CD':'nlArr','\u21D1':'uArr','\u21D2':'rArr','\u21CF':'nrArr','\u21D3':'dArr','\u21D4':'iff','\u21CE':'nhArr','\u21D5':'vArr','\u21D6':'nwArr','\u21D7':'neArr','\u21D8':'seArr','\u21D9':'swArr','\u21DA':'lAarr','\u21DB':'rAarr','\u21DD':'zigrarr','\u21E4':'larrb','\u21E5':'rarrb','\u21F5':'duarr','\u21FD':'loarr','\u21FE':'roarr','\u21FF':'hoarr','\u2200':'forall','\u2201':'comp','\u2202':'part','\u2202\u0338':'npart','\u2203':'exist','\u2204':'nexist','\u2205':'empty','\u2207':'Del','\u2208':'in','\u2209':'notin','\u220B':'ni','\u220C':'notni','\u03F6':'bepsi','\u220F':'prod','\u2210':'coprod','\u2211':'sum','+':'plus','\xB1':'pm','\xF7':'div','\xD7':'times','<':'lt','\u226E':'nlt','<\u20D2':'nvlt','=':'equals','\u2260':'ne','=\u20E5':'bne','\u2A75':'Equal','>':'gt','\u226F':'ngt','>\u20D2':'nvgt','\xAC':'not','|':'vert','\xA6':'brvbar','\u2212':'minus','\u2213':'mp','\u2214':'plusdo','\u2044':'frasl','\u2216':'setmn','\u2217':'lowast','\u2218':'compfn','\u221A':'Sqrt','\u221D':'prop','\u221E':'infin','\u221F':'angrt','\u2220':'ang','\u2220\u20D2':'nang','\u2221':'angmsd','\u2222':'angsph','\u2223':'mid','\u2224':'nmid','\u2225':'par','\u2226':'npar','\u2227':'and','\u2228':'or','\u2229':'cap','\u2229\uFE00':'caps','\u222A':'cup','\u222A\uFE00':'cups','\u222B':'int','\u222C':'Int','\u222D':'tint','\u2A0C':'qint','\u222E':'oint','\u222F':'Conint','\u2230':'Cconint','\u2231':'cwint','\u2232':'cwconint','\u2233':'awconint','\u2234':'there4','\u2235':'becaus','\u2236':'ratio','\u2237':'Colon','\u2238':'minusd','\u223A':'mDDot','\u223B':'homtht','\u223C':'sim','\u2241':'nsim','\u223C\u20D2':'nvsim','\u223D':'bsim','\u223D\u0331':'race','\u223E':'ac','\u223E\u0333':'acE','\u223F':'acd','\u2240':'wr','\u2242':'esim','\u2242\u0338':'nesim','\u2243':'sime','\u2244':'nsime','\u2245':'cong','\u2247':'ncong','\u2246':'simne','\u2248':'ap','\u2249':'nap','\u224A':'ape','\u224B':'apid','\u224B\u0338':'napid','\u224C':'bcong','\u224D':'CupCap','\u226D':'NotCupCap','\u224D\u20D2':'nvap','\u224E':'bump','\u224E\u0338':'nbump','\u224F':'bumpe','\u224F\u0338':'nbumpe','\u2250':'doteq','\u2250\u0338':'nedot','\u2251':'eDot','\u2252':'efDot','\u2253':'erDot','\u2254':'colone','\u2255':'ecolon','\u2256':'ecir','\u2257':'cire','\u2259':'wedgeq','\u225A':'veeeq','\u225C':'trie','\u225F':'equest','\u2261':'equiv','\u2262':'nequiv','\u2261\u20E5':'bnequiv','\u2264':'le','\u2270':'nle','\u2264\u20D2':'nvle','\u2265':'ge','\u2271':'nge','\u2265\u20D2':'nvge','\u2266':'lE','\u2266\u0338':'nlE','\u2267':'gE','\u2267\u0338':'ngE','\u2268\uFE00':'lvnE','\u2268':'lnE','\u2269':'gnE','\u2269\uFE00':'gvnE','\u226A':'ll','\u226A\u0338':'nLtv','\u226A\u20D2':'nLt','\u226B':'gg','\u226B\u0338':'nGtv','\u226B\u20D2':'nGt','\u226C':'twixt','\u2272':'lsim','\u2274':'nlsim','\u2273':'gsim','\u2275':'ngsim','\u2276':'lg','\u2278':'ntlg','\u2277':'gl','\u2279':'ntgl','\u227A':'pr','\u2280':'npr','\u227B':'sc','\u2281':'nsc','\u227C':'prcue','\u22E0':'nprcue','\u227D':'sccue','\u22E1':'nsccue','\u227E':'prsim','\u227F':'scsim','\u227F\u0338':'NotSucceedsTilde','\u2282':'sub','\u2284':'nsub','\u2282\u20D2':'vnsub','\u2283':'sup','\u2285':'nsup','\u2283\u20D2':'vnsup','\u2286':'sube','\u2288':'nsube','\u2287':'supe','\u2289':'nsupe','\u228A\uFE00':'vsubne','\u228A':'subne','\u228B\uFE00':'vsupne','\u228B':'supne','\u228D':'cupdot','\u228E':'uplus','\u228F':'sqsub','\u228F\u0338':'NotSquareSubset','\u2290':'sqsup','\u2290\u0338':'NotSquareSuperset','\u2291':'sqsube','\u22E2':'nsqsube','\u2292':'sqsupe','\u22E3':'nsqsupe','\u2293':'sqcap','\u2293\uFE00':'sqcaps','\u2294':'sqcup','\u2294\uFE00':'sqcups','\u2295':'oplus','\u2296':'ominus','\u2297':'otimes','\u2298':'osol','\u2299':'odot','\u229A':'ocir','\u229B':'oast','\u229D':'odash','\u229E':'plusb','\u229F':'minusb','\u22A0':'timesb','\u22A1':'sdotb','\u22A2':'vdash','\u22AC':'nvdash','\u22A3':'dashv','\u22A4':'top','\u22A5':'bot','\u22A7':'models','\u22A8':'vDash','\u22AD':'nvDash','\u22A9':'Vdash','\u22AE':'nVdash','\u22AA':'Vvdash','\u22AB':'VDash','\u22AF':'nVDash','\u22B0':'prurel','\u22B2':'vltri','\u22EA':'nltri','\u22B3':'vrtri','\u22EB':'nrtri','\u22B4':'ltrie','\u22EC':'nltrie','\u22B4\u20D2':'nvltrie','\u22B5':'rtrie','\u22ED':'nrtrie','\u22B5\u20D2':'nvrtrie','\u22B6':'origof','\u22B7':'imof','\u22B8':'mumap','\u22B9':'hercon','\u22BA':'intcal','\u22BB':'veebar','\u22BD':'barvee','\u22BE':'angrtvb','\u22BF':'lrtri','\u22C0':'Wedge','\u22C1':'Vee','\u22C2':'xcap','\u22C3':'xcup','\u22C4':'diam','\u22C5':'sdot','\u22C6':'Star','\u22C7':'divonx','\u22C8':'bowtie','\u22C9':'ltimes','\u22CA':'rtimes','\u22CB':'lthree','\u22CC':'rthree','\u22CD':'bsime','\u22CE':'cuvee','\u22CF':'cuwed','\u22D0':'Sub','\u22D1':'Sup','\u22D2':'Cap','\u22D3':'Cup','\u22D4':'fork','\u22D5':'epar','\u22D6':'ltdot','\u22D7':'gtdot','\u22D8':'Ll','\u22D8\u0338':'nLl','\u22D9':'Gg','\u22D9\u0338':'nGg','\u22DA\uFE00':'lesg','\u22DA':'leg','\u22DB':'gel','\u22DB\uFE00':'gesl','\u22DE':'cuepr','\u22DF':'cuesc','\u22E6':'lnsim','\u22E7':'gnsim','\u22E8':'prnsim','\u22E9':'scnsim','\u22EE':'vellip','\u22EF':'ctdot','\u22F0':'utdot','\u22F1':'dtdot','\u22F2':'disin','\u22F3':'isinsv','\u22F4':'isins','\u22F5':'isindot','\u22F5\u0338':'notindot','\u22F6':'notinvc','\u22F7':'notinvb','\u22F9':'isinE','\u22F9\u0338':'notinE','\u22FA':'nisd','\u22FB':'xnis','\u22FC':'nis','\u22FD':'notnivc','\u22FE':'notnivb','\u2305':'barwed','\u2306':'Barwed','\u230C':'drcrop','\u230D':'dlcrop','\u230E':'urcrop','\u230F':'ulcrop','\u2310':'bnot','\u2312':'profline','\u2313':'profsurf','\u2315':'telrec','\u2316':'target','\u231C':'ulcorn','\u231D':'urcorn','\u231E':'dlcorn','\u231F':'drcorn','\u2322':'frown','\u2323':'smile','\u232D':'cylcty','\u232E':'profalar','\u2336':'topbot','\u233D':'ovbar','\u233F':'solbar','\u237C':'angzarr','\u23B0':'lmoust','\u23B1':'rmoust','\u23B4':'tbrk','\u23B5':'bbrk','\u23B6':'bbrktbrk','\u23DC':'OverParenthesis','\u23DD':'UnderParenthesis','\u23DE':'OverBrace','\u23DF':'UnderBrace','\u23E2':'trpezium','\u23E7':'elinters','\u2423':'blank','\u2500':'boxh','\u2502':'boxv','\u250C':'boxdr','\u2510':'boxdl','\u2514':'boxur','\u2518':'boxul','\u251C':'boxvr','\u2524':'boxvl','\u252C':'boxhd','\u2534':'boxhu','\u253C':'boxvh','\u2550':'boxH','\u2551':'boxV','\u2552':'boxdR','\u2553':'boxDr','\u2554':'boxDR','\u2555':'boxdL','\u2556':'boxDl','\u2557':'boxDL','\u2558':'boxuR','\u2559':'boxUr','\u255A':'boxUR','\u255B':'boxuL','\u255C':'boxUl','\u255D':'boxUL','\u255E':'boxvR','\u255F':'boxVr','\u2560':'boxVR','\u2561':'boxvL','\u2562':'boxVl','\u2563':'boxVL','\u2564':'boxHd','\u2565':'boxhD','\u2566':'boxHD','\u2567':'boxHu','\u2568':'boxhU','\u2569':'boxHU','\u256A':'boxvH','\u256B':'boxVh','\u256C':'boxVH','\u2580':'uhblk','\u2584':'lhblk','\u2588':'block','\u2591':'blk14','\u2592':'blk12','\u2593':'blk34','\u25A1':'squ','\u25AA':'squf','\u25AB':'EmptyVerySmallSquare','\u25AD':'rect','\u25AE':'marker','\u25B1':'fltns','\u25B3':'xutri','\u25B4':'utrif','\u25B5':'utri','\u25B8':'rtrif','\u25B9':'rtri','\u25BD':'xdtri','\u25BE':'dtrif','\u25BF':'dtri','\u25C2':'ltrif','\u25C3':'ltri','\u25CA':'loz','\u25CB':'cir','\u25EC':'tridot','\u25EF':'xcirc','\u25F8':'ultri','\u25F9':'urtri','\u25FA':'lltri','\u25FB':'EmptySmallSquare','\u25FC':'FilledSmallSquare','\u2605':'starf','\u2606':'star','\u260E':'phone','\u2640':'female','\u2642':'male','\u2660':'spades','\u2663':'clubs','\u2665':'hearts','\u2666':'diams','\u266A':'sung','\u2713':'check','\u2717':'cross','\u2720':'malt','\u2736':'sext','\u2758':'VerticalSeparator','\u27C8':'bsolhsub','\u27C9':'suphsol','\u27F5':'xlarr','\u27F6':'xrarr','\u27F7':'xharr','\u27F8':'xlArr','\u27F9':'xrArr','\u27FA':'xhArr','\u27FC':'xmap','\u27FF':'dzigrarr','\u2902':'nvlArr','\u2903':'nvrArr','\u2904':'nvHarr','\u2905':'Map','\u290C':'lbarr','\u290D':'rbarr','\u290E':'lBarr','\u290F':'rBarr','\u2910':'RBarr','\u2911':'DDotrahd','\u2912':'UpArrowBar','\u2913':'DownArrowBar','\u2916':'Rarrtl','\u2919':'latail','\u291A':'ratail','\u291B':'lAtail','\u291C':'rAtail','\u291D':'larrfs','\u291E':'rarrfs','\u291F':'larrbfs','\u2920':'rarrbfs','\u2923':'nwarhk','\u2924':'nearhk','\u2925':'searhk','\u2926':'swarhk','\u2927':'nwnear','\u2928':'toea','\u2929':'tosa','\u292A':'swnwar','\u2933':'rarrc','\u2933\u0338':'nrarrc','\u2935':'cudarrr','\u2936':'ldca','\u2937':'rdca','\u2938':'cudarrl','\u2939':'larrpl','\u293C':'curarrm','\u293D':'cularrp','\u2945':'rarrpl','\u2948':'harrcir','\u2949':'Uarrocir','\u294A':'lurdshar','\u294B':'ldrushar','\u294E':'LeftRightVector','\u294F':'RightUpDownVector','\u2950':'DownLeftRightVector','\u2951':'LeftUpDownVector','\u2952':'LeftVectorBar','\u2953':'RightVectorBar','\u2954':'RightUpVectorBar','\u2955':'RightDownVectorBar','\u2956':'DownLeftVectorBar','\u2957':'DownRightVectorBar','\u2958':'LeftUpVectorBar','\u2959':'LeftDownVectorBar','\u295A':'LeftTeeVector','\u295B':'RightTeeVector','\u295C':'RightUpTeeVector','\u295D':'RightDownTeeVector','\u295E':'DownLeftTeeVector','\u295F':'DownRightTeeVector','\u2960':'LeftUpTeeVector','\u2961':'LeftDownTeeVector','\u2962':'lHar','\u2963':'uHar','\u2964':'rHar','\u2965':'dHar','\u2966':'luruhar','\u2967':'ldrdhar','\u2968':'ruluhar','\u2969':'rdldhar','\u296A':'lharul','\u296B':'llhard','\u296C':'rharul','\u296D':'lrhard','\u296E':'udhar','\u296F':'duhar','\u2970':'RoundImplies','\u2971':'erarr','\u2972':'simrarr','\u2973':'larrsim','\u2974':'rarrsim','\u2975':'rarrap','\u2976':'ltlarr','\u2978':'gtrarr','\u2979':'subrarr','\u297B':'suplarr','\u297C':'lfisht','\u297D':'rfisht','\u297E':'ufisht','\u297F':'dfisht','\u299A':'vzigzag','\u299C':'vangrt','\u299D':'angrtvbd','\u29A4':'ange','\u29A5':'range','\u29A6':'dwangle','\u29A7':'uwangle','\u29A8':'angmsdaa','\u29A9':'angmsdab','\u29AA':'angmsdac','\u29AB':'angmsdad','\u29AC':'angmsdae','\u29AD':'angmsdaf','\u29AE':'angmsdag','\u29AF':'angmsdah','\u29B0':'bemptyv','\u29B1':'demptyv','\u29B2':'cemptyv','\u29B3':'raemptyv','\u29B4':'laemptyv','\u29B5':'ohbar','\u29B6':'omid','\u29B7':'opar','\u29B9':'operp','\u29BB':'olcross','\u29BC':'odsold','\u29BE':'olcir','\u29BF':'ofcir','\u29C0':'olt','\u29C1':'ogt','\u29C2':'cirscir','\u29C3':'cirE','\u29C4':'solb','\u29C5':'bsolb','\u29C9':'boxbox','\u29CD':'trisb','\u29CE':'rtriltri','\u29CF':'LeftTriangleBar','\u29CF\u0338':'NotLeftTriangleBar','\u29D0':'RightTriangleBar','\u29D0\u0338':'NotRightTriangleBar','\u29DC':'iinfin','\u29DD':'infintie','\u29DE':'nvinfin','\u29E3':'eparsl','\u29E4':'smeparsl','\u29E5':'eqvparsl','\u29EB':'lozf','\u29F4':'RuleDelayed','\u29F6':'dsol','\u2A00':'xodot','\u2A01':'xoplus','\u2A02':'xotime','\u2A04':'xuplus','\u2A06':'xsqcup','\u2A0D':'fpartint','\u2A10':'cirfnint','\u2A11':'awint','\u2A12':'rppolint','\u2A13':'scpolint','\u2A14':'npolint','\u2A15':'pointint','\u2A16':'quatint','\u2A17':'intlarhk','\u2A22':'pluscir','\u2A23':'plusacir','\u2A24':'simplus','\u2A25':'plusdu','\u2A26':'plussim','\u2A27':'plustwo','\u2A29':'mcomma','\u2A2A':'minusdu','\u2A2D':'loplus','\u2A2E':'roplus','\u2A2F':'Cross','\u2A30':'timesd','\u2A31':'timesbar','\u2A33':'smashp','\u2A34':'lotimes','\u2A35':'rotimes','\u2A36':'otimesas','\u2A37':'Otimes','\u2A38':'odiv','\u2A39':'triplus','\u2A3A':'triminus','\u2A3B':'tritime','\u2A3C':'iprod','\u2A3F':'amalg','\u2A40':'capdot','\u2A42':'ncup','\u2A43':'ncap','\u2A44':'capand','\u2A45':'cupor','\u2A46':'cupcap','\u2A47':'capcup','\u2A48':'cupbrcap','\u2A49':'capbrcup','\u2A4A':'cupcup','\u2A4B':'capcap','\u2A4C':'ccups','\u2A4D':'ccaps','\u2A50':'ccupssm','\u2A53':'And','\u2A54':'Or','\u2A55':'andand','\u2A56':'oror','\u2A57':'orslope','\u2A58':'andslope','\u2A5A':'andv','\u2A5B':'orv','\u2A5C':'andd','\u2A5D':'ord','\u2A5F':'wedbar','\u2A66':'sdote','\u2A6A':'simdot','\u2A6D':'congdot','\u2A6D\u0338':'ncongdot','\u2A6E':'easter','\u2A6F':'apacir','\u2A70':'apE','\u2A70\u0338':'napE','\u2A71':'eplus','\u2A72':'pluse','\u2A73':'Esim','\u2A77':'eDDot','\u2A78':'equivDD','\u2A79':'ltcir','\u2A7A':'gtcir','\u2A7B':'ltquest','\u2A7C':'gtquest','\u2A7D':'les','\u2A7D\u0338':'nles','\u2A7E':'ges','\u2A7E\u0338':'nges','\u2A7F':'lesdot','\u2A80':'gesdot','\u2A81':'lesdoto','\u2A82':'gesdoto','\u2A83':'lesdotor','\u2A84':'gesdotol','\u2A85':'lap','\u2A86':'gap','\u2A87':'lne','\u2A88':'gne','\u2A89':'lnap','\u2A8A':'gnap','\u2A8B':'lEg','\u2A8C':'gEl','\u2A8D':'lsime','\u2A8E':'gsime','\u2A8F':'lsimg','\u2A90':'gsiml','\u2A91':'lgE','\u2A92':'glE','\u2A93':'lesges','\u2A94':'gesles','\u2A95':'els','\u2A96':'egs','\u2A97':'elsdot','\u2A98':'egsdot','\u2A99':'el','\u2A9A':'eg','\u2A9D':'siml','\u2A9E':'simg','\u2A9F':'simlE','\u2AA0':'simgE','\u2AA1':'LessLess','\u2AA1\u0338':'NotNestedLessLess','\u2AA2':'GreaterGreater','\u2AA2\u0338':'NotNestedGreaterGreater','\u2AA4':'glj','\u2AA5':'gla','\u2AA6':'ltcc','\u2AA7':'gtcc','\u2AA8':'lescc','\u2AA9':'gescc','\u2AAA':'smt','\u2AAB':'lat','\u2AAC':'smte','\u2AAC\uFE00':'smtes','\u2AAD':'late','\u2AAD\uFE00':'lates','\u2AAE':'bumpE','\u2AAF':'pre','\u2AAF\u0338':'npre','\u2AB0':'sce','\u2AB0\u0338':'nsce','\u2AB3':'prE','\u2AB4':'scE','\u2AB5':'prnE','\u2AB6':'scnE','\u2AB7':'prap','\u2AB8':'scap','\u2AB9':'prnap','\u2ABA':'scnap','\u2ABB':'Pr','\u2ABC':'Sc','\u2ABD':'subdot','\u2ABE':'supdot','\u2ABF':'subplus','\u2AC0':'supplus','\u2AC1':'submult','\u2AC2':'supmult','\u2AC3':'subedot','\u2AC4':'supedot','\u2AC5':'subE','\u2AC5\u0338':'nsubE','\u2AC6':'supE','\u2AC6\u0338':'nsupE','\u2AC7':'subsim','\u2AC8':'supsim','\u2ACB\uFE00':'vsubnE','\u2ACB':'subnE','\u2ACC\uFE00':'vsupnE','\u2ACC':'supnE','\u2ACF':'csub','\u2AD0':'csup','\u2AD1':'csube','\u2AD2':'csupe','\u2AD3':'subsup','\u2AD4':'supsub','\u2AD5':'subsub','\u2AD6':'supsup','\u2AD7':'suphsub','\u2AD8':'supdsub','\u2AD9':'forkv','\u2ADA':'topfork','\u2ADB':'mlcp','\u2AE4':'Dashv','\u2AE6':'Vdashl','\u2AE7':'Barv','\u2AE8':'vBar','\u2AE9':'vBarv','\u2AEB':'Vbar','\u2AEC':'Not','\u2AED':'bNot','\u2AEE':'rnmid','\u2AEF':'cirmid','\u2AF0':'midcir','\u2AF1':'topcir','\u2AF2':'nhpar','\u2AF3':'parsim','\u2AFD':'parsl','\u2AFD\u20E5':'nparsl','\u266D':'flat','\u266E':'natur','\u266F':'sharp','\xA4':'curren','\xA2':'cent','$':'dollar','\xA3':'pound','\xA5':'yen','\u20AC':'euro','\xB9':'sup1','\xBD':'half','\u2153':'frac13','\xBC':'frac14','\u2155':'frac15','\u2159':'frac16','\u215B':'frac18','\xB2':'sup2','\u2154':'frac23','\u2156':'frac25','\xB3':'sup3','\xBE':'frac34','\u2157':'frac35','\u215C':'frac38','\u2158':'frac45','\u215A':'frac56','\u215D':'frac58','\u215E':'frac78','\uD835\uDCB6':'ascr','\uD835\uDD52':'aopf','\uD835\uDD1E':'afr','\uD835\uDD38':'Aopf','\uD835\uDD04':'Afr','\uD835\uDC9C':'Ascr','\xAA':'ordf','\xE1':'aacute','\xC1':'Aacute','\xE0':'agrave','\xC0':'Agrave','\u0103':'abreve','\u0102':'Abreve','\xE2':'acirc','\xC2':'Acirc','\xE5':'aring','\xC5':'angst','\xE4':'auml','\xC4':'Auml','\xE3':'atilde','\xC3':'Atilde','\u0105':'aogon','\u0104':'Aogon','\u0101':'amacr','\u0100':'Amacr','\xE6':'aelig','\xC6':'AElig','\uD835\uDCB7':'bscr','\uD835\uDD53':'bopf','\uD835\uDD1F':'bfr','\uD835\uDD39':'Bopf','\u212C':'Bscr','\uD835\uDD05':'Bfr','\uD835\uDD20':'cfr','\uD835\uDCB8':'cscr','\uD835\uDD54':'copf','\u212D':'Cfr','\uD835\uDC9E':'Cscr','\u2102':'Copf','\u0107':'cacute','\u0106':'Cacute','\u0109':'ccirc','\u0108':'Ccirc','\u010D':'ccaron','\u010C':'Ccaron','\u010B':'cdot','\u010A':'Cdot','\xE7':'ccedil','\xC7':'Ccedil','\u2105':'incare','\uD835\uDD21':'dfr','\u2146':'dd','\uD835\uDD55':'dopf','\uD835\uDCB9':'dscr','\uD835\uDC9F':'Dscr','\uD835\uDD07':'Dfr','\u2145':'DD','\uD835\uDD3B':'Dopf','\u010F':'dcaron','\u010E':'Dcaron','\u0111':'dstrok','\u0110':'Dstrok','\xF0':'eth','\xD0':'ETH','\u2147':'ee','\u212F':'escr','\uD835\uDD22':'efr','\uD835\uDD56':'eopf','\u2130':'Escr','\uD835\uDD08':'Efr','\uD835\uDD3C':'Eopf','\xE9':'eacute','\xC9':'Eacute','\xE8':'egrave','\xC8':'Egrave','\xEA':'ecirc','\xCA':'Ecirc','\u011B':'ecaron','\u011A':'Ecaron','\xEB':'euml','\xCB':'Euml','\u0117':'edot','\u0116':'Edot','\u0119':'eogon','\u0118':'Eogon','\u0113':'emacr','\u0112':'Emacr','\uD835\uDD23':'ffr','\uD835\uDD57':'fopf','\uD835\uDCBB':'fscr','\uD835\uDD09':'Ffr','\uD835\uDD3D':'Fopf','\u2131':'Fscr','\uFB00':'fflig','\uFB03':'ffilig','\uFB04':'ffllig','\uFB01':'filig','fj':'fjlig','\uFB02':'fllig','\u0192':'fnof','\u210A':'gscr','\uD835\uDD58':'gopf','\uD835\uDD24':'gfr','\uD835\uDCA2':'Gscr','\uD835\uDD3E':'Gopf','\uD835\uDD0A':'Gfr','\u01F5':'gacute','\u011F':'gbreve','\u011E':'Gbreve','\u011D':'gcirc','\u011C':'Gcirc','\u0121':'gdot','\u0120':'Gdot','\u0122':'Gcedil','\uD835\uDD25':'hfr','\u210E':'planckh','\uD835\uDCBD':'hscr','\uD835\uDD59':'hopf','\u210B':'Hscr','\u210C':'Hfr','\u210D':'Hopf','\u0125':'hcirc','\u0124':'Hcirc','\u210F':'hbar','\u0127':'hstrok','\u0126':'Hstrok','\uD835\uDD5A':'iopf','\uD835\uDD26':'ifr','\uD835\uDCBE':'iscr','\u2148':'ii','\uD835\uDD40':'Iopf','\u2110':'Iscr','\u2111':'Im','\xED':'iacute','\xCD':'Iacute','\xEC':'igrave','\xCC':'Igrave','\xEE':'icirc','\xCE':'Icirc','\xEF':'iuml','\xCF':'Iuml','\u0129':'itilde','\u0128':'Itilde','\u0130':'Idot','\u012F':'iogon','\u012E':'Iogon','\u012B':'imacr','\u012A':'Imacr','\u0133':'ijlig','\u0132':'IJlig','\u0131':'imath','\uD835\uDCBF':'jscr','\uD835\uDD5B':'jopf','\uD835\uDD27':'jfr','\uD835\uDCA5':'Jscr','\uD835\uDD0D':'Jfr','\uD835\uDD41':'Jopf','\u0135':'jcirc','\u0134':'Jcirc','\u0237':'jmath','\uD835\uDD5C':'kopf','\uD835\uDCC0':'kscr','\uD835\uDD28':'kfr','\uD835\uDCA6':'Kscr','\uD835\uDD42':'Kopf','\uD835\uDD0E':'Kfr','\u0137':'kcedil','\u0136':'Kcedil','\uD835\uDD29':'lfr','\uD835\uDCC1':'lscr','\u2113':'ell','\uD835\uDD5D':'lopf','\u2112':'Lscr','\uD835\uDD0F':'Lfr','\uD835\uDD43':'Lopf','\u013A':'lacute','\u0139':'Lacute','\u013E':'lcaron','\u013D':'Lcaron','\u013C':'lcedil','\u013B':'Lcedil','\u0142':'lstrok','\u0141':'Lstrok','\u0140':'lmidot','\u013F':'Lmidot','\uD835\uDD2A':'mfr','\uD835\uDD5E':'mopf','\uD835\uDCC2':'mscr','\uD835\uDD10':'Mfr','\uD835\uDD44':'Mopf','\u2133':'Mscr','\uD835\uDD2B':'nfr','\uD835\uDD5F':'nopf','\uD835\uDCC3':'nscr','\u2115':'Nopf','\uD835\uDCA9':'Nscr','\uD835\uDD11':'Nfr','\u0144':'nacute','\u0143':'Nacute','\u0148':'ncaron','\u0147':'Ncaron','\xF1':'ntilde','\xD1':'Ntilde','\u0146':'ncedil','\u0145':'Ncedil','\u2116':'numero','\u014B':'eng','\u014A':'ENG','\uD835\uDD60':'oopf','\uD835\uDD2C':'ofr','\u2134':'oscr','\uD835\uDCAA':'Oscr','\uD835\uDD12':'Ofr','\uD835\uDD46':'Oopf','\xBA':'ordm','\xF3':'oacute','\xD3':'Oacute','\xF2':'ograve','\xD2':'Ograve','\xF4':'ocirc','\xD4':'Ocirc','\xF6':'ouml','\xD6':'Ouml','\u0151':'odblac','\u0150':'Odblac','\xF5':'otilde','\xD5':'Otilde','\xF8':'oslash','\xD8':'Oslash','\u014D':'omacr','\u014C':'Omacr','\u0153':'oelig','\u0152':'OElig','\uD835\uDD2D':'pfr','\uD835\uDCC5':'pscr','\uD835\uDD61':'popf','\u2119':'Popf','\uD835\uDD13':'Pfr','\uD835\uDCAB':'Pscr','\uD835\uDD62':'qopf','\uD835\uDD2E':'qfr','\uD835\uDCC6':'qscr','\uD835\uDCAC':'Qscr','\uD835\uDD14':'Qfr','\u211A':'Qopf','\u0138':'kgreen','\uD835\uDD2F':'rfr','\uD835\uDD63':'ropf','\uD835\uDCC7':'rscr','\u211B':'Rscr','\u211C':'Re','\u211D':'Ropf','\u0155':'racute','\u0154':'Racute','\u0159':'rcaron','\u0158':'Rcaron','\u0157':'rcedil','\u0156':'Rcedil','\uD835\uDD64':'sopf','\uD835\uDCC8':'sscr','\uD835\uDD30':'sfr','\uD835\uDD4A':'Sopf','\uD835\uDD16':'Sfr','\uD835\uDCAE':'Sscr','\u24C8':'oS','\u015B':'sacute','\u015A':'Sacute','\u015D':'scirc','\u015C':'Scirc','\u0161':'scaron','\u0160':'Scaron','\u015F':'scedil','\u015E':'Scedil','\xDF':'szlig','\uD835\uDD31':'tfr','\uD835\uDCC9':'tscr','\uD835\uDD65':'topf','\uD835\uDCAF':'Tscr','\uD835\uDD17':'Tfr','\uD835\uDD4B':'Topf','\u0165':'tcaron','\u0164':'Tcaron','\u0163':'tcedil','\u0162':'Tcedil','\u2122':'trade','\u0167':'tstrok','\u0166':'Tstrok','\uD835\uDCCA':'uscr','\uD835\uDD66':'uopf','\uD835\uDD32':'ufr','\uD835\uDD4C':'Uopf','\uD835\uDD18':'Ufr','\uD835\uDCB0':'Uscr','\xFA':'uacute','\xDA':'Uacute','\xF9':'ugrave','\xD9':'Ugrave','\u016D':'ubreve','\u016C':'Ubreve','\xFB':'ucirc','\xDB':'Ucirc','\u016F':'uring','\u016E':'Uring','\xFC':'uuml','\xDC':'Uuml','\u0171':'udblac','\u0170':'Udblac','\u0169':'utilde','\u0168':'Utilde','\u0173':'uogon','\u0172':'Uogon','\u016B':'umacr','\u016A':'Umacr','\uD835\uDD33':'vfr','\uD835\uDD67':'vopf','\uD835\uDCCB':'vscr','\uD835\uDD19':'Vfr','\uD835\uDD4D':'Vopf','\uD835\uDCB1':'Vscr','\uD835\uDD68':'wopf','\uD835\uDCCC':'wscr','\uD835\uDD34':'wfr','\uD835\uDCB2':'Wscr','\uD835\uDD4E':'Wopf','\uD835\uDD1A':'Wfr','\u0175':'wcirc','\u0174':'Wcirc','\uD835\uDD35':'xfr','\uD835\uDCCD':'xscr','\uD835\uDD69':'xopf','\uD835\uDD4F':'Xopf','\uD835\uDD1B':'Xfr','\uD835\uDCB3':'Xscr','\uD835\uDD36':'yfr','\uD835\uDCCE':'yscr','\uD835\uDD6A':'yopf','\uD835\uDCB4':'Yscr','\uD835\uDD1C':'Yfr','\uD835\uDD50':'Yopf','\xFD':'yacute','\xDD':'Yacute','\u0177':'ycirc','\u0176':'Ycirc','\xFF':'yuml','\u0178':'Yuml','\uD835\uDCCF':'zscr','\uD835\uDD37':'zfr','\uD835\uDD6B':'zopf','\u2128':'Zfr','\u2124':'Zopf','\uD835\uDCB5':'Zscr','\u017A':'zacute','\u0179':'Zacute','\u017E':'zcaron','\u017D':'Zcaron','\u017C':'zdot','\u017B':'Zdot','\u01B5':'imped','\xFE':'thorn','\xDE':'THORN','\u0149':'napos','\u03B1':'alpha','\u0391':'Alpha','\u03B2':'beta','\u0392':'Beta','\u03B3':'gamma','\u0393':'Gamma','\u03B4':'delta','\u0394':'Delta','\u03B5':'epsi','\u03F5':'epsiv','\u0395':'Epsilon','\u03DD':'gammad','\u03DC':'Gammad','\u03B6':'zeta','\u0396':'Zeta','\u03B7':'eta','\u0397':'Eta','\u03B8':'theta','\u03D1':'thetav','\u0398':'Theta','\u03B9':'iota','\u0399':'Iota','\u03BA':'kappa','\u03F0':'kappav','\u039A':'Kappa','\u03BB':'lambda','\u039B':'Lambda','\u03BC':'mu','\xB5':'micro','\u039C':'Mu','\u03BD':'nu','\u039D':'Nu','\u03BE':'xi','\u039E':'Xi','\u03BF':'omicron','\u039F':'Omicron','\u03C0':'pi','\u03D6':'piv','\u03A0':'Pi','\u03C1':'rho','\u03F1':'rhov','\u03A1':'Rho','\u03C3':'sigma','\u03A3':'Sigma','\u03C2':'sigmaf','\u03C4':'tau','\u03A4':'Tau','\u03C5':'upsi','\u03A5':'Upsilon','\u03D2':'Upsi','\u03C6':'phi','\u03D5':'phiv','\u03A6':'Phi','\u03C7':'chi','\u03A7':'Chi','\u03C8':'psi','\u03A8':'Psi','\u03C9':'omega','\u03A9':'ohm','\u0430':'acy','\u0410':'Acy','\u0431':'bcy','\u0411':'Bcy','\u0432':'vcy','\u0412':'Vcy','\u0433':'gcy','\u0413':'Gcy','\u0453':'gjcy','\u0403':'GJcy','\u0434':'dcy','\u0414':'Dcy','\u0452':'djcy','\u0402':'DJcy','\u0435':'iecy','\u0415':'IEcy','\u0451':'iocy','\u0401':'IOcy','\u0454':'jukcy','\u0404':'Jukcy','\u0436':'zhcy','\u0416':'ZHcy','\u0437':'zcy','\u0417':'Zcy','\u0455':'dscy','\u0405':'DScy','\u0438':'icy','\u0418':'Icy','\u0456':'iukcy','\u0406':'Iukcy','\u0457':'yicy','\u0407':'YIcy','\u0439':'jcy','\u0419':'Jcy','\u0458':'jsercy','\u0408':'Jsercy','\u043A':'kcy','\u041A':'Kcy','\u045C':'kjcy','\u040C':'KJcy','\u043B':'lcy','\u041B':'Lcy','\u0459':'ljcy','\u0409':'LJcy','\u043C':'mcy','\u041C':'Mcy','\u043D':'ncy','\u041D':'Ncy','\u045A':'njcy','\u040A':'NJcy','\u043E':'ocy','\u041E':'Ocy','\u043F':'pcy','\u041F':'Pcy','\u0440':'rcy','\u0420':'Rcy','\u0441':'scy','\u0421':'Scy','\u0442':'tcy','\u0422':'Tcy','\u045B':'tshcy','\u040B':'TSHcy','\u0443':'ucy','\u0423':'Ucy','\u045E':'ubrcy','\u040E':'Ubrcy','\u0444':'fcy','\u0424':'Fcy','\u0445':'khcy','\u0425':'KHcy','\u0446':'tscy','\u0426':'TScy','\u0447':'chcy','\u0427':'CHcy','\u045F':'dzcy','\u040F':'DZcy','\u0448':'shcy','\u0428':'SHcy','\u0449':'shchcy','\u0429':'SHCHcy','\u044A':'hardcy','\u042A':'HARDcy','\u044B':'ycy','\u042B':'Ycy','\u044C':'softcy','\u042C':'SOFTcy','\u044D':'ecy','\u042D':'Ecy','\u044E':'yucy','\u042E':'YUcy','\u044F':'yacy','\u042F':'YAcy','\u2135':'aleph','\u2136':'beth','\u2137':'gimel','\u2138':'daleth'};

	var regexEscape = /["&'<>`]/g;
	var escapeMap = {
		'"': '&quot;',
		'&': '&amp;',
		'\'': '&#x27;',
		'<': '&lt;',
		// See https://mathiasbynens.be/notes/ambiguous-ampersands: in HTML, the
		// following is not strictly necessary unless it’s part of a tag or an
		// unquoted attribute value. We’re only escaping it to support those
		// situations, and for XML support.
		'>': '&gt;',
		// In Internet Explorer ≤ 8, the backtick character can be used
		// to break out of (un)quoted attribute values or HTML comments.
		// See http://html5sec.org/#102, http://html5sec.org/#108, and
		// http://html5sec.org/#133.
		'`': '&#x60;'
	};

	var regexInvalidEntity = /&#(?:[xX][^a-fA-F0-9]|[^0-9xX])/;
	var regexInvalidRawCodePoint = /[\0-\x08\x0B\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F\uDBBF\uDBFF][\uDFFE\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
	var regexDecode = /&#([0-9]+)(;?)|&#[xX]([a-fA-F0-9]+)(;?)|&([0-9a-zA-Z]+);|&(Aacute|Agrave|Atilde|Ccedil|Eacute|Egrave|Iacute|Igrave|Ntilde|Oacute|Ograve|Oslash|Otilde|Uacute|Ugrave|Yacute|aacute|agrave|atilde|brvbar|ccedil|curren|divide|eacute|egrave|frac12|frac14|frac34|iacute|igrave|iquest|middot|ntilde|oacute|ograve|oslash|otilde|plusmn|uacute|ugrave|yacute|AElig|Acirc|Aring|Ecirc|Icirc|Ocirc|THORN|Ucirc|acirc|acute|aelig|aring|cedil|ecirc|icirc|iexcl|laquo|micro|ocirc|pound|raquo|szlig|thorn|times|ucirc|Auml|COPY|Euml|Iuml|Ouml|QUOT|Uuml|auml|cent|copy|euml|iuml|macr|nbsp|ordf|ordm|ouml|para|quot|sect|sup1|sup2|sup3|uuml|yuml|AMP|ETH|REG|amp|deg|eth|not|reg|shy|uml|yen|GT|LT|gt|lt)([=a-zA-Z0-9])?/g;
	var decodeMap = {'aacute':'\xE1','Aacute':'\xC1','abreve':'\u0103','Abreve':'\u0102','ac':'\u223E','acd':'\u223F','acE':'\u223E\u0333','acirc':'\xE2','Acirc':'\xC2','acute':'\xB4','acy':'\u0430','Acy':'\u0410','aelig':'\xE6','AElig':'\xC6','af':'\u2061','afr':'\uD835\uDD1E','Afr':'\uD835\uDD04','agrave':'\xE0','Agrave':'\xC0','alefsym':'\u2135','aleph':'\u2135','alpha':'\u03B1','Alpha':'\u0391','amacr':'\u0101','Amacr':'\u0100','amalg':'\u2A3F','amp':'&','AMP':'&','and':'\u2227','And':'\u2A53','andand':'\u2A55','andd':'\u2A5C','andslope':'\u2A58','andv':'\u2A5A','ang':'\u2220','ange':'\u29A4','angle':'\u2220','angmsd':'\u2221','angmsdaa':'\u29A8','angmsdab':'\u29A9','angmsdac':'\u29AA','angmsdad':'\u29AB','angmsdae':'\u29AC','angmsdaf':'\u29AD','angmsdag':'\u29AE','angmsdah':'\u29AF','angrt':'\u221F','angrtvb':'\u22BE','angrtvbd':'\u299D','angsph':'\u2222','angst':'\xC5','angzarr':'\u237C','aogon':'\u0105','Aogon':'\u0104','aopf':'\uD835\uDD52','Aopf':'\uD835\uDD38','ap':'\u2248','apacir':'\u2A6F','ape':'\u224A','apE':'\u2A70','apid':'\u224B','apos':'\'','ApplyFunction':'\u2061','approx':'\u2248','approxeq':'\u224A','aring':'\xE5','Aring':'\xC5','ascr':'\uD835\uDCB6','Ascr':'\uD835\uDC9C','Assign':'\u2254','ast':'*','asymp':'\u2248','asympeq':'\u224D','atilde':'\xE3','Atilde':'\xC3','auml':'\xE4','Auml':'\xC4','awconint':'\u2233','awint':'\u2A11','backcong':'\u224C','backepsilon':'\u03F6','backprime':'\u2035','backsim':'\u223D','backsimeq':'\u22CD','Backslash':'\u2216','Barv':'\u2AE7','barvee':'\u22BD','barwed':'\u2305','Barwed':'\u2306','barwedge':'\u2305','bbrk':'\u23B5','bbrktbrk':'\u23B6','bcong':'\u224C','bcy':'\u0431','Bcy':'\u0411','bdquo':'\u201E','becaus':'\u2235','because':'\u2235','Because':'\u2235','bemptyv':'\u29B0','bepsi':'\u03F6','bernou':'\u212C','Bernoullis':'\u212C','beta':'\u03B2','Beta':'\u0392','beth':'\u2136','between':'\u226C','bfr':'\uD835\uDD1F','Bfr':'\uD835\uDD05','bigcap':'\u22C2','bigcirc':'\u25EF','bigcup':'\u22C3','bigodot':'\u2A00','bigoplus':'\u2A01','bigotimes':'\u2A02','bigsqcup':'\u2A06','bigstar':'\u2605','bigtriangledown':'\u25BD','bigtriangleup':'\u25B3','biguplus':'\u2A04','bigvee':'\u22C1','bigwedge':'\u22C0','bkarow':'\u290D','blacklozenge':'\u29EB','blacksquare':'\u25AA','blacktriangle':'\u25B4','blacktriangledown':'\u25BE','blacktriangleleft':'\u25C2','blacktriangleright':'\u25B8','blank':'\u2423','blk12':'\u2592','blk14':'\u2591','blk34':'\u2593','block':'\u2588','bne':'=\u20E5','bnequiv':'\u2261\u20E5','bnot':'\u2310','bNot':'\u2AED','bopf':'\uD835\uDD53','Bopf':'\uD835\uDD39','bot':'\u22A5','bottom':'\u22A5','bowtie':'\u22C8','boxbox':'\u29C9','boxdl':'\u2510','boxdL':'\u2555','boxDl':'\u2556','boxDL':'\u2557','boxdr':'\u250C','boxdR':'\u2552','boxDr':'\u2553','boxDR':'\u2554','boxh':'\u2500','boxH':'\u2550','boxhd':'\u252C','boxhD':'\u2565','boxHd':'\u2564','boxHD':'\u2566','boxhu':'\u2534','boxhU':'\u2568','boxHu':'\u2567','boxHU':'\u2569','boxminus':'\u229F','boxplus':'\u229E','boxtimes':'\u22A0','boxul':'\u2518','boxuL':'\u255B','boxUl':'\u255C','boxUL':'\u255D','boxur':'\u2514','boxuR':'\u2558','boxUr':'\u2559','boxUR':'\u255A','boxv':'\u2502','boxV':'\u2551','boxvh':'\u253C','boxvH':'\u256A','boxVh':'\u256B','boxVH':'\u256C','boxvl':'\u2524','boxvL':'\u2561','boxVl':'\u2562','boxVL':'\u2563','boxvr':'\u251C','boxvR':'\u255E','boxVr':'\u255F','boxVR':'\u2560','bprime':'\u2035','breve':'\u02D8','Breve':'\u02D8','brvbar':'\xA6','bscr':'\uD835\uDCB7','Bscr':'\u212C','bsemi':'\u204F','bsim':'\u223D','bsime':'\u22CD','bsol':'\\','bsolb':'\u29C5','bsolhsub':'\u27C8','bull':'\u2022','bullet':'\u2022','bump':'\u224E','bumpe':'\u224F','bumpE':'\u2AAE','bumpeq':'\u224F','Bumpeq':'\u224E','cacute':'\u0107','Cacute':'\u0106','cap':'\u2229','Cap':'\u22D2','capand':'\u2A44','capbrcup':'\u2A49','capcap':'\u2A4B','capcup':'\u2A47','capdot':'\u2A40','CapitalDifferentialD':'\u2145','caps':'\u2229\uFE00','caret':'\u2041','caron':'\u02C7','Cayleys':'\u212D','ccaps':'\u2A4D','ccaron':'\u010D','Ccaron':'\u010C','ccedil':'\xE7','Ccedil':'\xC7','ccirc':'\u0109','Ccirc':'\u0108','Cconint':'\u2230','ccups':'\u2A4C','ccupssm':'\u2A50','cdot':'\u010B','Cdot':'\u010A','cedil':'\xB8','Cedilla':'\xB8','cemptyv':'\u29B2','cent':'\xA2','centerdot':'\xB7','CenterDot':'\xB7','cfr':'\uD835\uDD20','Cfr':'\u212D','chcy':'\u0447','CHcy':'\u0427','check':'\u2713','checkmark':'\u2713','chi':'\u03C7','Chi':'\u03A7','cir':'\u25CB','circ':'\u02C6','circeq':'\u2257','circlearrowleft':'\u21BA','circlearrowright':'\u21BB','circledast':'\u229B','circledcirc':'\u229A','circleddash':'\u229D','CircleDot':'\u2299','circledR':'\xAE','circledS':'\u24C8','CircleMinus':'\u2296','CirclePlus':'\u2295','CircleTimes':'\u2297','cire':'\u2257','cirE':'\u29C3','cirfnint':'\u2A10','cirmid':'\u2AEF','cirscir':'\u29C2','ClockwiseContourIntegral':'\u2232','CloseCurlyDoubleQuote':'\u201D','CloseCurlyQuote':'\u2019','clubs':'\u2663','clubsuit':'\u2663','colon':':','Colon':'\u2237','colone':'\u2254','Colone':'\u2A74','coloneq':'\u2254','comma':',','commat':'@','comp':'\u2201','compfn':'\u2218','complement':'\u2201','complexes':'\u2102','cong':'\u2245','congdot':'\u2A6D','Congruent':'\u2261','conint':'\u222E','Conint':'\u222F','ContourIntegral':'\u222E','copf':'\uD835\uDD54','Copf':'\u2102','coprod':'\u2210','Coproduct':'\u2210','copy':'\xA9','COPY':'\xA9','copysr':'\u2117','CounterClockwiseContourIntegral':'\u2233','crarr':'\u21B5','cross':'\u2717','Cross':'\u2A2F','cscr':'\uD835\uDCB8','Cscr':'\uD835\uDC9E','csub':'\u2ACF','csube':'\u2AD1','csup':'\u2AD0','csupe':'\u2AD2','ctdot':'\u22EF','cudarrl':'\u2938','cudarrr':'\u2935','cuepr':'\u22DE','cuesc':'\u22DF','cularr':'\u21B6','cularrp':'\u293D','cup':'\u222A','Cup':'\u22D3','cupbrcap':'\u2A48','cupcap':'\u2A46','CupCap':'\u224D','cupcup':'\u2A4A','cupdot':'\u228D','cupor':'\u2A45','cups':'\u222A\uFE00','curarr':'\u21B7','curarrm':'\u293C','curlyeqprec':'\u22DE','curlyeqsucc':'\u22DF','curlyvee':'\u22CE','curlywedge':'\u22CF','curren':'\xA4','curvearrowleft':'\u21B6','curvearrowright':'\u21B7','cuvee':'\u22CE','cuwed':'\u22CF','cwconint':'\u2232','cwint':'\u2231','cylcty':'\u232D','dagger':'\u2020','Dagger':'\u2021','daleth':'\u2138','darr':'\u2193','dArr':'\u21D3','Darr':'\u21A1','dash':'\u2010','dashv':'\u22A3','Dashv':'\u2AE4','dbkarow':'\u290F','dblac':'\u02DD','dcaron':'\u010F','Dcaron':'\u010E','dcy':'\u0434','Dcy':'\u0414','dd':'\u2146','DD':'\u2145','ddagger':'\u2021','ddarr':'\u21CA','DDotrahd':'\u2911','ddotseq':'\u2A77','deg':'\xB0','Del':'\u2207','delta':'\u03B4','Delta':'\u0394','demptyv':'\u29B1','dfisht':'\u297F','dfr':'\uD835\uDD21','Dfr':'\uD835\uDD07','dHar':'\u2965','dharl':'\u21C3','dharr':'\u21C2','DiacriticalAcute':'\xB4','DiacriticalDot':'\u02D9','DiacriticalDoubleAcute':'\u02DD','DiacriticalGrave':'`','DiacriticalTilde':'\u02DC','diam':'\u22C4','diamond':'\u22C4','Diamond':'\u22C4','diamondsuit':'\u2666','diams':'\u2666','die':'\xA8','DifferentialD':'\u2146','digamma':'\u03DD','disin':'\u22F2','div':'\xF7','divide':'\xF7','divideontimes':'\u22C7','divonx':'\u22C7','djcy':'\u0452','DJcy':'\u0402','dlcorn':'\u231E','dlcrop':'\u230D','dollar':'$','dopf':'\uD835\uDD55','Dopf':'\uD835\uDD3B','dot':'\u02D9','Dot':'\xA8','DotDot':'\u20DC','doteq':'\u2250','doteqdot':'\u2251','DotEqual':'\u2250','dotminus':'\u2238','dotplus':'\u2214','dotsquare':'\u22A1','doublebarwedge':'\u2306','DoubleContourIntegral':'\u222F','DoubleDot':'\xA8','DoubleDownArrow':'\u21D3','DoubleLeftArrow':'\u21D0','DoubleLeftRightArrow':'\u21D4','DoubleLeftTee':'\u2AE4','DoubleLongLeftArrow':'\u27F8','DoubleLongLeftRightArrow':'\u27FA','DoubleLongRightArrow':'\u27F9','DoubleRightArrow':'\u21D2','DoubleRightTee':'\u22A8','DoubleUpArrow':'\u21D1','DoubleUpDownArrow':'\u21D5','DoubleVerticalBar':'\u2225','downarrow':'\u2193','Downarrow':'\u21D3','DownArrow':'\u2193','DownArrowBar':'\u2913','DownArrowUpArrow':'\u21F5','DownBreve':'\u0311','downdownarrows':'\u21CA','downharpoonleft':'\u21C3','downharpoonright':'\u21C2','DownLeftRightVector':'\u2950','DownLeftTeeVector':'\u295E','DownLeftVector':'\u21BD','DownLeftVectorBar':'\u2956','DownRightTeeVector':'\u295F','DownRightVector':'\u21C1','DownRightVectorBar':'\u2957','DownTee':'\u22A4','DownTeeArrow':'\u21A7','drbkarow':'\u2910','drcorn':'\u231F','drcrop':'\u230C','dscr':'\uD835\uDCB9','Dscr':'\uD835\uDC9F','dscy':'\u0455','DScy':'\u0405','dsol':'\u29F6','dstrok':'\u0111','Dstrok':'\u0110','dtdot':'\u22F1','dtri':'\u25BF','dtrif':'\u25BE','duarr':'\u21F5','duhar':'\u296F','dwangle':'\u29A6','dzcy':'\u045F','DZcy':'\u040F','dzigrarr':'\u27FF','eacute':'\xE9','Eacute':'\xC9','easter':'\u2A6E','ecaron':'\u011B','Ecaron':'\u011A','ecir':'\u2256','ecirc':'\xEA','Ecirc':'\xCA','ecolon':'\u2255','ecy':'\u044D','Ecy':'\u042D','eDDot':'\u2A77','edot':'\u0117','eDot':'\u2251','Edot':'\u0116','ee':'\u2147','efDot':'\u2252','efr':'\uD835\uDD22','Efr':'\uD835\uDD08','eg':'\u2A9A','egrave':'\xE8','Egrave':'\xC8','egs':'\u2A96','egsdot':'\u2A98','el':'\u2A99','Element':'\u2208','elinters':'\u23E7','ell':'\u2113','els':'\u2A95','elsdot':'\u2A97','emacr':'\u0113','Emacr':'\u0112','empty':'\u2205','emptyset':'\u2205','EmptySmallSquare':'\u25FB','emptyv':'\u2205','EmptyVerySmallSquare':'\u25AB','emsp':'\u2003','emsp13':'\u2004','emsp14':'\u2005','eng':'\u014B','ENG':'\u014A','ensp':'\u2002','eogon':'\u0119','Eogon':'\u0118','eopf':'\uD835\uDD56','Eopf':'\uD835\uDD3C','epar':'\u22D5','eparsl':'\u29E3','eplus':'\u2A71','epsi':'\u03B5','epsilon':'\u03B5','Epsilon':'\u0395','epsiv':'\u03F5','eqcirc':'\u2256','eqcolon':'\u2255','eqsim':'\u2242','eqslantgtr':'\u2A96','eqslantless':'\u2A95','Equal':'\u2A75','equals':'=','EqualTilde':'\u2242','equest':'\u225F','Equilibrium':'\u21CC','equiv':'\u2261','equivDD':'\u2A78','eqvparsl':'\u29E5','erarr':'\u2971','erDot':'\u2253','escr':'\u212F','Escr':'\u2130','esdot':'\u2250','esim':'\u2242','Esim':'\u2A73','eta':'\u03B7','Eta':'\u0397','eth':'\xF0','ETH':'\xD0','euml':'\xEB','Euml':'\xCB','euro':'\u20AC','excl':'!','exist':'\u2203','Exists':'\u2203','expectation':'\u2130','exponentiale':'\u2147','ExponentialE':'\u2147','fallingdotseq':'\u2252','fcy':'\u0444','Fcy':'\u0424','female':'\u2640','ffilig':'\uFB03','fflig':'\uFB00','ffllig':'\uFB04','ffr':'\uD835\uDD23','Ffr':'\uD835\uDD09','filig':'\uFB01','FilledSmallSquare':'\u25FC','FilledVerySmallSquare':'\u25AA','fjlig':'fj','flat':'\u266D','fllig':'\uFB02','fltns':'\u25B1','fnof':'\u0192','fopf':'\uD835\uDD57','Fopf':'\uD835\uDD3D','forall':'\u2200','ForAll':'\u2200','fork':'\u22D4','forkv':'\u2AD9','Fouriertrf':'\u2131','fpartint':'\u2A0D','frac12':'\xBD','frac13':'\u2153','frac14':'\xBC','frac15':'\u2155','frac16':'\u2159','frac18':'\u215B','frac23':'\u2154','frac25':'\u2156','frac34':'\xBE','frac35':'\u2157','frac38':'\u215C','frac45':'\u2158','frac56':'\u215A','frac58':'\u215D','frac78':'\u215E','frasl':'\u2044','frown':'\u2322','fscr':'\uD835\uDCBB','Fscr':'\u2131','gacute':'\u01F5','gamma':'\u03B3','Gamma':'\u0393','gammad':'\u03DD','Gammad':'\u03DC','gap':'\u2A86','gbreve':'\u011F','Gbreve':'\u011E','Gcedil':'\u0122','gcirc':'\u011D','Gcirc':'\u011C','gcy':'\u0433','Gcy':'\u0413','gdot':'\u0121','Gdot':'\u0120','ge':'\u2265','gE':'\u2267','gel':'\u22DB','gEl':'\u2A8C','geq':'\u2265','geqq':'\u2267','geqslant':'\u2A7E','ges':'\u2A7E','gescc':'\u2AA9','gesdot':'\u2A80','gesdoto':'\u2A82','gesdotol':'\u2A84','gesl':'\u22DB\uFE00','gesles':'\u2A94','gfr':'\uD835\uDD24','Gfr':'\uD835\uDD0A','gg':'\u226B','Gg':'\u22D9','ggg':'\u22D9','gimel':'\u2137','gjcy':'\u0453','GJcy':'\u0403','gl':'\u2277','gla':'\u2AA5','glE':'\u2A92','glj':'\u2AA4','gnap':'\u2A8A','gnapprox':'\u2A8A','gne':'\u2A88','gnE':'\u2269','gneq':'\u2A88','gneqq':'\u2269','gnsim':'\u22E7','gopf':'\uD835\uDD58','Gopf':'\uD835\uDD3E','grave':'`','GreaterEqual':'\u2265','GreaterEqualLess':'\u22DB','GreaterFullEqual':'\u2267','GreaterGreater':'\u2AA2','GreaterLess':'\u2277','GreaterSlantEqual':'\u2A7E','GreaterTilde':'\u2273','gscr':'\u210A','Gscr':'\uD835\uDCA2','gsim':'\u2273','gsime':'\u2A8E','gsiml':'\u2A90','gt':'>','Gt':'\u226B','GT':'>','gtcc':'\u2AA7','gtcir':'\u2A7A','gtdot':'\u22D7','gtlPar':'\u2995','gtquest':'\u2A7C','gtrapprox':'\u2A86','gtrarr':'\u2978','gtrdot':'\u22D7','gtreqless':'\u22DB','gtreqqless':'\u2A8C','gtrless':'\u2277','gtrsim':'\u2273','gvertneqq':'\u2269\uFE00','gvnE':'\u2269\uFE00','Hacek':'\u02C7','hairsp':'\u200A','half':'\xBD','hamilt':'\u210B','hardcy':'\u044A','HARDcy':'\u042A','harr':'\u2194','hArr':'\u21D4','harrcir':'\u2948','harrw':'\u21AD','Hat':'^','hbar':'\u210F','hcirc':'\u0125','Hcirc':'\u0124','hearts':'\u2665','heartsuit':'\u2665','hellip':'\u2026','hercon':'\u22B9','hfr':'\uD835\uDD25','Hfr':'\u210C','HilbertSpace':'\u210B','hksearow':'\u2925','hkswarow':'\u2926','hoarr':'\u21FF','homtht':'\u223B','hookleftarrow':'\u21A9','hookrightarrow':'\u21AA','hopf':'\uD835\uDD59','Hopf':'\u210D','horbar':'\u2015','HorizontalLine':'\u2500','hscr':'\uD835\uDCBD','Hscr':'\u210B','hslash':'\u210F','hstrok':'\u0127','Hstrok':'\u0126','HumpDownHump':'\u224E','HumpEqual':'\u224F','hybull':'\u2043','hyphen':'\u2010','iacute':'\xED','Iacute':'\xCD','ic':'\u2063','icirc':'\xEE','Icirc':'\xCE','icy':'\u0438','Icy':'\u0418','Idot':'\u0130','iecy':'\u0435','IEcy':'\u0415','iexcl':'\xA1','iff':'\u21D4','ifr':'\uD835\uDD26','Ifr':'\u2111','igrave':'\xEC','Igrave':'\xCC','ii':'\u2148','iiiint':'\u2A0C','iiint':'\u222D','iinfin':'\u29DC','iiota':'\u2129','ijlig':'\u0133','IJlig':'\u0132','Im':'\u2111','imacr':'\u012B','Imacr':'\u012A','image':'\u2111','ImaginaryI':'\u2148','imagline':'\u2110','imagpart':'\u2111','imath':'\u0131','imof':'\u22B7','imped':'\u01B5','Implies':'\u21D2','in':'\u2208','incare':'\u2105','infin':'\u221E','infintie':'\u29DD','inodot':'\u0131','int':'\u222B','Int':'\u222C','intcal':'\u22BA','integers':'\u2124','Integral':'\u222B','intercal':'\u22BA','Intersection':'\u22C2','intlarhk':'\u2A17','intprod':'\u2A3C','InvisibleComma':'\u2063','InvisibleTimes':'\u2062','iocy':'\u0451','IOcy':'\u0401','iogon':'\u012F','Iogon':'\u012E','iopf':'\uD835\uDD5A','Iopf':'\uD835\uDD40','iota':'\u03B9','Iota':'\u0399','iprod':'\u2A3C','iquest':'\xBF','iscr':'\uD835\uDCBE','Iscr':'\u2110','isin':'\u2208','isindot':'\u22F5','isinE':'\u22F9','isins':'\u22F4','isinsv':'\u22F3','isinv':'\u2208','it':'\u2062','itilde':'\u0129','Itilde':'\u0128','iukcy':'\u0456','Iukcy':'\u0406','iuml':'\xEF','Iuml':'\xCF','jcirc':'\u0135','Jcirc':'\u0134','jcy':'\u0439','Jcy':'\u0419','jfr':'\uD835\uDD27','Jfr':'\uD835\uDD0D','jmath':'\u0237','jopf':'\uD835\uDD5B','Jopf':'\uD835\uDD41','jscr':'\uD835\uDCBF','Jscr':'\uD835\uDCA5','jsercy':'\u0458','Jsercy':'\u0408','jukcy':'\u0454','Jukcy':'\u0404','kappa':'\u03BA','Kappa':'\u039A','kappav':'\u03F0','kcedil':'\u0137','Kcedil':'\u0136','kcy':'\u043A','Kcy':'\u041A','kfr':'\uD835\uDD28','Kfr':'\uD835\uDD0E','kgreen':'\u0138','khcy':'\u0445','KHcy':'\u0425','kjcy':'\u045C','KJcy':'\u040C','kopf':'\uD835\uDD5C','Kopf':'\uD835\uDD42','kscr':'\uD835\uDCC0','Kscr':'\uD835\uDCA6','lAarr':'\u21DA','lacute':'\u013A','Lacute':'\u0139','laemptyv':'\u29B4','lagran':'\u2112','lambda':'\u03BB','Lambda':'\u039B','lang':'\u27E8','Lang':'\u27EA','langd':'\u2991','langle':'\u27E8','lap':'\u2A85','Laplacetrf':'\u2112','laquo':'\xAB','larr':'\u2190','lArr':'\u21D0','Larr':'\u219E','larrb':'\u21E4','larrbfs':'\u291F','larrfs':'\u291D','larrhk':'\u21A9','larrlp':'\u21AB','larrpl':'\u2939','larrsim':'\u2973','larrtl':'\u21A2','lat':'\u2AAB','latail':'\u2919','lAtail':'\u291B','late':'\u2AAD','lates':'\u2AAD\uFE00','lbarr':'\u290C','lBarr':'\u290E','lbbrk':'\u2772','lbrace':'{','lbrack':'[','lbrke':'\u298B','lbrksld':'\u298F','lbrkslu':'\u298D','lcaron':'\u013E','Lcaron':'\u013D','lcedil':'\u013C','Lcedil':'\u013B','lceil':'\u2308','lcub':'{','lcy':'\u043B','Lcy':'\u041B','ldca':'\u2936','ldquo':'\u201C','ldquor':'\u201E','ldrdhar':'\u2967','ldrushar':'\u294B','ldsh':'\u21B2','le':'\u2264','lE':'\u2266','LeftAngleBracket':'\u27E8','leftarrow':'\u2190','Leftarrow':'\u21D0','LeftArrow':'\u2190','LeftArrowBar':'\u21E4','LeftArrowRightArrow':'\u21C6','leftarrowtail':'\u21A2','LeftCeiling':'\u2308','LeftDoubleBracket':'\u27E6','LeftDownTeeVector':'\u2961','LeftDownVector':'\u21C3','LeftDownVectorBar':'\u2959','LeftFloor':'\u230A','leftharpoondown':'\u21BD','leftharpoonup':'\u21BC','leftleftarrows':'\u21C7','leftrightarrow':'\u2194','Leftrightarrow':'\u21D4','LeftRightArrow':'\u2194','leftrightarrows':'\u21C6','leftrightharpoons':'\u21CB','leftrightsquigarrow':'\u21AD','LeftRightVector':'\u294E','LeftTee':'\u22A3','LeftTeeArrow':'\u21A4','LeftTeeVector':'\u295A','leftthreetimes':'\u22CB','LeftTriangle':'\u22B2','LeftTriangleBar':'\u29CF','LeftTriangleEqual':'\u22B4','LeftUpDownVector':'\u2951','LeftUpTeeVector':'\u2960','LeftUpVector':'\u21BF','LeftUpVectorBar':'\u2958','LeftVector':'\u21BC','LeftVectorBar':'\u2952','leg':'\u22DA','lEg':'\u2A8B','leq':'\u2264','leqq':'\u2266','leqslant':'\u2A7D','les':'\u2A7D','lescc':'\u2AA8','lesdot':'\u2A7F','lesdoto':'\u2A81','lesdotor':'\u2A83','lesg':'\u22DA\uFE00','lesges':'\u2A93','lessapprox':'\u2A85','lessdot':'\u22D6','lesseqgtr':'\u22DA','lesseqqgtr':'\u2A8B','LessEqualGreater':'\u22DA','LessFullEqual':'\u2266','LessGreater':'\u2276','lessgtr':'\u2276','LessLess':'\u2AA1','lesssim':'\u2272','LessSlantEqual':'\u2A7D','LessTilde':'\u2272','lfisht':'\u297C','lfloor':'\u230A','lfr':'\uD835\uDD29','Lfr':'\uD835\uDD0F','lg':'\u2276','lgE':'\u2A91','lHar':'\u2962','lhard':'\u21BD','lharu':'\u21BC','lharul':'\u296A','lhblk':'\u2584','ljcy':'\u0459','LJcy':'\u0409','ll':'\u226A','Ll':'\u22D8','llarr':'\u21C7','llcorner':'\u231E','Lleftarrow':'\u21DA','llhard':'\u296B','lltri':'\u25FA','lmidot':'\u0140','Lmidot':'\u013F','lmoust':'\u23B0','lmoustache':'\u23B0','lnap':'\u2A89','lnapprox':'\u2A89','lne':'\u2A87','lnE':'\u2268','lneq':'\u2A87','lneqq':'\u2268','lnsim':'\u22E6','loang':'\u27EC','loarr':'\u21FD','lobrk':'\u27E6','longleftarrow':'\u27F5','Longleftarrow':'\u27F8','LongLeftArrow':'\u27F5','longleftrightarrow':'\u27F7','Longleftrightarrow':'\u27FA','LongLeftRightArrow':'\u27F7','longmapsto':'\u27FC','longrightarrow':'\u27F6','Longrightarrow':'\u27F9','LongRightArrow':'\u27F6','looparrowleft':'\u21AB','looparrowright':'\u21AC','lopar':'\u2985','lopf':'\uD835\uDD5D','Lopf':'\uD835\uDD43','loplus':'\u2A2D','lotimes':'\u2A34','lowast':'\u2217','lowbar':'_','LowerLeftArrow':'\u2199','LowerRightArrow':'\u2198','loz':'\u25CA','lozenge':'\u25CA','lozf':'\u29EB','lpar':'(','lparlt':'\u2993','lrarr':'\u21C6','lrcorner':'\u231F','lrhar':'\u21CB','lrhard':'\u296D','lrm':'\u200E','lrtri':'\u22BF','lsaquo':'\u2039','lscr':'\uD835\uDCC1','Lscr':'\u2112','lsh':'\u21B0','Lsh':'\u21B0','lsim':'\u2272','lsime':'\u2A8D','lsimg':'\u2A8F','lsqb':'[','lsquo':'\u2018','lsquor':'\u201A','lstrok':'\u0142','Lstrok':'\u0141','lt':'<','Lt':'\u226A','LT':'<','ltcc':'\u2AA6','ltcir':'\u2A79','ltdot':'\u22D6','lthree':'\u22CB','ltimes':'\u22C9','ltlarr':'\u2976','ltquest':'\u2A7B','ltri':'\u25C3','ltrie':'\u22B4','ltrif':'\u25C2','ltrPar':'\u2996','lurdshar':'\u294A','luruhar':'\u2966','lvertneqq':'\u2268\uFE00','lvnE':'\u2268\uFE00','macr':'\xAF','male':'\u2642','malt':'\u2720','maltese':'\u2720','map':'\u21A6','Map':'\u2905','mapsto':'\u21A6','mapstodown':'\u21A7','mapstoleft':'\u21A4','mapstoup':'\u21A5','marker':'\u25AE','mcomma':'\u2A29','mcy':'\u043C','Mcy':'\u041C','mdash':'\u2014','mDDot':'\u223A','measuredangle':'\u2221','MediumSpace':'\u205F','Mellintrf':'\u2133','mfr':'\uD835\uDD2A','Mfr':'\uD835\uDD10','mho':'\u2127','micro':'\xB5','mid':'\u2223','midast':'*','midcir':'\u2AF0','middot':'\xB7','minus':'\u2212','minusb':'\u229F','minusd':'\u2238','minusdu':'\u2A2A','MinusPlus':'\u2213','mlcp':'\u2ADB','mldr':'\u2026','mnplus':'\u2213','models':'\u22A7','mopf':'\uD835\uDD5E','Mopf':'\uD835\uDD44','mp':'\u2213','mscr':'\uD835\uDCC2','Mscr':'\u2133','mstpos':'\u223E','mu':'\u03BC','Mu':'\u039C','multimap':'\u22B8','mumap':'\u22B8','nabla':'\u2207','nacute':'\u0144','Nacute':'\u0143','nang':'\u2220\u20D2','nap':'\u2249','napE':'\u2A70\u0338','napid':'\u224B\u0338','napos':'\u0149','napprox':'\u2249','natur':'\u266E','natural':'\u266E','naturals':'\u2115','nbsp':'\xA0','nbump':'\u224E\u0338','nbumpe':'\u224F\u0338','ncap':'\u2A43','ncaron':'\u0148','Ncaron':'\u0147','ncedil':'\u0146','Ncedil':'\u0145','ncong':'\u2247','ncongdot':'\u2A6D\u0338','ncup':'\u2A42','ncy':'\u043D','Ncy':'\u041D','ndash':'\u2013','ne':'\u2260','nearhk':'\u2924','nearr':'\u2197','neArr':'\u21D7','nearrow':'\u2197','nedot':'\u2250\u0338','NegativeMediumSpace':'\u200B','NegativeThickSpace':'\u200B','NegativeThinSpace':'\u200B','NegativeVeryThinSpace':'\u200B','nequiv':'\u2262','nesear':'\u2928','nesim':'\u2242\u0338','NestedGreaterGreater':'\u226B','NestedLessLess':'\u226A','NewLine':'\n','nexist':'\u2204','nexists':'\u2204','nfr':'\uD835\uDD2B','Nfr':'\uD835\uDD11','nge':'\u2271','ngE':'\u2267\u0338','ngeq':'\u2271','ngeqq':'\u2267\u0338','ngeqslant':'\u2A7E\u0338','nges':'\u2A7E\u0338','nGg':'\u22D9\u0338','ngsim':'\u2275','ngt':'\u226F','nGt':'\u226B\u20D2','ngtr':'\u226F','nGtv':'\u226B\u0338','nharr':'\u21AE','nhArr':'\u21CE','nhpar':'\u2AF2','ni':'\u220B','nis':'\u22FC','nisd':'\u22FA','niv':'\u220B','njcy':'\u045A','NJcy':'\u040A','nlarr':'\u219A','nlArr':'\u21CD','nldr':'\u2025','nle':'\u2270','nlE':'\u2266\u0338','nleftarrow':'\u219A','nLeftarrow':'\u21CD','nleftrightarrow':'\u21AE','nLeftrightarrow':'\u21CE','nleq':'\u2270','nleqq':'\u2266\u0338','nleqslant':'\u2A7D\u0338','nles':'\u2A7D\u0338','nless':'\u226E','nLl':'\u22D8\u0338','nlsim':'\u2274','nlt':'\u226E','nLt':'\u226A\u20D2','nltri':'\u22EA','nltrie':'\u22EC','nLtv':'\u226A\u0338','nmid':'\u2224','NoBreak':'\u2060','NonBreakingSpace':'\xA0','nopf':'\uD835\uDD5F','Nopf':'\u2115','not':'\xAC','Not':'\u2AEC','NotCongruent':'\u2262','NotCupCap':'\u226D','NotDoubleVerticalBar':'\u2226','NotElement':'\u2209','NotEqual':'\u2260','NotEqualTilde':'\u2242\u0338','NotExists':'\u2204','NotGreater':'\u226F','NotGreaterEqual':'\u2271','NotGreaterFullEqual':'\u2267\u0338','NotGreaterGreater':'\u226B\u0338','NotGreaterLess':'\u2279','NotGreaterSlantEqual':'\u2A7E\u0338','NotGreaterTilde':'\u2275','NotHumpDownHump':'\u224E\u0338','NotHumpEqual':'\u224F\u0338','notin':'\u2209','notindot':'\u22F5\u0338','notinE':'\u22F9\u0338','notinva':'\u2209','notinvb':'\u22F7','notinvc':'\u22F6','NotLeftTriangle':'\u22EA','NotLeftTriangleBar':'\u29CF\u0338','NotLeftTriangleEqual':'\u22EC','NotLess':'\u226E','NotLessEqual':'\u2270','NotLessGreater':'\u2278','NotLessLess':'\u226A\u0338','NotLessSlantEqual':'\u2A7D\u0338','NotLessTilde':'\u2274','NotNestedGreaterGreater':'\u2AA2\u0338','NotNestedLessLess':'\u2AA1\u0338','notni':'\u220C','notniva':'\u220C','notnivb':'\u22FE','notnivc':'\u22FD','NotPrecedes':'\u2280','NotPrecedesEqual':'\u2AAF\u0338','NotPrecedesSlantEqual':'\u22E0','NotReverseElement':'\u220C','NotRightTriangle':'\u22EB','NotRightTriangleBar':'\u29D0\u0338','NotRightTriangleEqual':'\u22ED','NotSquareSubset':'\u228F\u0338','NotSquareSubsetEqual':'\u22E2','NotSquareSuperset':'\u2290\u0338','NotSquareSupersetEqual':'\u22E3','NotSubset':'\u2282\u20D2','NotSubsetEqual':'\u2288','NotSucceeds':'\u2281','NotSucceedsEqual':'\u2AB0\u0338','NotSucceedsSlantEqual':'\u22E1','NotSucceedsTilde':'\u227F\u0338','NotSuperset':'\u2283\u20D2','NotSupersetEqual':'\u2289','NotTilde':'\u2241','NotTildeEqual':'\u2244','NotTildeFullEqual':'\u2247','NotTildeTilde':'\u2249','NotVerticalBar':'\u2224','npar':'\u2226','nparallel':'\u2226','nparsl':'\u2AFD\u20E5','npart':'\u2202\u0338','npolint':'\u2A14','npr':'\u2280','nprcue':'\u22E0','npre':'\u2AAF\u0338','nprec':'\u2280','npreceq':'\u2AAF\u0338','nrarr':'\u219B','nrArr':'\u21CF','nrarrc':'\u2933\u0338','nrarrw':'\u219D\u0338','nrightarrow':'\u219B','nRightarrow':'\u21CF','nrtri':'\u22EB','nrtrie':'\u22ED','nsc':'\u2281','nsccue':'\u22E1','nsce':'\u2AB0\u0338','nscr':'\uD835\uDCC3','Nscr':'\uD835\uDCA9','nshortmid':'\u2224','nshortparallel':'\u2226','nsim':'\u2241','nsime':'\u2244','nsimeq':'\u2244','nsmid':'\u2224','nspar':'\u2226','nsqsube':'\u22E2','nsqsupe':'\u22E3','nsub':'\u2284','nsube':'\u2288','nsubE':'\u2AC5\u0338','nsubset':'\u2282\u20D2','nsubseteq':'\u2288','nsubseteqq':'\u2AC5\u0338','nsucc':'\u2281','nsucceq':'\u2AB0\u0338','nsup':'\u2285','nsupe':'\u2289','nsupE':'\u2AC6\u0338','nsupset':'\u2283\u20D2','nsupseteq':'\u2289','nsupseteqq':'\u2AC6\u0338','ntgl':'\u2279','ntilde':'\xF1','Ntilde':'\xD1','ntlg':'\u2278','ntriangleleft':'\u22EA','ntrianglelefteq':'\u22EC','ntriangleright':'\u22EB','ntrianglerighteq':'\u22ED','nu':'\u03BD','Nu':'\u039D','num':'#','numero':'\u2116','numsp':'\u2007','nvap':'\u224D\u20D2','nvdash':'\u22AC','nvDash':'\u22AD','nVdash':'\u22AE','nVDash':'\u22AF','nvge':'\u2265\u20D2','nvgt':'>\u20D2','nvHarr':'\u2904','nvinfin':'\u29DE','nvlArr':'\u2902','nvle':'\u2264\u20D2','nvlt':'<\u20D2','nvltrie':'\u22B4\u20D2','nvrArr':'\u2903','nvrtrie':'\u22B5\u20D2','nvsim':'\u223C\u20D2','nwarhk':'\u2923','nwarr':'\u2196','nwArr':'\u21D6','nwarrow':'\u2196','nwnear':'\u2927','oacute':'\xF3','Oacute':'\xD3','oast':'\u229B','ocir':'\u229A','ocirc':'\xF4','Ocirc':'\xD4','ocy':'\u043E','Ocy':'\u041E','odash':'\u229D','odblac':'\u0151','Odblac':'\u0150','odiv':'\u2A38','odot':'\u2299','odsold':'\u29BC','oelig':'\u0153','OElig':'\u0152','ofcir':'\u29BF','ofr':'\uD835\uDD2C','Ofr':'\uD835\uDD12','ogon':'\u02DB','ograve':'\xF2','Ograve':'\xD2','ogt':'\u29C1','ohbar':'\u29B5','ohm':'\u03A9','oint':'\u222E','olarr':'\u21BA','olcir':'\u29BE','olcross':'\u29BB','oline':'\u203E','olt':'\u29C0','omacr':'\u014D','Omacr':'\u014C','omega':'\u03C9','Omega':'\u03A9','omicron':'\u03BF','Omicron':'\u039F','omid':'\u29B6','ominus':'\u2296','oopf':'\uD835\uDD60','Oopf':'\uD835\uDD46','opar':'\u29B7','OpenCurlyDoubleQuote':'\u201C','OpenCurlyQuote':'\u2018','operp':'\u29B9','oplus':'\u2295','or':'\u2228','Or':'\u2A54','orarr':'\u21BB','ord':'\u2A5D','order':'\u2134','orderof':'\u2134','ordf':'\xAA','ordm':'\xBA','origof':'\u22B6','oror':'\u2A56','orslope':'\u2A57','orv':'\u2A5B','oS':'\u24C8','oscr':'\u2134','Oscr':'\uD835\uDCAA','oslash':'\xF8','Oslash':'\xD8','osol':'\u2298','otilde':'\xF5','Otilde':'\xD5','otimes':'\u2297','Otimes':'\u2A37','otimesas':'\u2A36','ouml':'\xF6','Ouml':'\xD6','ovbar':'\u233D','OverBar':'\u203E','OverBrace':'\u23DE','OverBracket':'\u23B4','OverParenthesis':'\u23DC','par':'\u2225','para':'\xB6','parallel':'\u2225','parsim':'\u2AF3','parsl':'\u2AFD','part':'\u2202','PartialD':'\u2202','pcy':'\u043F','Pcy':'\u041F','percnt':'%','period':'.','permil':'\u2030','perp':'\u22A5','pertenk':'\u2031','pfr':'\uD835\uDD2D','Pfr':'\uD835\uDD13','phi':'\u03C6','Phi':'\u03A6','phiv':'\u03D5','phmmat':'\u2133','phone':'\u260E','pi':'\u03C0','Pi':'\u03A0','pitchfork':'\u22D4','piv':'\u03D6','planck':'\u210F','planckh':'\u210E','plankv':'\u210F','plus':'+','plusacir':'\u2A23','plusb':'\u229E','pluscir':'\u2A22','plusdo':'\u2214','plusdu':'\u2A25','pluse':'\u2A72','PlusMinus':'\xB1','plusmn':'\xB1','plussim':'\u2A26','plustwo':'\u2A27','pm':'\xB1','Poincareplane':'\u210C','pointint':'\u2A15','popf':'\uD835\uDD61','Popf':'\u2119','pound':'\xA3','pr':'\u227A','Pr':'\u2ABB','prap':'\u2AB7','prcue':'\u227C','pre':'\u2AAF','prE':'\u2AB3','prec':'\u227A','precapprox':'\u2AB7','preccurlyeq':'\u227C','Precedes':'\u227A','PrecedesEqual':'\u2AAF','PrecedesSlantEqual':'\u227C','PrecedesTilde':'\u227E','preceq':'\u2AAF','precnapprox':'\u2AB9','precneqq':'\u2AB5','precnsim':'\u22E8','precsim':'\u227E','prime':'\u2032','Prime':'\u2033','primes':'\u2119','prnap':'\u2AB9','prnE':'\u2AB5','prnsim':'\u22E8','prod':'\u220F','Product':'\u220F','profalar':'\u232E','profline':'\u2312','profsurf':'\u2313','prop':'\u221D','Proportion':'\u2237','Proportional':'\u221D','propto':'\u221D','prsim':'\u227E','prurel':'\u22B0','pscr':'\uD835\uDCC5','Pscr':'\uD835\uDCAB','psi':'\u03C8','Psi':'\u03A8','puncsp':'\u2008','qfr':'\uD835\uDD2E','Qfr':'\uD835\uDD14','qint':'\u2A0C','qopf':'\uD835\uDD62','Qopf':'\u211A','qprime':'\u2057','qscr':'\uD835\uDCC6','Qscr':'\uD835\uDCAC','quaternions':'\u210D','quatint':'\u2A16','quest':'?','questeq':'\u225F','quot':'"','QUOT':'"','rAarr':'\u21DB','race':'\u223D\u0331','racute':'\u0155','Racute':'\u0154','radic':'\u221A','raemptyv':'\u29B3','rang':'\u27E9','Rang':'\u27EB','rangd':'\u2992','range':'\u29A5','rangle':'\u27E9','raquo':'\xBB','rarr':'\u2192','rArr':'\u21D2','Rarr':'\u21A0','rarrap':'\u2975','rarrb':'\u21E5','rarrbfs':'\u2920','rarrc':'\u2933','rarrfs':'\u291E','rarrhk':'\u21AA','rarrlp':'\u21AC','rarrpl':'\u2945','rarrsim':'\u2974','rarrtl':'\u21A3','Rarrtl':'\u2916','rarrw':'\u219D','ratail':'\u291A','rAtail':'\u291C','ratio':'\u2236','rationals':'\u211A','rbarr':'\u290D','rBarr':'\u290F','RBarr':'\u2910','rbbrk':'\u2773','rbrace':'}','rbrack':']','rbrke':'\u298C','rbrksld':'\u298E','rbrkslu':'\u2990','rcaron':'\u0159','Rcaron':'\u0158','rcedil':'\u0157','Rcedil':'\u0156','rceil':'\u2309','rcub':'}','rcy':'\u0440','Rcy':'\u0420','rdca':'\u2937','rdldhar':'\u2969','rdquo':'\u201D','rdquor':'\u201D','rdsh':'\u21B3','Re':'\u211C','real':'\u211C','realine':'\u211B','realpart':'\u211C','reals':'\u211D','rect':'\u25AD','reg':'\xAE','REG':'\xAE','ReverseElement':'\u220B','ReverseEquilibrium':'\u21CB','ReverseUpEquilibrium':'\u296F','rfisht':'\u297D','rfloor':'\u230B','rfr':'\uD835\uDD2F','Rfr':'\u211C','rHar':'\u2964','rhard':'\u21C1','rharu':'\u21C0','rharul':'\u296C','rho':'\u03C1','Rho':'\u03A1','rhov':'\u03F1','RightAngleBracket':'\u27E9','rightarrow':'\u2192','Rightarrow':'\u21D2','RightArrow':'\u2192','RightArrowBar':'\u21E5','RightArrowLeftArrow':'\u21C4','rightarrowtail':'\u21A3','RightCeiling':'\u2309','RightDoubleBracket':'\u27E7','RightDownTeeVector':'\u295D','RightDownVector':'\u21C2','RightDownVectorBar':'\u2955','RightFloor':'\u230B','rightharpoondown':'\u21C1','rightharpoonup':'\u21C0','rightleftarrows':'\u21C4','rightleftharpoons':'\u21CC','rightrightarrows':'\u21C9','rightsquigarrow':'\u219D','RightTee':'\u22A2','RightTeeArrow':'\u21A6','RightTeeVector':'\u295B','rightthreetimes':'\u22CC','RightTriangle':'\u22B3','RightTriangleBar':'\u29D0','RightTriangleEqual':'\u22B5','RightUpDownVector':'\u294F','RightUpTeeVector':'\u295C','RightUpVector':'\u21BE','RightUpVectorBar':'\u2954','RightVector':'\u21C0','RightVectorBar':'\u2953','ring':'\u02DA','risingdotseq':'\u2253','rlarr':'\u21C4','rlhar':'\u21CC','rlm':'\u200F','rmoust':'\u23B1','rmoustache':'\u23B1','rnmid':'\u2AEE','roang':'\u27ED','roarr':'\u21FE','robrk':'\u27E7','ropar':'\u2986','ropf':'\uD835\uDD63','Ropf':'\u211D','roplus':'\u2A2E','rotimes':'\u2A35','RoundImplies':'\u2970','rpar':')','rpargt':'\u2994','rppolint':'\u2A12','rrarr':'\u21C9','Rrightarrow':'\u21DB','rsaquo':'\u203A','rscr':'\uD835\uDCC7','Rscr':'\u211B','rsh':'\u21B1','Rsh':'\u21B1','rsqb':']','rsquo':'\u2019','rsquor':'\u2019','rthree':'\u22CC','rtimes':'\u22CA','rtri':'\u25B9','rtrie':'\u22B5','rtrif':'\u25B8','rtriltri':'\u29CE','RuleDelayed':'\u29F4','ruluhar':'\u2968','rx':'\u211E','sacute':'\u015B','Sacute':'\u015A','sbquo':'\u201A','sc':'\u227B','Sc':'\u2ABC','scap':'\u2AB8','scaron':'\u0161','Scaron':'\u0160','sccue':'\u227D','sce':'\u2AB0','scE':'\u2AB4','scedil':'\u015F','Scedil':'\u015E','scirc':'\u015D','Scirc':'\u015C','scnap':'\u2ABA','scnE':'\u2AB6','scnsim':'\u22E9','scpolint':'\u2A13','scsim':'\u227F','scy':'\u0441','Scy':'\u0421','sdot':'\u22C5','sdotb':'\u22A1','sdote':'\u2A66','searhk':'\u2925','searr':'\u2198','seArr':'\u21D8','searrow':'\u2198','sect':'\xA7','semi':';','seswar':'\u2929','setminus':'\u2216','setmn':'\u2216','sext':'\u2736','sfr':'\uD835\uDD30','Sfr':'\uD835\uDD16','sfrown':'\u2322','sharp':'\u266F','shchcy':'\u0449','SHCHcy':'\u0429','shcy':'\u0448','SHcy':'\u0428','ShortDownArrow':'\u2193','ShortLeftArrow':'\u2190','shortmid':'\u2223','shortparallel':'\u2225','ShortRightArrow':'\u2192','ShortUpArrow':'\u2191','shy':'\xAD','sigma':'\u03C3','Sigma':'\u03A3','sigmaf':'\u03C2','sigmav':'\u03C2','sim':'\u223C','simdot':'\u2A6A','sime':'\u2243','simeq':'\u2243','simg':'\u2A9E','simgE':'\u2AA0','siml':'\u2A9D','simlE':'\u2A9F','simne':'\u2246','simplus':'\u2A24','simrarr':'\u2972','slarr':'\u2190','SmallCircle':'\u2218','smallsetminus':'\u2216','smashp':'\u2A33','smeparsl':'\u29E4','smid':'\u2223','smile':'\u2323','smt':'\u2AAA','smte':'\u2AAC','smtes':'\u2AAC\uFE00','softcy':'\u044C','SOFTcy':'\u042C','sol':'/','solb':'\u29C4','solbar':'\u233F','sopf':'\uD835\uDD64','Sopf':'\uD835\uDD4A','spades':'\u2660','spadesuit':'\u2660','spar':'\u2225','sqcap':'\u2293','sqcaps':'\u2293\uFE00','sqcup':'\u2294','sqcups':'\u2294\uFE00','Sqrt':'\u221A','sqsub':'\u228F','sqsube':'\u2291','sqsubset':'\u228F','sqsubseteq':'\u2291','sqsup':'\u2290','sqsupe':'\u2292','sqsupset':'\u2290','sqsupseteq':'\u2292','squ':'\u25A1','square':'\u25A1','Square':'\u25A1','SquareIntersection':'\u2293','SquareSubset':'\u228F','SquareSubsetEqual':'\u2291','SquareSuperset':'\u2290','SquareSupersetEqual':'\u2292','SquareUnion':'\u2294','squarf':'\u25AA','squf':'\u25AA','srarr':'\u2192','sscr':'\uD835\uDCC8','Sscr':'\uD835\uDCAE','ssetmn':'\u2216','ssmile':'\u2323','sstarf':'\u22C6','star':'\u2606','Star':'\u22C6','starf':'\u2605','straightepsilon':'\u03F5','straightphi':'\u03D5','strns':'\xAF','sub':'\u2282','Sub':'\u22D0','subdot':'\u2ABD','sube':'\u2286','subE':'\u2AC5','subedot':'\u2AC3','submult':'\u2AC1','subne':'\u228A','subnE':'\u2ACB','subplus':'\u2ABF','subrarr':'\u2979','subset':'\u2282','Subset':'\u22D0','subseteq':'\u2286','subseteqq':'\u2AC5','SubsetEqual':'\u2286','subsetneq':'\u228A','subsetneqq':'\u2ACB','subsim':'\u2AC7','subsub':'\u2AD5','subsup':'\u2AD3','succ':'\u227B','succapprox':'\u2AB8','succcurlyeq':'\u227D','Succeeds':'\u227B','SucceedsEqual':'\u2AB0','SucceedsSlantEqual':'\u227D','SucceedsTilde':'\u227F','succeq':'\u2AB0','succnapprox':'\u2ABA','succneqq':'\u2AB6','succnsim':'\u22E9','succsim':'\u227F','SuchThat':'\u220B','sum':'\u2211','Sum':'\u2211','sung':'\u266A','sup':'\u2283','Sup':'\u22D1','sup1':'\xB9','sup2':'\xB2','sup3':'\xB3','supdot':'\u2ABE','supdsub':'\u2AD8','supe':'\u2287','supE':'\u2AC6','supedot':'\u2AC4','Superset':'\u2283','SupersetEqual':'\u2287','suphsol':'\u27C9','suphsub':'\u2AD7','suplarr':'\u297B','supmult':'\u2AC2','supne':'\u228B','supnE':'\u2ACC','supplus':'\u2AC0','supset':'\u2283','Supset':'\u22D1','supseteq':'\u2287','supseteqq':'\u2AC6','supsetneq':'\u228B','supsetneqq':'\u2ACC','supsim':'\u2AC8','supsub':'\u2AD4','supsup':'\u2AD6','swarhk':'\u2926','swarr':'\u2199','swArr':'\u21D9','swarrow':'\u2199','swnwar':'\u292A','szlig':'\xDF','Tab':'\t','target':'\u2316','tau':'\u03C4','Tau':'\u03A4','tbrk':'\u23B4','tcaron':'\u0165','Tcaron':'\u0164','tcedil':'\u0163','Tcedil':'\u0162','tcy':'\u0442','Tcy':'\u0422','tdot':'\u20DB','telrec':'\u2315','tfr':'\uD835\uDD31','Tfr':'\uD835\uDD17','there4':'\u2234','therefore':'\u2234','Therefore':'\u2234','theta':'\u03B8','Theta':'\u0398','thetasym':'\u03D1','thetav':'\u03D1','thickapprox':'\u2248','thicksim':'\u223C','ThickSpace':'\u205F\u200A','thinsp':'\u2009','ThinSpace':'\u2009','thkap':'\u2248','thksim':'\u223C','thorn':'\xFE','THORN':'\xDE','tilde':'\u02DC','Tilde':'\u223C','TildeEqual':'\u2243','TildeFullEqual':'\u2245','TildeTilde':'\u2248','times':'\xD7','timesb':'\u22A0','timesbar':'\u2A31','timesd':'\u2A30','tint':'\u222D','toea':'\u2928','top':'\u22A4','topbot':'\u2336','topcir':'\u2AF1','topf':'\uD835\uDD65','Topf':'\uD835\uDD4B','topfork':'\u2ADA','tosa':'\u2929','tprime':'\u2034','trade':'\u2122','TRADE':'\u2122','triangle':'\u25B5','triangledown':'\u25BF','triangleleft':'\u25C3','trianglelefteq':'\u22B4','triangleq':'\u225C','triangleright':'\u25B9','trianglerighteq':'\u22B5','tridot':'\u25EC','trie':'\u225C','triminus':'\u2A3A','TripleDot':'\u20DB','triplus':'\u2A39','trisb':'\u29CD','tritime':'\u2A3B','trpezium':'\u23E2','tscr':'\uD835\uDCC9','Tscr':'\uD835\uDCAF','tscy':'\u0446','TScy':'\u0426','tshcy':'\u045B','TSHcy':'\u040B','tstrok':'\u0167','Tstrok':'\u0166','twixt':'\u226C','twoheadleftarrow':'\u219E','twoheadrightarrow':'\u21A0','uacute':'\xFA','Uacute':'\xDA','uarr':'\u2191','uArr':'\u21D1','Uarr':'\u219F','Uarrocir':'\u2949','ubrcy':'\u045E','Ubrcy':'\u040E','ubreve':'\u016D','Ubreve':'\u016C','ucirc':'\xFB','Ucirc':'\xDB','ucy':'\u0443','Ucy':'\u0423','udarr':'\u21C5','udblac':'\u0171','Udblac':'\u0170','udhar':'\u296E','ufisht':'\u297E','ufr':'\uD835\uDD32','Ufr':'\uD835\uDD18','ugrave':'\xF9','Ugrave':'\xD9','uHar':'\u2963','uharl':'\u21BF','uharr':'\u21BE','uhblk':'\u2580','ulcorn':'\u231C','ulcorner':'\u231C','ulcrop':'\u230F','ultri':'\u25F8','umacr':'\u016B','Umacr':'\u016A','uml':'\xA8','UnderBar':'_','UnderBrace':'\u23DF','UnderBracket':'\u23B5','UnderParenthesis':'\u23DD','Union':'\u22C3','UnionPlus':'\u228E','uogon':'\u0173','Uogon':'\u0172','uopf':'\uD835\uDD66','Uopf':'\uD835\uDD4C','uparrow':'\u2191','Uparrow':'\u21D1','UpArrow':'\u2191','UpArrowBar':'\u2912','UpArrowDownArrow':'\u21C5','updownarrow':'\u2195','Updownarrow':'\u21D5','UpDownArrow':'\u2195','UpEquilibrium':'\u296E','upharpoonleft':'\u21BF','upharpoonright':'\u21BE','uplus':'\u228E','UpperLeftArrow':'\u2196','UpperRightArrow':'\u2197','upsi':'\u03C5','Upsi':'\u03D2','upsih':'\u03D2','upsilon':'\u03C5','Upsilon':'\u03A5','UpTee':'\u22A5','UpTeeArrow':'\u21A5','upuparrows':'\u21C8','urcorn':'\u231D','urcorner':'\u231D','urcrop':'\u230E','uring':'\u016F','Uring':'\u016E','urtri':'\u25F9','uscr':'\uD835\uDCCA','Uscr':'\uD835\uDCB0','utdot':'\u22F0','utilde':'\u0169','Utilde':'\u0168','utri':'\u25B5','utrif':'\u25B4','uuarr':'\u21C8','uuml':'\xFC','Uuml':'\xDC','uwangle':'\u29A7','vangrt':'\u299C','varepsilon':'\u03F5','varkappa':'\u03F0','varnothing':'\u2205','varphi':'\u03D5','varpi':'\u03D6','varpropto':'\u221D','varr':'\u2195','vArr':'\u21D5','varrho':'\u03F1','varsigma':'\u03C2','varsubsetneq':'\u228A\uFE00','varsubsetneqq':'\u2ACB\uFE00','varsupsetneq':'\u228B\uFE00','varsupsetneqq':'\u2ACC\uFE00','vartheta':'\u03D1','vartriangleleft':'\u22B2','vartriangleright':'\u22B3','vBar':'\u2AE8','Vbar':'\u2AEB','vBarv':'\u2AE9','vcy':'\u0432','Vcy':'\u0412','vdash':'\u22A2','vDash':'\u22A8','Vdash':'\u22A9','VDash':'\u22AB','Vdashl':'\u2AE6','vee':'\u2228','Vee':'\u22C1','veebar':'\u22BB','veeeq':'\u225A','vellip':'\u22EE','verbar':'|','Verbar':'\u2016','vert':'|','Vert':'\u2016','VerticalBar':'\u2223','VerticalLine':'|','VerticalSeparator':'\u2758','VerticalTilde':'\u2240','VeryThinSpace':'\u200A','vfr':'\uD835\uDD33','Vfr':'\uD835\uDD19','vltri':'\u22B2','vnsub':'\u2282\u20D2','vnsup':'\u2283\u20D2','vopf':'\uD835\uDD67','Vopf':'\uD835\uDD4D','vprop':'\u221D','vrtri':'\u22B3','vscr':'\uD835\uDCCB','Vscr':'\uD835\uDCB1','vsubne':'\u228A\uFE00','vsubnE':'\u2ACB\uFE00','vsupne':'\u228B\uFE00','vsupnE':'\u2ACC\uFE00','Vvdash':'\u22AA','vzigzag':'\u299A','wcirc':'\u0175','Wcirc':'\u0174','wedbar':'\u2A5F','wedge':'\u2227','Wedge':'\u22C0','wedgeq':'\u2259','weierp':'\u2118','wfr':'\uD835\uDD34','Wfr':'\uD835\uDD1A','wopf':'\uD835\uDD68','Wopf':'\uD835\uDD4E','wp':'\u2118','wr':'\u2240','wreath':'\u2240','wscr':'\uD835\uDCCC','Wscr':'\uD835\uDCB2','xcap':'\u22C2','xcirc':'\u25EF','xcup':'\u22C3','xdtri':'\u25BD','xfr':'\uD835\uDD35','Xfr':'\uD835\uDD1B','xharr':'\u27F7','xhArr':'\u27FA','xi':'\u03BE','Xi':'\u039E','xlarr':'\u27F5','xlArr':'\u27F8','xmap':'\u27FC','xnis':'\u22FB','xodot':'\u2A00','xopf':'\uD835\uDD69','Xopf':'\uD835\uDD4F','xoplus':'\u2A01','xotime':'\u2A02','xrarr':'\u27F6','xrArr':'\u27F9','xscr':'\uD835\uDCCD','Xscr':'\uD835\uDCB3','xsqcup':'\u2A06','xuplus':'\u2A04','xutri':'\u25B3','xvee':'\u22C1','xwedge':'\u22C0','yacute':'\xFD','Yacute':'\xDD','yacy':'\u044F','YAcy':'\u042F','ycirc':'\u0177','Ycirc':'\u0176','ycy':'\u044B','Ycy':'\u042B','yen':'\xA5','yfr':'\uD835\uDD36','Yfr':'\uD835\uDD1C','yicy':'\u0457','YIcy':'\u0407','yopf':'\uD835\uDD6A','Yopf':'\uD835\uDD50','yscr':'\uD835\uDCCE','Yscr':'\uD835\uDCB4','yucy':'\u044E','YUcy':'\u042E','yuml':'\xFF','Yuml':'\u0178','zacute':'\u017A','Zacute':'\u0179','zcaron':'\u017E','Zcaron':'\u017D','zcy':'\u0437','Zcy':'\u0417','zdot':'\u017C','Zdot':'\u017B','zeetrf':'\u2128','ZeroWidthSpace':'\u200B','zeta':'\u03B6','Zeta':'\u0396','zfr':'\uD835\uDD37','Zfr':'\u2128','zhcy':'\u0436','ZHcy':'\u0416','zigrarr':'\u21DD','zopf':'\uD835\uDD6B','Zopf':'\u2124','zscr':'\uD835\uDCCF','Zscr':'\uD835\uDCB5','zwj':'\u200D','zwnj':'\u200C'};
	var decodeMapLegacy = {'aacute':'\xE1','Aacute':'\xC1','acirc':'\xE2','Acirc':'\xC2','acute':'\xB4','aelig':'\xE6','AElig':'\xC6','agrave':'\xE0','Agrave':'\xC0','amp':'&','AMP':'&','aring':'\xE5','Aring':'\xC5','atilde':'\xE3','Atilde':'\xC3','auml':'\xE4','Auml':'\xC4','brvbar':'\xA6','ccedil':'\xE7','Ccedil':'\xC7','cedil':'\xB8','cent':'\xA2','copy':'\xA9','COPY':'\xA9','curren':'\xA4','deg':'\xB0','divide':'\xF7','eacute':'\xE9','Eacute':'\xC9','ecirc':'\xEA','Ecirc':'\xCA','egrave':'\xE8','Egrave':'\xC8','eth':'\xF0','ETH':'\xD0','euml':'\xEB','Euml':'\xCB','frac12':'\xBD','frac14':'\xBC','frac34':'\xBE','gt':'>','GT':'>','iacute':'\xED','Iacute':'\xCD','icirc':'\xEE','Icirc':'\xCE','iexcl':'\xA1','igrave':'\xEC','Igrave':'\xCC','iquest':'\xBF','iuml':'\xEF','Iuml':'\xCF','laquo':'\xAB','lt':'<','LT':'<','macr':'\xAF','micro':'\xB5','middot':'\xB7','nbsp':'\xA0','not':'\xAC','ntilde':'\xF1','Ntilde':'\xD1','oacute':'\xF3','Oacute':'\xD3','ocirc':'\xF4','Ocirc':'\xD4','ograve':'\xF2','Ograve':'\xD2','ordf':'\xAA','ordm':'\xBA','oslash':'\xF8','Oslash':'\xD8','otilde':'\xF5','Otilde':'\xD5','ouml':'\xF6','Ouml':'\xD6','para':'\xB6','plusmn':'\xB1','pound':'\xA3','quot':'"','QUOT':'"','raquo':'\xBB','reg':'\xAE','REG':'\xAE','sect':'\xA7','shy':'\xAD','sup1':'\xB9','sup2':'\xB2','sup3':'\xB3','szlig':'\xDF','thorn':'\xFE','THORN':'\xDE','times':'\xD7','uacute':'\xFA','Uacute':'\xDA','ucirc':'\xFB','Ucirc':'\xDB','ugrave':'\xF9','Ugrave':'\xD9','uml':'\xA8','uuml':'\xFC','Uuml':'\xDC','yacute':'\xFD','Yacute':'\xDD','yen':'\xA5','yuml':'\xFF'};
	var decodeMapNumeric = {'0':'\uFFFD','128':'\u20AC','130':'\u201A','131':'\u0192','132':'\u201E','133':'\u2026','134':'\u2020','135':'\u2021','136':'\u02C6','137':'\u2030','138':'\u0160','139':'\u2039','140':'\u0152','142':'\u017D','145':'\u2018','146':'\u2019','147':'\u201C','148':'\u201D','149':'\u2022','150':'\u2013','151':'\u2014','152':'\u02DC','153':'\u2122','154':'\u0161','155':'\u203A','156':'\u0153','158':'\u017E','159':'\u0178'};
	var invalidReferenceCodePoints = [1,2,3,4,5,6,7,8,11,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,64976,64977,64978,64979,64980,64981,64982,64983,64984,64985,64986,64987,64988,64989,64990,64991,64992,64993,64994,64995,64996,64997,64998,64999,65000,65001,65002,65003,65004,65005,65006,65007,65534,65535,131070,131071,196606,196607,262142,262143,327678,327679,393214,393215,458750,458751,524286,524287,589822,589823,655358,655359,720894,720895,786430,786431,851966,851967,917502,917503,983038,983039,1048574,1048575,1114110,1114111];

	/*--------------------------------------------------------------------------*/

	var stringFromCharCode = String.fromCharCode;

	var object = {};
	var hasOwnProperty = object.hasOwnProperty;
	var has = function(object, propertyName) {
		return hasOwnProperty.call(object, propertyName);
	};

	var contains = function(array, value) {
		var index = -1;
		var length = array.length;
		while (++index < length) {
			if (array[index] == value) {
				return true;
			}
		}
		return false;
	};

	var merge = function(options, defaults) {
		if (!options) {
			return defaults;
		}
		var result = {};
		var key;
		for (key in defaults) {
			// A `hasOwnProperty` check is not needed here, since only recognized
			// option names are used anyway. Any others are ignored.
			result[key] = has(options, key) ? options[key] : defaults[key];
		}
		return result;
	};

	// Modified version of `ucs2encode`; see https://mths.be/punycode.
	var codePointToSymbol = function(codePoint, strict) {
		var output = '';
		if ((codePoint >= 0xD800 && codePoint <= 0xDFFF) || codePoint > 0x10FFFF) {
			// See issue #4:
			// “Otherwise, if the number is in the range 0xD800 to 0xDFFF or is
			// greater than 0x10FFFF, then this is a parse error. Return a U+FFFD
			// REPLACEMENT CHARACTER.”
			if (strict) {
				parseError('character reference outside the permissible Unicode range');
			}
			return '\uFFFD';
		}
		if (has(decodeMapNumeric, codePoint)) {
			if (strict) {
				parseError('disallowed character reference');
			}
			return decodeMapNumeric[codePoint];
		}
		if (strict && contains(invalidReferenceCodePoints, codePoint)) {
			parseError('disallowed character reference');
		}
		if (codePoint > 0xFFFF) {
			codePoint -= 0x10000;
			output += stringFromCharCode(codePoint >>> 10 & 0x3FF | 0xD800);
			codePoint = 0xDC00 | codePoint & 0x3FF;
		}
		output += stringFromCharCode(codePoint);
		return output;
	};

	var hexEscape = function(codePoint) {
		return '&#x' + codePoint.toString(16).toUpperCase() + ';';
	};

	var decEscape = function(codePoint) {
		return '&#' + codePoint + ';';
	};

	var parseError = function(message) {
		throw Error('Parse error: ' + message);
	};

	/*--------------------------------------------------------------------------*/

	var encode = function(string, options) {
		options = merge(options, encode.options);
		var strict = options.strict;
		if (strict && regexInvalidRawCodePoint.test(string)) {
			parseError('forbidden code point');
		}
		var encodeEverything = options.encodeEverything;
		var useNamedReferences = options.useNamedReferences;
		var allowUnsafeSymbols = options.allowUnsafeSymbols;
		var escapeCodePoint = options.decimal ? decEscape : hexEscape;

		var escapeBmpSymbol = function(symbol) {
			return escapeCodePoint(symbol.charCodeAt(0));
		};

		if (encodeEverything) {
			// Encode ASCII symbols.
			string = string.replace(regexAsciiWhitelist, function(symbol) {
				// Use named references if requested & possible.
				if (useNamedReferences && has(encodeMap, symbol)) {
					return '&' + encodeMap[symbol] + ';';
				}
				return escapeBmpSymbol(symbol);
			});
			// Shorten a few escapes that represent two symbols, of which at least one
			// is within the ASCII range.
			if (useNamedReferences) {
				string = string
					.replace(/&gt;\u20D2/g, '&nvgt;')
					.replace(/&lt;\u20D2/g, '&nvlt;')
					.replace(/&#x66;&#x6A;/g, '&fjlig;');
			}
			// Encode non-ASCII symbols.
			if (useNamedReferences) {
				// Encode non-ASCII symbols that can be replaced with a named reference.
				string = string.replace(regexEncodeNonAscii, function(string) {
					// Note: there is no need to check `has(encodeMap, string)` here.
					return '&' + encodeMap[string] + ';';
				});
			}
			// Note: any remaining non-ASCII symbols are handled outside of the `if`.
		} else if (useNamedReferences) {
			// Apply named character references.
			// Encode `<>"'&` using named character references.
			if (!allowUnsafeSymbols) {
				string = string.replace(regexEscape, function(string) {
					return '&' + encodeMap[string] + ';'; // no need to check `has()` here
				});
			}
			// Shorten escapes that represent two symbols, of which at least one is
			// `<>"'&`.
			string = string
				.replace(/&gt;\u20D2/g, '&nvgt;')
				.replace(/&lt;\u20D2/g, '&nvlt;');
			// Encode non-ASCII symbols that can be replaced with a named reference.
			string = string.replace(regexEncodeNonAscii, function(string) {
				// Note: there is no need to check `has(encodeMap, string)` here.
				return '&' + encodeMap[string] + ';';
			});
		} else if (!allowUnsafeSymbols) {
			// Encode `<>"'&` using hexadecimal escapes, now that they’re not handled
			// using named character references.
			string = string.replace(regexEscape, escapeBmpSymbol);
		}
		return string
			// Encode astral symbols.
			.replace(regexAstralSymbols, function($0) {
				// https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
				var high = $0.charCodeAt(0);
				var low = $0.charCodeAt(1);
				var codePoint = (high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000;
				return escapeCodePoint(codePoint);
			})
			// Encode any remaining BMP symbols that are not printable ASCII symbols
			// using a hexadecimal escape.
			.replace(regexBmpWhitelist, escapeBmpSymbol);
	};
	// Expose default options (so they can be overridden globally).
	encode.options = {
		'allowUnsafeSymbols': false,
		'encodeEverything': false,
		'strict': false,
		'useNamedReferences': false,
		'decimal' : false
	};

	var decode = function(html, options) {
		options = merge(options, decode.options);
		var strict = options.strict;
		if (strict && regexInvalidEntity.test(html)) {
			parseError('malformed character reference');
		}
		return html.replace(regexDecode, function($0, $1, $2, $3, $4, $5, $6, $7) {
			var codePoint;
			var semicolon;
			var decDigits;
			var hexDigits;
			var reference;
			var next;
			if ($1) {
				// Decode decimal escapes, e.g. `&#119558;`.
				decDigits = $1;
				semicolon = $2;
				if (strict && !semicolon) {
					parseError('character reference was not terminated by a semicolon');
				}
				codePoint = parseInt(decDigits, 10);
				return codePointToSymbol(codePoint, strict);
			}
			if ($3) {
				// Decode hexadecimal escapes, e.g. `&#x1D306;`.
				hexDigits = $3;
				semicolon = $4;
				if (strict && !semicolon) {
					parseError('character reference was not terminated by a semicolon');
				}
				codePoint = parseInt(hexDigits, 16);
				return codePointToSymbol(codePoint, strict);
			}
			if ($5) {
				// Decode named character references with trailing `;`, e.g. `&copy;`.
				reference = $5;
				if (has(decodeMap, reference)) {
					return decodeMap[reference];
				} else {
					// Ambiguous ampersand. https://mths.be/notes/ambiguous-ampersands
					if (strict) {
						parseError(
							'named character reference was not terminated by a semicolon'
						);
					}
					return $0;
				}
			}
			// If we’re still here, it’s a legacy reference for sure. No need for an
			// extra `if` check.
			// Decode named character references without trailing `;`, e.g. `&amp`
			// This is only a parse error if it gets converted to `&`, or if it is
			// followed by `=` in an attribute context.
			reference = $6;
			next = $7;
			if (next && options.isAttributeValue) {
				if (strict && next == '=') {
					parseError('`&` did not start a character reference');
				}
				return $0;
			} else {
				if (strict) {
					parseError(
						'named character reference was not terminated by a semicolon'
					);
				}
				// Note: there is no need to check `has(decodeMapLegacy, reference)`.
				return decodeMapLegacy[reference] + (next || '');
			}
		});
	};
	// Expose default options (so they can be overridden globally).
	decode.options = {
		'isAttributeValue': false,
		'strict': false
	};

	var escape = function(string) {
		return string.replace(regexEscape, function($0) {
			// Note: there is no need to check `has(escapeMap, $0)` here.
			return escapeMap[$0];
		});
	};

	/*--------------------------------------------------------------------------*/

	var he = {
		'version': '1.1.1',
		'encode': encode,
		'decode': decode,
		'escape': escape,
		'unescape': decode
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define(function() {
			return he;
		});
	}	else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = he;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (var key in he) {
				has(he, key) && (freeExports[key] = he[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.he = he;
	}

}(this));

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],51:[function(_dereq_,module,exports){
var he = _dereq_("he");
var getAllMatches = _dereq_("./util").getAllMatches;

var xmlNode = function(tagname,parent,val){
    this.tagname = tagname;
    this.parent = parent;
    this.child = [];
    this.val = val;
    this.addChild = function (child){
        this.child.push(child);
    };
};

//var tagsRegx = new RegExp("<(\\/?[a-zA-Z0-9_:]+)([^>\\/]*)(\\/?)>([^<]+)?","g");
//var tagsRegx = new RegExp("<(\\/?[\\w:-]+)([^>]*)>([^<]+)?","g");
//var cdataRegx = "<!\\[CDATA\\[([^\\]\\]]*)\\]\\]>";
var cdataRegx = "<!\\[CDATA\\[(.*?)(\\]\\]>)";
var tagsRegx = new RegExp("<(\\/?[\\w:\\-\._]+)([^>]*)>(\\s*"+cdataRegx+")*([^<]+)?","g");

var defaultOptions = {
    attrPrefix : "@_",
    attrNodeName: false,
    textNodeName : "#text",
    ignoreNonTextNodeAttr : true,
    ignoreTextNodeAttr : true,
    ignoreNameSpace : false,
    ignoreRootElement : false,
    textNodeConversion : true,
    textAttrConversion : false,
    arrayMode : false
};

var buildOptions = function (options){
    if(!options) options = {};
    var props = ["attrPrefix","attrNodeName","ignoreNonTextNodeAttr","ignoreTextNodeAttr","ignoreNameSpace","ignoreRootElement","textNodeName","textNodeConversion","textAttrConversion","arrayMode"];
    for (var i = 0; i < props.length; i++) {
        if(options[props[i]] === undefined){
            options[props[i]] = defaultOptions[props[i]];
        }
    }
    return options;
};

var getTraversalObj =function (xmlData,options){
    options = buildOptions(options);
    //xmlData = xmlData.replace(/>(\s+)/g, ">");//Remove spaces and make it single line.
    xmlData = xmlData.replace(/<!--(.|\n)*?-->/g, "");//Remove single and multiline comments
    var tags = getAllMatches(xmlData,tagsRegx);
    //console.log(tags);
    var xmlObj = new xmlNode('!xml');
    var currentNode = xmlObj;

    for (var i = 0; i < tags.length ; i++) {
        var tag = resolveNameSpace(tags[i][1],options.ignoreNameSpace),
            nexttag = i+1 < tags.length ? resolveNameSpace(tags[i+1][1],options.ignoreNameSpace) : undefined,
            attrsStr = tags[i][2], attrs,
            val = tags[i][4] ===  undefined ? tags[i][6] :  simplifyCDATA(tags[i][0]);
        if(tag.indexOf("/") === 0){//ending tag
            currentNode = currentNode.parent;
            continue;
        }

        var selfClosingTag = attrsStr.charAt(attrsStr.length-1) === '/';
        var childNode = new xmlNode(tag,currentNode);

        if(selfClosingTag){
            attrs = buildAttributesArr(attrsStr,options.ignoreTextNodeAttr,options.attrPrefix,options.attrNodeName,options.ignoreNameSpace,options.textAttrConversion);
            childNode.val = attrs || "";
            currentNode.addChild(childNode);
        }else if( ("/" + tag) === nexttag){ //Text node
            attrs = buildAttributesArr(attrsStr,options.ignoreTextNodeAttr,options.attrPrefix,options.attrNodeName,options.ignoreNameSpace,options.textAttrConversion);
            val = parseValue(val,options.textNodeConversion);
            if(attrs){
                attrs[options.textNodeName] = val;
                childNode.val = attrs;
            }else{
                childNode.val = val;
            }
            currentNode.addChild(childNode);
            i++;
        }else if( (nexttag && nexttag.indexOf("/") === -1) && (val !== undefined && val != null && val.trim() !== "" )){ //Text node with sub nodes
            val = parseValue(val,options.textNodeConversion);
            childNode.addChild(new xmlNode(options.textNodeName,childNode,val));
            currentNode.addChild(childNode);
            currentNode = childNode;
        }else{//starting tag
            attrs = buildAttributesArr(attrsStr,options.ignoreNonTextNodeAttr,options.attrPrefix,options.attrNodeName,options.ignoreNameSpace,options.textAttrConversion);
            if(attrs){
                for (var prop in attrs) {
                  if(attrs.hasOwnProperty(prop)){
                    childNode.addChild(new xmlNode(prop,childNode,attrs[prop]));
                  }
                }
            }
            currentNode.addChild(childNode);
            currentNode = childNode;
        }
    }
    return xmlObj;
};

var xml2json = function (xmlData,options){
    return convertToJson(getTraversalObj(xmlData,options), buildOptions(options).arrayMode);
};

var cdRegx = new RegExp(cdataRegx,"g");

function simplifyCDATA(cdata){
    var result = getAllMatches(cdata,cdRegx);
    var val = "";
    for (var i = 0; i < result.length ; i++) {
        val+=result[i][1];
    }
    return val;
}

function resolveNameSpace(tagname,ignore){
    if(ignore){
        var tags = tagname.split(":");
        var prefix = tagname.charAt(0) === "/" ? "/" : "";
        if(tags.length === 2) {
            if(tags[0] === "xmlns") {
                return "";
            }
            tagname = prefix + tags[1];
        }
    }
    return tagname;
}

function parseValue(val,conversion,isAttribute){
    if(val){
        if(!conversion || isNaN(val)){
            val = "" + he.decode(val, {isAttributeValue:isAttribute, strict:true});
            if(isAttribute) {
                val = val.replace(/\r?\n/g, " ");
            }
        }else{
            if(val.indexOf(".") !== -1){
                if(parseFloat){
                    val = parseFloat(val);
                }else{
                    val = Number.parseFloat(val);
                }
            }else{
                if(parseInt){
                    val = parseInt(val,10);
                }else{
                    val = Number.parseInt(val,10);
                }
            }
        }
    }else{
        val = "";
    }
    return val;
}

var attrsRegx = new RegExp("([\\w\\-\\.\\:]+)\\s*=\\s*(['\"])((.|\n)*?)\\2","gm");
function buildAttributesArr(attrStr,ignore,prefix,attrNodeName,ignoreNS,conversion){
    attrStr = attrStr || attrStr.trim();
    
    if(!ignore && attrStr.length > 3){

        var matches = getAllMatches(attrStr,attrsRegx);
        var attrs = {};
        for (var i = 0; i < matches.length; i++) {
            var attrName = resolveNameSpace(matches[i][1],ignoreNS);
            if(attrName.length && attrName !== "xmlns") {
                attrs[prefix + attrName] = parseValue(matches[i][3], conversion, true);
            }
        }
        if(!Object.keys(attrs).length){
            return;
        }
        if(attrNodeName){
            var attrCollection = {};
            attrCollection[attrNodeName] = attrs;
            return attrCollection;
        }
        return attrs;
    }
}

var convertToJson = function (node, arrayMode){
    var jObj = {};
    if(node.val !== undefined && node.val != null || node.val === "") {
        return node.val;
    }else{
        for (var index = 0; index < node.child.length; index++) {
            var prop = node.child[index].tagname;
            var obj = convertToJson(node.child[index], arrayMode);
            if(jObj[prop] !== undefined){
                if(!Array.isArray(jObj[prop])){
                    var swap = jObj[prop];
                    jObj[prop] = [];
                    jObj[prop].push(swap);
                }
                jObj[prop].push(obj);
            }else{
                jObj[prop] = arrayMode ? [obj] : obj;
            }
        }
    }
    return jObj;
};

exports.parse = xml2json;
exports.getTraversalObj = getTraversalObj;
exports.convertToJson = convertToJson;
exports.validate = _dereq_("./validator").validate;

},{"./util":52,"./validator":53,"he":50}],52:[function(_dereq_,module,exports){
var getAllMatches = function(string, regex) {
  var matches = [];
  var match = regex.exec(string);
  while (match) {
  	var allmatches = [];
    for (var index = 0; index < match.length; index++) {
  		allmatches.push(match[index]);
  	}
    matches.push(allmatches);
    match = regex.exec(string);
  }
  return matches;
};


var doesMatch = function(string,regex){
  var match = regex.exec(string);
  if(match === null || match === undefined) return false;
  else return true;
}

var doesNotMatch = function(string,regex){
  return !doesMatch(string,regex);
}

exports.doesMatch = doesMatch
exports.doesNotMatch = doesNotMatch
exports.getAllMatches = getAllMatches;
},{}],53:[function(_dereq_,module,exports){
var util = _dereq_("./util");


var tagsPattern = new RegExp("<\\/?([\\w:\\-_\.]+)\\s*\/?>","g");
exports.validate = function(xmlData){
    xmlData = xmlData.replace(/(\r\n|\n|\r)/gm,"");//make it single line
    xmlData = xmlData.replace(/(^\s*<\?xml.*?\?>)/g,"");//Remove XML starting tag
    xmlData = xmlData.replace(/(<!DOCTYPE[\s\w\"\.\/\-\:]+(\[.*\])*\s*>)/g,"");//Remove DOCTYPE

    var tags = [];
    for (var i = 0; i < xmlData.length; i++) {

        if(xmlData[i] === "<"){//starting of tag
            //read until you reach to '>' avoiding any '>' in attribute value

            i++;

            if(xmlData[i] === "!"){
                i = readCommentAndCDATA(xmlData,i);
                continue;
            }else{
                var closingTag = false;
                if(xmlData[i] === "/"){//closing tag
                    closingTag = true;
                    i++;
                }
                //read tagname
                var tagName = "";
                for(;i < xmlData.length
                    && xmlData[i] !== ">"
                    && xmlData[i] !== " "
                    && xmlData[i] !== "\t" ; i++) {

                    tagName +=xmlData[i];
                }
                tagName = tagName.trim();
                //console.log(tagName);

                if(tagName[tagName.length-1] === "/"){//self closing tag without attributes
                    tagName = tagName.substring(0,tagName.length-2);
                    return validateTagName(tagName);
                }
                if(!validateTagName(tagName)) return false;


                var attrStr = "";
                var startChar = "";
                for(;i < xmlData.length ;i++){
                    if(xmlData[i] === '"' || xmlData[i] === "'"){
                        if(startChar === ""){
                            startChar = xmlData[i];
                        }else{
                            startChar = "";
                        }
                    }else if(xmlData[i] === ">"){
                        if(startChar === ""){
                            break;
                        }
                    }
                    attrStr += xmlData[i];
                }
                if(startChar !== "") return false;//Unclosed quote
                attrStr = attrStr.trim();
                //console.log(attrStr, attrStr);

                if(attrStr[attrStr.length-1] === "/" ){//self closing tag
                    attrStr = attrStr.substring(0,attrStr.length-2);

                    if(!validateAttributeString(attrStr)){
                        return false;
                    }else{

                        continue;
                    }
                }else if(closingTag){
                    if(attrStr.length > 0){
                        return false;
                        //throw new Error("XML validation error: closing tag should not have any attribute");
                    }else{
                        var otg = tags.pop();
                        if(tagName !== otg){
                            return false;
                            //throw new Error("XML validation error: no mathicng closing tag");
                        }
                    }
                }else{
                    if(!validateAttributeString(attrStr)){
                        return false;
                    }
                    tags.push(tagName);
                }

                //skip tag text value
                //It may include comments and CDATA value
                for(i++;i < xmlData.length ; i++){
                    if(xmlData[i] === "<"){
                        if(xmlData[i+1] === "!"){//comment or CADATA
                            i++;
                            i = readCommentAndCDATA(xmlData,i);
                            continue;
                        }else{
                            break;
                        }
                    }
                }//end of reading tag text value
                if(xmlData[i] === "<") i--;
            }
        }else{

            if(xmlData[i] === " " || xmlData[i] === "\t") continue;
            return false;
        }
    }


    if(tags.length > 0){
        return false;
        //throw new Error("XML validation error");
    }

    return true;
}

function readCommentAndCDATA(xmlData,i){
    if(xmlData.length > i+5 && xmlData[i+1] === "-" && xmlData[i+2] === "-"){//comment
        for(i+=3;i<xmlData.length;i++){
            if(xmlData[i] === "-" && xmlData[i+1] === "-" && xmlData[i+2] === ">"){
                i+=2;
                break;
            }
        }
    }else if( xmlData.length > i+9
        && xmlData[i+1] === "["
        && xmlData[i+2] === "C"
        && xmlData[i+3] === "D"
        && xmlData[i+4] === "A"
        && xmlData[i+5] === "T"
        && xmlData[i+6] === "A"
        && xmlData[i+7] === "["){

        for(i+=8;i<xmlData.length;i++){
            if(xmlData[i] === "]" && xmlData[i+1] === "]" && xmlData[i+2] === ">" ){
                i+=2;
                break;
            }
        }
    }

    return i;
}
//attr, ="sd", a="amit's", a="sd"b="saf",
function validateAttributeString(attrStr){
    var attrNames = [];
    for(var i=0; i< attrStr.length; i++){
        var startChar = "";
        //read attribute name
        var attrName = "";
        for(;i < attrStr.length && attrStr[i] !== "=" ; i++) {
            attrName +=attrStr[i];
        }
        //validate attrName
        attrName = attrName.trim();



        if(!attrNames.hasOwnProperty(attrName)){
            attrNames[attrName]=1;
        }else{
            return false;
        }
        if(!validateAttrName(attrName)){
            return false;
        }
        i++;

        //skip whitespaces
        for(;i < attrStr.length
            && (attrStr[i] === " "
            || attrStr[i] === "\t") ; i++);

        //read attribute value
        startChar = attrStr[i++];

        var attrVal = "";
        for(;i < attrStr.length && attrStr[i] !== startChar; i++) {
            attrVal +=attrStr[i];
        }

        //validate attrVal

        if(startChar !== ""){
            i++;
            if(i<attrStr.length && (attrStr[i] !== " " && attrStr[i] !== "\t") ){//when no spce between 2 attributes : a="sd"b="saf"
                return false;
            }
            startChar = "";
        }
    }

    return true;
}

var validAttrRegxp = new RegExp("^[_a-zA-Z][\\w\\-\\.\\:]*$");

function validateAttrName(attrName){
    return util.doesMatch(attrName,validAttrRegxp);
}
//var startsWithXML = new RegExp("^[Xx][Mm][Ll]");
var startsWith = new RegExp("^([a-zA-Z]|_)[\\w\.\\-_:]*");

function validateTagName(tagname){
    /*if(util.doesMatch(tagname,startsWithXML)) return false;
    else*/ if(util.doesNotMatch(tagname,startsWith)) return false;
    else return true;
}



},{"./util":52}],54:[function(_dereq_,module,exports){
(function (global){
//! moment.js
//! version : 2.9.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

(function (undefined) {
    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = '2.9.0',
        // the global-scope this is NOT the global object in Node.js
        globalScope = (typeof global !== 'undefined' && (typeof window === 'undefined' || window === global.window)) ? global : this,
        oldGlobalMoment,
        round = Math.round,
        hasOwnProperty = Object.prototype.hasOwnProperty,
        i,

        YEAR = 0,
        MONTH = 1,
        DATE = 2,
        HOUR = 3,
        MINUTE = 4,
        SECOND = 5,
        MILLISECOND = 6,

        // internal storage for locale config files
        locales = {},

        // extra moment internal properties (plugins register props here)
        momentProperties = [],

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,

        // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
        // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
        isoDurationRegex = /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|x|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenOneToFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenOneToSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenDigits = /\d+/, // nonzero number of digits
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/gi, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO separator)
        parseTokenOffsetMs = /[\+\-]?\d+/, // 1234567890123
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123

        //strict parsing regexes
        parseTokenOneDigit = /\d/, // 0 - 9
        parseTokenTwoDigits = /\d\d/, // 00 - 99
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{4}/, // 0000 - 9999
        parseTokenSixDigits = /[+-]?\d{6}/, // -999,999 - 999,999
        parseTokenSignedNumber = /[+-]?\d+/, // -inf - inf

        // iso 8601 regex
        // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
        isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,

        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        isoDates = [
            ['YYYYYY-MM-DD', /[+-]\d{6}-\d{2}-\d{2}/],
            ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
            ['GGGG-[W]WW-E', /\d{4}-W\d{2}-\d/],
            ['GGGG-[W]WW', /\d{4}-W\d{2}/],
            ['YYYY-DDD', /\d{4}-\d{3}/]
        ],

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.SSSS', /(T| )\d\d:\d\d:\d\d\.\d+/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker '+10:00' > ['10', '00'] or '-1530' > ['-', '15', '30']
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds' : 1,
            'Seconds' : 1e3,
            'Minutes' : 6e4,
            'Hours' : 36e5,
            'Days' : 864e5,
            'Months' : 2592e6,
            'Years' : 31536e6
        },

        unitAliases = {
            ms : 'millisecond',
            s : 'second',
            m : 'minute',
            h : 'hour',
            d : 'day',
            D : 'date',
            w : 'week',
            W : 'isoWeek',
            M : 'month',
            Q : 'quarter',
            y : 'year',
            DDD : 'dayOfYear',
            e : 'weekday',
            E : 'isoWeekday',
            gg: 'weekYear',
            GG: 'isoWeekYear'
        },

        camelFunctions = {
            dayofyear : 'dayOfYear',
            isoweekday : 'isoWeekday',
            isoweek : 'isoWeek',
            weekyear : 'weekYear',
            isoweekyear : 'isoWeekYear'
        },

        // format function strings
        formatFunctions = {},

        // default relative time thresholds
        relativeTimeThresholds = {
            s: 45,  // seconds to minute
            m: 45,  // minutes to hour
            h: 22,  // hours to day
            d: 26,  // days to month
            M: 11   // months to year
        },

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M    : function () {
                return this.month() + 1;
            },
            MMM  : function (format) {
                return this.localeData().monthsShort(this, format);
            },
            MMMM : function (format) {
                return this.localeData().months(this, format);
            },
            D    : function () {
                return this.date();
            },
            DDD  : function () {
                return this.dayOfYear();
            },
            d    : function () {
                return this.day();
            },
            dd   : function (format) {
                return this.localeData().weekdaysMin(this, format);
            },
            ddd  : function (format) {
                return this.localeData().weekdaysShort(this, format);
            },
            dddd : function (format) {
                return this.localeData().weekdays(this, format);
            },
            w    : function () {
                return this.week();
            },
            W    : function () {
                return this.isoWeek();
            },
            YY   : function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY : function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY : function () {
                return leftZeroFill(this.year(), 5);
            },
            YYYYYY : function () {
                var y = this.year(), sign = y >= 0 ? '+' : '-';
                return sign + leftZeroFill(Math.abs(y), 6);
            },
            gg   : function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg : function () {
                return leftZeroFill(this.weekYear(), 4);
            },
            ggggg : function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG   : function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 4);
            },
            GGGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e : function () {
                return this.weekday();
            },
            E : function () {
                return this.isoWeekday();
            },
            a    : function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), true);
            },
            A    : function () {
                return this.localeData().meridiem(this.hours(), this.minutes(), false);
            },
            H    : function () {
                return this.hours();
            },
            h    : function () {
                return this.hours() % 12 || 12;
            },
            m    : function () {
                return this.minutes();
            },
            s    : function () {
                return this.seconds();
            },
            S    : function () {
                return toInt(this.milliseconds() / 100);
            },
            SS   : function () {
                return leftZeroFill(toInt(this.milliseconds() / 10), 2);
            },
            SSS  : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            SSSS : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z    : function () {
                var a = this.utcOffset(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + ':' + leftZeroFill(toInt(a) % 60, 2);
            },
            ZZ   : function () {
                var a = this.utcOffset(),
                    b = '+';
                if (a < 0) {
                    a = -a;
                    b = '-';
                }
                return b + leftZeroFill(toInt(a / 60), 2) + leftZeroFill(toInt(a) % 60, 2);
            },
            z : function () {
                return this.zoneAbbr();
            },
            zz : function () {
                return this.zoneName();
            },
            x    : function () {
                return this.valueOf();
            },
            X    : function () {
                return this.unix();
            },
            Q : function () {
                return this.quarter();
            }
        },

        deprecations = {},

        lists = ['months', 'monthsShort', 'weekdays', 'weekdaysShort', 'weekdaysMin'],

        updateInProgress = false;

    // Pick the first defined of two or three arguments. dfl comes from
    // default.
    function dfl(a, b, c) {
        switch (arguments.length) {
            case 2: return a != null ? a : b;
            case 3: return a != null ? a : b != null ? b : c;
            default: throw new Error('Implement me');
        }
    }

    function hasOwnProp(a, b) {
        return hasOwnProperty.call(a, b);
    }

    function defaultParsingFlags() {
        // We need to deep clone this object, and es5 standard is not very
        // helpful.
        return {
            empty : false,
            unusedTokens : [],
            unusedInput : [],
            overflow : -2,
            charsLeftOver : 0,
            nullInput : false,
            invalidMonth : null,
            invalidFormat : false,
            userInvalidated : false,
            iso: false
        };
    }

    function printMsg(msg) {
        if (moment.suppressDeprecationWarnings === false &&
                typeof console !== 'undefined' && console.warn) {
            console.warn('Deprecation warning: ' + msg);
        }
    }

    function deprecate(msg, fn) {
        var firstTime = true;
        return extend(function () {
            if (firstTime) {
                printMsg(msg);
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    function deprecateSimple(name, msg) {
        if (!deprecations[name]) {
            printMsg(msg);
            deprecations[name] = true;
        }
    }

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.localeData().ordinal(func.call(this, a), period);
        };
    }

    function monthDiff(a, b) {
        // difference in months
        var wholeMonthDiff = ((b.year() - a.year()) * 12) + (b.month() - a.month()),
            // b is in (anchor - 1 month, anchor + 1 month)
            anchor = a.clone().add(wholeMonthDiff, 'months'),
            anchor2, adjust;

        if (b - anchor < 0) {
            anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor - anchor2);
        } else {
            anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
            // linear across the month
            adjust = (b - anchor) / (anchor2 - anchor);
        }

        return -(wholeMonthDiff + adjust);
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    function meridiemFixWrap(locale, hour, meridiem) {
        var isPm;

        if (meridiem == null) {
            // nothing to do
            return hour;
        }
        if (locale.meridiemHour != null) {
            return locale.meridiemHour(hour, meridiem);
        } else if (locale.isPM != null) {
            // Fallback
            isPm = locale.isPM(meridiem);
            if (isPm && hour < 12) {
                hour += 12;
            }
            if (!isPm && hour === 12) {
                hour = 0;
            }
            return hour;
        } else {
            // thie is not supposed to happen
            return hour;
        }
    }

    /************************************
        Constructors
    ************************************/

    function Locale() {
    }

    // Moment prototype object
    function Moment(config, skipOverflow) {
        if (skipOverflow !== false) {
            checkOverflow(config);
        }
        copyConfig(this, config);
        this._d = new Date(+config._d);
        // Prevent infinite loop in case updateOffset creates new moment
        // objects.
        if (updateInProgress === false) {
            updateInProgress = true;
            moment.updateOffset(this);
            updateInProgress = false;
        }
    }

    // Duration Constructor
    function Duration(duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._locale = moment.localeData();

        this._bubble();
    }

    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (hasOwnProp(b, i)) {
                a[i] = b[i];
            }
        }

        if (hasOwnProp(b, 'toString')) {
            a.toString = b.toString;
        }

        if (hasOwnProp(b, 'valueOf')) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function copyConfig(to, from) {
        var i, prop, val;

        if (typeof from._isAMomentObject !== 'undefined') {
            to._isAMomentObject = from._isAMomentObject;
        }
        if (typeof from._i !== 'undefined') {
            to._i = from._i;
        }
        if (typeof from._f !== 'undefined') {
            to._f = from._f;
        }
        if (typeof from._l !== 'undefined') {
            to._l = from._l;
        }
        if (typeof from._strict !== 'undefined') {
            to._strict = from._strict;
        }
        if (typeof from._tzm !== 'undefined') {
            to._tzm = from._tzm;
        }
        if (typeof from._isUTC !== 'undefined') {
            to._isUTC = from._isUTC;
        }
        if (typeof from._offset !== 'undefined') {
            to._offset = from._offset;
        }
        if (typeof from._pf !== 'undefined') {
            to._pf = from._pf;
        }
        if (typeof from._locale !== 'undefined') {
            to._locale = from._locale;
        }

        if (momentProperties.length > 0) {
            for (i in momentProperties) {
                prop = momentProperties[i];
                val = from[prop];
                if (typeof val !== 'undefined') {
                    to[prop] = val;
                }
            }
        }

        return to;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength, forceSign) {
        var output = '' + Math.abs(number),
            sign = number >= 0;

        while (output.length < targetLength) {
            output = '0' + output;
        }
        return (sign ? (forceSign ? '+' : '') : '-') + output;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        other = makeAs(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // TODO: remove 'name' arg after deprecation is removed
    function createAdder(direction, name) {
        return function (val, period) {
            var dur, tmp;
            //invert the arguments, but complain about it
            if (period !== null && !isNaN(+period)) {
                deprecateSimple(name, 'moment().' + name  + '(period, number) is deprecated. Please use moment().' + name + '(number, period).');
                tmp = val; val = period; period = tmp;
            }

            val = typeof val === 'string' ? +val : val;
            dur = moment.duration(val, period);
            addOrSubtractDurationFromMoment(this, dur, direction);
            return this;
        };
    }

    function addOrSubtractDurationFromMoment(mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months;
        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        if (days) {
            rawSetter(mom, 'Date', rawGetter(mom, 'Date') + days * isAdding);
        }
        if (months) {
            rawMonthSetter(mom, rawGetter(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            moment.updateOffset(mom, days || months);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return Object.prototype.toString.call(input) === '[object Date]' ||
            input instanceof Date;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        if (units) {
            var lowered = units.toLowerCase().replace(/(.)s$/, '$1');
            units = unitAliases[units] || camelFunctions[lowered] || lowered;
        }
        return units;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (hasOwnProp(inputObject, prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeList(field) {
        var count, setter;

        if (field.indexOf('week') === 0) {
            count = 7;
            setter = 'day';
        }
        else if (field.indexOf('month') === 0) {
            count = 12;
            setter = 'month';
        }
        else {
            return;
        }

        moment[field] = function (format, index) {
            var i, getter,
                method = moment._locale[field],
                results = [];

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            getter = function (i) {
                var m = moment().utc().set(setter, i);
                return method.call(moment._locale, m, format || '');
            };

            if (index != null) {
                return getter(index);
            }
            else {
                for (i = 0; i < count; i++) {
                    results.push(getter(i));
                }
                return results;
            }
        };
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            if (coercedNumber >= 0) {
                value = Math.floor(coercedNumber);
            } else {
                value = Math.ceil(coercedNumber);
            }
        }

        return value;
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    function weeksInYear(year, dow, doy) {
        return weekOfYear(moment([year, 11, 31 + dow - doy]), dow, doy).week;
    }

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    function checkOverflow(m) {
        var overflow;
        if (m._a && m._pf.overflow === -2) {
            overflow =
                m._a[MONTH] < 0 || m._a[MONTH] > 11 ? MONTH :
                m._a[DATE] < 1 || m._a[DATE] > daysInMonth(m._a[YEAR], m._a[MONTH]) ? DATE :
                m._a[HOUR] < 0 || m._a[HOUR] > 24 ||
                    (m._a[HOUR] === 24 && (m._a[MINUTE] !== 0 ||
                                           m._a[SECOND] !== 0 ||
                                           m._a[MILLISECOND] !== 0)) ? HOUR :
                m._a[MINUTE] < 0 || m._a[MINUTE] > 59 ? MINUTE :
                m._a[SECOND] < 0 || m._a[SECOND] > 59 ? SECOND :
                m._a[MILLISECOND] < 0 || m._a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (m._pf._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }

            m._pf.overflow = overflow;
        }
    }

    function isValid(m) {
        if (m._isValid == null) {
            m._isValid = !isNaN(m._d.getTime()) &&
                m._pf.overflow < 0 &&
                !m._pf.empty &&
                !m._pf.invalidMonth &&
                !m._pf.nullInput &&
                !m._pf.invalidFormat &&
                !m._pf.userInvalidated;

            if (m._strict) {
                m._isValid = m._isValid &&
                    m._pf.charsLeftOver === 0 &&
                    m._pf.unusedTokens.length === 0 &&
                    m._pf.bigHour === undefined;
            }
        }
        return m._isValid;
    }

    function normalizeLocale(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // pick the locale from the array
    // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
    // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
    function chooseLocale(names) {
        var i = 0, j, next, locale, split;

        while (i < names.length) {
            split = normalizeLocale(names[i]).split('-');
            j = split.length;
            next = normalizeLocale(names[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                locale = loadLocale(split.slice(0, j).join('-'));
                if (locale) {
                    return locale;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return null;
    }

    function loadLocale(name) {
        var oldLocale = null;
        if (!locales[name] && hasModule) {
            try {
                oldLocale = moment.locale();
                _dereq_('./locale/' + name);
                // because defineLocale currently also sets the global locale, we want to undo that for lazy loaded locales
                moment.locale(oldLocale);
            } catch (e) { }
        }
        return locales[name];
    }

    // Return a moment from input, that is local/utc/utcOffset equivalent to
    // model.
    function makeAs(input, model) {
        var res, diff;
        if (model._isUTC) {
            res = model.clone();
            diff = (moment.isMoment(input) || isDate(input) ?
                    +input : +moment(input)) - (+res);
            // Use low-level api, because this fn is low-level api.
            res._d.setTime(+res._d + diff);
            moment.updateOffset(res, false);
            return res;
        } else {
            return moment(input).local();
        }
    }

    /************************************
        Locale
    ************************************/


    extend(Locale.prototype, {

        set : function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
            // Lenient ordinal parsing accepts just a number in addition to
            // number + (possibly) stuff coming from _ordinalParseLenient.
            this._ordinalParseLenient = new RegExp(this._ordinalParse.source + '|' + /\d{1,2}/.source);
        },

        _months : 'January_February_March_April_May_June_July_August_September_October_November_December'.split('_'),
        months : function (m) {
            return this._months[m.month()];
        },

        _monthsShort : 'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
        monthsShort : function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse : function (monthName, format, strict) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
                this._longMonthsParse = [];
                this._shortMonthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                mom = moment.utc([2000, i]);
                if (strict && !this._longMonthsParse[i]) {
                    this._longMonthsParse[i] = new RegExp('^' + this.months(mom, '').replace('.', '') + '$', 'i');
                    this._shortMonthsParse[i] = new RegExp('^' + this.monthsShort(mom, '').replace('.', '') + '$', 'i');
                }
                if (!strict && !this._monthsParse[i]) {
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (strict && format === 'MMMM' && this._longMonthsParse[i].test(monthName)) {
                    return i;
                } else if (strict && format === 'MMM' && this._shortMonthsParse[i].test(monthName)) {
                    return i;
                } else if (!strict && this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays : 'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
        weekdays : function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort : 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
        weekdaysShort : function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin : 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
        weekdaysMin : function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse : function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat : {
            LTS : 'h:mm:ss A',
            LT : 'h:mm A',
            L : 'MM/DD/YYYY',
            LL : 'MMMM D, YYYY',
            LLL : 'MMMM D, YYYY LT',
            LLLL : 'dddd, MMMM D, YYYY LT'
        },
        longDateFormat : function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM : function (input) {
            // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
            // Using charAt should be more compatible.
            return ((input + '').toLowerCase().charAt(0) === 'p');
        },

        _meridiemParse : /[ap]\.?m?\.?/i,
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },


        _calendar : {
            sameDay : '[Today at] LT',
            nextDay : '[Tomorrow at] LT',
            nextWeek : 'dddd [at] LT',
            lastDay : '[Yesterday at] LT',
            lastWeek : '[Last] dddd [at] LT',
            sameElse : 'L'
        },
        calendar : function (key, mom, now) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom, [now]) : output;
        },

        _relativeTime : {
            future : 'in %s',
            past : '%s ago',
            s : 'a few seconds',
            m : 'a minute',
            mm : '%d minutes',
            h : 'an hour',
            hh : '%d hours',
            d : 'a day',
            dd : '%d days',
            M : 'a month',
            MM : '%d months',
            y : 'a year',
            yy : '%d years'
        },

        relativeTime : function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },

        pastFuture : function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal : function (number) {
            return this._ordinal.replace('%d', number);
        },
        _ordinal : '%d',
        _ordinalParse : /\d{1,2}/,

        preparse : function (string) {
            return string;
        },

        postformat : function (string) {
            return string;
        },

        week : function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },

        _week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        },

        firstDayOfWeek : function () {
            return this._week.dow;
        },

        firstDayOfYear : function () {
            return this._week.doy;
        },

        _invalidDate: 'Invalid date',
        invalidDate: function () {
            return this._invalidDate;
        }
    });

    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, '');
        }
        return input.replace(/\\/g, '');
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = '';
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        if (!m.isValid()) {
            return m.localeData().invalidDate();
        }

        format = expandFormat(format, m.localeData());

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }

    function expandFormat(format, locale) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return locale.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        var a, strict = config._strict;
        switch (token) {
        case 'Q':
            return parseTokenOneDigit;
        case 'DDDD':
            return parseTokenThreeDigits;
        case 'YYYY':
        case 'GGGG':
        case 'gggg':
            return strict ? parseTokenFourDigits : parseTokenOneToFourDigits;
        case 'Y':
        case 'G':
        case 'g':
            return parseTokenSignedNumber;
        case 'YYYYYY':
        case 'YYYYY':
        case 'GGGGG':
        case 'ggggg':
            return strict ? parseTokenSixDigits : parseTokenOneToSixDigits;
        case 'S':
            if (strict) {
                return parseTokenOneDigit;
            }
            /* falls through */
        case 'SS':
            if (strict) {
                return parseTokenTwoDigits;
            }
            /* falls through */
        case 'SSS':
            if (strict) {
                return parseTokenThreeDigits;
            }
            /* falls through */
        case 'DDD':
            return parseTokenOneToThreeDigits;
        case 'MMM':
        case 'MMMM':
        case 'dd':
        case 'ddd':
        case 'dddd':
            return parseTokenWord;
        case 'a':
        case 'A':
            return config._locale._meridiemParse;
        case 'x':
            return parseTokenOffsetMs;
        case 'X':
            return parseTokenTimestampMs;
        case 'Z':
        case 'ZZ':
            return parseTokenTimezone;
        case 'T':
            return parseTokenT;
        case 'SSSS':
            return parseTokenDigits;
        case 'MM':
        case 'DD':
        case 'YY':
        case 'GG':
        case 'gg':
        case 'HH':
        case 'hh':
        case 'mm':
        case 'ss':
        case 'ww':
        case 'WW':
            return strict ? parseTokenTwoDigits : parseTokenOneOrTwoDigits;
        case 'M':
        case 'D':
        case 'd':
        case 'H':
        case 'h':
        case 'm':
        case 's':
        case 'w':
        case 'W':
        case 'e':
        case 'E':
            return parseTokenOneOrTwoDigits;
        case 'Do':
            return strict ? config._locale._ordinalParse : config._locale._ordinalParseLenient;
        default :
            a = new RegExp(regexpEscape(unescapeFormat(token.replace('\\', '')), 'i'));
            return a;
        }
    }

    function utcOffsetFromString(string) {
        string = string || '';
        var possibleTzMatches = (string.match(parseTokenTimezone) || []),
            tzChunk = possibleTzMatches[possibleTzMatches.length - 1] || [],
            parts = (tzChunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? minutes : -minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, datePartArray = config._a;

        switch (token) {
        // QUARTER
        case 'Q':
            if (input != null) {
                datePartArray[MONTH] = (toInt(input) - 1) * 3;
            }
            break;
        // MONTH
        case 'M' : // fall through to MM
        case 'MM' :
            if (input != null) {
                datePartArray[MONTH] = toInt(input) - 1;
            }
            break;
        case 'MMM' : // fall through to MMMM
        case 'MMMM' :
            a = config._locale.monthsParse(input, token, config._strict);
            // if we didn't find a month name, mark the date as invalid.
            if (a != null) {
                datePartArray[MONTH] = a;
            } else {
                config._pf.invalidMonth = input;
            }
            break;
        // DAY OF MONTH
        case 'D' : // fall through to DD
        case 'DD' :
            if (input != null) {
                datePartArray[DATE] = toInt(input);
            }
            break;
        case 'Do' :
            if (input != null) {
                datePartArray[DATE] = toInt(parseInt(
                            input.match(/\d{1,2}/)[0], 10));
            }
            break;
        // DAY OF YEAR
        case 'DDD' : // fall through to DDDD
        case 'DDDD' :
            if (input != null) {
                config._dayOfYear = toInt(input);
            }

            break;
        // YEAR
        case 'YY' :
            datePartArray[YEAR] = moment.parseTwoDigitYear(input);
            break;
        case 'YYYY' :
        case 'YYYYY' :
        case 'YYYYYY' :
            datePartArray[YEAR] = toInt(input);
            break;
        // AM / PM
        case 'a' : // fall through to A
        case 'A' :
            config._meridiem = input;
            // config._isPm = config._locale.isPM(input);
            break;
        // HOUR
        case 'h' : // fall through to hh
        case 'hh' :
            config._pf.bigHour = true;
            /* falls through */
        case 'H' : // fall through to HH
        case 'HH' :
            datePartArray[HOUR] = toInt(input);
            break;
        // MINUTE
        case 'm' : // fall through to mm
        case 'mm' :
            datePartArray[MINUTE] = toInt(input);
            break;
        // SECOND
        case 's' : // fall through to ss
        case 'ss' :
            datePartArray[SECOND] = toInt(input);
            break;
        // MILLISECOND
        case 'S' :
        case 'SS' :
        case 'SSS' :
        case 'SSSS' :
            datePartArray[MILLISECOND] = toInt(('0.' + input) * 1000);
            break;
        // UNIX OFFSET (MILLISECONDS)
        case 'x':
            config._d = new Date(toInt(input));
            break;
        // UNIX TIMESTAMP WITH MS
        case 'X':
            config._d = new Date(parseFloat(input) * 1000);
            break;
        // TIMEZONE
        case 'Z' : // fall through to ZZ
        case 'ZZ' :
            config._useUTC = true;
            config._tzm = utcOffsetFromString(input);
            break;
        // WEEKDAY - human
        case 'dd':
        case 'ddd':
        case 'dddd':
            a = config._locale.weekdaysParse(input);
            // if we didn't get a weekday name, mark the date as invalid
            if (a != null) {
                config._w = config._w || {};
                config._w['d'] = a;
            } else {
                config._pf.invalidWeekday = input;
            }
            break;
        // WEEK, WEEK DAY - numeric
        case 'w':
        case 'ww':
        case 'W':
        case 'WW':
        case 'd':
        case 'e':
        case 'E':
            token = token.substr(0, 1);
            /* falls through */
        case 'gggg':
        case 'GGGG':
        case 'GGGGG':
            token = token.substr(0, 2);
            if (input) {
                config._w = config._w || {};
                config._w[token] = toInt(input);
            }
            break;
        case 'gg':
        case 'GG':
            config._w = config._w || {};
            config._w[token] = moment.parseTwoDigitYear(input);
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = dfl(w.GG, config._a[YEAR], weekOfYear(moment(), 1, 4).year);
            week = dfl(w.W, 1);
            weekday = dfl(w.E, 1);
        } else {
            dow = config._locale._week.dow;
            doy = config._locale._week.doy;

            weekYear = dfl(w.gg, config._a[YEAR], weekOfYear(moment(), dow, doy).year);
            week = dfl(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < dow) {
                    ++week;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        temp = dayOfYearFromWeeks(weekYear, week, weekday, doy, dow);

        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromConfig(config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = dfl(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                config._pf._overflowDayOfYear = true;
            }

            date = makeUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // Check for 24:00:00.000
        if (config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0) {
            config._nextDay = true;
            config._a[HOUR] = 0;
        }

        config._d = (config._useUTC ? makeUTCDate : makeDate).apply(null, input);
        // Apply timezone offset from input. The actual utcOffset can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
        }

        if (config._nextDay) {
            config._a[HOUR] = 24;
        }
    }

    function dateFromObject(config) {
        var normalizedInput;

        if (config._d) {
            return;
        }

        normalizedInput = normalizeObjectUnits(config._i);
        config._a = [
            normalizedInput.year,
            normalizedInput.month,
            normalizedInput.day || normalizedInput.date,
            normalizedInput.hour,
            normalizedInput.minute,
            normalizedInput.second,
            normalizedInput.millisecond
        ];

        dateFromConfig(config);
    }

    function currentDateArray(config) {
        var now = new Date();
        if (config._useUTC) {
            return [
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate()
            ];
        } else {
            return [now.getFullYear(), now.getMonth(), now.getDate()];
        }
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {
        if (config._f === moment.ISO_8601) {
            parseISO(config);
            return;
        }

        config._a = [];
        config._pf.empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, config._locale).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    config._pf.unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    config._pf.empty = false;
                }
                else {
                    config._pf.unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                config._pf.unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        config._pf.charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            config._pf.unusedInput.push(string);
        }

        // clear _12h flag if hour is <= 12
        if (config._pf.bigHour === true && config._a[HOUR] <= 12) {
            config._pf.bigHour = undefined;
        }
        // handle meridiem
        config._a[HOUR] = meridiemFixWrap(config._locale, config._a[HOUR],
                config._meridiem);
        dateFromConfig(config);
        checkOverflow(config);
    }

    function unescapeFormat(s) {
        return s.replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        });
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function regexpEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            config._pf.invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = copyConfig({}, config);
            if (config._useUTC != null) {
                tempConfig._useUTC = config._useUTC;
            }
            tempConfig._pf = defaultParsingFlags();
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += tempConfig._pf.charsLeftOver;

            //or tokens
            currentScore += tempConfig._pf.unusedTokens.length * 10;

            tempConfig._pf.score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    // date from iso format
    function parseISO(config) {
        var i, l,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            config._pf.iso = true;
            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(string)) {
                    // match[5] should be 'T' or undefined
                    config._f = isoDates[i][0] + (match[6] || ' ');
                    break;
                }
            }
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (string.match(parseTokenTimezone)) {
                config._f += 'Z';
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function makeDateFromString(config) {
        parseISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            moment.createFromInputFallback(config);
        }
    }

    function map(arr, fn) {
        var res = [], i;
        for (i = 0; i < arr.length; ++i) {
            res.push(fn(arr[i], i));
        }
        return res;
    }

    function makeDateFromInput(config) {
        var input = config._i, matched;
        if (input === undefined) {
            config._d = new Date();
        } else if (isDate(input)) {
            config._d = new Date(+input);
        } else if ((matched = aspNetJsonRegex.exec(input)) !== null) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = map(input.slice(0), function (obj) {
                return parseInt(obj, 10);
            });
            dateFromConfig(config);
        } else if (typeof(input) === 'object') {
            dateFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            moment.createFromInputFallback(config);
        }
    }

    function makeDate(y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor doesn't accept years < 1970
        if (y < 1970) {
            date.setFullYear(y);
        }
        return date;
    }

    function makeUTCDate(y) {
        var date = new Date(Date.UTC.apply(null, arguments));
        if (y < 1970) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    function parseWeekday(input, locale) {
        if (typeof input === 'string') {
            if (!isNaN(input)) {
                input = parseInt(input, 10);
            }
            else {
                input = locale.weekdaysParse(input);
                if (typeof input !== 'number') {
                    return null;
                }
            }
        }
        return input;
    }

    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
        return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(posNegDuration, withoutSuffix, locale) {
        var duration = moment.duration(posNegDuration).abs(),
            seconds = round(duration.as('s')),
            minutes = round(duration.as('m')),
            hours = round(duration.as('h')),
            days = round(duration.as('d')),
            months = round(duration.as('M')),
            years = round(duration.as('y')),

            args = seconds < relativeTimeThresholds.s && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < relativeTimeThresholds.m && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < relativeTimeThresholds.h && ['hh', hours] ||
                days === 1 && ['d'] ||
                days < relativeTimeThresholds.d && ['dd', days] ||
                months === 1 && ['M'] ||
                months < relativeTimeThresholds.M && ['MM', months] ||
                years === 1 && ['y'] || ['yy', years];

        args[2] = withoutSuffix;
        args[3] = +posNegDuration > 0;
        args[4] = locale;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add(daysToDayOfWeek, 'd');
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, firstDayOfWeekOfYear, firstDayOfWeek) {
        var d = makeUTCDate(year, 0, 1).getUTCDay(), daysToAdd, dayOfYear;

        d = d === 0 ? 7 : d;
        weekday = weekday != null ? weekday : firstDayOfWeek;
        daysToAdd = firstDayOfWeek - d + (d > firstDayOfWeekOfYear ? 7 : 0) - (d < firstDayOfWeek ? 7 : 0);
        dayOfYear = 7 * (week - 1) + (weekday - firstDayOfWeek) + daysToAdd + 1;

        return {
            year: dayOfYear > 0 ? year : year - 1,
            dayOfYear: dayOfYear > 0 ?  dayOfYear : daysInYear(year - 1) + dayOfYear
        };
    }

    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f,
            res;

        config._locale = config._locale || moment.localeData(config._l);

        if (input === null || (format === undefined && input === '')) {
            return moment.invalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = config._locale.preparse(input);
        }

        if (moment.isMoment(input)) {
            return new Moment(input, true);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        res = new Moment(config);
        if (res._nextDay) {
            // Adding is smart enough around DST
            res.add(1, 'd');
            res._nextDay = undefined;
        }

        return res;
    }

    moment = function (input, format, locale, strict) {
        var c;

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._i = input;
        c._f = format;
        c._l = locale;
        c._strict = strict;
        c._isUTC = false;
        c._pf = defaultParsingFlags();

        return makeMoment(c);
    };

    moment.suppressDeprecationWarnings = false;

    moment.createFromInputFallback = deprecate(
        'moment construction falls back to js Date. This is ' +
        'discouraged and will be removed in upcoming major ' +
        'release. Please refer to ' +
        'https://github.com/moment/moment/issues/1407 for more info.',
        function (config) {
            config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return moment();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    moment.min = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    };

    moment.max = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    };

    // creating with utc
    moment.utc = function (input, format, locale, strict) {
        var c;

        if (typeof(locale) === 'boolean') {
            strict = locale;
            locale = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._useUTC = true;
        c._isUTC = true;
        c._l = locale;
        c._i = input;
        c._f = format;
        c._strict = strict;
        c._pf = defaultParsingFlags();

        return makeMoment(c).utc();
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            parseIso,
            diffRes;

        if (moment.isDuration(input)) {
            duration = {
                ms: input._milliseconds,
                d: input._days,
                M: input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetTimeSpanJsonRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            duration = {
                y: 0,
                d: toInt(match[DATE]) * sign,
                h: toInt(match[HOUR]) * sign,
                m: toInt(match[MINUTE]) * sign,
                s: toInt(match[SECOND]) * sign,
                ms: toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoDurationRegex.exec(input))) {
            sign = (match[1] === '-') ? -1 : 1;
            parseIso = function (inp) {
                // We'd normally use ~~inp for this, but unfortunately it also
                // converts floats to ints.
                // inp may be undefined, so careful calling replace on it.
                var res = inp && parseFloat(inp.replace(',', '.'));
                // apply sign while we're at it
                return (isNaN(res) ? 0 : res) * sign;
            };
            duration = {
                y: parseIso(match[2]),
                M: parseIso(match[3]),
                d: parseIso(match[4]),
                h: parseIso(match[5]),
                m: parseIso(match[6]),
                s: parseIso(match[7]),
                w: parseIso(match[8])
            };
        } else if (duration == null) {// checks for null or undefined
            duration = {};
        } else if (typeof duration === 'object' &&
                ('from' in duration || 'to' in duration)) {
            diffRes = momentsDifference(moment(duration.from), moment(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (moment.isDuration(input) && hasOwnProp(input, '_locale')) {
            ret._locale = input._locale;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // constant that refers to the ISO standard
    moment.ISO_8601 = function () {};

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    moment.momentProperties = momentProperties;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () {};

    // This function allows you to set a threshold for relative time strings
    moment.relativeTimeThreshold = function (threshold, limit) {
        if (relativeTimeThresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return relativeTimeThresholds[threshold];
        }
        relativeTimeThresholds[threshold] = limit;
        return true;
    };

    moment.lang = deprecate(
        'moment.lang is deprecated. Use moment.locale instead.',
        function (key, value) {
            return moment.locale(key, value);
        }
    );

    // This function will load locale and then set the global locale.  If
    // no arguments are passed in, it will simply return the current global
    // locale key.
    moment.locale = function (key, values) {
        var data;
        if (key) {
            if (typeof(values) !== 'undefined') {
                data = moment.defineLocale(key, values);
            }
            else {
                data = moment.localeData(key);
            }

            if (data) {
                moment.duration._locale = moment._locale = data;
            }
        }

        return moment._locale._abbr;
    };

    moment.defineLocale = function (name, values) {
        if (values !== null) {
            values.abbr = name;
            if (!locales[name]) {
                locales[name] = new Locale();
            }
            locales[name].set(values);

            // backwards compat for now: also set the locale
            moment.locale(name);

            return locales[name];
        } else {
            // useful for testing
            delete locales[name];
            return null;
        }
    };

    moment.langData = deprecate(
        'moment.langData is deprecated. Use moment.localeData instead.',
        function (key) {
            return moment.localeData(key);
        }
    );

    // returns locale data
    moment.localeData = function (key) {
        var locale;

        if (key && key._locale && key._locale._abbr) {
            key = key._locale._abbr;
        }

        if (!key) {
            return moment._locale;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            locale = loadLocale(key);
            if (locale) {
                return locale;
            }
            key = [key];
        }

        return chooseLocale(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment ||
            (obj != null && hasOwnProp(obj, '_isAMomentObject'));
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };

    for (i = lists.length - 1; i >= 0; --i) {
        makeList(lists[i]);
    }

    moment.normalizeUnits = function (units) {
        return normalizeUnits(units);
    };

    moment.invalid = function (flags) {
        var m = moment.utc(NaN);
        if (flags != null) {
            extend(m._pf, flags);
        }
        else {
            m._pf.userInvalidated = true;
        }

        return m;
    };

    moment.parseZone = function () {
        return moment.apply(null, arguments).parseZone();
    };

    moment.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    moment.isDate = isDate;

    /************************************
        Moment Prototype
    ************************************/


    extend(moment.fn = Moment.prototype, {

        clone : function () {
            return moment(this);
        },

        valueOf : function () {
            return +this._d - ((this._offset || 0) * 60000);
        },

        unix : function () {
            return Math.floor(+this / 1000);
        },

        toString : function () {
            return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
        },

        toDate : function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString : function () {
            var m = moment(this).utc();
            if (0 < m.year() && m.year() <= 9999) {
                if ('function' === typeof Date.prototype.toISOString) {
                    // native implementation is ~50x faster, use it when we can
                    return this.toDate().toISOString();
                } else {
                    return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
                }
            } else {
                return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        },

        toArray : function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid : function () {
            return isValid(this);
        },

        isDSTShifted : function () {
            if (this._a) {
                return this.isValid() && compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray()) > 0;
            }

            return false;
        },

        parsingFlags : function () {
            return extend({}, this._pf);
        },

        invalidAt: function () {
            return this._pf.overflow;
        },

        utc : function (keepLocalTime) {
            return this.utcOffset(0, keepLocalTime);
        },

        local : function (keepLocalTime) {
            if (this._isUTC) {
                this.utcOffset(0, keepLocalTime);
                this._isUTC = false;

                if (keepLocalTime) {
                    this.subtract(this._dateUtcOffset(), 'm');
                }
            }
            return this;
        },

        format : function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.localeData().postformat(output);
        },

        add : createAdder(1, 'add'),

        subtract : createAdder(-1, 'subtract'),

        diff : function (input, units, asFloat) {
            var that = makeAs(input, this),
                zoneDiff = (that.utcOffset() - this.utcOffset()) * 6e4,
                anchor, diff, output, daysAdjust;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month' || units === 'quarter') {
                output = monthDiff(this, that);
                if (units === 'quarter') {
                    output = output / 3;
                } else if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = this - that;
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? (diff - zoneDiff) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                    units === 'week' ? (diff - zoneDiff) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from : function (time, withoutSuffix) {
            return moment.duration({to: this, from: time}).locale(this.locale()).humanize(!withoutSuffix);
        },

        fromNow : function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar : function (time) {
            // We want to compare the start of today, vs this.
            // Getting start-of-today depends on whether we're locat/utc/offset
            // or not.
            var now = time || moment(),
                sod = makeAs(now, this).startOf('day'),
                diff = this.diff(sod, 'days', true),
                format = diff < -6 ? 'sameElse' :
                    diff < -1 ? 'lastWeek' :
                    diff < 0 ? 'lastDay' :
                    diff < 1 ? 'sameDay' :
                    diff < 2 ? 'nextDay' :
                    diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.localeData().calendar(format, this, moment(now)));
        },

        isLeapYear : function () {
            return isLeapYear(this.year());
        },

        isDST : function () {
            return (this.utcOffset() > this.clone().month(0).utcOffset() ||
                this.utcOffset() > this.clone().month(5).utcOffset());
        },

        day : function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                input = parseWeekday(input, this.localeData());
                return this.add(input - day, 'd');
            } else {
                return day;
            }
        },

        month : makeAccessor('Month', true),

        startOf : function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
            case 'year':
                this.month(0);
                /* falls through */
            case 'quarter':
            case 'month':
                this.date(1);
                /* falls through */
            case 'week':
            case 'isoWeek':
            case 'day':
                this.hours(0);
                /* falls through */
            case 'hour':
                this.minutes(0);
                /* falls through */
            case 'minute':
                this.seconds(0);
                /* falls through */
            case 'second':
                this.milliseconds(0);
                /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            } else if (units === 'isoWeek') {
                this.isoWeekday(1);
            }

            // quarters are also special
            if (units === 'quarter') {
                this.month(Math.floor(this.month() / 3) * 3);
            }

            return this;
        },

        endOf: function (units) {
            units = normalizeUnits(units);
            if (units === undefined || units === 'millisecond') {
                return this;
            }
            return this.startOf(units).add(1, (units === 'isoWeek' ? 'week' : units)).subtract(1, 'ms');
        },

        isAfter: function (input, units) {
            var inputMs;
            units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this > +input;
            } else {
                inputMs = moment.isMoment(input) ? +input : +moment(input);
                return inputMs < +this.clone().startOf(units);
            }
        },

        isBefore: function (input, units) {
            var inputMs;
            units = normalizeUnits(typeof units !== 'undefined' ? units : 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this < +input;
            } else {
                inputMs = moment.isMoment(input) ? +input : +moment(input);
                return +this.clone().endOf(units) < inputMs;
            }
        },

        isBetween: function (from, to, units) {
            return this.isAfter(from, units) && this.isBefore(to, units);
        },

        isSame: function (input, units) {
            var inputMs;
            units = normalizeUnits(units || 'millisecond');
            if (units === 'millisecond') {
                input = moment.isMoment(input) ? input : moment(input);
                return +this === +input;
            } else {
                inputMs = +moment(input);
                return +(this.clone().startOf(units)) <= inputMs && inputMs <= +(this.clone().endOf(units));
            }
        },

        min: deprecate(
                 'moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548',
                 function (other) {
                     other = moment.apply(null, arguments);
                     return other < this ? this : other;
                 }
         ),

        max: deprecate(
                'moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548',
                function (other) {
                    other = moment.apply(null, arguments);
                    return other > this ? this : other;
                }
        ),

        zone : deprecate(
                'moment().zone is deprecated, use moment().utcOffset instead. ' +
                'https://github.com/moment/moment/issues/1779',
                function (input, keepLocalTime) {
                    if (input != null) {
                        if (typeof input !== 'string') {
                            input = -input;
                        }

                        this.utcOffset(input, keepLocalTime);

                        return this;
                    } else {
                        return -this.utcOffset();
                    }
                }
        ),

        // keepLocalTime = true means only change the timezone, without
        // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
        // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
        // +0200, so we adjust the time as needed, to be valid.
        //
        // Keeping the time actually adds/subtracts (one hour)
        // from the actual represented time. That is why we call updateOffset
        // a second time. In case it wants us to change the offset again
        // _changeInProgress == true case, then we have to adjust, because
        // there is no such time in the given timezone.
        utcOffset : function (input, keepLocalTime) {
            var offset = this._offset || 0,
                localAdjust;
            if (input != null) {
                if (typeof input === 'string') {
                    input = utcOffsetFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                if (!this._isUTC && keepLocalTime) {
                    localAdjust = this._dateUtcOffset();
                }
                this._offset = input;
                this._isUTC = true;
                if (localAdjust != null) {
                    this.add(localAdjust, 'm');
                }
                if (offset !== input) {
                    if (!keepLocalTime || this._changeInProgress) {
                        addOrSubtractDurationFromMoment(this,
                                moment.duration(input - offset, 'm'), 1, false);
                    } else if (!this._changeInProgress) {
                        this._changeInProgress = true;
                        moment.updateOffset(this, true);
                        this._changeInProgress = null;
                    }
                }

                return this;
            } else {
                return this._isUTC ? offset : this._dateUtcOffset();
            }
        },

        isLocal : function () {
            return !this._isUTC;
        },

        isUtcOffset : function () {
            return this._isUTC;
        },

        isUtc : function () {
            return this._isUTC && this._offset === 0;
        },

        zoneAbbr : function () {
            return this._isUTC ? 'UTC' : '';
        },

        zoneName : function () {
            return this._isUTC ? 'Coordinated Universal Time' : '';
        },

        parseZone : function () {
            if (this._tzm) {
                this.utcOffset(this._tzm);
            } else if (typeof this._i === 'string') {
                this.utcOffset(utcOffsetFromString(this._i));
            }
            return this;
        },

        hasAlignedHourOffset : function (input) {
            if (!input) {
                input = 0;
            }
            else {
                input = moment(input).utcOffset();
            }

            return (this.utcOffset() - input) % 60 === 0;
        },

        daysInMonth : function () {
            return daysInMonth(this.year(), this.month());
        },

        dayOfYear : function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add((input - dayOfYear), 'd');
        },

        quarter : function (input) {
            return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
        },

        weekYear : function (input) {
            var year = weekOfYear(this, this.localeData()._week.dow, this.localeData()._week.doy).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        isoWeekYear : function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add((input - year), 'y');
        },

        week : function (input) {
            var week = this.localeData().week(this);
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        isoWeek : function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add((input - week) * 7, 'd');
        },

        weekday : function (input) {
            var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
            return input == null ? weekday : this.add(input - weekday, 'd');
        },

        isoWeekday : function (input) {
            // behaves the same as moment#day except
            // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
            // as a setter, sunday should belong to the previous week.
            return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
        },

        isoWeeksInYear : function () {
            return weeksInYear(this.year(), 1, 4);
        },

        weeksInYear : function () {
            var weekInfo = this.localeData()._week;
            return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units]();
        },

        set : function (units, value) {
            var unit;
            if (typeof units === 'object') {
                for (unit in units) {
                    this.set(unit, units[unit]);
                }
            }
            else {
                units = normalizeUnits(units);
                if (typeof this[units] === 'function') {
                    this[units](value);
                }
            }
            return this;
        },

        // If passed a locale key, it will set the locale for this
        // instance.  Otherwise, it will return the locale configuration
        // variables for this instance.
        locale : function (key) {
            var newLocaleData;

            if (key === undefined) {
                return this._locale._abbr;
            } else {
                newLocaleData = moment.localeData(key);
                if (newLocaleData != null) {
                    this._locale = newLocaleData;
                }
                return this;
            }
        },

        lang : deprecate(
            'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
            function (key) {
                if (key === undefined) {
                    return this.localeData();
                } else {
                    return this.locale(key);
                }
            }
        ),

        localeData : function () {
            return this._locale;
        },

        _dateUtcOffset : function () {
            // On Firefox.24 Date#getTimezoneOffset returns a floating point.
            // https://github.com/moment/moment/pull/1871
            return -Math.round(this._d.getTimezoneOffset() / 15) * 15;
        }

    });

    function rawMonthSetter(mom, value) {
        var dayOfMonth;

        // TODO: Move this out of here!
        if (typeof value === 'string') {
            value = mom.localeData().monthsParse(value);
            // TODO: Another silent failure?
            if (typeof value !== 'number') {
                return mom;
            }
        }

        dayOfMonth = Math.min(mom.date(),
                daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function rawGetter(mom, unit) {
        return mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]();
    }

    function rawSetter(mom, unit, value) {
        if (unit === 'Month') {
            return rawMonthSetter(mom, value);
        } else {
            return mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    function makeAccessor(unit, keepTime) {
        return function (value) {
            if (value != null) {
                rawSetter(this, unit, value);
                moment.updateOffset(this, keepTime);
                return this;
            } else {
                return rawGetter(this, unit);
            }
        };
    }

    moment.fn.millisecond = moment.fn.milliseconds = makeAccessor('Milliseconds', false);
    moment.fn.second = moment.fn.seconds = makeAccessor('Seconds', false);
    moment.fn.minute = moment.fn.minutes = makeAccessor('Minutes', false);
    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    moment.fn.hour = moment.fn.hours = makeAccessor('Hours', true);
    // moment.fn.month is defined separately
    moment.fn.date = makeAccessor('Date', true);
    moment.fn.dates = deprecate('dates accessor is deprecated. Use date instead.', makeAccessor('Date', true));
    moment.fn.year = makeAccessor('FullYear', true);
    moment.fn.years = deprecate('years accessor is deprecated. Use year instead.', makeAccessor('FullYear', true));

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;
    moment.fn.quarters = moment.fn.quarter;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    // alias isUtc for dev-friendliness
    moment.fn.isUTC = moment.fn.isUtc;

    /************************************
        Duration Prototype
    ************************************/


    function daysToYears (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        return days * 400 / 146097;
    }

    function yearsToDays (years) {
        // years * 365 + absRound(years / 4) -
        //     absRound(years / 100) + absRound(years / 400);
        return years * 146097 / 400;
    }

    extend(moment.duration.fn = Duration.prototype, {

        _bubble : function () {
            var milliseconds = this._milliseconds,
                days = this._days,
                months = this._months,
                data = this._data,
                seconds, minutes, hours, years = 0;

            // The following code bubbles up values, see the tests for
            // examples of what that means.
            data.milliseconds = milliseconds % 1000;

            seconds = absRound(milliseconds / 1000);
            data.seconds = seconds % 60;

            minutes = absRound(seconds / 60);
            data.minutes = minutes % 60;

            hours = absRound(minutes / 60);
            data.hours = hours % 24;

            days += absRound(hours / 24);

            // Accurately convert days to years, assume start from year 0.
            years = absRound(daysToYears(days));
            days -= absRound(yearsToDays(years));

            // 30 days to a month
            // TODO (iskren): Use anchor date (like 1st Jan) to compute this.
            months += absRound(days / 30);
            days %= 30;

            // 12 months -> 1 year
            years += absRound(months / 12);
            months %= 12;

            data.days = days;
            data.months = months;
            data.years = years;
        },

        abs : function () {
            this._milliseconds = Math.abs(this._milliseconds);
            this._days = Math.abs(this._days);
            this._months = Math.abs(this._months);

            this._data.milliseconds = Math.abs(this._data.milliseconds);
            this._data.seconds = Math.abs(this._data.seconds);
            this._data.minutes = Math.abs(this._data.minutes);
            this._data.hours = Math.abs(this._data.hours);
            this._data.months = Math.abs(this._data.months);
            this._data.years = Math.abs(this._data.years);

            return this;
        },

        weeks : function () {
            return absRound(this.days() / 7);
        },

        valueOf : function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              toInt(this._months / 12) * 31536e6;
        },

        humanize : function (withSuffix) {
            var output = relativeTime(this, !withSuffix, this.localeData());

            if (withSuffix) {
                output = this.localeData().pastFuture(+this, output);
            }

            return this.localeData().postformat(output);
        },

        add : function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            this._bubble();

            return this;
        },

        subtract : function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            this._bubble();

            return this;
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as : function (units) {
            var days, months;
            units = normalizeUnits(units);

            if (units === 'month' || units === 'year') {
                days = this._days + this._milliseconds / 864e5;
                months = this._months + daysToYears(days) * 12;
                return units === 'month' ? months : months / 12;
            } else {
                // handle milliseconds separately because of floating point math errors (issue #1867)
                days = this._days + Math.round(yearsToDays(this._months / 12));
                switch (units) {
                    case 'week': return days / 7 + this._milliseconds / 6048e5;
                    case 'day': return days + this._milliseconds / 864e5;
                    case 'hour': return days * 24 + this._milliseconds / 36e5;
                    case 'minute': return days * 24 * 60 + this._milliseconds / 6e4;
                    case 'second': return days * 24 * 60 * 60 + this._milliseconds / 1000;
                    // Math.floor prevents floating point math errors here
                    case 'millisecond': return Math.floor(days * 24 * 60 * 60 * 1000) + this._milliseconds;
                    default: throw new Error('Unknown unit ' + units);
                }
            }
        },

        lang : moment.fn.lang,
        locale : moment.fn.locale,

        toIsoString : deprecate(
            'toIsoString() is deprecated. Please use toISOString() instead ' +
            '(notice the capitals)',
            function () {
                return this.toISOString();
            }
        ),

        toISOString : function () {
            // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
            var years = Math.abs(this.years()),
                months = Math.abs(this.months()),
                days = Math.abs(this.days()),
                hours = Math.abs(this.hours()),
                minutes = Math.abs(this.minutes()),
                seconds = Math.abs(this.seconds() + this.milliseconds() / 1000);

            if (!this.asSeconds()) {
                // this is the same as C#'s (Noda) and python (isodate)...
                // but not other JS (goog.date)
                return 'P0D';
            }

            return (this.asSeconds() < 0 ? '-' : '') +
                'P' +
                (years ? years + 'Y' : '') +
                (months ? months + 'M' : '') +
                (days ? days + 'D' : '') +
                ((hours || minutes || seconds) ? 'T' : '') +
                (hours ? hours + 'H' : '') +
                (minutes ? minutes + 'M' : '') +
                (seconds ? seconds + 'S' : '');
        },

        localeData : function () {
            return this._locale;
        },

        toJSON : function () {
            return this.toISOString();
        }
    });

    moment.duration.fn.toString = moment.duration.fn.toISOString;

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    for (i in unitMillisecondFactors) {
        if (hasOwnProp(unitMillisecondFactors, i)) {
            makeDurationGetter(i.toLowerCase());
        }
    }

    moment.duration.fn.asMilliseconds = function () {
        return this.as('ms');
    };
    moment.duration.fn.asSeconds = function () {
        return this.as('s');
    };
    moment.duration.fn.asMinutes = function () {
        return this.as('m');
    };
    moment.duration.fn.asHours = function () {
        return this.as('h');
    };
    moment.duration.fn.asDays = function () {
        return this.as('d');
    };
    moment.duration.fn.asWeeks = function () {
        return this.as('weeks');
    };
    moment.duration.fn.asMonths = function () {
        return this.as('M');
    };
    moment.duration.fn.asYears = function () {
        return this.as('y');
    };

    /************************************
        Default Locale
    ************************************/


    // Set default locale, other locale will inherit from English.
    moment.locale('en', {
        ordinalParse: /\d{1,2}(th|st|nd|rd)/,
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    /* EMBED_LOCALES */

    /************************************
        Exposing Moment
    ************************************/

    function makeGlobal(shouldDeprecate) {
        /*global ender:false */
        if (typeof ender !== 'undefined') {
            return;
        }
        oldGlobalMoment = globalScope.moment;
        if (shouldDeprecate) {
            globalScope.moment = deprecate(
                    'Accessing Moment through the global scope is ' +
                    'deprecated, and will be removed in an upcoming ' +
                    'release.',
                    moment);
        } else {
            globalScope.moment = moment;
        }
    }

    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    } else if (typeof define === 'function' && define.amd) {
        define(function (_dereq_, exports, module) {
            if (module.config && module.config() && module.config().noGlobal === true) {
                // release the global variable
                globalScope.moment = oldGlobalMoment;
            }

            return moment;
        });
        makeGlobal(true);
    } else {
        makeGlobal();
    }
}).call(this);

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],55:[function(_dereq_,module,exports){
(function (process){
// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2017 Kris Kowal under the terms of the MIT
 * license found at https://github.com/kriskowal/q/blob/v1/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    "use strict";

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object" && typeof module === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else if (typeof window !== "undefined" || typeof self !== "undefined") {
        // Prefer window over self for add-on scripts. Use self for
        // non-windowed contexts.
        var global = typeof window !== "undefined" ? window : self;

        // Get the `window` object, save the previous Q global
        // and initialize Q as a global.
        var previousQ = global.Q;
        global.Q = definition();

        // Add a noConflict function so Q can be removed from the
        // global namespace.
        global.Q.noConflict = function () {
            global.Q = previousQ;
            return this;
        };

    } else {
        throw new Error("This environment was not anticipated by Q. Please file a bug.");
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;
    // queue for late tasks, used by unhandled rejection tracking
    var laterQueue = [];

    function flush() {
        /* jshint loopfunc: true */
        var task, domain;

        while (head.next) {
            head = head.next;
            task = head.task;
            head.task = void 0;
            domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }
            runSingle(task, domain);

        }
        while (laterQueue.length) {
            task = laterQueue.pop();
            runSingle(task);
        }
        flushing = false;
    }
    // runs a single function in the async queue
    function runSingle(task, domain) {
        try {
            task();

        } catch (e) {
            if (isNodeJS) {
                // In node, uncaught exceptions are considered fatal errors.
                // Re-throw them synchronously to interrupt flushing!

                // Ensure continuation if the uncaught exception is suppressed
                // listening "uncaughtException" events (as domains does).
                // Continue in next event to avoid tick recursion.
                if (domain) {
                    domain.exit();
                }
                setTimeout(flush, 0);
                if (domain) {
                    domain.enter();
                }

                throw e;

            } else {
                // In browsers, uncaught exceptions are not fatal.
                // Re-throw them asynchronously to avoid slow-downs.
                setTimeout(function () {
                    throw e;
                }, 0);
            }
        }

        if (domain) {
            domain.exit();
        }
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process === "object" &&
        process.toString() === "[object process]" && process.nextTick) {
        // Ensure Q is in a real Node environment, with a `process.nextTick`.
        // To see through fake Node environments:
        // * Mocha test runner - exposes a `process` global without a `nextTick`
        // * Browserify - exposes a `process.nexTick` function that uses
        //   `setTimeout`. In this case `setImmediate` is preferred because
        //    it is faster. Browserify's `process.toString()` yields
        //   "[object Object]", while in a real Node environment
        //   `process.toString()` yields "[object process]".
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }
    // runs a task after all other tasks have been run
    // this is useful for unhandled rejection tracking that needs to happen
    // after all `then`d tasks have been run.
    nextTick.runAfter = function (task) {
        laterQueue.push(task);
        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };
    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_defineProperty = Object.defineProperty || function (obj, prop, descriptor) {
    obj[prop] = descriptor.value;
    return obj;
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack && (!error.__minimumStackCounter__ || error.__minimumStackCounter__ > p.stackCounter)) {
                object_defineProperty(error, "__minimumStackCounter__", {value: p.stackCounter, configurable: true});
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        var stack = filterStackString(concatedStacks);
        object_defineProperty(error, "stack", {value: stack, configurable: true});
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (value instanceof Promise) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

/**
 * The counter is used to determine the stopping point for building
 * long stack traces. In makeStackTraceLong we walk backwards through
 * the linked list of promises, only stacks which were created before
 * the rejection are concatenated.
 */
var longStackCounter = 1;

// enable long stacks if Q_DEBUG is set
if (typeof process === "object" && process && process.env && process.env.Q_DEBUG) {
    Q.longStackSupport = true;
}

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            Q.nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
            promise.stackCounter = longStackCounter++;
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;

        if (Q.longStackSupport && hasStacks) {
            // Only hold a reference to the new promise if long stacks
            // are enabled to reduce memory usage
            promise.source = newPromise;
        }

        array_reduce(messages, function (undefined, message) {
            Q.nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            Q.nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Q can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become settled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be settled
 */
Q.race = race;
function race(answerPs) {
    return promise(function (resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function (answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    Q.nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

Q.tap = function (promise, callback) {
    return Q(promise).tap(callback);
};

/**
 * Works almost like "finally", but not called for rejections.
 * Original resolution value is passed through callback unaffected.
 * Callback may return a promise that will be awaited for.
 * @param {Function} callback
 * @returns {Q.Promise}
 * @example
 * doSomething()
 *   .then(...)
 *   .tap(console.log)
 *   .then(...);
 */
Promise.prototype.tap = function (callback) {
    callback = Q(callback);

    return this.then(function (value) {
        return callback.fcall(value).thenResolve(value);
    });
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return object instanceof Promise;
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var reportedUnhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }
    if (typeof process === "object" && typeof process.emit === "function") {
        Q.nextTick.runAfter(function () {
            if (array_indexOf(unhandledRejections, promise) !== -1) {
                process.emit("unhandledRejection", reason, promise);
                reportedUnhandledRejections.push(promise);
            }
        });
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        if (typeof process === "object" && typeof process.emit === "function") {
            Q.nextTick.runAfter(function () {
                var atReport = array_indexOf(reportedUnhandledRejections, promise);
                if (atReport !== -1) {
                    process.emit("rejectionHandled", unhandledReasons[at], promise);
                    reportedUnhandledRejections.splice(atReport, 1);
                }
            });
        }
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    Q.nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return Q(result.value);
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return Q(exception.value);
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    Q.nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var pendingCount = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++pendingCount;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--pendingCount === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (pendingCount === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Returns the first resolved promise of an array. Prior rejected promises are
 * ignored.  Rejects only if all promises are rejected.
 * @param {Array*} an array containing values or promises for values
 * @returns a promise fulfilled with the value of the first resolved promise,
 * or a rejected promise if all promises are rejected.
 */
Q.any = any;

function any(promises) {
    if (promises.length === 0) {
        return Q.resolve();
    }

    var deferred = Q.defer();
    var pendingCount = 0;
    array_reduce(promises, function (prev, current, index) {
        var promise = promises[index];

        pendingCount++;

        when(promise, onFulfilled, onRejected, onProgress);
        function onFulfilled(result) {
            deferred.resolve(result);
        }
        function onRejected(err) {
            pendingCount--;
            if (pendingCount === 0) {
                var rejection = err || new Error("" + err);

                rejection.message = ("Q can't get fulfillment value from any promise, all " +
                    "promises were rejected. Last error message: " + rejection.message);

                deferred.reject(rejection);
            }
        }
        function onProgress(progress) {
            deferred.notify({
                index: index,
                value: progress
            });
        }
    }, undefined);

    return deferred.promise;
}

Promise.prototype.any = function () {
    return any(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    if (!callback || typeof callback.apply !== "function") {
        throw new Error("Q can't apply finally callback");
    }
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        Q.nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {Any*} custom error message or Error object (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, error) {
    return Q(object).timeout(ms, error);
};

Promise.prototype.timeout = function (ms, error) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        if (!error || "string" === typeof error) {
            error = new Error(error || "Timed out after " + ms + " ms");
            error.code = "ETIMEDOUT";
        }
        deferred.reject(error);
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    if (callback === undefined) {
        throw new Error("Q can't wrap an undefined function");
    }
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            Q.nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            Q.nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

Q.noConflict = function() {
    throw new Error("Q.noConflict only works when Q is used as a global");
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});

}).call(this,_dereq_("FWaASH"))
},{"FWaASH":49}],56:[function(_dereq_,module,exports){
/**
 * Module dependencies.
 */

var Emitter = _dereq_('emitter');
var reduce = _dereq_('reduce');

/**
 * Root reference for iframes.
 */

var root;
if (typeof window !== 'undefined') { // Browser window
  root = window;
} else if (typeof self !== 'undefined') { // Web Worker
  root = self;
} else { // Other environments
  root = this;
}

/**
 * Noop.
 */

function noop(){};

/**
 * Check if `obj` is a host object,
 * we don't want to serialize these :)
 *
 * TODO: future proof, move to compoent land
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isHost(obj) {
  var str = {}.toString.call(obj);

  switch (str) {
    case '[object File]':
    case '[object Blob]':
    case '[object FormData]':
      return true;
    default:
      return false;
  }
}

/**
 * Determine XHR.
 */

request.getXHR = function () {
  if (root.XMLHttpRequest
      && (!root.location || 'file:' != root.location.protocol
          || !root.ActiveXObject)) {
    return new XMLHttpRequest;
  } else {
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
  }
  return false;
};

/**
 * Removes leading and trailing whitespace, added to support IE.
 *
 * @param {String} s
 * @return {String}
 * @api private
 */

var trim = ''.trim
  ? function(s) { return s.trim(); }
  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
  return obj === Object(obj);
}

/**
 * Serialize the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function serialize(obj) {
  if (!isObject(obj)) return obj;
  var pairs = [];
  for (var key in obj) {
    if (null != obj[key]) {
      pairs.push(encodeURIComponent(key)
        + '=' + encodeURIComponent(obj[key]));
    }
  }
  return pairs.join('&');
}

/**
 * Expose serialization method.
 */

 request.serializeObject = serialize;

 /**
  * Parse the given x-www-form-urlencoded `str`.
  *
  * @param {String} str
  * @return {Object}
  * @api private
  */

function parseString(str) {
  var obj = {};
  var pairs = str.split('&');
  var parts;
  var pair;

  for (var i = 0, len = pairs.length; i < len; ++i) {
    pair = pairs[i];
    parts = pair.split('=');
    obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
  }

  return obj;
}

/**
 * Expose parser.
 */

request.parseString = parseString;

/**
 * Default MIME type map.
 *
 *     superagent.types.xml = 'application/xml';
 *
 */

request.types = {
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  urlencoded: 'application/x-www-form-urlencoded',
  'form': 'application/x-www-form-urlencoded',
  'form-data': 'application/x-www-form-urlencoded'
};

/**
 * Default serialization map.
 *
 *     superagent.serialize['application/xml'] = function(obj){
 *       return 'generated xml here';
 *     };
 *
 */

 request.serialize = {
   'application/x-www-form-urlencoded': serialize,
   'application/json': JSON.stringify
 };

 /**
  * Default parsers.
  *
  *     superagent.parse['application/xml'] = function(str){
  *       return { object parsed from str };
  *     };
  *
  */

request.parse = {
  'application/x-www-form-urlencoded': parseString,
  'application/json': JSON.parse
};

/**
 * Parse the given header `str` into
 * an object containing the mapped fields.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseHeader(str) {
  var lines = str.split(/\r?\n/);
  var fields = {};
  var index;
  var line;
  var field;
  var val;

  lines.pop(); // trailing CRLF

  for (var i = 0, len = lines.length; i < len; ++i) {
    line = lines[i];
    index = line.indexOf(':');
    field = line.slice(0, index).toLowerCase();
    val = trim(line.slice(index + 1));
    fields[field] = val;
  }

  return fields;
}

/**
 * Return the mime type for the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function type(str){
  return str.split(/ *; */).shift();
};

/**
 * Return header field parameters.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function params(str){
  return reduce(str.split(/ *; */), function(obj, str){
    var parts = str.split(/ *= */)
      , key = parts.shift()
      , val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
};

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * Examples:
 *
 *  Aliasing `superagent` as `request` is nice:
 *
 *      request = superagent;
 *
 *  We can use the promise-like API, or pass callbacks:
 *
 *      request.get('/').end(function(res){});
 *      request.get('/', function(res){});
 *
 *  Sending data can be chained:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' })
 *        .end(function(res){});
 *
 *  Or passed to `.send()`:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' }, function(res){});
 *
 *  Or passed to `.post()`:
 *
 *      request
 *        .post('/user', { name: 'tj' })
 *        .end(function(res){});
 *
 * Or further reduced to a single call for simple cases:
 *
 *      request
 *        .post('/user', { name: 'tj' }, function(res){});
 *
 * @param {XMLHTTPRequest} xhr
 * @param {Object} options
 * @api private
 */

function Response(req, options) {
  options = options || {};
  this.req = req;
  this.xhr = this.req.xhr;
  // responseText is accessible only if responseType is '' or 'text' and on older browsers
  this.text = ((this.req.method !='HEAD' && (this.xhr.responseType === '' || this.xhr.responseType === 'text')) || typeof this.xhr.responseType === 'undefined')
     ? this.xhr.responseText
     : null;
  this.statusText = this.req.xhr.statusText;
  this.setStatusProperties(this.xhr.status);
  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
  // getResponseHeader still works. so we get content-type even if getting
  // other headers fails.
  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
  this.setHeaderProperties(this.header);
  this.body = this.req.method != 'HEAD'
    ? this.parseBody(this.text ? this.text : this.xhr.response)
    : null;
}

/**
 * Get case-insensitive `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Response.prototype.get = function(field){
  return this.header[field.toLowerCase()];
};

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype.setHeaderProperties = function(header){
  // content-type
  var ct = this.header['content-type'] || '';
  this.type = type(ct);

  // params
  var obj = params(ct);
  for (var key in obj) this[key] = obj[key];
};

/**
 * Force given parser
 * 
 * Sets the body parser no matter type.
 * 
 * @param {Function}
 * @api public
 */

Response.prototype.parse = function(fn){
  this.parser = fn;
  return this;
};

/**
 * Parse the given body `str`.
 *
 * Used for auto-parsing of bodies. Parsers
 * are defined on the `superagent.parse` object.
 *
 * @param {String} str
 * @return {Mixed}
 * @api private
 */

Response.prototype.parseBody = function(str){
  var parse = this.parser || request.parse[this.type];
  return parse && str && (str.length || str instanceof Object)
    ? parse(str)
    : null;
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype.setStatusProperties = function(status){
  // handle IE9 bug: http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
  if (status === 1223) {
    status = 204;
  }

  var type = status / 100 | 0;

  // status / class
  this.status = this.statusCode = status;
  this.statusType = type;

  // basics
  this.info = 1 == type;
  this.ok = 2 == type;
  this.clientError = 4 == type;
  this.serverError = 5 == type;
  this.error = (4 == type || 5 == type)
    ? this.toError()
    : false;

  // sugar
  this.accepted = 202 == status;
  this.noContent = 204 == status;
  this.badRequest = 400 == status;
  this.unauthorized = 401 == status;
  this.notAcceptable = 406 == status;
  this.notFound = 404 == status;
  this.forbidden = 403 == status;
};

/**
 * Return an `Error` representative of this response.
 *
 * @return {Error}
 * @api public
 */

Response.prototype.toError = function(){
  var req = this.req;
  var method = req.method;
  var url = req.url;

  var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
  var err = new Error(msg);
  err.status = this.status;
  err.method = method;
  err.url = url;

  return err;
};

/**
 * Expose `Response`.
 */

request.Response = Response;

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String} url
 * @api public
 */

function Request(method, url) {
  var self = this;
  Emitter.call(this);
  this._query = this._query || [];
  this.method = method;
  this.url = url;
  this.header = {};
  this._header = {};
  this.on('end', function(){
    var err = null;
    var res = null;

    try {
      res = new Response(self);
    } catch(e) {
      err = new Error('Parser is unable to parse the response');
      err.parse = true;
      err.original = e;
      return self.callback(err);
    }

    self.emit('response', res);

    if (err) {
      return self.callback(err, res);
    }

    if (res.status >= 200 && res.status < 300) {
      return self.callback(err, res);
    }

    var new_err = new Error(res.statusText || 'Unsuccessful HTTP response');
    new_err.original = err;
    new_err.response = res;
    new_err.status = res.status;

    self.callback(new_err, res);
  });
}

/**
 * Mixin `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Allow for extension
 */

Request.prototype.use = function(fn) {
  fn(this);
  return this;
}

/**
 * Set timeout to `ms`.
 *
 * @param {Number} ms
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.timeout = function(ms){
  this._timeout = ms;
  return this;
};

/**
 * Clear previous timeout.
 *
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.clearTimeout = function(){
  this._timeout = 0;
  clearTimeout(this._timer);
  return this;
};

/**
 * Abort the request, and clear potential timeout.
 *
 * @return {Request}
 * @api public
 */

Request.prototype.abort = function(){
  if (this.aborted) return;
  this.aborted = true;
  this.xhr.abort();
  this.clearTimeout();
  this.emit('abort');
  return this;
};

/**
 * Set header `field` to `val`, or multiple fields with one object.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.set = function(field, val){
  if (isObject(field)) {
    for (var key in field) {
      this.set(key, field[key]);
    }
    return this;
  }
  this._header[field.toLowerCase()] = val;
  this.header[field] = val;
  return this;
};

/**
 * Remove header `field`.
 *
 * Example:
 *
 *      req.get('/')
 *        .unset('User-Agent')
 *        .end(callback);
 *
 * @param {String} field
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.unset = function(field){
  delete this._header[field.toLowerCase()];
  delete this.header[field];
  return this;
};

/**
 * Get case-insensitive header `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api private
 */

Request.prototype.getHeader = function(field){
  return this._header[field.toLowerCase()];
};

/**
 * Set Content-Type to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.xml = 'application/xml';
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
  this.set('Content-Type', request.types[type] || type);
  return this;
};

/**
 * Set Accept to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.json = 'application/json';
 *
 *      request.get('/agent')
 *        .accept('json')
 *        .end(callback);
 *
 *      request.get('/agent')
 *        .accept('application/json')
 *        .end(callback);
 *
 * @param {String} accept
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.accept = function(type){
  this.set('Accept', request.types[type] || type);
  return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass){
  var str = btoa(user + ':' + pass);
  this.set('Authorization', 'Basic ' + str);
  return this;
};

/**
* Add query-string `val`.
*
* Examples:
*
*   request.get('/shoes')
*     .query('size=10')
*     .query({ color: 'blue' })
*
* @param {Object|String} val
* @return {Request} for chaining
* @api public
*/

Request.prototype.query = function(val){
  if ('string' != typeof val) val = serialize(val);
  if (val) this._query.push(val);
  return this;
};

/**
 * Write the field `name` and `val` for "multipart/form-data"
 * request bodies.
 *
 * ``` js
 * request.post('/upload')
 *   .field('foo', 'bar')
 *   .end(callback);
 * ```
 *
 * @param {String} name
 * @param {String|Blob|File} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.field = function(name, val){
  if (!this._formData) this._formData = new root.FormData();
  this._formData.append(name, val);
  return this;
};

/**
 * Queue the given `file` as an attachment to the specified `field`,
 * with optional `filename`.
 *
 * ``` js
 * request.post('/upload')
 *   .attach(new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
 *   .end(callback);
 * ```
 *
 * @param {String} field
 * @param {Blob|File} file
 * @param {String} filename
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.attach = function(field, file, filename){
  if (!this._formData) this._formData = new root.FormData();
  this._formData.append(field, file, filename);
  return this;
};

/**
 * Send `data`, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // querystring
 *       request.get('/search')
 *         .end(callback)
 *
 *       // multiple data "writes"
 *       request.get('/search')
 *         .send({ search: 'query' })
 *         .send({ range: '1..5' })
 *         .send({ order: 'desc' })
 *         .end(callback)
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"})
 *         .end(callback)
 *
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // defaults to x-www-form-urlencoded
  *      request.post('/user')
  *        .send('name=tobi')
  *        .send('species=ferret')
  *        .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.send = function(data){
  var obj = isObject(data);
  var type = this.getHeader('Content-Type');

  // merge
  if (obj && isObject(this._data)) {
    for (var key in data) {
      this._data[key] = data[key];
    }
  } else if ('string' == typeof data) {
    if (!type) this.type('form');
    type = this.getHeader('Content-Type');
    if ('application/x-www-form-urlencoded' == type) {
      this._data = this._data
        ? this._data + '&' + data
        : data;
    } else {
      this._data = (this._data || '') + data;
    }
  } else {
    this._data = data;
  }

  if (!obj || isHost(data)) return this;
  if (!type) this.type('json');
  return this;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
  var fn = this._callback;
  this.clearTimeout();
  fn(err, res);
};

/**
 * Invoke callback with x-domain error.
 *
 * @api private
 */

Request.prototype.crossDomainError = function(){
  var err = new Error('Origin is not allowed by Access-Control-Allow-Origin');
  err.crossDomain = true;
  this.callback(err);
};

/**
 * Invoke callback with timeout error.
 *
 * @api private
 */

Request.prototype.timeoutError = function(){
  var timeout = this._timeout;
  var err = new Error('timeout of ' + timeout + 'ms exceeded');
  err.timeout = timeout;
  this.callback(err);
};

/**
 * Enable transmission of cookies with x-domain requests.
 *
 * Note that for this to work the origin must not be
 * using "Access-Control-Allow-Origin" with a wildcard,
 * and also must set "Access-Control-Allow-Credentials"
 * to "true".
 *
 * @api public
 */

Request.prototype.withCredentials = function(){
  this._withCredentials = true;
  return this;
};

/**
 * Initiate request, invoking callback `fn(res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
  var self = this;
  var xhr = this.xhr = request.getXHR();
  var query = this._query.join('&');
  var timeout = this._timeout;
  var data = this._formData || this._data;

  // store callback
  this._callback = fn || noop;

  // state change
  xhr.onreadystatechange = function(){
    if (4 != xhr.readyState) return;

    // In IE9, reads to any property (e.g. status) off of an aborted XHR will
    // result in the error "Could not complete the operation due to error c00c023f"
    var status;
    try { status = xhr.status } catch(e) { status = 0; }

    if (0 == status) {
      if (self.timedout) return self.timeoutError();
      if (self.aborted) return;
      return self.crossDomainError();
    }
    self.emit('end');
  };

  // progress
  var handleProgress = function(e){
    if (e.total > 0) {
      e.percent = e.loaded / e.total * 100;
    }
    self.emit('progress', e);
  };
  if (this.hasListeners('progress')) {
    xhr.onprogress = handleProgress;
  }
  try {
    if (xhr.upload && this.hasListeners('progress')) {
      xhr.upload.onprogress = handleProgress;
    }
  } catch(e) {
    // Accessing xhr.upload fails in IE from a web worker, so just pretend it doesn't exist.
    // Reported here:
    // https://connect.microsoft.com/IE/feedback/details/837245/xmlhttprequest-upload-throws-invalid-argument-when-used-from-web-worker-context
  }

  // timeout
  if (timeout && !this._timer) {
    this._timer = setTimeout(function(){
      self.timedout = true;
      self.abort();
    }, timeout);
  }

  // querystring
  if (query) {
    query = request.serializeObject(query);
    this.url += ~this.url.indexOf('?')
      ? '&' + query
      : '?' + query;
  }

  // initiate request
  xhr.open(this.method, this.url, true);

  // CORS
  if (this._withCredentials) xhr.withCredentials = true;

  // body
  if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
    // serialize stuff
    var contentType = this.getHeader('Content-Type');
    var serialize = request.serialize[contentType ? contentType.split(';')[0] : ''];
    if (serialize) data = serialize(data);
  }

  // set header fields
  for (var field in this.header) {
    if (null == this.header[field]) continue;
    xhr.setRequestHeader(field, this.header[field]);
  }

  // send stuff
  this.emit('request', this);
  xhr.send(data);
  return this;
};

/**
 * Faux promise support
 *
 * @param {Function} fulfill
 * @param {Function} reject
 * @return {Request}
 */

Request.prototype.then = function (fulfill, reject) {
  return this.end(function(err, res) {
    err ? reject(err) : fulfill(res);
  });
}

/**
 * Expose `Request`.
 */

request.Request = Request;

/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(method, url) {
  // callback
  if ('function' == typeof url) {
    return new Request('GET', method).end(url);
  }

  // url first
  if (1 == arguments.length) {
    return new Request('GET', method);
  }

  return new Request(method, url);
}

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.get = function(url, data, fn){
  var req = request('GET', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.query(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * HEAD `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.head = function(url, data, fn){
  var req = request('HEAD', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * DELETE `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.del = function(url, fn){
  var req = request('DELETE', url);
  if (fn) req.end(fn);
  return req;
};

/**
 * PATCH `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.patch = function(url, data, fn){
  var req = request('PATCH', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * POST `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.post = function(url, data, fn){
  var req = request('POST', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * PUT `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.put = function(url, data, fn){
  var req = request('PUT', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * Expose `request`.
 */

module.exports = request;

},{"emitter":57,"reduce":58}],57:[function(_dereq_,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],58:[function(_dereq_,module,exports){

/**
 * Reduce `arr` with `fn`.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @param {Mixed} initial
 *
 * TODO: combatible error handling?
 */

module.exports = function(arr, fn, initial){  
  var idx = 0;
  var len = arr.length;
  var curr = arguments.length == 3
    ? initial
    : arr[idx++];

  while (idx < len) {
    curr = fn.call(null, curr, arr[idx], ++idx, arr);
  }
  
  return curr;
};
},{}]},{},[43])
(43)
});