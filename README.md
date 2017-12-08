# Consulea
#### Load Consul keys, environment vars, and command line arguments in a predictable, standardized way.

Module goals:
- Compile single config object from Consul kv, environment variables, and command line arguments.
- Watch for changes in Consul prefix, send an event with updated config.
- Verify required variables are set.
- Be extremely light weight, having minimal dependencies.
- Predictable config key outcome given different standards of input variables using different sources.
- Simplify origin of keys in Consul and Env. Each project should have it's own namespace, nothing shared.
- No ES6 dependency, so it works under Node.js 0.10 and onward.

Variables are first read from Consul, then the environment, then command line arguments, allowing the user to override something already previously set in Consul. The config key `webPort` can be set by Consul key `test-svc/web-port` and can be overridden by environment variable `TESTSVC_WEB_PORT`, and both can be overridden by `--web-port`.

## Install
```bash
npm install --save consulea
```

## Example
```javascript
// Load module
var Consulea = require('consulea');

// Create new instance of module, pass in config
var consulea = new Consulea({
    consulToken: '4fe3dee9-4148-404e-9928-d95cfb1e6947',
    consulPrefix: 'test-svc/',
    envPrefix: 'TESTSVC',
    requiredKeys: ['serverName', 'port'],
    ifMissingKeysOnUpdate: 'warn',
});

// Store your config however you please.
var myConfig = {};

// This event is called every time the Consul namespace is updated and upon first start.
// "meta" will supply things like keysChanged, and initialLoad
consulea.on('update', function (err, data, meta) {
    myConfig = data;
});

// Continue starting up project, with all config loaded for the first time.
// This event is only called once.
consulea.on('ready', function (err, data) {
    // Proceed with starting up... open service ports, etc.
});

// Handle errors and warnings as you see fit
consulea.on('error', function (err) {
    console.error('Consulea error:', err);
});
```

Config is now available to project from three different sources:

| Consul key | Env key | CLI key | Resulting variable |
| - | - | - | - |
| test-svc/port         | TESTSVC_PORT         | --port         | port        |
| test-svc/server-name  | TESTSVC_SERVER_NAME  | --server-name  | serverName  |
| test-svc/max-connects | TESTSVC_MAX_CONNECTS | --max-connects | maxConnects |
| test-svc/time-out-ms  | TESTSVC_TIME_OUT_MS  | --time-out-ms  | timeOutMs   |

```bash
# Assuming Consul has all of the above keys configured,
# they can be overridden by the ENV variables by doing:
export TESTSVC_MAX_CONNECTS=100
export TESTSVC_SERVER_NAME="New staging server"
node someScript.js
# ... or inline:
TESTSVC_MAX_CONNECTS=100 TESTSVC_SERVER_NAME="New staging server" node someScript.js

# And they can be overridden again by using CLI arguments:
node someScript.js --max-connects=50 --server-name="Prod server"
```

## Config object options
| Key | Required | Description |
| - | - | - |
| consulToken            | No  | ACL Token used to authenticate with Consul service |
| consulPrefix           | Yes | Namespace/prefix to search for keys in Consul |
| envPrefix              | No  | Namespace/prefix to search for keys in local environment |
| requiredKeys           | No  | List of camelCased keys which are considered to be required |
| consulClientConfig     | No  | Consul config object, if you'd rather configure it yourself |
| ifMissingKeysOnStartUp | No  | Set behavior when required keys are missing on first start up (default: exit) |
| ifMissingKeysOnUpdate  | No  | Set behavior when required keys are missing on any update after start up (default: exit) |
| suppressErrors         | No  | Set `true` to prevent Consulea from emitting errors. The emitted error event will still occur |

ifMissingKeysOnStartUp and ifMissingKeysOnUpdate can be one of the following:
- `exit`: Consulea will exit if any keys are missing.
- `warn`: Consulea will warn if any keys are missing.
- `skip`: Consulea will skip emitting the update/ready event if any keys are missing.
- `lastGoodValue`: Consulea will try to use the last good value for a given missing key and will exit if any keys did not previously exist.

## Notes

The Consul host:port can be also be defined using the environment variable `CONSUL_HTTP_ADDR`. This may be helpful if code is running in Docker or the Consul agent isn't running on the local instance.

```bash
# Don't use localhost:8500, connect somewhere else
export CONSUL_HTTP_ADDR='https://remoteconsulserver.com:8500'
node someScript.js
```
