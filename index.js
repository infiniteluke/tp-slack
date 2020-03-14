const { text } = require('micro')
const { parse } = require('querystring')
const { WebClient } = require('@slack/web-api');

const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

// Random stock between 200 and 5000 rolls
let rolls = getRandomInt(200, 5000);
// Allow porition between 7% and 40%
let allowedPortion = Math.random() * (0.07 - 0.4) + 0.4;
let originalStock = rolls;
let score = {};

function reset() {
  score = {};
  rolls = getRandomInt(200, 5000);
  allowedPortion = Math.random() * (0.07 - 0.4) + 0.4;
  originalStock = rolls;
}

module.exports = async (req, res) => {
  let attachments;
  let result = 'The store is closed';
  let response_type = 'in_channel'
  try {
    const body = parse(await text(req))
    const { user } = await web.users.info({ user: body.user_id });
    result = `${user.real_name} failed to grab any :tp:. Try \`/tp grab\``
    let [cmd, num = 1] = body.text.split(' ');
    num = Number.isNaN(num / 1) || num < 0 ? 0 : Math.floor(num);
    if (cmd === 'help') {
      result = `\`\`\`
/tp grab {number} -- Grab some :tp:
/tp stats -- See who won /tp score, /tp scoreboard
/tp reset -- Restock the store
\`\`\``
    } else if (cmd === 'reset') {
      if (rolls === 0) {
        reset();
        result = `Game restarting... There are ${rolls} :tp: in stock`
      } else {
        result = `There are still ${rolls} :tp: left`
      }
    } else if (cmd === 'grab') {
      response_type = 'in_channel'
      if (num/originalStock > allowedPortion) {
        result = 'Wow. Don\'t be greedy';
      }
      else if (rolls - num < 0) {
        result = `Sorry. There are only ${rolls} :tp: left at this store. Check back later.`
      }
      else if (rolls <= 0) {
        result = 'Sorry. There is no :tp: left at this store. Check back later. Try \`/tp reset\`'
      } else {
        rolls -= num;
        if (score[user.real_name]) {
          score[user.real_name] += num; 
        } else {
          score[user.real_name] = num;
        }
        result = `${user.real_name} grabbed ${num} :tp:. There ${rolls === 1 ? `is ${rolls} roll` : `are ${rolls} rolls`} left at this store`;
      }
    } else if (cmd === 'score') {
      response_type = 'ephemeral'
      if (score[user.real_name]) {
        result = `You have ${score[user.real_name]} ${score[user.real_name] === 1 ? 'roll' : 'rolls'} of :tp: from this store`
      } else {
        result = `You have no :tp: from this store`
      }
    } else if (cmd === 'scoreboard' || cmd === 'stats') {
      response_type = 'in_channel'
      const sortedScores = Object.entries(score).sort(([,a], [,b]) => b - a);
      if (sortedScores.length) {
      result = sortedScores.reduce((cur, [name, score]) => `${cur}
${name}: ${score}`,'Scoreboard:')
      } else {
        result = 'Scoreboard is empty. Try \`/tp reset\` to start a game'
      }
    }
  } catch (error) {
    // Capture any errors
    result = error.message
    attachments = [{ text: error.stack }]
  }

  res.writeHead(200, { 'Content-Type': 'application/json' })
  // Create response object and send result back to Slack
  res.end(JSON.stringify({ response_type, text: result, attachments }))
}