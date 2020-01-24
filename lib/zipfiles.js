/*jslint node: true */

'use strict';

// zip the content of the upload folder in archives containing 1000 files or less
// input: list of all files in the upload folder
// archives are named: uploadxx.zip

// npm install archiver --save

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
  }

var fs = require('graceful-fs');
var archiver = require('archiver');
var index = 0;
const zipSize = 10000;
const uploadFolder = './destination/upload/';

var uploadFiles = fs.readdirSync(uploadFolder);
const numberOfFiles = uploadFiles.length;

const zipNumb = Math.floor(numberOfFiles / zipSize) + 1;

console.log("Number of files: " + numberOfFiles + " - Number of zip files: " + zipNumb);

for (var i = 0 ; i < zipNumb ; i++ ) {
    var output = fs.createWriteStream('upload'+ i.pad(2) +'.zip');
    var archive = archiver('zip' , {
        zlib: { level: 9 } // Sets the compression level.
      });
    output.on('close', function () {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');
    });

    archive.on('error', function(err){
        throw err;
    });

    archive.pipe(output);
    for (var ifile = 0 ; ifile < zipSize ; ifile++) {
        index = i*10 + ifile;
        if (index <= numberOfFiles) {
            console.log("Adding file: " + uploadFiles[index] + " to archive: " + i);
            archive.file("./destination/upload/" + uploadFiles[index] );
        }
    }
    
    archive.finalize();
}