'use strict'

import React from 'react';
import ReactDom from 'react-dom';
import ReqPromise from 'request-promise';
import Snippet from './components/snippet';

let gist_list = [];
let options = {
    uri: 'https://api.github.com/users/hackjutsu/gists',
    headers: {
        'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
};

ReqPromise(options)
    .then(function (gists) {
		gist_list = gists;
		console.log(gist_list.length);
		gist_list.forEach(function(gist) {
		     console.log(gist.html_url);
		});
        ReactDom.render(
            <Snippet html_url={gist_list[0].html_url}/>,
            document.getElementById('app')
        )
    })
    .catch(function (err) {
		console.log('The request has failed');
    });


console.log('hello');
