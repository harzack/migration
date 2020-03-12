/*jslint node: true */

'use strict';

// Moves the content of the upload folder in subfolders containing <zipSize> files or less
// input: list of all files in the upload folder
// Sub folders are named: uploadxx

// npm install archiver --save

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
  }

// require modules
var fs = require('graceful-fs');

// global variables and constants initialisation
var index = 0;
const zipSize = 10000;
const batch = 'upload2011-002'
const uploadFolder = "./destination/" + batch + "/";
var oldPath = "";
var newPath = "";
var newDir = "";

// loads the list of all files in the "upload folder"
var uploadFiles = fs.readdirSync(uploadFolder);
const numberOfFiles = uploadFiles.length;
// sorts the list of files:
uploadFiles = uploadFiles.sort();

// calculates the number of required sub folders based on the number of files per archives:
const zipNumb = Math.floor(numberOfFiles / zipSize) + 1;

console.log("Number of files: " + numberOfFiles + " - Number of sub folders: " + zipNumb);
for (var iSubF = 0 ; iSubF < zipNumb ; iSubF++) {
	newDir = uploadFolder + batch + "-" + iSubF.pad(2);
	if (!fs.existsSync(newDir)){
		fs.mkdirSync(newDir);
	}
};

for (var iZip = 0 ; iZip < zipNumb ; iZip++ ) {
    for (var ifile = 0 ; ifile < zipSize ; ifile++) {
        index = iZip*zipSize + ifile;
        if (index < numberOfFiles) {
            //console.log("Moving file # " + index + ": ./destination/upload/" + uploadFiles[index] + " to subfolder: " + iZip);
			oldPath = uploadFolder + uploadFiles[index];
			newPath = uploadFolder + batch + "-" + iZip.pad(2) + "/" + uploadFiles[index]
			fs.renameSync(oldPath, newPath);
        }
    };
}