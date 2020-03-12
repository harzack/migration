'use strict';

const fs = require('fs');
const readline = require('readline');

// function to count the number of specified letter found in a string:
function NumberOfLetterInString(dname, dletter) {
    var nletter = 0;
    for (var i=0; i < dname.length; i++) {
    		if (dname[i] == dletter) {
    			nletter += 1;
    		}
    	}
    return nletter;
}

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

// Function extracting the extention of a filename using ES6 arrow function notation (to test):
const fileExtensionES6 = fName => fName.substring(PositionsOfLetterInString(fName, '.')[0], fName.length);


function convert(file) {

    return new Promise((resolve, reject) => {

        const stream = fs.createReadStream(file);
        // Handle stream error (IE: file not found)
        stream.on('error', reject);

        const reader = readline.createInterface({
            input: stream
        });

        const array = [];

        reader.on('line', line => {
            // transform from this: S:\AAFCAAC\YEOL\2m9r701!.DOC to this: {"dir": "S:\AAFCAAC\YEOL\", "name": "2m9r701!.DOC", "extension": ".DOC"}
			const slashPos = PositionsOfLetterInString(line, '\\');
			const slashNumb = slashPos.length;
			const fileName = line.slice(slashPos[slashNumb-2]+1);
			const fileExt = fileExtensionES6(fileName);
			const fileDir = line.slice(0, slashPos[slashNumb-2]+1);
			//console.log('Line length: ' + (line.length - 1) + ' - last slash at: ' + slashPos[slashNumb-2]);
			//console.log('fileName: '  + fileName + ' - fileExt: '  + fileExt + ' - fileDir: '  + fileDir);
			// excluding PR1 files:
			if (fileExt != '.PR1') {
				var JSONLine = {"dir": fileDir, "name": fileName, "extension": fileExt};
				//console.log(JSONLine);
				array.push(JSONLine);
			};
        });

        reader.on('close', () => resolve(array));
    });
}


convert('G:\\source\\files2011.txt')
    .then(res => {
        //console.log(res);
        var JSONAllFiles = "G:\\source\\filesList2011.JSON";
		fs.writeFile(JSONAllFiles, '', function (err) {
			if (err) {
				return console.log(err);
			}
		});
		// write the list of files not copied to a log:
		fs.appendFile(JSONAllFiles, JSON.stringify(res, null, 2), function (err) {
			if (err) {
				return console.log(err);
			}
		console.log("the list of files is saved!");
		});
    })
    .catch(err => console.error(err));