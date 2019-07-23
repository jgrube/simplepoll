/**
 * SimplePoll directory polling module.
 * @module SimplePoll
 * @author John Grube <johnegrube@gmail.com>
 * @see https://github.com/jgrube/SimplePoll#readme
 */

"use strict";

// Node modules
import path = require("path");
import fs = require("fs");

// Dependency modules
import async = require("async");
import readdir = require("async-readdir");

// Object to store SimplePoll instance references so that they don't
// get garbage collected
let pollHandles: { [path: string]: SimplePoll } = {};

// Tracks file mtimes
let fileModTimes: { [path: string]: number } = {};

export class SimplePoll {
    // Config settings
    private path: string;
    private extension: string;
    private timerPeriod: number;
    private sort: boolean;
    private sortMethod: SortMethod;
    private pollCallback: PollCallback;

    private pollTimer: NodeJS.Timer;

    private startupInit: boolean;
    private startupTimerRequest: boolean;

    constructor(config: SimplePollConfig) {
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
                this.sortMethod = (input: string[], sortMethodCallback: (error: NodeJS.ErrnoException, results: string[]) => void) => {
                    return sortMethodCallback(null, input.sort());
                }
            }
        }

        let self: SimplePoll = this;

        readdir.read(self.path, (error: NodeJS.ErrnoException, files: string[]) => {
            if (error) {
                throw error;
            }

            async.eachLimit(files, 10, (file: string, eachCallback: (error: NodeJS.ErrnoException) => void) => {
                if (file.endsWith(self.extension)) {
                    fs.stat(file, (error: NodeJS.ErrnoException, stats: fs.Stats) => {
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
            }, function (error: NodeJS.ErrnoException) {
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

    /** Queues the next directory poll timer */
    start = () => {
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
    }

    /** Stops the pending directory poll timer */
    stop = () => {
        if (!this.pollTimer) {
            return;
        }

        clearTimeout(this.pollTimer);
        this.pollTimer = null;
    }

    /** Polls the directory, removes files without appropriate extension and sorts
     *  if necessary. Calling function takes care of starting and stopping the timer.
     */
    private scanDir = (scanDirCallback: (error: NodeJS.ErrnoException, files: string[]) => void) => {
        let self: SimplePoll = this;

        async.waterfall([
            function getFileList(getFileListCallback: (error: NodeJS.ErrnoException, files: string[]) => void) {
                readdir.read(self.path, getFileListCallback);
            },
            function filterFiles(files: string[], filterFilesCallback: (error: NodeJS.ErrnoException, files: string[]) => void) {
                // Skip if no files were found or extension filtering isn't required
                if (files.length === 0 || !self.extension) {
                    return filterFilesCallback(null, files);
                }

                async.filterLimit(files, 10, (file, filterCallback) => {
                    // Remove files without correct extension
                    // Use setTimeout() here because Async module has a bug when
                    // filtering more than a few thousand items
                    if (file.endsWith(self.extension)) {
                        fs.stat(file, (error: NodeJS.ErrnoException, stats: fs.Stats) => {
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
            function sortFiles(files: string[], sortFilesCallback: (error: NodeJS.ErrnoException, files: string[]) => void) {
                if (!files || files.length < 2 || !self.sort) {
                    return sortFilesCallback(null, files);
                }

                return self.sortMethod(files, sortFilesCallback);
            }
        ], function(error: NodeJS.ErrnoException, files: string[]) {
            scanDirCallback(error, files);
        });
    }

    /** Timer callback that's responsible for polling the directory and restarting the timer. */
    private poll = () => {
        this.stop();

        this.scanDir((error, files) => {
            // If any errors occurred, pass them up to the callback for handling
            // We shouldn't care if the directory doesn't exist yet so don't pass that error up
            if ((error && error.code !== "ENOENT") || files.length > 0) {
                this.pollCallback(error, files);
            }

            return this.start();
        });
    }
}

/**
 * Creates a new SimplePoll instance (use instead of "new" keyword). It won't
 * overwrite an existing instance if one has already been created for the directory
 * @param config Poll settings to use with directory
 * @returns {SimplePoll} Returns reference to newly created SimplePoll instance
 */
export function create(config: SimplePollConfig): SimplePoll {
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

/**
 * Destroys the SimplePoll instance for the given directory
 * @param directory Directory to delete
 */
export function destroy(directory: string): void {
    if (!directory || !getHandle(directory)) {
        return;
    }

    getHandle(directory).stop();
    delete pollHandles[directory];
}

/**
 * Retrieves the SimplePoll instance for the given directory. Returns {null}
 * if no instance exists.
 * @param directory Directory to retrieve SimplePoll instance for
 * @returns {SimplePoll} Returns reference to SimplePoll instance
 */
export function getHandle(directory: string): SimplePoll {
    if (pollHandles[directory]) {
        return pollHandles[directory];
    }
    else {
        return null;
    }
}
