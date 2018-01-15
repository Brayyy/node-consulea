var EventEmitter = require('events').EventEmitter;
var util = require('util');
var consul = require('consul');
var camelCase = require('camelcase');

/**
 * Read module config, returning config for Consul client
 * @param {object} configIn Module config to parse
 */
function makeConsulConfig (configIn) {
	// Consul client config can be passed in whole
	var consulConfig = configIn.consulClientConfig || {};

	// Consul host/port can be sourced from env CONSUL_HTTP_ADDR
	if (process.env.CONSUL_HTTP_ADDR) {
		var httpAddr = process.env.CONSUL_HTTP_ADDR;
		consulConfig.secure = (httpAddr.substr(0, 5) === 'https');
		httpAddr = httpAddr.replace('http://', '').replace('https://', '');
		httpAddr = httpAddr.split(':');
		if (httpAddr[0]) consulConfig.host = httpAddr[0];
		if (httpAddr[1]) consulConfig.port = httpAddr[1];
	}

	if (configIn.consulToken) {
		consulConfig.defaults = { token: configIn.consulToken };
	}

	return consulConfig;
}

/**
 * Add KV data to object sourced from raw Consul watch response data
 * @param {object} kvData Discovered key/value data input
 * @param {object} dataIn Consul response data
 * @param {string} prefix Consul prefix for to strip from discovered keys
 * @returns {object} Discovered key/value data
 */
function parseConsul (kvData, dataIn, prefix) {
	if (dataIn) {
		for (var i = 0; i < dataIn.length; i++) {
			if (dataIn[i].Key !== undefined && dataIn[i].Value !== undefined) {
				// Standardize the key
				var kvKey = dataIn[i].Key;
				kvKey = kvKey.replace(prefix, '');
				kvKey = camelCase(kvKey);

				// Filter out directories
				if (kvKey !== '') {
					kvData[kvKey] = dataIn[i].Value;
				}
			}
		}
	}
	return kvData;
}

/**
 * Add KV data to object sourced from environment variables with specific prefix
 * @param {object} kvData Discovered key/value data input
 * @param {string} prefix Environment prefix for to strip from discovered keys
 * @returns {object} Discovered key/value data output
 */
function parseEnv (kvData, prefix) {
	if (prefix) {
		prefix += '_';
		Object.keys(process.env).forEach(function (envKey) {
			// Skip env keys which don't start with prefix
			if (envKey.substring(0, prefix.length) === prefix) {
				// Standardize the key
				var kvKey = envKey.replace(prefix, '');
				kvKey = camelCase(kvKey);
				kvData[kvKey] = process.env[envKey];
			}
		});
	}
	return kvData;
}

/**
 * Add KV data to object sourced from command line arguments
 * @param {object} kvData Discovered key/value data input
 * @returns {object} Discovered key/value data output
 */
function parseArgs (kvData) {
	process.argv.forEach(function (val) {
		// Skip args that don't start with "--"
		if (val.substring(0, 2) === '--') {
			// Break apart key/value
			var argParts = val.substring(2).split('=', 2);
			if (argParts.length > 1) {
				// Standardize the key
				var newKey = camelCase(argParts[0]);
				kvData[newKey] = argParts[1];
			}
		}
	});
	return kvData;
}

/**
 * Verify the discovered KV data contains all required keys. Missing keys are returned in an array.
 * @param {object} kvData Discovered key/value data input
 * @param {object} requiredKeys List of camelCased keys which are required
 * @returns {array} List of missing keys
 */
function findMissingKeys (kvData, requiredKeys) {
	var missingKeys = [];
	if (requiredKeys) {
		for (var i = 0; i < requiredKeys.length; i++) {
			var requiredKey = requiredKeys[i];
			if (kvData[requiredKey] === undefined) {
				missingKeys.push(requiredKey);
			}
		}
	}
	return missingKeys;
}


/**
 * Compare previous and current findings for changed keys. Changed keys are returned in an array.
 * @param {object} self Self object
 * @returns {array} List of added/removed/changed keys
 */
function findChangedKeys (self) {
	var changedKeys = [];
	var temp = JSON.parse(JSON.stringify(self.lastGoodKvData));
	// Loop on previous findings, check for existence of and compare Key=>ModifyIndex map
	var newKeys = Object.keys(self.kvData);
	for (var j = 0; j < newKeys.length; j++) {
		var newKey = newKeys[j];
		var newVal = self.kvData[newKey];
		if (temp[newKey] && temp[newKey] === newVal) {
			delete temp[newKey];
		} else {
			temp[newKey] = newVal;
		}
	}
	// Standardize the key
	Object.keys(temp).forEach(function (kvKey) {
		kvKey = kvKey.replace(self.config.consulPrefix, '');
		changedKeys.push(camelCase(kvKey));
	});
	return changedKeys;
}

/**
 * JavaScript Pseudo-class that is compatible all the way back to Node 0.10
 */
