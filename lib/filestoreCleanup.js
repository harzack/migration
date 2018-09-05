// clean file store and build file store data

var path = require('path');
var fs = require('fs'); 

var filestoreBaseDir = './filestore/';

var delimiter = path.delimiter;
// console.log('Delimiter: ' + delimiter);

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

// initialize the list of all files and directories :
var fileList = [];
var allUsersDir = [];

// reading the list of all user directories (knowing there is only 1 level in the RDIMS filestore)
var arrayOfUsersDir = fs.readdirSync(filestoreBaseDir);

// For each directory of user, read all the files and:
// if the file is a preview (.PR1), temporary (.tmp) or .db file, remove it, or
// add the file to the file list
arrayOfUsersDir.forEach( function (userDir) {
	var fullUserDir = filestoreBaseDir + userDir;
	var arrayofFiles = fs.readdirSync(fullUserDir);
	arrayofFiles.forEach( function (file){ 
		var singleFile = {};
		singleFile['directory'] = fullUserDir;
		singleFile['fileName'] = file;
		singleFile['fileExtension'] = fileExtension(file);
		if (singleFile.fileExtension == 'PR1' || singleFile.fileExtension == 'tmp' || singleFile.fileExtension == 'db' ) {
			var file2Delete = singleFile.directory + '/' + singleFile.fileName;
			fs.unlink(file2Delete, (err) => {
  				if (err) throw err;
  				console.log('successfully deleted' + file2Delete);
			})
		}
		else {
			fileList.push(singleFile)
		}
		
	});
    allUsersDir.push(userDir);
});

console.log('Final number of files = ' + fileList.length);

// convert the file list object into JSON
fileListJSON = JSON.stringify(fileList);


// write and save the JSON list into a file
fs.writeFile('./source/filesList.json', fileListJSON.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of files is saved!");
});
