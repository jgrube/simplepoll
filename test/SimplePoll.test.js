/**
 * SimplePoll Mocha test module.
 * @module SimplePoll.test
 * @author John Grube <johnegrube@gmail.com>
 * @see https://github.com/jgrube/SimplePoll#readme
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Node Modules
const path = require("path");
const nodeFs = require("fs");
// Dependency Modules
const readdir = require("async-readdir");
const fs = require("fs-extra");
const chai = require("chai");
const sinon = require("sinon");
// System Under Test
const simplepoll = require("../SimplePoll");
const TEST_DIR = "./test/data/";
let testPoll = null;
let testPaths = [];
let callbackAssertions = null;
function pollCallbackWrapper(error, files) {
    // Hacky workaround to allow us to change how the arguments are tested
    callbackAssertions(error, files);
}
describe("int:SimplePoll", function () {
    before("int:SimplePoll", function () {
        fs.removeSync(TEST_DIR);
        fs.mkdirSync(TEST_DIR);
        populateTestPaths();
    });
    after("int:SimplePoll", function () {
        fs.removeSync(TEST_DIR);
    });
    describe("API functions", function () {
        it("Should not create a SimplePoll instance with an invalid config", function () {
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: false,
                pollCallback: null
            };
            chai.expect(simplepoll.create.bind(config)).to.throw(Error);
            let constructorWrapper = function () { new simplepoll.SimplePoll(config); };
            chai.expect(constructorWrapper.bind(config)).to.throw(Error);
        });
        it("Should create a SimplePoll instance", function () {
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: false,
                pollCallback: pollCallbackWrapper
            };
            testPoll = simplepoll.create(config);
            chai.expect(testPoll).to.be.an.instanceof(simplepoll.SimplePoll);
        });
        it("Should get the correct poll instance", function () {
            let retrievedInstance = simplepoll.getHandle(TEST_DIR);
            chai.expect(retrievedInstance).to.be.an.instanceof(simplepoll.SimplePoll);
            chai.expect(retrievedInstance).to.deep.equal(testPoll);
        });
        it("Should handle stopping the poll timer", function () {
            let retrievedInstance = simplepoll.getHandle(TEST_DIR);
            chai.expect(retrievedInstance.stop.bind(null)).to.not.throw();
            // Handle stopping it again if it's not running
            chai.expect(retrievedInstance.stop.bind(null)).to.not.throw();
        });
        it("Should handle starting the poll timer", function () {
            let retrievedInstance = simplepoll.getHandle(TEST_DIR);
            chai.expect(retrievedInstance.start.bind(null)).to.not.throw();
            // Handle starting it again if it's already running
            chai.expect(retrievedInstance.start.bind(null)).to.not.throw();
        });
        it("Should delete the poll instance", function () {
            let retrievedInstance = simplepoll.getHandle(TEST_DIR);
            chai.expect(retrievedInstance).to.be.an.instanceof(simplepoll.SimplePoll);
            simplepoll.destroy(TEST_DIR);
            retrievedInstance = simplepoll.getHandle(TEST_DIR);
            chai.expect(retrievedInstance).to.equal(null);
        });
        it("Should handle an attempt to delete poll instance that doesn't exist", function () {
            chai.expect(simplepoll.destroy.bind(TEST_DIR)).to.not.throw();
        });
    });
    describe("Polling with extension filtering", function () {
        it("Should create a SimplePoll instance", function () {
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: false,
                pollCallback: pollCallbackWrapper
            };
            testPoll = simplepoll.create(config);
            chai.expect(testPoll).to.be.an.instanceof(simplepoll.SimplePoll);
        });
        it("Should not call the callback with 0 files", function (done) {
            this.timeout(10e3);
            let callbackCalled = false;
            callbackAssertions = function (error, files) {
                callbackCalled = true;
            };
            // Give a few seconds for poll timer to expire
            // (This keeps the event loop active so the tests don't exit prematurely)
            setTimeout(() => {
                chai.expect(callbackCalled).to.be.false;
                done();
            }, 3000);
        });
        it("Should detect a single new file", function (done) {
            this.timeout(10e3);
            const testPath = path.join(TEST_DIR, "output.txt");
            callbackAssertions = function (error, files) {
                chai.expect(error).to.be.null;
                chai.expect(files).to.have.lengthOf(1);
                chai.expect(files[0]).to.equal(path.resolve(testPath));
                done();
            };
            fs.outputFileSync(testPath, "Some test data");
        });
        it("Should not detect a file without the correct extension", function (done) {
            this.timeout(10e3);
            let callbackCalled = false;
            callbackAssertions = function (error, files) {
                callbackCalled = true;
            };
            // Give a few seconds for poll timer to expire
            // (This keeps the event loop active so the tests don't exit prematurely)
            setTimeout(() => {
                chai.expect(callbackCalled).to.be.false;
                fs.emptyDirSync(TEST_DIR);
                done();
            }, 3000);
            fs.outputFileSync(path.join(TEST_DIR, "output.json"), `{"test": "data"}`);
        });
        it("Should detect multiple files (including in subdirectories)", function (done) {
            this.timeout(10e3);
            callbackAssertions = function (error, files) {
                chai.expect(error).to.be.null;
                chai.expect(files).to.have.lengthOf(testPaths.length);
                for (let i = 0; i < testPaths.length; i++) {
                    chai.expect(files).to.contain(testPaths[i]);
                }
                done();
            };
            for (let i = 0; i < testPaths.length; i++) {
                fs.outputFileSync(testPaths[i], "Some test data");
            }
        });
        it("Should not detect existing files on startup", function (done) {
            this.timeout(10e3);
            fs.emptyDirSync(TEST_DIR);
            simplepoll.destroy(TEST_DIR);
            for (let i = 0; i < testPaths.length; i++) {
                fs.outputFileSync(testPaths[i], "Some test data");
            }
            fs.outputFileSync(path.join(TEST_DIR, "skip_this.file"), "Some test data");
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: false,
                pollCallback: pollCallbackWrapper
            };
            testPoll = simplepoll.create(config);
            chai.expect(testPoll).to.be.an.instanceof(simplepoll.SimplePoll);
            let callbackCalled = false;
            callbackAssertions = function (error, files) {
                callbackCalled = true;
            };
            // Give a few seconds for poll timer to expire
            // (This keeps the event loop active so the tests don't exit prematurely)
            setTimeout(() => {
                chai.expect(callbackCalled).to.be.false;
                done();
            }, 3000);
        });
        it("Should detect modified files", function (done) {
            this.timeout(10e3);
            callbackAssertions = function (error, files) {
                chai.expect(error).to.be.null;
                chai.expect(files).to.have.lengthOf(1);
                chai.expect(files[0]).to.equal(testPaths[2]);
                done();
            };
            fs.writeFileSync(testPaths[2], "Some other test data");
        });
    });
    describe("Polling with sorting", function () {
        before("Polling with sorting", function () {
            simplepoll.destroy(TEST_DIR);
        });
        beforeEach("Polling with sorting", function () {
            fs.emptyDirSync(TEST_DIR);
        });
        it("Should create a SimplePoll instance with the default sort", function () {
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: true,
                pollCallback: pollCallbackWrapper
            };
            testPoll = simplepoll.create(config);
            chai.expect(testPoll).to.be.an.instanceof(simplepoll.SimplePoll);
        });
        it("Should detect multiple files (including in subdirectories) in the correct order", function (done) {
            this.timeout(10e3);
            callbackAssertions = function (error, files) {
                chai.expect(error).to.be.null;
                chai.expect(files).to.have.lengthOf(testPaths.length);
                for (let i = 0; i < testPaths.length; i++) {
                    chai.expect(files[i]).to.equal(testPaths[i]);
                }
                done();
            };
            for (let i = 0; i < testPaths.length; i++) {
                fs.outputFileSync(testPaths[i], "Some test data");
            }
            testPaths.sort();
        });
        it("Should create a SimplePoll instance with a user-provided sort", function () {
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: true,
                pollCallback: pollCallbackWrapper,
                sortMethod: (input, sortMethodCallback) => {
                    return sortMethodCallback(null, input.sort((a, b) => {
                        if (a > b) {
                            return 1;
                        }
                        else if (b < a) {
                            return -1;
                        }
                        else {
                            return 0;
                        }
                    }));
                }
            };
            simplepoll.destroy(TEST_DIR);
            chai.expect(simplepoll.getHandle(TEST_DIR)).to.equal(null);
            testPoll = simplepoll.create(config);
            chai.expect(testPoll).to.be.an.instanceof(simplepoll.SimplePoll);
        });
        it("Should detect multiple files (including in subdirectories) in the correct order", function (done) {
            this.timeout(10e3);
            callbackAssertions = function (error, files) {
                chai.expect(error).to.be.null;
                chai.expect(files).to.have.lengthOf(testPaths.length);
                testPaths.sort((a, b) => {
                    if (a > b) {
                        return 1;
                    }
                    else if (b < a) {
                        return -1;
                    }
                    else {
                        return 0;
                    }
                });
                for (let i = 0; i < testPaths.length; i++) {
                    chai.expect(files[i]).to.equal(testPaths[i]);
                }
                done();
            };
            for (let i = 0; i < testPaths.length; i++) {
                fs.outputFileSync(testPaths[i], "Some test data");
            }
            testPaths.sort();
        });
    });
    describe("Error handling", function () {
        let fs_stat;
        let readdir_read;
        before("Error handling", function () {
            fs.emptyDirSync(TEST_DIR);
        });
        beforeEach("Error handling", function () {
            simplepoll.destroy(TEST_DIR);
        });
        // Handle directory polling when running normally
        it("Should have errors passed up to the user-defined callback", function (done) {
            this.timeout(10e3);
            fs_stat = sinon.stub(nodeFs, "stat");
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: false,
                pollCallback: pollCallbackWrapper
            };
            testPoll = simplepoll.create(config);
            // Purposely setup the stubs after simplepoll.create to allow the initial calls to go through for the setup
            // Allow first call (inside of the async-readdir package) to call fs.stat normally
            fs_stat.callThrough();
            // This is the fs.stat call inside SimplePoll
            fs_stat.onCall(1).yieldsAsync(new Error("stats error"), null);
            callbackAssertions = function (error, files) {
                chai.expect(error).to.not.be.null;
                chai.expect(error).to.be.an.instanceof(Error);
                chai.expect(files).to.be.undefined;
                fs_stat.restore();
                done();
            };
            fs.outputFileSync(testPaths[0], "Some test data");
        });
        // Handle directory polling errors on startup when creating a new SimplePoll instance
        it("Should throw any errors encountered while initializing (1/2)", function (done) {
            this.timeout(10e3);
            readdir_read = sinon.stub(readdir, "read");
            readdir_read.yieldsAsync(new Error("read error"), null);
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: false,
                pollCallback: pollCallbackWrapper
            };
            fs.outputFileSync(testPaths[0], "Some test data");
            // Intercept uncaughtException inside the async function before Node and Mocha
            // (this is the only way to test thrown errors inside async functions)
            process.prependOnceListener("uncaughtException", (error) => {
                chai.expect(error).to.not.be.null;
                chai.expect(error).to.be.an.instanceof(Error);
                readdir_read.restore();
                done();
            });
            simplepoll.create(config);
        });
        // Handle directory polling errors on startup when creating a new SimplePoll instance
        it("Should throw any errors encountered while initializing (2/2)", function (done) {
            this.timeout(10e3);
            fs_stat = sinon.stub(nodeFs, "stat");
            // Allow first call (inside of the async-readdir package) to call fs.stat normally
            fs_stat.callThrough();
            // This is the fs.stat call inside SimplePoll
            fs_stat.onCall(1).yieldsAsync(new Error("stats error"), null);
            const config = {
                path: TEST_DIR,
                extension: ".txt",
                timerPeriod: 1000,
                sort: false,
                pollCallback: pollCallbackWrapper
            };
            fs.outputFileSync(testPaths[0], "Some test data");
            // Intercept uncaughtException inside the async function before Node and Mocha
            // (this is the only way to test thrown errors inside async functions)
            process.prependOnceListener("uncaughtException", (error) => {
                chai.expect(error).to.not.be.null;
                chai.expect(error).to.be.an.instanceof(Error);
                fs_stat.restore();
                done();
            });
            simplepoll.create(config);
        });
    });
});
function populateTestPaths() {
    testPaths.push(path.join(TEST_DIR, "outputA.txt"));
    testPaths.push(path.join(TEST_DIR, "outputB.txt"));
    testPaths.push(path.join(TEST_DIR, "/subdirectory/", "outputC.txt"));
    testPaths.push(path.join(TEST_DIR, "/subdirectory/", "outputD.txt"));
    testPaths.push(path.join(TEST_DIR, "/subdirectory/subsubdirectory/", "outputF.txt"));
    testPaths.push(path.join(TEST_DIR, "/subdirectory/subsubdirectory/", "outputG.txt"));
    for (let i = 0; i < testPaths.length; i++) {
        testPaths[i] = path.resolve(testPaths[i]);
    }
}
//# sourceMappingURL=SimplePoll.test.js.map