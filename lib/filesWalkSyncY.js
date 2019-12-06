// start timestamp used to calculate the time spent processing.
const timestart = Date.now();

// multiple sources for the files, map network drives as follow:
// 'V:/" = \\VSNSBIOEDOCS01\EKMEDATA\Docsopen\MECTS
// 'W:/" = \\DFONK1AWVASP014\Archive\Docsopen\Mects
// 'X:/" = \\svmonkenclu02\EKMEDATA\4MDocs\NATIONALCAPITALFM
// 'Y:/" = \\VSBCIOSEDOCS01\EKMEdata\Docsopen\MECTS
// 'Z:/" = \\svmonkenclu02\EKMEDATA\Docsopen\MECTS
const driveLetter = 'Y';
const allFiles = './source/AllFiles' + driveLetter + '.json';
const allFilesErrors = './source/AllFiles' + driveLetter + '_errors.json';

var files   = [];

const path = require('path');
const fs = require('fs-extra'); 
const klawSync = require('klaw-sync')
const filestoreBaseDir = driveLetter + ':/';
const delimiter = path.delimiter;

var statErrors = 0;
var statErrorFile = [];


// *******************************
// ******** My functions *********
// *******************************
// (list of useful functions used in other functions):

// function to count the number of specified letter found in a string:
function NumberOfLetterInString(dname, dletter) {
    var nletter = 0;
    for (var i=0; i < dname.length; i++) {
    		if (dname[i] == dletter) {
    			nletter += 1;
    		}
    	}
    return nletter	
}

// function returning the positions of each specified letter in a string, and last position is length of string:
function PositionsOfLetterInString(dname, dletter) {
    var sPos = [];
    // console.log('Debug dname, dletter :' + dname +  ' - ' + dletter);
    for(var i=0; i < dname.length; i++) {
        if (dname[i] == dletter) {
        	 sPos.push(i);
        }
    };  
    sPos.push(dname.length + 1);
    return sPos	
}

// Function returning the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var extension = fName.toString().substring(dotpos[0]+1, fName.length);
    return extension
}

// *******************************
// ***** End of my functions *****
// *******************************

try {
  const klawfiles = klawSync(filestoreBaseDir, {nodir: true});
  paths = klawfiles.map( a => a.path);
  for (i = 0; i < paths.length ; i++) {
		var file = {};
		slashpos = PositionsOfLetterInString(paths[i], '\\');
		lastSlash = slashpos.length - 2;
		file.dir = paths[i].substring(0 , slashpos[lastSlash] );
		file.name = paths[i].substring(slashpos[lastSlash] + 1 ,paths[i].length);
		file.extension = '.' + fileExtension(file.name);
		if (file.extension == ".PR1" || file.extension == ".tmp" || file.extension == ".db" || file.extension ==  ".L@K") {
			// do nothing in this case
		}
		else {
			files.push(file);
			}
	} 
} catch (err) {
  statErrors = statErrors + 1;
  console.log(err);
}

var fileListJSON = JSON.stringify(files, null, ' ');
var fileErrorsJSON = JSON.stringify(statErrorFile);
var fileNumber = files.length;

// write and save the JSON list into a file
fs.writeFile(allFiles, fileListJSON.toString({
	pretty: true
}), function (err) {
	if (err) {
		return console.log(err);
	}
	console.log("the list of " + fileNumber + " files is saved!");
});

// write and save the JSON list into a file
fs.writeFile(allFilesErrors, fileErrorsJSON.toString({
	pretty: true
}), function (err) {
	if (err) {
		return console.log(err);
	}
	console.log("the list of " + statErrors + " error files is saved!");
});

// end timestamp used to calculate the time spent processing.
const timeend = Date.now();
// Calculate the time spent processing and display it
const timespent = timeend - timestart;
console.log('Time spent processing: ' + timespent / 1000 + ' seconds');