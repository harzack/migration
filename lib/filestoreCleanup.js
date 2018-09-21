// clean file store and build file store data

const path = require('path');
var fs = require('fs'); 

const filestoreBaseDir = './filestore/';

const delimiter = path.delimiter;

// my functions

// function returning the positions of each specified letter in a string, and last position is length of string:
function PositionsOfLetterInString(dname, dletter) {
    var sPos = [];
    for(var i=0; i < dname.length; i++) {
        if (dname[i] == dletter) {
        	 sPos.push(i);
        }
    };  
    sPos.push(dname.length + 1);
    return sPos	
}

// Function extracting the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var lengthofname = fName.length;
    var extension = fName.substring(dotpos[0]+1, lengthofname);
    return extension
}

// use the document number <-> file name conversion library and document lists
var edocs = require('./edocsconvert.js').edocs;

// loading the main JSON list of documents to import (result of RDIMS SQL extraction):
var documentsJSON = require('./../source/MCU_extract_007.json');

// loading the JSON list of EKME files and extensions (created with filestoreCode.js):
var filesListJSON = require('./../source/filesList.json');
// sorting list of files on fileName, in order to improve performances with binary search:
filesListJSON.sort(function(a,b) {
	if(a.fileName < b.fileName) return -1;
    if(a.fileName > b.fileName) return 1;
    return 0;
})
const FListLen = filesListJSON.length;

