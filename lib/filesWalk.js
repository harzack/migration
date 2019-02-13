var walk    = require('walk');
var files   = [];

const path = require('path');
const fs = require('fs'); 
const filestoreBaseDir = 'Z:/';
const delimiter = path.delimiter;

// Walker options
var walker  = walk.walk(filestoreBaseDir, { followLinks: false });

walker.on('file', function(root, stat, next) {
    // Add this file to the list of files
    files.push(root + '/' + stat.name);
    next();
});

walker.on('end', function() {
    console.log(files);
});