/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   handle_command.js                                  :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: elebouch <elebouch@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2018/03/02 14:30:21 by elebouch          #+#    #+#             */
/*   Updated: 2018/03/05 13:31:48 by elebouch         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

const { postMessage, postUserMessage, sendReaction, fileUpload, postOnThread, getUsername } = require('./slack_api')
const { score, alliance, logtime, profil, who, where } = require('./42_api')
const { citation } = require('./citation')
const { randomgif } = require('./giphy')
const { roll, addmusic, music, meteo, dobby } = require('./miscs')
const fs = require('fs')
const { parrot, blExcMark } = require('./const')
const { choose } = require('./utils')

const reply = async (cmd, channel) => {
  const contents = await fs.readFileSync('./reply.json')
  const json = JSON.parse(contents)
  if (json[cmd]) {
    postMessage(json[cmd], channel)
    return true
  }
  return false
}

functions = {
  alliance: (message, channel, ts, user) => alliance(channel),
  score: (message, channel, ts, user) => score(ts, channel),
  help: (message, channel, ts, user) => fileUpload(fs.createReadStream('./featurespic.jpeg'), channel),
  glegendr: (message, channel, ts, user) => randomgif('how about no'.replace(' ', '+'), channel),
  mfranc: (message, channel, ts, user) => postMessage(choose(['>Doucement avec les bots', '>Puuuuuuuuuuuuu']), channel),
  score: (message, channel, ts, user) => score(channel, ts),
  prof: (message, channel, ts, user) => profil(message.toLowerCase(), channel, user),

  logtime: (message, channel, ts, user) => logtime(message, channel, ts),
  who: (message, channel, ts, user) => who(message.toLowerCase(), channel),
  roll: (message, channel, ts, user) => roll(message, channel),
  where: (message, channel, ts, user) => where(message.toLowerCase(), channel, user),
  addmusic: (message, channel, ts, user) => addmusic(message, user, channel),
  music: (message, channel, ts, user) => music(channel),
  meteo: (message, channel, ts, user) => meteo(channel),
  dobby: (message, channel, ts, user) => dobby(user, channel),
  randomgif: (message, channel, ts, user) =>
    randomgif(
      message
        .split(' ')
        .slice(2)
        .join(),
      channel
    ),
  oss: (message, channel, ts, user) =>
    citation(
      channel,
      './oss.txt',
      'https://static-cdn.jtvnw.net/emoticons/v1/518312/3.0',
      'Hubert Bonisseur de La Bath'
    ),
  parrot: (message, channel, ts, user) =>
    postMessage(':' + parrot[Math.floor(Math.random() * Math.floor(parrot.length - 1))] + ':', channel),
  kaamelott: (message, channel, ts, user) =>
    citation(channel, './kaamelott.txt', 'https://img15.hostingpics.net/pics/4833663350.jpg', 'Perceval')
}

function handleCommand(msg, channel, ts, user) {
  const message = msg.replace(/\s+/g, ' ').trim()
  console.log({ user, message })

  if (/(\b|^)rip(\b|$)/i.test(message)) sendReaction('rip', channel, ts)
  if (/(\b|^)jpp(\b|$)/i.test(message)) sendReaction('jpp', channel, ts)
  if (/(\b|^)(php|ruby|ror|mongo|mongodb)(\b|$)/i.test(message)) sendReaction('poop', channel, ts)

  if (['coalibot', 'bc', 'cb'].indexOf(message.toLowerCase().split(' ')[0]) > -1 && message.split(' ').length > 1) {
    if (reply(message.split(' ')[1].toLowerCase(), channel) == true) return
    if (functions[message.split(' ')[1].toLowerCase()])
      functions[message.split(' ')[1].toLowerCase()](message, channel, ts, user)
  } else if (
    message.indexOf('!') === 0 &&
    blExcMark.indexOf(
      message
        .replace('!', '')
        .split(' ')[0]
        .toLowerCase()
    ) === -1
  ) {
    const command = message
      .replace('!', 'bc ')
      .split(' ')[1]
      .toLowerCase()
    if (reply(command, channel) == true) return
    console.log(command)
    if (functions[command]) functions[command](message.replace('!', 'bc '), channel, ts, user)
  }
}

module.exports.handleCommand = handleCommand
