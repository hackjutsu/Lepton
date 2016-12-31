'use strict'

import React from 'react'
import ReactDom from 'react-dom'
import ReqPromise from 'request-promise'
import SnippetTable from './components/snippetTable'
import Account from '../configs/account'

const user_gists_uri = 'https://api.github.com/users/hackjutsu/gists'

let gistStore = {}

function makeOption(uri) {
    return {
        uri: uri,
        headers: {
            'User-Agent': 'Request-Promise',
        },
        auth: { // HTTP Authentication
            user: Account.username,
            pass: Account.password
        },
        json: true // Automatically parses the JSON string in the response
    }
}

function updateGistStore(gist) {
    // console.log("updateGistStore is called")
    Object.assign(gistStore, gist)
}

ReqPromise(makeOption(user_gists_uri))
    .then((gistList) => {
        console.log("The length of the gist list is " + gistList.length)
		gistList.forEach((gist) => {

            gistStore[gist.id] = {
                brief: gist,
                details: null
            }

            ReactDom.render(
                <SnippetTable gistStore={ gistStore } updateGistStore={ updateGistStore } />,
                document.getElementById('app')
            )
		})
    })
    .catch(function (err) {
		console.log('The request has failed: ' + err)
    })


console.log('hello')
