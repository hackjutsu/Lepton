'use strict'

import React from 'react'
import ReactDom from 'react-dom'
import ReqPromise from 'request-promise'
import NavigationPanel from './components/navigationPanel'
import NavigationPanelDetails from './components/navigationPanelDetails'
import SnippetTable from './components/snippetTable'
import Account from '../configs/account'

const user_gists_uri = 'https://api.github.com/users/hackjutsu/gists'

let gistStore = {}
let langsTags = {}
let activeTag = ''

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

            let langs = new Set()

            for (let key in gist.files) {
                if (gist.files.hasOwnProperty(key)) {
                    let file = gist.files[key]
                    let language = file.language
                    langs.add(language)
                    if (langsTags.hasOwnProperty(language)) {
                        langsTags[language].add(gist.id)
                    } else {
                        if (!activeTag) activeTag = language
                        langsTags[language] = new Set()
                        langsTags[language].add(gist.id)
                    }
                }
            }

            gistStore[gist.id] = {
                langs: langs,
                brief: gist,
                details: null
            }

            ReactDom.render(
                <NavigationPanel langTags={ langsTags } />,
                document.getElementById('panel')
            )

            ReactDom.render(
                <NavigationPanelDetails langTags={ langsTags } activeTag={ activeTag } />,
                document.getElementById('panel-details')
            )

            ReactDom.render(
                <SnippetTable gistStore={ gistStore } updateGistStore={ updateGistStore } />,
                document.getElementById('app')
            )
		}) //gistList.forEach
    })
    .catch(function (err) {
		console.log('The request has failed: ' + err)
    })


console.log('hello')
