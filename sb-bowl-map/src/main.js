import { loadVenue } from './data.js';
import { VenueMap } from './venue-map.js';

const root = document.getElementById('app');
const venueUrl = document.documentElement.dataset.venue ?? 'data/venue.json';

try {
  const venue = await loadVenue(venueUrl);
  document.title = `${venue.name} · Map`;
  new VenueMap(root, venue).mount();
} catch (error) {
  console.error(error);
  root.removeAttribute('aria-busy');
  root.innerHTML = '';
  const msg = document.createElement('p');
  msg.className = 'app__status app__status--error';
  msg.textContent = `Couldn't load the map: ${error.message}`;
  root.append(msg);
}
