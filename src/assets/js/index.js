class WS {
  constructor({url, oninit, onopen, onmessage, onerror, onclose, onreconnect, onunload} = {}) {
    this.url = url;
    this.oninit = oninit;
    this.onopen = onopen;
    this.onmessage = onmessage;
    this.onerror = onerror;
    this.onclose = onclose;
    this.onreconnect = onreconnect;
    this.onunload = onunload;
    this.fails = 0;
    this.maxFails = 3;
    this.init();
  }

  init() {
    this.websocket = new WebSocket(this.url);
    if (typeof this.oninit === 'function') this.oninit(this.websocket);
    this.websocket.onerror = e => {
      if (typeof this.onerror === 'function') this.onerror(this.websocket, e);
    };
    this.websocket.onopen = e => {
      this.fails = 0;
      if (typeof this.onopen === 'function') this.onopen(this.websocket, e);
    };
    this.websocket.onmessage = e => {
      if (typeof this.onmessage === 'function') this.onmessage(this.websocket, e);
    };
    this.websocket.onclose = e => {
      if (typeof this.onclose === 'function') this.onclose(this.websocket, e);
      if (e.wasClean) {
        return true;
      }
      switch (e.code) {
        case 1006:
          this.reconnect(e);
          break;
        default:
          break;
      }
    };
  };

  reconnect(e) {
    let timeout = 5000 * ++this.fails;

    this.fini();

    if (this.fails >= this.maxFails) {
      timeout = null;
    }

    if (typeof this.onreconnect === 'function') this.onreconnect(this.websocket, e, timeout, this.fails, this.maxFails);

    if (timeout) {
      setTimeout(() => {
        if (typeof this.onreconnect === 'function') this.onreconnect(this.websocket, null, timeout, this.fails, this.maxFails);
        this.init();
      }, timeout);
    }
  }

  fini() {
    this.websocket.close();
    if (typeof this.onunload === 'function') this.onunload(this.websocket);
    this.websocket = undefined;
  }
}

class Background {

  constructor() {
    this.stylesheet = Background.createStylesheet();
    this.stylesheet.insertRule('.jsOnly { display: initial !important }', 0);
    this.stylesheet.insertRule('.wrapper.jsOnly { display: flex !important }', 0);

    //this.init();
  }

  /*init() {
    let random = arr => arr[Math.floor(Math.random() * arr.length)];

    let digits0 = [0, 1, 2];
    let url = 'https://tumba.ch/static/img/bckgrnds/' + random(digits0) + random(digits0) + '.jpg';
    let image = Background.createImage(url);
    image.onload = () => {
      this.ruleIndex = this.stylesheet.cssRules.length;
      this.stylesheet.insertRule(`#bckgrnd{background:url("${url}") center/cover;opacity:.5 !important}`, this.ruleIndex);
    };
  }

  fini() {
    this.stylesheet.deleteRule(this.ruleIndex);
  }*/

  static createStylesheet() {
    let stylesheet;
    if (document.styleSheets[0]) {
      stylesheet = document.styleSheets[0];
    } else {
      let style = document.createElement('style');
      style.type = 'text/css';
      style.appendChild(document.createTextNode(""));
      document.head.appendChild(style);
      stylesheet = style.sheet;
    }
    return stylesheet;
  }

  /*static createImage(url, w, h) {
    let image = new Image(w, h);
    image.src = url;
    return image;
  }*/

}

class Jukebox {
  constructor(station = 'tumbach') {
    let secure = location.protocol.includes('s:') ? "s" : "";
    this.stations = {
      tumbach: 'http'+ secure + '://' + document.domain + '/stream.aac',
    };
    this.station = station;
    this.titleturtleURL = 'wss://titleturtle.tumba.ch/ws';

    if (/complete|interactive/.test(document.readyState)) {
      this.init();
    } else {
      window.addEventListener('DOMContentLoaded', this.init.bind(this), false);
    }
  }

  init() {
    window.dom = new DOM();
    initPlayer(this.station, this.stations);
    connectToTitleTurtle(this.station, this.titleturtleURL);
  }
}


let background = new Background();
let jukebox = new Jukebox();
let trackHistory = [];
let trackHistoryLength = 0;

class DOM {
  constructor() {
    this.Time = document.getElementsByTagName('h3')[0];
    this.Artist = document.getElementsByTagName('h2')[0];
    this.Title = document.getElementsByTagName('h1')[0];
    //this.Online = document.getElementsByClassName('online')[0];
    this.TrackHistory = document.getElementsByClassName('history')[0];
  }
}

