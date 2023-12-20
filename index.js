const Discord = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const ytdl = require("ytdl-core");
const dotenv = require("dotenv")
dotenv.config()

const prefix = "!";
const client = new Discord.Client({
    intents: [1, 512, 32768, 2, 128,
        Discord.IntentsBitField.Flags.DirectMessages,
        Discord.IntentsBitField.Flags.GuildInvites,
        Discord.IntentsBitField.Flags.GuildMembers,
        Discord.IntentsBitField.Flags.GuildPresences,
        Discord.IntentsBitField.Flags.Guilds,
        Discord.IntentsBitField.Flags.MessageContent,
        Discord.IntentsBitField.Flags.Guilds,
        Discord.IntentsBitField.Flags.GuildMessageReactions,
        Discord.IntentsBitField.Flags.GuildEmojisAndStickers
    ],
    partials: [
        Discord.Partials.User,
        Discord.Partials.Message,
        Discord.Partials.Reaction,
        Discord.Partials.Channel,
        Discord.Partials.GuildMember
    ]
});
const player = createAudioPlayer();
const queue = new Map();

client.once("ready", () => {
    console.log("Pronto!");
});

client.once("reconnecting", () => {
    console.log("Reconectando!");
});

client.once("disconnect", () => {
    console.log("Desconectado!");
});

let serverQueue;

client.on("messageCreate", async message => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    serverQueue = queue.get(message.guild.id);

    if (message.content.startsWith(`${prefix}play`)) {
        execute(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}skip`)) {
        skip(message, serverQueue);
    } else if (message.content.startsWith(`${prefix}stop`)) {
        stop(message, serverQueue);
    } else {
        message.channel.send("Você precisa inserir um comando válido!");
    }
});

async function execute(message, serverQueue) {
    const args = message.content.split(" ");
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel)
        return message.channel.send("Você precisa estar em um canal de voz para reproduzir música!");

    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        return message.channel.send("Preciso das permissões para entrar e falar no seu canal de voz!");
    }

    const songInfo = await ytdl.getInfo(args[1]);
    const song = {
        title: songInfo.videoDetails.title,
        url: songInfo.videoDetails.video_url,
    };

    if (!serverQueue || serverQueue.songs.length === 0) {
        const queueContruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [song],
            volume: 5,
            playing: true
        };

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        queue.set(message.guild.id, queueContruct);

        try {
            play(message.guild, song, connection);
        } catch (err) {
            console.log(err);
            queue.delete(message.guild.id);
            return message.channel.send(err.message ? err.message : "Erro ao conectar ao canal de voz!");
        }
    } else {
        serverQueue.songs.push(song);
        message.channel.send(`${song.title} foi adicionada à fila!`);
    }
}

function skip(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send("Você precisa estar em um canal de voz para pular a música!");

    if (!serverQueue || serverQueue.songs.length === 0)
        return message.channel.send("Não há música para pular!");

    serverQueue.songs.shift();
    playNextSong(serverQueue);
}

async function stop(message, serverQueue) {
    if (!message.member.voice.channel)
        return message.channel.send("Você precisa estar em um canal de voz para parar a música!");

    if (!serverQueue)
        return message.channel.send("Não há música para parar!");

    serverQueue.songs = [];
    player.stop();
}

function play(guild, song, connection) {
    const serverQueue = queue.get(guild.id);
    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const stream = ytdl(song.url, { filter: "audioonly" });
    const resource = createAudioResource(stream);

    player.play(resource);
    connection.subscribe(player);

    serverQueue.textChannel.send(`Iniciando a reprodução de: **${song.title}**`);
}

player.addListener("stateChange", (oldState, newState) => {
    if (newState.status === 'idle' && serverQueue.songs.length >= 1) {
        serverQueue.songs.shift();
        playNextSong(serverQueue);
    }
});

function playNextSong(serverQueue) {
    if (serverQueue.songs.length !== 0) {
        const nextSong = serverQueue.songs[0];
        const stream = ytdl(nextSong.url, { filter: "audioonly" });
        const resource = createAudioResource(stream);
        player.play(resource);
    }
}

client.login(process.env.token);
