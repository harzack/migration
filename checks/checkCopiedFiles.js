/*jslint node: true */

'use strict';

var fs = require('fs'); 
var missedFiles = 0;
var goodFiles = 0;

// loading the JSON list of documents:
var documentsList = require('./listof2008files.json');
const FListLen = documentsList.length;
var xmlFileList = require('./2008ListOfXMLFiles.json');
const xmlListLen = xmlFileList.length;

// sorting list of files on name, in order to improve performances with binary search:
// using lower cases to compare as some file names have either upper or lower cases but
// calculated file names are always lower case.
documentsList.sort(function (a, b) {
	if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
	if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
	return 0;
});

// *******************************
// ******** My functions *********
// *******************************
// (list of useful functions used in other functions):

// function returning the positions of each specified letter in a string, and last position is length of string:
function PositionsOfLetterInString(dname, dletter) {
	var sPos = [];
	// console.log('Debug dname, dletter :' + dname +  ' - ' + dletter);
	for (var i = 0; i < dname.length; i++) {
		if (dname[i] == dletter) {
			sPos.push(i);
		}
	}
	sPos.push(dname.length + 1);
	return sPos;
}

// Function returning a filename without the extension:
function removeFileExtension(fName) {
	var dotpos = PositionsOfLetterInString(fName, '.');
	var cleanName = fName.toString().substring(0, dotpos[0]);
	return cleanName;
}

// *******************************
// ***** End of my functions *****
// *******************************


const realFile = (fileList, FileName, start, end) => {
	const middle = Math.floor((start + end) / 2);

	if (removeFileExtension(fileList[middle].name).toLowerCase() == removeFileExtension(String(FileName)).toLowerCase()) {
		return (true);
	}
	if ((end - 1) === start) {
		return (false);
	}
	if (removeFileExtension(fileList[middle].name.toLowerCase()) < removeFileExtension(String(FileName)).toLowerCase()) {
		return realFile(fileList, FileName, middle, end);
	}
	if (removeFileExtension(fileList[middle].name.toLowerCase()) > removeFileExtension(String(FileName)).toLowerCase()) {
		return realFile(fileList, FileName, start, middle);
	}
};

for (var iter = 0 ; iter < xmlListLen ; iter++ ) {
	if(!realFile(documentsList,xmlFileList[iter].name,0,FListLen)) {
		missedFiles += 1;
		console.log(xmlFileList[iter].name + ' not found... ');
	} else {
		goodFiles +=1;
	}
}

console.log('Total nodes: ' + xmlListLen + ' | files found: ' + goodFiles + ' | file(s) not found: ' + missedFiles);