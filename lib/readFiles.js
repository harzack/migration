const path = require('path');
const fs = require('fs'); 
const filestoreBaseDir = 'Z:/';
const delimiter = path.delimiter;

var fileList = [];

console.log("Variables declared");

fs.readdirSync(filestoreBaseDir, function (err, items) {
  if (err)
    throw err;
  if (items) {
	  var curentDir = filestoreBaseDir;
	  for (var i=0; i<items.length; i++) {
        var item = curentDir + items[i];
		console.log("current item: " + item);
		var itemName = items[i];
		var file = {};
		fs.statSync(item, function(err, stats) {
			if(err) {
				throw(err);
			}
			if (stats) {
				if (!stats.isDirectory()){
					file.path = curentDir;
					file.Name = itemName;
					file.size = stats["size"];
			
					fileList.push(file)
					console.log(file);
				}
				else {
					// curentDir = curentDir + '/' + stats;
				}

			}
            
        });
		

	  }
		//fileList.push(items.toString('utf8'));
	  }
});

/*var fileListJSON = JSON.stringify(fileList);

// write and save the JSON list into a file
fs.writeFile('./source/filesList_1998-11-01.json', fileListJSON.toString({ pretty: true }), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of files is saved!");
});

*/