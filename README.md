# SimplePoll
Cross-platform directory monitor with no file system notification (inotify/kqueue/etc.) limits. SimplePoll will watch any number of directories and notify you of any new or modified files.

## Why?
Node's `fs.watch()` has various issues and [chokidar](https://github.com/paulmillr/chokidar) is a great package to get around them. However, existing packages have a few inconsistencies and particularly when the same application is deployed on different platforms. The biggest issue is that many packages rely on file system notifications and the notification limit is quickly reached when watching a directory with thousands of files. On certain Linux deployments, I didn't have the ability to raise the inotify watcher limit. SimplePoll seeks to overcome these two things.

## Installation

```
$ npm install simplepoll --save
```

TypeScript typings are included with the installation by default (`@types/simplepoll` isn't currently available).

## Usage

Require it in your code:
```javascript
var simplepoll = require("simplepoll");
```
Specify the callback that gets called when new or modified files are found:
```javascript
function watchCallback(error, files) {
    if (error) {
        console.log(`Error encountered: ${error.message}`);
    }
    else {
        console.log(`New files found: ${JSON.stringify(files)}`);
    }
}
```
Specify the configuration and create the watcher:
```javascript
const config = {
    path: "./data/images",
    extension: ".gif",
    timerPeriod: 60000,
    sort: false,
    pollCallback: watchCallback
}

simplepoll.create(config);
```
Stop and restart the watcher:
```javascript
simplepoll.getHandle(config.path).stop();

// ...
// e.g. modify the files
// ...

simplepoll.getHandle(config.path).start();
```

### Watching a Single File
The functionality to watch a single file hasn't been implemented yet but the `extension` config option can be used as a workaround.
Set `path` to the file's current directory and set `extension` to the filename with the leading forward slash. Watching `data/stats/traffic.json` as an example:
```javascript
const config = {
    path: "./data/stats",
    extension: "/traffic.json",
    timerPeriod: 60000,
    sort: false,
    pollCallback: watchCallback
}
```

### Other Notes
- If `config.path` was given as a relative path, the array of files passed to the watcher callback has all paths converted to absolute paths.
- SimplePoll won't prevent the process from exiting if there's no other activity on the event loop (see the [Node Timers documentation](https://nodejs.org/api/timers.html#timers_timeout_unref).
- Files in subdirectories will also be watched.
- Errors are only thrown during initialization. Any further errors encountered during normal operation will get passed to the callback function (`config.pollCallback`).
- Support for multiple watches on the same directory hasn't been implemented yet. This means that if you need to watch multiple file types in the same directory, you won't be able to do so until the next release (feel free to submit a pull request!). However, you can still watch all files in a directory. You'll just have to do the filtering yourself.

## API

### Class Methods
#### simplepoll.start()
Queues a directory poll timer event. Polling automatically starts when creating a new watch
but this can be used for manual control.

#### simplepoll.stop()
Stops a directory watch. Polling automatically stops when destroying a watch
but this can be used for manual control.

### Helper Functions
#### create(config)
Starts polling the directory specified in the configuration. Returns a reference to the watcher instance upon completion. Multiple watches for the same directory won't be set.

- `config` `<Object>` Mandatory configuration to be used when creating a watcher.
  - `path` `<boolean>` Path to monitor for new files and changes.
  - `extension?` `<string>` Optional. File extension to look for in the directory.
  -  `timerPeriod` <number>` How frequently to check for new files and changes (in milliseconds).
  -  `sort` <boolean>` `true` if lists of new/modified files should be sorted before being passed to the callback.
  -  `sortMethod?` `<Function>` Optional. Lets you specify how to sort file lists. If `sort` is `true` and `sortMethod` isn't specified, the default (and inefficient) `Array.prototype.sort()` method will be used.
  -  `pollCallback` <Function>` Callback function to call with a list of new/modified files. Any errors encountered are also passed to this callback.

#### destroy(path)
Stops polling the given directory and destroys the watcher instance.

- `path` `<string>` Relative or absolute path to a directory. Must be the same as the path used when creating the watcher.

#### getHandle(path)
Returns the reference to a directory's watcher. Returns `null` if no instance exists for the specified path.

- `path` `<String>` Relative or absolute path to a directory. Must be the same as the path used when creating the watcher. 

## License

Copyright (c) 2018, [John Grube](https://github.com/jgrube)
Released under the [MIT license](LICENSE).
