const Discord = require('discord.js');
const PlexAPI = require('plex-api');
const fetch = require('isomorphic-fetch');
const TMDB_API_KEY = '847803d90ece3f3243d414fa7586b1da';

const discordToken = 'MTEwODE0MjEwMzUzNzY2NDEzMw.G0pGP3.LO_kBtb-hHi29gPebCIJJb8lD2_W_iL7qaFbuA';
const plexConfig = {
  hostname: '192.168.1.99',
  port: 32400,
  username: 'Slenderman783',
  password: 'Gorhamm001',
};

let prefix = '!'; // Default command prefix
const favoriteShows = {}; // Object to store favorite shows for each user
const blacklist = []; // Array to store blacklisted item keys

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

      // Retrieve a random item from the chosen section, excluding those in the blacklist
      const items = await plex.query(`/library/sections/${randomSectionKey}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=50`);
      const filteredItems = applyFilters(items.MediaContainer.Metadata, args);

      if (filteredItems.length === 0) {
        message.channel.send('No results found matching the specified filters.');
        return;
      }

      const randomItem = filteredItems[Math.floor(Math.random() * filteredItems.length)];

      // Fetch additional details and ratings from TMDb API
      let tmdbData = null;
      if (mediaType === 'movie') {
        tmdbData = await fetchMovieDetails(randomItem.title, randomItem.year);
      } else {
        tmdbData = await fetchTVShowDetails(randomItem.title);
      }

      const recommendationEmbed = createRecommendationEmbed(randomItem, tmdbData, mediaType);
      message.channel.send(recommendationEmbed);
    } catch (error) {
      console.error(error);
      message.channel.send('An error occurred while retrieving recommendations. Please try again later.');
    }
  } else if (command === 'favorite') {
    const showName = args.join(' ').toLowerCase();
    const userId = message.author.id;

    if (!showName) {
      message.channel.send('Please provide a show name to add to your favorites.');
      return;
    }

    if (!favoriteShows[userId]) {
      favoriteShows[userId] = [];
    }

    if (favoriteShows[userId].includes(showName)) {
      message.channel.send('This show is already in your favorites.');
    } else {
      favoriteShows[userId].push(showName);
      message.channel.send(`The show "${showName}" has been added to your favorites.`);
    }
  } else if (command === 'favorites') {
    const userId = message.author.id;
    const userFavorites = favoriteShows[userId];

    if (!userFavorites || userFavorites.length === 0) {
      message.channel.send('You have no favorite shows yet.');
      return;
    }

    const favoritesList = userFavorites.map((show) => `- ${show}`).join('\n');
    message.channel.send(`Your favorite shows:\n${favoritesList}`);
  } else if (command === 'remove') {
    const showName = args.join(' ').toLowerCase();
    const userId = message.author.id;

    if (!showName) {
      message.channel.send('Please provide a show name to remove from your favorites.');
      return;
    }

    if (!favoriteShows[userId] || favoriteShows[userId].length === 0) {
      message.channel.send('You have no favorite shows to remove.');
      return;
    }

    const index = favoriteShows[userId].indexOf(showName);
    if (index !== -1) {
      favoriteShows[userId].splice(index, 1);
      message.channel.send(`The show "${showName}" has been removed from your favorites.`);
    } else {
      message.channel.send('This show is not in your favorites.');
    }
  } else if (command === 'blacklist') {
    if (!args.length) {
      message.channel.send('You must provide an item key to blacklist.');
      return;
    }
    const itemKey = args[0];

    // Add the item key to the blacklist
    blacklist.push(itemKey);

    message.channel.send(`Item with key ${itemKey} has been added to the blacklist.`);
  }
});

// Function to apply filters and exclude items from the blacklist
function applyFilters(items, filters) {
  return items.filter((item) => {
    console.log('Item:', item); // Log the item to inspect its structure

    // Ensure that the genre information is stored in the "Genre" field
    const genre = item.Genre ? item.Genre.toLowerCase() : '';

    // Exclude items from the blacklist
    if (blacklist.includes(item.key)) {
      return false;
    }

    // Exclude items from the "Porn" library
    if (item.library.toLowerCase() === 'porn') {
      return false;
    }

    for (const filter of filters) {
      if (!matchesFilter(item, filter, genre)) {
        return false;
      }
    }
    return true;
  });
}

// Function to fetch movie details from TMDb API
async function fetchMovieDetails(title, year) {
  const encodedTitle = encodeURIComponent(title);
  const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodedTitle}&year=${year}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.results.length > 0 ? data.results[0] : null;
}

// Function to fetch TV show details from TMDb API
async function fetchTVShowDetails(title) {
  const encodedTitle = encodeURIComponent(title);
  const url = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodedTitle}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.results.length > 0 ? data.results[0] : null;
}

// Function to create an embedded message for the recommendation
function createRecommendationEmbed(item, tmdbData, mediaType) {
  const embed = new Discord.MessageEmbed()
    .setColor('#0099ff')
    .setTitle(item.title)
    .setDescription(item.summary)
    .setThumbnail(item.thumb);

  if (tmdbData) {
    if (mediaType === 'movie') {
      const releaseDate = tmdbData.release_date ? new Date(tmdbData.release_date).toLocaleDateString() : 'Unknown';
      embed.addField('Release Date', releaseDate, true);
      embed.addField('Vote Average', tmdbData.vote_average, true);
      embed.setURL(`https://www.themoviedb.org/movie/${tmdbData.id}`);
    } else {
      const firstAirDate = tmdbData.first_air_date ? new Date(tmdbData.first_air_date).toLocaleDateString() : 'Unknown';
      embed.addField('First Air Date', firstAirDate, true);
      embed.addField('Vote Average', tmdbData.vote_average, true);
      embed.setURL(`https://www.themoviedb.org/tv/${tmdbData.id}`);
    }

    if (tmdbData.poster_path) {
      const posterUrl = `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`;
      embed.setImage(posterUrl);
    }
  }

  return embed;
}

// Function to check if an item matches a filter
function matchesFilter(item, filter, genre) {
  // Check if the filter matches the title or genre of the item
  return item.title.toLowerCase().includes(filter) || genre.includes(filter);
}

client.login(discordToken);