var Consulea = (function () {
	// JavaScript Pseudo-class constructor
	function Consulea (configIn) {
		// Verify required things are set
		if (!configIn.consulPrefix) {
			throw new Error('consulPrefix not defined');
		}

		this.config = configIn;
		this.kvData = {};
		this.initialLoad = true;
		this.consulConfig = makeConsulConfig(this.config);
		this.consulClient = consul(this.consulConfig);
		this.lastGoodKvData = {};

		// Set defaults
		this.config.suppressErrors = this.config.suppressErrors || false;
		this.config.ifMissingKeysOnStartUp = this.config.ifMissingKeysOnStartUp || 'exit';
		this.config.ifMissingKeysOnUpdate = this.config.ifMissingKeysOnUpdate || 'exit';

		this.handleError = function (errObj) {
			if (!this.config.suppressErrors) {
				console.error(errObj.message);
			}
			// Catch possible 'TypeError: Uncaught, unspecified "error" event.'
			// if error event is not registered
			try {
				this.emit('error', errObj);
			} catch (e) {
				// no-op
			}
			// Exit if the error was fatal
			if (errObj.level === 'FATAL') {
				process.exit(1);
			}
		};

		// Start the watcher
		this.watchStart();
	}

	// Extend constructor function to be an EventEmitter
	util.inherits(Consulea, EventEmitter);

	return Consulea;
}());

/**
 * Start the Consul watcher
 */
Consulea.prototype.watchStart = function () {
	var self = this;

	// Start a watcher
	this._watcher = this.consulClient.watch({
		method: this.consulClient.kv.get,
		options: {
			key: this.config.consulPrefix,
			recurse: true,
		}
	});

	// When Consul namespace changes or is first loaded...
	this._watcher.on('change', function (response, res) {
		// Try to catch errors using http.IncomingMessage
		if (res.statusCode !== 200) {
			self.handleError({
				code: 'NON_HTTP_200',
				level: 'WARN',
				message: 'Consul error: HTTP/' + res.statusCode + ' ' + res.statusMessage + '. ' +
				'Possible bad Token, missing or unauthorized prefix: ' + self.config.consulPrefix
			});
			return;
		}

		// Build a new kvData from Consul, then Env, then Arguments
		var kvData = {};
		kvData = parseConsul(kvData, response, self.config.consulPrefix);
		kvData = parseEnv(kvData, self.config.envPrefix);
		kvData = parseArgs(kvData);
		self.kvData = kvData;

		var changedKeys = findChangedKeys(self);

		// Verify require keys
		var missingKeys = findMissingKeys(kvData, self.config.requiredKeys);

		// Something is missing
		if (missingKeys.length > 0) {
			var missingKeyList = missingKeys.join(', ');
			// This is handled differently, depending on if this is the first time or not
			var whichRule = (self.initialLoad ? 'ifMissingKeysOnStartUp' : 'ifMissingKeysOnUpdate');
			var ruleValue = self.config[whichRule];

			switch (ruleValue) {
				case 'exit':
					self.handleError({
						code: 'MISSING_KEY_EXIT',
						level: 'FATAL',
						message: 'Exiting, Consulea found keys missing: ' + missingKeyList
					});
					break;

				case 'warn':
					self.handleError({
						code: 'MISSING_KEY_WARN',
						level: 'WARN',
						message: 'Warning, Consulea found keys missing: ' + missingKeyList
					});
					break;

				case 'skip':
					self.handleError({
						code: 'MISSING_KEY_SKIP',
						level: 'WARN',
						message: 'Warning, Consulea found keys missing, skipping event call: ' + missingKeyList
					});
					return;

				case 'lastGoodValue':
					for (var i = 0; i < missingKeys.length; i++) {
						var missingKey = missingKeys[i];
						if (self.lastGoodKvData[missingKey] !== undefined) {
							self.handleError({
								code: 'MISSING_KEY_USED_PREV_VAL',
								level: 'WARN',
								message: 'Warning, Consulea found key missing, using old value: ' + missingKey
							});
							kvData[missingKey] = self.lastGoodKvData[missingKey];
						} else {
							self.handleError({
								code: 'MISSING_KEY_NO_PREV_VAL',
								level: 'FATAL',
								message: 'Exiting, Consulea found key missing with no previous value: ' + missingKey
							});
						}
					}
					break;

				default:
					self.handleError({
						code: 'UNKNOWN_CONFIG',
						level: 'FATAL',
						message: 'Exiting, Consulea has unknown config: ' + whichRule + '=' + ruleValue
					});
			}
		} else {
			// console.log('No keys missing.');
			self.lastGoodKvData = kvData;
		}

		// Make a copy so the code using this module can not modify kvData by accident
		var kvDataCopy = JSON.parse(JSON.stringify(self.kvData));

		// Emit "update" event every time there is a change, and include some extra metadata
		self.emit('update', null, kvDataCopy, {
			changedKeys: changedKeys,
			initialLoad: self.initialLoad
		});

		// Emit "ready" event only once
		if (self.initialLoad) {
			self.initialLoad = false;
			self.emit('ready', null, kvDataCopy);
		}
	});

	// Emit "error" when Consul connection emits an error
	this._watcher.on('error', function (err) {
		self.handleError({
			code: 'CLIENT_ERR',
			level: 'WARN',
			message: 'Consul error:' + err
		});
	});
};

/**
 * Stop the Consul watcher
 */
Consulea.prototype.watchStop = function () {
	this._watcher.end();
};

module.exports = Consulea;
