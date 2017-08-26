// 1. beach

var canvas = document.createElement('canvas');
var ctx = canvas.getContext('2d');
document.body.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function paintSands(sands) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  sands.forEach(function(sand) {
    ctx.fillRect(sand.x, sand.y, sand.size, sand.size);
  });
}

var SPEED = 40;
var SAND_NUMBER = 250;
var SandStream = Rx.Observable.range(1, SAND_NUMBER)
  .map(function() {
    return {
      x: parseInt(Math.random() * canvas.width),
      y: parseInt(Math.random() * canvas.height),
      size: Math.random() * 3 + 1
    };
  })
  .toArray()
  .flatMap(function(sandArray) {
    return Rx.Observable.interval(SPEED).map(function() {
      sandArray.forEach(function(sand) {
        if (sand.x >= canvas.width) {
          sand.x = 0;
        }
        sand.x += sand.size;
      });
      return sandArray;
    })
  });

// 2. bible
var BIBLE_X = 30;

var MouseMove = Rx.Observable.fromEvent(canvas, 'mousemove');
var Bible = MouseMove
  .map(function(event) {
    return {
      x: BIBLE_X,
      y: event.clientY
    }
  })
  .startWith({
    x: BIBLE_X,
    y: canvas.height / 2
  });

function drawTriangle(x, y, height, color, direction) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - height);
  ctx.lineTo(direction === 'right' ? x + height : x - height, y);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y-height);
  ctx.fill();
}

function paintBible(x, y) {
  drawTriangle(x, y, 20, '#ff0000', 'right');
}

// 4. chicks
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function paintChicks(chicks) {
  chicks.forEach(function(chick) {
    chick.x -= 5;
    chick.y += getRandomInt(-15, 15);

    if(!chick.isInLove) {
      drawTriangle(chick.x, chick.y, 20, '#00ff00', 'left');
    }
    chick.kisses.forEach(function(kiss) {
      kiss.x -= KISSING_SPEED;
      drawTriangle(kiss.x, kiss.y, 5, '#00ffff', 'left');
    })
  });
}

var CHICK_FREQ = 1500;
var CHICK_KISSING_FREQ = 750;
var Chicks = Rx.Observable.interval(CHICK_FREQ)
  .scan(function(chickArray) {
    var chick = {
      x: canvas.width + 30,
      y: parseInt(Math.random() * canvas.height),
      kisses: []
    };
    // chick kisses
    Rx.Observable.interval(CHICK_KISSING_FREQ).subscribe(function() {
      if (!chick.isInLove) {
        chick.kisses.push({
          x: chick.x,
          y: chick.y
        })
      }
      chick.kisses = chick.kisses.filter(isOnTheBeach);
    });

    chickArray.push(chick);
    return chickArray
      .filter(isOnTheBeach)
      .filter(function(chick) {
        return !(chick.isInLove && chick.kisses.length === 0);
      });
  }, []);

// 5. Kisses
function isOnTheBeach(obj) {
  return obj.x > -40 && obj.x < canvas.width + 40 &&
    obj.y > -40 && obj.y < canvas.height + 40;
}

var KISSING_SPEED = 15;
var SCORE_INCREASE = 10;
function paintKisses(kisses, chicks) {
  kisses.forEach(function(kiss) {
    for (var i = 0; i < chicks.length; i++) {
      var chick = chicks[i];
      if(!chick.isInLove && inLove(kiss, chick)) {
        ScoreSubject.onNext(SCORE_INCREASE);
        chick.isInLove = true;
        kiss.x = kiss.y = -100;
        break;
      }
    }
    kiss.x += KISSING_SPEED;
    drawTriangle(kiss.x, kiss.y, 5, '#ffff00', 'right');
  })
}

var BibleKissing = Rx.Observable
  .merge(
    Rx.Observable.fromEvent(canvas, 'click'),
    Rx.Observable.fromEvent(document, 'keydown')
      .filter(function(evt) { return evt.keycode === 32; })
  )
  .startWith({})
  .sample(200)
  .timestamp();

var BibleKisses = Rx.Observable
  .combineLatest(
    BibleKissing,
    Bible,
    function(kisses, bible) {
      return {
        y: bible.y,
        timestamp: kisses.timestamp
      };
    })
    .distinctUntilChanged(function(kiss) {
      return kiss.timestamp;
    })
    .scan(function(kissArray, kiss) {
      kissArray.push({ x: BIBLE_X, y: kiss.y});
      return kissArray;
    }, []);

// 7. keep scores
function paintScore(score) {
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px snas-serif';
  ctx.fillText('Score:' + score, 40, 43);
}

var ScoreSubject = new Rx.BehaviorSubject(0);
var score = ScoreSubject.scan(function(prev, cur) {
  return prev + cur;
}, 0);

// 3. whole scene

function renderScene(scene) {
  paintSands(scene.sands);
  paintBible(scene.bible.x, scene.bible.y);
  paintChicks(scene.chicks);
  paintKisses(scene.kisses, scene.chicks);
  paintScore(scene.score);
}

var BibleOnTheBeach = Rx.Observable
  .combineLatest(
    SandStream, Bible, Chicks, BibleKisses, score,
    function(sands, bible, chicks, kisses, score) {
      return {
        sands: sands,
        bible: bible,
        chicks: chicks,
        kisses: kisses,
        score: score
      };
    })
    .sample(SPEED)
    .takeWhile(function(scene) {
      return goHome(scene.bible, scene.chicks) === false;
    });

BibleOnTheBeach.subscribe(renderScene);

// 6. Chick seduce
function goHome(bible, chicks) {
  return chicks.some(function(chick) {
    if (inLove(bible, chick)) {
      return true;
    }

    return chick.kisses.some(function(kiss) {
      return inLove(bible, kiss);
    });
  });
}

function inLove(obj1, obj2) {
  return (obj1.x > obj2.x - 20 && obj1.x < obj2.x + 20) &&
    (obj1.y > obj2.y - 20 && obj1.y < obj2.y + 20);
}

