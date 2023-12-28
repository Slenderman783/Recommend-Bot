const Discord = require('discord.js');
const PlexAPI = require('plex-api');
const fetch = require('isomorphic-fetch');
const TMDB_API_KEY = '847803d90ece3f3243d414fa7586b1da';

const discordToken = 'MTEwODE0MjEwMzUzNzY2NDEzMw.G4K_sQ.Wl-2ZXQiH72ATQ3M6AGtE49AkvxIYIa-_IXrz';
const plexConfig = {
  hostname: '192.168.0.99',
  port: 32400,
  username: 'Slenderman783',
  password: 'Gorhamm001',
};

let prefix = '!'; // Default command prefix
const favoriteShows = {}; // Object to store favorite shows for each user

const client = new Discord.Client();

client.once('ready', () => {
  console.log('Discord bot is ready!');
});

client.on('message', async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'recommend') {
    const request = args.join(' ').toLowerCase();

    try {
      const plex = new PlexAPI(plexConfig);
      const sections = await plex.query('/library/sections');

      // Extract all section keys
      const sectionKeys = sections.MediaContainer.Directory.map((section) => section.key);

      // Determine the media type based on the request
      let mediaType = '';
      if (request.includes('movie')) {
        mediaType = 'movie';
      } else if (request.includes('tv show') || request.includes('tvshow')) {
        mediaType = 'show';
      } else if (request.includes('kids') && (request.includes('movie') || request.includes('tv show') || request.includes('tvshow'))) {
        mediaType = 'kids';
      } else {
        message.channel.send('Please specify whether you want a movie, a TV show, or a kids show recommendation.');
        return;
      }

      // Retrieve section keys of the specified media type
      const matchingSectionKeys = sectionKeys.filter((key) => {
        const section = sections.MediaContainer.Directory.find((dir) => dir.key === key);
        return section.type === mediaType;
      });

      if (matchingSectionKeys.length === 0) {
        message.channel.send(`There are no ${mediaType} sections available.`);
        return;
      }

      // Retrieve a random section key
      const randomSectionKey = matchingSectionKeys[Math.floor(Math.random() * matchingSectionKeys.length)];

      // Retrieve a random item from the chosen section
      const items = await plex.query(`/library/sections/${randomSectionKey}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=50`);

      if (items.MediaContainer.Metadata.length === 0) {
        message.channel.send(`There are no ${mediaType}s available in the selected section.`);
        return;
      }

      // Generate the specified number of recommendations
      const numRecommendations = parseInt(args[0]);
      if (isNaN(numRecommendations) || numRecommendations <= 0) {
        message.channel.send('Please provide a valid number of recommendations.');
        return;
      }

      const recommendations = [];
      for (let i = 0; i < numRecommendations; i++) {
        const randomItem = items.MediaContainer.Metadata[Math.floor(Math.random() * items.MediaContainer.Metadata.length)];

        // Fetch additional details and ratings from TMDb API
        let tmdbData = null;
        try {
          tmdbData = await fetchTMDBData(randomItem.title, mediaType);
        } catch (error) {
          console.error('An error occurred while fetching data from TMDb:', error.message);
        }

        if (!tmdbData) {
          message.channel.send(`Failed to fetch additional details for ${randomItem.title}`);
          continue;
        }

        const recommendation = {
          title: randomItem.title,
          summary: randomItem.summary,
          rating: tmdbData.rating,
          year: tmdbData.year,
          genres: tmdbData.genres.join(', '),
          poster: tmdbData.poster,
        };

        recommendations.push(recommendation);
      }

      if (recommendations.length === 0) {
        message.channel.send('No recommendations available.');
        return;
      }

      // Send the list of recommendations
      const recommendationEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`${numRecommendations} Recommendations`)
        .setDescription(`Here are ${numRecommendations} ${mediaType}s for you:`);

      recommendations.forEach((recommendation) => {
        recommendationEmbed.addField(recommendation.title, `Rating: ${recommendation.rating}, Year: ${recommendation.year}`);
      });

      message.channel.send(recommendationEmbed);
    } catch (error) {
      console.error('An error occurred:', error.message);
      message.channel.send('An error occurred while processing your request. Please try again later.');
    }
  } else if (command === 'prefix') {
    if (!args[0]) {
      message.channel.send(`The current prefix is \`${prefix}\``);
    } else {
      prefix = args[0];
      message.channel.send(`Prefix set to \`${prefix}\``);
    }
  } else if (command === 'addfavourite') {
    const userId = message.author.id;
    const showTitle = args.join(' ').toLowerCase();

    if (!favoriteShows[userId]) {
      favoriteShows[userId] = [];
    }

    if (favoriteShows[userId].includes(showTitle)) {
      message.channel.send(`You have already added ${showTitle} to your favorite shows.`);
    } else {
      favoriteShows[userId].push(showTitle);
      message.channel.send(`Successfully added ${showTitle} to your favorite shows.`);
    }
  } else if (command === 'removefavourite') {
    const userId = message.author.id;
    const showTitle = args.join(' ').toLowerCase();

    if (!favoriteShows[userId] || favoriteShows[userId].length === 0) {
      message.channel.send('You have no favorite shows to remove.');
    } else {
      const index = favoriteShows[userId].findIndex((title) => title === showTitle);

      if (index === -1) {
        message.channel.send(`${showTitle} is not in your favorite shows list.`);
      } else {
        favoriteShows[userId].splice(index, 1);
        message.channel.send(`Successfully removed ${showTitle} from your favorite shows.`);
      }
    }
  } else if (command === 'favorites') {
    const userId = message.author.id;

    if (!favoriteShows[userId] || favoriteShows[userId].length === 0) {
      message.channel.send('You have no favorite shows.');
    } else {
      const favoriteShowsList = favoriteShows[userId].join(', ');
      message.channel.send(`Your favorite shows: ${favoriteShowsList}`);
    }
  } else if (command === 'searchgenre') {
    const genre = args.join(' ').toLowerCase();

    try {
      const tmdbData = await searchTMDBByGenre(genre);

      if (tmdbData.length === 0) {
        message.channel.send(`No results found for the genre: ${genre}`);
        return;
      }

      const genreEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`Search Results for Genre: ${genre}`);

      tmdbData.forEach((item) => {
        genreEmbed.addField(item.title, `Rating: ${item.rating}, Year: ${item.year}`);
      });

      message.channel.send(genreEmbed);
    } catch (error) {
      console.error('An error occurred while searching for genre:', error.message);
      message.channel.send('An error occurred while searching for the genre. Please try again later.');
    }
  } else if (command === 'help') {
    const helpEmbed = new Discord.MessageEmbed()
      .setColor('#0099ff')
      .setTitle('Command List')
      .addField('!recommend [movie|tv show]', 'Get a random movie or TV show recommendation')
      .addField('!recommendations [num]', 'Get multiple random movie or TV show recommendations')
      .addField('!prefix [newPrefix]', 'Set a new command prefix')
      .addField('!addfavourite [showTitle]', 'Add a TV show to your favorite shows')
      .addField('!removefavourite [showTitle]', 'Remove a TV show from your favorite shows')
      .addField('!favorites', 'List all your favorite shows')
      .addField('!searchgenre [genre]', 'Search for movies and TV shows by genre')
      .addField('!help', 'Show the list of commands and how to use them');

    message.channel.send(helpEmbed);
  }
});

async function fetchTMDBData(title, mediaType) {
  const encodedTitle = encodeURIComponent(title);
  const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodedTitle}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.results.length > 0) {
    const result = data.results[0];
    const tmdbData = {
      rating: result.vote_average,
      year: result.release_date ? result.release_date.slice(0, 4) : 'N/A',
      genres: result.genre_ids,
      poster: `https://image.tmdb.org/t/p/w200${result.poster_path}`,
    };
    return tmdbData;
  } else {
    return null;
  }
}

async function searchTMDBByGenre(genre) {
  const encodedGenre = encodeURIComponent(genre);
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${encodedGenre}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.results.length > 0) {
    const results = data.results.slice(0, 5);
    const tmdbData = results.map((result) => ({
      title: result.title,
      rating: result.vote_average,
      year: result.release_date ? result.release_date.slice(0, 4) : 'N/A',
    }));
    return tmdbData;
  } else {
    return [];
  }
}

client.login(discordToken);
