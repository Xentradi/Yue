const fs = require('node:fs');
const path = require('node:path');

const getAllFiles = require('../utils/getAllFiles');

module.exports = client => {
  const eventFolders = getAllFiles(path.join(__dirname, '..', 'events'), true);
  console.log(eventFolders);

  for (const eventFolder of eventFolders) {
    const eventFiles = getAllFiles(eventFolder, false);
    console.log(eventFiles);
  }
  /*
  // Event Handler
  const eventsPath = path.join(__dirname, '../events');
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
*/
};