function connectToTitleTurtle(stationId, titleturtleURL) {
  websocket = new WS({
    url: titleturtleURL,
    oninit: () => {
      niceAppend('Подключение к серверу тегов...', dom.Artist);
    },
    onopen: ws => {
      let message = `${stationId}...`;
      niceAppend(message, dom.Artist);
      ws.send(`HISTORY ${stationId} 5`);
      ws.send(`SUB ${stationId}`);
      //ws.send(`STATS SUB ${stationId}`);
    },
    onmessage: (ws, e) => {
      try {
        let data = JSON.parse(e.data);
        let track = data[stationId];
        if (track instanceof Object) { // SUB callback
          setTime(track.date, +track.now || +track.date);
          dom.Artist.title = (track.artist || '<unknown>');
          dom.Title.title = track.title || '<unknown>';
          delay(this.dl? 2000 : 0).then(() => {
            niceAppend(dom.Artist.title, dom.Artist, false);
            niceAppend(dom.Title.title, dom.Title, false);
            setTitle(dom.Artist.title + ' - ' + dom.Title.title);
          });
          if (!this.dl) {
            this.dl = true;
          }
          if (!track.now) {
            trackHistory.push(track);
            if (trackHistory.length > trackHistoryLength + 1) {
              trackHistory = trackHistory.slice(-trackHistoryLength - 1);
            }
          }
          updateHistory();
        } /*else if (data.online === +data.online) { // STATS callback
          dom.Online.innerText = data.online + ' ';
        }*/ else if (data instanceof Array) { // HISTORY callback
          trackHistory = trackHistory.concat(data);
          trackHistoryLength = data.length;
          //updateHistory();
        }
      } catch (e) {
        console.log(e);
      }
    },
    onclose: prettyReconnect,
    onerror: prettyReconnect,
    onreconnect: (_1, error, timeout, fails, maxFails) => {
      let message = timeout
        ? error
          ? `Переподключаемся через ${timeout/1000} секунд...`
          : `Подключение (${fails}/${maxFails})...`
        : '<нет подключения к серверу тегов>';
      niceAppend(message, dom.Artist);
    }
  });

  function prettyReconnect(ws, e) {
    let message;

    switch (e.code) {
      case 1000:
        message = 'Симметричный разрыв соединения';
        break;
      case 1001:
        message = 'Принудительно разрываем соединение...';
        break;
      case 1002:
        message = 'Ошибка протокола!';
        break;
      case 1006:
        message = 'Соединение не установлено или закрыто (1006)';
        break;
      default:
        message = 'Ошибка ' + e.code;
    }
    niceAppend(message, dom.Time);
  }
}

let interval;
let time;
let isFocused = true;
let titles = {
  original: document.title,
  track: '<ничего не играет>'
};
window.onblur = () => {
  isFocused = false;
  setTitle(titles.track);
  //clearInterval(interval);
};
window.onfocus = () => {
  isFocused = true;
  document.title = titles.original;
  //setTime(time, Math.floor(+new Date/1000));
};

function setTitle(t) {
  titles.track = t;
  if (!isFocused) {
    document.title = t;
  }
}

function setTime(start, now = Math.floor(+new Date() / 1000)) {
  let seconds = now - start;
  console.log(`Hacking the time. Set ${seconds} seconds...`);
  time = start;
  niceAppend(prettifyTime(seconds), dom.Time, false).then(() => {
    clearInterval(interval);
    interval = setInterval(() => {
      dom.Time.innerText = prettifyTime(seconds++);
    }, 1000);
  });
}

function prettifyTime(time) {
  time = Math.floor(+time);
  let d = Math.floor(time / 86400);
  time %= 86400;
  let h = Math.floor(time / 3600);
  time %= 3600;
  let m = Math.floor(time / 60);
  let s = time % 60;
  return `${d ? d + ':' : ''}${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

function initPlayer(stationId, stations) {
  let button = document.getElementById('main-button');
  let audio = new Audio();
  audio.crossOrigin = 'anonymous';
  button.addEventListener('click', () => {
    button.classList.toggle('play', !audio.paused);
    button.classList.toggle('pause', audio.paused);
    if (!audio.src || audio.paused) {
      audio.src = stations[stationId];
      return audio.play();
    }
    audio.pause();
    audio.src = '';
  });

  document.addEventListener("wheel", e => {
    let volumeUp = e.deltaY < 0;
    let { volume } = audio;
    volume += volumeUp ? 0.05 : -0.05;
    if (volume > 1) {
      volume = 1;
    }
    if (volume < 0) {
      volume = 0;
    }
    audio.volume = volume;
  });
}

function niceAppend(text, node, disableAnimation = true) {
  return new Promise(async resolve => {
    let lock = node.dataset.niceAppendLock = Math.floor(Math.random() * 0xFFF).toString(16);
    let initial = node.innerText;
    if (disableAnimation) {
      return resolve(node.innerText = text);
    }
    let alphabet = '0123456789@#;%&~' +
      'abcdefghijklmnopqrstuvwxyz' +
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
      'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ' +
      'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
    alphabet = shuffle(alphabet.split('')).join('');
    let tmp = node.innerText.split('');
    let i = 0;
    for (let char of text.split('')) {
      if (lock !== node.dataset.niceAppendLock) {
        return resolve(node.innerText);
      }
      let index = alphabet.indexOf(char);
      if (index === -1) {
        tmp[i] = char;
        node.innerText = tmp.join('');
        await delay();
      } else {
        while (char !== tmp[i]) {
          tmp[i] = alphabet[Math.floor(Math.random() * 2) + (index - 1)];
          node.innerText = tmp.join('');
          await delay();
        }
      }
      ++i;
    }
    while (i < initial.length) {
      let j = 0;
      while (j < 3) {
        tmp[i] = alphabet[Math.floor(Math.random() * alphabet.length)];
        ++j;
        node.innerText = tmp.join('');
        await delay();
      }
      tmp[i++] = ' ';
      node.innerText = tmp.join('');
      await delay();
    }
    return resolve(node.innerText = text);
  });
}

function delay(ms = 24) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shuffle(array) {
  let currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

function updateHistory() {
  let fragment = new DocumentFragment();
  trackHistory.slice(0, trackHistoryLength).map((value, index) => {
    let date = new Date(value.date*1000);
    let div = document.createElement('div');
    div.style.opacity = "" + ((index + 1) / trackHistoryLength);
    div.innerText = `[${date.toLocaleTimeString()}] ${value.artist} - ${value.title}`;
    fragment.appendChild(div);
  });
  let c;
  while (c = dom.TrackHistory.firstChild) {
    dom.TrackHistory.removeChild(c);
  }
  dom.TrackHistory.appendChild(fragment);
}
