/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   42_api.js                                          :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: elebouch <elebouch@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2018/02/19 21:07:36 by elebouch          #+#    #+#             */
/*   Updated: 2018/03/05 15:58:33 by elebouch         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

const {
  postMessage,
  postUserMessage,
  sendReaction,
  fileUpload,
  postOnThread,
  getUsername,
  postAttachments
} = require('./slack_api')
const rq = require('./request').rq
const ClientOAuth2 = require('client-oauth2')
const { month } = require('./const')
const moment = require('moment')
const sprintf = require('sprintf-js').sprintf

const forty2auth = new ClientOAuth2({
  clientId: process.env.INTRA_CLIENT_ID,
  clientSecret: process.env.INTRA_SECRET,
  accessTokenUri: 'https://api.intra.42.fr/oauth/token'
})

const request42 = async url => {
  var url = 'https://api.intra.42.fr' + url
  const token = await forty2auth.credentials.getToken()
  var options = {
    uri: url,
    qs: {
      access_token: token.data.access_token
    },
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true // Automatically parses the JSON string in the response
  }
  try {
    return await rq(options)
  } catch (err) {
    return null
  }
}

const alliance = async channel => {
  const json = await request42('/v2/coalitions')
  json.sort(function(a, b) {
    return a.score < b.score
  })
  let rang = 0
  while (json[rang]['id'] !== 2) rang += 1
  if (rang === 0) {
    const diff = json[rang]['score'] - json[1]['score']
    postMessage(`Felicitations Nous sommes premiers avec ${rang + 1} points d'avance. :the-alliance:`, channel)
  } else {
    const diff = json[0]['score'] - json[rang]['score']
    postMessage(`Nous sommes à la ${rang + 1}eme place avec ${diff} points de retard. :the-alliance:`, channel)
  }
}

const score = async channel => {
  const json = await request42('/v2/coalitions')
  json.sort(function(a, b) {
    return a.score < b.score
  })
  var reply = ''
  for (let coa of json) {
    reply += '${name} ${score}\n'
  }
  var attachments = [
    {
      fallback: reply,
      color: json[0]['color'],
      author_link: 'https://profile.intra.42.fr/blocs/1/coalitions',
      fields: [
        {
          title: json[0]['name'],
          value: json[0]['score'],
          short: true
        },
        {
          title: json[1]['name'],
          value: String(json[1]['score'] + ' (' + Number(json[1]['score'] - json[0]['score']) + ')'),
          short: true
        },
        {
          title: json[2]['name'],
          value: String(json[2]['score'] + ' (' + Number(json[2]['score'] - json[0]['score']) + ')'),
          short: true
        },
        {
          title: json[3]['name'],
          value: String(json[3]['score'] + ' (' + Number(json[3]['score'] - json[0]['score']) + ')'),
          short: true
        }
      ],
      footer: 'Powered by Coalibot'
    }
  ]
  postAttachments('', attachments, channel)
}

const get_range_logtime = async (user, range_begin, range_end) => {
  range_begin = moment(range_begin).format('YYYY-MM-DD')
  range_end = moment(range_end).format('YYYY-MM-DD')
  range_date = `?page[size]=100&range[begin_at]=${range_begin},${range_end}`
  url = `/v2/users/${user}/locations/${range_date}`
  const data = await request42(url)
  if (range_begin === range_end) {
    return moment.duration(0)
  }
  try {
    async function get_more(data) {
      let tmp
      let i = 2
      let ret = data
      do {
        last_location = moment(ret[ret.length - 1]['begin_at'])
        if (moment(range_begin).isBefore(last_location)) {
          tmp = await request42(url + '&page[number]=' + i)
          if (tmp) {
            ret = ret.concat(tmp)
          }
          i += 1
        } else {
          return ret
        }
      } while (tmp && tmp.length)
      return ret
    }
    let locations = await get_more(data)
    let logtime = moment.duration(0)
    for (let x of locations) {
      if (x['end_at']) log_end = moment(x['end_at'])
      else log_end = moment()
      log_start = moment(x['begin_at'])
      log_session = log_end - log_start
      logtime.add(log_session)
    }
    return logtime
  } catch (e) {
    return moment.duration(0)
  }
}

const format_output_datetime = time => {
  const timem = Number(time.as('minutes'))
  const hours = Math.floor(timem / 60)
  const min = Math.floor(timem % 60)
  return [hours, min]
}

const profil = async (msg, channel, usr) => {
  let user
  if (msg.split(' ').length > 2) user = msg.split(' ')[2]
  else {
    let username = await getUsername(usr)
    try {
      user = username['user']['email'].strsub(0, username['user']['email'].indexOf('@'))
    } catch (err) {
      user = username['user']['name']
    }
  }
  url = '/v2/users/' + user
  urlcoal = url + '/coalitions/'
  const data = await request42(url)
  let lvl = 1
  const coaldata = await request42(urlcoal)
  if (!data) {
    postMessage('invalid login', channel)
    return
  }
  let lvlpiscine = 0
  if (data['pool_year'] === '2013' || data['pool_year'] === '2014') {
    lvlpiscine = 0
  } else if (data['cursus_users'].length === 1) {
    lvlpiscine = data['cursus_users'][0]['level']
    lvl = 0
  } else lvlpiscine = data['cursus_users'][1]['level']
  let coalslug = ''
  if (coaldata.length) coalslug = ':' + coaldata[0]['slug'] + ':'
  range_end = moment()
  range_begin = moment().subtract(7, 'days')
  const logtime = await get_range_logtime(user, range_begin, range_end)
  const time = format_output_datetime(logtime)
  graph = 'https://projects.intra.42.fr/projects/graph?login=' + user
  const stage = (data => {
    const ret = {
      finished: 'A fait son',
      in_progress: 'En cours de'
    }
    const u = data.projects_users.find(d => d.project.id === 118)
    return u ? ret[u['status']] : "N'a pas fait son"
  })(data)
  postMessage(
    sprintf(
      '%s %s\nPhoto: `%s`\nTemps de log cette semaine %02d:%02d\nNiveau: %.2f\nNiveau piscine  %.2f %s %s\n%s stage\nGraph: %s',
      data['displayname'],
      coalslug,
      data['image_url'],
      time[0],
      time[1],
      lvl === 0 ? 0 : data['cursus_users'][0]['level'],
      lvlpiscine,
      data['pool_month'],
      data['pool_year'],
      stage,
      graph
    ),
    channel
  )
}

const logtime = async (message, channel, ts) => {
  if (message.split(' ').length < 4) {
    postOnThread('Usage: bc logtime login datedebut datefin (date au format "Y-M-D")', channel, ts)
  } else if (
    message.split(' ').length === 4 &&
    !isNaN(message.split(' ')[3]) &&
    parseInt(message.split(' ')[3]) > 2012
  ) {
    let date_begin = moment({
      y: parseInt(message.split(' ')[3]),
      M: 0,
      d: 1
    })
    let date_end = moment({
      y: parseInt(message.split(' ')[3]),
      M: 11,
      d: 31
    })
    const logtime = await get_range_logtime(message.split(' ')[2], date_begin, date_end)
    const time = format_output_datetime(logtime)
    postOnThread(sprintf(`%02dh%02d`, time[0], time[1]), channel, ts)
  } else if (
    message.split(' ')[3].includes('trimestre') &&
    (message.split(' ').length === 4 || (message.split(' ').length === 5 && parseInt(message.split(' ')[4]) > 2012))
  ) {
    let quarter = parseInt(message.split(' ')[3].replace('trimestre', '')) - 1
    let year
    if (message.split(' ').length === 5 && parseInt(message.split(' ')[4]) > 2012)
      year = parseInt(message.split(' ')[4])
    else year = new Date().getFullYear()
    let date_begin = moment(new Date(year, quarter * 3, 1))
    let date_end = moment(new Date(year, date_begin.get('month') + 3, 0))
    const logtime = await get_range_logtime(message.split(' ')[2], date_begin, date_end)
    const time = format_output_datetime(logtime)
    postOnThread(sprintf(`%02dh%02d`, time[0], time[1]), channel, ts)
  } else if (
    message.split(' ')[3] in month &&
    (message.split(' ').length === 4 || (message.split(' ').length === 5 && parseInt(message.split(' ')[4]) > 2012))
  ) {
    if (message.split(' ').length === 5 && parseInt(message.split(' ')[4]) > 2012)
      year = parseInt(message.split(' ')[4])
    else year = new Date().getFullYear()
    let date_begin = moment(new Date(year, month[message.split(' ')[3]], 1))
    let date_end = moment(new Date(year, month[message.split(' ')[3]] + 1, 0))
    const logtime = await get_range_logtime(message.split(' ')[2], date_begin, date_end)
    var time = format_output_datetime(logtime)
    postOnThread(sprintf(`%02dh%02d`, time[0], time[1]), channel, ts)
  } else if (message.split(' ').length === 5) {
    let date_end
    if (message.split(' ')[4] === 'today') date_end = moment()
    else date_end = moment(message.split(' ')[4])
    let date_begin = moment(message.split(' ')[3])
    if (date_end.isValid() && date_begin.isValid()) {
      const logtime = await get_range_logtime(message.split(' ')[2], date_begin, date_end)
      const time = format_output_datetime(logtime)
      postOnThread(sprintf(`%02dh%02d`, time[0], time[1]), channel, ts)
    }
  }
}

const who = async (msg, channel) => {
  if (msg.split(' ').length > 2) place = msg.split(' ')[2]
  else {
    postMessage(`prend une place en parametre`, channel)
    return
  }
  if (!place || place.startsWith('!') || place.startsWith('?')) return
  const url = `/v2/campus/1/locations/?filter[host]=${place}&filter[active]=true`
  const data = await request42(url)
  if (data.length === 0) postMessage(`Place *${place}* vide`, channel)
  else postMessage(`*${data[0]['user']['login']}* est à la place *${place}*`, channel)
}

const where = async (msg, channel, usr) => {
  if (msg.split(' ').length > 2) user = msg.split(' ')[2]
  else {
    let username = await getUsername(usr)
    try {
      user = username['user']['email'].strsub(0, username['user']['email'].indexOf('@'))
    } catch (err) {
      user = username['user']['name']
    }
  }
  if (!user || user.startsWith('!') || user.startsWith('?')) return
  if (user === 'queen' || user == 'way') {
    postMessage("follow me bruddah\ni'll show you de way :uganda_knuckles:", channel)
    return
  }
  if (user === 'dieu' || user === 'dobby') user = 'elebouch'
  url = `/v2/users/${user}/locations`
  const data = await request42(url)
  if (!data) {
    postMessage(`login invalide`, channel)
    return
  }
  if (data.length === 0 || data[0]['end_at']) postMessage(`*${user}* est hors ligne`, channel)
  else postMessage(`*${user}* est à la place *${data[0]['host']}*`, channel)
}

module.exports.alliance = alliance
module.exports.logtime = logtime
module.exports.score = score
module.exports.profil = profil
module.exports.who = who
module.exports.where = where
