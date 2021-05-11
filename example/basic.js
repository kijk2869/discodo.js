const { Client } = require("discord.js")
const { DJSClient } = require("discodo.js")

const client = new Client()
const codo = new DJSClient(client)

client.on("ready", async () => {
  console.log(`I logged in as ${client.user.username} (${client.user.id})`)
    
  client.Audio.registerNode({ host: "localhost", port: 8000 })
})

codo.on("SOURCE_START", async (VC, { source }) => {
  await VC.channel.send(`I'm now playing ${source.title}`)
})

client.on("message", async (message) => {
  if (message.author.bot) return
  
  if (message.content.startsWith("!join")) {
    if (!message.member.voice.channel) return await message.channel.send("Join the voice channel first.")
      
    await client.Audio.connect(message.member.voice.channel)

    return await message.channel.send(`I Connected to <#${message.member.voice.channel.id}>`)
  }
  
  if (message.content.startsWith("!play")) {
    const VC = codo.getVC(message.guild.id, true)
    
    if (!VC) return await message.channel.send("Please type `!join` first.")
    
    if (VC.channel === undefined) VC.channel = message.channel
    
    const source = await VC.loadSource(message.content.substring(6))
    
    if (source instanceof Array) return await message.channel.send(`${source.length - 1} songs except ${source[0].title} added.`)
    
    return await message.channel.send(`${source.title} added.`)
  }
  
  if (message.content.startsWith("!stop")) {
    const VC = codo.getVC(message.guild.id, true)
    
    if (!VC) return await message.channel.send("I'm not connected to any voice channel now.")
    
    await VC.destroy()
    
    return await message.channel.send("I stopped the player and cleaned the queue.")
  }
})

client.login("your discord bot token here")
