'use strict'

import { Promise } from 'bluebird'
import Request from 'request'

function makeOptionForGetAllGists (accessToken, userLoginId, pageNumber) {
  return {
    uri: 'https://api.github.com/users/' + userLoginId + '/gists',
    headers: {
      'User-Agent': 'request',
    },
    method: 'GET',
    qs: {
      access_token: accessToken,
      page: pageNumber
    },
    json: true
  }
}

function getAllgists (accessToken, userLoginId) {
  let gistList = []
  return new Promise(function (resolve, reject) {
    const maxPageNumber = 20
    let funcs = Promise.resolve(
      makeRangeArr(1, maxPageNumber).map(
        (n) => makeRequestForGetAllGists(makeOptionForGetAllGists(accessToken, userLoginId, n))))

    funcs.mapSeries(iterator)
      .catch(err => {
        // intentionally left blank
      })
      .finally(() => {
        resolve(gistList)
      })
  })

  function iterator (f) {
    return f()
  }

  function makeRequestForGetAllGists (option) {
    return function () {
      return new Promise(function (resolve, reject) {
        Request(option, function (error, response, body) {
          console.log(body.length)
          if (error) {
            reject(error)
          } else if (body.length === 0) {
            reject('page empty')
          } else {
            for (let key in body) {
              if (body.hasOwnProperty(key)) {
                gistList.push(body[key])
              }
            }
            resolve(body)
          }
        })
      })
    }
  }
}

function makeRangeArr (start, end) {
  let result = []
  for (let i = start; i <= end; i++) result.push(i)
  return result
}

export const GET_ALL_GISTS = 'GET_ALL_GISTS'
export const GET_SINGLE_GIST = 'GET_SINGLE_GIST'
export const GET_USER_PROFILE = 'GET_USER_PROFILE'
export const CREATE_SINGLE_GIST = 'CREATE_SINGLE_GIST'
export const EDIT_SINGLE_GIST = 'EDIT_SINGLE_GIST'

export function getGitHubApi (selection) {
  console.log('Inside getGitHubApi')
  switch (selection) {
    case GET_ALL_GISTS:
      return getAllgists
    default:

  }
}

// test
// let accessToken = '04de802f7b8f123fdf4e427d2afe78b6e49d7929'
// let rq = getAllgists(accessToken, 'hackjutsu')
//
// rq.then(gistList => {
//     console.log(gistList.length)
// })
