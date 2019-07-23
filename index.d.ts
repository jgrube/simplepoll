// Type definitions for SimplePoll
// Project: SimplePoll <https://github.com/jgrube/SimplePoll#readme>
// Definitions by: John Grube <johnegrube@gmail.com>

interface PollCallback { (error: NodeJS.ErrnoException, files: string[]): void; }
interface SortMethod { (input: string[], sortMethodCallback: (error: NodeJS.ErrnoException, results: string[]) => void): void; }

declare interface SimplePollConfig {
    path: string;               // Path to directory to watch
    extension?: string;         // Optional file extension to filter on
    timerPeriod: number;        // How frequently to poll (in msec)
    sort: boolean;              // Alphabetically sort list of files found in a directory?
    sortMethod?: SortMethod;    // Optionally lets you specify how to sort file lists
    pollCallback: PollCallback; // Function to call with a list of new files
}
