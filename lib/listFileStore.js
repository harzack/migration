#!/usr/bin/env node

const
    path = require("path"),
    fs = require("fs");
	
const filestoreBaseDir = 'Z:/';
var fileList = [];

/**
 * List all files in a directory recursively in a synchronous fashion
 *
 * @param {String} dir
 * @returns {IterableIterator<String>}
 */
function *walkSync(dir) {
    const files = fs.readdirSync(dir);
	
    for (const file of files) {
        const pathToFile = path.join(dir, file);
        fs.stat(pathToFile, function(err,data) {
			// if an error occurs, write in the console
			if(err) {
				console.log("error reading stats");
				return;
			}
			// otherwise perform actions
			else {
				const isDirectory = fs.stat(pathToFile).isDirectory();
				if (isDirectory) {
					yield *walkSync(pathToFile);
				} else {
					yield pathToFile;
				}
			}
		}
		)
    }
}

for (const file of walkSync(filestoreBaseDir)) {
    // do something with it
    fileList.push(file);
}

console.log(fileList.length);
