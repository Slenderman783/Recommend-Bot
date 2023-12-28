require('isomorphic-fetch');

const TMDB_API_KEY = '847803d90ece3f3243d414fa7586b1da';

async function fetchTMDBData(title, mediaType) {
  const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json();

  if (searchData.results && searchData.results.length > 0) {
    const result = searchData.results[0];
    const posterUrl = `https://image.tmdb.org/t/p/w500${result.poster_path}`;
    let details = '';
    let ratings = '';

    if (result.media_type === 'movie') {
      details = `Title: ${result.title}\nRelease Date: ${result.release_date}\nOverview: ${result.overview}`;
      ratings = `TMDb Rating: ${result.vote_average}/10\nVote Count: ${result.vote_count}`;
    } else if (result.media_type === 'tv') {
      details = `Title: ${result.name}\nFirst Air Date: ${result.first_air_date}\nOverview: ${result.overview}`;
      ratings = `TMDb Rating: ${result.vote_average}/10\nVote Count: ${result.vote_count}`;
    } else {
      details = 'Details not found';
      ratings = 'Ratings not found';
    }

    return { posterUrl, details, ratings };
  }

  return { posterUrl: '', details: 'Details not found', ratings: 'Ratings not found' };
}

module.exports = fetchTMDBData;
