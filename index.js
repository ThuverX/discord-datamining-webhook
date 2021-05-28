require('dotenv').config()

const { Webhook, MessageBuilder } = require('discord-webhook-node')
const fetch = require('node-fetch')
const { promises: fs} = require('fs')

const db_path = './db.json'
const epoch = new Date()

if(!process.env.HOOKURL) throw 'Invalid webhook url: ' + process.env.HOOKURL

const hook = new Webhook(process.env.HOOKURL)
 
hook.setUsername('Discord Datamining')

setInterval(() => check(), 36e5)

check()

function createMessage(commit_name, commit_url, commit_body) {
    let img = commit_body.match(/!\[(?<title>.+)\]\((?<url>.+)\)/)

    let msg = new MessageBuilder()
            .setTitle(commit_name)
            .setDescription(commit_body
                .replace(/## (.+)($|\n)/g, '**$1**')
                .replace(/!\[(?<title>.+)\]\((?<url>.+)\)/g, '*image*')
            )
            .setAuthor('Discord Update', 'https://cdn.discordapp.com/embed/avatars/0.png', commit_url)
            .setColor(0x5865f2)
            .setTimestamp()

    if(img) msg = msg.setImage(img.groups.url)

    let data = msg.getJSON()

    data.components = [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    label: "View on Github",
                    style: 5,
                    url: commit_url
                }
            ]
        }
    ]

    return { getJSON: () => data }
}

function wait(time = 1000) {
    return new Promise((res) => setTimeout(res, time))
}

async function check() {
    try {
        await fs.lstat(db_path)
    } catch(e) {
        await fs.writeFile(db_path, '[]')
    }

    let json = await (await fetch('https://api.github.com/repos/Discord-Datamining/Discord-Datamining/commits')).json()
    let old_ids = JSON.parse(await fs.readFile(db_path)) || []
    let changed_ids = []

    for(let {sha, commit} of json) {
        if(commit.comment_count > 0) {
            let comments = await(await fetch(`https://api.github.com/repos/Discord-Datamining/Discord-Datamining/commits/${sha}/comments`)).json()

            for(let {id, created_at, body, html_url} of [comments[0]]) {
                if(new Date(created_at).getTime() > epoch.getTime()) {
                    if(!old_ids.includes(id)) {
                        hook.send(createMessage(commit.message.split(' - ')[1], html_url, body))
                        changed_ids.push(id)

                        await wait(1000)
                    }
                }
            }
        }
    }

    await fs.writeFile(db_path, JSON.stringify([...old_ids, ...changed_ids]))

    console.log(`PULSE sent ${ changed_ids.length } updates`)
}