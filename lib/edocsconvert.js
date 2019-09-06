var docNumbers = {
	_numbers: [],
	_versions: [],
	_subversions: [],
	_extensions: [],
	addNumber: function(docsNumber){
		this._numbers.push(docsNumber);
	},
	addVersion: function(version){
		this._versions.push(version);
	},
	addSubVersion: function(subVersion){
		this._subversions.push(subVersion);
	},
	addExtension: function(extension){
		this._extensions.push(extension);
	},
	num2DOCSEnh: function(){
		var filenames = [];
		for (var i=0; i< this._numbers.length; i++){
			var curNumber = this._numbers[i];
			filenames[i] = "";
			while(curNumber >= 1){
				var mod36 = curNumber % 36;
				if (mod36 < 10)
				{ filenames[i] += mod36; }
				else if (mod36 === 10)
				{ filenames[i] += "@"; }
				else if (mod36 === 14)
				{ filenames[i] += "#"; }
				else if (mod36 === 18)
				{ filenames[i] += "$"; }
				else if (mod36 == 24)
				{ filenames[i] += "_"; }
				else if (mod36 === 30)
				{ filenames[i] += "%"; }
				else
				{ filenames[i] += String.fromCharCode(mod36 + 55); }
		
				curNumber = (curNumber - mod36) / 36;
			}
			filenames[i] = filenames[i].toLowerCase();
			filenames[i] = reverse(filenames[i])+pad2(this._versions[i])+this._subversions[i]+"."+this._extensions[i];
		}

		return filenames;
	},
	Num2DOCSunix: function() {
		var filenames = [];
		for (var i=0; i< this._numbers.length; i++){
			var curNumber = this._numbers[i];
			filenames[i] = "";
			while(curNumber >= 1){
				var mod32 = curNumber % 32;
				if (mod32 < 10)
				{ filenames[i] += mod32; }
				else if (mod32 === 10)
				{ filenames[i] += "W"; }
				else if (mod32 === 14)
				{ filenames[i] += "X"; }
				else if (mod32 === 18)
				{ filenames[i] += "Y"; }
				else if (mod32 == 24)
				{ filenames[i] += "Z"; }
				else if (mod32 === 30)
				{ filenames[i] += "_"; }
				else
				{ filenames[i] += String.fromCharCode(mod32 + 55); }
		
				curNumber = (curNumber - mod32) / 32;
			}
			filenames[i] = filenames[i].toLowerCase();
			filenames[i] = reverse(filenames[i])+pad2(this._versions[i])+"_."+this._extensions[i];
		}
		return filenames;
	},
	reset: function(){
		this._numbers = [];
		this._versions = [];
		this._subversions = [];
		this._extensions = [];
	}
};

var docFiles = {
	_fileNames: [],
	addFileName: function(filename){
		this._fileNames.push(filename);
	},
	extractExtensions: function (){
		var extensions = [];
		for (var i=0; i< this._fileNames.length; i++){
			extPos = this._fileNames[i].lastIndexOf(".");
			extensions[i] = this._fileNames[i].slice(extPos+1, this._fileNames[i].length);
		}
		return extensions;
	},
	extractVersions: function (){
		var versions = [];
		for (var i=0; i< this._fileNames.length; i++){
			extPos = this._fileNames[i].lastIndexOf(".");
			versions[i] = pad2(Number(this._fileNames[i].slice(extPos-3, extPos-1)));
		}
		return versions;
	},
	extractNumbers: function (){
		var numbers = [];
		for (var i=0; i< this._fileNames.length; i++){
			extPos = this._fileNames[i].lastIndexOf(".");
			fileMethod = this._fileNames[i].slice(extPos-1, extPos);
			if (fileMethod === "!"){
				numbers[i] = DOCSEnh2Num(this._fileNames[i].slice(0, extPos-3));
			}
			else if (fileMethod === "_") {
				numbers[i] = DOCSUnix2Num(this._fileNames[i].slice(0, extPos-3));
			}
			else {
				numbers[i] = "invalid_name";
			}	
		}
		return numbers;
	},
	reset: function(){
		this._fileNames = [];
	}
};

exports.edocs = docNumbers;
exports.files = docFiles;

function pad2(number) {
     return (number < 10 ? '0' : '') + number;
}

function reverse(s) {
    return s.split("").reverse().join("");
}

// Convert DOCS filename to document number using enhanced filing scheme
function DOCSEnh2Num(filename) {
	    var docnum = 0;
	    var c = "";
	    var numbersRegex = /[0-9]/;
	    var lettersRegex = /[ABCDEFGHIJKLMNOPQRSTUVWXYZ]/;
	    
	    // Calculate doc number from characters
	    for (j = 1;  j < filename.length+1; j++){
        	docnum *= 36;
        	c = filename.slice(j-1,j).toUpperCase();
        	if (!!numbersRegex.test(c)) {
				docnum += Number(c);
            }
			else if (!!lettersRegex.test(c)) {
				docnum = docnum + c.charCodeAt(0) - 55;
				}
			else if (c === "@") {
				docnum += 10;
				}
			else if (c === "#") {
				docnum += 14;
				}
			else if (c === "$") {
				docnum += 18;
				}
			else if (c === "_") {
				docnum += 24;
				}
			else if (c === "%") {
				docnum += 30;
				}
			else {
				docnum = 0;
				}
        }
	    return docnum;
}

// Convert DOCS filename to document number using unix filing scheme
function DOCSUnix2Num(filename) {
    	var docnum = 0;
    	var c = "";
	    var numbersRegex = /[0-9]/;
	    var lettersRegex = /[ABCDEFGHIJKLMNOPQRSTUV]/;
	    // Calculate doc number from characters
	    for (j = 1;  j < filename.length+1; j++){
        	docnum *= 32;
			c = filename.slice(j-1,j).toUpperCase();
			if (!!numbersRegex.test(c)) {
				docnum += Number(c);
            }
			else if (!!lettersRegex.test(c)) {
				docnum = docnum + c.charCodeAt(0) - 55;
				}
			else if (c === "W") {
				docnum += 10;
				}
			else if (c === "X") {
				docnum += 14;
				}
			else if (c === "Y") {
				docnum += 18;
				}
			else if (c === "Z") {
				docnum += 24;
				}
			else if (c === "_") {
				docnum += 30;
				}
			else {
				docnum = 0;
				}				
			}
    return docnum;
}
