// This program takes a list of document numbers (selected to be imported),
// copies the associated files from the filestore to a local disk
// builds the file list corresponding to the document numbers (will speed up the building of XML import document.
// need the author and document number to build the path to the file.

const path = require('path');
var fs = require('fs'); 

const filestoreBaseDir = 'Z:/';

const delimiter = path.delimiter;

// my functions

// function returning the positions of each specified letter in a string, and last position is length of string:
function PositionsOfLetterInString(dname, dletter) {
    var sPos = [];
    for(var i=0; i < dname.length; i++) {
        if (dname[i] == dletter) {
        	 sPos.push(i);
        }
    }
    sPos.push(dname.length + 1);
    return sPos;
}

// Function extracting the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var lengthofname = fName.length;
    var extension = fName.substring(dotpos[0]+1, lengthofname);
    return extension;
}

// use the document number <-> file name conversion library and document lists
var edocs = require('./edocsconvert.js').edocs;

// loading the main JSON list of documents to import (result of RDIMS SQL extraction):
var documentsJSON = require('./../source/EKME_1998-11-01_extract_001.json');

// initialize the list of all files and directories :
var fileList = [];
var allUsersDir = [];
var arrayOfUsersDir = [];
console.log("Variables declared");

/* reading the list of all user directories (knowing there is only 1 level in the RDIMS filestore)
if (fs.existsSync(filestoreBaseDir)) {
  fs.readdirSync(filestoreBaseDir).forEach(buildArrayOfUsers);
}



function buildArrayOfUsers(f) {
  var fPath = path.join(filestoreBaseDir, f);
  var stat = fs.statSync(fPath);
  if (stat.isDirectory()) {
    // if its a directory add it to array of users directory
    arrayOfUsersDir.push(fPath);
	console.log(fPath + " in the sub function to build array of users directories");
  }
}
*/

// List all files in a directory
/*
var walkSync = function(filestoreBaseDir, fileList) {
		files = fs.readdirSync(filestoreBaseDir);
	files.forEach(function(file) {
		if (fs.statSync(path.join(filestoreBaseDir, file)).isDirectory()) {
			fileList = walkSync(path.join(filestoreBaseDir, file), fileList);
			console.log("this is a directory");
		}
		else {
			fileList.push(path.join(filestoreBaseDir, file));
			console.log("adding a file");
		}
	});
	return fileList;
};
*/

function walkSync(dir) {
    const files = fs.readdirSync(dir);
	var fileList = [];
	
    for (const file of files) {
        const pathToFile = path.join(dir, file);
        fs.stat(pathToFile, function(err,data) {
			// if an error occurs, write in the console
			if(err) {
				console.log("error reading stats on: " + file);
				return;
			}
			// otherwise perform actions
			else {
				const isDirectory = data.isDirectory();
				if (isDirectory) {
					fileList = walkSync(path.join(dir, file), fileList);
				} else {
					fileList.push(path.join(dir, file));
				}
			}
		}
		);
    }
	
	return fileList;
}

fileList = walkSync(filestoreBaseDir);

console.log(fileList.length);

// For each directory of user, read all the files and:
// if the file is a preview (.PR1), temporary (.tmp) or .db file, skip it.
// add the file to the file list
/*
arrayOfUsersDir.forEach( function (userDir) {
	var fullUserDir = filestoreBaseDir + userDir;
	var arrayofFiles = fs.readdirSync(fullUserDir);
	arrayofFiles.forEach( function (file){ 
		var singleFile = {};
		singleFile['directory'] = fullUserDir;
		singleFile['fileName'] = file;
		singleFile['fileExtension'] = fileExtension(file);
		if (singleFile.fileExtension != 'PR1' || singleFile.fileExtension != 'tmp' || singleFile.fileExtension != 'db' ) {
			fileList.push(singleFile)
		}
		
	});
    allUsersDir.push(userDir);
});
*/
console.log('Total number of files added = ' + fileList.length);

// convert the file list object into JSON
fileListJSON = JSON.stringify(fileList);


// write and save the JSON list into a file
fs.writeFile('./source/filesList_1998-11-01.json', fileListJSON.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of files is saved!");
});

/*// loading the JSON list of EKME files and extensions (created with filestoreCode.js):
var filesListJSON = require('./../source/filesList_1998-11-01.json');
// sorting list of files on fileName, in order to improve performances with binary search:
filesListJSON.sort(function(a,b) {
	if(a.fileName < b.fileName) return -1;
    if(a.fileName > b.fileName) return 1;
    return 0;
})
const FListLen = filesListJSON.length;

*/