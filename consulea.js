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
		this.sentReady = false;
		this.consulConfig = makeConsulConfig(this.config);
		this.consulClient = consul(this.consulConfig);

		// Set defaults
		if (this.config.exitIfRequiredKeysFail === undefined) {
			this.config.exitIfRequiredKeysFail = true;
		}

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
			console.error(
				'Consul error: HTTP/' + res.statusCode + ' ' + res.statusMessage + '. ' +
				'Possible bad Token, missing or unauthorized prefix.'
			);
			return;
		}

		// Build a new kvData from Consul, then Env, then Arguments
		var kvData = {};
		kvData = parseConsul(kvData, response, self.config.consulPrefix);
		kvData = parseEnv(kvData, self.config.envPrefix);
		kvData = parseArgs(kvData);
		self.kvData = kvData;

		// Verify require keys
		var missingKeys = findMissingKeys(kvData, self.config.requiredKeys);
		if (missingKeys.length > 0 && self.config.exitIfRequiredKeysFail) {
			var missingKeyList = missingKeys.join(', ');
			console.error('Exiting, due to missing required keys: ' + missingKeyList);
			process.exit(1);
		}

		// Emit "change" event every time there is a change
		self.emit('change', null, kvData);

		// Emit "ready" event only once
		if (!self.sentReady) {
			self.sentReady = true;
			self.emit('ready', null, kvData);
		}
	});

	// Emit "error" when Consul connection emits an error
	this._watcher.on('error', function (err) {
		self.emit('error', err);
		console.error('Consul error:', err);
	});
};

/**
 * Stop the Consul watcher
 */
Consulea.prototype.watchStop = function () {
	this._watcher.end();
};

module.exports = Consulea;
