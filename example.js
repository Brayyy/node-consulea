// Load module
const Consulea = require('./');

// Create new instance of module, pass in config
const consulea = new Consulea({
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
const myConfig = {};

consulea.on('update', (err, newConfig, meta) => {
	// The state of config has changed, use this event to save a new copy or action upon the result.
	// This event is called every time the Consul namespace is updated and also upon first start.
	myConfig = newConfig;
	console.log('consulea on-update triggered:', myConfig);
	console.log('consulea on-update found these keys have changed:', meta.changedKeys);
});

consulea.on('ready', (err, newConfig) => {
	// Continue starting up project, with all config loaded for the first time.
	// This event is only called once.
	myConfig = newConfig;
	console.log('consulea on-ready triggered:', myConfig);
	//
	// Start the rest of the app now that config has been loaded...
	//
});

consulea.on('error', (err) => {
	console.error('consulea on-error triggered: ', err);
});

// Optionally stop the watch
setTimeout(() => {
	consulea.watchStop();
}, 5000);

setTimeout(() => {
	consulea.watchStart();
}, 10000);


// Run example script for 15 minutes
setTimeout(() => {}, 900000);
