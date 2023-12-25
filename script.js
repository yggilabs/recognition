(() => {
// color definitions
const COLOR_UNKNOWN = -1, 
	COLOR_NONE = 0, 
	COLOR_BLUE = 1,
	COLOR_VIOLET = 2,
	COLOR_MAGENTA = 3,
	COLOR_ORANGE = 4,
	COLOR_YELLOW = 5;


const params = new URLSearchParams(document.location.search);

// parse url params for pattern definitions
const base_patterns = params.get("patterns").split("").reduce((a,c) => {
  a.c.push(c)
  if(a.c.length == 4) {
    a.a.push(a.c)
    a.c = [];
  }
  return a;
},{a:[],c:[]}).a.map((a,i) => {
  return {
    id: i,
    nw: a[0],
    ne: a[1],
    sw: a[2],
    se: a[3],
  };
});

// parse url for board
const base_board =params.get("board").split("");

/*
// pattern definitions
const base_patterns = [
	{
		nw: COLOR_UNKNOWN, 
		ne: COLOR_BLUE,
		sw: COLOR_ORANGE,
		se: COLOR_MAGENTA
	},
	{
		nw: COLOR_UNKNOWN, 
		ne: COLOR_YELLOW,
		sw: COLOR_VIOLET,
		se: COLOR_BLUE
	}
];

https://yggilabs.github.io/recognition/?patterns=1523225133555211411211412322524453121154&board=6660000666660000006660002004060300000000000000100000030000200000000000600000040666050000666660000666
*/

// rotate a pattern "clockwise"
const rotate_pattern = pattern => {
	return {
    id: pattern.id,
		nw: pattern.sw, 
		ne: pattern.nw,
		sw: pattern.se,
		se: pattern.ne
	}
};

// recolor the nw color. assuming that nw color is COLOR_UNKNOWN
const color_pattern = (color, pattern) => {
  return {
    id: pattern.id,
    nw: color, 
    ne: pattern.ne,
    sw: pattern.sw,
    se: pattern.ne
  };
};

// takes a pattern with one unknown color in nw position. return array of all possible recolors
const expand_pattern_color = pattern => {	
	return [COLOR_BLUE, COLOR_VIOLET, COLOR_MAGENTA, COLOR_ORANGE, COLOR_YELLOW].map(color => color_pattern(color, pattern))
};

// takes a pattern. return array of all possible rotations
const expand_pattern_rotate = pattern => {
	const rotations = Array(4);
	rotations[0] = pattern;
	rotations[1] = rotate_pattern(rotations[0]);
	rotations[2] = rotate_pattern(rotations[1]);
	rotations[3] = rotate_pattern(rotations[2]);
	return rotations;
};



BOARD_WIDTH = 10;
BOARD_HEIGHT = 10;

const next_board = board => {
  const frames = []
  
  for(let i = 0; i < BOARD_WIDTH - 1; i++) {
    for(let j = 0; j < BOARD_HEIGHT - 1; j++) {
      // calculate positions
      const nw_index = (BOARD_WIDTH*i)+j;
      const ne_index = nw_index + 1;
      const sw_index = nw_index + BOARD_WIDTH;
      const se_index = sw_index + 1;
  
      const nw_value = board[nw_index];
      const ne_value = board[ne_index];
      const sw_value = board[sw_index];
      const se_value = board[se_index];
      
      // lookup values
      const frame = {
        nw: {
          value: nw_value,
          index: nw_index
        },
        ne: {
          value: ne_value,
          index: ne_index
        },
        sw: {
          value: sw_value,
          index: sw_index
        },
        se: {
          value: se_value,
          index: se_index
        }
      }
  
      const frame_is_valid = frame => 
        (frame.nw.value >= 0 && frame.nw.value < 6) &&
        (frame.ne.value >= 0 && frame.ne.value < 6) &&
        (frame.sw.value >= 0 && frame.sw.value < 6) &&
        (frame.se.value >= 0 && frame.se.value < 6) &&
        (frame.nw.value == 0 || frame.ne.value == 0 || frame.sw.value == 0 || frame.se.value == 0)
      
      if(frame_is_valid(frame)) {
        frames.push(frame);
      }
    }  
  }

  const matches_frame = frame => {
    return pattern => {
      return frame.nw.value == 0 | frame.nw.value == pattern.nw &&
      frame.ne.value == 0 | frame.ne.value == pattern.ne &&
      frame.sw.value == 0 | frame.sw.value == pattern.sw &&
      frame.se.value == 0 | frame.se.value == pattern.se
    } 
  }

  function getRandom(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
  }

  const sort_bias_desc = (a, b) => selections[b.id] - selections[a.id];
	
  const has_entropy = a => a.entropy > 0;
  const sort_entropy_asc = (a, b) => a.entropy - b.entropy;
  const calculate_entropy = frame => {
    const matches = expanded_patterns.filter(matches_frame(frame));
    frame.entropy = matches.length;
    frame.match = matches.sort(sort_bias_desc)[0];
    return frame;
  };
  
  const candidates = frames.map(calculate_entropy).filter(has_entropy).sort(sort_entropy_asc);
  const selected = candidates[0];

  if(selected === undefined) return board;
  
  board[selected.nw.index] = selected.match.nw;
  board[selected.ne.index] = selected.match.ne;
  board[selected.sw.index] = selected.match.sw;
  board[selected.se.index] = selected.match.se;

  selections[selected.id] = (selections[selected.id] || 0) + 1;

  return board;
}

const calculate_bias = pattern => (new Set([pattern.nw, pattern.ne, pattern.sw, pattern.se])).size
const add_bias = match => {
  match.bias = calculate_bias(match);
  return match;
}

let expanded_patterns = base_patterns.flatMap(expand_pattern_color).flatMap(expand_pattern_rotate).map(add_bias);

const selections = new Array(base_patterns.length);

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}


let board = base_board;

for(let i = 0; i < 100; i++) {
  expanded_patterns = shuffle(expanded_patterns);
  board = next_board(board);
}

const number_to_class = n => ["white","blue","violet","magenta","orange","yellow","black"][n];
const list = document.getElementById("board");

board.map(number_to_class).forEach(class_name => {
  const item = document.createElement("li");
  item.classList.add(class_name);
  list.append(item);
});

console.log(selected);
console.log(expanded_patterns);
  
})();
