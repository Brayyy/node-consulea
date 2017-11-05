# Consulea
#### Load Consul keys, environment vars, and command line arguments in a predictable, standardized way.

Module goals:
- Compile single config object from Consul kv, environment variables, and command line arguments.
- Watch for changes in Consul prefix, send an event with updated config.
- Be extremely light weight, and have few or no dependencies.
- Predictable config key outcome given different standards of input variables using different sources.
- Simplify origin of keys in Consul and Env. Each project should have it's own namespace, no shared namespaces.
- Use code which will work under Node.js 0.10.

Variables are first read from Consul, then the environment, then command line arguments, allowing the user to override something already previously set in Consul. The config key `webPort` can be set by Consul key `test-svc/web-port` and can be overridden by environment variable `TESTSVC_WEB_PORT`, and both can be overridden by `--web-port`.


## Example
```javascript
// Load module
var Consulea = require('consulea');

// Create new instance of module, pass in config
var consulea = new Consulea({
    consulToken: '00000000-example-app',
    consulPrefix: 'example-app/',
    envPrefix: 'EXAMPLE'
});

// Store your config however you please.
var myConfig = {};

// This event is called every time the Consul namespace is updated and upon first start.
consulea.on('change', function (err, data) {
    myConfig = data;
});

// Continue starting up project, with all config loaded for the first time.
// This event is only called once.
consulea.on('ready', function (err, data) {
    myConfig = data;
    // Proceed with starting up... open service ports, etc.
});
```

Config is now available to project from three different sources:

| Etcd key | Env key | CLI key | Code result |
| - | - | - | - |
| cfg/web-service/port | WEBSVC_PORT | --port | config.port |
| cfg/web-service/server-name | WEBSVC_SERVER_NAME | --server-name | config.serverName |
| cfg/web-service/max-connects | WEBSVC_MAX_CONNECTS | --max-connects | config.maxConnects |
| cfg/web-service/time-out-ms | WEBSVC_TIME_OUT_MS | --time-out-ms | config.timeOutMs |

```bash
# Assuming Etcd has all of the above keys configured,
# they can be overridden by ENV by doing:
export WEBSVC_MAX_CONNECTS=100
export WEBSVC_SERVER_NAME="New staging server"
node someScript.js

# And they can be overridden again by using CLI arguments:
node someScript.js --max-connects=50 --server-name="Test server"
```

The configuration is now agnostic of the language of the script/service. The example above could have been PHP, Python or Node.js, being configured the same way.

## Config object options
| Key | Required | Description |
| - | - | - |
| etcdNameSpace | No | Namespace/prefix to search for keys in Etcd |
| envNameSpace | No | Namespace/prefix to search for keys in local environment |
| etcdApiPath | No | Etcd V3 JSON proxy is currently at "/v3alpha". Option is here if it changes |
| requiredKeys | No | List of camelCased keys which must exist, or script will exit |


ಠ_ಠ
