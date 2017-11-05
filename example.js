// Load module
var Consulea = require('./');

// Create new instance of module, pass in config
var consulea = new Consulea({
	// consulClientConfig: {
	// 	host: 'localhost',
	// 	port: 8500
	// },
	consulToken: '00000000-example-app',
	consulPrefix: 'cfg/example-app/',
	envPrefix: 'EXAMPLE',
	// requiredKeys: ['port', 'serverName', 'maxConnects'],
	// exitIfRequiredKeysFail: false,
});

// Store your config however you please.
var myConfig = {};

consulea.on('change', function (err, newConfig) {
	// The state of config has changed, use this event to save a new copy or action upon the result.
	// This event is called every time the Consul namespace is updated and also upon first start.
	myConfig = newConfig;
	console.log('consulea on-change triggered:', myConfig);
});

consulea.on('ready', function (err, newConfig) {
	// Continue starting up project, with all config loaded for the first time.
	// This event is only called once.
	myConfig = newConfig;
	console.log('consulea on-ready triggered:', myConfig);
	//
	// Start the rest of the app now that config has been loaded...
	//
});

consulea.on('error', function (err) {
	console.error('consulea on-error triggered: ', err);
});

// Optionally stop the watch
setTimeout(function () {
	consulea.watchStop();
}, 5000);

setTimeout(function () {
	consulea.watchStart();
}, 10000);


// Run example script for 15 minutes
setTimeout(function () {}, 900000);
