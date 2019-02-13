// start timestamp used to calculate the time spent processing.
const timestart = Date.now();

// multiple sources for the files:
// 'V:/" = \\VSNSBIOEDOCS01\EKMEDATA\Docsopen\MECTS
// 'W:/" = \\DFONK1AWVASP014\Archive\Docsopen\Mects
// 'X:/" =
// 'Y:/" =    
// 'Z:/" = \\svmonkenclu02\EKMEDATA\Docsopen\MECTS

var files   = [];

const path = require('path');
const fs = require('graceful-fs'); 
const filestoreBaseDir = './';
const delimiter = path.delimiter;

var statErrors = 0;
var statErrorFile = [];

function walkSync(currentDirPath, callback) {
    var fs = require('fs'),
        path = require('path');
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
		var fileExt = path.extname(name);
		
		// trying with only ppt files and folders :
		if (fileExt == "" || fileExt == ".PPT" || fileExt == ".ppt" || fileExt == ".pptx" || fileExt == ".PPTX") {
			try {
				var stat = fs.statSync(filePath);
				if (stat.isFile()) {
					callback(filePath, stat);
				} else if (stat.isDirectory()) {
					walkSync(filePath, callback);
				}
			}
			catch(err) {
				statErrors = statErrors + 1;
				statErrorFile.push(filePath);
				// console.log('Issue checking: ' + filePath);
			}
		} else {
			// do nothing in this case
		}
		
		/*
		if (fileExt == ".PR1" || fileExt == ".tmp" || fileExt == ".db" || fileExt ==  ".L@K" || name == "RPSS Telephone List.XLS" ) {
			// do nothing in this case
		} else {
			try {
				var stat = fs.statSync(filePath);
				if (stat.isFile()) {
					callback(filePath, stat);
				} else if (stat.isDirectory()) {
					walkSync(filePath, callback);
				}
			}
			catch(err) {
				statErrors = statErrors + 1;
				statErrorFile.push(filePath);
				// console.log('Issue checking: ' + filePath);
			}
		} 
		*/
    });
}

walkSync(filestoreBaseDir, function(filePath, stat) {
		var file = {};		
		file.dir = path.dirname(filePath);
		file.name = path.basename(filePath);
		file.extension = path.extname(filePath);
		files.push(file);
});

var fileListJSON = JSON.stringify(files, null, ' ');
var fileErrorsJSON = JSON.stringify(statErrorFile);
var fileNumber = files.length;

// write and save the JSON list into a file
fs.writeFile('./source/testFiles.json', fileListJSON.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of " + fileNumber + " files is saved!");
});

// write and save the JSON list into a file
fs.writeFile('./source/testFiles_errors.json', fileErrorsJSON.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of " + statErrors + " error files is saved!");
});

// end timestamp used to calculate the time spent processing.
const timeend = Date.now();
// Calculate the time spent processing and display it
const timespent = timeend - timestart;
console.log('Time spent processing: ' + timespent / 1000 + ' seconds');