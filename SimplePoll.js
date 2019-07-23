/**
 * SimplePoll directory polling module.
 * @module SimplePoll
 * @author John Grube <johnegrube@gmail.com>
 * @see https://github.com/jgrube/SimplePoll#readme
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
// Dependency modules
const async = require("async");
const readdir = require("async-readdir");
// Object to store SimplePoll instance references so that they don't
// get garbage collected
let pollHandles = {};
// Tracks file mtimes
let fileModTimes = {};
class SimplePoll {
    constructor(config) {
        /** Queues the next directory poll timer */
        this.start = () => {
            // Don't start if timer is already running
            if (this.pollTimer) {
                return;
            }
            // Don't allow the user to start the timer until startup process has completed
            if (this.startupInit) {
                this.startupTimerRequest = true;
                return;
            }
            this.pollTimer = setTimeout(this.poll, this.timerPeriod);
            this.pollTimer.unref();
        };
        /** Stops the pending directory poll timer */
        this.stop = () => {
            if (!this.pollTimer) {
                return;
            }
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        };
        /** Polls the directory, removes files without appropriate extension and sorts
         *  if necessary. Calling function takes care of starting and stopping the timer.
         */
        this.scanDir = (scanDirCallback) => {
            let self = this;
            async.waterfall([
                function getFileList(getFileListCallback) {
                    readdir.read(self.path, getFileListCallback);
                },
                function filterFiles(files, filterFilesCallback) {
                    // Skip if no files were found or extension filtering isn't required
                    if (files.length === 0 || !self.extension) {
                        return filterFilesCallback(null, files);
                    }
                    async.filterLimit(files, 10, (file, filterCallback) => {
                        // Remove files without correct extension
                        // Use setTimeout() here because Async module has a bug when
                        // filtering more than a few thousand items
                        if (file.endsWith(self.extension)) {
                            fs.stat(file, (error, stats) => {
                                if (error) {
                                    return filterCallback(error);
                                }
                                // If file is new or if it's been modified, keep it
                                if (!fileModTimes[file] || fileModTimes[file] < stats.mtimeMs) {
                                    fileModTimes[file] = stats.mtimeMs;
                                    return setTimeout(() => { return filterCallback(null, true); }, 0);
                                }
                                else {
                                    return setTimeout(() => { return filterCallback(null, false); }, 0);
                                }
                            });
                        }
                        else {
                            return setTimeout(() => { return filterCallback(null, false); }, 0);
                        }
                    }, filterFilesCallback);
                },
                function sortFiles(files, sortFilesCallback) {
                    if (!files || files.length < 2 || !self.sort) {
                        return sortFilesCallback(null, files);
                    }
                    return self.sortMethod(files, sortFilesCallback);
                }
            ], function (error, files) {
                scanDirCallback(error, files);
            });
        };
        /** Timer callback that's responsible for polling the directory and restarting the timer. */
        this.poll = () => {
            this.stop();
            this.scanDir((error, files) => {
                // If any errors occurred, pass them up to the callback for handling
                // We shouldn't care if the directory doesn't exist yet so don't pass that error up
                if ((error && error.code !== "ENOENT") || files.length > 0) {
                    this.pollCallback(error, files);
                }
                return this.start();
            });
        };
        if (!config || !config.path || !config.pollCallback) {
            throw new Error("Invalid SimplePoll configuration");
        }
        this.startupInit = true;
        this.startupTimerRequest = false;
        this.path = config.path;
        this.extension = config.extension || null;
        this.timerPeriod = config.timerPeriod;
        this.sort = config.sort;
        this.pollCallback = config.pollCallback;
        if (config.sort) {
            if (config.sortMethod) {
                this.sortMethod = config.sortMethod;
            }
            else {
                // As a default, use standard inefficient sort algorithm if it wasn't defined
                this.sortMethod = (input, sortMethodCallback) => {
                    return sortMethodCallback(null, input.sort());
                };
            }
        }
        let self = this;
        readdir.read(self.path, (error, files) => {
            if (error) {
                throw error;
            }
            async.eachLimit(files, 10, (file, eachCallback) => {
                if (file.endsWith(self.extension)) {
                    fs.stat(file, (error, stats) => {
                        if (error) {
                            return eachCallback(error);
                        }
                        fileModTimes[file] = stats.mtimeMs;
                        return eachCallback(null);
                    });
                }
                else {
                    return eachCallback(null);
                }
            }, function (error) {
                if (error) {
                    throw error;
                }
                self.startupInit = false;
                if (self.startupTimerRequest) {
                    return self.start();
                }
            });
        });
    }
}
exports.SimplePoll = SimplePoll;
/**
 * Creates a new SimplePoll instance (use instead of "new" keyword). It won't
 * overwrite an existing instance if one has already been created for the directory
 * @param config Poll settings to use with directory
 * @returns {SimplePoll} Returns reference to newly created SimplePoll instance
 */
function create(config) {
    if (!config || !config.path || !config.pollCallback) {
        throw new Error("Invalid SimplePoll configuration");
    }
    // Don't overwrite if it already exists (just return existing handle after)
    if (!pollHandles[config.path]) {
        pollHandles[config.path] = new SimplePoll(config);
        pollHandles[config.path].start();
    }
    return pollHandles[config.path];
}
exports.create = create;
/**
 * Destroys the SimplePoll instance for the given directory
 * @param directory Directory to delete
 */
function destroy(directory) {
    if (!directory || !getHandle(directory)) {
        return;
    }
    getHandle(directory).stop();
    delete pollHandles[directory];
}
exports.destroy = destroy;
/**
 * Retrieves the SimplePoll instance for the given directory. Returns {null}
 * if no instance exists.
 * @param directory Directory to retrieve SimplePoll instance for
 * @returns {SimplePoll} Returns reference to SimplePoll instance
 */
function getHandle(directory) {
    if (pollHandles[directory]) {
        return pollHandles[directory];
    }
    else {
        return null;
    }
}
exports.getHandle = getHandle;
//# sourceMappingURL=SimplePoll.js.map