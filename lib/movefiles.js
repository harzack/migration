/*jslint node: true */

'use strict';

// Moves the content of the 'uploadFolder' folder in subfolders created in the 'destFolder' folder
// and containing 'zipSize' files or less
// input: list of all files in the upload folder
// Sub folders are named: uploadxx with xx being the iteration calculated based on 'zipSize'
// and the total number of files.

// npm install archiver --save

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
  };

// require modules
var fs = require('graceful-fs');

// set global variables and constants initialisation
// modify 'zipSize' to the amount of files you want in the folders
var index = 0;
const zipSize = 10000;
const destFolder = './destination/';
const uploadFolder = './destination/upload/';
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

// creates all destination folders first:
console.log("Number of files: " + numberOfFiles + " - Number of sub folders: " + zipNumb);
for (var iSubF = 0 ; iSubF < zipNumb ; iSubF++) {
	newDir = destFolder + "upload" + iSubF.pad(2);
	if (!fs.existsSync(newDir)){
		fs.mkdirSync(newDir);
	}
}

// move all the files synchronously in the folders created above:
// first loop goes through all destination folders one at a time
// second loop moves the specified amount of files in the current folder
for (var iZip = 0 ; iZip < zipNumb ; iZip++ ) {
    for (var ifile = 0 ; ifile < zipSize ; ifile++) {
        index = iZip*zipSize + ifile;
        if (index < numberOfFiles) {
            // console.log("Moving file # " + index + ": " + uploadFolder + uploadFiles[index] + " to subfolder: " + iZip);
			oldPath = uploadFolder + uploadFiles[index];
			newPath = destFolder + "upload" + iZip.pad(2) + "/" + uploadFiles[index];
			fs.renameSync(oldPath, newPath);
        }
    }
}