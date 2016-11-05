var fs = require('fs'),
    request = require('request'),
    csp = require('js-csp'),
    program = require('commander');

program
  .version("0.1.1")
  .option('-l, --language <str>', 'language [EN|NL] default: EN', String, 'EN');
program.parse(process.argv);

const ENDPOINT = 'https://mastodon.social';
const OAUTH_ENDPOINT = 'https://mastodon.social/oauth/token';

const LANGUAGES = {
  EN: 'haddock.txt',
  NL: 'haddock_nl.txt'
};

const DATA_FILE = LANGUAGES[program.language];

if (!DATA_FILE) {
  console.error(`no data file found for language ${program.language}`);
  process.exit(0);
}

const CURSES = fs.readFileSync(DATA_FILE)
  .toString()
  .split(/[\r\n]/)
  .filter(ln => {
    return ln && ln.length;
  });

const TIMEOUT = 1000 * 60 * 15;

let current_curse = 0;

function post (api_call, payload, endpoint=ENDPOINT) {
  return new Promise(function (resolve, reject) {
    let options = {
      json: payload,
      url: `${endpoint}${api_call}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ACCESS_TOKEN}`
      }
    };
    request(options, function (err, res, body) {
      if (err) return reject(err);
      resolve(body);
    });
  });
}

function create_app (name) {
  return post('/api/v1/apps', {
    client_name: name,
    redirect_uris: 'urn:ietf:wg:oauth:2.0:oob'
  });
}

function create_access_token () {
  return post('', {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: 'password',
    username: process.env.MASTODON_USERNAME,
    password: process.env.MASTODON_PASSWORD,
    scope: 'read write follow'
  }, OAUTH_ENDPOINT);
}

function curse () {
  current_curse = current_curse < CURSES.length ? current_curse : 0;

  let ch = csp.chan();

  c = CURSES[current_curse++];

  post('/api/v1/statuses', {status: c}).then(res => {
    console.log(c);
    csp.putAsync(ch, true);
    ch.close();
  }).catch(err => {
    console.error(err);
    csp.putAsync(ch, false);
    ch.close();
  });

  return ch;
}

csp.go(function* () {
  while (true) {
    yield csp.take(curse());

    yield csp.timeout(TIMEOUT);
  }
});
