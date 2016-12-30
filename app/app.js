'use strict'

const rp = require('request-promise');
let gist_list = [];

let options = {
    uri: 'https://api.github.com/users/hackjutsu/gists',
    headers: {
        'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
};

rp(options)
    .then(function (gists) {
		gist_list = gists;
		console.log(gist_list.length);
		gist_list.forEach(function(gist) {
		     console.log(gist.html_url);
		});
    })
    .catch(function (err) {
		console.log('The request has failed');
        // API call failed...
    });


console.log('hello');
