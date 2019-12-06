/*jslint node: true */

'use strict';


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
const fileList = './../source/testFiles2.json';

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

