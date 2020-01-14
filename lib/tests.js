/*jslint node: true */

'use strict';


// Include file system libraries to build the file:
var fs = require('graceful-fs'); 

// const fileList = './../source/filesListAllAAFC.JSON';
// const fileList = './../source/mbwinnimpdoc01-docsdata.JSON';
// const fileList = './../source/mbwinnimpdoc01-docsdata4.JSON';
// const fileList = './../source/mbwinnimpdoc01-docsdata2.JSON';
// const fileList = './../source/mbwinnimpdoc01-docsdata3.JSON';
// const fileList = './../source/onottaimpdoc01-docsdata.JSON';
// const fileList = './../source/onottaimpdoc01-docsdata2.JSON';
// const fileList = './../source/onottaimpdoc01-docsfdms.JSON';
// const fileList = './../source/onottaimpdoc01-docsfdms2.JSON';
// const fileList = './../source/testFiles.json';
/* const fileList = './../source/testFiles2.json';

// loading the JSON list of RDIMS files and extensions (created with filestoreCode.js):
var filesListJSON = require(fileList);
// sorting list of files on name, in order to improve performances with binary search:
// using lower cases to compare as some file names have either upper or lower cases but
// calculated file names are always lower case.

filesListJSON.sort(function(a,b) {
	if(a.name.toLowerCase() < b.name.toLowerCase()) return -1;
    if(a.name.toLowerCase() > b.name.toLowerCase()) return 1;
    return 0;
});
const FListLen = filesListJSON.length;
console.log('length of file list: '+ FListLen);
 */


var fSource = './filestore/AMIRAULTD/2b_@501!.docx';
var fDestination = './destination/upload/monBeaudocumenté.docx';
console.log('Source: ' + fSource + ' | Target: ' + fDestination);
fs.createReadStream(fSource).pipe(fs.createWriteStream(fDestination));
//console.log(Date.getTime() / 1000);
const atime = new Date('2014-05-28 19:20:02');
const mtime = new Date('2014-05-24 19:20:02');

fs.stat(fDestination, function(err, stats) {
    console.log(stats.isDirectory());
    console.log(stats);
});

fs.utimes(fDestination, atime, mtime, function(err, data) {
    if (err) throw err;
});

fs.stat(fDestination, function(err, stats) {
    console.log(stats.isDirectory());
    console.log(stats);
});